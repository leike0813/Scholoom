import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import {
  HarnessRecords,
  InstructionSaver,
  openCheckpoint,
  type RunInstance,
} from '../../packages/harness/dist/node.js';
import type { GraphExecution } from '../../packages/protocol/dist/execution.js';
import type { ContextItem, InstructionContext } from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

async function fixture(
  withModel = false,
  retainInstructionIds = false,
  queued: { count?: number; text?: string } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-graph-context-'));
  const model = await createModelServer({
    respond: () => ({ text: 'Authorized graph context received.' }),
  });
  // @ts-expect-error Source-only graph registration, shared with the actual worker.
  const { graphs } = await import('../fixtures/domain-execution-worker/graphs.mjs');
  // @ts-expect-error Source-only graph registration, shared with the actual worker.
  const { modelGraphs } = await import('../fixtures/domain-execution-worker/worker-model.mjs');
  const options = {
    environment: withModel ? { MINIMAX_CN_API_KEY: 'synthetic' } : {},
    modelEndpoint: model.url,
    executionGraphs: withModel ? modelGraphs : graphs,
    workerEntry: new URL(
      `../fixtures/domain-execution-worker/${withModel ? 'worker-model' : 'worker'}.mjs`,
      import.meta.url,
    ),
  };
  const profile = join(root, 'profile');
  const app = new (class extends KernelApplication {
    occupy() {
      return this.processes.reserve();
    }
  })(profile, options);
  await app.initialize();
  const project = await app.call('project.create', {
    path: join(root, 'project'),
    trust: 'trusted',
  });
  const target = await app.call('project.create', { path: join(root, 'target'), trust: 'trusted' });
  for (const item of [project, target])
    await app.call('files.save', {
      projectId: item.id,
      path: 'input.txt',
      content: `actual-${item.id}`,
    });
  const pinned = await app.call('resources.describe', {
    locator: { source: 'project', projectId: project.id, path: 'input.txt' },
  });
  const selected = await app.call('resources.describe', {
    locator: { source: 'project', projectId: target.id, path: 'input.txt' },
  });
  await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
  const libraryPath = join(root, 'library.txt');
  await writeFile(libraryPath, 'actual-library-context-91');
  const imported = await app.call('library.importFiles', {
    batchId: randomUUID(),
    paths: [libraryPath],
    storage: 'managed',
    purpose: '正文',
    version: 'unspecified',
    origin: 'registered-context',
  });
  await expect
    .poll(async () => (await app.call('library.batch', { batchId: imported.id })).batch.state)
    .toBe('completed');
  const attachmentId = (await app.call('library.batch', { batchId: imported.id })).entries[0]
    ?.attachmentId;
  assert(attachmentId);
  const attachment = await app.call('library.attachment', { attachmentId });
  const library = await app.call('resources.describe', {
    locator: { source: 'library', attachmentId, materialVersionId: attachment.materialVersionId },
  });
  const session = await app.call('session.create', { projectId: project.id });
  const scope = { projectId: project.id, sessionId: session.id };
  const execution: Extract<GraphExecution, { kind: 'registered' }> = {
    kind: 'registered',
    graphId: 'durable-resource',
    version: '1',
    config: { outputPath: 'result.md', operationId: 'context-result', retainInstructionIds },
    materials: [{ ref: pinned.ref, basis: pinned.basis }],
    workDomain: { kind: 'project', ...scope },
  };
  const initialInstructions = Array.from({ length: queued.count ?? 1 }, () => ({
    instructionId: randomUUID(),
    text: queued.text ?? 'Save the source material and wait.',
    materials: [] as string[],
  }));
  const firstInput = initialInstructions[0];
  assert(firstInput);
  const holds = queued.count ? Array.from({ length: 4 }, () => app.occupy()) : [];
  await Promise.all(holds.map((hold) => hold.ready));
  let first: Awaited<ReturnType<KernelApplication['startGraph']>>;
  try {
    first = await app.startGraph({
      ...scope,
      instructionId: firstInput.instructionId,
      text: firstInput.text,
      execution,
    });
    for (const message of initialInstructions.slice(1))
      await app.call('session.send', { ...scope, ...message });
  } finally {
    for (const hold of holds) hold.release();
  }
  await expect
    .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
    .toBe('waiting');
  const contextItems: ContextItem[] = [selected, library].map((resource, index) => ({
    kind: 'text',
    itemId: randomUUID(),
    ref: resource.ref,
    basis: resource.basis,
    quote: `original-attached-excerpt-${index}`,
    contentState: 'saved',
    comment: 'Keep the original user attachment.',
  }));
  const input = {
    ...scope,
    instructionId: randomUUID(),
    text: '{"approve":true}',
    materials: ['input.txt'],
    materialFileIds: pinned.ref.source === 'project' ? [pinned.ref.fileId] : [],
    contextItems,
  };
  return {
    root,
    profile,
    model,
    options,
    app: app as KernelApplication,
    project,
    target,
    scope,
    first,
    input,
    initialInstructions,
  };
}

