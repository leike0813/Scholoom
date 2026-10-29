/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { readDraft } from '../../apps/desktop/src/renderer/src/workbench/drafts.js';
import { restoreReportDraft } from '../../apps/desktop/src/renderer/src/workbench/reports/report-draft-client.js';
import { createReportDrafts } from '../../apps/desktop/src/renderer/src/workbench/reports/report-drafts.js';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import {
  type BusinessInputs,
  type BusinessOutputs,
  type CallArguments,
  OperationError,
  protocolVersion,
  type ResourceEvidence,
} from '../../packages/protocol/dist/index.js';
import { reportFixture } from '../fixtures/report.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Real domain and authenticated RPC. Only one reply can be delayed/failed, or a request
// deliberately misrouted to another real version to verify the consumer's identity check.
async function domain(root: string) {
  await mkdir(root, { recursive: true });
  const profile = join(root, 'profile');
  const app = new ManualApplication(profile);
  let server: Awaited<ReturnType<typeof startKernelServer>> | undefined;
  let client: ReturnType<typeof createKernelClient> | undefined;
  const pending = new Set<Promise<unknown>>();
  const releases: Array<() => void> = [];
  const requests: ResourceEvidence[] = [];
  type Fault = { redirect?: ResourceEvidence; after?(): Promise<void> };
  let fault: Fault | undefined;
  try {
    await app.initialize();
    const seeded = await reportFixture(app, root);
    const served = {
      call: app.call.bind(app),
      subscribe: app.subscribe.bind(app),
      available: app.available.bind(app),
      connectProduct: () => {
        const product = app.connectProduct();
        return {
          close: product.close,
          call: async <A extends CallArguments<BusinessInputs>>(
            ...args: A
          ): Promise<BusinessOutputs[A[0]]> => {
            const control = args[0] === 'resources.reportVersion' ? fault : undefined;
            if (args[0] === 'resources.reportVersion') {
              fault = undefined;
              requests.push(structuredClone(args[1] as ResourceEvidence));
            }
            const work = (async () => {
              try {
                return control?.redirect
                  ? ((await product.call(
                      'resources.reportVersion',
                      control.redirect,
                    )) as BusinessOutputs[A[0]])
                  : await product.call<A>(...args);
              } finally {
                await control?.after?.();
              }
            })();
            pending.add(work);
            try {
              return await work;
            } finally {
              pending.delete(work);
            }
          },
        };
      },
    };
    const status = {
      protocolVersion,
      nodeVersion: process.versions.node,
      processId: process.pid,
      instanceId: randomUUID(),
      dataDirectory: profile,
      startedAt: new Date().toISOString(),
      state: 'running' as const,
    };
    server = await startKernelServer(status, () => app.close(), served);
    client = createKernelClient({ ...status, url: server.url, token: server.token });
    await client.connect();
    const connection = client;
    const running = server;
    return {
      ...seeded,
      profile,
      client: connection,
      requests,
      nextFault(value: Fault) {
        fault = value;
      },
      hold() {
        const entered = deferred(),
          released = deferred();
        releases.push(released.resolve);
        fault = {
          after: async () => {
            entered.resolve();
            await released.promise;
          },
        };
        return { entered: entered.promise, release: released.resolve };
      },
      async close() {
        for (const release of releases) release();
        await Promise.allSettled([...pending]);
        connection.dispose();
        await running.stop();
      },
    };
  } catch (error) {
    client?.dispose();
    if (server) await server.stop();
    else await app.close();
    throw error;
  }
}

