import { randomUUID } from 'node:crypto';
import { chmod, cp, link, lstat, rename, rm, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { privateDirectory } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import Database from 'better-sqlite3';

const exists = async (path: string) => {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new OperationError('permissionDenied', 'Checkpoint资源不安全。');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

export const sessionScratch = (internal: string, sessionId: string): string =>
  join(internal, 'harness', 'sessions', encodeURIComponent(sessionId), 'scratch');

/** Existing sessions may retain legacy shared bytes; new sessions start in their own empty scope. */
export async function prepareScratch(
  path: string,
  legacyRoot: string,
  inherit: boolean,
): Promise<void> {
  const directory = async (root: string): Promise<boolean> => {
    try {
      const stat = await lstat(root);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new OperationError('permissionDenied', '临时上下文资源不安全。');
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  };
  path = resolve(path);
  const parent = dirname(path);
  let ancestor = resolve(dirname(legacyRoot));
  const target = relative(ancestor, path);
  if (isAbsolute(target) || target === '..' || target.startsWith(`..${sep}`))
    throw new OperationError('permissionDenied', '临时上下文超出所属目录。');
  const local = relative(ancestor, parent);
  if (
    isAbsolute(local) ||
    local === '..' ||
    local.startsWith(`..${sep}`) ||
    !(await directory(ancestor))
  )
    throw new OperationError('permissionDenied', '临时上下文超出所属目录。');
  for (const segment of local.split(/[\\/]/).filter(Boolean)) {
    ancestor = join(ancestor, segment);
    if (!(await directory(ancestor))) await privateDirectory(ancestor);
  }
  if (await directory(path)) return;
  if (!inherit || !(await directory(legacyRoot))) {
    await privateDirectory(path);
    return;
  }
  const temporary = join(dirname(path), `.scratch-${randomUUID()}`);
  try {
    await cp(legacyRoot, temporary, {
      recursive: true,
      filter: async (source) => {
        const stat = await lstat(source);
        if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
          throw new OperationError('permissionDenied', '旧临时上下文包含不安全资源。');
        return true;
      },
    });
    await privateDirectory(temporary);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function claimCheckpoints(internal: string, runIds: string[]): Promise<() => void> {
  const directory = join(internal, 'harness', 'checkpoints');
  await privateDirectory(directory);
  const locks: Database.Database[] = [];
  try {
    for (const id of [...new Set(runIds)].sort()) {
      const path = join(directory, `${encodeURIComponent(id)}.lock.sqlite`);
      await exists(path);
      const lock = new Database(path, { timeout: 0 });
      locks.push(lock);
      await chmod(path, 0o600);
      lock.exec('BEGIN EXCLUSIVE');
    }
    return () => {
      for (const lock of locks) if (lock.open) lock.close();
    };
  } catch {
    for (const lock of locks) if (lock.open) lock.close();
    throw new OperationError('unavailable', 'Checkpoint仍由其他执行持有，停止相关接续。');
  }
}

export async function openCheckpoint(
  internal: string,
  runId: string,
  predecessor?: string,
): Promise<{ database: Database.Database; path: string; imported: boolean; issue?: string }> {
  const directory = join(internal, 'harness', 'checkpoints');
  await privateDirectory(directory);
  const path = join(directory, `${encodeURIComponent(runId)}.sqlite`);
  if (await exists(path)) {
    let db: Database.Database | undefined;
    try {
      db = new Database(path, { fileMustExist: true });
      if (db.pragma('quick_check', { simple: true }) !== 'ok')
        throw new Error('corrupt checkpoint');
      return { database: db, path, imported: true };
    } catch (error) {
      db?.close();
      throw new OperationError(
        'unavailable',
        `私有Checkpoint不可用，已保留原件：${error instanceof Error ? error.message : '读取失败'}`,
      );
    }
  }
  const thread = predecessor ?? runId;
  const candidates = [
    join(directory, `${encodeURIComponent(thread)}.sqlite`),
    join(internal, `checkpoints-${encodeURIComponent(thread)}.sqlite`),
    join(internal, 'checkpoints.sqlite'),
  ];
  const temporary = join(directory, `.checkpoint-${randomUUID()}.sqlite`);
  const database = new Database(temporary);
  let imported = false;
  let issue: string | undefined;
  try {
    // Initializes the locked dependency's exact schema, including pending-write ordering fields.
    await new SqliteSaver(database).getTuple({ configurable: { thread_id: runId } });
    for (const source of candidates) {
      if (source === path || !(await exists(source))) continue;
      let legacy: Database.Database | undefined;
      let writerGuard: Database.Database | undefined;
      try {
        writerGuard = new Database(source, { fileMustExist: true, timeout: 0 });
        // Reserve SQLite's writer slot without changing source data; old writers must be excluded.
        writerGuard.exec('BEGIN IMMEDIATE');
        legacy = new Database(source, { readonly: true, fileMustExist: true });
        if (legacy.pragma('quick_check', { simple: true }) !== 'ok')
          throw new Error('corrupt checkpoint');
        if (!legacy.prepare("SELECT name FROM sqlite_master WHERE name='checkpoints'").get())
          continue;
        const has = legacy
          .prepare('SELECT 1 FROM checkpoints WHERE thread_id=? LIMIT 1')
          .get(thread);
        if (!has) continue;
        const columns = legacy.prepare('PRAGMA table_info(writes)').all() as { name: string }[];
        const hasWrites = columns.length > 0;
        legacy.exec('BEGIN');
        const checkpoints = legacy.prepare(
          `SELECT ? AS thread_id,checkpoint_ns,checkpoint_id,parent_checkpoint_id,type,checkpoint,metadata FROM checkpoints WHERE thread_id=?`,
        );
        const checkpointInsert =
          database.prepare(`INSERT INTO checkpoints (thread_id,checkpoint_ns,checkpoint_id,parent_checkpoint_id,type,checkpoint,metadata)
          VALUES (@thread_id,@checkpoint_ns,@checkpoint_id,@parent_checkpoint_id,@type,@checkpoint,@metadata)`);
        const writes = hasWrites
          ? legacy.prepare(
              `SELECT ? AS thread_id,checkpoint_ns,checkpoint_id,task_id,${columns.some((col) => col.name === 'task_path') ? 'task_path' : "'' AS task_path"},idx,channel,type,value FROM writes WHERE thread_id=?`,
            )
          : undefined;
        const writeInsert =
          database.prepare(`INSERT INTO writes (thread_id,checkpoint_ns,checkpoint_id,task_id,task_path,idx,channel,type,value)
          VALUES (@thread_id,@checkpoint_ns,@checkpoint_id,@task_id,@task_path,@idx,@channel,@type,@value)`);
        database.transaction(() => {
          for (const row of checkpoints.iterate(runId, thread)) checkpointInsert.run(row);
          for (const row of writes?.iterate(runId, thread) ?? []) writeInsert.run(row);
        })();
        imported = true;
        break;
      } catch (error) {
        if ((error as { code?: string }).code?.startsWith('SQLITE_BUSY'))
          throw new OperationError(
            'instanceMismatch',
            '旧Checkpoint仍有活动写者，停止导入及接续。',
          );
        issue = error instanceof Error ? error.message : 'Checkpoint导入失败。';
      } finally {
        legacy?.close();
        writerGuard?.close();
      }
    }
    database.pragma('wal_checkpoint(TRUNCATE)');
    database.close();
    await chmod(temporary, 0o600);
    await link(temporary, path);
  } catch (error) {
    if (database.open) database.close();
    await rename(temporary, `${temporary}.unusable`).catch(() => {});
    throw error;
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return { database: new Database(path), path, imported, ...(issue ? { issue } : {}) };
}
