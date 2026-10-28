import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import type { LibrarySource } from '../../packages/protocol/dist/library.js';

const require = createRequire(new URL('../../packages/library/package.json', import.meta.url));
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const libraryId = 'synthetic-v3-library';
const grants = { read: true, write: false, send: false, autoBackup: false };
const source: LibrarySource = {
  id: 'synthetic-v3-source',
  metadata: {
    title: '独立的旧库题录',
    type: 'article-journal',
    'citation-key': 'LegacyKey',
    extension: { nested: ['原值', { retained: true }] },
  },
  version: 'published',
  revision: 7,
  tags: ['legacy'],
  collectionIds: [],
  relatedIds: [],
  origins: ['synthetic-v3'],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  metadataOrigin: 'provided',
  attachmentState: 'unavailable',
  analysisState: 'notGenerated',
};

async function createLegacy(root: string, version = 3): Promise<string> {
  const profile = join(root, 'profile');
  const migrationsFolder = join(root, 'v3-migrations');
  const original = new URL('../../packages/library/src/migrations/', import.meta.url);
  const journal = JSON.parse(await readFile(new URL('meta/_journal.json', original), 'utf8'));
  const entries = journal.entries.slice(0, version) as { tag: string }[];
  await mkdir(join(migrationsFolder, 'meta'), { recursive: true });
  for (const entry of entries)
    await copyFile(
      new URL(`${entry.tag}.sql`, original),
      join(migrationsFolder, `${entry.tag}.sql`),
    );
  await writeFile(
    join(migrationsFolder, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries }),
  );
  await mkdir(join(profile, 'library'), { recursive: true });
  const database = new Database(join(profile, 'library', 'library.sqlite'));
  try {
    migrate(drizzle(database), { migrationsFolder });
    database.transaction(() => {
      const put = database.prepare('INSERT INTO meta(key,value) VALUES(?,?)');
      put.run('identity', libraryId);
      put.run('grants', JSON.stringify(grants));
      put.run('revision', '11');
      database
        .prepare('INSERT INTO sources(id,doi,version,value) VALUES(?,?,?,?)')
        .run(source.id, null, source.version, JSON.stringify(source));
      database.pragma(`user_version = ${version}`);
    })();
  } finally {
    database.close();
  }
  return profile;
}

test('v3 library migration preserves CSL without inferring originals or formal keys and retains its backup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-library-v3-records-'));
  let catalog: LiteratureCatalog | undefined;
  try {
    const profile = await createLegacy(root);
    for (let opening = 0; opening < 2; opening++) {
      catalog = new LiteratureCatalog(profile, () => {});
      await catalog.initialize();
      expect(catalog.status()).toEqual({ id: libraryId, revision: 11, ...grants });
      expect(catalog.get(source.id)).toEqual(source);
      expect(catalog.record({ libraryId, sourceId: source.id })).toEqual({
        sourceId: source.id,
        revision: source.revision,
        citationKey: null,
        originals: [],
      });
      await catalog.close();
      catalog = undefined;
    }
    const current = new Database(join(profile, 'library', 'library.sqlite'), {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(current.pragma('user_version', { simple: true })).toBe(5);
    } finally {
      current.close();
    }
    const backup = new Database(join(profile, 'library', 'before-migration-v3.sqlite'), {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(backup.pragma('user_version', { simple: true })).toBe(3);
      expect(backup.pragma('quick_check', { simple: true })).toBe('ok');
      expect(backup.prepare("SELECT value FROM meta WHERE key='identity'").get()?.value).toBe(
        libraryId,
      );
      expect(
        JSON.parse(backup.prepare('SELECT value FROM sources WHERE id=?').get(source.id).value),
      ).toEqual(source);
    } finally {
      backup.close();
    }
  } finally {
    await catalog?.close();
    await rm(root, { recursive: true });
  }
});

