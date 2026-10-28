import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import { validateOrganization } from '../../packages/protocol/dist/library.js';

const require = createRequire(new URL('../../packages/library/package.json', import.meta.url));
const Database = require('better-sqlite3');

async function records(catalog: LiteratureCatalog, count = 2) {
  const batch = catalog.ingest({
    batchId: randomUUID(),
    origin: 'organization-fixture',
    version: 'published',
    json: JSON.stringify(
      Array.from({ length: count }, (_, i) => ({
        title: `Independent organization sample ${i}`,
        extension: { nested: [i, { keep: true }] },
      })),
    ),
  });
  await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
  return catalog.list({ limit: 100 }).sources;
}
async function pair(catalog: LiteratureCatalog) {
  const [a, b] = await records(catalog);
  if (!a || !b) throw new Error('Missing organization samples');
  return [a, b] as const;
}

test('organization is atomic, preserves complete records and treats pure reordering as unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-organization-'));
  const catalog = new LiteratureCatalog(root, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const [a, b] = await pair(catalog);
    const alpha = catalog.saveCollection({ name: 'alpha' });
    const beta = catalog.saveCollection({ name: 'beta' });
    const aChange = {
      sourceId: a.id,
      revision: a.revision,
      tags: ['one', 'two'],
      collectionIds: [alpha.id, beta.id],
    };
    const bChange = { sourceId: b.id, revision: b.revision + 1, tags: ['blocked'] };
    const input = { libraryId, requestId: randomUUID(), changes: [aChange, bChange] };
    const history = catalog.history({ sourceId: a.id });
    const rejected = catalog.organize(input);
    expect(rejected).toMatchObject({
      state: 'rejected',
      results: [
        { sourceId: a.id, status: 'notApplied' },
        { sourceId: b.id, status: 'blocked', error: { code: 'contentChanged' } },
      ],
    });
    expect(catalog.get(a.id)).toEqual(a);
    expect(catalog.get(b.id)).toEqual(b);
    expect(catalog.history({ sourceId: a.id })).toEqual(history);
    expect(catalog.organizationResult({ libraryId, requestId: input.requestId }).outcome).toEqual(
      rejected,
    );
    const valid = {
      ...input,
      requestId: randomUUID(),
      changes: [aChange, { ...bChange, revision: b.revision }],
    };
    const receipt = catalog.organize(valid);
    expect(receipt).toMatchObject({
      state: 'committed',
      results: [
        { sourceId: a.id, status: 'applied', revision: a.revision + 1 },
        { sourceId: b.id, status: 'applied', revision: b.revision + 1 },
      ],
    });
    expect(catalog.get(a.id)).toEqual({
      ...a,
      revision: a.revision + 1,
      updatedAt: expect.any(String),
      tags: ['one', 'two'],
      collectionIds: [alpha.id, beta.id],
    });
    expect(catalog.commitResult.bind(catalog, { libraryId, requestId: valid.requestId })).toThrow(
      expect.objectContaining({ code: 'invalidRequest' }),
    );
    expect(catalog.organize(valid)).toEqual(receipt);
    const before = catalog.get(a.id);
    const unchanged = catalog.organize({
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: a.id,
          revision: before.revision,
          tags: ['two', 'one'],
          collectionIds: [beta.id, alpha.id],
        },
      ],
    });
    expect(unchanged).toMatchObject({
      state: 'committed',
      results: [{ status: 'unchanged', revision: before.revision }],
    });
    expect(catalog.get(a.id)).toEqual(before);
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('organization inverses use current generations and protect every later source revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-organization-undo-'));
  const catalog = new LiteratureCatalog(root, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const [a, b] = await pair(catalog);
    const input = {
      libraryId,
      requestId: randomUUID(),
      changes: [
        { sourceId: a.id, revision: a.revision, tags: ['one', 'two'] },
        { sourceId: b.id, revision: b.revision, tags: [] },
      ],
    };
    const committed = catalog.organize(input);
    const query = { libraryId, editRequestId: input.requestId };
    const first = catalog.organizationEdit({ ...query, limit: 1 });
    expect(first).toMatchObject({
      editRevision: 1,
      position: 'applied',
      eligibility: { eligible: true },
      changes: [{ sourceId: a.id, field: 'tags', value: 'one', before: false, after: true }],
      nextOffset: 1,
    });
    expect(validateOrganization('library.organizationEdit', 'result', first)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThanOrEqual(524288);
    expect(
      catalog.organizationEdit({ ...query, offset: 1, expectedEditRevision: 1 }).changes,
    ).toEqual([{ sourceId: a.id, field: 'tags', value: 'two', before: false, after: true }]);
    const undo = {
      ...query,
      requestId: randomUUID(),
      expectedEditRevision: 1,
      direction: 'undo' as const,
    };
    const races = await Promise.all([
      Promise.resolve().then(() => catalog.revertOrganization(undo)),
      Promise.resolve().then(() =>
        catalog.revertOrganization({ ...undo, requestId: randomUUID() }),
      ),
    ]);
    expect(races.map((result) => result.state)).toEqual(['committed', 'rejected']);
    expect(races[0]).toMatchObject({
      results: [{ sourceId: a.id, status: 'applied', revision: a.revision + 2 }],
    });
    expect(catalog.get(a.id).tags).toEqual([]);
    expect(catalog.get(b.id)).toEqual(b);
    expect(catalog.revertOrganization(undo)).toEqual(races[0]);
    expect(catalog.organize(input)).toEqual(committed);
    expect(catalog.get(a.id).tags).toEqual([]);
    expect(() =>
      catalog.organizationEdit({ ...query, offset: 1, expectedEditRevision: 1 }),
    ).toThrow(expect.objectContaining({ code: 'contentChanged' }));
    const redo = catalog.revertOrganization({
      ...query,
      requestId: randomUUID(),
      expectedEditRevision: 2,
      direction: 'redo',
    });
    expect(redo).toMatchObject({ state: 'committed', results: [{ revision: a.revision + 3 }] });
    const current = catalog.get(a.id);
    const changed = catalog.update({
      sourceId: a.id,
      revision: current.revision,
      metadata: { ...current.metadata, title: 'Later work' },
      tags: current.tags,
      collectionIds: current.collectionIds,
      relatedIds: current.relatedIds,
    });
    const restored = catalog.update({
      sourceId: a.id,
      revision: changed.revision,
      metadata: current.metadata,
      tags: changed.tags,
      collectionIds: changed.collectionIds,
      relatedIds: changed.relatedIds,
    });
    const stale = catalog.revertOrganization({
      ...query,
      requestId: randomUUID(),
      expectedEditRevision: 3,
      direction: 'undo',
    });
    expect(stale).toMatchObject({
      state: 'rejected',
      results: [{ status: 'blocked', error: { code: 'contentChanged' } }],
    });
    expect(catalog.get(a.id)).toEqual(restored);
    const noChange = catalog.organize({
      libraryId,
      requestId: randomUUID(),
      changes: [{ sourceId: b.id, revision: b.revision, tags: [] }],
    });
    expect(
      catalog.organizationEdit({ libraryId, editRequestId: noChange.requestId }),
    ).toMatchObject({
      position: 'unchanged',
      editRevision: 0,
      eligibility: { eligible: false },
      changes: [],
    });
    expect(
      catalog.revertOrganization({
        libraryId,
        editRequestId: noChange.requestId,
        requestId: randomUUID(),
        expectedEditRevision: 0,
        direction: 'undo',
      }),
    ).toMatchObject({ state: 'rejected', error: { code: 'invalidRequest' } });
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('small clearing requests reject oversized old-value evidence without touching sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-organization-budget-'));
  const catalog = new LiteratureCatalog(root, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const sources = await records(catalog, 10);
    const seeded = sources.map((source) =>
      catalog.update({
        sourceId: source.id,
        revision: source.revision,
        metadata: source.metadata,
        tags: Array.from({ length: 100 }, (_, i) => `${'界'.repeat(96)}-${i}`),
        collectionIds: [],
        relatedIds: [],
      }),
    );
    const input = {
      libraryId,
      requestId: randomUUID(),
      changes: seeded.map((source) => ({
        sourceId: source.id,
        revision: source.revision,
        tags: [],
      })),
    };
    expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(262144);
    const result = catalog.organize(input);
    expect(result).toMatchObject({ state: 'rejected', error: { code: 'resourceLimit' } });
    expect(result.results.every((item) => item.status === 'notApplied')).toBe(true);
    for (const source of seeded) expect(catalog.get(source.id)).toEqual(source);
    const accepted = catalog.organize({
      ...input,
      requestId: randomUUID(),
      changes: input.changes.slice(0, 1),
    });
    expect(accepted).toMatchObject({ state: 'committed', results: [{ status: 'applied' }] });
    const first = seeded[0];
    if (!first) throw new Error('Missing budget sample');
    expect(catalog.get(first.id).tags).toEqual([]);
    expect(() =>
      catalog.organize({
        libraryId,
        requestId: randomUUID(),
        changes: seeded.map((source) => ({
          sourceId: source.id,
          revision: source.revision,
          tags: source.tags,
        })),
      }),
    ).toThrow(expect.objectContaining({ code: 'resourceLimit' }));
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('transaction write failure rolls back earlier sources and leaves no invented final receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-organization-rollback-'));
  const catalog = new LiteratureCatalog(root, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const [a, b] = await pair(catalog);
    const history = catalog.history({ sourceId: a.id });
    const fault = new Database(join(root, 'library/library.sqlite'));
    try {
      fault.exec(
        `CREATE TRIGGER fail_organization BEFORE INSERT ON sources WHEN NEW.id = '${b.id}' AND json_extract(NEW.value, '$.tags[0]') = 'atomic-trigger' BEGIN SELECT RAISE(ABORT, 'fixture-write-fault'); END;`,
      );
      const input = {
        libraryId,
        requestId: randomUUID(),
        changes: [a, b].map((source) => ({
          sourceId: source.id,
          revision: source.revision,
          tags: ['atomic-trigger'],
        })),
      };
      expect(() => catalog.organize(input)).toThrow();
      expect(catalog.get(a.id)).toEqual(a);
      expect(catalog.get(b.id)).toEqual(b);
      expect(catalog.history({ sourceId: a.id })).toEqual(history);
      expect(catalog.organizationResult({ libraryId, requestId: input.requestId }).outcome).toEqual(
        { requestId: input.requestId, state: 'notFound' },
      );
    } finally {
      fault.close();
    }
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('organization preserves real attachments and reading records with original and key authority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-organization-materials-'));
  const catalog = new LiteratureCatalog(root, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const [source] = await pair(catalog);
    const path = join(root, 'evidence.txt');
    await writeFile(path, 'Independent file evidence');
    const batch = catalog.importFiles({
      batchId: randomUUID(),
      sourceId: source.id,
      paths: [path],
      purpose: 'evidence',
      version: 'published',
      origin: 'organization-fixture',
    });
    await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const attachments = await catalog.attachments({ sourceId: source.id });
    const attachment = attachments.attachments[0];
    if (!attachment) throw new Error('Missing real attachment');
    const note = await catalog.saveReadingRecord({
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
      recordId: randomUUID(),
      kind: 'note',
      quote: '',
      body: 'Preserve independent reading work',
    });
    const instance = catalog.createSourceInstance({
      libraryId,
      requestId: randomUUID(),
      label: 'Original source',
    });
    const original = {
      identity: { instanceId: instance.id, libraryLocator: 'users/local', objectKey: 'ORIGINAL1' },
      schemaVersion: 'schema44',
      itemType: 'radioBroadcast',
      fields: { title: 'Original title', extra: 'Retain Extra' },
      creators: [{ lastName: 'Institution', fieldMode: 1 }],
      relations: {},
    };
    const current = catalog.get(source.id);
    expect(
      catalog.commitRecords({
        libraryId,
        requestId: randomUUID(),
        changes: [
          {
            sourceId: source.id,
            revision: current.revision,
            original,
            key: { value: 'Pinned2026', pinned: true, intent: 'explicit' },
          },
        ],
      }).state,
    ).toBe('committed');
    const before = catalog.get(source.id);
    const authority = catalog.record({ libraryId, sourceId: source.id });
    const organized = catalog.organize({
      libraryId,
      requestId: randomUUID(),
      changes: [{ sourceId: source.id, revision: before.revision, tags: ['exact Case '] }],
    });
    expect(organized.state).toBe('committed');
    expect(catalog.get(source.id)).toEqual({
      ...before,
      tags: ['exact Case '],
      revision: before.revision + 1,
      updatedAt: expect.any(String),
    });
    expect(await catalog.attachments({ sourceId: source.id })).toEqual(attachments);
    expect(catalog.readingRecord(note.id)).toEqual(note);
    expect(catalog.record({ libraryId, sourceId: source.id })).toEqual({
      ...authority,
      revision: before.revision + 1,
    });
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('permission and copy identity checks survive outcome queries without replay or rebinding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-organization-identity-'));
  const catalog = new LiteratureCatalog(join(root, 'original'), () => {});
  const copy = new LiteratureCatalog(join(root, 'copy'), () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const sources = await records(catalog, 100);
    const firstSource = sources[0];
    if (!firstSource) throw new Error('Missing identity sample');
    const input = {
      libraryId,
      requestId: randomUUID(),
      changes: sources.map((s) => ({ sourceId: s.id, revision: s.revision, tags: ['organized'] })),
    };
    const receipt = catalog.organize(input);
    expect(receipt).toMatchObject({
      state: 'committed',
      results: expect.arrayContaining([
        { sourceId: firstSource.id, status: 'applied', revision: firstSource.revision + 1 },
      ]),
    });
    expect(receipt.results).toHaveLength(100);
    expect(validateOrganization('library.organize', 'result', receipt)).toBe(true);
    const absent = { libraryId, requestId: randomUUID() };
    expect(catalog.organizationResult(absent).outcome).toEqual({
      requestId: absent.requestId,
      state: 'notFound',
    });
    expect(() => catalog.organizationResult({ ...absent, libraryId: 'wrong-library' })).toThrow(
      expect.objectContaining({ code: 'instanceMismatch' }),
    );
    expect(() =>
      catalog.organize({
        ...input,
        changes: input.changes.map((c) => ({ ...c, tags: ['different'] })),
      }),
    ).toThrow(expect.objectContaining({ code: 'invalidRequest' }));
    catalog.grant({ read: false, write: false, send: false, autoBackup: false });
    expect(() => catalog.organizationResult(absent)).toThrow(
      expect.objectContaining({ code: 'permissionDenied' }),
    );
    expect(() => catalog.organize(input)).toThrow(
      expect.objectContaining({ code: 'permissionDenied' }),
    );
    catalog.grant({ read: true, write: false, send: false, autoBackup: false });
    expect(catalog.organizationResult({ libraryId, requestId: input.requestId }).outcome).toEqual(
      receipt,
    );
    expect(() =>
      catalog.revertOrganization({
        libraryId,
        requestId: randomUUID(),
        editRequestId: input.requestId,
        expectedEditRevision: 1,
        direction: 'undo',
      }),
    ).toThrow(expect.objectContaining({ code: 'permissionDenied' }));
    // A copied database fixture with a new identity tests the provider, not the restore/CLI path.
    const copyDirectory = join(root, 'copy/library');
    await mkdir(copyDirectory, { recursive: true });
    const snapshot = new Database(join(root, 'original/library/library.sqlite'));
    try {
      await snapshot.backup(join(copyDirectory, 'library.sqlite'));
    } finally {
      snapshot.close();
    }
    const copied = new Database(join(copyDirectory, 'library.sqlite'));
    const copyId = randomUUID();
    try {
      copied.prepare("UPDATE meta SET value=? WHERE key='identity'").run(copyId);
    } finally {
      copied.close();
    }
    await copy.initialize();
    copy.grant({ read: true, write: true, send: false, autoBackup: false });
    const copyQuery = { libraryId: copyId, editRequestId: input.requestId };
    expect(copy.organizationResult({ libraryId: copyId, requestId: input.requestId })).toEqual({
      libraryId: copyId,
      outcome: receipt,
    });
    expect(copy.organizationEdit(copyQuery)).toMatchObject({
      originLibraryId: libraryId,
      eligibility: { eligible: false, error: { code: 'instanceMismatch' } },
    });
    expect(
      copy.revertOrganization({
        ...copyQuery,
        requestId: randomUUID(),
        expectedEditRevision: 1,
        direction: 'undo',
      }),
    ).toMatchObject({ state: 'rejected', error: { code: 'instanceMismatch' } });
    expect(() => copy.organize(input)).toThrow(
      expect.objectContaining({ code: 'instanceMismatch' }),
    );
    const first = copy.get(firstSource.id);
    expect(
      copy.organize({
        libraryId: copyId,
        requestId: randomUUID(),
        changes: [{ sourceId: first.id, revision: first.revision, tags: ['copy-only'] }],
      }).state,
    ).toBe('committed');
    expect(catalog.get(first.id).tags).toEqual(['organized']);
  } finally {
    await catalog.close();
    await copy.close();
    await rm(root, { recursive: true });
  }
});

