import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';
import { Database, delegation, fixture, grants } from '../project-migration-fixture.js';

for (const target of [5, 6] as const) {
  test(`composed v${target - 1} migration rolls back v${target} and retries without losing domain data`, async () => {
    const f = await fixture((target - 1) as 4 | 5);
    const execute = f.db.exec;
    try {
      f.db.exec = function (sql: string) {
        const result = execute.call(this, sql);
        if (this.pragma('user_version', { simple: true }) === target)
          throw new Error('synthetic transaction failure');
        return result;
      };
      await expect(initializeProjectContainer(f.db, f.root)).rejects.toThrow(
        'synthetic transaction failure',
      );
      expect(f.db.pragma('user_version', { simple: true })).toBe(target - 1);
      expect(
        f.db
          .prepare('SELECT name FROM sqlite_master WHERE name=?')
          .get(target === 5 ? 'delegations' : 'program_runs'),
      ).toBeUndefined();
      const protectedSource = new Database(join(f.root, `before-migration-v${target}.sqlite`), {
        readonly: true,
      });
      try {
        expect(protectedSource.pragma('user_version', { simple: true })).toBe(target - 1);
        expect(protectedSource.prepare("SELECT value FROM meta WHERE key='grants'").get()).toEqual({
          value: grants,
        });
      } finally {
        protectedSource.close();
      }
      f.db.exec = execute;
      await initializeProjectContainer(f.db, f.root);
      await initializeProjectContainer(f.db, f.root);
      expect(f.db.pragma('user_version', { simple: true })).toBe(6);
      expect(
        f.db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('delegations','program_runs') ORDER BY name",
          )
          .all(),
      ).toEqual([{ name: 'delegations' }, { name: 'program_runs' }]);
      expect(
        f.db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('delegations_session','delegations_parent')",
          )
          .all(),
      ).toHaveLength(2);
      expect(f.db.prepare("SELECT value FROM meta WHERE key='grants'").get()).toEqual({
        value: grants,
      });
      if (target === 6)
        expect(f.db.prepare('SELECT value FROM delegations WHERE id=?').get('delegation')).toEqual({
          value: JSON.stringify(delegation),
        });
    } finally {
      f.db.exec = execute;
      await f.close();
    }
  });
}

test('the unpublished program-only v5 sample is rejected without guessing or rewriting its history', async () => {
  const f = await fixture(4);
  try {
    f.db.exec(
      "CREATE TABLE program_runs(id TEXT PRIMARY KEY NOT NULL,created_at TEXT NOT NULL,value TEXT NOT NULL); INSERT INTO program_runs VALUES ('sample','date','retained'); PRAGMA user_version=5;",
    );
    await expect(initializeProjectContainer(f.db, f.root)).rejects.toThrow();
    expect(f.db.pragma('user_version', { simple: true })).toBe(5);
    expect(f.db.prepare('SELECT value FROM program_runs').get()).toEqual({ value: 'retained' });
    expect(
      f.db.prepare("SELECT name FROM sqlite_master WHERE name='delegations'").get(),
    ).toBeUndefined();
  } finally {
    await f.close();
  }
});
