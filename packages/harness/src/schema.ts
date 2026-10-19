import type { Message, Run, Session } from '@scholoom/protocol/harness';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const meta = sqliteTable('harness_meta', {
  key: text().primaryKey(),
  value: text().notNull(),
});
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
export type RunInstance = {
  instanceId: string;
  runId: string;
  hostInstanceId: string;
  processId?: number;
  checkpointPath?: string;
  parentInstanceId?: string;
  state: 'starting' | 'running' | 'stopping' | 'exited';
};
export const instances = sqliteTable('run_instances', {
  id: text().primaryKey(),
  runId: text('run_id').notNull(),
  hostInstanceId: text('host_instance_id').notNull(),
  value: text({ mode: 'json' }).$type<RunInstance>().notNull(),
});
