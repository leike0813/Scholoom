import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import {
  chmod,
  type FileHandle,
  lstat,
  mkdir,
  mkdtemp,
  open,
  rename,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test as base, expect } from '@playwright/test';
import { IsolatedReportData } from '../../packages/platform/dist/isolated-report-data.js';
import { describeReportNodeRuntime } from '../../packages/platform/dist/isolated-report-runtime.js';
import { limits, OperationError } from '../../packages/protocol/dist/core.js';
import type { SystemReportNode } from '../../packages/protocol/dist/platform-isolation.js';
import { reportLimits } from '../../packages/protocol/dist/report-contracts.js';

const cache = join(homedir(), '.cache', 'scholoom-isolated-report-data');
const flags = constants.O_RDWR | constants.O_NONBLOCK | constants.O_NOFOLLOW;

function fifo(path: string) {
  execFileSync('/usr/bin/mkfifo', ['-m', '600', path]);
}

async function fixture() {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(cache, 'case-'));
  const inputPath = join(directory, 'data-in');
  const outputPath = join(directory, 'data-out');
  fifo(inputPath);
  fifo(outputPath);
  const inputInfo = await lstat(inputPath, { bigint: true });
  const outputInfo = await lstat(outputPath, { bigint: true });
  const node: SystemReportNode = {
    files: [],
    input: { dev: String(inputInfo.dev), ino: String(inputInfo.ino) },
    output: { dev: String(outputInfo.dev), ino: String(outputInfo.ino) },
  };
  const handles: FileHandle[] = [];
  const input = await open(inputPath, flags);
  handles.push(input);
  const output = await open(outputPath, flags);
  handles.push(output);
  let allowed = true;
  let hook = async () => {};
  const authorize = async () => {
    await hook();
    if (!allowed) throw new OperationError('permissionDenied', 'revoked');
  };
  const data = await IsolatedReportData.open(directory, node, authorize);
  return {
    directory,
    inputPath,
    outputPath,
    input,
    output,
    node,
    data,
    authorize,
    revoke() {
      allowed = false;
    },
    authorization(action: () => Promise<void>) {
      hook = action;
    },
    async close() {
      await data.close();
      await Promise.all(handles.map((handle) => handle.close()));
    },
  };
}

const test = base.extend<{ f: Awaited<ReturnType<typeof fixture>> }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  f: async ({}, use) => {
    const f = await fixture();
    try {
      await use(f);
    } finally {
      await f.close();
    }
  },
});
test.skip(
  process.platform !== 'linux' || process.geteuid?.() === 0,
  'Real FIFOs under an ordinary Linux UID.',
);

async function empty(file: FileHandle) {
  await expect(file.read(Buffer.alloc(1))).rejects.toMatchObject({ code: 'EAGAIN' });
}

test('real FIFOs exchange JSON in both directions and retain a split UTF-8 frame', async ({
  f,
}) => {
  const request = JSON.stringify({ message: '界😀' });
  expect(await f.data.exchange(request)).toEqual({ frames: [] });
  const received = Buffer.alloc(1024);
  const { bytesRead } = await f.input.read(received);
  expect(JSON.parse(received.subarray(0, bytesRead).toString('utf8'))).toEqual({ message: '界😀' });
  const reply = Buffer.from(`${JSON.stringify([{ message: '界😀' }])}\n`);
  const split = reply.indexOf(Buffer.from('界')) + 1;
  await f.output.write(reply.subarray(0, split));
  expect(await f.data.exchange()).toEqual({ frames: [] });
  await f.output.write(reply.subarray(split));
  expect((await f.data.exchange()).frames.map((text) => JSON.parse(text))).toEqual([
    [{ message: '界😀' }],
  ]);
  expect(await f.data.exchange()).toEqual({ frames: [] });
});

test('each exchange returns at most four frames and preserves the remaining frames', async ({
  f,
}) => {
  await f.output.write(
    `${Array.from({ length: 7 }, (_, i) => JSON.stringify({ i })).join('\n')}\n`,
  );
  expect((await f.data.exchange()).frames.map((text) => JSON.parse(text))).toEqual([
    { i: 0 },
    { i: 1 },
    { i: 2 },
    { i: 3 },
  ]);
  expect((await f.data.exchange()).frames.map((text) => JSON.parse(text))).toEqual([
    { i: 4 },
    { i: 5 },
    { i: 6 },
  ]);
  expect(await f.data.exchange()).toEqual({ frames: [] });
});

