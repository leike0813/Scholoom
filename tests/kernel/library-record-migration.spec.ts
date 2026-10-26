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

async function createVersion3(root: string): Promise<string> {
  const profile = join(root, 'profile');
  const migrationsFolder = join(root, 'v3-migrations');
  const original = new URL('../../packages/library/src/migrations/', import.meta.url);
  const journal = JSON.parse(await readFile(new URL('meta/_journal.json', original), 'utf8'));
  const entries = journal.entries.slice(0, 3) as { tag: string }[];
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
      database.pragma('user_version = 3');
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
    const profile = await createVersion3(root);
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
      expect(current.pragma('user_version', { simple: true })).toBe(4);
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
      database.pragma('user_version = 5');
    } finally {
      database.close();
    }
    await expect(catalog.initialize()).rejects.toMatchObject({ code: 'unavailable' });
    const preserved = new Database(path, { readonly: true, fileMustExist: true });
    try {
      expect(preserved.pragma('user_version', { simple: true })).toBe(5);
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
