import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ModelConfigStore } from '../../packages/models/dist/node.js';
import type { SaveModelProfile } from '../../packages/protocol/dist/models.js';

const input: SaveModelProfile = {
  id: 'reviewer',
  name: '审阅模型',
  expectedRevision: 0,
  config: { model: 'MiniMax-M3.1-Flash-Preview', effort: 'high' },
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-model-profiles-'));
  return {
    root,
    path: join(root, 'model-profiles.json'),
    store: new ModelConfigStore(root),
    cleanup: () => rm(root, { recursive: true }),
  };
}

test('profiles persist privately, paginate and resolve without changing defaults or pinned values', async () => {
  const { root, path, store, cleanup } = await fixture();
  try {
    const defaults = await store.load();
    expect(await store.profiles()).toEqual({ profiles: [] });
    const first = await store.saveProfile(input);
    expect(first).toMatchObject({
      id: input.id,
      provider: 'minimax-cn-m-plan',
      config: input.config,
    });
    const pinned = await store.resolveProfile(first.id);
    const second = await store.saveProfile({ ...input, id: 'writer', name: '写作模型' });
    const restarted = new ModelConfigStore(root);
    expect(await restarted.profiles({ limit: 1 })).toEqual({ profiles: [first], nextOffset: 1 });
    expect(await restarted.profiles({ offset: 1, limit: 1 })).toEqual({ profiles: [second] });
    await store.saveProfile({
      ...input,
      name: '新的名称',
      expectedRevision: first.revision,
      config: { model: 'MiniMax-M2.7' },
    });
    expect(pinned).toEqual(first);
    expect(await store.load()).toEqual(defaults);
    await expect(stat(join(root, 'provider.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o077).toBe(0);
    expect(await readFile(path, 'utf8')).not.toContain('apiKey');
  } finally {
    await cleanup();
  }
});

test('serialized updates reject stale saves and removals, including deletion and recreation', async () => {
  const { root, store, cleanup } = await fixture();
  try {
    const first = await store.saveProfile(input);
    const outcomes = await Promise.allSettled([
      store.saveProfile({ ...input, name: 'A', expectedRevision: first.revision }),
      store.saveProfile({ ...input, name: 'B', expectedRevision: first.revision }),
    ]);
    expect(outcomes[0]?.status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { code: 'contentChanged' } });
    const current = await store.resolveProfile(input.id);
    await expect(
      store.removeProfile({ id: input.id, expectedRevision: first.revision }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await store.removeProfile({ id: input.id, expectedRevision: current.revision });
    await expect(store.resolveProfile(input.id)).rejects.toMatchObject({ code: 'notFound' });
    const restarted = new ModelConfigStore(root);
    const recreated = await restarted.saveProfile(input);
    expect(recreated.revision).toBeGreaterThan(current.revision);
    await expect(
      restarted.saveProfile({ ...input, expectedRevision: current.revision }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await expect(
      restarted.removeProfile({ id: input.id, expectedRevision: first.revision }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(await restarted.resolveProfile(input.id)).toEqual(recreated);
  } finally {
    await cleanup();
  }
});

test('profile inputs are validated inside the store and the collection stays bounded', async () => {
  const { store, cleanup } = await fixture();
  try {
    const invalid: unknown[] = [
      null,
      { ...input, id: '' },
      { ...input, name: '' },
      { ...input, name: 'a'.repeat(201) },
      { ...input, expectedRevision: -1 },
      { ...input, expectedRevision: 0.5 },
      { ...input, config: { model: 'unknown' } },
      { ...input, config: { model: 'MiniMax-M3', effort: 'high' } },
      { ...input, config: { ...input.config, effort: 'invalid' } },
      { ...input, config: { ...input.config, apiKey: 'synthetic' } },
    ];
    for (const value of invalid)
      await expect(store.saveProfile(value as SaveModelProfile)).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    for (const query of [{ offset: -1 }, { limit: 0 }, { limit: 101 }])
      await expect(store.profiles(query)).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(store.removeProfile({ id: input.id, expectedRevision: -1 })).rejects.toMatchObject(
      { code: 'invalidRequest' },
    );
    await expect(store.resolveProfile('')).rejects.toMatchObject({ code: 'invalidRequest' });
    for (let index = 0; index < 100; index++)
      await store.saveProfile({ ...input, id: `profile-${index}` });
    await expect(store.saveProfile(input)).rejects.toMatchObject({ code: 'resourceLimit' });
    const existing = await store.resolveProfile('profile-0');
    await store.saveProfile({ ...input, id: existing.id, expectedRevision: existing.revision });
    expect((await store.profiles({ limit: 100 })).profiles).toHaveLength(100);
  } finally {
    await cleanup();
  }
});

for (const damage of [
  'invalid JSON',
  'duplicate identity',
  'revision rollback',
  'unsafe permissions',
  'symlink',
]) {
  test(`a ${damage} profiles file is diagnosed and preserved on reads and writes`, async () => {
    test.skip(process.platform === 'win32' && ['unsafe permissions', 'symlink'].includes(damage));
    const { root, path, store, cleanup } = await fixture();
    try {
      const saved = await store.saveProfile(input);
      if (damage === 'invalid JSON') await writeFile(path, '{{damaged', { mode: 0o600 });
      if (damage === 'duplicate identity')
        await writeFile(
          path,
          JSON.stringify({ revision: saved.revision, profiles: [saved, saved] }),
        );
      if (damage === 'revision rollback')
        await writeFile(path, JSON.stringify({ revision: 0, profiles: [saved] }));
      if (damage === 'unsafe permissions') await chmod(path, 0o644);
      if (damage === 'symlink') {
        const target = join(root, 'target.json');
        await writeFile(target, await readFile(path), { mode: 0o600 });
        await rm(path);
        await symlink(target, path);
      }
      const before = await readFile(path, 'utf8');
      await expect(store.profiles()).rejects.toMatchObject({ code: 'unavailable' });
      await expect(store.resolveProfile(input.id)).rejects.toMatchObject({ code: 'unavailable' });
      await expect(
        store.saveProfile({ ...input, expectedRevision: saved.revision }),
      ).rejects.toMatchObject({ code: 'unavailable' });
      await expect(
        store.removeProfile({ id: input.id, expectedRevision: saved.revision }),
      ).rejects.toMatchObject({ code: 'unavailable' });
      expect(await readFile(path, 'utf8')).toBe(before);
    } finally {
      await cleanup();
    }
  });
}
