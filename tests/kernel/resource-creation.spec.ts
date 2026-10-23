import assert from 'node:assert/strict';
import { mkdtemp, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';

test('first creation returns a stable receipt and a lost reply is queried after restart without rewriting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-create-'));
  const profile = join(root, 'profile');
  let app = new ManualApplication(profile);
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    const input = {
      projectId: project.id,
      path: 'report.md',
      operationId: 'first-report',
      content: 'first evidence',
    };
    await expect(stat(join(project.path, input.path))).rejects.toMatchObject({ code: 'ENOENT' });
    const created = await app.call('resources.create', input);
    assert(created.state === 'complete');
    const identity = await stat(join(project.path, input.path), { bigint: true });
    await app.close();
    app = new ManualApplication(profile);
    await app.initialize();
    expect(
      await app.call('resources.creation', {
        projectId: project.id,
        operationId: input.operationId,
      }),
    ).toEqual(created);
    expect(await app.call('resources.create', input)).toEqual(created);
    expect((await stat(join(project.path, input.path), { bigint: true })).ino).toBe(identity.ino);
    expect(app.projects.get(project.id).history(input.path)).toHaveLength(1);
    await expect(
      app.call('resources.create', { ...input, content: 'different input' }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(
      app.call('resources.create', { ...input, operationId: 'another' }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(await readFile(join(project.path, input.path), 'utf8')).toBe(input.content);
    const concurrent = await Promise.allSettled([
      app.call('resources.create', { ...input, operationId: 'concurrent', path: 'one.md' }),
      app.call('resources.create', { ...input, operationId: 'concurrent', path: 'two.md' }),
    ]);
    expect(concurrent.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((item) => item.status === 'rejected')).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ code: 'invalidRequest' }) }),
    ]);
  } finally {
    await app.close();
  }
});

for (const replacement of [false, true]) {
  test(`published creation survives failed identity registration and restart (replacement=${replacement})`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-create-unknown-'));
    const profile = join(root, 'profile');
    let app = new ManualApplication(profile);
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'restricted',
      });
      const store = app.projects.get(project.id);
      store.database.exec(
        "CREATE TRIGGER reject_creation BEFORE INSERT ON file_references BEGIN SELECT RAISE(ABORT, 'synthetic registration failure'); END",
      );
      const input = {
        projectId: project.id,
        path: 'report.md',
        operationId: 'unknown-report',
        content: 'published evidence',
      };
      expect(await app.call('resources.create', input)).toMatchObject({
        state: 'unknown',
        operationId: input.operationId,
      });
      expect(await readFile(join(project.path, input.path), 'utf8')).toBe(input.content);
      const original = await stat(join(project.path, input.path), { bigint: true });
      const receipt = store.database
        .prepare('SELECT details FROM file_operations WHERE id = ?')
        .get(input.operationId) as { details: string };
      const details = JSON.parse(receipt.details);
      expect(await readFile(details.source, 'utf8')).toBe(input.content);
      if (!replacement) {
        const backup = await store.backup();
        const copyPath = await store.restore(backup.id, join(root, 'copy'));
        const copy = await app.projects.open(copyPath);
        copy.grant({ trust: 'restricted', autoBackup: false });
        copy.database.exec('DROP TRIGGER reject_creation');
        expect(
          (
            await app.call('resources.creation', {
              projectId: copy.project.id,
              operationId: input.operationId,
            })
          ).state,
        ).toBe('unknown');
        expect(await readFile(join(copyPath, input.path), 'utf8')).toBe(input.content);
        expect(await readFile(details.source, 'utf8')).toBe(input.content);
      }
      await app.close();
      app = new ManualApplication(profile);
      await app.initialize();
      app.projects.get(project.id).database.exec('DROP TRIGGER reject_creation');
      if (replacement) {
        await rename(join(project.path, input.path), join(root, 'original-report'));
        await writeFile(join(project.path, input.path), input.content);
      }
      const result = await app.call('resources.creation', {
        projectId: project.id,
        operationId: input.operationId,
      });
      expect(result.state).toBe(replacement ? 'unknown' : 'complete');
      if (replacement) {
        await expect(app.call('resources.create', input)).resolves.toMatchObject({
          state: 'unknown',
        });
        expect(await readFile(details.source, 'utf8')).toBe(input.content);
        expect(app.projects.get(project.id).history(input.path)).toHaveLength(0);
      } else {
        assert(result.state === 'complete');
        expect(result.resource.ref.fileId).toBe(details.creation.edit.fileId);
        expect((await stat(join(project.path, input.path), { bigint: true })).ino).toBe(
          original.ino,
        );
        expect(app.projects.get(project.id).history(input.path)).toHaveLength(1);
      }
    } finally {
      await app.close();
    }
  });
}
