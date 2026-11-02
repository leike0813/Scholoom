import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { chmod, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openReportChannel } from '../../packages/platform/dist/report-channel.js';
import { limits } from '../../packages/protocol/dist/core.js';

test.skip(
  process.platform !== 'linux' || process.arch !== 'x64',
  'SO_PEERCRED helper requires Linux x64.',
);
const helper = fileURLToPath(
  new URL('../../packages/platform/dist/report-channel', import.meta.url),
);
const fixture = fileURLToPath(new URL('../fixtures/report-channel-server.mts', import.meta.url));
const cache = join(homedir(), '.cache', 'scholoom-report-channel-tests');
const uid = process.getuid?.() ?? -1;
const gid = process.getgid?.() ?? -1;
const otherUid = uid === 0 ? 1 : uid + 1;

interface ServerMessage {
  type: string;
  pid?: number;
  uid?: number;
  gid?: number;
  connection?: number;
  bytes?: number;
  accepted?: number;
  listening?: boolean;
  code?: number | null;
  stdout?: string;
  stderr?: string;
  message?: string;
}

async function server(mode = 'echo', expectedUid = uid) {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(cache, 'run-'));
  await chmod(root, 0o700);
  const path = join(root, 'channel.sock');
  expect(Buffer.byteLength(path)).toBeLessThan(108);
  const messages: ServerMessage[] = [];
  const child = fork(
    fixture,
    [path, mode, helper, String(expectedUid), String(limits.frameBytes)],
    {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    },
  );
  let stderr = '';
  child.stderr?.on('data', (part: Buffer) => {
    stderr = (stderr + part.toString()).slice(0, 16384);
  });
  child.on('message', (message: ServerMessage) => messages.push(message));
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    },
  );
  async function close() {
    if (child.connected) child.send({ type: 'close' });
    const stopped = await exit;
    await writeFile(
      join(root, 'server.json'),
      JSON.stringify({ pid: child.pid, stopped, stderr, messages }, null, 2),
    );
    expect(stopped).toEqual({ code: 0, signal: null });
    expect(messages.find((message) => message.type === 'closed')).toMatchObject({
      listening: false,
    });
  }
  try {
    await expect
      .poll(() => {
        const failure = messages.find((message) => message.type === 'failure');
        if (failure) throw new Error(failure.message);
        if (child.exitCode !== null) throw new Error(`Server exited: ${stderr}`);
        return messages.some((message) => message.type === 'ready');
      })
      .toBe(true);
    expect(messages.find((message) => message.type === 'ready')).toMatchObject({
      pid: child.pid,
      uid,
      gid,
    });
    return { root, path, child, messages, close };
  } catch (error) {
    await close();
    throw error;
  }
}

function observe(path: string, ownerUid = uid, serverUid = uid) {
  const frames: string[] = [];
  const closes: unknown[] = [];
  const opening = openReportChannel({
    path,
    ownerUid,
    serverUid,
    onFrame: (frame) => {
      frames.push(frame);
    },
    onClose: (error) => {
      closes.push(error);
    },
  });
  return { frames, closes, opening };
}

test('an authenticated Unix socket preserves large multibyte frames across fragmented reads and writes', async () => {
  const f = await server();
  const observed = observe(f.path);
  let channel: Awaited<typeof observed.opening> | undefined;
  try {
    channel = await observed.opening;
    expect(channel.peer).toEqual({ pid: f.child.pid, uid, gid });
    const small = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'fixed.ping', params: {} });
    const large = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'fixed.echo',
      params: { text: '界😀'.repeat(50000) },
    });
    expect(Buffer.byteLength(large)).toBeGreaterThan(256 * 1024);
    expect(Buffer.byteLength(large)).toBeLessThan(limits.frameBytes);
    await channel.send(small);
    await channel.send(large);
    const boundary = JSON.stringify({
      text: 'x'.repeat(limits.frameBytes - Buffer.byteLength(JSON.stringify({ text: '' }))),
    });
    expect(Buffer.byteLength(boundary)).toBe(limits.frameBytes);
    await channel.send(boundary);
    await expect.poll(() => observed.frames.length).toBe(3);
    expect(observed.frames.map((frame) => Buffer.byteLength(frame))).toEqual(
      [small, large, boundary].map((frame) => Buffer.byteLength(frame)),
    );
    expect(observed.frames.every((frame, index) => frame === [small, large, boundary][index])).toBe(
      true,
    );
    expect(observed.closes).toEqual([]);
  } finally {
    await channel?.close();
    await f.close();
  }
});