type Domain = Awaited<ReturnType<typeof domain>>;
const identityFor = (d: Domain) => {
  assert(d.entry.ref.source === 'project');
  return {
    configurationId: d.profile,
    windowId: 'draft-client-window',
    ref: { ...d.entry.ref },
    basis: d.entry.basis,
  };
};
const state = {
  browse: { expanded: ['row1'], filter: 'original' },
  draft: { comment: 'Keep the R1 comparison' },
  dirty: true,
};
const save = (identity: ReturnType<typeof identityFor>) => {
  const store = createReportDrafts(identity);
  expect(
    store.save({
      version: 1,
      viewId: 'trusted-test-view',
      generation: 1,
      basis: identity.basis,
      type: 'state',
      ...state,
    }).status,
  ).toBe('stored');
  return { key: store.key, raw: readDraft(store.key) };
};
const saveNext = (d: Domain) => {
  const manifest = {
    ...d.manifest,
    sources: [],
    objects: d.manifest.objects.map((object) => ({ ...object, sourceIndexes: [] })),
  };
  const content = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>R2 without the original source</body></html>`;
  return d.client.call('resources.save', { ref: d.entry.ref, basis: d.entry.basis, content });
};

test('exact R1 restoration retains its own source authority after R2 removes that source', async () => {
  const d = await domain(test.info().outputPath('domain'));
  try {
    const identity = identityFor(d);
    const saved = save(identity);
    const next = await saveNext(d);
    const result = await restoreReportDraft({ client: d.client, identity });
    assert(result.version.state === 'available');
    expect(result.version.snapshot.resource).toMatchObject({
      ref: identity.ref,
      basis: identity.basis,
    });
    expect(result.version.snapshot.manifest.sources).toEqual(d.manifest.sources);
    expect(result.restored).toEqual({ status: 'restorable', state });
    expect(
      (await restoreReportDraft({ client: d.client, identity: { ...identity, basis: next.basis } }))
        .restored,
    ).toEqual({ status: 'missing' });
    await d.client.call('library.grant', {
      read: false,
      write: false,
      send: false,
      autoBackup: false,
    });
    expect(
      (await restoreReportDraft({ client: d.client, identity: { ...identity, basis: next.basis } }))
        .version.state,
    ).toBe('available');
    await expect(restoreReportDraft({ client: d.client, identity })).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await d.client.call('library.grant', {
      read: true,
      write: true,
      send: false,
      autoBackup: false,
    });
    await expect(
      restoreReportDraft({
        client: d.client,
        identity: { ...identity, basis: 'unknown-original-version' },
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(readDraft(saved.key)).toBe(saved.raw);
    expect(d.requests[0]).toEqual({ ref: identity.ref, basis: identity.basis });
  } finally {
    await d.close();
  }
});

test('readable dependency advancement yields copyOnly from a successful version result and never restores browse', async () => {
  const d = await domain(test.info().outputPath('domain'));
  try {
    const identity = identityFor(d);
    const saved = save(identity);
    const dependency = d.manifest.resources[0];
    assert(dependency);
    await d.client.call('resources.save', {
      ref: dependency.ref,
      basis: dependency.basis,
      content: '[30,40]',
    });
    const result = await restoreReportDraft({ client: d.client, identity });
    expect(result.version).toEqual({ state: 'unavailable', reason: 'contentChanged' });
    expect(result.restored).toEqual({ status: 'copyOnly', draft: state.draft, dirty: true });
    expect(result.restored).not.toHaveProperty('browse');
    expect(result.version).not.toHaveProperty('snapshot');
    expect(readDraft(saved.key)).toBe(saved.raw);
  } finally {
    await d.close();
  }
});

test('captured identity survives caller mutation and abort waits for the actual RPC reply before refusing late drafts', async () => {
  const d = await domain(test.info().outputPath('domain'));
  try {
    const identity = identityFor(d);
    const original = structuredClone(identity);
    const saved = save(identity);
    const held = d.hold();
    const restoring = restoreReportDraft({ client: d.client, identity });
    await held.entered;
    identity.configurationId = 'other-profile';
    identity.windowId = 'other-window';
    identity.ref.fileId = 'other-file';
    identity.basis = 'other-version';
    held.release();
    expect((await restoring).restored).toEqual({ status: 'restorable', state });
    expect(d.requests.at(-1)).toEqual({ ref: original.ref, basis: original.basis });
    const gate = d.hold();
    const controller = new AbortController();
    let settled = false;
    const late = restoreReportDraft({
      client: d.client,
      identity: original,
      signal: controller.signal,
    }).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    );
    void late.then(() => {
      settled = true;
    });
    await gate.entered;
    const reason = new Error('test view closed');
    controller.abort(reason);
    // An independent real roundtrip drains ready jobs while the original server reply stays held.
    await d.client.call('resources.describe', { locator: original.ref });
    expect(settled).toBe(false);
    gate.release();
    const outcome = await late;
    assert(!outcome.ok);
    expect(outcome.error).toBe(reason);
    expect(readDraft(saved.key)).toBe(saved.raw);
    const before = d.requests.length;
    await expect(
      restoreReportDraft({ client: d.client, identity: original, signal: controller.signal }),
    ).rejects.toBe(reason);
    await expect(
      restoreReportDraft({
        client: d.client,
        identity: { ...original, configurationId: 'wrong-config' },
      }),
    ).rejects.toMatchObject({ code: 'instanceMismatch' });
    expect(d.requests).toHaveLength(before);
  } finally {
    await d.close();
  }
});

test('RPC failures and a misrouted real successful snapshot cannot approve an original draft', async () => {
  const d = await domain(test.info().outputPath('domain'));
  try {
    const identity = identityFor(d);
    const saved = save(identity);
    for (const error of [
      new OperationError('invalidRequest', 'test RPC fault'),
      new Error('test unexpected RPC fault'),
    ]) {
      d.nextFault({
        after: async () => {
          throw error;
        },
      });
      await expect(restoreReportDraft({ client: d.client, identity })).rejects.toMatchObject({
        code: error instanceof OperationError ? 'invalidRequest' : 'unavailable',
      });
      expect(readDraft(saved.key)).toBe(saved.raw);
    }
    const next = await saveNext(d);
    d.nextFault({ redirect: { ref: next.ref, basis: next.basis } });
    await expect(restoreReportDraft({ client: d.client, identity })).rejects.toMatchObject({
      code: 'contentChanged',
    });
    expect(readDraft(saved.key)).toBe(saved.raw);
  } finally {
    await d.close();
  }
});
