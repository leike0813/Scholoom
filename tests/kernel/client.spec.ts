import { expect, test } from '@playwright/test';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { type KernelStatus, protocolVersion } from '../../packages/protocol/dist/index.js';
import { isolatedKernel, runKernel, runningKernel } from '../kernel-fixture.js';
import { transportProxy } from './transport-proxy.js';

async function delayedCleanup(directory: string) {
  let finish: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const status: KernelStatus = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: 'controlled-shutdown',
    dataDirectory: directory,
    startedAt: new Date().toISOString(),
    state: 'running',
  };
  const server = await startKernelServer(status, () => gate);
  return { server, finish, endpoint: { ...status, url: server.url, token: server.token } };
}

test('stopping notification survives a delayed connection status response', async () => {
  await isolatedKernel(async (directory) => {
    const controlled = await delayedCleanup(directory);
    const proxy = await transportProxy(controlled.endpoint);
    proxy.holdStatusResponses();
    const connecting = createKernelClient(proxy.endpoint);
    const stopper = createKernelClient(controlled.endpoint);
    try {
      const connected = connecting.connect();
      await expect.poll(() => proxy.heldStatusCount()).toBe(1);
      await stopper.connect();
      await stopper.shutdown();
      await expect.poll(() => connecting.getSnapshot().phase).toBe('stopping');
      proxy.releaseStatusResponses();
      await connected;
      expect(connecting.getSnapshot().phase).toBe('stopping');
      controlled.finish();
      await controlled.server.closed;
      await expect.poll(() => connecting.getSnapshot().error?.code).toBe('shuttingDown');
      expect(connecting.getSnapshot().phase).toBe('stopping');
    } finally {
      connecting.dispose();
      stopper.dispose();
      controlled.finish();
      await controlled.server.stop();
      await proxy.close();
    }
  });
});

test('shutdown timeout remains unknown while real cleanup is still pending', async () => {
  await isolatedKernel(async (directory) => {
    const controlled = await delayedCleanup(directory);
    const proxy = await transportProxy(controlled.endpoint);
    proxy.holdShutdownResponse();
    const client = createKernelClient(proxy.endpoint);
    try {
      await client.connect();
      await expect(client.shutdown()).rejects.toMatchObject({ code: 'outcomeUnknown' });
      expect(client.getSnapshot().error?.code).toBe('outcomeUnknown');
      expect(proxy.shutdownCount()).toBe(1);
    } finally {
      client.dispose();
      controlled.finish();
      await controlled.server.stop();
      await proxy.close();
    }
  });
});

test('connection loss during initial stopping preserves pending confirmation', async () => {
  await isolatedKernel(async (directory) => {
    const controlled = await delayedCleanup(directory);
    const proxy = await transportProxy(controlled.endpoint);
    proxy.holdStatusResponses();
    const client = createKernelClient(proxy.endpoint);
    const stopper = createKernelClient(controlled.endpoint);
    const connection = client.connect().catch((error) => error);
    try {
      await expect.poll(() => proxy.heldStatusCount()).toBe(1);
      await stopper.connect();
      await stopper.shutdown();
      await expect.poll(() => client.getSnapshot().phase).toBe('stopping');
      controlled.finish();
      await controlled.server.closed;
      expect((await connection).code).toBe('unavailable');
      expect(client.getSnapshot().phase).toBe('stopping');
    } finally {
      client.dispose();
      stopper.dispose();
      controlled.finish();
      await controlled.server.stop();
      await proxy.close();
    }
  });
});

test('real kernel reconnects and reads the same status after transport interruption', async () => {
  await isolatedKernel(async (directory) => {
    const endpoint = await runningKernel(directory);
    const proxy = await transportProxy(endpoint);
    const client = createKernelClient(proxy.endpoint);
    const phases: string[] = [];
    const unsubscribe = client.subscribe(() => phases.push(client.getSnapshot().phase));
    try {
      await client.connect();
      proxy.dropConnections();
      await expect.poll(() => phases.includes('reconnecting')).toBe(true);
      await expect.poll(() => client.getSnapshot().phase).toBe('connected');
      expect((await client.status()).instanceId).toBe(endpoint.instanceId);
    } finally {
      unsubscribe();
      client.dispose();
      await proxy.close();
    }
  });
});

test('lost shutdown receipt is outcomeUnknown and is never replayed', async () => {
  await isolatedKernel(async (directory) => {
    const proxy = await transportProxy(await runningKernel(directory));
    const client = createKernelClient(proxy.endpoint);
    try {
      await client.connect();
      proxy.loseShutdownResponse();
      await expect(client.shutdown()).rejects.toMatchObject({ code: 'outcomeUnknown' });
      expect(client.getSnapshot().error?.code).toBe('outcomeUnknown');
      await expect.poll(async () => (await runKernel(directory, 'status')).state).toBe('stopped');
      expect(proxy.shutdownCount()).toBe(1);
    } finally {
      client.dispose();
      await proxy.close();
    }
  });
});

test('invalid server result fails schema validation and terminates retries', async () => {
  await isolatedKernel(async (directory) => {
    const proxy = await transportProxy(await runningKernel(directory));
    proxy.corruptStatusResponse();
    const client = createKernelClient(proxy.endpoint);
    try {
      await expect(client.connect()).rejects.toMatchObject({ code: 'protocolIncompatible' });
      expect(client.getSnapshot().phase).toBe('error');
    } finally {
      client.dispose();
      await proxy.close();
    }
  });
});