async function checkpoint(app: KernelApplication, projectId: string, runId: string) {
  const opened = await openCheckpoint(app.projects.get(projectId).internal, runId);
  try {
    return (
      await new InstructionSaver(opened.database, async () => {}).getTuple({
        configurable: { thread_id: runId },
      })
    )?.checkpoint.channel_values;
  } finally {
    opened.database.close();
  }
}

test('registered cumulative context beyond 100 instructions reconciles partial consumption after restart', async () => {
  const f = await fixture(false, true, { count: 100 });
  let app: KernelApplication = f.app;
  try {
    expect((await checkpoint(app, f.project.id, f.first.runId))?.instructions).toEqual(
      f.initialInstructions,
    );
    app.projects
      .get(f.project.id)
      .database.exec(
        `CREATE TRIGGER fail_last_batch BEFORE UPDATE OF consumed ON instructions WHEN NEW.id = '${f.input.instructionId}' BEGIN SELECT RAISE(ABORT, 'last batch acknowledgement failure'); END`,
      );
    const receipt = await app.call('session.send', f.input);
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('interrupted');
    const saved = await checkpoint(app, f.project.id, f.first.runId);
    assert(saved);
    expect(saved.instructionIds).toEqual([
      ...f.initialInstructions.map((item) => item.instructionId),
      f.input.instructionId,
    ]);
    expect((saved.instructions as InstructionContext[]).slice(0, 100)).toEqual(
      f.initialInstructions,
    );
    await app.close();
    app = new KernelApplication(f.profile, f.options);
    await app.initialize();
    app.projects.get(f.project.id).database.exec('DROP TRIGGER fail_last_batch');
    await app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: '{"approve":true}',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    expect((await checkpoint(app, f.project.id, receipt.runId))?.instructions).toEqual(
      saved.instructions,
    );
    const consumed = app.projects
      .get(f.project.id)
      .database.prepare(
        'SELECT COUNT(*) AS count FROM instructions WHERE sessionId = ? AND consumed = 1',
      )
      .get(f.scope.sessionId) as { count: number };
    expect(consumed.count).toBe(101);
    expect(await app.call('session.send', f.input)).toEqual(receipt);
    for (const path of ['result.md', 'result.md.context.md'])
      expect(app.projects.get(f.project.id).history(path)).toHaveLength(1);
  } finally {
    await app.close();
    await f.model.close();
  }
});