test('invalid and oversized input never writes a byte or poisons a valid exchange', async ({
  f,
}) => {
  for (const text of ['', 'null', '3', 'false', '"text"', '{}\n{}', '{]'])
    await expect(f.data.exchange(text)).rejects.toMatchObject({ code: 'invalidRequest' });
  const large = JSON.stringify({ text: '界'.repeat(Math.ceil(reportLimits.bridgeBytes / 3)) });
  await expect(f.data.exchange(large)).rejects.toMatchObject({ code: 'resourceLimit' });
  await empty(f.input);
  expect(await f.data.exchange('[]')).toEqual({ frames: [] });
});

test('an exact byte-limit frame succeeds, while a full unterminated buffer is rejected', async ({
  f,
}) => {
  const text = JSON.stringify({
    text: 'x'.repeat(reportLimits.bridgeBytes - Buffer.byteLength('{"text":""}')),
  });
  expect(Buffer.byteLength(text)).toBe(reportLimits.bridgeBytes);
  for (let offset = 0; offset < text.length; offset += 4096) {
    const chunk = text.slice(offset, offset + 4096);
    expect((await f.output.write(chunk)).bytesWritten).toBe(chunk.length);
    expect(await f.data.exchange()).toEqual({ frames: [] });
  }
  await f.output.write('\n');
  expect((await f.data.exchange()).frames).toEqual([text]);
  for (let offset = 0; offset < reportLimits.bridgeBytes; offset += 4096) {
    expect((await f.output.write(Buffer.alloc(4096, 120))).bytesWritten).toBe(4096);
    expect(await f.data.exchange()).toEqual({ frames: [] });
  }
  await f.output.write('x');
  await expect(f.data.exchange()).rejects.toMatchObject({ code: 'protocolIncompatible' });
  await expect(f.data.exchange()).rejects.toMatchObject({ code: 'unavailable' });
});

for (const [name, bytes] of [
  ['UTF-8', Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125, 10])],
  ['primitive', Buffer.from('null\n')],
  ['JSON', Buffer.from('{]\n')],
  ['JSON BOM', Buffer.from('\uFEFF{}\n')],
] as const) {
  test(`invalid output ${name} rejects without delivering a frame`, async ({ f }) => {
    await f.output.write(bytes);
    await expect(f.data.exchange()).rejects.toMatchObject({ code: 'protocolIncompatible' });
  });
}

test('open rejects a mismatched identity, regular file, symlink, or widened FIFO permissions', async ({
  f,
}) => {
  await expect(
    IsolatedReportData.open(
      f.directory,
      {
        ...f.node,
        input: { ...f.node.input, ino: '0' },
      },
      f.authorize,
    ),
  ).rejects.toMatchObject({ code: 'unavailable' });
  await rename(f.inputPath, join(f.directory, 'original'));
  await writeFile(f.inputPath, '', { mode: 0o600 });
  await expect(IsolatedReportData.open(f.directory, f.node, f.authorize)).rejects.toMatchObject({
    code: 'unavailable',
  });
  await rename(f.inputPath, join(f.directory, 'regular'));
  await symlink(join(f.directory, 'original'), f.inputPath);
  await expect(IsolatedReportData.open(f.directory, f.node, f.authorize)).rejects.toMatchObject({
    code: 'unavailable',
  });
  await rename(f.inputPath, join(f.directory, 'alias'));
  await rename(join(f.directory, 'original'), f.inputPath);
  await chmod(f.inputPath, 0o620);
  await expect(IsolatedReportData.open(f.directory, f.node, f.authorize)).rejects.toMatchObject({
    code: 'unavailable',
  });
});

test('replacement of a held FIFO blocks writes to the original descriptor', async ({ f }) => {
  await rename(f.inputPath, join(f.directory, 'original'));
  fifo(f.inputPath);
  await expect(f.data.exchange('{}')).rejects.toMatchObject({ code: 'unavailable' });
  await empty(f.input);
});

