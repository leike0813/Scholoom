import type {
  LibraryBatch,
  LibraryCollection,
  LibraryEntry,
  LibraryInputs,
  LibrarySource,
  OrganizationReceipt,
  OriginalRecord,
  ReadingRecord,
  RecordReceipt,
} from '@scholoom/protocol/library';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { StoredMaterial } from './material-files.js';
export type OrganizationFields = Partial<Pick<LibrarySource, 'tags' | 'collectionIds'>>;
export type OrganizationParticipant = {
  sourceId: string;
  beforeRevision: number;
  expectedRevision: number;
  before: OrganizationFields;
  after: OrganizationFields;
};
export type OrganizationEdit = {
  originLibraryId: string;
  createdAt: string;
  participants: OrganizationParticipant[];
  editRevision: number;
  position: 'applied' | 'undone' | 'unchanged';
  lastActionRequestId: string;
};

export type LibraryBatchRequest =
  | { kind: 'metadata'; input: LibraryInputs['library.ingest'] }
  | {
      kind: 'files';
      agent?: boolean;
      input: LibraryInputs['library.importFiles'] | LibraryInputs['library.importProjectFiles'];
    };

export const libraryMeta = sqliteTable('meta', {
  key: text().primaryKey(),
  value: text().notNull(),
});

export const sourceInstances = sqliteTable('source_instances', {
  id: text().primaryKey(),
  requestId: text().notNull().unique(),
  request: text().notNull(),
  label: text().notNull(),
});
export const originalRecords = sqliteTable(
  'original_records',
  {
    identity: text().primaryKey(),
    sourceId: text().notNull(),
    value: text({ mode: 'json' }).$type<OriginalRecord>().notNull(),
  },
  (t) => [index('original_source').on(t.sourceId, t.identity)],
);
export const citationKeys = sqliteTable('citation_keys', {
  sourceId: text().primaryKey(),
  normalized: text().notNull().unique(),
  value: text().notNull(),
  pinned: integer({ mode: 'boolean' }).notNull(),
});
export const recordOperations = sqliteTable('record_operations', {
  requestId: text().primaryKey(),
  request: text().notNull(),
  kind: text({ enum: ['authority', 'organization', 'organization-history'] })
    .notNull()
    .default('authority'),
  value: text({ mode: 'json' }).$type<RecordReceipt | OrganizationReceipt>().notNull(),
});
export const organizationEdits = sqliteTable('organization_edits', {
  requestId: text()
    .primaryKey()
    .references(() => recordOperations.requestId),
  value: text({ mode: 'json' }).$type<OrganizationEdit>().notNull(),
});
export const recordHistory = sqliteTable(
  'record_history',
  {
    seq: integer().primaryKey({ autoIncrement: true }),
    sourceId: text().notNull(),
    revision: integer().notNull(),
    kind: text({ enum: ['original', 'key'] }).notNull(),
    value: text({ mode: 'json' }).$type<unknown>(),
  },
  (t) => [index('record_history_source').on(t.sourceId, t.seq)],
);
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
    creation: text({ mode: 'json' }).$type<LibraryInputs['library.saveReadingRecord']>().notNull(),
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
