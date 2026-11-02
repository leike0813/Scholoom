import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { ReportControlClient } from '../../apps/kernel/dist/report-control.js';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';
import { ProcessAdmission } from '../../packages/platform/dist/admission.js';
import type { IsolationStatus } from '../../packages/protocol/dist/platform-isolation.js';

test('superseded service authentication cannot replace a newer or explicitly disconnected binding', async () => {
  await promisify(execFile)(
    process.execPath,
    [fileURLToPath(new URL('../fixtures/report-service-connect-race.mts', import.meta.url))],
    { timeout: 10000 },
  );
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function connect(
  client: ReportControlClient,
  request: (method: string, params: Record<string, unknown>) => unknown | Promise<unknown>,
) {
  const frames: { method?: string; id?: string | number; params: Record<string, unknown> }[] = [];
  const server = new RpcPeer(
    {
      send: (frame) => {
        binding.receive(frame);
      },
    },
    { request: (method, params) => request(method, params as Record<string, unknown>) },
  );
  const binding = client.connect({
    send: (frame) => {
      frames.push(JSON.parse(frame));
      server.receive(frame);
    },
  });
  return { server, binding, frames };
}

test('old report connections cannot resolve or disconnect a new recovery barrier', async () => {
  const admission = new ProcessAdmission(1);
  const client = new ReportControlClient({
    configId: 'config',
    admission,
    authorize: async () => {},
  });
  const firstAnswer = deferred<unknown>();
  const first = connect(client, () => firstAnswer.promise);
  const lost = client.initialize().catch((error: unknown) => error);
  const nextAnswer = deferred<unknown>();
  const next = connect(client, (method) =>
    method === 'reportControl.open' ? nextAnswer.promise : { available: true },
  );
  let resolved = false;
  const opening = client.initialize().then(() => {
    resolved = true;
  });
  try {
    await expect(lost).resolves.toMatchObject({ code: 'unavailable' });
    const frame = next.frames.find((frame) => frame.method === 'reportControl.open');
    if (!frame) throw new Error('Missing open request.');
    const result = { ...frame.params, total: 0 };
    first.binding.receive(JSON.stringify({ jsonrpc: '2.0', id: frame.id, result }));
    first.binding.disconnect();
    await Promise.resolve();
    expect(resolved).toBe(false);
    nextAnswer.resolve(result);
    await opening;
    expect(
      await client.port()['platform.reportIsolation.check']({ programId: 'p', policyId: 'p' }),
    ).toEqual({ available: true });
    await expect(
      next.server.request('reportHost.extra', {}, { waitMs: 5000 }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
  } finally {
    firstAnswer.resolve({ configId: 'config', requestId: 'old', total: 0 });
    nextAnswer.resolve({});
    next.binding.disconnect();
    first.server.close();
    next.server.close();
    await opening.catch(() => {});
  }
});

test('an incomplete inventory keeps the lease and only a complete new barrier can settle it', async () => {
  const admission = new ProcessAdmission(1);
  const client = new ReportControlClient({
    configId: 'config',
    admission,
    authorize: async () => {},
  });
  const status: IsolationStatus = {
    instanceId: 'instance',
    phase: 'preparing',
    gateReleased: false,
    stopConfirmed: false,
  };
  let starts = 0;
  const first = connect(client, async (method, params) => {
    if (method === 'reportControl.open') return { ...params, total: 0 };
    if (method === 'reportControl.prepare') {
      starts++;
      await first.server.request(
        'reportHost.reserve',
        { instanceId: status.instanceId },
        { waitMs: 5000 },
      );
      return status;
    }
    return {};
  });
  await client.initialize();
  await client.prepare(
    { instanceId: status.instanceId, programId: 'p', policyId: 'p' },
    async () => ({ entryPath: 'index.html', files: [] }),
  );
  expect(admission.status.active).toBe(1);
  const incomplete = connect(client, (_method, params) => ({ ...params, total: 1 }));
  try {
    await expect(client.initialize()).rejects.toMatchObject({ code: 'protocolIncompatible' });
    first.binding.receive(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 'late',
        method: 'reportHost.release',
        params: { instanceId: status.instanceId },
      }),
    );
    expect(admission.status.active).toBe(1);
    await expect(
      client.port()['platform.reportIsolation.get']({ instanceId: status.instanceId }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    const recovered = connect(client, (_method, params) => ({ ...params, total: 0 }));
    try {
      await client.initialize();
      await expect.poll(() => admission.status.active).toBe(0);
      expect(starts).toBe(1);
    } finally {
      recovered.binding.disconnect();
      recovered.server.close();
    }
  } finally {
    incomplete.binding.disconnect();
    first.server.close();
    incomplete.server.close();
  }
});

test('a complete C close still waits for an in-flight K loader before completing shutdown', async () => {
  const admission = new ProcessAdmission(1);
  const client = new ReportControlClient({
    configId: 'config',
    admission,
    authorize: async () => {},
  });
  const entered = deferred<void>();
  const loading = deferred<void>();
  const connection = connect(client, async (method, params) => {
    if (method === 'reportControl.open') return { ...params, total: 0 };
    if (method === 'reportControl.prepare') {
      await connection.server.request(
        'reportHost.reserve',
        { instanceId: 'instance' },
        { waitMs: 5000 },
      );
      await connection.server.request(
        'reportHost.freeze',
        { instanceId: 'instance' },
        { waitMs: 5000 },
      );
      throw new Error('The closed generation must not finish preparation.');
    }
    return {};
  });
  await client.initialize();
  const prepared = client
    .prepare({ instanceId: 'instance', programId: 'p', policyId: 'p' }, async () => {
      entered.resolve();
      await loading.promise;
      return {
        entryPath: 'index.html',
        files: [{ path: 'index.html', bytes: Buffer.from('html') }],
      };
    })
    .catch((error: unknown) => error);
  await entered.promise;
  let closed = false;
  const closing = client.close().then(() => {
    closed = true;
  });
  try {
    await expect(prepared).resolves.toMatchObject({ code: 'outcomeUnknown' });
    expect(closed).toBe(false);
    expect(admission.status.active).toBe(1);
    loading.resolve();
    await closing;
    expect(admission.status.active).toBe(0);
  } finally {
    loading.resolve();
    await closing;
    connection.binding.disconnect();
    connection.server.close();
  }
});