test('in-flight metadata changes are rechecked after asynchronous authorization', async ({ f }) => {
  let entered!: () => void;
  let resume!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const released = new Promise<void>((resolve) => {
    resume = resolve;
  });
  f.authorization(async () => {
    entered();
    await released;
  });
  const result = f.data.exchange('{}');
  const rejected = expect(result).rejects.toMatchObject({ code: 'unavailable' });
  await waiting;
  await chmod(f.outputPath, 0o640);
  resume();
  await rejected;
  await empty(f.input);
});

test('open holds FIFOs before running authorization, while exchange rejects before writing', async ({
  f,
}) => {
  f.revoke();
  let checks = 0;
  const held = await IsolatedReportData.open(f.directory, f.node, async () => {
    checks++;
    await f.authorize();
  });
  try {
    expect(checks).toBe(0);
    await expect(held.exchange('{}')).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(checks).toBeGreaterThan(0);
  } finally {
    await held.close();
  }
  await expect(f.data.exchange('{}')).rejects.toMatchObject({ code: 'permissionDenied' });
  await empty(f.input);
});

test('close seals a waiting exchange and rejects concurrent and subsequent calls', async ({
  f,
}) => {
  let entered!: () => void;
  let resume!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const released = new Promise<void>((resolve) => {
    resume = resolve;
  });
  f.authorization(async () => {
    entered();
    await released;
  });
  const result = f.data.exchange('{}');
  const rejected = expect(result).rejects.toMatchObject({ code: 'unavailable' });
  await waiting;
  await expect(f.data.exchange()).rejects.toMatchObject({ code: 'resourceLimit' });
  await f.data.close();
  resume();
  await rejected;
  await f.data.close();
  await expect(f.data.exchange()).rejects.toMatchObject({ code: 'unavailable' });
  await empty(f.input);
});

test('a large request completes across partial nonblocking writes without duplication', async ({
  f,
}) => {
  const text = JSON.stringify({ text: '界'.repeat(18000) });
  const collected: Buffer[] = [];
  const deadline = performance.now() + limits.requestMs;
  const receive = async () => {
    while (true) {
      assert(performance.now() < deadline);
      const buffer = Buffer.alloc(4096);
      try {
        const { bytesRead } = await f.input.read(buffer);
        const bytes = buffer.subarray(0, bytesRead);
        collected.push(bytes);
        if (bytes.includes(10)) return JSON.parse(Buffer.concat(collected).toString('utf8'));
      } catch (error) {
        assert.equal((error as NodeJS.ErrnoException).code, 'EAGAIN');
      }
      await delay(1);
    }
  };
  const [result, received] = await Promise.all([f.data.exchange(text), receive()]);
  expect(result).toEqual({ frames: [] });
  expect(received).toEqual(JSON.parse(text));
  await empty(f.input);
});

test('nonblocking writes revoked after sending report unknown outcome and never replay', async ({
  f,
}) => {
  const text = JSON.stringify({ text: 'x'.repeat(reportLimits.bridgeBytes - 32) });
  let size = 0;
  f.authorization(async () => {
    try {
      size = (await f.input.read(Buffer.alloc(1))).bytesRead;
      if (size) f.revoke();
    } catch (error) {
      assert.equal((error as NodeJS.ErrnoException).code, 'EAGAIN');
    }
  });
  await expect(f.data.exchange(text)).rejects.toMatchObject({ code: 'outcomeUnknown' });
  expect(size).toBeGreaterThan(0);
  await expect(f.data.exchange(text)).rejects.toMatchObject({ code: 'unavailable' });
});

test('the request deadline also bounds authorization that never resolves', async ({ f }) => {
  f.authorization(() => new Promise<void>(() => {}));
  const start = performance.now();
  await expect(f.data.exchange('{}')).rejects.toMatchObject({ code: 'unavailable' });
  expect(performance.now() - start).toBeLessThan(limits.requestMs + 2000);
  await empty(f.input);
});

test('runtime discovery rejects noncanonical or unprotected roots without claiming a protected install', async ({
  f,
}) => {
  for (const root of ['relative', '/usr/../usr', '/usr/', '/tmp', '/usr', f.directory])
    await expect(describeReportNodeRuntime(root)).rejects.toMatchObject({ code: 'unavailable' });
});
