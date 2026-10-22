import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { WebSocket } from 'ws';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import {
  protocolVersion,
  type WorkbenchContextSnapshot,
} from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

test('closing a product connection releases its snapshot without cancelling an admitted resource read', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-workbench-disconnect-'));
  const app = new ManualApplication(join(root, 'profile'));
  await app.initialize();
  const connection = app.connectProduct();
  try {
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    await app.call('files.save', {
      projectId: project.id,
      path: 'note.md',
      content: 'Retained read',
    });
    const resource = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'note.md' },
    });
    const input = { ref: resource.ref, basis: resource.basis, encoding: 'utf8' as const };
    const reading = connection.call('resources.read', input);
    connection.close();
    await expect(reading).resolves.toMatchObject({ data: 'Retained read' });
    await expect(connection.call('resources.read', input)).rejects.toMatchObject({
      code: 'unavailable',
    });
  } finally {
    connection.close();
    await app.close();
  }
});

test('authenticated sockets own bounded snapshots and reliable instruction sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-workbench-context-'));
  const model = await createModelServer();
  model.hold = true;
  const app = new KernelApplication(root, { modelEndpoint: model.url, environment: {} });
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
  const endpoint = { ...status, url: server.url, token: server.token };
  const first = createKernelClient(endpoint);
  const second = createKernelClient(endpoint);
  const raw = new WebSocket(server.url);
  let sequence = 0;
  const request = (method: string, params: unknown) =>
    new Promise<{ result?: unknown; error?: { data: { code: string } } }>((resolve) => {
      const id = ++sequence;
      const receive = (bytes: Buffer) => {
        const value = JSON.parse(bytes.toString());
        if (value.id !== id) return;
        raw.off('message', receive);
        resolve(value);
      };
      raw.on('message', receive);
      raw.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  let persisted:
    | {
        projectId: string;
        sessionId: string;
        instructionId: string;
        source: { connectionId: string };
      }
    | undefined;
  try {
    await Promise.all([
      first.connect(),
      second.connect(),
      new Promise<void>((resolve) => raw.once('open', resolve)),
    ]);
    await request('kernel.authenticate', {
      token: endpoint.token,
      protocolVersion,
      instanceId: status.instanceId,
    });
    await first.call('provider.configure', { apiKey: 'synthetic-test-key' });
    const session = await first.call('session.create', { projectId: 'application' });
    const receiver = { projectId: 'application', sessionId: session.id };
    const snapshot = (revision: number, viewId: string): WorkbenchContextSnapshot => ({
      revision,
      receiver,
      viewId,
      selectedItems: [],
      selections: [],
    });
    await first.call('workbench.context.publish', { snapshot: snapshot(2, 'first') });
    await second.call('workbench.context.publish', { snapshot: snapshot(1, 'second') });
    const input = {
      ...receiver,
      instructionId: randomUUID(),
      text: 'hello',
      materials: [],
    };
    const accepted = await first.call('session.send', input);
    expect(await second.call('session.send', input)).toEqual(accepted);
    const secondInput = { ...input, instructionId: randomUUID(), text: 'another instruction' };
    await second.call('session.send', secondInput);
    const messages = (await app.call('workbench.snapshot', receiver)).messages;
    const source = messages.find((message) => message.id === input.instructionId)?.source;
    const otherSource = messages.find(
      (message) => message.id === secondInput.instructionId,
    )?.source;
    assert(source && otherSource);
    persisted = { ...receiver, instructionId: input.instructionId, source };
    expect(source).not.toEqual(otherSource);
    expect(app.workbenchContexts.read(source, receiver)).toMatchObject({
      state: 'available',
      snapshot: { viewId: 'first', revision: 2 },
    });
    await first.call('workbench.context.publish', { snapshot: snapshot(1, 'stale') });
    expect(app.workbenchContexts.read(source, receiver)).toMatchObject({
      state: 'available',
      snapshot: { revision: 2, viewId: 'first' },
    });
    await first.call('workbench.context.publish', { snapshot: snapshot(3, 'changed after send') });
    expect(app.workbenchContexts.read(source, receiver)).toMatchObject({
      state: 'available',
      snapshot: { viewId: 'changed after send', revision: 3 },
    });
    expect(app.workbenchContexts.read(otherSource, receiver)).toMatchObject({
      state: 'available',
      snapshot: { viewId: 'second' },
    });
    for (const params of [
      { source, snapshot: snapshot(4, 'forged') },
      {
        snapshot: {
          ...snapshot(4, 'large'),
          selectedItems: Array.from({ length: 101 }, (_, i) => String(i)),
        },
      },
      { snapshot: { ...snapshot(4, 'bytes'), selectedItems: ['中'.repeat(24000)] } },
    ])
      expect((await request('workbench.context.publish', params)).error?.data.code).toBe(
        'invalidRequest',
      );
    expect((await request('session.send', { ...input, source })).error?.data.code).toBe(
      'invalidRequest',
    );
    await expect(app.call('workbench.context.publish', { snapshot: null })).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    expect(app.workbenchContexts.read(source, { ...receiver, sessionId: 'other' })).toEqual({
      state: 'unavailable',
      reason: 'receiverMismatch',
    });
    await first.call('workbench.context.publish', { snapshot: null });
    await first.call('workbench.context.publish', { snapshot: snapshot(3, 'stale after clear') });
    expect(app.workbenchContexts.read(source, receiver)).toEqual({
      state: 'unavailable',
      reason: 'noSnapshot',
    });
    first.dispose();
    await expect
      .poll(() => app.workbenchContexts.read(source, receiver))
      .toEqual({ state: 'unavailable', reason: 'disconnected' });
    await second.call('workbench.context.publish', { snapshot: snapshot(2, 'still second') });
    expect(app.workbenchContexts.read(otherSource, receiver)).toMatchObject({
      state: 'available',
      snapshot: { viewId: 'still second' },
    });
    expect(app.workbenchContexts.read(undefined, receiver)).toEqual({
      state: 'unavailable',
      reason: 'noSource',
    });
    const direct = { ...input, instructionId: randomUUID(), text: 'CLI input' };
    await app.call('session.send', direct);
    expect(
      (await app.call('workbench.snapshot', receiver)).messages.find(
        (m) => m.id === direct.instructionId,
      )?.source,
    ).toBeUndefined();
    const interruptedReceipt = {
      ...input,
      instructionId: randomUUID(),
      text: 'Persist before notification failure',
    };
    const unsubscribe = app.subscribe(() => {
      throw new Error('synthetic projection failure');
    });
    try {
      await expect(second.call('session.send', interruptedReceipt)).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
    } finally {
      unsubscribe();
    }
    expect(
      (await app.call('workbench.snapshot', receiver)).messages.filter(
        (message) => message.id === interruptedReceipt.instructionId,
      ),
    ).toHaveLength(1);
    expect(await second.call('session.send', interruptedReceipt)).toMatchObject({
      instructionId: interruptedReceipt.instructionId,
    });
  } finally {
    first.dispose();
    second.dispose();
    raw.close();
    model.release();
    await server.stop();
    await model.close();
  }
  assert(persisted);
  const reopened = new KernelApplication(root, { environment: {} });
  try {
    await reopened.initialize();
    const messages = (
      await reopened.call('workbench.snapshot', {
        projectId: persisted.projectId,
        sessionId: persisted.sessionId,
      })
    ).messages;
    expect(messages.find((message) => message.id === persisted?.instructionId)?.source).toEqual(
      persisted.source,
    );
    expect(reopened.workbenchContexts.read(persisted.source, persisted)).toEqual({
      state: 'unavailable',
      reason: 'disconnected',
    });
  } finally {
    await reopened.close();
  }
});
