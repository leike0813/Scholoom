import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CredentialStore } from '../../apps/kernel/dist/credentials/store.js';
import { Projects } from '../../apps/kernel/dist/projects/store.js';

test('credentials encrypt at rest, prefer saved values, survive restart, and preserve corruption', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-credentials-'));
  try {
    const directory = join(root, 'secrets');
    const store = new CredentialStore(directory, { MINIMAX_CN_API_KEY: 'synthetic-environment' });
    expect(await store.get()).toMatchObject({ source: 'environment' });
    await store.save('synthetic-saved');
    expect(await readFile(join(directory, 'minimax.json'), 'utf8')).not.toContain(
      'synthetic-saved',
    );
    expect(await new CredentialStore(directory, {}).get()).toEqual({
      key: 'synthetic-saved',
      source: 'saved',
    });
    await writeFile(join(directory, 'minimax.json'), 'corrupt');
    await expect(store.save('replacement')).rejects.toMatchObject({
      code: 'credentialUnavailable',
    });
    expect(await readFile(join(directory, 'minimax.json'), 'utf8')).toBe('corrupt');
  } finally {
    await rm(root, { recursive: true });
  }
});

test('shared file saving protects whole content, concurrent edits, new targets and later work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-files-'));
  const projects = new Projects(join(root, 'profile'));
  try {
    await mkdir(join(root, 'project'));
    await writeFile(join(root, 'project', 'note.md'), 'one\ntwo\n');
    await projects.initialize();
    const store = await projects.open(join(root, 'project'));
    store.grant({ read: true, write: true, send: true, autoBackup: false });
    await writeFile(join(root, 'project', 'large.md'), '中'.repeat(100000));
    const large = await store.read('large.md');
    expect(large.truncated).toBe(true);
    expect(large.content).not.toContain('\uFFFD');
    await expect(store.save('large.md', 'overwrite', large.basis)).rejects.toMatchObject({
      code: 'contentChanged',
    });
    const read = await store.read('note.md');
    await writeFile(join(root, 'project', 'note.md'), 'one\nexternal\n');
    await expect(store.save('note.md', 'changed\ntwo\n', read.basis)).rejects.toMatchObject({
      code: 'contentChanged',
    });
    const basis = await store.read('note.md');
    const results = await Promise.allSettled([
      store.save('note.md', 'first', basis.basis),
      store.save('note.md', 'second', basis.basis),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    const edit = results[0].status === 'fulfilled' ? results[0].value : null;
    expect(edit).not.toBeNull();
    await writeFile(join(root, 'project', 'note.md'), 'later');
    await expect(store.undo(edit?.id ?? '')).rejects.toMatchObject({ code: 'contentChanged' });
    await expect(store.save('note.md', 'overwrite')).rejects.toMatchObject({
      code: 'contentChanged',
    });
    expect(await readFile(join(root, 'project', 'note.md'), 'utf8')).toBe('later');
    await symlink(
      join(root, 'profile'),
      join(root, 'project', 'outside'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(store.read('outside/projects.json')).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(store.read('../profile/projects.json')).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    const backup = await store.backup();
    await writeFile(join(root, 'project', 'note.md'), 'newer');
    const copy = await store.restore(backup.id, join(root, 'recovered'));
    expect(await readFile(join(copy, 'note.md'), 'utf8')).toBe('later');
    expect(await readFile(join(root, 'project', 'note.md'), 'utf8')).toBe('newer');
    const restored = await projects.open(copy);
    expect(restored.project.id).not.toBe(store.project.id);
    expect(restored.project.send).toBe(false);
    const created = await store.save('new.md', 'new');
    await store.undo(created.id);
    await expect(readFile(join(root, 'project', 'new.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('backups preserve user manifests and notice external edits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-backup-'));
  const projects = new Projects(join(root, 'profile'));
  try {
    await mkdir(join(root, 'project', 'sub'), { recursive: true });
    await writeFile(join(root, 'project', 'manifest.json'), '{"user":true}');
    await writeFile(join(root, 'project', 'sub', 'manifest.json'), '{"nested":true}');
    await projects.initialize();
    const store = await projects.open(join(root, 'project'));
    store.grant({ read: true, write: true, send: true, autoBackup: true });
    await store.backup();
    await writeFile(join(root, 'project', 'manifest.json'), '{"user":"changed"}');
    await store.autoBackup();
    expect(await store.backups()).toHaveLength(2);
    const latest = (await store.backups())[0];
    if (!latest) throw new Error('Expected an automatic backup');
    const restored = await store.restore(latest.id, join(root, 'copy'));
    expect(await readFile(join(restored, 'manifest.json'), 'utf8')).toBe('{"user":"changed"}');
    expect(await readFile(join(restored, 'sub', 'manifest.json'), 'utf8')).toBe('{"nested":true}');
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('project identity survives relocation without a global registry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-move-'));
  let projects = new Projects(join(root, 'profile'));
  try {
    await mkdir(join(root, 'project'));
    await projects.initialize();
    const original = await projects.open(join(root, 'project'));
    const id = original.project.id;
    await projects.close();
    await rename(join(root, 'project'), join(root, 'moved'));
    projects = new Projects(join(root, 'other-profile'));
    await projects.initialize();
    expect((await projects.open(join(root, 'moved'))).project.id).toBe(id);
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});
