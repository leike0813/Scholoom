import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  editCatalogField,
  moveCatalogCreator,
} from '../../apps/desktop/src/renderer/src/workbench/library/catalog-metadata.js';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import { validateLibrary } from '../../packages/protocol/dist/library.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-catalog-'));
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  await catalog.initialize();
  catalog.grant({ read: true, write: true, send: false, autoBackup: false });
  return {
    root,
    catalog,
    close: async () => {
      await catalog.close();
      await rm(root, { recursive: true });
    },
  };
}
const record = {
  title: '合成研究',
  type: 'article-journal',
  DOI: 'https://doi.org/10.1234/Example',
  author: [{ family: 'Researcher', given: 'A' }],
};
async function ingest(
  catalog: LiteratureCatalog,
  json: unknown,
  version = 'published',
  origin = 'synthetic',
) {
  const batch = catalog.ingest({
    batchId: randomUUID(),
    json: JSON.stringify(json),
    version,
    origin,
  });
  await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
  return catalog.batch({ batchId: batch.id });
}

test('same explicit version reuses identity, fills gaps and preserves conflicts and other versions', async () => {
  const f = await fixture();
  try {
    const first = await ingest(f.catalog, record);
    const id = first.entries[0]?.sourceId as string;
    const second = await ingest(
      f.catalog,
      { ...record, title: '冲突题名', DOI: 'doi:10.1234/example', abstract: '新摘要' },
      'published',
      'second',
    );
    expect(second.entries[0]).toMatchObject({ state: 'reused', sourceId: id });
    expect(second.entries[0]?.conflicts).toContain('title');
    expect(f.catalog.get(id).metadata).toMatchObject({ title: '合成研究', abstract: '新摘要' });
    const pre = await ingest(f.catalog, record, 'preprint');
    const preId = pre.entries[0]?.sourceId as string;
    expect(preId).not.toBe(id);
    const current = f.catalog.get(id);
    f.catalog.update({ ...current, sourceId: id, relatedIds: [preId] });
    expect(f.catalog.get(preId).relatedIds).toContain(id);
    await ingest(f.catalog, record, 'unspecified');
    await ingest(f.catalog, record, 'unspecified');
    expect(f.catalog.list({}).sources).toHaveLength(4);
    expect(f.catalog.history({ sourceId: id }).sources[0]?.metadata.title).toBe('合成研究');
  } finally {
    await f.close();
  }
});

test('batch receipts survive partial failures, replay and permission interruption', async () => {
  const f = await fixture();
  try {
    const input = {
      batchId: randomUUID(),
      json: JSON.stringify([record, { title: '' }, { title: '第二条' }]),
      version: 'published',
      origin: 'synthetic',
    };
    const accepted = f.catalog.ingest(input);
    expect(f.catalog.ingest(input).id).toBe(accepted.id);
    expect(() => f.catalog.ingest({ ...input, origin: 'changed' })).toThrow();
    f.catalog.grant({ read: true, write: false, send: false, autoBackup: false });
    await expect
      .poll(() => f.catalog.batch({ batchId: accepted.id }).batch.state)
      .toBe('interrupted');
    expect(f.catalog.list({}).sources).toEqual([]);
    await f.catalog.close();
    const next = new LiteratureCatalog(join(f.root, 'profile'), () => {});
    try {
      await next.initialize();
      expect(next.batch({ batchId: accepted.id }).batch.state).toBe('interrupted');
      next.grant({ read: true, write: true, send: false, autoBackup: false });
      next.resume(accepted.id);
      await expect.poll(() => next.batch({ batchId: accepted.id }).batch.state).toBe('completed');
      const result = next.batch({ batchId: accepted.id });
      expect(result.batch).toMatchObject({ processed: 3, failed: 1 });
      expect(result.entries.map((e) => e.state)).toEqual(['created', 'failed', 'created']);
      expect(result.entries[1]?.error?.code).toBe('invalidRequest');
      expect(next.list({}).sources).toHaveLength(2);
      next.resume(accepted.id);
      expect(next.list({}).sources).toHaveLength(2);
    } finally {
      await next.close();
    }
  } finally {
    await rm(f.root, { recursive: true });
  }
});

