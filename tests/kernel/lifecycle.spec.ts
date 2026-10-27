import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import { bootstrapKernel } from '../../apps/kernel/dist/bootstrap.js';
import { inspectKernel } from '../../apps/kernel/dist/lifecycle.js';
import { createKernelClient, KernelClientError } from '../../packages/client/dist/index.js';
import {
  errorInfoSchema,
  isBootstrapResult,
  protocolVersion,
} from '../../packages/protocol/dist/index.js';
import {
  cliPath,
  isolatedKernel,
  kernelLifecycleDiagnostics,
  kernelResultSummary,
  runKernel,
  runningKernel,
} from '../kernel-fixture.js';

async function observedStarts(directory: string, label: string, count: number) {
  const entries: object[] = [];
  const results = await Promise.allSettled(
    Array.from({ length: count }, async (_, index) => {
      const startedAt = Date.now();
      try {
        const reply = await runKernel(directory, 'start');
        entries[index] = {
          index,
          startedAt,
          returnedAt: Date.now(),
          reply: kernelResultSummary(reply),
        };
        return reply;
      } catch (error) {
        entries[index] = { index, startedAt, returnedAt: Date.now(), cliResult: 'rejected' };
        throw error;
      }
    }),
  );
  const lifecycle = await kernelLifecycleDiagnostics(directory);
  await test.info().attach(label, {
    body: JSON.stringify({ entries, sampledAt: Date.now(), lifecycle }),
    contentType: 'application/json',
  });
  return results.map((result) => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
}

test('queries and stops missing configurations without creating them', async () => {
  await isolatedKernel(async (directory) => {
    const missing = join(directory, 'missing');
    expect(await runKernel(missing, 'status')).toEqual({ state: 'stopped' });
    expect(await runKernel(missing, 'stop')).toEqual({ state: 'stopped' });
    await expect(access(missing)).rejects.toThrow();
  });
});

test('concurrent entries share one canonical instance and separate configurations', async () => {
  await isolatedKernel(async (directory) => {
    const replies = await observedStarts(directory, 'lifecycle-initial-start', 4);
    const ids = replies.map((reply) => {
      expect(reply.state).toBe('running');
      return reply.state === 'running' ? reply.endpoint.instanceId : null;
    });
    expect(new Set(ids).size).toBe(1);
    const alias = join(directory, 'alias');
    await symlink(directory, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const same = await runKernel(alias, 'start');
    expect(same.state === 'running' ? same.endpoint.instanceId : null).toBe(ids[0]);
    await isolatedKernel(async (other) => {
      expect((await runningKernel(other)).instanceId).not.toBe(ids[0]);
    });
    expect((await runKernel(directory, 'stop')).state).toBe('stopped');
    const restarted = await observedStarts(directory, 'lifecycle-restart', 4);
    expect(restarted.every((reply) => reply.state === 'running')).toBe(true);
    expect(
      new Set(
        restarted.map((reply) => (reply.state === 'running' ? reply.endpoint.instanceId : null)),
      ).size,
    ).toBe(1);
  });
});

test('stale discovery is replaced only after owned process exits', async () => {
  await isolatedKernel(async (directory) => {
    const child = spawn(process.execPath, [cliPath, 'serve', '--data-dir', directory], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    try {
      const [ready] = await once(child, 'message');
      expect(ready.state).toBe('ready');
      const before = await runKernel(directory, 'status');
      expect(before.state).toBe('running');
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
      expect((await runKernel(directory, 'status')).state).toBe('stopped');
      const after = await runningKernel(directory);
      expect(after.instanceId).not.toBe(
        before.state === 'running' ? before.endpoint.instanceId : '',
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        await exited;
      }
    }
  });
});

test('entries wait for occupied stale discovery and compete after it is released', async () => {
  await isolatedKernel(async (directory) => {
    await runningKernel(directory);
    expect((await runKernel(directory, 'stop')).state).toBe('stopped');
    const source = [
      'const { DatabaseSync } = require("node:sqlite");',
      'const db = new DatabaseSync(process.argv[1]);',
      'db.exec("BEGIN EXCLUSIVE"); process.send({held:true});',
      'process.once("message",()=>{db.exec("ROLLBACK");db.close();process.disconnect();});',
    ].join(' ');
    const holder = spawn(
      process.execPath,
      ['-e', source, join(directory, 'runtime', 'lifecycle.sqlite')],
      {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      },
    );
    const exited = once(holder, 'exit');
    try {
      await once(holder, 'message');
      const occupied = await runKernel(directory, 'status');
      await test.info().attach('lifecycle-occupied', {
        body: JSON.stringify(kernelResultSummary(occupied)),
        contentType: 'application/json',
      });
      expect(occupied.state).toBe('unknown');
      expect(kernelResultSummary(occupied)).toMatchObject({
        diagnostic: { discovery: true, lock: 'held', phase: 'process', processAlive: false },
      });
      const exhausted = await runKernel(directory, 'start');
      await test.info().attach('lifecycle-availability-deadline', {
        body: JSON.stringify(kernelResultSummary(exhausted)),
        contentType: 'application/json',
      });
      expect(kernelResultSummary(exhausted)).toMatchObject({
        state: 'unknown',
        errorCode: 'unavailable',
        diagnostic: {
          phase: 'availability',
          lastPhase: 'process',
          discovery: true,
          lock: 'held',
          processAlive: false,
        },
      });
      const entries = observedStarts(directory, 'lifecycle-after-release', 3);
      await delay(500);
      holder.send('release');
      await exited;
      const results = await entries;
      expect(results.every((result) => result.state === 'running')).toBe(true);
      expect(
        new Set(
          results.map((result) => (result.state === 'running' ? result.endpoint.instanceId : '')),
        ).size,
      ).toBe(1);
    } finally {
      if (holder.connected) holder.send('release');
      await exited;
    }
  });
});

for (const scenario of [
  { name: 'wrong token', change: { token: 'x'.repeat(64) }, code: 'authenticationFailed' },
  {
    name: 'incompatible protocol',
    change: { protocolVersion: protocolVersion + 1 },
    code: 'protocolIncompatible',
  },
  { name: 'wrong instance', change: { instanceId: 'wrong-instance' }, code: 'instanceMismatch' },
]) {
  test(`rejects ${scenario.name} without automatic retry`, async () => {
    await isolatedKernel(async (directory) => {
      const endpoint = await runningKernel(directory);
      const client = createKernelClient({ ...endpoint, ...scenario.change });
      try {
        await expect(client.connect()).rejects.toMatchObject({ code: scenario.code });
        expect(client.getSnapshot().phase).toBe('error');
        await delay(500);
        expect(client.getSnapshot().phase).toBe('error');
        expect((await runKernel(directory, 'status')).state).toBe('running');
      } finally {
        client.dispose();
      }
    });
  });
}

for (const fault of [
  { change: { token: 'x'.repeat(64) }, code: 'authenticationFailed' },
  { change: { protocolVersion: protocolVersion - 1 }, code: 'protocolIncompatible' },
] as const)
  test(`unreachable occupied configuration is preserved and never replaced (${fault.code})`, async () => {
    await isolatedKernel(async (directory) => {
      const endpoint = await runningKernel(directory);
      const filename = join(directory, 'runtime', 'endpoint.json');
      await writeFile(filename, JSON.stringify({ ...endpoint, ...fault.change }));
      try {
        const result = await runKernel(directory, 'start');
        expect(result.state).toBe('unreachable');
        expect(result.state !== 'running' && result.error?.code).toBe(fault.code);
        const saved = JSON.parse(await readFile(filename, 'utf8'));
        expect(saved.instanceId).toBe(endpoint.instanceId);
        expect(saved.processId).toBe(endpoint.processId);
      } finally {
        await writeFile(filename, JSON.stringify(endpoint));
      }
    });
  });

test('unauthenticated and malformed messages cannot query or stop the kernel', async () => {
  await isolatedKernel(async (directory) => {
    const endpoint = await runningKernel(directory);
    for (const payload of [
      'not json',
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'kernel.status' }),
    ]) {
      const socket = new WebSocket(endpoint.url);
      await once(socket, 'open');
      const response = once(socket, 'message');
      socket.send(payload);
      const [event] = await response;
      const result = JSON.parse(event.data);
      expect(result.error.data.code).toBe(
        payload === 'not json' ? 'invalidRequest' : 'authenticationFailed',
      );
      socket.close();
    }
    expect((await runKernel(directory, 'status')).state).toBe('running');
  });
});

test('multi-client shutdown announces stopping and never restarts the daemon', async () => {
  await isolatedKernel(async (directory) => {
    const endpoint = await runningKernel(directory);
    const first = createKernelClient(endpoint);
    const second = createKernelClient(endpoint);
    try {
      await Promise.all([first.connect(), second.connect()]);
      const result = await runKernel(directory, 'stop');
      expect(result.state).toBe('stopped');
      expect(first.getSnapshot().error?.code).toBe('shuttingDown');
      expect(second.getSnapshot().error?.code).toBe('shuttingDown');
      await delay(1_000);
      expect((await runKernel(directory, 'status')).state).toBe('stopped');
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});

test('shutdown without a connected transport is unavailable', async () => {
  await isolatedKernel(async (directory) => {
    const client = createKernelClient(await runningKernel(directory));
    try {
      await expect(client.shutdown()).rejects.toBeInstanceOf(KernelClientError);
    } finally {
      client.dispose();
    }
  });
});

test('bootstrap failure diagnostics identify the Node launch without exposing its private path', async () => {
  await isolatedKernel(async (directory) => {
    const secret = 'private-bootstrap-value';
    const result = await bootstrapKernel('inspect', {
      dataDirectory: directory,
      nodeExecutable: join(directory, secret, 'missing-node'),
    });
    expect(kernelResultSummary(result)).toMatchObject({
      state: 'unknown',
      errorCode: 'startupFailed',
      diagnostic: { phase: 'node-bootstrap', systemCode: 'ENOENT', killed: false },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(directory);
  });
});

test('diagnostic attachments retain only allowlisted scalar lifecycle facts', () => {
  const secret = 'private-connection-value';
  const summary = kernelResultSummary({
    state: 'unknown',
    error: {
      code: 'unavailable',
      message: `unavailable\n${JSON.stringify({ phase: 'lock', token: secret, url: secret, nested: { token: secret }, lock: 'held' })}`,
    },
  });
  expect(summary).toMatchObject({ diagnostic: { phase: 'lock', lock: 'held' } });
  expect(JSON.stringify(summary)).not.toContain(secret);
});

test('escaped discovery identity cannot make lifecycle errors violate the error contract', async () => {
  await isolatedKernel(async (directory) => {
    const endpoint = await runningKernel(directory);
    expect((await runKernel(directory, 'stop')).state).toBe('stopped');
    const filename = join(directory, 'runtime', 'endpoint.json');
    try {
      // Stale discovery is evidence only, never authority to control this live test process.
      await writeFile(
        filename,
        JSON.stringify({ ...endpoint, processId: process.pid, instanceId: '"'.repeat(256) }),
      );
      const result = await inspectKernel(directory);
      expect(isBootstrapResult(result)).toBe(true);
      expect(kernelResultSummary(result)).toMatchObject({
        state: 'unknown',
        errorCode: 'unavailable',
        diagnostic: { phase: 'process', lock: 'free', processAlive: true },
      });
      if ('error' in result)
        expect(result.error?.message.length).toBeLessThanOrEqual(
          errorInfoSchema.properties.message.maxLength,
        );
    } finally {
      await writeFile(filename, JSON.stringify(endpoint));
    }
  });
});

test('bounded lifecycle log attachments discard raw payload and unknown fields', async () => {
  await isolatedKernel(async (directory) => {
    const secret = 'private-log-value';
    await mkdir(join(directory, 'runtime'));
    await writeFile(
      join(directory, 'runtime', 'kernel.log'),
      `${secret.repeat(10000)}\n${JSON.stringify({ phase: 'endpoint-published', at: 42, instanceId: 'instance', processId: 1, token: secret, payload: secret })}\n`,
    );
    const rows = await kernelLifecycleDiagnostics(directory);
    expect(rows).toEqual([
      { phase: 'endpoint-published', at: 42, instanceId: 'instance', processId: 1 },
    ]);
    expect(JSON.stringify(rows)).not.toContain(secret);
  });
});
