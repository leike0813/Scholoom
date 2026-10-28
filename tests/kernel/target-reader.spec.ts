import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { ProjectTargetReader } from '../../packages/projects/dist/node.js';
import type { ProjectTargetReadInputs } from '../../packages/protocol/dist/projects.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-target-reader-'));
  const app = new ManualApplication(join(root, 'profile'));
  await app.initialize();
  const target = await app.projects.create(join(root, 'target'));
  target.grant({ trust: 'trusted', autoBackup: false });
  const reader = new ProjectTargetReader(target);
  const access = <T>(action: () => Promise<T>) =>
    app.projects.withTargetRead(
      {
        role: 'execution',
        principal: { kind: 'agent', id: 'session' },
        projectId: 'application',
      },
      target.project.id,
      () => {},
      action,
    );
  return {
    root,
    app,
    target,
    read: (request: ProjectTargetReadInputs['project.readTarget']['request']) =>
      access(() => reader.read(request)),
    describePath: (path: string) => access(() => reader.describePath(path)),
    close: async () => {
      await app.close();
      await rm(root, { recursive: true });
    },
  };
}

test('target list, descriptions and byte/text chunks keep identities, records and target tree unchanged', async () => {
  const f = await fixture();
  try {
    await f.target.save('a.md', '甲乙abc');
    await f.target.save('b.md', 'second');
    await f.target.save('empty.md', '');
    await writeFile(join(f.target.project.path, 'unregistered.md'), 'never register through read');
    const tree = await readdir(f.target.project.path, { recursive: true });
    const records = f.target.database.serialize();
    const first = await f.read({ kind: 'list', limit: 1 });
    if (first.kind !== 'list') throw new Error('Expected list');
    expect(first.entries).toHaveLength(1);
    expect(first.entries[0]?.path).toBe('a.md');
    expect(first.nextOffset).toBe(1);
    const entry = first.entries[0];
    if (!entry) throw new Error('Expected registered file');
    const ref = { fileId: entry.fileId, basis: entry.basis };
    expect(await f.describePath('a.md')).toMatchObject({ kind: 'describe', ...ref, path: 'a.md' });
    await expect(f.describePath('unregistered.md')).rejects.toMatchObject({ code: 'unavailable' });
    expect(await f.read({ kind: 'describe', ...ref })).toMatchObject({
      ...entry,
      kind: 'describe',
    });
    expect(await f.read({ kind: 'readText', ...ref, limit: 4 })).toMatchObject({
      kind: 'readText',
      content: '甲',
      offset: 0,
      nextOffset: 3,
    });
    expect(await f.read({ kind: 'readText', ...ref, offset: 3 })).toMatchObject({
      content: '乙abc',
    });
    const bytes = await f.read({ kind: 'readBytes', ...ref, offset: 2, limit: 4 });
    expect(bytes).toMatchObject({
      kind: 'readBytes',
      data: Buffer.from('甲乙abc').subarray(2, 6).toString('base64'),
      nextOffset: 6,
    });
    expect(bytes).not.toHaveProperty('content');
    const all = await f.read({ kind: 'list' });
    if (all.kind !== 'list') throw new Error('Expected list');
    expect(all.entries.map((item) => item.path)).toEqual(['a.md', 'b.md', 'empty.md']);
    const empty = all.entries.find((item) => item.path === 'empty.md');
    if (!empty) throw new Error('Expected empty file');
    expect(
      await f.read({ kind: 'readText', fileId: empty.fileId, basis: empty.basis }),
    ).toMatchObject({ content: '', size: 0 });
    const second = await f.read({ kind: 'list', offset: first.nextOffset ?? 0, limit: 1 });
    expect(second).toMatchObject({ entries: [expect.objectContaining({ path: 'b.md' })] });
    expect(f.target.database.serialize()).toEqual(records);
    expect(await readdir(f.target.project.path, { recursive: true })).toEqual(tree);
    expect(await readFile(join(f.target.project.path, 'unregistered.md'), 'utf8')).toBe(
      'never register through read',
    );
  } finally {
    await f.close();
  }
});