test('collections, tags and optimistic updates preserve other work and have bounded reads', async () => {
  const f = await fixture();
  try {
    const root = f.catalog.saveCollection({ name: '根集合' });
    const child = f.catalog.saveCollection({ name: '子集合', parentId: root.id });
    expect(() => f.catalog.saveCollection({ ...root, parentId: child.id })).toThrow();
    const batch = await ingest(f.catalog, [record, { title: '其他研究' }]);
    const id = batch.entries[0]?.sourceId as string,
      source = f.catalog.get(id);
    const updated = f.catalog.update({
      ...source,
      sourceId: id,
      tags: ['method'],
      collectionIds: [root.id, child.id],
      metadata: { ...source.metadata, title: '人工更正' },
    });
    expect(() =>
      f.catalog.update({ ...source, sourceId: id, metadata: { title: '过期覆盖' } }),
    ).toThrow();
    expect(
      f.catalog.list({ tag: 'method', collectionId: child.id }).sources.map((s) => s.id),
    ).toEqual([id]);
    f.catalog.update({ ...updated, sourceId: id, collectionIds: [child.id] });
    expect(f.catalog.list({ collectionId: root.id }).sources).toEqual([]);
    expect(f.catalog.get(id).metadata.title).toBe('人工更正');
    const page = f.catalog.list({ limit: 1 });
    expect(page.sources).toHaveLength(1);
    expect(page.nextOffset).toBe(1);
    expect(f.catalog.list({ limit: 1, offset: 1 }).sources[0]?.id).not.toBe(page.sources[0]?.id);
    f.catalog.grant({ read: false, write: true, send: true, autoBackup: false });
    expect(() => f.catalog.update({ ...source, sourceId: id })).toThrow();
    f.catalog.grant({ read: false, write: false, send: false, autoBackup: false });
    expect(() => f.catalog.list({})).toThrow();
    expect(() => f.catalog.get(id)).toThrow();
  } finally {
    await f.close();
  }
});

test('collection parent scopes paginate roots and direct children independently of identity order', async () => {
  const f = await fixture();
  try {
    const ids = Array.from(
      { length: 56 },
      (_, index) => f.catalog.saveCollection({ name: `集合${index}` }).id,
    ).sort();
    const rootId = ids[55] as string,
      childId = ids[0] as string,
      grandchildId = ids[54] as string;
    for (const id of ids.slice(0, 27)) {
      f.catalog.saveCollection({ id, name: '子集合', parentId: rootId });
    }
    f.catalog.saveCollection({ id: grandchildId, name: '孙集合', parentId: childId });

    const scopes = [
      { input: {}, expectedIds: ids },
      { input: { parentId: null }, expectedIds: [...ids.slice(27, 54), rootId] },
      { input: { parentId: rootId }, expectedIds: ids.slice(0, 27) },
      { input: { parentId: childId }, expectedIds: [grandchildId] },
      { input: { parentId: grandchildId }, expectedIds: [] },
      { input: { parentId: ids[1] as string }, expectedIds: [] },
    ];
    for (const { input, expectedIds } of scopes) {
      expect(validateLibrary('library.collections', 'params', input)).toBe(true);
      const first = f.catalog.collections(input);
      expect(first.collections.map((collection) => collection.id)).toEqual(
        expectedIds.slice(0, 25),
      );
      expect(first.nextOffset).toBe(expectedIds.length > 25 ? 25 : undefined);
      const rest = f.catalog.collections({ ...input, offset: 25, limit: 100 });
      expect(rest.collections.map((collection) => collection.id)).toEqual(expectedIds.slice(25));
      expect(rest.nextOffset).toBeUndefined();
    }
    expect(f.catalog.collections({ parentId: rootId, offset: 100 })).toEqual({
      collections: [],
    });
    for (const input of [
      { parentId: '' },
      { parentId: 1 },
      { parentId: [] },
      { parentId: null, offset: -1 },
      { parentId: rootId, limit: 101 },
    ]) {
      expect(validateLibrary('library.collections', 'params', input)).toBe(false);
    }
    f.catalog.grant({ read: true, write: false, send: false, autoBackup: false });
    expect(f.catalog.collections({ parentId: rootId, limit: 1 }).nextOffset).toBe(1);
    f.catalog.grant({ read: false, write: true, send: true, autoBackup: false });
    for (const { input } of scopes) expect(() => f.catalog.collections(input)).toThrow();
  } finally {
    await f.close();
  }
});

