import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import { createModelServer } from '../model-server.js';

test('real catalog selection is bounded, revision aware and separately authorized for sending', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-selection-provider-'));
  const catalog = new LiteratureCatalog(root, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: true, autoBackup: false });
    const batch = catalog.ingest({
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'unspecified',
      json: JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ title: `题录${i}` }))),
    });
    await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const sources = catalog.list({ limit: 100 }).sources;
    const input = {
      libraryId: catalog.status().id,
      items: sources.map((s) => ({ sourceId: s.id, observedRevision: s.revision })),
    };
    for (const length of [0, 17, 100]) {
      const result = catalog.selection({ ...input, items: input.items.slice(0, length) });
      expect(result.items).toHaveLength(length);
      expect(result.items.every((item) => item.state === 'current')).toBe(true);
    }
    const first = sources[0];
    if (!first) throw new Error('Missing synthetic record');
    catalog.update({
      ...first,
      sourceId: first.id,
      metadata: { ...first.metadata, title: '更正' },
    });
    expect(catalog.selection(input).items[0]).toMatchObject({
      observedRevision: first.revision,
      currentRevision: first.revision + 1,
      state: 'changed',
    });
    expect(() => catalog.selection({ ...input, libraryId: 'another' })).toThrow(
      expect.objectContaining({ code: 'instanceMismatch' }),
    );
    expect(() =>
      catalog.selection({ ...input, items: [{ sourceId: 'missing', observedRevision: 0 }] }),
    ).toThrow(expect.objectContaining({ code: 'notFound' }));
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    expect(() => catalog.selection(input)).toThrow(
      expect.objectContaining({ code: 'permissionDenied' }),
    );
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

for (const boundary of ['queue', 'final'] as const)
  test(`catalog authorization survives ${boundary} admission and restart`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-catalog-context-'));
    let app: KernelApplication;
    let used = false;
    let queued = false;
    const model = await createModelServer({
      respond: ({ calls }) =>
        calls.length === 0
          ? { tool: { name: 'read_workbench_context', input: {} } }
          : { text: 'should not be sent' },
    });
    const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
    app = new KernelApplication(root, options);
    await app.initialize();
    const connection = app.connectProduct();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    const blocker = await app.models.execution();
    let held: Promise<string> | undefined;
    let lease: string | undefined;
    const originalSelection = app.library.selection.bind(app.library);
    app.library.selection = (input) => {
      const result = originalSelection(input);
      used = true;
      if (boundary === 'queue')
        held = blocker.acquire().then((value) => {
          lease = value;
          return value;
        });
      return result;
    };
    const execution = app.models.execution.bind(app.models);
    app.models.execution = async (authorize = () => {}, signal, config, final) => {
      const value = await execution(authorize, signal, config, () => {
        if (used && boundary === 'final')
          app.library.grant({ read: true, write: true, send: false, autoBackup: false });
        final?.();
      });
      return {
        ...value,
        acquire: async () => {
          if (used && boundary === 'queue') {
            await held;
            queued = true;
          }
          return value.acquire();
        },
      };
    };
    try {
      app.library.grant({ read: true, write: true, send: true, autoBackup: false });
      const batch = app.library.ingest({
        batchId: randomUUID(),
        origin: 'synthetic',
        version: 'unspecified',
        json: JSON.stringify([{ title: '无附件题录' }]),
      });
      await expect
        .poll(() => app.library.batch({ batchId: batch.id }).batch.state)
        .toBe('completed');
      const source = app.library.list({}).sources[0];
      if (!source) throw new Error('Missing synthetic record');
      await connection.call('workbench.context.publish', {
        snapshot: {
          revision: 1,
          receiver: scope,
          viewId: 'library',
          selectedItems: [],
          selections: [],
          catalogSelection: {
            libraryId: app.library.status().id,
            range: { query: '', collectionId: null, tag: '', offset: 0, limit: 25 },
            primarySourceId: source.id,
            items: [{ sourceId: source.id, observedRevision: source.revision }],
          },
        },
      });
      await connection.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT catalog',
        materials: [],
      });
      if (boundary === 'queue') {
        await expect.poll(() => queued, { timeout: 20000 }).toBe(true);
        app.library.grant({ read: true, write: true, send: false, autoBackup: false });
        if (lease) blocker.release(lease);
        lease = undefined;
      }
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      const tool = (await app.snapshot(scope)).messages.find(
        (m) => m.tool?.name === 'read_workbench_context',
      );
      expect(JSON.parse(tool?.tool?.output ?? '{}')).toMatchObject({
        state: 'available',
        catalog: { items: [{ sourceId: source.id, state: 'current' }] },
      });
      expect(model.requests).toHaveLength(1);
      connection.close();
      await app.close();
      app = new KernelApplication(root, options);
      await app.initialize();
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT restart',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(model.requests).toHaveLength(1);
    } finally {
      if (lease) blocker.release(lease);
      connection.close();
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
