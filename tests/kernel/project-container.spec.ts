import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

async function legacy() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-container-'));
  const db = new Database(join(root, 'project.sqlite'));
  for (const name of ['0000_lyrical_network.sql', '0001_project_files.sql'])
    db.exec(
      await readFile(
        new URL(`../../apps/kernel/src/storage/migrations/${name}`, import.meta.url),
        'utf8',
      ),
    );
  db.pragma('user_version = 2');
  return {
    root,
    db,
    close: async () => {
      if (db.open) db.close();
      await rm(root, { recursive: true });
    },
  };
}

test('v4 delegation upgrade preserves trust and the protected source across reopen', async () => {
  const f = await legacy();
  const grants = JSON.stringify({ trust: 'trusted', autoBackup: false });
  try {
    f.db.pragma('user_version = 4');
    f.db.prepare('INSERT INTO meta(key,value) VALUES (?,?)').run('grants', grants);
    await initializeProjectContainer(f.db, f.root);
    expect(f.db.pragma('user_version', { simple: true })).toBe(6);
    expect(f.db.prepare("SELECT value FROM meta WHERE key='grants'").get()).toEqual({
      value: grants,
    });
    const source = new Database(join(f.root, 'before-migration-v5.sqlite'), { readonly: true });
    try {
      expect(source.pragma('user_version', { simple: true })).toBe(4);
      expect(source.prepare("SELECT value FROM meta WHERE key='grants'").get()).toEqual({
        value: grants,
      });
    } finally {
      source.close();
    }
    f.db
      .prepare(
        'INSERT INTO delegations(id,session_id,parent_run_id,child_instance_id,value) VALUES (?,?,?,?,?)',
      )
      .run('delegation', 'session', 'run', 'child', '{"retained":true}');
    await initializeProjectContainer(f.db, f.root);
    expect(f.db.prepare('SELECT value FROM delegations WHERE id=?').get('delegation')).toEqual({
      value: '{"retained":true}',
    });
  } finally {
    await f.close();
  }
});

test('failed v5 migration rolls back its table and preserves the v4 source for retry', async () => {
  const f = await legacy();
  try {
    f.db.pragma('user_version = 4');
    f.db.exec(
      'CREATE TABLE collision(id TEXT); CREATE INDEX delegations_session ON collision(id);',
    );
    await expect(initializeProjectContainer(f.db, f.root)).rejects.toThrow();
    expect(f.db.pragma('user_version', { simple: true })).toBe(4);
    expect(
      f.db.prepare("SELECT name FROM sqlite_master WHERE name='delegations'").get(),
    ).toBeUndefined();
    const source = await readFile(join(f.root, 'before-migration-v5.sqlite'));
    f.db.exec('DROP INDEX delegations_session');
    await initializeProjectContainer(f.db, f.root);
    expect(f.db.pragma('user_version', { simple: true })).toBe(6);
    expect(await readFile(join(f.root, 'before-migration-v5.sqlite'))).toEqual(source);
  } finally {
    await f.close();
  }
});

test('container upgrade preserves identities, full payloads and a readable v2 source', async () => {
  const f = await legacy();
  try {
    const put = f.db.prepare('INSERT INTO meta(key,value) VALUES (?,?)');
    put.run('name', '保留项目');
    put.run('tool:run:call', JSON.stringify({ result: '完整结果'.repeat(1000) }));
    put.run('delivered:session', '102');
    put.run('library-context:session', '1');
    const attempt = JSON.stringify({
      id: 'attempt',
      invocationId: 'invocation',
      sessionId: 'session',
      state: 'completed',
    });
    put.run('research-attempt:attempt', attempt);
    const message = JSON.stringify({ id: 'message', text: '原始消息', sessionId: 'session' });
    f.db
      .prepare('INSERT INTO messages(id,sessionId,value) VALUES (?,?,?)')
      .run('message', 'session', message);
    await initializeProjectContainer(f.db, f.root);
    expect(f.db.pragma('user_version', { simple: true })).toBe(6);
    const beforePrograms = new Database(join(f.root, 'before-migration-v6.sqlite'), {
      readonly: true,
    });
    try {
      expect(beforePrograms.pragma('user_version', { simple: true })).toBe(5);
      expect(
        beforePrograms.prepare("SELECT name FROM sqlite_master WHERE name='program_runs'").get(),
      ).toBeUndefined();
      expect(
        beforePrograms.prepare('SELECT value FROM messages WHERE id=?').get('message'),
      ).toEqual({ value: message });
    } finally {
      beforePrograms.close();
    }
    expect(f.db.prepare("SELECT key FROM meta WHERE key <> 'grants' ORDER BY key").all()).toEqual([
      { key: 'name' },
    ]);
    expect(f.db.prepare('SELECT key,value FROM harness_meta ORDER BY key').all()).toEqual([
      { key: 'delivered:session', value: '102' },
      { key: 'library-context:session', value: '1' },
      { key: 'tool:run:call', value: JSON.stringify({ result: '完整结果'.repeat(1000) }) },
    ]);
    expect(f.db.prepare('SELECT id,value FROM research_attempts').get()).toEqual({
      id: 'attempt',
      value: attempt,
    });
    expect(f.db.prepare('SELECT id,value FROM messages').get()).toEqual({
      id: 'message',
      value: message,
    });
    const source = new Database(join(f.root, 'before-migration-v3.sqlite'), { readonly: true });
    try {
      expect(source.pragma('user_version', { simple: true })).toBe(2);
      expect(
        source.prepare("SELECT value FROM meta WHERE key='research-attempt:attempt'").get(),
      ).toEqual({ value: attempt });
    } finally {
      source.close();
    }
    await initializeProjectContainer(f.db, f.root);
    expect(f.db.prepare('SELECT count(*) AS count FROM harness_meta').get()).toEqual({ count: 3 });
  } finally {
    await f.close();
  }
});

