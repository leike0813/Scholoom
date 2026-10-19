import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import { createKernelClient, KernelClientError } from '../../packages/client/dist/index.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { cliPath, isolatedKernel, runKernel, runningKernel } from '../kernel-fixture.js';

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
    const replies = await Promise.all(
      Array.from({ length: 4 }, () => runKernel(directory, 'start')),
    );
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
    const restarted = await Promise.all(
      Array.from({ length: 4 }, () => runKernel(directory, 'start')),
    );
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
      expect((await runKernel(directory, 'status')).state).toBe('unknown');
      const entries = Promise.all(Array.from({ length: 3 }, () => runKernel(directory, 'start')));
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
