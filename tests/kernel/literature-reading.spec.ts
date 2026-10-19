import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LiteratureCatalog } from '../../packages/library/dist/node.js';
import { syntheticPdf } from '../pdf-fixture.js';

test('PDF reads without a window and version-bound page geometry protects annotations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-pdf-reading-'));
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const path = join(root, 'paper.pdf'),
      bytes = syntheticPdf();
    await writeFile(path, bytes);
    const batch = catalog.importFiles({
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'test',
    });
    await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const receipt = catalog.batch({ batchId: batch.id }).entries[0];
    assert(receipt?.sourceId);
    const attachment = (await catalog.attachments({ sourceId: receipt.sourceId })).attachments[0];
    assert(attachment);
    const ref = { attachmentId: attachment.id, materialVersionId: attachment.materialVersionId };
    expect(await catalog.pdfInfo(ref)).toMatchObject({ pageCount: 2 });
    const first = await catalog.readPdfPage({ ...ref, pageIndex: 0, limit: 8 });
    assert(first.nextOffset !== undefined);
    const rest = await catalog.readPdfPage({ ...ref, pageIndex: 0, offset: first.nextOffset });
    expect(first.text + rest.text).toBe('Scholoom PDF evidence 42');
    expect(await catalog.readPdfPage({ ...ref, pageIndex: 1 })).toMatchObject({
      text: 'Second page controlled result 73',
      width: 600,
      height: 400,
    });
    for (const input of [
      { ...ref, pageIndex: 2 },
      { ...ref, pageIndex: 0, offset: 1000 },
      { ...ref, pageIndex: -1 },
    ])
      await expect(catalog.readPdfPage(input)).rejects.toMatchObject({ code: 'invalidRequest' });
    const highlight = {
      ...ref,
      recordId: randomUUID(),
      kind: 'highlight' as const,
      quote: 'Scholoom PDF evidence 42',
      body: '',
      location: { pageIndex: 0, rects: [{ x: 72, y: 60, width: 145, height: 14 }] },
    };
    expect(await catalog.saveReadingRecord(highlight)).toMatchObject({
      location: highlight.location,
      revision: 1,
    });
    await expect(
      catalog.saveReadingRecord({
        ...highlight,
        recordId: randomUUID(),
        location: { pageIndex: 1, rects: [{ x: 590, y: 20, width: 20, height: 10 }] },
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    const bookmark = await catalog.saveReadingRecord({
      ...ref,
      recordId: randomUUID(),
      kind: 'bookmark',
      quote: '',
      body: 'Second page',
      location: { pageIndex: 1 },
    });
    expect(bookmark.location?.pageIndex).toBe(1);
    expect(await readFile(path)).toEqual(bytes);
    const reading = catalog.readPdfPage({ ...ref, pageIndex: 0 });
    catalog.grant({ read: false, write: false, send: false, autoBackup: false });
    await expect(reading).rejects.toMatchObject({ code: 'permissionDenied' });
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('v2 migration preserves existing library grants and keeps an independent pre-migration database', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-reading-v2-'));
  const catalog = new LiteratureCatalog(root, () => {});
  const require = createRequire(new URL('../../apps/kernel/package.json', import.meta.url));
  const Database = require('better-sqlite3');
  try {
    await mkdir(join(root, 'library'));
    const database = new Database(join(root, 'library', 'library.sqlite'));
    try {
      const folder = new URL('../../packages/library/src/migrations/', import.meta.url);
      const journal = JSON.parse(await readFile(new URL('meta/_journal.json', folder), 'utf8'));
      database.exec(
        'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)',
      );
      for (const entry of journal.entries.slice(0, 2)) {
        const sql = await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8');
        database.exec(sql);
        database
          .prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES(?,?)')
          .run(createHash('sha256').update(sql).digest('hex'), entry.when);
      }
      database
        .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
        .run('identity', 'controlled-v2-library');
      database
        .prepare('INSERT INTO meta(key,value) VALUES(?,?)')
        .run('grants', JSON.stringify({ read: true, write: true, send: true, autoBackup: false }));
      database.pragma('user_version=2');
    } finally {
      database.close();
    }
    await catalog.initialize();
    expect(catalog.status()).toMatchObject({
      id: 'controlled-v2-library',
      read: true,
      write: true,
      send: true,
    });
    const backup = new Database(join(root, 'library', 'before-migration-v2.sqlite'), {
      readonly: true,
    });
    try {
      expect(backup.pragma('user_version', { simple: true })).toBe(2);
      expect(backup.pragma('quick_check', { simple: true })).toBe('ok');
      expect(
        JSON.parse(backup.prepare("SELECT value FROM meta WHERE key='grants'").get().value),
      ).toMatchObject({ write: true, send: true });
    } finally {
      backup.close();
    }
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('shared reading notes retain authors and revisions across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-reading-'));
  const profile = join(root, 'profile');
  let catalog = new LiteratureCatalog(profile, () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const path = join(root, 'material.txt');
    await writeFile(path, 'Controlled original material');
    const batch = catalog.importFiles({
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'reading-test',
    });
    await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const receipt = catalog.batch({ batchId: batch.id }).entries[0];
    assert(receipt?.sourceId && receipt.attachmentId);
    const attachment = (await catalog.attachments({ sourceId: receipt.sourceId })).attachments[0];
    assert(attachment);
    const input = {
      recordId: randomUUID(),
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
      kind: 'note' as const,
      quote: '',
      body: 'User interpretation, separate from the source',
    };
    const first = await catalog.saveReadingRecord(input);
    expect(first).toMatchObject({ createdBy: { kind: 'user' }, revision: 1, body: input.body });
    const backup = await catalog.backup();
    const next = await catalog.saveReadingRecord(
      { ...input, expectedRevision: first.revision, body: 'Agent clarification' },
      { kind: 'agent', sessionId: 'controlled-session' },
    );
    expect(next).toMatchObject({
      createdBy: { kind: 'user' },
      updatedBy: { kind: 'agent', sessionId: 'controlled-session' },
      revision: 2,
    });
    await expect(
      catalog.saveReadingRecord({ ...input, expectedRevision: first.revision, body: 'Stale edit' }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(await catalog.saveReadingRecord(input)).toEqual(next);
    await catalog.close();
    catalog = new LiteratureCatalog(profile, () => {});
    await catalog.initialize();
    expect(catalog.readingRecord(input.recordId)).toEqual(next);
    expect(
      catalog.readingRecords({
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      }).records,
    ).toEqual([next]);
    expect(catalog.readingHistory({ recordId: input.recordId }).records).toEqual([first]);
    const restored = await catalog.restore(backup.id, join(root, 'restored'));
    const copy = new LiteratureCatalog(restored.directory, () => {});
    try {
      await copy.initialize();
      expect(copy.readingRecord(input.recordId)).toEqual(first);
      expect(copy.status()).toMatchObject({ write: false, send: false });
      const bytes = await copy.readAttachment({ attachmentId: attachment.id });
      expect(Buffer.from(bytes.base64, 'base64')).toEqual(await readFile(path));
      expect(catalog.readingRecord(input.recordId)).toEqual(next);
    } finally {
      await copy.close();
    }
    const removed = catalog.removeReadingRecord({ recordId: input.recordId, expectedRevision: 2 });
    expect(removed).toMatchObject({ deleted: true, revision: 3 });
    expect(
      catalog.readingRecords({
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      }).records,
    ).toEqual([]);
    await expect(
      catalog.saveReadingRecord({ ...input, expectedRevision: 2 }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(await catalog.saveReadingRecord(input)).toEqual(removed);
    expect(await readFile(path, 'utf8')).toBe('Controlled original material');
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('missing material retains excerpts without accepting changed evidence or version rebinding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-reading-linked-'));
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  try {
    await catalog.initialize();
    catalog.grant({ read: true, write: true, send: false, autoBackup: false });
    const path = join(root, 'material.txt');
    await writeFile(path, 'Old source excerpt');
    const batch = catalog.importFiles({
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      storage: 'linked',
      version: 'unspecified',
      origin: 'reading-test',
    });
    await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
    const receipt = catalog.batch({ batchId: batch.id }).entries[0];
    assert(receipt?.sourceId && receipt.attachmentId);
    const attachment = (await catalog.attachments({ sourceId: receipt.sourceId })).attachments[0];
    assert(attachment);
    const input = {
      recordId: randomUUID(),
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
      kind: 'note' as const,
      quote: 'Old source excerpt',
      body: 'Interpretation',
    };
    await catalog.saveReadingRecord(input);
    await rename(path, join(root, 'moved.txt'));
    const updated = await catalog.saveReadingRecord({
      ...input,
      expectedRevision: 1,
      body: 'Reconsidered interpretation',
    });
    expect(updated.quote).toBe('Old source excerpt');
    await expect(
      catalog.saveReadingRecord({ ...input, expectedRevision: 2, quote: 'Invented new quote' }),
    ).rejects.toBeDefined();
    expect(catalog.readingRecord(input.recordId)).toEqual(updated);
    await expect(
      catalog.saveReadingRecord({ ...input, materialVersionId: randomUUID(), expectedRevision: 2 }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    catalog.grant({ read: true, write: false, send: false, autoBackup: false });
    await expect(
      catalog.saveReadingRecord({ ...input, expectedRevision: 2 }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    catalog.grant({ read: false, write: false, send: false, autoBackup: false });
    expect(() => catalog.readingRecord(input.recordId)).toThrow();
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});
