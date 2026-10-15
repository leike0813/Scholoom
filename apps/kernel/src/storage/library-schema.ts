import type {
  BusinessParams,
  LibraryBatch,
  LibraryCollection,
  LibraryEntry,
  LibrarySource,
} from '@scholoom/protocol';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  request: text({ mode: 'json' }).$type<BusinessParams<'library.ingest'>>().notNull(),
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
