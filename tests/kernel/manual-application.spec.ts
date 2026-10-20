import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { PAGE_ONE_TEXT, syntheticPdf } from '../pdf-fixture.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

test('manual foundation serves projects, library and project materials over real RPC', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-manual-'));
  const parent = await mkdtemp(join(tmpdir(), 'scholoom-manual-project-'));
  const projectPath = join(parent, 'project');
  const app = new ManualApplication(root);
  await app.initialize();
  assert(!('harness' in app));
  assert(!('models' in app));
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: root,
    startedAt: new Date().toISOString(),
    state: 'running' as const,
  };
  const server = await startKernelServer(status, () => app.close(), app);
  const client = createKernelClient({ ...status, url: server.url, token: server.token });
  const batchState = async (batchId: string) =>
    (await client.call('library.batch', { batchId })).batch.state;
  try {
    await client.connect();
    const capabilities = (await client.status()).capabilities;
    expect(capabilities).toContain('library.list');
    expect(capabilities).not.toContain('session.create');
    const project = await client.call('project.create', { path: projectPath });
    expect(project.name).toBe('project');
    await client.call('project.grant', {
      projectId: project.id,
      trust: 'restricted',
      autoBackup: false,
    });
    const created = await client.call('files.save', {
      projectId: project.id,
      path: 'notes.md',
      content: '# 人工组合\n',
    });
    expect(created.created).toBe(true);
    const first = await client.call('files.read', { projectId: project.id, path: 'notes.md' });
    expect(first.content).toBe('# 人工组合\n');
    const edited = await client.call('files.save', {
      projectId: project.id,
      path: 'notes.md',
      content: '# 人工组合\n第二行\n',
      basis: first.basis,
    });
    expect(edited.before).toBe('# 人工组合\n');
    expect(
      (await client.call('files.read', { projectId: project.id, path: 'notes.md' })).content,
    ).toBe('# 人工组合\n第二行\n');
    expect(await readFile(join(projectPath, 'notes.md'), 'utf8')).toBe('# 人工组合\n第二行\n');

    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const ingested = await client.call('library.ingest', {
      batchId: randomUUID(),
      json: JSON.stringify([{ title: '人工组合题录', DOI: '10.1234/manual' }]),
      version: 'published',
      origin: 'manual-foundation',
    });
    await expect.poll(() => batchState(ingested.id), { timeout: 20_000 }).toBe('completed');
    const ingestedEntry = (await client.call('library.batch', { batchId: ingested.id })).entries[0];
    assert(ingestedEntry);
    assert(ingestedEntry.sourceId);
    expect(
      (await client.call('library.get', { sourceId: ingestedEntry.sourceId })).metadata.title,
    ).toBe('人工组合题录');
    expect(
      (await client.call('library.list', { query: '人工组合题录' })).sources.map((s) => s.id),
    ).toEqual([ingestedEntry.sourceId]);

    const pdfBytes = syntheticPdf();
    await writeFile(join(projectPath, 'evidence.pdf'), pdfBytes);
    const imported = await client.call('library.importProjectFiles', {
      projectId: project.id,
      batchId: randomUUID(),
      projectPaths: ['evidence.pdf'],
      purpose: '正文',
      version: 'unspecified',
      origin: 'manual-foundation',
    });
    await expect.poll(() => batchState(imported.id), { timeout: 20_000 }).toBe('completed');
    const importedEntry = (await client.call('library.batch', { batchId: imported.id })).entries[0];
    assert(importedEntry);
    assert(importedEntry.sourceId);
    assert(importedEntry.attachmentId);
    const attachment = (
      await client.call('library.attachments', { sourceId: importedEntry.sourceId })
    ).attachments[0];
    assert(attachment);
    const material = {
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    };
    const bytes = await client.call('library.readAttachment', { attachmentId: attachment.id });
    expect(Buffer.from(bytes.base64, 'base64')).toEqual(pdfBytes);
    expect((await client.call('library.pdfInfo', material)).pageCount).toBe(2);
    expect(
      (await client.call('library.readPdfPage', { ...material, pageIndex: 0 })).text,
    ).toContain(PAGE_ONE_TEXT);
    const record = await client.call('library.saveReadingRecord', {
      ...material,
      recordId: randomUUID(),
      kind: 'highlight',
      location: { pageIndex: 0, rects: [{ x: 72, y: 60, width: 145, height: 14 }] },
      quote: PAGE_ONE_TEXT,
      body: '人工组合阅读记录',
    });
    expect(record.createdBy).toEqual({ kind: 'user' });
    expect(await client.call('library.readingRecord', { recordId: record.id })).toMatchObject({
      body: '人工组合阅读记录',
      attachmentId: attachment.id,
    });
    await expect(client.call('session.create', { projectId: project.id })).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(
      (await client.call('library.list', { query: '人工组合题录' })).sources.map((s) => s.id),
    ).toEqual([ingestedEntry.sourceId]);

    const database = new Database(join(projectPath, '.scholoom', 'project.sqlite'));
    try {
      for (const table of ['sessions', 'runs'])
        assert.equal(
          database.prepare(`SELECT count(*) AS total FROM ${table}`).get().total,
          0,
          `${table} 应为空`,
        );
    } finally {
      database.close();
    }
  } finally {
    client.dispose();
    await server.stop();
    await rm(root, { recursive: true });
    await rm(parent, { recursive: true });
  }
});
