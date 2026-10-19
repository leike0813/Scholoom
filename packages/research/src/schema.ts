import type { ResearchAttempt } from '@scholoom/protocol/research';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const attempts = sqliteTable('research_attempts', {
  id: text().primaryKey(),
  value: text({ mode: 'json' }).$type<ResearchAttempt>().notNull(),
});
