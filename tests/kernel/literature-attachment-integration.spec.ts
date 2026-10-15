import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

test('real RPC and Agent share material bytes while project paths and model sends remain authorized', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-rpc-'));
  const projectRoot = await mkdtemp(join(tmpdir(), 'scholoom-material-project-'));
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
    await writeFile(join(projectRoot, 'input.txt'), 'shared material 42\n');
    const project = await client.call('project.open', { path: projectRoot });
    await client.call('project.grant', {
      projectId: project.id,
      read: true,
      write: false,
      send: true,
      autoBackup: false,
    });
    await client.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const session = await client.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await client.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_ATTACHMENT_IMPORT',
      materials: [],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', scope)).run?.state)
      .toBe('completed');
    await expect
      .poll(
        async () =>
          (await client.call('library.batch', { batchId: 'model-file-batch' })).batch.state,
      )
      .toBe('completed');
    const receipt = (await client.call('library.batch', { batchId: 'model-file-batch' }))
      .entries[0];
    assert(receipt?.sourceId && receipt.attachmentId);
    expect(receipt.state).toBe('created');
    const files = await client.call('library.attachments', { sourceId: receipt.sourceId });
    expect(files.attachments[0]?.id).toBe(receipt.attachmentId);
    expect(
      Buffer.from(
        (await client.call('library.readAttachment', { attachmentId: receipt.attachmentId }))
          .base64,
        'base64',
      ).toString(),
    ).toBe('shared material 42\n');
    const names = ((model.requests[0]?.tools ?? []) as { name: string }[]).map((tool) => tool.name);
    expect(names).toContain('library_importProjectFiles');
    expect(names).not.toContain('library_importFiles');
    expect(names).not.toContain('library_relocateAttachment');
    const reader = await client.call('session.create', { projectId: project.id });
    const readScope = { projectId: project.id, sessionId: reader.id };
    await client.call('session.send', {
      ...readScope,
      instructionId: randomUUID(),
      text: `MODEL_ATTACHMENT_READ ${receipt.attachmentId}`,
      materials: [],
    });
    await expect
      .poll(async () => (await client.call('workbench.snapshot', readScope)).run?.state)
      .toBe('completed');
    const tool = (await client.call('workbench.snapshot', readScope)).messages.find(
      (message) => message.tool?.name === 'library_readAttachment',
    );
    expect(tool?.state).toBe('complete');
    expect(JSON.stringify(model.requests.at(-1))).toContain(
      Buffer.from('shared material 42\n').toString('base64'),
    );
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const requests = model.requests.length;
    await client.call('session.resume', readScope);
    await expect
      .poll(async () => (await client.call('workbench.snapshot', readScope)).run?.state)
      .toBe('failed');
    expect(model.requests).toHaveLength(requests);
    const denied = await client.call('library.importProjectFiles', {
      projectId: project.id,
      batchId: randomUUID(),
      projectPaths: ['../outside.txt', 'input.txt'],
      purpose: '正文',
      version: 'unspecified',
      origin: 'synthetic',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: denied.id })).batch.state)
      .toBe('completed');
    expect((await client.call('library.batch', { batchId: denied.id })).batch).toMatchObject({
      processed: 2,
      failed: 1,
    });
    await client.call('library.grant', {
      read: false,
      write: true,
      send: false,
      autoBackup: false,
    });
    await expect(
      client.call('library.readAttachment', { attachmentId: receipt.attachmentId }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
  } finally {
    client.dispose();
    await server.stop();
    await model.close();
    await rm(root, { recursive: true });
    await rm(projectRoot, { recursive: true });
  }
});
