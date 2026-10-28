import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { IsolatedZotero } from '../../apps/kernel/dist/zotero.js';
import { type IsolatedKernel, startIsolatedKernel } from '../isolated-kernel.js';
import { createKernelLifecycleDiagnostics, runKernel } from '../kernel-fixture.js';

test('trusted IPC configuration survives explicit process replacement without starting BBT', async () => {
  const directory = test.info().outputPath('profile');
  await mkdir(directory, { recursive: true });
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
    ).rejects.toMatchObject({ code: 'instanceMismatch' });
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

for (const mode of ['exit', 'wait'] as const) {
  test(`isolated startup ${mode} preserves safe diagnostics before owned-child cleanup`, async () => {
    const directory = test.info().outputPath('profile');
    await mkdir(join(directory, 'runtime'), { recursive: true });
    const staleInstance = 'stale-isolated-kernel-instance';
    await writeFile(
      join(directory, 'runtime', 'kernel.log'),
      `${JSON.stringify({ phase: 'endpoint-published', at: 1, instanceId: staleInstance, processId: 1, token: 'stale-kernel-log-private' })}\n`,
    );
    const configuration: IsolatedZotero = {
      libraryId: randomUUID(),
      executable: join(directory, 'unused-host'),
      args: [mode],
      packageDirectory: join(directory, 'unused-package'),
    };
    const error: unknown = await startIsolatedKernel(
      directory,
      configuration,
      new URL('../fixtures/isolated-kernel-diagnostic.mjs', import.meta.url),
    ).catch((error: unknown) => error);
    assert(error instanceof Error);
    const diagnostic = error.cause;
    assert(typeof diagnostic === 'object' && diagnostic !== null && 'processId' in diagnostic);
    assert(typeof diagnostic.processId === 'number' && diagnostic.processId > 0);
    const beforeCleanup = {
      readyReceived: false,
      exitReceived: mode === 'exit',
      closeReceived: mode === 'exit',
      exitCode: mode === 'exit' ? 1 : null,
      exitSignal: null,
      lastPhase: 'initializing-library',
    };
    const expected = {
      phase: expect.any(String),
      reason: mode === 'exit' ? 'closedBeforeReady' : 'readyTimeout',
      processId: diagnostic.processId,
      beforeCleanup,
      lifecycle: {
        records: expect.arrayContaining([
          expect.objectContaining({
            phase: 'loading-application',
            processId: diagnostic.processId,
          }),
          expect.objectContaining({
            phase: 'initializing-library',
            processId: diagnostic.processId,
            at: expect.any(Number),
          }),
        ]),
        discardedLines: expect.any(Number),
        discardedRecords: expect.any(Number),
      },
    };
    expect(diagnostic).toMatchObject({
      ...expected,
      killRequested: mode === 'wait',
      afterCleanup: { exitReceived: true, closeReceived: true },
      beforeCleanupPersisted: true,
    });
    const persisted = await readFile(join(directory, 'isolated-kernel-diagnostics.json'));
    expect(persisted.byteLength).toBeLessThan(64 * 1024);
    expect(JSON.parse(persisted.toString('utf8'))).toMatchObject(expected);
    for (const text of [
      JSON.stringify({ message: error.message, cause: diagnostic }),
      persisted.toString('utf8'),
    ]) {
      for (const privateValue of [
        'isolated-kernel-private-',
        'stale-kernel-log-private',
        staleInstance,
        'endpoint-published',
      ]) {
        expect(text).not.toContain(privateValue);
      }
    }
  });
}

test('lifecycle diagnostics handle split UTF-8 and bound malformed, long and retained records', () => {
  const diagnostics = createKernelLifecycleDiagnostics();
  const record = Buffer.from(
    `${JSON.stringify({ phase: 'initializing-library', at: 1, instanceId: '实例', processId: process.pid, token: 'parser-private-token' })}\n`,
  );
  const split = record.indexOf(Buffer.from('实例')) + 1;
  diagnostics.write(record.subarray(0, split));
  diagnostics.write(record.subarray(split));
  diagnostics.write(Buffer.from('{invalid-json}\n'));
  diagnostics.write(
    Buffer.from(
      JSON.stringify({ phase: 'initializing-harness', at: 0, body: 'x'.repeat(5 * 1024) }),
    ),
  );
  diagnostics.write(Buffer.from('\n'));
  expect(diagnostics.snapshot().records).toEqual([
    { phase: 'initializing-library', at: 1, instanceId: '实例', processId: process.pid },
  ]);
  for (let at = 2; at <= 81; at++) {
    diagnostics.write(
      Buffer.from(
        `${JSON.stringify({ phase: 'initializing-library', at, processId: process.pid })}\n`,
      ),
    );
  }
  expect(diagnostics.snapshot().records.length).toBeLessThanOrEqual(64);
  expect(diagnostics.snapshot().discardedRecords).toBeGreaterThan(0);
  for (let at = 82; at <= 181; at++) {
    diagnostics.write(
      Buffer.from(
        `${JSON.stringify({ phase: 'initializing-library', at, instanceId: '样本'.repeat(80), processId: process.pid, body: 'parser-private-body' })}\n`,
      ),
    );
  }
  diagnostics.end();
  const snapshot = diagnostics.snapshot();
  expect(snapshot.records.length).toBeLessThanOrEqual(64);
  expect(Buffer.byteLength(JSON.stringify(snapshot.records))).toBeLessThanOrEqual(32 * 1024);
  expect(snapshot.records).toEqual(
    expect.arrayContaining([expect.objectContaining({ phase: 'initializing-library', at: 181 })]),
  );
  expect(snapshot.discardedLines).toBeGreaterThan(0);
  expect(snapshot.discardedRecords).toBeGreaterThan(0);
  expect(JSON.stringify(snapshot)).not.toContain('parser-private-');
});