test('registered large instruction batches reach the worker and resume from complete checkpoint context', async () => {
  const f = await fixture(false, false, {
    count: 70,
    text: 'large accepted input '.padEnd(32768, 'x'),
  });
  let app: KernelApplication = f.app;
  try {
    const saved = await checkpoint(app, f.project.id, f.first.runId);
    expect(saved?.instructions).toEqual(f.initialInstructions);
    const consumed = app.projects
      .get(f.project.id)
      .database.prepare(
        'SELECT COUNT(*) AS count FROM instructions WHERE sessionId = ? AND consumed = 1',
      )
      .get(f.scope.sessionId) as { count: number };
    expect(consumed.count).toBe(70);
    await app.close();
    app = new KernelApplication(f.profile, f.options);
    await app.initialize();
    const receipt = await app.call('session.send', f.input);
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    expect((await checkpoint(app, f.project.id, receipt.runId))?.instructions).toMatchObject([
      ...f.initialInstructions,
      {
        instructionId: f.input.instructionId,
        text: f.input.text,
        contextItems: f.input.contextItems,
      },
    ]);
    const original = f.initialInstructions[0];
    assert(original);
    expect(await app.call('session.send', { ...f.scope, ...original })).toEqual(f.first);
    for (const path of ['result.md', 'result.md.context.md'])
      expect(app.projects.get(f.project.id).history(path)).toHaveLength(1);
  } finally {
    await app.close();
    await f.model.close();
  }
});

test('registered worker receives trusted source, explicit project/library items and legacy attachments through mapping, checkpoint and model', async () => {
  const f = await fixture(true);
  let app = f.app;
  const product = app.connectProduct();
  try {
    const receipt = await product.call('session.send', f.input);
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const message = (await app.snapshot(f.scope)).messages.find(
      (item) => item.id === f.input.instructionId,
    );
    assert(message?.source);
    const { projectId: _project, sessionId: _session, ...payload } = f.input;
    const expected: InstructionContext = { ...payload, source: message.source };
    expect(message.state).toBe('consumed');
    expect((await checkpoint(app, f.scope.projectId, receipt.runId))?.instructions).toEqual([
      ...f.initialInstructions,
      expected,
    ]);
    const output = JSON.parse(await readFile(join(f.project.path, 'result.md.context.md'), 'utf8'));
    expect(output.instructions).toEqual([expected]);
    expect(output.reads.map((item: { data: string }) => item.data)).toEqual([
      `actual-${f.target.id}`,
      'actual-library-context-91',
      `actual-${f.project.id}`,
    ]);
    expect(JSON.stringify(f.model.requests.at(-1)?.messages)).toContain(
      'original-attached-excerpt-0',
    );
    expect(JSON.stringify(f.model.requests.at(-1)?.messages)).toContain(
      'actual-library-context-91',
    );
    expect(JSON.stringify(f.model.requests.at(-1)?.messages)).toContain(`actual-${f.target.id}`);
    expect((await app.snapshot(f.scope)).run?.graph?.materials).toHaveLength(1);
    const progress = (await app.call('workbench.watch', f.scope)).run?.graphProgress;
    expect(progress?.kind).toBe('graph.completed');
    expect(progress?.evidence.creations).toHaveLength(2);
    expect(
      await app.call('resources.creation', {
        projectId: f.project.id,
        operationId: 'context-result-context',
      }),
    ).toMatchObject({ state: 'complete', association: { state: 'confirmed' } });
    await app.close();
    app = new KernelApplication(f.profile, f.options);
    await app.initialize();
    expect(await app.call('session.send', f.input)).toEqual(receipt);
    expect(app.workbenchContexts.read(message.source, f.scope)).toMatchObject({
      state: 'unavailable',
      reason: 'disconnected',
    });
    expect(app.projects.get(f.project.id).history('result.md.context.md')).toHaveLength(1);
  } finally {
    product.close();
    await app.close();
    await f.model.close();
  }
});