test('invalid legacy identity rolls back all migration writes and preserves source', async () => {
  const f = await legacy();
  try {
    f.db
      .prepare('INSERT INTO meta VALUES (?,?)')
      .run('research-attempt:expected', '{"id":"other"}');
    await expect(initializeProjectContainer(f.db, f.root)).rejects.toThrow();
    expect(f.db.pragma('user_version', { simple: true })).toBe(2);
    expect(
      f.db.prepare("SELECT name FROM sqlite_master WHERE name='harness_meta'").get(),
    ).toBeUndefined();
    expect(
      f.db.prepare("SELECT value FROM meta WHERE key='research-attempt:expected'").get(),
    ).toEqual({ value: '{"id":"other"}' });
    f.db
      .prepare("UPDATE meta SET value=? WHERE key='research-attempt:expected'")
      .run('{"id":"expected"}');
    await initializeProjectContainer(f.db, f.root);
    expect(f.db.pragma('user_version', { simple: true })).toBe(6);
  } finally {
    await f.close();
  }
});

test('process termination inside the upgrade transaction reopens only v2 and retries from its protected source', async () => {
  const f = await legacy();
  f.db.pragma('journal_mode = WAL');
  f.db
    .prepare('INSERT INTO meta VALUES (?,?)')
    .run('tool:run:call', JSON.stringify({ result: 'retained-result' }));
  f.db
    .prepare('INSERT INTO meta VALUES (?,?)')
    .run(
      'research-attempt:attempt',
      JSON.stringify({ id: 'attempt', invocationId: 'stable-invocation' }),
    );
  const child = fork(new URL('../fixtures/container-interrupted.mjs', import.meta.url), [f.root], {
    execArgv: [],
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const exited = once(child, 'exit');
  try {
    expect((await once(child, 'message'))[0]).toMatchObject({ stage: 'before-commit' });
    child.kill('SIGKILL');
    await exited;
    f.db.close();
    const reopened = new Database(join(f.root, 'project.sqlite'));
    try {
      expect(reopened.pragma('user_version', { simple: true })).toBe(2);
      expect(
        reopened.prepare("SELECT name FROM sqlite_master WHERE name='harness_meta'").get(),
      ).toBeUndefined();
      expect(reopened.prepare("SELECT value FROM meta WHERE key='tool:run:call'").get()).toEqual({
        value: JSON.stringify({ result: 'retained-result' }),
      });
      const source = new Database(join(f.root, 'before-migration-v3.sqlite'), { readonly: true });
      try {
        expect(source.pragma('quick_check', { simple: true })).toBe('ok');
        expect(source.pragma('user_version', { simple: true })).toBe(2);
      } finally {
        source.close();
      }
      await initializeProjectContainer(reopened, f.root);
      expect(reopened.pragma('user_version', { simple: true })).toBe(6);
      expect(
        reopened.prepare("SELECT value FROM research_attempts WHERE id='attempt'").get(),
      ).toEqual({
        value: JSON.stringify({ id: 'attempt', invocationId: 'stable-invocation' }),
      });
    } finally {
      reopened.close();
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
    await f.close();
  }
});
