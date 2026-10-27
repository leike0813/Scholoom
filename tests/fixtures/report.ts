import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import type { ManualApplication } from '../../apps/kernel/dist/manual.js';

export async function reportFixture(app: ManualApplication, root: string) {
  const project = await app.call('project.create', {
    path: join(root, 'project'),
    trust: 'trusted',
  });
  await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
  const path = join(root, 'paper.md');
  await writeFile(path, '# Source\nDose 10 and 20.\n');
  const batch = await app.call('library.importFiles', {
    batchId: randomUUID(),
    paths: [path],
    storage: 'linked',
    purpose: '正文',
    version: 'unspecified',
    origin: 'isolated-report-test',
  });
  await expect
    .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
    .toBe('completed');
  const receipt = (await app.call('library.batch', { batchId: batch.id })).entries[0];
  assert(receipt?.attachmentId);
  const attachment = await app.call('library.attachment', { attachmentId: receipt.attachmentId });
  const source = await app.call('resources.describe', {
    locator: {
      source: 'library',
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    },
  });
  await mkdir(join(project.path, 'assets'));
  await app.call('files.save', {
    projectId: project.id,
    path: 'assets/data.json',
    content: '[10,20]',
  });
  const data = await app.call('resources.describe', {
    locator: {
      source: 'project',
      projectId: project.id,
      path: 'assets/data.json',
    },
  });
  const manifest = {
    version: 1,
    resources: [
      {
        path: 'assets/data.json',
        ref: data.ref,
        basis: data.basis,
        mediaType: 'application/json',
      },
    ],
    sources: [{ ref: source.ref, basis: source.basis }],
    objects: [
      {
        objectId: 'dose',
        name: 'Doses',
        semantics: 'Compare dose 10 and 20',
        sourceIndexes: [0],
      },
    ],
  };
  // Independent wire sample; the production encoder is not the expected-value oracle.
  const html = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>Fixed dose comparison</body></html>`;
  await app.call('files.save', { projectId: project.id, path: 'report.html', content: html });
  const entry = await app.call('resources.describe', {
    locator: {
      source: 'project',
      projectId: project.id,
      path: 'report.html',
    },
  });
  return { project, source, entry, manifest, html };
}
