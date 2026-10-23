import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { epubFixture } from '../document-fixture.js';
import { createModelServer } from '../model-server.js';

test('real client, broker and Agent read shared EPUB text and user records without a window', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-document-rpc-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  await app.initialize();
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
  try {
    await client.connect();
    await client.call('project.grant', {
      projectId: 'application',
      trust: 'trusted',
      autoBackup: false,
    });
    await client.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const path = join(root, 'evidence.epub');
    await writeFile(path, epubFixture());
    const batch = await client.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'synthetic-document-rpc',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const receipt = (await client.call('library.batch', { batchId: batch.id })).entries[0];
    assert(receipt?.sourceId);
    const attachment = (await client.call('library.attachments', { sourceId: receipt.sourceId }))
      .attachments[0];
    assert(attachment);
    const ref = { attachmentId: attachment.id, materialVersionId: attachment.materialVersionId };
    await client.call('library.saveReadingRecord', {
      ...ref,
      recordId: randomUUID(),
      kind: 'note',
      quote: '',
      body: 'User document interpretation',
    });
    const session = await client.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    const recordId = randomUUID();
    await client.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: `MODEL_DOCUMENT_RECORD ${ref.attachmentId} ${ref.materialVersionId} ${recordId}`,
      materials: [],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', scope)).run?.state, {
        timeout: 20_000,
      })
      .toBe('completed');
    expect(await client.call('library.readingRecord', { recordId })).toMatchObject({
      body: 'Agent document interpretation',
      createdBy: { kind: 'agent', sessionId: session.id },
    });
    const sent = JSON.stringify(model.requests);
    expect(sent).toContain('Second chapter result 73');
    expect(sent).toContain('User document interpretation');
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const before = model.requests.length;
    await client.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '不得重新外发已读材料',
      materials: [],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', scope)).run?.state)
      .toBe('failed');
    expect(model.requests).toHaveLength(before);
  } finally {
    client.dispose();
    await server.stop();
    await app.close();
    await model.close();
  }
});

test('blocked document calculation can be stopped while the host responds and a later read succeeds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-document-isolation-'));
  const app = new KernelApplication(root);
  const start = ManagedNode.start;
  let child: ManagedNode | undefined;
  let blocked!: () => void;
  const blocking = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  let pending: Promise<unknown> | undefined;
  try {
    await app.initialize();
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const path = join(root, 'book.epub');
    await writeFile(path, epubFixture());
    const batch = await app.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'synthetic-document-isolation',
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const receipt = (await app.call('library.batch', { batchId: batch.id })).entries[0];
    assert(receipt?.sourceId);
    const attachment = (await app.call('library.attachments', { sourceId: receipt.sourceId }))
      .attachments[0];
    assert(attachment);
    const ref = { attachmentId: attachment.id, materialVersionId: attachment.materialVersionId };
    ManagedNode.start = async (options) => {
      const fault = options.entry.pathname.endsWith('/document-execution.js');
      const owned = await start({
        ...options,
        ...(fault
          ? { entry: new URL('../fixtures/pdf-process/blocked.mjs', import.meta.url) }
          : {}),
      });
      if (fault) {
        child = owned;
        owned.on('message', (value: { kind?: string }) => {
          if (value.kind === 'blocked') blocked();
        });
      }
      return owned;
    };
    pending = app.call('library.documentInfo', ref).then(
      () => 'unexpected-success',
      (error: { code: string }) => error.code,
    );
    await blocking;
    expect((await app.call('library.status', {})).read).toBe(true);
    assert(child);
    await child.stop();
    expect(await pending).toBe('unavailable');
    ManagedNode.start = start;
    expect(await app.call('library.documentInfo', ref)).toMatchObject({ sectionCount: 2 });
  } finally {
    ManagedNode.start = start;
    await child?.stop();
    await pending;
    await app.close();
  }
});
