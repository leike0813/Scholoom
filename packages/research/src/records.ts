import { join } from 'node:path';
import Database from 'better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export class ResearchRecords {
  private readonly database: Database.Database;
  readonly db;
  constructor(internal: string) {
    this.database = new Database(join(internal, 'project.sqlite'), { fileMustExist: true });
    this.database.pragma('busy_timeout = 1000');
    this.db = drizzle(this.database, { schema });
  }
  close(): void {
    this.database.close();
  }
  restore(): void {
    this.db.transaction((tx) => {
      for (const row of tx
        .select()
        .from(schema.attempts)
        .where(sql`json_extract(${schema.attempts.value}, '$.state') = 'running'`)
        .all())
        tx.update(schema.attempts)
          .set({
            value: {
              ...row.value,
              state: 'interrupted',
              delivery: 'incomplete',
              finishedAt: new Date().toISOString(),
              issues: [...row.value.issues, 'interrupted: 从备份副本恢复，请核对已保存成果。'],
            },
          })
          .where(eq(schema.attempts.id, row.id))
          .run();
    });
  }
}
