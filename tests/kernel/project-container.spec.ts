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
    expect(f.db.pragma('user_version', { simple: true })).toBe(4);
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
    expect(f.db.pragma('user_version', { simple: true })).toBe(4);
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
      expect(reopened.pragma('user_version', { simple: true })).toBe(4);
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
