import type { Artifact, FileEdit, Message, Run, Session } from '@scholoom/protocol';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const meta = sqliteTable('meta', { key: text().primaryKey(), value: text().notNull() });
export const sessions = sqliteTable('sessions', {
  id: text().primaryKey(),
  value: text({ mode: 'json' }).$type<Session>().notNull(),
});
export const messages = sqliteTable('messages', {
  seq: integer().primaryKey({ autoIncrement: true }),
  id: text().notNull().unique(),
  sessionId: text().notNull(),
  value: text({ mode: 'json' }).$type<Message>().notNull(),
});
export const instructions = sqliteTable('instructions', {
  seq: integer().primaryKey({ autoIncrement: true }),
  id: text().notNull().unique(),
  sessionId: text().notNull(),
  runId: text().notNull(),
  consumed: integer({ mode: 'boolean' }).notNull().default(false),
});
export const runs = sqliteTable('runs', {
  id: text().primaryKey(),
  sessionId: text().notNull(),
  value: text({ mode: 'json' }).$type<Run>().notNull(),
});
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
