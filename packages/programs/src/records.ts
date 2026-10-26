import { join } from 'node:path';
import { compileContract, type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import {
  type ProgramLogEntry,
  type ProgramRun,
  programLogEntrySchema,
  programRunSchema,
} from '@scholoom/protocol/programs';
import type { ResourceEvidence } from '@scholoom/protocol/resources';
import Database from 'better-sqlite3';

export type StoredProgramRun = {
  run: ProgramRun;
  entries: ProgramLogEntry[];
  commandInstanceId?: string;
  hostInstanceId?: string;
  lastEventSeq?: number;
  historical?: boolean;
  requestKey?: string;
};

const validRecord = compileContract({
  params: {
    type: 'object',
    properties: {
      run: programRunSchema,
      entries: { type: 'array', items: programLogEntrySchema },
      commandInstanceId: programRunSchema.properties.programRunId,
      hostInstanceId: programRunSchema.properties.programRunId,
      lastEventSeq: programLogEntrySchema.properties.seq,
      historical: { type: 'boolean' },
      requestKey: { type: 'string' },
    },
    required: ['run', 'entries'],
    additionalProperties: false,
  },
  result: true,
}).params;
const terminal = ['completed', 'failed', 'cancelled', 'interrupted'];
type Row = { id: string; created_at: string; value: string };

function validate(value: unknown, code: ErrorInfo['code']): asserts value is StoredProgramRun {
  if (!validRecord(value)) throw new OperationError(code, '程序运行记录不符合契约。');
}

export class ProgramRecords {
  private readonly database: Database.Database;

  constructor(internal: string) {
    this.database = new Database(join(internal, 'project.sqlite'), { fileMustExist: true });
    this.database.pragma('busy_timeout = 1000');
  }

  private decode(row: Row): StoredProgramRun {
    let value: unknown;
    try {
      value = JSON.parse(row.value);
    } catch {
      throw new OperationError('unavailable', '程序运行记录 JSON 已损坏。');
    }
    validate(value, 'unavailable');
    if (value.run.programRunId !== row.id || value.run.createdAt !== row.created_at)
      throw new OperationError('unavailable', '程序运行记录身份或创建时间不一致。');
    return value;
  }

  get(id: string): StoredProgramRun {
    const row = this.database
      .prepare('SELECT id, created_at, value FROM program_runs WHERE id = ?')
      .get(id) as Row | undefined;
    if (!row) throw new OperationError('notFound', '程序运行记录不存在。');
    return this.decode(row);
  }

  findOperation(
    operationId: string,
    principal: NonNullable<ProgramRun['principal']>,
  ): StoredProgramRun | undefined {
    const rows = this.database
      .prepare(`SELECT id, created_at, value FROM program_runs
        WHERE json_extract(value, '$.run.operationId') = ?
          AND json_extract(value, '$.run.principal.kind') = ?
          AND json_extract(value, '$.run.principal.id') = ?
        LIMIT 2`)
      .all(operationId, principal.kind, principal.id) as Row[];
    if (rows.length > 1)
      throw new OperationError('unavailable', '同一主体的操作身份对应多个程序运行。');
    return rows[0] ? this.decode(rows[0]) : undefined;
  }

  put(record: StoredProgramRun): void {
    validate(record, 'invalidRequest');
    this.database
      .transaction(() => {
        const { run } = record;
        const previous = this.database
          .prepare('SELECT id, created_at, value FROM program_runs WHERE id = ?')
          .get(run.programRunId) as Row | undefined;
        if (previous) {
          const stored = this.decode(previous);
          if (stored.run.projectId !== run.projectId || stored.run.createdAt !== run.createdAt)
            throw new OperationError('invalidRequest', '不能覆盖其他项目或创建身份的程序运行。');
        }
        const operation = run.principal && this.findOperation(run.operationId, run.principal);
        if (operation && operation.run.programRunId !== run.programRunId)
          throw new OperationError('invalidRequest', '操作身份已用于另一个程序运行。');
        this.database
          .prepare(`INSERT INTO program_runs (id, created_at, value) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value = excluded.value`)
          .run(run.programRunId, run.createdAt, JSON.stringify(record));
      })
      .immediate();
  }

  list(before?: string, limit = 25): { runs: ProgramRun[]; before?: string } {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new OperationError('invalidRequest', '程序运行分页大小须在 1 到 100 之间。');
    const rows = (
      before === undefined
        ? this.database
            .prepare('SELECT id, created_at, value FROM program_runs ORDER BY id DESC LIMIT ?')
            .all(limit + 1)
        : this.database
            .prepare(
              'SELECT id, created_at, value FROM program_runs WHERE id < ? ORDER BY id DESC LIMIT ?',
            )
            .all(before, limit + 1)
    ) as Row[];
    const runs = rows.slice(0, limit).map((row) => {
      const run = this.decode(row).run;
      return {
        programRunId: run.programRunId,
        projectId: run.projectId,
        operationId: run.operationId,
        kind: run.kind,
        state: run.state,
        phase: run.phase,
        stop: run.stop,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        ...(run.environmentId ? { environmentId: run.environmentId } : {}),
        ...(run.origin ? { origin: run.origin } : {}),
        ...(run.backgroundOwner ? { backgroundOwner: run.backgroundOwner } : {}),
        ...(run.exit ? { exit: run.exit } : {}),
        ...(run.error
          ? { error: { code: run.error.code, message: run.error.message.slice(0, 1024) } }
          : {}),
      };
    });
    const last = runs.at(-1);
    return { runs, ...(rows.length > limit && last ? { before: last.programRunId } : {}) };
  }

  unfinished(): StoredProgramRun[] {
    const rows = this.database
      .prepare(`SELECT id, created_at, value FROM program_runs
        WHERE json_type(value, '$.historical') IS NOT 'true'
          AND COALESCE(json_extract(value, '$.run.state'), '')
            NOT IN (${terminal.map(() => '?').join(', ')})
        ORDER BY id DESC LIMIT 101`)
      .all(...terminal) as Row[];
    if (rows.length > 100)
      throw new OperationError('resourceLimit', '未结束程序运行超过 100 条，无法完整核查。');
    return rows.map((row) => this.decode(row));
  }

  restore(projectId: string): void {
    const rebind = (evidence: ResourceEvidence | undefined): void => {
      if (evidence?.ref.source === 'project') evidence.ref.projectId = projectId;
    };
    this.database
      .transaction(() => {
        let row = this.database
          .prepare('SELECT id, created_at, value FROM program_runs ORDER BY id LIMIT 1')
          .get() as Row | undefined;
        const next = this.database.prepare(
          'SELECT id, created_at, value FROM program_runs WHERE id > ? ORDER BY id LIMIT 1',
        );
        while (row) {
          const record = this.decode(row);
          const { run } = record;
          run.projectId = projectId;
          if (run.request) {
            run.request.projectId = projectId;
            rebind(run.request.entry);
            run.request.inputs?.forEach(rebind);
          }
          rebind(run.code);
          run.inputs?.forEach(rebind);
          for (const output of run.outputs ?? []) {
            rebind(output.resource);
            rebind(output.before);
          }
          if (!terminal.includes(run.state)) {
            run.state = 'interrupted';
            run.stop = 'unknown';
            run.updatedAt = new Date().toISOString();
          }
          record.historical = true;
          delete record.commandInstanceId;
          delete record.hostInstanceId;
          delete record.lastEventSeq;
          validate(record, 'invalidRequest');
          this.database
            .prepare('UPDATE program_runs SET value = ? WHERE id = ?')
            .run(JSON.stringify(record), row.id);
          row = next.get(row.id) as Row | undefined;
        }
      })
      .immediate();
  }

  close(): void {
    this.database.close();
  }
}
