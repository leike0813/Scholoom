import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { WebSocket, WebSocketServer } from 'ws';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { KernelEndpoint, OrganizationReceipt } from '../../packages/protocol/dist/index.js';
import { runKernel } from '../kernel-fixture.js';

// Only transport delivery is controlled; all authentication, writes and outcomes stay in the kernel.
async function organizationFault(endpoint: KernelEndpoint, deliver: boolean) {
  const http = createServer();
  const server = new WebSocketServer({ server: http });
  let forwarded = 0;
  let receipt: OrganizationReceipt | undefined;
  server.on('connection', (incoming) => {
    const upstream = new WebSocket(endpoint.url);
    const queued: string[] = [];
    let writeId: number | string | undefined;
    upstream.on('open', () => {
      for (const text of queued) upstream.send(text);
    });
    incoming.on('message', (bytes) => {
      const text = bytes.toString();
      const message = JSON.parse(text);
      if (message.method === 'library.organize') {
        writeId = message.id;
        if (!deliver) {
          incoming.terminate();
          upstream.terminate();
          return;
        }
        forwarded++;
      }
      if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
      else queued.push(text);
    });
    upstream.on('message', (bytes) => {
      const text = bytes.toString();
      const message = JSON.parse(text);
      if (writeId !== undefined && message.id === writeId) {
        receipt = message.result;
        incoming.terminate();
        upstream.terminate();
        return;
      }
      if (incoming.readyState === WebSocket.OPEN) incoming.send(text);
    });
    incoming.on('error', () => {});
    upstream.on('error', () => incoming.terminate());
    incoming.on('close', () => upstream.terminate());
    upstream.on('close', () => incoming.close());
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const address = http.address() as AddressInfo;
  const client = createKernelClient({ ...endpoint, url: `ws://127.0.0.1:${address.port}/` });
  return {
    client,
    facts: () => ({ forwarded, receipt }),
    close: async () => {
      client.dispose();
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

async function start(directory: string) {
  const running = await runKernel(directory, 'start');
  assert(running.state === 'running', JSON.stringify({ state: running.state }));
  const client = createKernelClient(running.endpoint);
  await client.connect();
  return {
    endpoint: running.endpoint,
    client,
    stop: async () => {
      try {
        expect((await client.status()).instanceId).toBe(running.endpoint.instanceId);
        await client.shutdown();
        await expect.poll(async () => (await runKernel(directory, 'status')).state).toBe('stopped');
      } finally {
        client.dispose();
      }
    },
  };
}

test('public organization RPC preserves frozen outcomes across real restart and independent backup restore', async () => {
  const info = test.info();
  const root = info.outputPath('isolated');
  const profile = join(root, 'profile');
  await mkdir(profile, { recursive: true });
  info.annotations.push({ type: 'isolated-fixture', description: root });
  let kernel: Awaited<ReturnType<typeof start>> | undefined;
  let copy: Awaited<ReturnType<typeof start>> | undefined;
  let gate: Awaited<ReturnType<typeof organizationFault>> | undefined;
  try {
    kernel = await start(profile);
    const firstEndpoint = kernel.endpoint;
    const port = kernel.client;
    expect((await port.status()).capabilities).toEqual(
      expect.arrayContaining([
        'library.organize',
        'library.organizationResult',
        'library.organizationEdit',
        'library.revertOrganization',
      ]),
    );
    await port.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const libraryId = (await port.call('library.status', {})).id;
    const batch = await port.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'independent-rpc-sample',
      version: 'published',
      json: JSON.stringify([
        { title: 'RPC alpha', extension: { nested: ['retained', { flag: true }] } },
        { title: 'RPC beta' },
      ]),
    });
    await expect
      .poll(async () => (await port.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const rows = (await port.call('library.list', {})).sources;
    const a = rows.find((s) => s.metadata.title === 'RPC alpha'),
      b = rows.find((s) => s.metadata.title === 'RPC beta');
    assert(a && b);
    const instance = await port.call('library.createSourceInstance', {
      libraryId,
      requestId: randomUUID(),
      label: 'Independent original',
    });
    const authority = {
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: a.id,
          revision: a.revision,
          original: {
            identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: 'RPC00001' },
            schemaVersion: '44',
            itemType: 'journalArticle',
            fields: { title: 'Original untouched', extra: 'unknown line' },
            creators: [{ lastName: 'Institute', fieldMode: 1 }],
            relations: {},
          },
          key: { value: 'PinnedRpc2026', pinned: true, intent: 'explicit' as const },
        },
      ],
    };
    const authorityReceipt = await port.call('library.commitRecords', authority);
    const original = authority.changes[0]?.original;
    assert(original);
    expect(authorityReceipt.state).toBe('committed');
    const file = join(root, 'evidence.txt');
    await writeFile(file, 'Independent preserved organization evidence');
    const imported = await port.call('library.importFiles', {
      batchId: randomUUID(),
      sourceId: a.id,
      paths: [file],
      purpose: 'evidence',
      version: 'published',
      origin: 'independent-rpc-sample',
    });
    await expect
      .poll(async () => (await port.call('library.batch', { batchId: imported.id })).batch.state)
      .toBe('completed');
    const attachments = (await port.call('library.attachments', { sourceId: a.id })).attachments;
    const attachment = attachments[0];
    assert(attachment);
    const note = await port.call('library.saveReadingRecord', {
      recordId: randomUUID(),
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
      kind: 'note',
      quote: '',
      body: 'Preserve this reading work',
    });
    const alpha = await port.call('library.saveCollection', { name: 'alpha' });
    const beta = await port.call('library.saveCollection', { name: 'beta' });
    const before = await port.call('library.get', { sourceId: a.id });
    const frozen = {
      libraryId,
      requestId: randomUUID(),
      changes: [
        {
          sourceId: a.id,
          revision: before.revision,
          collectionIds: [alpha.id, beta.id],
          tags: ['organized'],
        },
        { sourceId: b.id, revision: b.revision, tags: ['second'] },
      ],
    };
    gate = await organizationFault(kernel.endpoint, true);
    await gate.client.connect();
    await expect(gate.client.call('library.organize', frozen)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    const lost = gate.facts();
    expect(lost.forwarded).toBe(1);
    expect(lost.receipt).toMatchObject({
      state: 'committed',
      results: [{ status: 'applied' }, { status: 'applied' }],
    });
    await gate.close();
    gate = undefined;
    const undelivered = {
      libraryId,
      requestId: randomUUID(),
      changes: [{ sourceId: a.id, revision: before.revision + 1, tags: ['must-not-replay'] }],
    };
    gate = await organizationFault(kernel.endpoint, false);
    await gate.client.connect();
    await expect(gate.client.call('library.organize', undelivered)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    expect(gate.facts()).toEqual({ forwarded: 0, receipt: undefined });
    await gate.close();
    gate = undefined;
    await kernel.stop();
    kernel = undefined;

    kernel = await start(profile);
    expect(kernel.endpoint.instanceId).not.toBe(firstEndpoint.instanceId);
    expect(kernel.endpoint.processId).not.toBe(firstEndpoint.processId);
    const restarted = kernel.client;
    expect(
      await restarted.call('library.organizationResult', {
        libraryId,
        requestId: frozen.requestId,
      }),
    ).toEqual({ libraryId, outcome: lost.receipt });
    expect(
      await restarted.call('library.organizationResult', {
        libraryId,
        requestId: undelivered.requestId,
      }),
    ).toEqual({ libraryId, outcome: { requestId: undelivered.requestId, state: 'notFound' } });
    expect((await restarted.call('library.get', { sourceId: a.id })).revision).toBe(
      before.revision + 1,
    );
    const query = { libraryId, editRequestId: frozen.requestId };
    const page = await restarted.call('library.organizationEdit', { ...query, limit: 1 });
    expect(page).toMatchObject({ editRevision: 1, position: 'applied', nextOffset: 1 });
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(524288);
    const remaining = await restarted.call('library.organizationEdit', {
      ...query,
      offset: 1,
      expectedEditRevision: 1,
    });
    expect([...page.changes, ...remaining.changes]).toEqual(
      expect.arrayContaining([
        { sourceId: a.id, field: 'tags', value: 'organized', before: false, after: true },
        { sourceId: a.id, field: 'collectionIds', value: alpha.id, before: false, after: true },
        { sourceId: a.id, field: 'collectionIds', value: beta.id, before: false, after: true },
        { sourceId: b.id, field: 'tags', value: 'second', before: false, after: true },
      ]),
    );
    const undo = {
      ...query,
      requestId: randomUUID(),
      expectedEditRevision: 1,
      direction: 'undo' as const,
    };
    expect((await restarted.call('library.revertOrganization', undo)).state).toBe('committed');
    expect(await restarted.call('library.organize', frozen)).toEqual(lost.receipt);
    expect((await restarted.call('library.get', { sourceId: a.id })).tags).toEqual([]);
    expect(
      (
        await restarted.call('library.revertOrganization', {
          ...undo,
          requestId: randomUUID(),
          expectedEditRevision: 2,
          direction: 'redo',
        })
      ).state,
    ).toBe('committed');
    const backup = await restarted.call('library.backup', {});
    const applied = await restarted.call('library.get', { sourceId: a.id });
    const later = await restarted.call('library.update', {
      sourceId: a.id,
      revision: applied.revision,
      metadata: { ...applied.metadata, title: 'Later original work' },
      tags: applied.tags,
      collectionIds: applied.collectionIds,
      relatedIds: applied.relatedIds,
    });
    expect(
      await restarted.call('library.revertOrganization', {
        ...undo,
        requestId: randomUUID(),
        expectedEditRevision: 3,
      }),
    ).toMatchObject({
      state: 'rejected',
      results: [{ status: 'blocked', error: { code: 'contentChanged' } }, { status: 'notApplied' }],
    });
    const copyDirectory = join(root, 'copy');
    expect(
      await restarted.call('library.restore', { backupId: backup.id, destination: copyDirectory }),
    ).toEqual({ directory: copyDirectory });
    copy = await start(copyDirectory);
    const restored = copy.client;
    const copyStatus = await restored.call('library.status', {});
    expect(copyStatus).toMatchObject({ read: true, write: false, send: false });
    expect(copyStatus.id).not.toBe(libraryId);
    const copyQuery = { libraryId: copyStatus.id, editRequestId: frozen.requestId };
    expect(
      await restored.call('library.organizationResult', {
        libraryId: copyStatus.id,
        requestId: frozen.requestId,
      }),
    ).toEqual({ libraryId: copyStatus.id, outcome: lost.receipt });
    expect(await restored.call('library.organizationEdit', copyQuery)).toMatchObject({
      editRevision: 3,
      originLibraryId: libraryId,
      eligibility: { eligible: false, error: { code: 'instanceMismatch' } },
    });
    await expect(
      restored.call('library.revertOrganization', {
        ...undo,
        ...copyQuery,
        requestId: randomUUID(),
        expectedEditRevision: 3,
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await restored.call('library.grant', {
      read: true,
      write: true,
      send: false,
      autoBackup: false,
    });
    expect(
      await restored.call('library.revertOrganization', {
        ...undo,
        ...copyQuery,
        requestId: randomUUID(),
        expectedEditRevision: 3,
      }),
    ).toMatchObject({ state: 'rejected', error: { code: 'instanceMismatch' } });
    await expect(restored.call('library.organize', frozen)).rejects.toMatchObject({
      code: 'instanceMismatch',
    });
    expect(await restored.call('library.get', { sourceId: a.id })).toEqual(applied);
    expect(await restored.call('library.readingRecord', { recordId: note.id })).toEqual(note);
    expect((await restored.call('library.attachments', { sourceId: a.id })).attachments).toEqual(
      attachments,
    );
    expect(
      await restored.call('library.record', { libraryId: copyStatus.id, sourceId: a.id }),
    ).toMatchObject({
      citationKey: { value: 'PinnedRpc2026', pinned: true },
      originals: [original],
    });
    const bytes = await restored.call('library.readAttachment', { attachmentId: attachment.id });
    expect(bytes.materialVersionId).toBe(attachment.materialVersionId);
    expect(Buffer.from(bytes.base64, 'base64').toString('utf8')).toBe(
      'Independent preserved organization evidence',
    );
    expect(
      await restored.call('library.commitResult', {
        libraryId: copyStatus.id,
        requestId: authority.requestId,
      }),
    ).toEqual(authorityReceipt);
    expect(
      (
        await restored.call('library.organize', {
          libraryId: copyStatus.id,
          requestId: randomUUID(),
          changes: [{ sourceId: a.id, revision: applied.revision, tags: ['copy-only'] }],
        })
      ).state,
    ).toBe('committed');
    expect(await restarted.call('library.get', { sourceId: a.id })).toEqual(later);
    const history = (await restarted.call('library.history', { sourceId: a.id })).sources;
    expect(history.find((source) => source.revision === applied.revision)).toMatchObject({
      id: applied.id,
      revision: applied.revision,
      metadata: applied.metadata,
      tags: applied.tags,
      collectionIds: applied.collectionIds,
      relatedIds: applied.relatedIds,
      origins: applied.origins,
    });
    await restarted.call('library.grant', {
      read: false,
      write: false,
      send: false,
      autoBackup: false,
    });
    await expect(
      restarted.call('library.organizationResult', { libraryId, requestId: undelivered.requestId }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await restarted.call('library.grant', {
      read: true,
      write: true,
      send: false,
      autoBackup: false,
    });
    await expect(
      restarted.call('library.organizationResult', {
        libraryId: copyStatus.id,
        requestId: undelivered.requestId,
      }),
    ).rejects.toMatchObject({ code: 'instanceMismatch' });
    expect(
      await restarted.call('library.commitResult', { libraryId, requestId: authority.requestId }),
    ).toEqual(authorityReceipt);
  } finally {
    await gate?.close();
    try {
      await copy?.stop();
    } finally {
      await kernel?.stop();
    }
  }
});
