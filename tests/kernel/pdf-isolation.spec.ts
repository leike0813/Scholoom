import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import { createModelServer } from '../model-server.js';
import { syntheticPdf } from '../pdf-fixture.js';

test('a blocked PDF calculation leaves host, library and another session responsive and the next PDF succeeds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-pdf-isolation-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const start = ManagedNode.start;
  let computation: ManagedNode | undefined;
  let blocked!: () => void;
  const blocking = new Promise<void>((resolve) => {
    blocked = resolve;
  });
  let pending: Promise<string> | undefined;
  try {
    await app.initialize();
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const bytes = syntheticPdf();
    const path = join(root, 'evidence.pdf');
    await writeFile(path, bytes);
    const imported = await app.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      version: 'unspecified',
      origin: 'pdf-isolation',
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: imported.id })).batch.state)
      .toBe('completed');
    const receipt = (await app.call('library.batch', { batchId: imported.id })).entries[0];
    assert(receipt?.sourceId && receipt.attachmentId);
    const attachment = (await app.call('library.attachments', { sourceId: receipt.sourceId }))
      .attachments[0];
    assert(attachment);
    const reference = {
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    };
    ManagedNode.start = async (options) => {
      const fault = options.entry.pathname.endsWith('/pdf-execution.js');
      const child = await start({
        ...options,
        ...(fault
          ? { entry: new URL('../fixtures/pdf-process/blocked.mjs', import.meta.url) }
          : {}),
      });
      if (fault) {
        computation = child;
        child.on('message', (value: { kind?: string }) => {
          if (value.kind === 'blocked') blocked();
        });
      }
      return child;
    };
    pending = app.call('library.pdfInfo', reference).then(
      () => 'completed',
      (error: { code: string }) => error.code,
    );
    await blocking;
    expect((await app.call('library.get', { sourceId: receipt.sourceId })).id).toBe(
      receipt.sourceId,
    );
    expect((await app.call('library.status', {})).read).toBe(true);
    const session = await app.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT unrelated to blocked PDF',
      materials: [],
    });
    await expect
      .poll(async () => (await app.call('workbench.snapshot', scope)).run?.state)
      .toBe('completed');
    assert(computation?.identity);
    const pid = computation.identity.pid;
    expect(() => process.kill(pid, 0)).not.toThrow();
    await computation.stop();
    expect(await pending).toBe('unavailable');
    expect(() => process.kill(pid, 0)).toThrow();
    ManagedNode.start = start;
    expect((await app.call('library.pdfInfo', reference)).pageCount).toBe(2);
    expect(
      Buffer.from(
        (await app.call('library.readAttachment', { attachmentId: attachment.id })).base64,
        'base64',
      ),
    ).toEqual(bytes);
  } finally {
    ManagedNode.start = start;
    await computation?.stop();
    await pending;
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
