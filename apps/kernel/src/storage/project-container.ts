import { randomUUID } from 'node:crypto';
import { chmod, link, lstat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const migrationsFolder = fileURLToPath(new URL('./migrations/', import.meta.url));
const harnessKeys =
  "key LIKE 'tool:%' OR key LIKE 'delivered:%' OR key LIKE 'library-context:%' OR key LIKE 'checkpoint-isolated:%'";

/** Physical container upgrade; domain adapters only open their own tables afterwards. */
export async function initializeProjectContainer(
  database: Database.Database,
  internal: string,
): Promise<void> {
  const version = database.pragma('user_version', { simple: true }) as number;
  if (version > 6) throw new Error('Newer database');
  if (version < 5) await initializeDelegationContainer(database, internal);
  // v5 has one meaning: the reviewed delegations migration, never the unpublished program-only draft.
  database
    .prepare(
      'SELECT seq,id,session_id,parent_run_id,child_instance_id,value FROM delegations LIMIT 0',
    )
    .all();
  if (
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='delegations' AND name IN ('delegations_session','delegations_parent')",
      )
      .all().length !== 2
  )
    throw new Error('Invalid v5 delegation schema; preserve the original profile for inspection');
  if (version === 6) {
    database.prepare('SELECT id,created_at,value FROM program_runs LIMIT 0').all();
    return;
  }
  if (version > 0) {
    const source = join(internal, 'before-migration-v6.sqlite');
    try {
      const info = await lstat(source);
      if (!info.isFile() || info.isSymbolicLink())
        throw new Error('Unsafe program migration backup');
      const saved = new Database(source, { readonly: true, fileMustExist: true });
      try {
        if (
          saved.pragma('user_version', { simple: true }) !== 5 ||
          saved.pragma('quick_check', { simple: true }) !== 'ok'
        )
          throw new Error('Invalid program migration backup');
      } finally {
        saved.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const temporary = join(internal, `.migration-${randomUUID()}.sqlite`);
      try {
        await database.backup(temporary);
        await chmod(temporary, 0o600);
        await link(temporary, source);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    }
  }
  database.transaction(() => {
    database.exec(
      'CREATE TABLE program_runs (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, value TEXT NOT NULL); PRAGMA user_version = 6;',
    );
  })();
}

async function initializeDelegationContainer(
  database: Database.Database,
  internal: string,
): Promise<void> {
  const version = database.pragma('user_version', { simple: true }) as number;
  if (version > 5) throw new Error('Newer database');
  if (version === 5) return;
  await initializeTrustContainer(database, internal);
  if (version > 0) {
    const source = join(internal, 'before-migration-v5.sqlite');
    try {
      const info = await lstat(source);
      if (!info.isFile() || info.isSymbolicLink())
        throw new Error('Unsafe delegation migration backup');
      const saved = new Database(source, { readonly: true, fileMustExist: true });
      try {
        if (
          saved.pragma('user_version', { simple: true }) !== 4 ||
          saved.pragma('quick_check', { simple: true }) !== 'ok'
        )
          throw new Error('Invalid delegation migration backup');
      } finally {
        saved.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const temporary = join(internal, `.migration-${randomUUID()}.sqlite`);
      try {
        await database.backup(temporary);
        await chmod(temporary, 0o600);
        await link(temporary, source);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    }
  }
  database.transaction(() => {
    database.exec(`CREATE TABLE delegations (
      seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      id TEXT NOT NULL UNIQUE, session_id TEXT NOT NULL,
      parent_run_id TEXT NOT NULL, child_instance_id TEXT NOT NULL UNIQUE, value TEXT NOT NULL
    );
    CREATE INDEX delegations_session ON delegations(session_id, seq);
    CREATE INDEX delegations_parent ON delegations(parent_run_id);
    PRAGMA user_version = 5;`);
  })();
}

async function initializeTrustContainer(
  database: Database.Database,
  internal: string,
): Promise<void> {
  const version = database.pragma('user_version', { simple: true }) as number;
  if (version > 4) throw new Error('Newer database');
  if (version === 4) return;
  await initializeLegacyContainer(database, internal);
  if (version > 0) {
    const source = join(internal, 'before-migration-v4.sqlite');
    try {
      const info = await lstat(source);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe migration backup');
      const saved = new Database(source, { readonly: true, fileMustExist: true });
      try {
        if (
          saved.pragma('user_version', { simple: true }) !== 3 ||
          saved.pragma('quick_check', { simple: true }) !== 'ok'
        )
          throw new Error('Invalid trust migration backup');
      } finally {
        saved.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const temporary = join(internal, `.migration-${randomUUID()}.sqlite`);
      try {
        await database.backup(temporary);
        await chmod(temporary, 0o600);
        await link(temporary, source);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    }
  }
  database.transaction(() => {
    const old = database.prepare("SELECT value FROM meta WHERE key='grants'").get() as
      | { value: string }
      | undefined;
    const autoBackup = old ? JSON.parse(old.value).autoBackup !== false : true;
    database
      .prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('grants',?)")
      .run(JSON.stringify({ trust: 'pending', autoBackup }));
    database.pragma('user_version = 4');
  })();
}

async function initializeLegacyContainer(
  database: Database.Database,
  internal: string,
): Promise<void> {
  const version = database.pragma('user_version', { simple: true }) as number;
  if (version > 3) throw new Error('Newer database');
  if (version < 2) {
    if (database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length)
      await database.backup(join(internal, 'before-migration.sqlite'));
    migrate(drizzle(database), { migrationsFolder });
    if (version === 1) {
      const old = database.prepare("SELECT value FROM meta WHERE key='grants'").get() as
        | { value: string }
        | undefined;
      if (old)
        database
          .prepare("UPDATE meta SET value=? WHERE key='grants'")
          .run(JSON.stringify({ ...JSON.parse(old.value), write: false }));
    }
    database.pragma('user_version = 2');
  }
  if (version >= 3) return;
  // Keep this version-specific source intact across retries of an interrupted upgrade.
  const source = join(internal, 'before-migration-v3.sqlite');
  let existing = false;
  try {
    const stat = await lstat(source);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Unsafe migration backup');
    const backup = new Database(source, { readonly: true, fileMustExist: true });
    try {
      if (
        backup.pragma('user_version', { simple: true }) !== 2 ||
        backup.pragma('quick_check', { simple: true }) !== 'ok'
      )
        throw new Error('Invalid migration backup');
    } finally {
      backup.close();
    }
    existing = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!existing) {
    const temporary = join(internal, `.migration-${randomUUID()}.sqlite`);
    try {
      await database.backup(temporary);
      await chmod(temporary, 0o600);
      await link(temporary, source);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
  database.transaction(() => {
    database.exec(`
      CREATE TABLE harness_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE research_attempts (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE run_instances (id TEXT PRIMARY KEY NOT NULL, run_id TEXT NOT NULL,
        host_instance_id TEXT NOT NULL, value TEXT NOT NULL);
      INSERT INTO harness_meta SELECT key, value FROM meta WHERE ${harnessKeys};
    `);
    const attempts = database
      .prepare("SELECT key, value FROM meta WHERE key LIKE 'research-attempt:%'")
      .all() as { key: string; value: string }[];
    const insert = database.prepare('INSERT INTO research_attempts (id,value) VALUES (?,?)');
    for (const row of attempts) {
      const parsed: unknown = JSON.parse(row.value);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('id' in parsed) ||
        parsed.id !== row.key.slice('research-attempt:'.length)
      )
        throw new Error('Invalid research identity');
      insert.run(parsed.id, row.value);
    }
    if (
      database
        .prepare(
          `SELECT key,value FROM meta WHERE ${harnessKeys} EXCEPT SELECT key,value FROM harness_meta`,
        )
        .get()
    )
      throw new Error('Harness migration incomplete');
    if (
      database
        .prepare(
          "SELECT substr(key,18),value FROM meta WHERE key LIKE 'research-attempt:%' EXCEPT SELECT id,value FROM research_attempts",
        )
        .get()
    )
      throw new Error('Research migration incomplete');
    database.exec(`DELETE FROM meta WHERE ${harnessKeys};
      DELETE FROM meta WHERE key LIKE 'research-attempt:%';
      PRAGMA user_version = 3;`);
  })();
}
