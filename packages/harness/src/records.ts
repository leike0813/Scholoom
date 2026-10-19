import { join } from 'node:path';
import { OperationError } from '@scholoom/protocol/core';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { Consumption } from './checkpoint.js';
import * as schema from './schema.js';

/** Native adapter owns a connection and exposes only harness tables. */
export class HarnessRecords {
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

  confirmConsumption(sessionId: string, runId: string, value: Consumption): boolean {
    return this.db.transaction((tx) => {
      let changed = false;
      for (const id of value.instructionIds) {
        const instruction = tx
          .select()
          .from(schema.instructions)
          .where(eq(schema.instructions.id, id))
          .get();
        if (!instruction || instruction.sessionId !== sessionId)
          throw new OperationError('invalidRequest', '指令不属于当前执行。');
        if (instruction.consumed) continue;
        const message = tx.select().from(schema.messages).where(eq(schema.messages.id, id)).get();
        if (!message) throw new OperationError('unavailable', '指令消息缺失，停止确认。');
        tx.update(schema.instructions)
          .set({ consumed: true })
          .where(eq(schema.instructions.id, id))
          .run();
        tx.update(schema.messages)
          .set({ value: { ...message.value, state: 'consumed' } })
          .where(eq(schema.messages.id, id))
          .run();
        changed = true;
      }
      if (changed)
        tx.insert(schema.meta)
          .values({ key: `consumption:${runId}`, value: JSON.stringify(value) })
          .onConflictDoUpdate({ target: schema.meta.key, set: { value: JSON.stringify(value) } })
          .run();
      return changed;
    });
  }

  restore(projectId: string): void {
    this.db.transaction((tx) => {
      for (const row of tx.select().from(schema.sessions).all()) {
        tx.update(schema.sessions)
          .set({
            value: {
              ...row.value,
              projectId,
              state: ['running', 'queued', 'cancelling'].includes(row.value.state)
                ? 'interrupted'
                : row.value.state,
            },
          })
          .where(eq(schema.sessions.id, row.id))
          .run();
      }
      for (const row of tx.select().from(schema.runs).all()) {
        if (['running', 'queued', 'cancelling'].includes(row.value.state))
          tx.update(schema.runs)
            .set({ value: { ...row.value, state: 'interrupted', remoteOutcome: 'unknown' } })
            .where(eq(schema.runs.id, row.id))
            .run();
      }
      for (const row of tx.select().from(schema.instances).all())
        tx.update(schema.instances)
          .set({ value: { ...row.value, state: 'exited' } })
          .where(eq(schema.instances.id, row.id))
          .run();
    });
  }
}
