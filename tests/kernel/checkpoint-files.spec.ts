import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SqliteSaver } from '../../apps/kernel/node_modules/@langchain/langgraph-checkpoint-sqlite/dist/index.js';
import {
  claimCheckpoints,
  openCheckpoint,
  prepareScratch,
  sessionScratch,
} from '../../packages/harness/dist/node.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

test('unsafe legacy scratch is retained and never published into a session context', async () => {
  test.skip(process.platform === 'win32', 'POSIX symlink fixture');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-scratch-boundary-'));
  const legacy = join(root, 'scratch'),
    target = sessionScratch(root, 'session');
  try {
    await mkdir(legacy);
    await writeFile(join(root, 'outside.md'), 'retained private bytes');
    await symlink(join(root, 'outside.md'), join(legacy, 'linked.md'));
    await expect(prepareScratch(target, legacy, true)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(join(root, 'outside.md'), 'utf8')).toBe('retained private bytes');
    await prepareScratch(target, legacy, false);
    await expect(stat(join(target, 'linked.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true });
  }
});

test('a linked session ancestor cannot share another session scratch', async () => {
  test.skip(process.platform === 'win32', 'POSIX symlink fixture');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-scratch-ancestor-'));
  const first = sessionScratch(root, 'first');
  const second = sessionScratch(root, 'second');
  try {
    await prepareScratch(first, join(root, 'legacy'), false);
    await writeFile(join(first, 'private.md'), 'first session only');
    await symlink(
      join(root, 'harness', 'sessions', 'first'),
      join(root, 'harness', 'sessions', 'second'),
    );
    await expect(prepareScratch(second, join(root, 'legacy'), false)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    expect(await readFile(join(first, 'private.md'), 'utf8')).toBe('first session only');
  } finally {
    await rm(root, { recursive: true });
  }
});

for (const layout of ['shared', 'isolated', 'private'] as const) {
  test(`private checkpoint imports all namespaces and pending writes from ${layout} without changing the source`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-checkpoint-import-'));
    const directory = join(root, 'harness', 'checkpoints');
    await mkdir(directory, { recursive: true });
    const source =
      layout === 'shared'
        ? join(root, 'checkpoints.sqlite')
        : layout === 'isolated'
          ? join(root, 'checkpoints-old.sqlite')
          : join(directory, 'old.sqlite');
    const db = new Database(source);
    try {
      const saver = new SqliteSaver(db);
      for (const namespace of ['', 'nested:child']) {
        const saved = await saver.put(
          { configurable: { thread_id: 'old', checkpoint_ns: namespace } },
          {
            v: 4,
            id: randomUUID(),
            ts: new Date().toISOString(),
            channel_values: {
              target: 'keep the constraint',
              toolResult: 'full result'.repeat(2000),
            },
            channel_versions: {},
            versions_seen: {},
          },
          { source: 'input', step: 0, parents: {} },
        );
        await saver.putWrites(
          saved,
          [['pending', { operation: 'already accepted' }]],
          'task',
          '/child',
        );
      }
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      const original = await readFile(source);
      const imported = await openCheckpoint(root, 'next', 'old');
      try {
        expect(imported.imported).toBe(true);
        const reader = new SqliteSaver(imported.database);
        for (const namespace of ['', 'nested:child']) {
          const checkpoint = await reader.getTuple({
            configurable: { thread_id: 'next', checkpoint_ns: namespace },
          });
          expect(checkpoint?.checkpoint.channel_values.target).toBe('keep the constraint');
          expect(checkpoint?.checkpoint.channel_values.toolResult).toHaveLength(22000);
          expect(checkpoint?.pendingWrites).toEqual([
            ['task', 'pending', { operation: 'already accepted' }],
          ]);
        }
        imported.database.exec('DELETE FROM checkpoints');
      } finally {
        imported.database.close();
      }
      expect(await readFile(source)).toEqual(original);
      const other = await openCheckpoint(root, 'another', 'old');
      try {
        expect(other.database.prepare('SELECT count(*) AS count FROM checkpoints').get()).toEqual({
          count: 2,
        });
      } finally {
        other.database.close();
      }
    } finally {
      if (db.open) db.close();
      await rm(root, { recursive: true });
    }
  });
}

test('corrupt sources remain intact and a live checkpoint claim prevents another writer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-checkpoint-exclusion-'));
  try {
    const source = join(root, 'checkpoints.sqlite');
    await writeFile(source, 'damaged source');
    const opened = await openCheckpoint(root, 'run');
    expect(opened.imported).toBe(false);
    expect(opened.issue).toBeTruthy();
    opened.database.close();
    expect(await readFile(source, 'utf8')).toBe('damaged source');
    const release = await claimCheckpoints(root, ['run']);
    try {
      await expect(claimCheckpoints(root, ['run'])).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      release();
    }
    const next = await claimCheckpoints(root, ['run']);
    next();
    await writeFile(opened.path, 'damaged private checkpoint');
    await expect(openCheckpoint(root, 'run')).rejects.toMatchObject({ code: 'unavailable' });
    expect(await readFile(opened.path, 'utf8')).toBe('damaged private checkpoint');
    const fallback = await openCheckpoint(root, 'fallback');
    fallback.database.close();
  } finally {
    await rm(root, { recursive: true });
  }
});

test('a live writer in another process blocks reuse until its ownership is released', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-checkpoint-writer-'));
  const holder = fork(
    new URL('../fixtures/processes/checkpoint-holder.mjs', import.meta.url),
    [root],
    {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      execArgv: [],
    },
  );
  try {
    const [ready] = await once(holder, 'message');
    expect(ready.ready).toBe(true);
    await expect(claimCheckpoints(root, ['run'])).rejects.toMatchObject({ code: 'unavailable' });
    const exited = once(holder, 'exit');
    holder.send({ release: true });
    await exited;
    const release = await claimCheckpoints(root, ['run']);
    release();
  } finally {
    if (holder.connected) {
      const exited = once(holder, 'exit');
      holder.disconnect();
      await exited;
    }
    await rm(root, { recursive: true });
  }
});

test('an active legacy SQLite writer blocks import and preserves the source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-legacy-writer-'));
  const source = new Database(join(root, 'checkpoints.sqlite'));
  try {
    await new SqliteSaver(source).getTuple({ configurable: { thread_id: 'run' } });
    source.exec('BEGIN IMMEDIATE');
    await expect(openCheckpoint(root, 'run')).rejects.toMatchObject({ code: 'instanceMismatch' });
    source.exec('ROLLBACK');
    const opened = await openCheckpoint(root, 'run');
    opened.database.close();
  } finally {
    source.close();
    await rm(root, { recursive: true });
  }
});