test('backup restores an independent inspectable copy and preserves later edits', async () => {
  const f = await fixture();
  try {
    const result = await ingest(f.catalog, record);
    const id = result.entries[0]?.sourceId as string;
    const snapshot = f.catalog.get(id),
      identity = f.catalog.status().id;
    const backup = await f.catalog.backup();
    f.catalog.update({
      ...snapshot,
      sourceId: id,
      metadata: { ...snapshot.metadata, title: '备份后更正' },
    });
    const restored = await f.catalog.restore(backup.id, join(f.root, 'restored'));
    const copy = new LiteratureCatalog(restored.directory, () => {});
    try {
      await copy.initialize();
      expect(copy.status()).toMatchObject({ read: true, write: false, send: false });
      expect(copy.status().id).not.toBe(identity);
      expect(copy.get(id).metadata.title).toBe('合成研究');
      expect(f.catalog.get(id).metadata.title).toBe('备份后更正');
      await expect(f.catalog.restore(backup.id, restored.directory)).rejects.toThrow();
    } finally {
      await copy.close();
    }
  } finally {
    await f.close();
  }
});

test('automatic backup remembers unprotected writes across restart', async () => {
  const f = await fixture();
  try {
    await ingest(f.catalog, record);
    f.catalog.grant({ read: true, write: true, send: false, autoBackup: true });
    await f.catalog.close();
    const reopened = new LiteratureCatalog(join(f.root, 'profile'), () => {});
    try {
      await reopened.initialize();
      expect(await reopened.backups()).toHaveLength(0);
      await reopened.autoBackup();
      expect(await reopened.backups()).toHaveLength(1);
    } finally {
      await reopened.close();
    }
  } finally {
    await rm(f.root, { recursive: true });
  }
});

test('typed CSL changes retain original extensions and history across authority restart', async () => {
  const f = await fixture();
  const metadata = {
    title: '原题名',
    type: 'article-journal',
    volume: 12,
    issued: { 'date-parts': [[2024, 2]], season: 1 },
    note: 'Extra原文',
    'citation-key': 'ExistingKey',
    extension: { nested: ['保留'] },
    author: [{ family: '王', given: '小明', 'non-dropping-particle': 'de' }, { literal: '研究所' }],
  };
  try {
    const batch = await ingest(f.catalog, metadata);
    const id = batch.entries[0]?.sourceId as string;
    const source = f.catalog.get(id);
    const changed = moveCatalogCreator(
      editCatalogField(metadata, 'title', '新题名'),
      'author',
      0,
      'translator',
    );
    f.catalog.update({ ...source, sourceId: id, metadata: changed });
    await f.catalog.close();
    const reopened = new LiteratureCatalog(join(f.root, 'profile'), () => {});
    try {
      await reopened.initialize();
      expect(reopened.get(id).metadata).toEqual({
        ...metadata,
        title: '新题名',
        author: [metadata.author[1]],
        translator: [metadata.author[0]],
      });
      expect(
        reopened
          .history({ sourceId: id })
          .sources.some((revision) => revision.metadata.title === '原题名'),
      ).toBe(true);
    } finally {
      await reopened.close();
    }
  } finally {
    await rm(f.root, { recursive: true });
  }
});
