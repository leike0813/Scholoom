import type {
  BusinessParams,
  LibraryBatch,
  LibraryCollection,
  LibraryEntry,
  LibrarySource,
  ReadingRecord,
} from '@scholoom/protocol';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { StoredMaterial } from '../literature/material-files.js';

export type LibraryBatchRequest =
  | { kind: 'metadata'; input: BusinessParams<'library.ingest'> }
  | {
      kind: 'files';
      input: BusinessParams<'library.importFiles'> | BusinessParams<'library.importProjectFiles'>;
    };

export const libraryMeta = sqliteTable('meta', {
  key: text().primaryKey(),
  value: text().notNull(),
});
export const sources = sqliteTable(
  'sources',
  {
    id: text().primaryKey(),
    doi: text(),
    version: text().notNull(),
    value: text({ mode: 'json' }).$type<LibrarySource>().notNull(),
  },
  (t) => [
    uniqueIndex('source_doi_version')
      .on(t.doi, t.version)
      .where(sql`${t.doi} is not null AND ${t.version} != 'unspecified'`),
  ],
);
export const collections = sqliteTable('collections', {
  id: text().primaryKey(),
  value: text({ mode: 'json' }).$type<LibraryCollection>().notNull(),
});
export const batches = sqliteTable('batches', {
  id: text().primaryKey(),
  value: text({ mode: 'json' }).$type<LibraryBatch>().notNull(),
  request: text({ mode: 'json' }).$type<LibraryBatchRequest>().notNull(),
});
export const entries = sqliteTable(
  'entries',
  {
    seq: integer().primaryKey({ autoIncrement: true }),
    batchId: text().notNull(),
    position: integer().notNull(),
    input: text({ mode: 'json' }).$type<unknown>(),
    value: text({ mode: 'json' }).$type<LibraryEntry>().notNull(),
  },
  (t) => [uniqueIndex('batch_position').on(t.batchId, t.position)],
);
export const history = sqliteTable(
  'history',
  {
    seq: integer().primaryKey({ autoIncrement: true }),
    sourceId: text().notNull(),
    value: text({ mode: 'json' }).$type<LibrarySource>().notNull(),
  },
  (t) => [index('source_history').on(t.sourceId)],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text().primaryKey(),
    sourceId: text().notNull(),
    purpose: text().notNull(),
    storage: text().notNull(),
    hash: text().notNull(),
    value: text({ mode: 'json' }).$type<StoredMaterial>().notNull(),
  },
  (t) => [
    index('attachment_source').on(t.sourceId),
    uniqueIndex('attachment_content').on(t.sourceId, t.purpose, t.storage, t.hash),
  ],
);

export const readingRecords = sqliteTable(
  'reading_records',
  {
    id: text().primaryKey(),
    attachmentId: text().notNull(),
    materialVersionId: text().notNull(),
    deleted: integer({ mode: 'boolean' }).notNull(),
    value: text({ mode: 'json' }).$type<ReadingRecord>().notNull(),
    creation: text({ mode: 'json' }).$type<BusinessParams<'library.saveReadingRecord'>>().notNull(),
    createdBy: text({ mode: 'json' }).$type<ReadingRecord['createdBy']>().notNull(),
  },
  (t) => [index('reading_material').on(t.attachmentId, t.materialVersionId, t.id)],
);

export const readingHistory = sqliteTable(
  'reading_history',
  {
    seq: integer().primaryKey({ autoIncrement: true }),
    recordId: text().notNull(),
    value: text({ mode: 'json' }).$type<ReadingRecord>().notNull(),
  },
  (t) => [index('reading_history_record').on(t.recordId, t.seq)],
);