for (const failure of ['cancel', 'association', 'worker-lost'] as const) {
  test(`registered explicit input preserves actual delivery across ${failure}`, async () => {
    const f = await fixture(true);
    let app = f.app;
    const product = app.connectProduct();
    const path = 'result.md.context.md';
    const operationId = 'context-result-context';
    let release = () => {};
    const delivery = new Promise<void>((resolve) => {
      release = resolve;
    });
    let published = false;
    const resources = app.executionResources.bind(app);
    app.executionResources = (context) => {
      const port = resources(context);
      return {
        ...port,
        create: async (input) => {
          const result = await port.create(input);
          if (input.path === path) {
            published = true;
            // Hold only delivery of the real result; file, identity and owner receipt already exist.
            if (failure !== 'association') await delivery;
          }
          return result;
        },
      };
    };
    try {
      await expect(stat(join(f.project.path, path))).rejects.toMatchObject({ code: 'ENOENT' });
      if (failure === 'association')
        app.projects
          .get(f.project.id)
          .database.exec(
            "CREATE TRIGGER reject_context_association BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'association unavailable'); END",
          );
      const receipt = await product.call('session.send', f.input);
      await expect.poll(() => published, { timeout: 20000 }).toBe(true);
      const output = JSON.parse(await readFile(join(f.project.path, path), 'utf8'));
      const message = (await app.call('workbench.watch', f.scope)).messages.find(
        (item) => item.id === f.input.instructionId,
      );
      assert(message?.source);
      const { projectId: _project, sessionId: _session, ...input } = f.input;
      expect(output.instructions).toEqual([{ ...input, source: message.source }]);
      expect(output.reads.map((item: { data: string }) => item.data)).toEqual([
        `actual-${f.target.id}`,
        'actual-library-context-91',
        `actual-${f.project.id}`,
      ]);
      expect(message.state).toBe('consumed');
      const saved = await checkpoint(app, f.project.id, receipt.runId);
      expect(saved?.instructions).toEqual([...f.initialInstructions, ...output.instructions]);
      const original = await stat(join(f.project.path, path), { bigint: true });
      const instances = () =>
        (
          app.projects
            .get(f.project.id)
            .database.prepare('SELECT value FROM run_instances')
            .all() as { value: string }[]
        )
          .map((row) => JSON.parse(row.value) as RunInstance)
          .filter((row) => row.runId === receipt.runId);
      if (failure === 'cancel') {
        const cancelled = app.call('session.cancel', f.scope);
        release();
        await cancelled;
      } else if (failure === 'worker-lost') {
        const owned = instances().find((row) => row.state === 'running');
        assert(owned?.processId);
        process.kill(owned.processId, 'SIGKILL');
        release();
      }
      await expect
        .poll(async () => (await app.call('workbench.watch', f.scope)).run?.state, {
          timeout: 20000,
        })
        .toBe(
          failure === 'association' ? 'completed' : failure === 'cancel' ? 'cancelled' : 'failed',
        );
      await expect.poll(() => instances().every((row) => row.state === 'exited')).toBe(true);
      const beforeRestart = await app.call('workbench.watch', f.scope);
      if (failure === 'association') {
        expect(beforeRestart.run?.graphProgress).toMatchObject({
          kind: 'graph.completed',
          evidence: {
            creations: expect.arrayContaining([
              expect.objectContaining({
                operationId,
                state: 'complete',
                resource: expect.anything(),
                association: expect.objectContaining({ state: 'unknown' }),
              }),
            ]),
          },
        });
      } else {
        expect(beforeRestart.run?.remoteOutcome).toBe('unknown');
        expect(beforeRestart.run?.graphProgress?.kind).not.toBe('graph.completed');
      }
      const requests = f.model.requests.length;
      product.close();
      await app.close();
      app = new KernelApplication(f.profile, f.options);
      await app.initialize();
      expect((await app.call('workbench.watch', f.scope)).run?.state).toBe(
        beforeRestart.run?.state,
      );
      expect(f.model.requests).toHaveLength(requests);
      if (failure === 'association')
        app.projects.get(f.project.id).database.exec('DROP TRIGGER reject_context_association');
      const checked = await app.call('resources.creation', {
        projectId: f.project.id,
        operationId,
      });
      expect(checked).toMatchObject({ state: 'complete', association: { state: 'confirmed' } });
      assert(checked.state === 'complete' && checked.resource.ref.source === 'project');
      expect((await app.call('files.read', { projectId: f.project.id, path })).fileId).toBe(
        checked.resource.ref.fileId,
      );
      const reconciled = await app.call('artifacts.reconcile', {
        ...f.scope,
        runId: receipt.runId,
        paths: [path],
      });
      expect(reconciled[0]).toMatchObject({ state: 'linked', fileId: checked.resource.ref.fileId });
      if (failure === 'worker-lost') {
        await app.call('session.send', {
          ...f.scope,
          instructionId: randomUUID(),
          text: '{"approve":true}',
          materials: [],
        });
        await expect
          .poll(async () => (await app.call('workbench.watch', f.scope)).run?.state, {
            timeout: 20000,
          })
          .toBe('completed');
      }
      expect((await stat(join(f.project.path, path), { bigint: true })).ino).toBe(original.ino);
      expect(JSON.parse(await readFile(join(f.project.path, path), 'utf8'))).toEqual(output);
      expect(app.projects.get(f.project.id).history(path)).toHaveLength(1);
      expect(await app.call('session.send', f.input)).toEqual(receipt);
      await test.info().attach('actual-delivery', {
        body: JSON.stringify(
          {
            failure,
            profile: f.profile,
            project: f.project.path,
            runId: receipt.runId,
            instructionId: f.input.instructionId,
            resource: checked.resource,
            association: checked.association,
            inode: String(original.ino),
            interruptedState: beforeRestart.run?.state,
            finalState: (await app.call('workbench.watch', f.scope)).run?.state,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
    } finally {
      release();
      product.close();
      await app.close();
      await f.model.close();
    }
  });
}

for (const contextState of ['missing', 'empty'] as const) {
  test(`a legacy checkpoint with ${contextState} context retains verified old instruction identities alongside new resume context`, async () => {
    const f = await fixture(false, true);
    let app = f.app;
    try {
      const opened = await openCheckpoint(app.projects.get(f.project.id).internal, f.first.runId);
      try {
        const saver = new InstructionSaver(opened.database, async () => {});
        const saved = await saver.getTuple({ configurable: { thread_id: f.first.runId } });
        assert(saved?.metadata);
        const {
          instructions: _context,
          instructionRunId: _run,
          ...legacy
        } = saved.checkpoint.channel_values;
        if (contextState === 'empty') legacy.instructions = [];
        await saver.put(
          saved.config,
          { ...saved.checkpoint, channel_values: legacy },
          saved.metadata,
        );
      } finally {
        opened.database.close();
      }
      await app.close();
      app = new KernelApplication(f.profile, f.options);
      await app.initialize();
      await app.call('session.send', f.input);
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      const saved = await checkpoint(app, f.project.id, f.first.runId);
      assert(saved);
      expect(saved?.instructionIds).toEqual([f.first.instructionId, f.input.instructionId]);
      expect(
        (saved.instructions as InstructionContext[]).map((item) => item.instructionId),
      ).toEqual(saved.instructionIds);
      expect((saved.instructions as InstructionContext[])[1]?.contextItems).toEqual(
        f.input.contextItems,
      );
      expect(app.projects.get(f.project.id).history('result.md.context.md')).toHaveLength(1);
    } finally {
      await app.close();
      await f.model.close();
    }
  });
}

test('terminal checkpoint confirmation is retried before a graph with no remaining nodes resumes', async () => {
  const f = await fixture();
  let app = f.app;
  try {
    app.projects
      .get(f.project.id)
      .database.exec(
        `CREATE TRIGGER fail_terminal_ack BEFORE UPDATE OF consumed ON instructions WHEN NEW.id = '${f.input.instructionId}' BEGIN SELECT RAISE(ABORT, 'terminal acknowledgement failure'); END`,
      );
    const receipt = await app.harness.send(f.input, undefined, {
      kind: 'registered',
      graphId: 'terminal-context',
      version: '1',
      config: {},
      materials: [],
      workDomain: { kind: 'project', ...f.scope },
    });
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('interrupted');
    expect(
      (await app.snapshot(f.scope)).messages.find((item) => item.id === f.input.instructionId)
        ?.state,
    ).toBe('accepted');
    expect(await readFile(join(f.project.path, 'terminal.md'), 'utf8')).toContain(
      'original-attached-excerpt-0',
    );
    const original = await stat(join(f.project.path, 'terminal.md'), { bigint: true });
    await app.close();
    app = new KernelApplication(f.profile, f.options);
    await app.initialize();
    app.projects.get(f.project.id).database.exec('DROP TRIGGER fail_terminal_ack');
    await app.call('session.send', {
      ...f.scope,
      instructionId: randomUUID(),
      text: 'Reconcile the saved terminal input.',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    expect(
      (await app.snapshot(f.scope)).messages.find((item) => item.id === f.input.instructionId)
        ?.state,
    ).toBe('consumed');
    expect(await app.call('session.send', f.input)).toEqual(receipt);
    expect((await stat(join(f.project.path, 'terminal.md'), { bigint: true })).ino).toBe(
      original.ino,
    );
    expect(app.projects.get(f.project.id).history('terminal.md')).toHaveLength(1);
  } finally {
    await app.close();
    await f.model.close();
  }
});

for (const boundary of ['save', 'ack', 'receipt', 'source-conflict', 'run-conflict'] as const) {
  test(`registered context survives ${boundary} failure without confirming unsaved input or replaying results`, async () => {
    const corrupt = boundary === 'source-conflict' || boundary === 'run-conflict';
    const f = await fixture();
    let app = f.app;
    const product = app.connectProduct();
    const confirm = HarnessRecords.prototype.confirmConsumption;
    let original: InstructionContext | undefined;
    try {
      if (boundary === 'save') {
        const opened = await openCheckpoint(app.projects.get(f.project.id).internal, f.first.runId);
        opened.database.exec(
          "CREATE TRIGGER fail_context_save BEFORE INSERT ON checkpoints BEGIN SELECT RAISE(ABORT, 'synthetic checkpoint failure'); END",
        );
        opened.database.close();
      } else if (boundary === 'ack' || corrupt)
        app.projects
          .get(f.project.id)
          .database.exec(
            "CREATE TRIGGER fail_context_ack BEFORE UPDATE OF consumed ON instructions BEGIN SELECT RAISE(ABORT, 'synthetic acknowledgement failure'); END",
          );
      else
        HarnessRecords.prototype.confirmConsumption = function (...args) {
          const changed = confirm.apply(this, args);
          if (args[2].instructionIds.includes(f.input.instructionId))
            throw new Error('Lost consumption receipt');
          return changed;
        };
      const receipt = await product.call('session.send', f.input);
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe(boundary === 'save' ? 'failed' : 'interrupted');
      const message = (await app.snapshot(f.scope)).messages.find(
        (item) => item.id === f.input.instructionId,
      );
      assert(message?.source);
      const { projectId: _project, sessionId: _session, ...payload } = f.input;
      original = { ...payload, source: message.source };
      expect(message.state).toBe(boundary === 'receipt' ? 'consumed' : 'accepted');
      const saved = (await checkpoint(app, f.project.id, receipt.runId))?.instructions;
      if (boundary === 'save') expect(saved).toEqual(f.initialInstructions);
      else expect(saved).toEqual([...f.initialInstructions, original]);
      await expect(stat(join(f.project.path, 'result.md.context.md'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      HarnessRecords.prototype.confirmConsumption = confirm;
      product.close();
      await app.close();
      app = new KernelApplication(f.profile, f.options);
      await app.initialize();
      if (boundary === 'save') {
        const opened = await openCheckpoint(app.projects.get(f.project.id).internal, receipt.runId);
        opened.database.exec('DROP TRIGGER fail_context_save');
        opened.database.close();
      } else if (boundary === 'ack' || corrupt)
        app.projects.get(f.project.id).database.exec('DROP TRIGGER fail_context_ack');
      if (corrupt) {
        const opened = await openCheckpoint(app.projects.get(f.project.id).internal, receipt.runId);
        try {
          const saver = new InstructionSaver(opened.database, async () => {});
          const saved = await saver.getTuple({ configurable: { thread_id: receipt.runId } });
          assert(saved?.metadata);
          const contexts = structuredClone(
            saved.checkpoint.channel_values.instructions,
          ) as InstructionContext[];
          const adopted = contexts.find((item) => item.instructionId === f.input.instructionId);
          assert(adopted?.source);
          if (boundary === 'source-conflict') adopted.source.connectionId = 'forged-window';
          await saver.put(
            saved.config,
            {
              ...saved.checkpoint,
              channel_values: {
                ...saved.checkpoint.channel_values,
                instructions: contexts,
                ...(boundary === 'run-conflict' ? { instructionRunId: 'another-run' } : {}),
              },
            },
            saved.metadata,
          );
        } finally {
          opened.database.close();
        }
      }
      await app.call('session.send', {
        ...f.scope,
        instructionId: randomUUID(),
        text: '{"approve":true}',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe(corrupt ? 'failed' : 'completed');
      if (corrupt) {
        expect(
          (await app.snapshot(f.scope)).messages.find((item) => item.id === f.input.instructionId)
            ?.state,
        ).toBe('accepted');
        await expect(stat(join(f.project.path, 'result.md.context.md'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
        return;
      }
      expect((await checkpoint(app, f.project.id, receipt.runId))?.instructions).toEqual([
        ...f.initialInstructions,
        original,
      ]);
      expect(
        JSON.parse(await readFile(join(f.project.path, 'result.md.context.md'), 'utf8'))
          .instructions,
      ).toEqual([original]);
      expect(await app.call('session.send', f.input)).toEqual(receipt);
      for (const path of ['result.md', 'result.md.context.md'])
        expect(app.projects.get(f.project.id).history(path)).toHaveLength(1);
    } finally {
      HarnessRecords.prototype.confirmConsumption = confirm;
      product.close();
      await app.close();
      await f.model.close();
    }
  });
}

for (const boundary of ['target-queue', 'library-queue', 'library-final'] as const) {
  test(`registered attachment authorization blocks ${boundary} and restart until reauthorized`, async () => {
    const f = await fixture(true);
    let app = f.app;
    const blocker = await app.models.execution();
    const lease = boundary.endsWith('queue') ? await blocker.acquire() : undefined;
    let released = false;
    const release = () => {
      if (lease && !released) {
        released = true;
        blocker.release(lease);
      }
    };
    const revoke = async (allowed: boolean) => {
      if (boundary === 'target-queue')
        await app.call('project.grant', {
          projectId: f.target.id,
          trust: allowed ? 'trusted' : 'restricted',
          autoBackup: false,
        });
      else
        await app.call('library.grant', {
          read: true,
          write: true,
          send: allowed,
          autoBackup: false,
        });
    };
    const execution = app.models.execution.bind(app.models);
    let entered = false;
    let admissionRequested = () => {};
    const admission = new Promise<void>((resolve) => {
      admissionRequested = resolve;
    });
    let checks = 0;
    app.models.execution = async (authorize, signal, config, confirm) => {
      const access = await execution(
        async () => {
          await authorize?.();
          if (boundary === 'library-final' && ++checks === 2) await revoke(false);
        },
        signal,
        config,
        confirm,
      );
      return {
        ...access,
        acquire: () => {
          entered = true;
          admissionRequested();
          return access.acquire();
        },
      };
    };
    try {
      const receipt = await app.call('session.send', f.input);
      await admission;
      expect(entered).toBe(true);
      if (boundary.endsWith('queue')) {
        await revoke(false);
        release();
      }
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(f.model.requests).toHaveLength(0);
      expect(
        (await app.snapshot(f.scope)).messages.find((item) => item.id === f.input.instructionId)
          ?.state,
      ).toBe('accepted');
      await app.close();
      app = new KernelApplication(f.profile, f.options);
      await app.initialize();
      await app.call('session.send', {
        ...f.scope,
        instructionId: randomUUID(),
        text: '{"approve":true}',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(f.model.requests).toHaveLength(0);
      await revoke(true);
      await app.call('session.send', {
        ...f.scope,
        instructionId: randomUUID(),
        text: '{"approve":true}',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(f.scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      expect(JSON.stringify(f.model.requests.at(-1)?.messages)).toContain(
        'actual-library-context-91',
      );
      expect(await app.call('session.send', f.input)).toEqual(receipt);
      expect(app.projects.get(f.project.id).history('result.md.context.md')).toHaveLength(1);
    } finally {
      release();
      await app.close();
      await f.model.close();
    }
  });
}