test('undo refuses revision overflow without changing the source, history or edit generation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-organization-revision-'));
  const catalog = new LiteratureCatalog(root, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const libraryId = catalog.status().id;
    const [source] = await pair(catalog);
    // A valid persisted legacy revision, independent of the new increment implementation.
    const persisted = { ...source, revision: Number.MAX_SAFE_INTEGER - 1 };
    const seed = new Database(join(root, 'library/library.sqlite'));
    try {
      seed
        .prepare('UPDATE sources SET value=? WHERE id=?')
        .run(JSON.stringify(persisted), source.id);
    } finally {
      seed.close();
    }
    const committed = catalog.organize({
      libraryId,
      requestId: randomUUID(),
      changes: [{ sourceId: source.id, revision: persisted.revision, tags: ['at-ceiling'] }],
    });
    expect(committed).toMatchObject({
      state: 'committed',
      results: [{ revision: Number.MAX_SAFE_INTEGER }],
    });
    const before = catalog.get(source.id);
    const history = catalog.history({ sourceId: source.id });
    const query = { libraryId, editRequestId: committed.requestId };
    const undo = catalog.revertOrganization({
      ...query,
      requestId: randomUUID(),
      expectedEditRevision: 1,
      direction: 'undo',
    });
    expect(undo).toMatchObject({
      state: 'rejected',
      results: [{ status: 'blocked', error: { code: 'resourceLimit' } }],
    });
    expect(validateOrganization('library.revertOrganization', 'result', undo)).toBe(true);
    expect(catalog.get(source.id)).toEqual(before);
    expect(catalog.history({ sourceId: source.id })).toEqual(history);
    expect(catalog.organizationEdit(query)).toMatchObject({ editRevision: 1, position: 'applied' });
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});
