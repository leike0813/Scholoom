import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';

test('atomic records preserve raw values and pinned keys, reject case conflicts without pollution, and replay stable outcomes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-records-'));
  let notices = 0;
  let catalog = new LiteratureCatalog(root, () => notices++);
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const batch = catalog.ingest({
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: '原甲', extension: { nested: true } }, { title: '原乙' }]),
    });
    await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const [a, b] = catalog.list({}).sources;
    if (!a || !b) throw new Error('Missing synthetic records');
    const registration = { requestId: randomUUID(), libraryId, label: 'Zotero合成源' };
    const instance = catalog.createSourceInstance(registration);
    expect(catalog.createSourceInstance(registration)).toEqual(instance);
    const copy = catalog.createSourceInstance({ ...registration, requestId: randomUUID() });
    expect(copy.id).not.toBe(instance.id);
    const original = {
      identity: { instanceId: instance.id, libraryLocator: 'users/local', objectKey: 'ABCD1234' },
      schemaVersion: 'zotero-schema44',
      itemType: 'radioBroadcast',
      fields: { title: '原甲', date: '2024年春', extra: '未知行\nCitation Key: candidate' },
      creators: [
        { creatorType: 'director', firstName: '小明', lastName: '王', fieldMode: 0, orderIndex: 0 },
        { creatorType: 'author', lastName: '研究所', fieldMode: 1, orderIndex: 1 },
      ],
      relations: { related: ['OTHERKEY'] },
    };
    const copyOriginal = {
      ...original,
      identity: { ...original.identity, instanceId: copy.id },
      fields: { ...original.fields, title: '原乙' },
    };
    const initial = {
      requestId: randomUUID(),
      libraryId,
      changes: [
        {
          sourceId: a.id,
          revision: a.revision,
          original,
          key: { value: 'Smith2024', pinned: true, intent: 'explicit' as const },
        },
        {
          sourceId: b.id,
          revision: b.revision,
          original: copyOriginal,
          key: { value: 'Other2024', pinned: true, intent: 'candidate' as const },
        },
      ],
    };
    const count = notices;
    const receipt = catalog.commitRecords(initial);
    expect(receipt.error).toBeUndefined();
    expect(receipt.state).toBe('committed');
    expect(catalog.record({ libraryId, sourceId: a.id }).originals).toEqual([original]);
    expect(catalog.record({ libraryId, sourceId: b.id })).toMatchObject({
      citationKey: { value: 'Other2024', pinned: false },
      originals: [copyOriginal],
    });
    expect(notices).toBe(count + 1);
    expect(catalog.commitRecords(initial)).toEqual(receipt);
    expect(notices).toBe(count + 1);
    const currentA = catalog.get(a.id),
      currentB = catalog.get(b.id);
    const historyBefore = catalog.history({ sourceId: a.id }).sources;
    const recordsBefore = catalog.recordHistory({ libraryId, sourceId: a.id }).records;
    const unregisteredRequest = {
      requestId: randomUUID(),
      libraryId,
      changes: [
        {
          sourceId: a.id,
          revision: currentA.revision,
          metadata: { ...currentA.metadata, title: '未登记来源不能部分保存' },
        },
        {
          sourceId: b.id,
          revision: currentB.revision,
          original: {
            ...copyOriginal,
            identity: { ...copyOriginal.identity, instanceId: randomUUID() },
          },
        },
      ],
    };
    const unregistered = catalog.commitRecords(unregisteredRequest);
    expect(unregistered).toMatchObject({ state: 'rejected', error: { code: 'notFound' } });
    expect(catalog.commitResult({ libraryId, requestId: unregisteredRequest.requestId })).toEqual(
      unregistered,
    );
    expect(catalog.get(a.id)).toEqual(currentA);
    expect(catalog.get(b.id)).toEqual(currentB);
    expect(catalog.record({ libraryId, sourceId: a.id }).originals).toEqual([original]);
    expect(catalog.record({ libraryId, sourceId: b.id }).originals).toEqual([copyOriginal]);
    expect(catalog.history({ sourceId: a.id }).sources).toEqual(historyBefore);
    expect(catalog.recordHistory({ libraryId, sourceId: a.id }).records).toEqual(recordsBefore);
    expect(notices).toBe(count + 1);
    const rejected = catalog.commitRecords({
      requestId: randomUUID(),
      libraryId,
      changes: [
        {
          sourceId: a.id,
          revision: currentA.revision,
          metadata: { ...currentA.metadata, title: '不能部分保存' },
        },
        {
          sourceId: b.id,
          revision: currentB.revision,
          key: { value: 'smith2024', pinned: false, intent: 'explicit' },
        },
      ],
    });
    expect(rejected).toMatchObject({ state: 'rejected', error: { code: 'targetAmbiguous' } });
    expect(catalog.get(a.id)).toEqual(currentA);
    expect(catalog.get(b.id)).toEqual(currentB);
    const third = catalog.ingest({
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: '占用DOI', DOI: '10.1234/occupied' }]),
    });
    await expect.poll(() => catalog.batch({ batchId: third.id }).batch.state).toBe('completed');
    const noticesBefore = notices;
    const rolledBack = catalog.commitRecords({
      requestId: randomUUID(),
      libraryId,
      changes: [
        {
          sourceId: a.id,
          revision: currentA.revision,
          metadata: { ...currentA.metadata, title: '事务中先写入' },
          original: { ...original, fields: { title: '不能留下此原值' } },
          key: { value: 'Temporary', pinned: false, intent: 'explicit' },
        },
        {
          sourceId: b.id,
          revision: currentB.revision,
          metadata: { ...currentB.metadata, DOI: '10.1234/occupied' },
        },
      ],
    });
    expect(rolledBack.state).toBe('rejected');
    expect(catalog.get(a.id)).toEqual(currentA);
    expect(catalog.get(b.id)).toEqual(currentB);
    expect(catalog.history({ sourceId: a.id }).sources).toEqual(historyBefore);
    expect(catalog.recordHistory({ libraryId, sourceId: a.id }).records).toEqual(recordsBefore);
    expect(catalog.record({ libraryId, sourceId: a.id })).toMatchObject({
      citationKey: { value: 'Smith2024', pinned: true },
      originals: [original],
    });
    expect(notices).toBe(noticesBefore);
    expect(
      catalog.commitRecords({
        requestId: randomUUID(),
        libraryId,
        changes: [
          {
            sourceId: a.id,
            revision: currentA.revision,
            metadata: { ...currentA.metadata, title: '新甲' },
            key: { value: 'GeneratedKey', pinned: false, intent: 'candidate' },
          },
        ],
      }),
    ).toMatchObject({ state: 'committed', results: [{ keyCandidate: 'preserved' }] });
    const record = catalog.record({ libraryId, sourceId: a.id });
    expect(record).toMatchObject({
      citationKey: { value: 'Smith2024', pinned: true },
      originals: [original],
    });
    expect(catalog.get(a.id).metadata).toEqual({ ...a.metadata, title: '新甲' });
    const beforeUnpin = catalog.get(a.id);
    const beforeUnpinHistory = catalog.history({ sourceId: a.id }).sources;
    const beforeUnpinRecords = catalog.recordHistory({ libraryId, sourceId: a.id }).records;
    const beforeUnpinNotices = notices;
    const staleUnpin = catalog.commitRecords({
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: a.id,
          revision: currentA.revision,
          metadata: { ...beforeUnpin.metadata, title: '过期解除固定不能更正题录' },
          original: { ...original, fields: { ...original.fields, title: '不能更正原值' } },
          key: { value: 'UnpinnedReplacement', pinned: false, intent: 'explicit' },
        },
      ],
    });
    expect(staleUnpin).toMatchObject({ state: 'rejected', error: { code: 'contentChanged' } });
    expect(catalog.get(a.id)).toEqual(beforeUnpin);
    expect(catalog.record({ libraryId, sourceId: a.id })).toEqual(record);
    expect(catalog.history({ sourceId: a.id }).sources).toEqual(beforeUnpinHistory);
    expect(catalog.recordHistory({ libraryId, sourceId: a.id }).records).toEqual(
      beforeUnpinRecords,
    );
    expect(notices).toBe(beforeUnpinNotices);
    await catalog.close();
    catalog = new LiteratureCatalog(root, () => notices++);
    await catalog.initialize();
    expect(catalog.commitResult({ libraryId, requestId: initial.requestId })).toEqual(receipt);
    expect(catalog.record({ libraryId, sourceId: a.id })).toMatchObject(record);
    catalog.grant({ read: true, write: false, send: false, autoBackup: false });
    expect(() => catalog.commitRecords({ ...initial, requestId: randomUUID() })).toThrow(
      expect.objectContaining({ code: 'permissionDenied' }),
    );
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('authority backup restores original values, pinned keys and receipts into an independently authorized copy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-record-backup-'));
  test.info().annotations.push({ type: 'authority-backup-fixture', description: root });
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  let copy: LiteratureCatalog | undefined;
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: true, autoBackup: false });
    const libraryId = catalog.status().id;
    const batch = catalog.ingest({
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: '备份前题录' }]),
    });
    await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const source = catalog.list({}).sources[0];
    if (!source) throw new Error('Missing backup sample');
    const instance = catalog.createSourceInstance({
      libraryId,
      requestId: randomUUID(),
      label: '独立备份来源',
    });
    const original = {
      identity: { instanceId: instance.id, libraryLocator: 'users/local', objectKey: 'BACKUP01' },
      schemaVersion: '44',
      itemType: 'book',
      fields: { title: '备份前原值', date: '2024年春', extra: '保留原行' },
      creators: [{ creatorType: 'author', lastName: '研究所', fieldMode: 1, orderIndex: 0 }],
      relations: {},
    };
    const request = {
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: source.id,
          revision: source.revision,
          original,
          key: { value: 'BeforeBackup', pinned: true, intent: 'explicit' as const },
        },
      ],
    };
    const receipt = catalog.commitRecords(request);
    expect(receipt.state).toBe('committed');
    const before = catalog.get(source.id);
    const recordBefore = catalog.record({ libraryId, sourceId: source.id });
    expect(recordBefore).toMatchObject({
      citationKey: { value: 'BeforeBackup', pinned: true },
      originals: [original],
    });
    const historyBefore = catalog.recordHistory({ libraryId, sourceId: source.id });
    const backup = await catalog.backup();
    const laterRequest = {
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: source.id,
          revision: before.revision,
          metadata: { ...before.metadata, title: '备份后的成果' },
          original: { ...original, fields: { ...original.fields, title: '后续原值' } },
          key: { value: 'AfterBackup', pinned: true, intent: 'explicit' as const },
        },
      ],
    };
    const laterReceipt = catalog.commitRecords(laterRequest);
    expect(laterReceipt.state).toBe('committed');
    const later = catalog.get(source.id);
    const laterRecord = catalog.record({ libraryId, sourceId: source.id });
    const laterHistory = catalog.recordHistory({ libraryId, sourceId: source.id });
    const restored = await catalog.restore(backup.id, join(root, 'restored'));
    copy = new LiteratureCatalog(restored.directory, () => {});
    await copy.initialize();
    const restoredCatalog = copy;
    const restoredId = copy.status().id;
    expect(restoredId).not.toBe(libraryId);
    expect(copy.status()).toMatchObject({
      read: true,
      write: false,
      send: false,
      autoBackup: true,
    });
    expect(copy.get(source.id)).toEqual(before);
    expect(copy.record({ libraryId: restoredId, sourceId: source.id })).toEqual(recordBefore);
    expect(copy.recordHistory({ libraryId: restoredId, sourceId: source.id })).toEqual(
      historyBefore,
    );
    expect(copy.commitResult({ libraryId: restoredId, requestId: request.requestId })).toEqual(
      receipt,
    );
    expect(copy.commitResult({ libraryId: restoredId, requestId: laterRequest.requestId })).toEqual(
      {
        requestId: laterRequest.requestId,
        state: 'notFound',
      },
    );
    expect(() => restoredCatalog.record({ libraryId, sourceId: source.id })).toThrow(
      expect.objectContaining({ code: 'instanceMismatch' }),
    );
    expect(() =>
      restoredCatalog.commitRecords({
        ...laterRequest,
        libraryId: restoredId,
        requestId: randomUUID(),
      }),
    ).toThrow(expect.objectContaining({ code: 'permissionDenied' }));
    expect(copy.record({ libraryId: restoredId, sourceId: source.id })).toEqual(recordBefore);
    expect(catalog.get(source.id)).toEqual(later);
    expect(catalog.record({ libraryId, sourceId: source.id })).toEqual(laterRecord);
    expect(catalog.recordHistory({ libraryId, sourceId: source.id })).toEqual(laterHistory);
    expect(catalog.commitResult({ libraryId, requestId: request.requestId })).toEqual(receipt);
    expect(catalog.commitResult({ libraryId, requestId: laterRequest.requestId })).toEqual(
      laterReceipt,
    );
    expect(catalog.status()).toMatchObject({ id: libraryId, read: true, write: true, send: true });
  } finally {
    await copy?.close();
    await catalog.close();
  }
});

