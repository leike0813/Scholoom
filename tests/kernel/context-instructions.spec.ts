import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { SqliteSaver } from '../../apps/kernel/node_modules/@langchain/langgraph-checkpoint-sqlite/dist/index.js';
import { openCheckpoint } from '../../packages/harness/dist/node.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type {
  CallContext,
  ContextItem,
  ResourceDescriptor,
  ResourceEvidence,
  ResourceLocator,
} from '../../packages/protocol/dist/index.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { createModelServer, type ModelServer } from '../model-server.js';

const projectRef = {
  source: 'project' as const,
  projectId: 'application',
  fileId: 'fixture-source',
};

/** Test-only resource double: identity describes are fixtures and resource bytes are never read. */
function resourceFixture(model: ModelServer) {
  const grant = { read: true, send: true };
  const basis = { value: 'basis-1' };
  const checks: number[] = [];
  const contexts: CallContext[] = [];
  const options = {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    contextResources: (context: CallContext) => {
      contexts.push(context);
      return {
        port: {
          describe: async (locator: ResourceLocator): Promise<ResourceDescriptor> => {
            if (locator.source !== 'project' || !('fileId' in locator))
              throw new OperationError('invalidRequest', 'fixture only describes project refs');
            return {
              ref: {
                source: 'project',
                projectId: locator.projectId,
                fileId: locator.fileId,
              },
              name: 'fixture.md',
              path: 'fixture.md',
              basis: basis.value,
              format: 'text',
              capabilities: { read: true, write: false, readingRecords: false, render: false },
            };
          },
        },
        check: (evidence: readonly ResourceEvidence[]) => {
          if (!grant.read || !grant.send)
            throw new OperationError('permissionDenied', 'fixture grants revoked');
          checks.push(evidence.length);
        },
      };
    },
  };
  return { options, grant, basis, checks, contexts };
}

function allContextItems(): ContextItem[] {
  return [
    {
      kind: 'resource',
      itemId: 'resource-item',
      ref: projectRef,
      basis: 'basis-1',
      comment: 'resource_comment_73',
    },
    {
      kind: 'text',
      itemId: 'text-item',
      ref: projectRef,
      basis: 'basis-1',
      quote: 'saved_quote_73',
      contentState: 'saved',
      location: { pageIndex: 2, rects: [{ x: 10, y: 20, width: 30, height: 40 }] },
      comment: 'text_comment_73',
    },
    {
      kind: 'region',
      itemId: 'region-item',
      ref: projectRef,
      basis: 'basis-1',
      region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      target: { kind: 'image' },
      comment: 'region_comment_73',
    },
    {
      kind: 'object',
      itemId: 'object-item',
      ref: projectRef,
      basis: 'basis-1',
      providerId: 'fixture-provider',
      objectId: 'fixture-object',
      name: 'fixture object',
      semantics: 'object_semantics_73',
      contentState: 'draft',
      comment: 'object_comment_73',
    },
  ];
}

function textContextItems(basis = 'basis-1'): ContextItem[] {
  return [
    {
      kind: 'text',
      itemId: 'saved-text',
      ref: projectRef,
      basis,
      quote: 'explicit_saved_excerpt_73',
      contentState: 'saved',
      comment: 'explicit_saved_comment_73',
    },
    {
      kind: 'text',
      itemId: 'draft-text',
      ref: projectRef,
      basis,
      quote: 'explicit_draft_excerpt_91',
      contentState: 'draft',
      comment: 'explicit_draft_comment_91',
    },
  ];
}

function reordered<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reordered) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, item]) => [key, reordered(item)]),
    ) as T;
  return value;
}

async function checkpointInstructions(internal: string, runId: string): Promise<unknown> {
  const opened = await openCheckpoint(internal, runId);
  try {
    const saved = await new SqliteSaver(opened.database).getTuple({
      configurable: { thread_id: runId },
    });
    return saved?.checkpoint.channel_values.instructions;
  } finally {
    opened.database.close();
  }
}

