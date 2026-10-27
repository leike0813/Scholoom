import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { ManagedNode, ProcessAdmission } from '../../packages/platform/dist/node.js';

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
    await mkdir(join(root, 'node_modules', '@scholoom'), { recursive: true });
    await symlink(
      fileURLToPath(new URL('../../packages/protocol/', import.meta.url)),
      join(root, 'node_modules', '@scholoom', 'protocol'),
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
    expect(await child.exited).toEqual({ code: 0, signal: null });
    await expect(child.stopped).resolves.toBeUndefined();
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

for (const scenario of [
  {
    name: 'exit',
    source: '#!/bin/sh\nexit 23\n',
    nativeCode: 23,
    controllerCode: 1,
    stopped: false,
    status: 'unobserved',
    reason: 'nativeScopeExit',
    code: 'outcomeUnknown',
  },
  {
    name: 'unavailable',
    source: "#!/bin/sh\nprintf 'E native scope unavailable\\n' >&5\nread -r stop <&4\nexit 0\n",
    nativeCode: 0,
    controllerCode: 0,
    stopped: true,
    status: 'E',
    reason: 'nativeScopeUnavailable',
    code: 'unavailable',
  },
] as const) {
  test(`native scope ${scenario.name} preserves final exit diagnostics and capacity without startup secrets`, async () => {
    test.skip(process.platform === 'win32', 'POSIX executable failure fixture');
    const root = await mkdtemp(join(tmpdir(), 'scholoom-native-failure-'));
    const admission = new ProcessAdmission(1);
    const lease = admission.reserve();
    try {
      const directory = join(root, 'dist');
      await mkdir(directory);
      for (const file of ['processes.js', 'process-controller.js'])
        await cp(
          new URL(`../../packages/platform/dist/${file}`, import.meta.url),
          join(directory, file),
        );
      await writeFile(join(root, 'package.json'), '{"type":"module"}');
      await mkdir(join(root, 'node_modules', '@scholoom'), { recursive: true });
      await symlink(
        fileURLToPath(new URL('../../packages/protocol/', import.meta.url)),
        join(root, 'node_modules', '@scholoom', 'protocol'),
        'junction',
      );
      // Only the native executable is a deterministic failure double; controller and IPC are real.
      await writeFile(join(directory, 'process-scope'), scenario.source, { mode: 0o755 });
      const platform: typeof import('../../packages/platform/dist/processes.js') = await import(
        pathToFileURL(join(directory, 'processes.js')).href
      );
      const error = await platform.ManagedNode.start({
        entry,
        instanceId: 'native-failure',
        env: { SCHOLOOM_DIAGNOSTIC_SECRET: 'private-bootstrap-not-a-diagnostic' },
        reservation: lease,
      }).then(
        () => {
          throw new Error('Failing scope must not start the execution.');
        },
        (reason) => reason,
      );
      expect(error).toMatchObject({ code: scenario.code });
      assert(error instanceof Error);
      expect(JSON.parse(error.message.split('\n').at(-1) ?? '')).toMatchObject({
        instanceId: 'native-failure',
        controller: { code: scenario.controllerCode, signal: null },
        stoppedReceived: scenario.stopped,
        native: { lastStatus: scenario.status, code: scenario.nativeCode, signal: null },
        reason: scenario.reason,
      });
      expect(error.message).not.toContain('private-bootstrap-not-a-diagnostic');
      lease.release();
      expect(admission.status.active).toBe(scenario.stopped ? 0 : 1);
      if (!scenario.stopped)
        expect(() => admission.reserve()).toThrow(
          expect.objectContaining({ code: 'resourceLimit' }),
        );
    } finally {
      lease.release();
      await rm(root, { recursive: true });
    }
  });
}