test('a future library version is rejected while its version and unfamiliar records remain inspectable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-library-future-records-'));
  const catalog = new LiteratureCatalog(root, () => {});
  const value = { title: '未来版本原值', extension: { nested: ['保留', 5] } };
  try {
    await mkdir(join(root, 'library'));
    const path = join(root, 'library', 'library.sqlite');
    const database = new Database(path);
    try {
      database.exec('CREATE TABLE future_records(id TEXT PRIMARY KEY, value TEXT NOT NULL)');
      database
        .prepare('INSERT INTO future_records(id,value) VALUES(?,?)')
        .run('future-source', JSON.stringify(value));
      database.pragma('user_version = 6');
    } finally {
      database.close();
    }
    await expect(catalog.initialize()).rejects.toMatchObject({ code: 'unavailable' });
    const preserved = new Database(path, { readonly: true, fileMustExist: true });
    try {
      expect(preserved.pragma('user_version', { simple: true })).toBe(6);
      expect(preserved.pragma('quick_check', { simple: true })).toBe('ok');
      expect(
        JSON.parse(
          preserved.prepare('SELECT value FROM future_records WHERE id=?').get('future-source')
            .value,
        ),
      ).toEqual(value);
      expect(
        preserved
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
          .all(),
      ).toEqual([{ name: 'future_records' }]);
    } finally {
      preserved.close();
    }
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('v4 organization migration preserves authority receipts and forbids cross-kind request reuse', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-library-v4-organization-'));
  let catalog: LiteratureCatalog | undefined;
  const original = {
    identity: { instanceId: 'instance', libraryLocator: 'users/local', objectKey: 'ABCD1234' },
    schemaVersion: 'schema44',
    itemType: 'radioBroadcast',
    fields: { title: 'Original', extra: 'untouched' },
    creators: [],
    relations: {},
  };
  const authorityRequest = {
    libraryId,
    requestId: 'old-authority',
    changes: [
      {
        sourceId: source.id,
        revision: 6,
        key: { value: 'Pinned2026', pinned: true, intent: 'explicit' as const },
      },
    ],
  };
  const authorityReceipt = {
    requestId: 'old-authority',
    state: 'committed' as const,
    results: [{ sourceId: source.id, revision: 7 }],
  };
  try {
    const profile = await createLegacy(root, 4);
    const seed = new Database(join(profile, 'library/library.sqlite'));
    try {
      seed
        .prepare('INSERT INTO source_instances(id,requestId,request,label) VALUES(?,?,?,?)')
        .run(
          'instance',
          'old-registration',
          JSON.stringify({ requestId: 'old-registration', libraryId, label: 'Legacy source' }),
          'Legacy source',
        );
      seed
        .prepare('INSERT INTO original_records(identity,sourceId,value) VALUES(?,?,?)')
        .run(
          JSON.stringify(['instance', 'users/local', 'ABCD1234']),
          source.id,
          JSON.stringify(original),
        );
      seed
        .prepare('INSERT INTO citation_keys(sourceId,normalized,value,pinned) VALUES(?,?,?,?)')
        .run(source.id, 'pinned2026', 'Pinned2026', 1);
      seed
        .prepare('INSERT INTO record_operations(requestId,request,value) VALUES(?,?,?)')
        .run(
          authorityRequest.requestId,
          JSON.stringify(authorityRequest),
          JSON.stringify(authorityReceipt),
        );
      seed
        .prepare('INSERT INTO history(sourceId,value) VALUES(?,?)')
        .run(source.id, JSON.stringify({ ...source, revision: 6 }));
    } finally {
      seed.close();
    }
    catalog = new LiteratureCatalog(profile, () => {});
    await catalog.initialize();
    const active = catalog;
    expect(catalog.get(source.id)).toEqual(source);
    expect(catalog.commitResult({ libraryId, requestId: authorityRequest.requestId })).toEqual(
      authorityReceipt,
    );
    expect(catalog.record({ libraryId, sourceId: source.id })).toMatchObject({
      citationKey: { value: 'Pinned2026', pinned: true },
      originals: [original],
    });
    const history = catalog.history({ sourceId: source.id });
    catalog.grant({ ...grants, write: true });
    expect(catalog.commitRecords(authorityRequest)).toEqual(authorityReceipt);
    expect(() =>
      active.organize({
        libraryId,
        requestId: authorityRequest.requestId,
        changes: [{ sourceId: source.id, revision: source.revision, tags: [] }],
      }),
    ).toThrow(expect.objectContaining({ code: 'invalidRequest' }));
    expect(() =>
      active.organizationResult({ libraryId, requestId: authorityRequest.requestId }),
    ).toThrow(expect.objectContaining({ code: 'invalidRequest' }));
    const request = {
      libraryId,
      requestId: randomUUID(),
      changes: [{ sourceId: source.id, revision: source.revision, tags: ['organized'] }],
    };
    const committed = catalog.organize(request);
    expect(committed.state).toBe('committed');
    expect(catalog.record({ libraryId, sourceId: source.id })).toMatchObject({
      citationKey: { value: 'Pinned2026', pinned: true },
      originals: [original],
    });
    expect(catalog.get(source.id).metadata).toEqual(source.metadata);
    expect(catalog.history({ sourceId: source.id }).sources).toEqual([source, ...history.sources]);
    expect(() =>
      active.commitRecords({ ...authorityRequest, requestId: request.requestId }),
    ).toThrow(expect.objectContaining({ code: 'invalidRequest' }));
    await catalog.close();
    catalog = undefined;
    const current = new Database(join(profile, 'library/library.sqlite'), { readonly: true });
    try {
      expect(current.pragma('user_version', { simple: true })).toBe(5);
      expect(
        current
          .prepare('SELECT kind,request,value FROM record_operations WHERE requestId=?')
          .get(authorityRequest.requestId),
      ).toEqual({
        kind: 'authority',
        request: JSON.stringify(authorityRequest),
        value: JSON.stringify(authorityReceipt),
      });
    } finally {
      current.close();
    }
    const before = new Database(join(profile, 'library/before-migration-v4.sqlite'), {
      readonly: true,
    });
    try {
      expect(before.pragma('user_version', { simple: true })).toBe(4);
      expect(
        before
          .prepare('SELECT request,value FROM record_operations WHERE requestId=?')
          .get(authorityRequest.requestId),
      ).toEqual({
        request: JSON.stringify(authorityRequest),
        value: JSON.stringify(authorityReceipt),
      });
    } finally {
      before.close();
    }
  } finally {
    await catalog?.close();
    await rm(root, { recursive: true });
  }
});