test('explicit context items require a real resource identity before acceptance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-unavailable-'));
  const app = new KernelApplication(root, { environment: {} });
  try {
    await app.initialize();
    const session = await app.call('session.create', { projectId: 'application' });
    const instructionId = randomUUID();
    await expect(
      app.call('session.send', {
        projectId: 'application',
        sessionId: session.id,
        instructionId,
        text: 'MODEL_CHAT unavailable context adapter',
        materials: [],
        contextItems: textContextItems(),
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    const snapshot = await app.snapshot({ projectId: 'application', sessionId: session.id });
    expect(snapshot.messages.filter((message) => message.id === instructionId)).toHaveLength(0);
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('instructions beyond the current advancement capacity keep their receipt and run next', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-capacity-'));
  const model = await createModelServer({
    respond: ({ calls }) =>
      calls.includes('read_work_domain')
        ? { text: 'Current advancement complete.' }
        : { tool: { name: 'read_work_domain', input: {} } },
  });
  model.hold = true;
  const app = new (class extends KernelApplication {
    occupy() {
      return this.processes.reserve();
    }
  })(root, { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } });
  const holds = Array.from({ length: 4 }, () => app.occupy());
  try {
    await Promise.all(holds.map((hold) => hold.ready));
    await app.initialize();
    const session = await app.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    const ids = Array.from({ length: 100 }, () => randomUUID());
    let originalRunId = '';
    for (const instructionId of ids) {
      const receipt = await app.call('session.send', {
        ...scope,
        instructionId,
        text: 'MODEL_CHAT synthetic queued instruction',
        materials: [],
      });
      originalRunId ||= receipt.runId;
      expect(receipt.runId).toBe(originalRunId);
    }
    for (const hold of holds) hold.release();
    await expect.poll(() => model.requests.length).toBe(1);
    const overflow = {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT next advancement instruction',
      materials: [],
    };
    const receipt = await app.call('session.send', overflow);
    expect(receipt.runId).toBe(originalRunId);
    model.release();
    await expect
      .poll(
        async () => {
          const { run } = await app.snapshot(scope);
          return run?.state === 'completed' && run.id !== originalRunId;
        },
        { timeout: 20000 },
      )
      .toBe(true);
    const current = (await app.snapshot(scope)).run;
    const internal = app.projects.get('application').internal;
    expect(await checkpointInstructions(internal, originalRunId)).toEqual(
      ids.map((instructionId) => ({ instructionId })),
    );
    expect(await checkpointInstructions(internal, current?.id ?? '')).toEqual([
      { instructionId: overflow.instructionId },
    ]);
    expect(await app.call('session.send', overflow)).toEqual(receipt);
  } finally {
    for (const hold of holds) hold.release();
    model.release();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

for (const kind of ['text', 'context', 'transfer'] as const) {
  test(`large ordinary Agent ${kind} updates retain complete payloads through model IPC and restart`, async () => {
    test.setTimeout(90000);
    const root = await mkdtemp(join(tmpdir(), 'scholoom-context-large-'));
    const model = await createModelServer({
      maxBodyBytes: 8 * 1024 * 1024,
      respond: ({ calls }) =>
        calls.includes('read_work_domain')
          ? { text: 'Complete instruction batch received.' }
          : { tool: { name: 'read_work_domain', input: {} } },
    });
    const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
    const app = new (class extends KernelApplication {
      occupy() {
        return this.processes.reserve();
      }
    })(join(root, 'profile'), options);
    const holds = Array.from({ length: 4 }, () => app.occupy());
    let reopened: KernelApplication | undefined;
    let active: KernelApplication = app;
    const start = ManagedNode.start;
    const frames: { method: string; bytes: number; elapsed: number }[] = [];
    const started = Date.now();
    let updates = 0;
    ManagedNode.start = async (options) => {
      const child = await start(options);
      const send = child.send.bind(child);
      child.send = (frame) => {
        if (
          frame &&
          typeof frame === 'object' &&
          'method' in frame &&
          typeof frame.method === 'string'
        )
          frames.push({
            method: frame.method,
            bytes: Buffer.byteLength(JSON.stringify(frame)),
            elapsed: Date.now() - started,
          });
        if (
          kind === 'transfer' &&
          frame &&
          typeof frame === 'object' &&
          'method' in frame &&
          frame.method === 'execution.modelUpdate' &&
          ++updates === 2
        )
          return Promise.reject(new OperationError('unavailable', 'synthetic incomplete update'));
        return send(frame);
      };
      return child;
    };
    try {
      await Promise.all(holds.map((hold) => hold.ready));
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'target'),
        trust: 'trusted',
      });
      await app.call('files.save', {
        projectId: project.id,
        path: 'input.txt',
        content: 'real resource evidence',
      });
      const resource = await app.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path: 'input.txt' },
      });
      const session = await app.call('session.create', { projectId: 'application' });
      const scope = { projectId: 'application', sessionId: session.id };
      const inputs = Array.from({ length: kind === 'text' ? 70 : 24 }, (_, index) => ({
        ...scope,
        instructionId: randomUUID(),
        text: `MODEL_CHAT large_${index}_`.padEnd(kind === 'text' ? 32768 : 128, 'x'),
        materials: [],
        ...(kind !== 'text'
          ? {
              contextItems: Array.from(
                { length: 7 },
                (_, item): ContextItem => ({
                  kind: 'text',
                  itemId: randomUUID(),
                  ref: resource.ref,
                  basis: resource.basis,
                  quote: `draft_${index}_${item}_`.padEnd(8192, 'y'),
                  contentState: 'draft',
                }),
              ),
            }
          : {}),
      }));
      const receipts = [];
      for (const input of inputs) receipts.push(await app.call('session.send', input));
      for (const hold of holds) hold.release();
      if (kind === 'transfer') {
        await expect
          .poll(
            async () =>
              ['failed', 'interrupted'].includes((await app.snapshot(scope)).run?.state ?? ''),
            { timeout: 30000 },
          )
          .toBe(true);
        expect(model.requests).toHaveLength(0);
        expect(
          (await app.snapshot(scope)).messages
            .filter((message) => message.role === 'user')
            .every((message) => message.state === 'accepted'),
        ).toBe(true);
        await app.close();
        ManagedNode.start = start;
        reopened = new KernelApplication(join(root, 'profile'), options);
        await reopened.initialize();
        active = reopened;
        const recovery = {
          ...scope,
          instructionId: randomUUID(),
          text: 'MODEL_CHAT recover complete update',
          materials: [],
        };
        inputs.push(recovery);
        receipts.push(await active.call('session.send', recovery));
      }
      await expect
        .poll(async () => (await active.snapshot(scope)).run?.state, { timeout: 30000 })
        .toBe('completed');
      const sent = model.requests.map((request) => JSON.stringify(request.messages));
      for (const input of inputs)
        expect(sent.some((request) => request.includes(input.text))).toBe(true);
      const completed = (await active.snapshot(scope)).run;
      assert(completed);
      expect(
        await checkpointInstructions(active.projects.get('application').internal, completed.id),
      ).toEqual(
        inputs.map(({ instructionId, contextItems }) => ({
          instructionId,
          ...(contextItems ? { contextItems } : {}),
        })),
      );
      await active.close();
      reopened = new KernelApplication(join(root, 'profile'), options);
      await reopened.initialize();
      for (const [index, input] of inputs.entries())
        expect(await reopened.call('session.send', input)).toEqual(receipts[index]);
      expect(
        (await reopened.snapshot(scope)).messages
          .filter((message) => message.role === 'user')
          .every((message) => message.state === 'consumed'),
      ).toBe(true);
    } finally {
      ManagedNode.start = start;
      await test.info().attach('instruction-ipc', {
        body: JSON.stringify(frames),
        contentType: 'application/json',
      });
      for (const hold of holds) hold.release();
      await app.close();
      await reopened?.close();
      await model.close();
    }
  });
}

