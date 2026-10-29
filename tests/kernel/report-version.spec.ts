import assert from 'node:assert/strict';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { OperationError } from '../../packages/protocol/dist/index.js';
import { reportFixture } from '../fixtures/report.js';

test('exact historical report uses its own sources rather than the current manifest', async () => {
  const root = test.info().outputPath('versions');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { entry, manifest, html } = await reportFixture(app, root);
    const nextManifest = {
      ...manifest,
      sources: [],
      objects: manifest.objects.map((object) => ({ ...object, sourceIndexes: [] })),
    };
    const next = await app.call('resources.save', {
      ref: entry.ref,
      basis: entry.basis,
      content: html.replace(
        JSON.stringify(manifest).replaceAll('-', '\\u002d'),
        JSON.stringify(nextManifest).replaceAll('-', '\\u002d'),
      ),
    });
    const original = { ref: entry.ref, basis: entry.basis };
    const result = await app.call('resources.reportVersion', original);
    assert(result.state === 'available');
    expect(result.snapshot.manifest).toEqual(manifest);
    expect(result.snapshot.resource.basis).toBe(entry.basis);
    expect(result.snapshot.resource.capabilities.write).toBe(false);
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    expect(
      (await app.call('resources.reportVersion', { ref: next.ref, basis: next.basis })).state,
    ).toBe('available');
    await expect(app.call('resources.reportVersion', original)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    expect((await app.call('resources.reportVersion', original)).state).toBe('available');
    await expect(
      app.call('resources.reportVersion', { ...original, basis: 'no-such-version' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  } finally {
    await app.close();
  }
});

test('changed readable dependency returns only exact-version unavailability', async () => {
  const root = test.info().outputPath('changed');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { entry, manifest } = await reportFixture(app, root);
    const dependency = manifest.resources[0];
    assert(dependency);
    await app.call('resources.save', {
      ref: dependency.ref,
      basis: dependency.basis,
      content: '[30,40]',
    });
    expect(
      await app.call('resources.reportVersion', { ref: entry.ref, basis: entry.basis }),
    ).toEqual({
      state: 'unavailable',
      reason: 'contentChanged',
    });
    await expect(
      app.call('resources.report', { ref: entry.ref, basis: entry.basis }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
  } finally {
    await app.close();
  }
});

test('live attachment identity with missing bytes differs from revoked read permission', async () => {
  const root = test.info().outputPath('missing');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { entry, source } = await reportFixture(app, root);
    await rename(join(root, 'paper.md'), join(root, 'paper-preserved.md'));
    assert(source.ref.source === 'library');
    const registered = await app.call('library.attachment', {
      attachmentId: source.ref.attachmentId,
    });
    expect(registered.materialVersionId).toBe(source.ref.materialVersionId);
    const input = { ref: entry.ref, basis: entry.basis };
    expect(await app.call('resources.reportVersion', input)).toEqual({
      state: 'unavailable',
      reason: 'notFound',
    });
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    await expect(app.call('resources.reportVersion', input)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
  } finally {
    await app.close();
  }
});

test('current external report needs no managed save history and malformed UTF8 is rejected', async () => {
  const root = test.info().outputPath('external');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { project, html, manifest } = await reportFixture(app, root);
    await writeFile(join(project.path, 'external.html'), html);
    const current = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'external.html' },
    });
    assert(current.ref.source === 'project');
    expect(
      (
        await app.call('files.changes', {
          projectId: project.id,
          fileId: current.ref.fileId,
        })
      ).changes,
    ).toEqual([]);
    const result = await app.call('resources.reportVersion', {
      ref: current.ref,
      basis: current.basis,
    });
    assert(result.state === 'available');
    expect(result.snapshot.manifest).toEqual(manifest);
    await app.call('resources.save', {
      ref: current.ref,
      basis: current.basis,
      content: html.replace('Fixed dose', 'Managed dose'),
    });
    const beforeOnly = await app.call('resources.reportVersion', {
      ref: current.ref,
      basis: current.basis,
    });
    assert(beforeOnly.state === 'available');
    expect(beforeOnly.snapshot.resource.basis).toBe(current.basis);
    expect(beforeOnly.snapshot.manifest).toEqual(manifest);
    await writeFile(join(project.path, 'invalid.html'), Buffer.from([0xff]));
    const invalid = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'invalid.html' },
    });
    await expect(
      app.call('resources.reportVersion', { ref: invalid.ref, basis: invalid.basis }),
    ).rejects.toMatchObject({
      code: 'invalidRequest',
    });
  } finally {
    await app.close();
  }
});

test('exact-version read rechecks source permission after reading real dependency bytes', async () => {
  const root = test.info().outputPath('revoked');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { entry, manifest } = await reportFixture(app, root);
    const dependency = manifest.resources[0];
    assert(dependency?.ref.source === 'project');
    const fileId = dependency.ref.fileId;
    const read = app.resources.read.bind(app.resources);
    let revoked = false;
    app.resources.read = async (input, context) => {
      const result = await read(input, context);
      if (!revoked && input.ref.source === 'project' && input.ref.fileId === fileId) {
        revoked = true;
        await app.call('library.grant', {
          read: false,
          write: false,
          send: false,
          autoBackup: false,
        });
      }
      return result;
    };
    await expect(
      app.call('resources.reportVersion', { ref: entry.ref, basis: entry.basis }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(revoked).toBe(true);
  } finally {
    await app.close();
  }
});

test('unrelated library read errors cannot approve an unavailable version', async () => {
  const root = test.info().outputPath('read-errors');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { entry } = await reportFixture(app, root);
    for (const error of [
      new OperationError('tooLarge', 'synthetic capacity failure'),
      new OperationError('invalidRequest', 'synthetic request failure'),
      new Error('synthetic provider failure'),
    ]) {
      app.library.readAttachment = async () => {
        throw error;
      };
      await expect(
        app.call('resources.reportVersion', { ref: entry.ref, basis: entry.basis }),
      ).rejects.toBe(error);
    }
  } finally {
    await app.close();
  }
});
