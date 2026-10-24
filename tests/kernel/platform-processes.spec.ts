import { fork } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { ManagedNode } from '../../packages/platform/dist/node.js';

const entry = new URL('../fixtures/processes/execution.mjs', import.meta.url);
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test('owned execution starts from a Unicode installation path containing spaces', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom 安装 path-'));
  let child: ManagedNode | undefined;
  try {
    await cp(new URL('../../packages/platform/dist/', import.meta.url), join(root, 'dist'), {
      recursive: true,
    });
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    await symlink(
      fileURLToPath(new URL('../../packages/platform/node_modules/', import.meta.url)),
      join(root, 'node_modules'),
      'junction',
    );
    const platform: typeof import('../../packages/platform/dist/node.js') = await import(
      pathToFileURL(join(root, 'dist', 'node.js')).href
    );
    child = await platform.ManagedNode.start({
      entry,
      instanceId: 'installation-path',
      stopMs: 20,
    });
    const reply = once(child, 'message');
    await child.send({ value: 42 });
    expect((await reply)[0]).toEqual({ value: 42 });
    await child.stop();
  } finally {
    await child?.stop();
    await rm(root, { recursive: true });
  }
});

test('owned execution echoes IPC, rejects stale identity and excludes ambient secrets', async () => {
  process.env.SCHOLOOM_TEST_SECRET = 'must-not-inherit';
  const child = await ManagedNode.start({
    entry,
    instanceId: 'test-identity',
    stopMs: 20,
    env: { SCHOLOOM_TEST_EXPLICIT: 'allowed' },
  });
  try {
    const reply = once(child, 'message');
    await child.send({ action: 'environment' });
    expect((await reply)[0]).toEqual({ secret: null, explicit: 'allowed' });
    await expect(child.stop({ ...child.identity!, instanceId: 'stale' })).rejects.toMatchObject({
      code: 'instanceMismatch',
    });
    const echo = once(child, 'message');
    await child.send({ value: 42 });
    expect((await echo)[0]).toEqual({ value: 42 });
    await expect(child.send({ text: 'x'.repeat(2 * 1024 * 1024) })).rejects.toMatchObject({
      code: 'tooLarge',
    });
    await child.send({ jsonrpc: '2.0', method: 'execution.stop', params: {} });
    await child.exited;
  } finally {
    delete process.env.SCHOLOOM_TEST_SECRET;
    await child.stop();
  }
  expect(alive(child.identity!.pid)).toBe(false);
});

test('controller stops a busy execution loop and its descendant', async () => {
  const child = await ManagedNode.start({ entry, instanceId: 'busy', stopMs: 20 });
  let descendant: number | undefined;
  try {
    const spawned = once(child, 'message');
    await child.send({ action: 'spawn' });
    descendant = (await spawned)[0].descendant;
    const blocked = once(child, 'message');
    await child.send({ action: 'block' });
    expect((await blocked)[0]).toEqual({ blocked: true });
  } finally {
    await child.stop();
  }
  await expect.poll(() => alive(child.identity!.pid)).toBe(false);
  // A killed descendant may remain a zombie until the OS reaps it; it cannot execute.
  if (process.platform !== 'linux' && descendant)
    await expect.poll(() => alive(descendant!)).toBe(false);
});

test('host SIGKILL still reclaims a busy execution', async () => {
  const host = fork(new URL('../fixtures/processes/host.mjs', import.meta.url), [], {
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    execArgv: [],
  });
  let pid: number | undefined;
  try {
    const [message] = await once(host, 'message');
    pid = message.pid;
    const exited = once(host, 'exit');
    host.kill('SIGKILL');
    await exited;
    await expect.poll(() => alive(pid!)).toBe(false);
  } finally {
    if (host.exitCode === null && host.signalCode === null) host.kill('SIGKILL');
  }
});