test('server persists all context item kinds and keeps their original source across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-persist-'));
  const model = await createModelServer();
  const fixture = resourceFixture(model);
  let app = new KernelApplication(root, fixture.options);
  try {
    await app.initialize();
    const product = app.connectProduct();
    const session = await product.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    const instructionId = randomUUID();
    const contextItems = allContextItems();
    const input = {
      ...scope,
      instructionId,
      text: 'MODEL_CHAT all explicit context kinds',
      materials: [],
      contextItems,
    };
    try {
      const receipt = await product.call('session.send', input);
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
      const persisted = (await app.snapshot(scope)).messages.find(
        (message) => message.id === instructionId,
      );
      expect(persisted?.contextItems).toEqual(contextItems);
      expect(persisted?.source).toBeDefined();
      const source = persisted?.source;
      expect(fixture.checks.length).toBeGreaterThan(0);
      product.close();
      await app.close();
      app = new KernelApplication(root, fixture.options);
      await app.initialize();
      const reopened = (await app.snapshot(scope)).messages.find(
        (message) => message.id === instructionId,
      );
      expect(await app.call('session.send', structuredClone(input))).toEqual(receipt);
      expect(reopened?.contextItems).toEqual(contextItems);
      expect(reopened?.source).toEqual(source);
      expect(app.workbenchContexts.read(source, scope)).toEqual({
        state: 'unavailable',
        reason: 'disconnected',
      });
    } finally {
      product.close();
    }
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('same instruction identity accepts reordered fields, survives a lost receipt, and rejects changed items', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-identity-'));
  const model = await createModelServer();
  const fixture = resourceFixture(model);
  const app = new KernelApplication(root, fixture.options);
  try {
    await app.initialize();
    const session = await app.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    const instructionId = randomUUID();
    const contextItems = allContextItems();
    const input = {
      ...scope,
      instructionId,
      text: 'MODEL_CHAT identity with explicit context',
      materials: [],
      contextItems,
    };
    const unsubscribe = app.subscribe(() => {
      throw new Error('synthetic projection failure');
    });
    try {
      await expect(app.call('session.send', input)).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
    } finally {
      unsubscribe();
    }
    const receipt = await app.call('session.send', input);
    expect(receipt).toMatchObject({ instructionId });
    await expect(
      app.call('session.send', { ...input, contextItems: reordered(contextItems) }),
    ).resolves.toEqual(receipt);

    const changed = (itemId: string, update: (item: ContextItem) => ContextItem) => {
      const items = structuredClone(contextItems);
      const index = items.findIndex((item) => item.itemId === itemId);
      const item = items[index];
      if (!item) throw new Error(`missing fixture item ${itemId}`);
      items[index] = update(item);
      return items;
    };
    const mutations: Array<[string, ContextItem[]]> = [
      [
        'location',
        changed('text-item', (item) =>
          item.kind === 'text' ? { ...item, location: { pageIndex: 3 } } : item,
        ),
      ],
      [
        'region target',
        changed('region-item', (item) =>
          item.kind === 'region'
            ? { ...item, target: { kind: 'pdf', pageIndex: 0, width: 600, height: 800 } }
            : item,
        ),
      ],
      [
        'quote',
        changed('text-item', (item) =>
          item.kind === 'text' ? { ...item, quote: 'changed_quote' } : item,
        ),
      ],
      ['comment', changed('resource-item', (item) => ({ ...item, comment: 'changed comment' }))],
      ['basis', changed('region-item', (item) => ({ ...item, basis: 'basis-2' }))],
      [
        'ref',
        changed('object-item', (item) => ({
          ...item,
          ref: { ...projectRef, fileId: 'other-file' },
        })),
      ],
      [
        'region',
        changed('region-item', (item) =>
          item.kind === 'region'
            ? { ...item, region: { ...item.region, x: item.region.x + 0.1 } }
            : item,
        ),
      ],
      [
        'object semantics',
        changed('object-item', (item) =>
          item.kind === 'object' ? { ...item, semantics: 'changed semantics' } : item,
        ),
      ],
    ];
    for (const [field, items] of mutations)
      await expect(
        app.call('session.send', { ...input, contextItems: items }),
        field,
      ).rejects.toMatchObject({ code: 'invalidRequest' });

    const persisted = (await app.snapshot(scope)).messages.filter(
      (message) => message.id === instructionId,
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.contextItems).toEqual(contextItems);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('real worker sends explicit excerpts and draft comments and checkpoints structured instructions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-worker-'));
  const model = await createModelServer();
  const fixture = resourceFixture(model);
  const app = new KernelApplication(root, fixture.options);
  try {
    await app.initialize();
    const session = await app.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    const instructionId = randomUUID();
    const contextItems = textContextItems();
    const receipt = await app.call('session.send', {
      ...scope,
      instructionId,
      text: 'MODEL_CHAT use explicit excerpts',
      materials: [],
      contextItems,
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const request = JSON.stringify(model.requests.at(-1)?.messages);
    expect(request).toContain('explicit_saved_excerpt_73');
    expect(request).toContain('explicit_saved_comment_73');
    expect(request).toContain('explicit_draft_excerpt_91');
    expect(request).toContain('explicit_draft_comment_91');
    expect(
      await checkpointInstructions(app.projects.get('application').internal, receipt.runId),
    ).toEqual([{ instructionId, contextItems }]);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('a later basis upgrade completes while the prior excerpt remains historical', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-basis-upgrade-'));
  const model = await createModelServer();
  const fixture = resourceFixture(model);
  const app = new KernelApplication(root, fixture.options);
  try {
    await app.initialize();
    const session = await app.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    const firstId = randomUUID();
    const firstItems = textContextItems('basis-1');
    await app.call('session.send', {
      ...scope,
      instructionId: firstId,
      text: 'MODEL_CHAT use basis v1',
      materials: [],
      contextItems: firstItems,
    });
    await expectExecutionCompleted(app, scope, model);

    fixture.basis.value = 'basis-2';
    const secondId = randomUUID();
    const secondItems = textContextItems('basis-2');
    await app.call('session.send', {
      ...scope,
      instructionId: secondId,
      text: 'MODEL_CHAT use upgraded basis',
      materials: [],
      contextItems: secondItems,
    });
    await expectExecutionCompleted(app, scope, model);

    const messages = (await app.snapshot(scope)).messages;
    expect(messages.find((message) => message.id === firstId)?.contextItems).toEqual(firstItems);
    expect(messages.find((message) => message.id === secondId)?.contextItems).toEqual(secondItems);
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('basis-2');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('revoking fixture grants while a context execution waits for model admission prevents all requests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-admission-'));
  const model = await createModelServer();
  const fixture = resourceFixture(model);
  const options = fixture.options;
  let app = new KernelApplication(root, options);
  const placeholder = await app.models.execution();
  const lease = await placeholder.acquire();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    placeholder.release(lease);
  };
  try {
    await app.initialize();
    const create = app.models.execution.bind(app.models);
    let admissions = 0;
    app.models.execution = async (...args) => {
      const execution = await create(...args);
      return {
        ...execution,
        acquire: async () => {
          admissions++;
          return execution.acquire();
        },
      };
    };
    const session = await app.call('session.create', { projectId: 'application' });
    const scope = { projectId: 'application', sessionId: session.id };
    const instructionId = randomUUID();
    const contextItems = textContextItems();
    const checksBefore = fixture.checks.length;
    const receipt = await app.call('session.send', {
      ...scope,
      instructionId,
      text: 'MODEL_CHAT hold at admission',
      materials: [],
      contextItems,
    });
    await expect.poll(() => admissions === 1 && fixture.checks.length > checksBefore).toBe(true);
    await expect
      .poll(async () => {
        try {
          const instructions = await checkpointInstructions(
            app.projects.get('application').internal,
            receipt.runId,
          );
          return Array.isArray(instructions) && instructions.length === 1;
        } catch {
          return false;
        }
      })
      .toBe(true);
    expect((await app.snapshot(scope)).run?.state).toBe('running');
    expect(model.requests).toHaveLength(0);

    fixture.grant.read = false;
    fixture.grant.send = false;
    release();
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
    expect(model.requests).toHaveLength(0);
    await app.close();

    app = new KernelApplication(root, options);
    await app.initialize();
    const nextInstructionId = randomUUID();
    await expect(
      app.call('session.send', {
        ...scope,
        instructionId: nextInstructionId,
        text: 'MODEL_CHAT must recheck grants',
        materials: [],
        contextItems,
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(
      (await app.snapshot(scope)).messages.filter((message) => message.id === nextInstructionId),
    ).toHaveLength(0);
    expect(model.requests).toHaveLength(0);
  } finally {
    release();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
