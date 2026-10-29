import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import {
  createReportUpdates,
  type ReportUpdateProtection,
} from '../../apps/desktop/src/renderer/src/workbench/reports/report-updates.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type { ReportSnapshot } from '../../packages/protocol/dist/report-contracts.js';
import type { ResourceEvidence } from '../../packages/protocol/dist/resources.js';

const evidence = (basis = 'v1'): ResourceEvidence => ({
  ref: { source: 'project', projectId: 'project', fileId: 'report' },
  basis,
});
const clear: ReportUpdateProtection = {
  pageDirty: false,
  explicitItems: false,
  composerDraft: false,
};
function snapshot(basis = 'v1'): ReportSnapshot {
  return {
    resource: {
      ...evidence(basis),
      name: 'Comparison',
      format: 'html',
      capabilities: { read: true, write: false, readingRecords: false, render: false },
    },
    manifest: {
      version: 1,
      resources: [],
      sources: [],
      objects: [
        {
          objectId: 'comparison',
          name: 'Comparison',
          semantics: 'Fixed comparison of doses 10 and 20',
        },
      ],
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

for (const oldResult of ['success', 'failure'] as const) {
  test(`latest offers and resync coalesce behind the actual in-flight load, ignoring late ${oldResult}`, async () => {
    const old = deferred<ReportSnapshot>();
    const newest = deferred<ReportSnapshot>();
    const oldStarted = deferred<void>();
    const newestStarted = deferred<void>();
    const calls: string[] = [];
    const signals: AbortSignal[] = [];
    let concurrent = 0;
    let peak = 0;
    const updates = createReportUpdates({
      entry: evidence(),
      load: async (input, signal) => {
        calls.push(input.basis);
        signals.push(signal);
        peak = Math.max(peak, ++concurrent);
        try {
          if (input.basis === 'v1') return snapshot();
          if (input.basis === 'v2') {
            oldStarted.resolve();
            return await old.promise;
          }
          expect(input.basis).toBe('v4');
          newestStarted.resolve();
          return await newest.promise;
        } finally {
          concurrent--;
        }
      },
    });
    await updates.offer();
    const loading = updates.offer(evidence('v2'));
    await oldStarted.promise;
    updates.offer(evidence('v3'));
    const offered = evidence('v4');
    updates.offer(offered);
    offered.basis = 'caller-mutation';
    const resync = updates.offer();
    expect(calls).toEqual(['v1', 'v2']);
    expect(signals[1]?.aborted).toBe(true);
    expect(updates.read()).toMatchObject({ loading: true, current: snapshot(), pending: null });
    if (oldResult === 'success') old.resolve(snapshot('v2'));
    else old.reject(new OperationError('permissionDenied', 'Old attempt rejected'));
    await newestStarted.promise;
    expect(updates.read()).toMatchObject({ current: snapshot(), pending: null, error: null });
    newest.resolve(snapshot('v4'));
    await Promise.all([loading, resync]);
    expect(calls).toEqual(['v1', 'v2', 'v4']);
    expect(peak).toBe(1);
    expect(updates.read()).toMatchObject({
      current: snapshot('v4'),
      pending: null,
      loading: false,
      error: null,
      canDisplay: true,
      canReplace: false,
    });
  });
}

test('current protection facts hold complete metadata for explicit viewing without changing the protection owner', async () => {
  for (const field of ['pageDirty', 'explicitItems', 'composerDraft'] as const) {
    const candidate = deferred<ReportSnapshot>();
    const started = deferred<void>();
    const facts = Object.freeze({ ...clear, [field]: true });
    const updates = createReportUpdates({
      entry: evidence(),
      load: async (input) => {
        if (input.basis === 'v2') {
          started.resolve();
          return candidate.promise;
        }
        return snapshot(input.basis);
      },
    });
    await updates.offer();
    const loading = updates.offer(evidence('v2'));
    await started.promise;
    // A draft created while loading must protect the old page, not just facts at offer time.
    updates.protect(facts);
    candidate.resolve(snapshot('v2'));
    await loading;
    expect(updates.read(), field).toMatchObject({
      current: snapshot(),
      pending: snapshot('v2'),
      canDisplay: true,
      canReplace: true,
    });
    expect(updates.viewPending()).toBe(true);
    expect(facts).toEqual({ ...clear, [field]: true });
    expect(updates.read()).toMatchObject({ current: snapshot('v2'), pending: null });
    await updates.offer(evidence('v3'));
    expect(updates.read()).toMatchObject({ current: snapshot('v2'), pending: snapshot('v3') });
    updates.protect(clear);
    expect(updates.read()).toMatchObject({
      current: snapshot('v3'),
      pending: null,
      canDisplay: true,
    });
  }
});

test('same-basis rechecks fail closed and ordinary notifications cannot recover a failed page', async () => {
  for (const reason of [
    new OperationError('permissionDenied', 'Revoked'),
    { code: 'notFound', message: 'Identity missing' },
    new Error('Provider unavailable'),
  ]) {
    let failure: unknown;
    const calls: string[] = [];
    const updates = createReportUpdates({
      entry: evidence(),
      load: async (input) => {
        calls.push(input.basis);
        if (failure) throw failure;
        return snapshot(input.basis);
      },
    });
    await updates.offer();
    updates.protect({ ...clear, composerDraft: true });
    failure = reason;
    await updates.offer();
    const failed = updates.read();
    expect(calls).toEqual(['v1', 'v1']);
    expect(failed).toMatchObject({
      current: snapshot(),
      pending: null,
      canDisplay: false,
      canReplace: false,
    });
    expect(failed.error?.code).toBe('code' in reason ? reason.code : 'unavailable');
    updates.protect(clear);
    expect(updates.viewPending()).toBe(false);
    failure = undefined;
    await updates.offer(evidence('v2'));
    expect(calls).toEqual(['v1', 'v1']);
    expect(updates.read().canDisplay).toBe(false);
    await updates.recheck();
    expect(calls).toEqual(['v1', 'v1', 'v2']);
    expect(updates.read()).toMatchObject({
      current: snapshot('v2'),
      error: null,
      canDisplay: true,
    });
  }
});

test('revocation invalidates queued and late results; a verified pending page does not reauthorize the old page', async () => {
  const old = deferred<ReportSnapshot>();
  const started = deferred<void>();
  const calls: string[] = [];
  const updates = createReportUpdates({
    entry: evidence(),
    load: async (input) => {
      calls.push(input.basis);
      if (input.basis === 'v2') {
        started.resolve();
        return old.promise;
      }
      return snapshot(input.basis);
    },
  });
  await updates.offer();
  updates.protect({ ...clear, pageDirty: true });
  const loading = updates.offer(evidence('v2'));
  await started.promise;
  updates.offer(evidence('v3'));
  updates.invalidate({ code: 'permissionDenied', message: 'Host observed revocation' });
  expect(updates.read()).toMatchObject({
    canDisplay: false,
    pending: null,
    canReplace: false,
    loading: true,
  });
  old.resolve(snapshot('v2'));
  await loading;
  expect(calls).toEqual(['v1', 'v2']);
  expect(updates.read()).toMatchObject({
    current: snapshot(),
    pending: null,
    error: { code: 'permissionDenied' },
    canDisplay: false,
  });
  await updates.offer(evidence('v3'));
  await updates.recheck();
  expect(updates.read()).toMatchObject({
    current: snapshot(),
    pending: snapshot('v3'),
    canDisplay: false,
    canReplace: true,
  });
  expect(updates.viewPending()).toBe(true);
  expect(updates.read()).toMatchObject({
    current: snapshot('v3'),
    pending: null,
    canDisplay: true,
  });
});

test('the bound entry and requested basis must match; diagnostics do not expose mutable authority', async () => {
  for (const fault of ['ref', 'basis'] as const) {
    const calls: string[] = [];
    const updates = createReportUpdates({
      entry: evidence(),
      load: async (input) => {
        calls.push(input.basis);
        const result = snapshot(input.basis);
        if (input.basis === 'v2') {
          if (fault === 'ref')
            result.resource.ref = { source: 'project', projectId: 'other', fileId: 'report' };
          else result.resource.basis = 'unrequested-version';
        }
        return result;
      },
    });
    await updates.offer();
    const observed = updates.read();
    assert(observed.current);
    observed.current.resource.basis = 'mutated-diagnostic';
    expect(updates.read().current).toEqual(snapshot());
    await updates.offer(evidence('v2'));
    expect(updates.read()).toMatchObject({
      error: { code: 'contentChanged' },
      canDisplay: false,
      canReplace: false,
      pending: null,
    });
    await updates.offer({
      ref: { source: 'project', projectId: 'other', fileId: 'replacement' },
      basis: 'v3',
    });
    expect(calls).toEqual(['v1', 'v2']);
    expect(updates.read().error?.code).toBe('contentChanged');
  }
});

test('empty, closed and still-settling states remain observable without starting queued work after disposal', async () => {
  for (const queuedBeforeClose of [false, true]) {
    const held = deferred<ReportSnapshot>();
    const started = deferred<void>();
    let calls = 0;
    let closedAtAbort = false;
    const updates = createReportUpdates({
      entry: evidence(),
      load: async (_input, signal) => {
        calls++;
        signal.addEventListener('abort', () => {
          closedAtAbort = updates.read().closed;
          void updates.recheck();
        });
        started.resolve();
        return held.promise;
      },
    });
    expect(updates.read()).toEqual({
      current: null,
      pending: null,
      loading: false,
      error: null,
      canDisplay: false,
      canReplace: false,
      closed: false,
    });
    expect(updates.viewPending()).toBe(false);
    const loading = updates.offer();
    await started.promise;
    if (queuedBeforeClose) updates.offer(evidence('v2'));
    updates.dispose();
    updates.dispose();
    // A signal aborts once: offer(v2) is the first abort in the queued scenario.
    expect(closedAtAbort).toBe(!queuedBeforeClose);
    updates.protect(clear);
    const ignored = updates.recheck();
    expect(updates.read()).toMatchObject({
      closed: true,
      loading: true,
      current: null,
      pending: null,
      canDisplay: false,
      canReplace: false,
    });
    held.resolve(snapshot());
    await Promise.all([loading, ignored, updates.offer(evidence('v3'))]);
    expect(calls).toBe(1);
    expect(updates.read()).toMatchObject({
      closed: true,
      loading: false,
      current: null,
      pending: null,
      canDisplay: false,
      canReplace: false,
    });
  }
});
