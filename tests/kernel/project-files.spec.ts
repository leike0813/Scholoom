import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
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
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const edit = results.find((result) => result.status === 'fulfilled')?.value;
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
    if (process.platform !== 'win32') {
      await promisify(execFile)('mkfifo', [join(store.project.path, 'pipe')]);
      await expect(store.read('pipe')).rejects.toMatchObject({ code: 'targetAmbiguous' });
      await expect(store.files.resource('pipe')).rejects.toMatchObject({ code: 'invalidRequest' });
    }
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

test('project management and structural operations preserve identity, history, trash and later targets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-structure-'));
  let projects = new Projects(join(root, 'profile'));
  try {
    await projects.initialize();
    const store = await projects.create(join(root, 'project'), 'Research');
    const id = store.project.id;
    store.grant({ read: true, write: true, send: true, autoBackup: false });
    await store.files.mutate('mkdir', 'make-notes', { path: 'notes' });
    const original = await store.save('notes/a.md', '# Original');
    if (!original.fileId) throw new Error('Expected a registered file');
    const basis = await store.read('notes/a.md');
    const edited = await store.save('notes/a.md', '# Edited', basis.basis);
    const rename = await store.files.mutate('rename', 'rename-notes', {
      path: 'notes',
      name: 'renamed',
    });
    expect(rename.state).toBe('complete');
    expect(
      await store.files.mutate('rename', 'rename-notes', { path: 'notes', name: 'renamed' }),
    ).toEqual(rename);
    await expect(
      store.files.mutate('rename', 'rename-notes', { path: 'renamed', name: 'other' }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(store.save('renamed/a.md', 'stale', basis.basis)).rejects.toMatchObject({
      code: 'contentChanged',
    });
    expect((await store.files.resolve([original.fileId]))[0]?.path).toBe('renamed/a.md');
    expect(store.history('renamed/a.md').map((item) => item.id)).toContain(edited.id);
    await store.undo(edited.id);
    expect((await store.read('renamed/a.md')).content).toBe('# Original');
    const trashed = await store.files.mutate('trash', 'trash-notes', { path: 'renamed' });
    expect((await store.files.resolve([original.fileId]))[0]?.state).toBe('trashed');
    await store.files.mutate('mkdir', 'new-renamed', { path: 'renamed' });
    const later = await store.save('renamed/a.md', 'Later file');
    expect(later.fileId).not.toBe(original.fileId);
    await expect(
      store.files.mutate('restore', 'restore-conflict', { trashId: trashed.id }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await expect(store.undo(original.id)).rejects.toMatchObject({ code: 'notFound' });
    const backup = await store.backup();
    const copy = await store.restore(backup.id, join(root, 'copy'));
    const restored = await projects.open(copy);
    restored.grant({ read: true, write: true, send: false, autoBackup: false });
    await restored.files.mutate('restore', 'restore-copy', {
      trashId: trashed.id,
      destination: 'recovered',
    });
    expect((await restored.read('recovered/a.md')).content).toBe('# Original');
    await store.files.mutate('restore', 'restore-notes', {
      trashId: trashed.id,
      destination: 'recovered',
    });
    expect((await store.files.resolve([original.fileId]))[0]?.path).toBe('recovered/a.md');
    expect((await store.read('renamed/a.md')).content).toBe('Later file');
    store.renameProject('Renamed Research');
    await projects.forget(id);
    expect(projects.list().find((item) => item.id === id)?.recent).toBe(false);
    expect(projects.get(id)).toBe(store);
    await projects.open(store.project.path);
    await projects.close();
    projects = new Projects(join(root, 'profile'));
    await projects.initialize();
    expect(projects.get(id).project.name).toBe('Renamed Research');
    expect((await projects.get(id).files.operation('rename-notes')).state).toBe('complete');
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('structure receipts recover after a completed move but failed metadata commit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-structure-receipt-'));
  let projects = new Projects(join(root, 'profile'));
  try {
    await projects.initialize();
    const store = await projects.create(join(root, 'project'));
    const id = store.project.id;
    store.grant({ read: true, write: true, send: true, autoBackup: false });
    const edit = await store.save('a.md', 'Original');
    if (!edit.fileId) throw new Error('Expected a registered file');
    store.database.exec(
      "CREATE TRIGGER reject_ref BEFORE UPDATE ON file_references BEGIN SELECT RAISE(ABORT, 'synthetic'); END",
    );
    await expect(
      store.files.mutate('rename', 'receipt', { path: 'a.md', name: 'b.md' }),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
    expect(await readFile(join(store.project.path, 'b.md'), 'utf8')).toBe('Original');
    store.database.exec('DROP TRIGGER reject_ref');
    await projects.close();
    projects = new Projects(join(root, 'profile'));
    await projects.initialize();
    const reopened = projects.get(id);
    expect((await reopened.files.operation('receipt')).state).toBe('complete');
    expect((await reopened.files.resolve([edit.fileId]))[0]?.path).toBe('b.md');
    expect(
      (await reopened.files.mutate('rename', 'receipt', { path: 'a.md', name: 'b.md' })).state,
    ).toBe('complete');
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('migration protects old database and requires renewed write grant; images stay bounded and private', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-migration-'));
  let projects = new Projects(join(root, 'profile'));
  try {
    await projects.initialize();
    const store = await projects.create(join(root, 'project'));
    const id = store.project.id;
    store.grant({ read: true, write: true, send: true, autoBackup: false });
    store.database.pragma('user_version = 1');
    await projects.close();
    projects = new Projects(join(root, 'profile'));
    await projects.initialize();
    const migrated = projects.get(id);
    expect(migrated.project).toMatchObject({ read: true, send: true, write: false });
    await expect(
      migrated.files.mutate('mkdir', 'not-authorized', { path: 'blocked' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(
      (await readFile(join(root, 'project', '.scholoom', 'before-migration.sqlite'))).length,
    ).toBeGreaterThan(0);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
      'base64',
    );
    await writeFile(join(root, 'project', 'image.png'), png);
    expect(await migrated.files.resource('image.png')).toEqual({
      mimeType: 'image/png',
      data: png.toString('base64'),
    });
    await writeFile(join(root, 'project', 'fake.png'), '<script>unsafe</script>');
    await expect(migrated.files.resource('fake.png')).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    await expect(migrated.files.resource('.scholoom/identity.json')).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await writeFile(join(root, 'project', 'large.png'), Buffer.alloc(1048577));
    await expect(migrated.files.resource('large.png')).rejects.toMatchObject({ code: 'tooLarge' });
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('canonical paths and concurrent reads retain one identity, and unknown operations survive path reuse', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-identity-'));
  const projects = new Projects(join(root, 'profile'));
  try {
    await projects.initialize();
    const store = await projects.create(join(root, 'project'));
    store.grant({ read: true, write: true, send: false, autoBackup: false });
    await mkdir(join(root, 'project', 'notes'));
    await writeFile(join(root, 'project', 'notes', 'a.md'), 'Original');
    const reads = await Promise.all(Array.from({ length: 20 }, () => store.read('notes/a.md')));
    expect(new Set(reads.map((item) => item.fileId)).size).toBe(1);
    const identity = reads[0]?.fileId;
    if (!identity) throw new Error('Expected a registered file');
    await store.files.mutate('rename', 'canonical', { path: './notes', name: 'renamed' });
    expect((await store.files.resolve([identity]))[0]?.path).toBe('renamed/a.md');
    store.database.exec(
      "CREATE TRIGGER reject_ref BEFORE UPDATE ON file_references BEGIN SELECT RAISE(ABORT, 'synthetic'); END",
    );
    const requests = await Promise.allSettled([
      store.files.mutate('rename', 'duplicate', { path: 'renamed/a.md', name: 'b.md' }),
      store.files.mutate('rename', 'duplicate', { path: 'renamed/a.md', name: 'b.md' }),
    ]);
    expect(requests.some((item) => item.status === 'rejected')).toBe(true);
    store.database.exec('DROP TRIGGER reject_ref');
    const later = await store.save('renamed/a.md', 'Later');
    expect(later.fileId).not.toBe(identity);
    await expect(store.read('renamed/b.md')).rejects.toMatchObject({ code: 'outcomeUnknown' });
    expect((await store.files.operation('duplicate')).state).toBe('complete');
    expect((await store.read('renamed/b.md')).fileId).toBe(reads[0]?.fileId);
    expect((await store.files.resolve([identity]))[0]?.path).toBe('renamed/b.md');
    expect((await store.read('renamed/a.md')).content).toBe('Later');
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('trash root links are refused and incomplete backup payloads cannot claim full recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-trash-protection-'));
  const projects = new Projects(join(root, 'profile'));
  try {
    await projects.initialize();
    const store = await projects.create(join(root, 'project'));
    store.grant({ read: true, write: true, send: false, autoBackup: false });
    await store.save('note.md', 'Protected');
    const external = join(root, 'outside');
    await mkdir(external);
    await symlink(
      external,
      join(store.internal, 'trash'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(
      store.files.mutate('trash', 'linked-root', { path: 'note.md' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(store.backup()).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(await readFile(join(store.project.path, 'note.md'), 'utf8')).toBe('Protected');
    await rm(join(store.internal, 'trash'));
    await store.files.mutate('mkdir', 'group', { path: 'group' });
    await store.save('group/note.md', 'Recoverable');
    await writeFile(join(store.project.path, 'group', 'binary.dat'), Buffer.from([0, 1, 2, 3]));
    await store.files.mutate('trash', 'group-trash', { path: 'group' });
    const backup = await store.backup();
    expect(
      backup.omitted.some((path) => path.includes('group-trash') && path.includes('binary.dat')),
    ).toBe(true);
    const copied = await projects.open(await store.restore(backup.id, join(root, 'copy')));
    copied.grant({ read: true, write: true, send: false, autoBackup: false });
    await expect(
      copied.files.mutate('restore', 'incomplete', { trashId: 'group-trash' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await store.files.mutate('restore', 'complete', { trashId: 'group-trash' });
    expect(await readFile(join(store.project.path, 'group', 'binary.dat'))).toEqual(
      Buffer.from([0, 1, 2, 3]),
    );
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});