for (const invalid of [
  'server-uid',
  'owner-uid',
  'writable-parent',
  'other-writable-leaf',
  'leaf-symlink',
  'parent-symlink',
  'dot-dot',
  'relative',
] as const) {
  test(`channel authentication rejects ${invalid}`, async () => {
    const f = await server();
    let path = f.path;
    try {
      if (invalid === 'writable-parent') await chmod(f.root, 0o770);
      if (invalid === 'other-writable-leaf') await chmod(f.path, 0o602);
      if (invalid === 'leaf-symlink') {
        path = join(f.root, 'alias.sock');
        await symlink(f.path, path);
      }
      if (invalid === 'parent-symlink') {
        await symlink(dirname(f.path), join(f.root, 'alias'));
        path = join(f.root, 'alias', 'channel.sock');
      }
      if (invalid === 'dot-dot') {
        await mkdir(join(f.root, 'sub'), { mode: 0o700 });
        path = f.root + '/sub/../channel.sock';
      }
      if (invalid === 'relative') path = relative(process.cwd(), f.path);
      const observed = observe(
        path,
        invalid === 'owner-uid' ? otherUid : uid,
        invalid === 'server-uid' ? otherUid : uid,
      );
      const result = await observed.opening.then(
        (channel) => ({ channel }),
        (error: unknown) => ({ error }),
      );
      if ('channel' in result) await result.channel.close();
      expect(result).toHaveProperty('error');
      if ('error' in result) expect(result.error).toMatchObject({ code: 'authenticationFailed' });
      expect(observed.frames).toEqual([]);
    } finally {
      await chmod(f.root, 0o700);
      await f.close();
    }
  });
}

for (const mode of ['bad-utf8', 'oversize', 'partial-eof']) {
  test(`a ${mode} stream closes without delivering a partial frame`, async () => {
    const f = await server(mode);
    const observed = observe(f.path);
    let channel: Awaited<typeof observed.opening> | undefined;
    try {
      channel = await observed.opening;
      f.child.send({ type: 'emit' });
      await expect.poll(() => observed.closes.length).toBe(1);
      expect(observed.closes[0]).toMatchObject({ code: 'protocolIncompatible' });
      expect(observed.frames).toEqual([]);
      await expect(channel.send('{}')).rejects.toBeDefined();
    } finally {
      await channel?.close();
      await f.close();
      expect(observed.closes).toHaveLength(1);
    }
  });
}

for (const invalid of ['newline', 'multibyte-oversize']) {
  test(`outgoing ${invalid} is rejected before the server receives any frame`, async () => {
    const f = await server();
    const observed = observe(f.path);
    let channel: Awaited<typeof observed.opening> | undefined;
    try {
      channel = await observed.opening;
      const frame =
        invalid === 'newline'
          ? '{}\n{}'
          : JSON.stringify({ text: '界'.repeat(Math.floor(limits.frameBytes / 3) + 1) });
      await expect(channel.send(frame)).rejects.toBeDefined();
      await channel.close();
      await expect
        .poll(() => f.messages.some((message) => message.type === 'disconnected'))
        .toBe(true);
      expect(f.messages.filter((message) => message.type === 'received')).toEqual([]);
    } finally {
      await channel?.close();
      await f.close();
    }
  });
}

test('a closed channel does not reconnect or affect a new binding', async () => {
  const f = await server();
  const first = observe(f.path);
  let old: Awaited<typeof first.opening> | undefined;
  let current: Awaited<typeof first.opening> | undefined;
  try {
    old = await first.opening;
    await old.close();
    const next = observe(f.path);
    current = await next.opening;
    await expect(old.send('{}')).rejects.toBeDefined();
    const frame = JSON.stringify({ jsonrpc: '2.0', id: 'new', result: { intact: true } });
    await current.send(frame);
    await expect.poll(() => next.frames).toEqual([frame]);
    expect(first.frames).toEqual([]);
    expect(next.closes).toEqual([]);
    await expect
      .poll(() => f.messages.filter((message) => message.type === 'accepted').length)
      .toBe(2);
  } finally {
    await current?.close();
    await old?.close();
    await f.close();
  }
});

for (const mode of ['peer-helper', 'peer-platform']) {
  for (const authorized of [true, false]) {
    test(`${mode} authenticates connected socket stdin, expected UID ${authorized ? 'matches' : 'differs'}`, async () => {
      const f = await server(mode, authorized ? uid : otherUid);
      const socket = connect(f.path);
      socket.on('error', () => {});
      try {
        await expect.poll(() => f.messages.some((message) => message.type === 'peer')).toBe(true);
        const reply = f.messages.find((message) => message.type === 'peer');
        assert(reply);
        if (authorized) {
          expect(reply.code).toBe(0);
          expect(JSON.parse(reply.stdout ?? '')).toEqual({ pid: process.pid, uid, gid });
        } else {
          expect(reply.code).not.toBe(0);
          expect(reply.stdout?.trim()).toBe('');
        }
      } finally {
        socket.destroy();
        await f.close();
      }
    });
  }
}