test('target reads reject missing registration, changed basis, unsafe paths and withdrawn trust', async () => {
  const f = await fixture();
  try {
    const created = await f.target.save('input.md', 'original');
    const before = await f.target.material('input.md');
    const ref = { fileId: created.fileId ?? '', basis: before.basis };
    await expect(
      f.read({ kind: 'describe', fileId: 'unregistered', basis: 'unknown' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await writeFile(join(f.target.project.path, 'input.md'), 'changed');
    for (const kind of ['describe', 'readText', 'readBytes'] as const)
      await expect(f.read({ kind, ...ref })).rejects.toMatchObject({ code: 'contentChanged' });
    const current = await f.read({ kind: 'describe', fileId: created.fileId ?? '' });
    if (current.kind !== 'describe') throw new Error('Expected descriptor');
    for (const request of [
      { kind: 'list' as const, limit: 101 },
      { kind: 'list' as const, offset: -1 },
      { kind: 'readBytes' as const, ...ref, basis: current.basis, limit: 262145 },
    ])
      await expect(f.read(request)).rejects.toMatchObject({ code: 'invalidRequest' });
    f.target.grant({ trust: 'restricted', autoBackup: false });
    await expect(f.read({ kind: 'list' })).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(await readFile(join(f.target.project.path, 'input.md'), 'utf8')).toBe('changed');
    f.target.grant({ trust: 'trusted', autoBackup: false });
    await rm(join(f.target.project.path, 'input.md'));
    await expect(f.read({ kind: 'describe', ...ref })).rejects.toMatchObject({ code: 'notFound' });
  } finally {
    await f.close();
  }
});

test('shared resource basis rejects equal-length rewrites even when mtime is restored', async () => {
  const f = await fixture();
  try {
    const saved = await f.target.save('timestamp.txt', 'original');
    const path = join(f.target.project.path, 'timestamp.txt');
    // An exact timestamp makes this assertion independent of filesystem mtime precision.
    await utimes(path, 1700000000, 1700000000);
    const before = await stat(path, { bigint: true });
    const manual = await f.target.files.readBytes(saved.fileId ?? '', { limit: 1 });
    const descriptor = await f.read({ kind: 'describe', fileId: saved.fileId ?? '' });
    if (descriptor.kind !== 'describe') throw new Error('Expected descriptor');
    expect(descriptor.basis).toBe(manual.resourceBasis);
    await writeFile(path, 'modified');
    await utimes(path, 1700000000, 1700000000);
    const after = await stat(path, { bigint: true });
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(after.size).toBe(before.size);
    expect(after.ino).toBe(before.ino);
    expect(after.ctimeNs).not.toBe(before.ctimeNs);
    for (const kind of ['readText', 'readBytes'] as const)
      await expect(
        f.read({ kind, fileId: saved.fileId ?? '', basis: manual.resourceBasis }),
      ).rejects.toMatchObject({ code: 'contentChanged' });
    await expect(
      f.target.files.readBytes(saved.fileId ?? '', { resourceBasis: descriptor.basis }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
  } finally {
    await f.close();
  }
});

test('registered links and private locations never yield target bytes', async () => {
  test.skip(process.platform === 'win32', 'POSIX link fixture');
  const f = await fixture();
  try {
    const created = await f.target.save('linked.md', 'registered');
    const before = await f.target.material('linked.md');
    await writeFile(join(f.root, 'outside.md'), 'outside private evidence');
    await rm(join(f.target.project.path, 'linked.md'));
    await symlink(join(f.root, 'outside.md'), join(f.target.project.path, 'linked.md'));
    await expect(
      f.read({ kind: 'readText', fileId: created.fileId ?? '', basis: before.basis }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await mkdir(join(f.target.project.path, '.env.parts'));
    await writeFile(join(f.target.project.path, '.env.parts', 'secret.md'), 'secret');
    const rows = f.target.database
      .prepare('SELECT id, value FROM file_references WHERE id=?')
      .get(created.fileId) as { id: string; value: string };
    const location = { ...JSON.parse(rows.value), path: '.env.parts/secret.md' };
    f.target.database
      .prepare('UPDATE file_references SET path=?,value=? WHERE id=?')
      .run(location.path, JSON.stringify(location), rows.id);
    await expect(
      f.read({ kind: 'describe', fileId: rows.id, basis: before.basis }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(await f.read({ kind: 'list' })).toMatchObject({ entries: [] });
    expect(await readFile(join(f.root, 'outside.md'), 'utf8')).toBe('outside private evidence');
  } finally {
    await f.close();
  }
});