test('registered provider commits a bounded hundred-record transaction and preserves rejection receipts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-record-provider-'));
  const app = new ManualApplication(root);
  try {
    await app.initialize();
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const libraryId = (await app.call('library.status', {})).id;
    const instance = await app.call('library.createSourceInstance', {
      libraryId,
      requestId: randomUUID(),
      label: 'bounded synthetic Zotero',
    });
    const batch = await app.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'unspecified',
      json: JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ title: `sample${i}` }))),
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const sources = (await app.call('library.list', { limit: 100 })).sources;
    const request = {
      libraryId,
      requestId: randomUUID(),
      changes: sources.map((source, index) => ({
        sourceId: source.id,
        revision: source.revision,
        original: {
          identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: `KEY${index}` },
          schemaVersion: '44',
          itemType: 'journalArticle',
          fields: { title: `source${index}`, date: '2026年春', extra: '保留未知原文\n'.repeat(50) },
          creators: [{ creatorType: 'author', firstName: '晓明', lastName: '王', orderIndex: 0 }],
          relations: {},
        },
      })),
    };
    const bytes = Buffer.byteLength(JSON.stringify(request));
    expect(bytes).toBeLessThan(262144);
    const start = performance.now();
    const result = await app.call('library.commitRecords', request);
    test.info().annotations.push({
      type: 'transaction-sample',
      description: JSON.stringify({ items: 100, bytes, elapsedMs: performance.now() - start }),
    });
    expect(result.error).toBeUndefined();
    expect(result.results).toHaveLength(100);
    const first = sources[0];
    if (!first) throw new Error('Missing sample');
    const firstChange = request.changes[0];
    const second = sources[1];
    if (!firstChange || !second) throw new Error('Missing sample changes');
    const current = await app.call('library.get', { sourceId: first.id });
    const duplicate = {
      libraryId,
      requestId: randomUUID(),
      changes: [
        { sourceId: first.id, revision: current.revision, original: firstChange.original },
        { sourceId: second.id, revision: second.revision + 1, original: firstChange.original },
      ],
    };
    const rejected = await app.call('library.commitRecords', duplicate);
    expect(rejected).toMatchObject({ state: 'rejected', error: { code: 'targetAmbiguous' } });
    expect(
      await app.call('library.commitResult', { libraryId, requestId: duplicate.requestId }),
    ).toEqual(rejected);
    expect(await app.call('library.get', { sourceId: first.id })).toEqual(current);
    const sharedOriginal = {
      ...firstChange.original,
      identity: { ...firstChange.original.identity, objectKey: 'UNBOUND' },
    };
    expect(
      await app.call('library.commitRecords', {
        libraryId,
        requestId: randomUUID(),
        changes: [
          { sourceId: first.id, revision: current.revision, original: sharedOriginal },
          { sourceId: second.id, revision: second.revision + 1, original: sharedOriginal },
        ],
      }),
    ).toMatchObject({ state: 'rejected', error: { code: 'targetAmbiguous' } });
    const originalOverLimit = await app.call('library.commitRecords', {
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          ...firstChange,
          revision: current.revision,
          original: { ...firstChange.original, fields: { extra: '界'.repeat(22000) } },
        },
      ],
    });
    expect(originalOverLimit).toMatchObject({
      state: 'rejected',
      error: { code: 'resourceLimit' },
    });
    expect(await app.call('library.get', { sourceId: first.id })).toEqual(current);
    await expect(
      app.call('library.commitRecords', {
        ...request,
        requestId: randomUUID(),
        changes: Array.from({ length: 101 }, () => firstChange),
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(
      app.call('library.commitRecords', {
        ...request,
        requestId: randomUUID(),
        changes: [
          {
            ...firstChange,
            original: { ...firstChange.original, fields: { extra: '界'.repeat(90000) } },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(
      (await app.call('library.record', { libraryId, sourceId: first.id })).originals[0]?.fields,
    ).toEqual(request.changes[0]?.original.fields);
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});
