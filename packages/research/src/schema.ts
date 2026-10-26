import type { ResearchAttempt, ResearchGraphCall } from '@scholoom/protocol/research';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const attempts = sqliteTable('research_attempts', {
  id: text().primaryKey(),
  value: text({ mode: 'json' }).$type<ResearchAttempt | ResearchGraphCall>().notNull(),
});
export const isMaterialAttempt = (
  value: ResearchAttempt | ResearchGraphCall,
): value is ResearchAttempt => !('kind' in value);
