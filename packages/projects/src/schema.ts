import type { Artifact, FileEdit, FileLocation, FileOperation } from '@scholoom/protocol/projects';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const meta = sqliteTable('meta', { key: text().primaryKey(), value: text().notNull() });
export const edits = sqliteTable('edits', {
  seq: integer().primaryKey({ autoIncrement: true }),
  id: text().notNull().unique(),
  path: text().notNull(),
  value: text({ mode: 'json' }).$type<FileEdit>().notNull(),
});
export const artifacts = sqliteTable('artifacts', {
  key: text().primaryKey(),
  sessionId: text().notNull(),
  value: text({ mode: 'json' }).$type<Artifact>().notNull(),
});

export const fileReferences = sqliteTable(
  'file_references',
  {
    id: text().primaryKey(),
    path: text().notNull(),
    value: text({ mode: 'json' }).$type<FileLocation>().notNull(),
  },
  (table) => [
    index('file_references_path').on(table.path),
    uniqueIndex('file_references_present_path')
      .on(table.path)
      .where(sql`json_extract(${table.value}, '$.state') = 'present'`),
  ],
);
export const fileOperations = sqliteTable('file_operations', {
  id: text().primaryKey(),
  value: text({ mode: 'json' }).$type<FileOperation>().notNull(),
  details: text({ mode: 'json' })
    .$type<{
      params: string;
      source: string;
      destination: string;
      device: string;
      inode: string;
      birthtime: number;
      references?: { fileId: string; path: string }[];
    }>()
    .notNull(),
});
