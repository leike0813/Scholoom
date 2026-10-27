import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { IsolatedZotero } from '../../apps/kernel/dist/zotero.js';
import { type IsolatedKernel, startIsolatedKernel } from '../isolated-kernel.js';
import { runKernel } from '../kernel-fixture.js';

test('trusted IPC configuration survives explicit process replacement without starting BBT', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-isolated-kernel-'));
  test.info().annotations.push({ type: 'isolated-fixture', description: directory });
  const app = new KernelApplication(directory, { environment: {} });
  let libraryId: string;
  try {
    await app.initialize();
    await app.call('library.grant', { read: true, write: false, send: false, autoBackup: false });
    libraryId = (await app.call('library.status', {})).id;
  } finally {
    await app.close();
  }
  // These deliberately absent paths test the configuration gate and lifecycle only, never BBT.
  const configuration: IsolatedZotero = {
    libraryId,
    executable: join(directory, 'unused-host'),
    args: [],
    packageDirectory: join(directory, 'unused-package'),
  };
  const request = { libraryId, requestId: randomUUID() };
  let kernel: IsolatedKernel | undefined;
  try {
    kernel = await startIsolatedKernel(directory, configuration);
    const first = kernel;
    const status = await runKernel(directory, 'status');
    assert(status.state === 'running');
    expect(status.endpoint.instanceId).toBe(first.endpoint.instanceId);
    expect(status.endpoint.processId).toBe(first.child.pid);
    expect((await first.client.call('library.status', {})).id).toBe(libraryId);
    expect(await first.client.call('zotero.result', request)).toEqual({
      requestId: request.requestId,
      state: 'notFound',
    });
    await expect(
      first.client.call('zotero.result', { ...request, libraryId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    // A competing helper must neither attach to nor clean up the first process.
    await expect(startIsolatedKernel(directory, configuration)).rejects.toThrow();
    expect((await first.client.status()).instanceId).toBe(first.endpoint.instanceId);
    await first.client.shutdown();
    expect(await first.exited).toEqual({ code: 0, signal: null });
    first.client.dispose();
    expect((await runKernel(directory, 'status')).state).toBe('stopped');
    kernel = undefined;

    kernel = await startIsolatedKernel(directory, configuration);
    expect(kernel.endpoint.instanceId).not.toBe(first.endpoint.instanceId);
    expect(kernel.child.pid).not.toBe(first.child.pid);
    await expect(first.stop()).rejects.toThrow();
    expect((await kernel.client.status()).instanceId).toBe(kernel.endpoint.instanceId);
    expect((await kernel.client.call('library.status', {})).id).toBe(libraryId);
    expect(await kernel.client.call('zotero.result', request)).toEqual({
      requestId: request.requestId,
      state: 'notFound',
    });
    await kernel.stop();
    expect(await kernel.exited).toEqual({ code: 0, signal: null });
    kernel = undefined;

    // Matching the supplied ID is insufficient when the real library has another identity.
    const wrongId = randomUUID();
    kernel = await startIsolatedKernel(directory, { ...configuration, libraryId: wrongId });
    await expect(
      kernel.client.call('zotero.result', { ...request, libraryId: wrongId }),
    ).rejects.toMatchObject({ code: 'instanceMismatch' });
  } finally {
    await kernel?.stop();
  }
});
