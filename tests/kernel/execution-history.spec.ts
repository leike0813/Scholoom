import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ExecutionGraphs } from '../../packages/harness/dist/node.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import type { GraphExecution } from '../../packages/protocol/dist/execution.js';
import type { HarnessModuleInputs } from '../../packages/protocol/dist/harness.js';

for (const replay of ['same', 'config', 'graph'] as const) {
  test(`concurrent ${replay} graph replay checks the accepted binding after admission`, async () => {
    // @ts-expect-error Source fixture is deliberately not production registration.
    const { graphs } = await import('../fixtures/domain-execution-worker/graphs.mjs');
    const root = await mkdtemp(join(tmpdir(), 'scholoom-history-replay-'));
    const execution: Extract<GraphExecution, { kind: 'registered' }> = {
      kind: 'registered',
      graphId: 'durable-resource',
      version: '1',
      config: { outputPath: 'result.md', operationId: 'replay-output' },
      materials: [],
      workDomain: { kind: 'project', projectId: 'fixture', sessionId: 'fixture' },
    };
    const factory = graphs.resolve(execution);
    const app = new KernelApplication(join(root, 'profile'), {
      environment: {},
      executionGraphs: new ExecutionGraphs([
        factory,
        { ...factory, definition: { ...factory.definition, graphId: 'other-graph' } },
      ]),
      workerEntry: new URL('../fixtures/domain-execution-worker/worker.mjs', import.meta.url),
    });
    let releasePath = () => {};
    let restorePath = () => {};
    let pending: ReturnType<typeof app.harness.send> | undefined;
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const store = app.projects.get(project.id);
      const saved = await store.save('input.md', 'concurrent replay evidence');
      assert(saved.fileId);
      const material = await app.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, fileId: saved.fileId },
      });
      const session = await app.call('session.create', { projectId: project.id });
      const scope = { projectId: project.id, sessionId: session.id };
      execution.workDomain = { kind: 'project', ...scope };
      execution.materials = [{ ref: material.ref, basis: material.basis }];
      const input = {
        ...scope,
        instructionId: randomUUID(),
        text: 'Create and wait.',
        materials: ['input.md'],
      };
      const originalPath = store.path;
      restorePath = () => {
        store.path = originalPath;
      };
      const holdPath = new Promise<void>((resolve) => {
        releasePath = resolve;
      });
      let enteredPath = () => {};
      const pathEntered = new Promise<void>((resolve) => {
        enteredPath = resolve;
      });
      store.path = async (...args) => {
        restorePath();
        enteredPath();
        await holdPath;
        return originalPath.apply(store, args);
      };
      pending = app.harness.send(input, undefined, {
        ...execution,
        ...(replay === 'config' ? { config: { ...execution.config, outputPath: 'other.md' } } : {}),
        ...(replay === 'graph' ? { graphId: 'other-graph' } : {}),
      });
      await Promise.race([pathEntered, pending]);
      const accepted = await app.harness.send(input, undefined, execution);
      releasePath();
      if (replay === 'same') await expect(pending).resolves.toEqual(accepted);
      else await expect(pending).rejects.toMatchObject({ code: 'invalidRequest' });
      expect(await app.harness.send(input, undefined, execution)).toEqual(accepted);
      expect(
        (
          await app.harness.executions({ ...scope, originInstructionId: input.instructionId })
        ).runs.map((run) => run.id),
      ).toEqual([accepted.runId]);
    } finally {
      restorePath();
      releasePath();
      await pending?.catch(() => {});
      await app.close();
    }
  });
}

test('execution history rejects invalid selectors and pagination at the direct entry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-history-validation-'));
  const app = new (class extends KernelApplication {
    history(context: CallContext, input: HarnessModuleInputs['harness.executions']) {
      return this.modulePort(context, 'research').call('harness.executions', input);
    }
  })(join(root, 'profile'), { environment: {} });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    for (const query of [
      {},
      { runId: 'run', instructionId: 'instruction' },
      { instructionId: 'instruction', originInstructionId: 'origin' },
      { runId: '' },
      { runId: 'run', offset: -1 },
      { runId: 'run', offset: 0.5 },
      { runId: 'run', limit: 0 },
      { runId: 'run', limit: 101 },
      { runId: 'run', limit: 1.5 },
    ])
      await expect(
        // @ts-expect-error Deliberately invalid selector or pagination.
        app.harness.executions({ ...scope, ...query }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(await app.harness.executions({ ...scope, runId: 'missing' })).toEqual({ runs: [] });
    expect(await app.harness.executions({ ...scope, instructionId: 'missing' })).toEqual({
      runs: [],
    });
    const host: CallContext = {
      moduleId: 'research',
      role: 'host',
      principal: { kind: 'system', id: 'host' },
      ...scope,
    };
    for (const context of [
      { ...host, role: 'product' as const, principal: { kind: 'human' as const, id: 'local' } },
      { ...host, role: 'execution' as const, principal: { kind: 'agent' as const, id: 'agent' } },
      { ...host, projectId: 'other-project' },
      { ...host, sessionId: 'other-session' },
    ])
      await expect(app.history(context, { ...scope, runId: 'missing' })).rejects.toMatchObject({
        code: 'permissionDenied',
      });
    expect(await app.history(host, { ...scope, runId: 'missing' })).toEqual({ runs: [] });
    expect(app.available()).not.toContain('harness.executions');
  } finally {
    await app.close();
  }
});

test('execution history follows real graph attempts, independent starts and restart', async () => {
  // @ts-expect-error Source fixture is deliberately not production registration.
  const { graphs } = await import('../fixtures/domain-execution-worker/graphs.mjs');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-history-'));
  const profile = join(root, 'profile');
  const options = {
    environment: {},
    executionGraphs: graphs,
    workerEntry: new URL('../fixtures/domain-execution-worker/worker.mjs', import.meta.url),
  };
  let app = new KernelApplication(profile, options);
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const input = await app.projects.get(project.id).save('input.md', 'execution history evidence');
    assert(input.fileId);
    const material = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, fileId: input.fileId },
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const execution: Extract<GraphExecution, { kind: 'registered' }> = {
      kind: 'registered',
      graphId: 'durable-resource',
      version: '1',
      config: { outputPath: 'result.md', operationId: 'history-output' },
      materials: [{ ref: material.ref, basis: material.basis }],
      workDomain: { kind: 'project', ...scope },
    };
    const first = {
      ...scope,
      instructionId: randomUUID(),
      text: 'Create and wait.',
      execution,
    };
    const accepted = await app.startGraph(first);
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('waiting');
    expect((await app.snapshot(scope)).run?.graph?.originInstructionId).toBe(first.instructionId);
    expect(await app.startGraph(first)).toEqual(accepted);
    const ordinary = {
      ...scope,
      instructionId: randomUUID(),
      text: 'Keep waiting.',
      materials: [],
    };
    expect((await app.harness.send(ordinary)).runId).toBe(accepted.runId);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('waiting');
    await app.call('session.cancel', scope);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    const next = await app.harness.send({ ...ordinary, instructionId: randomUUID() });
    expect(next.runId).not.toBe(accepted.runId);
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('waiting');
    expect(await app.startGraph(first)).toEqual(accepted);
    expect(await app.harness.send(ordinary)).toEqual({
      instructionId: ordinary.instructionId,
      runId: accepted.runId,
    });
    const origin = { ...scope, originInstructionId: first.instructionId };
    const history = await app.harness.executions(origin);
    expect(history.runs.map((run) => run.id)).toEqual([accepted.runId, next.runId]);
    expect(history.runs.map((run) => run.state)).toEqual(['cancelled', 'waiting']);
    expect(
      history.runs.every((run) => run.graph?.originInstructionId === first.instructionId),
    ).toBe(true);
    const page = await app.harness.executions({ ...origin, limit: 1 });
    expect(page).toEqual({ runs: [history.runs[0]], nextOffset: 1 });
    assert(page.nextOffset !== undefined);
    expect(await app.harness.executions({ ...origin, offset: page.nextOffset, limit: 1 })).toEqual({
      runs: [history.runs[1]],
    });
    const originalInstruction = (await app.snapshot(scope)).messages.find(
      (message) => message.id === first.instructionId,
    );
    assert(originalInstruction);
    const originalReceipt = { runs: [history.runs[0]], instruction: originalInstruction };
    expect(await app.harness.executions({ ...scope, instructionId: first.instructionId })).toEqual(
      originalReceipt,
    );
    expect(await app.harness.executions({ ...scope, runId: next.runId })).toEqual({
      runs: [history.runs[1]],
    });
    const independent = { ...first, instructionId: randomUUID() };
    const store = app.projects.get(project.id);
    const originalPath = store.path;
    let releasePath = () => {};
    const holdPath = new Promise<void>((resolve) => {
      releasePath = resolve;
    });
    let enteredPath = () => {};
    const pathEntered = new Promise<void>((resolve) => {
      enteredPath = resolve;
    });
    store.path = async (...args) => {
      store.path = originalPath;
      enteredPath();
      await holdPath;
      return originalPath.apply(store, args);
    };
    let pending: ReturnType<typeof app.harness.send> | undefined;
    let separate: { instructionId: string; runId: string };
    try {
      pending = app.harness.send({
        ...ordinary,
        instructionId: randomUUID(),
        materials: ['input.md'],
      });
      await Promise.race([pathEntered, pending]);
      separate = await app.startGraph(independent);
      releasePath();
      expect((await pending).runId).toBe(separate.runId);
    } finally {
      store.path = originalPath;
      releasePath();
      await pending?.catch(() => {});
    }
    expect(separate.runId).not.toBe(next.runId);
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('waiting');
    const independentHistory = await app.harness.executions({
      ...scope,
      originInstructionId: independent.instructionId,
    });
    expect(independentHistory.runs.map((run) => run.id)).toEqual([separate.runId]);
    expect(await app.harness.executions(origin)).toEqual(history);
    const other = await app.call('session.create', { projectId: project.id });
    for (const selector of [
      { runId: accepted.runId },
      { instructionId: first.instructionId },
      { originInstructionId: first.instructionId },
    ])
      expect(await app.harness.executions({ ...scope, sessionId: other.id, ...selector })).toEqual({
        runs: [],
      });
    await app.close();
    app = new KernelApplication(profile, options);
    await app.initialize();
    expect(await app.harness.executions(origin)).toEqual(history);
    expect(await app.harness.executions({ ...scope, instructionId: first.instructionId })).toEqual(
      originalReceipt,
    );
    expect(
      await app.harness.executions({ ...scope, originInstructionId: independent.instructionId }),
    ).toEqual(independentHistory);
    expect(await app.startGraph(first)).toEqual(accepted);
    expect((await app.snapshot(scope)).run?.id).toBe(separate.runId);
  } finally {
    await app.close();
  }
});

test('execution history bounds encoded pages and preserves unlinked legacy records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-history-size-'));
  const app = new KernelApplication(join(root, 'profile'), { environment: {} });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const database = app.projects.get(project.id).database;
    const originInstructionId = randomUUID();
    const graph = {
      graphId: 'historical-graph',
      version: '1',
      config: { data: '文'.repeat(100000) },
      stateFormatVersion: '1',
      checkpointRef: 'historical-checkpoint',
      originInstructionId,
    };
    const insert = database.prepare('INSERT INTO runs (id, sessionId, value) VALUES (?, ?, ?)');
    for (const [id, attempt] of [
      ['b', 1],
      ['a', 1],
      ['c', 2],
    ] as const)
      insert.run(
        id,
        session.id,
        JSON.stringify({ id, sessionId: session.id, attempt, state: 'completed', graph }),
      );
    const first = await app.harness.executions({ ...scope, originInstructionId });
    expect(first.runs.map((run) => run.id)).toEqual(['a']);
    expect(first.nextOffset).toBe(1);
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThanOrEqual(512 * 1024);
    assert(first.nextOffset !== undefined);
    const second = await app.harness.executions({
      ...scope,
      originInstructionId,
      offset: first.nextOffset,
    });
    expect(second.runs.map((run) => run.id)).toEqual(['b']);
    expect(second.nextOffset).toBe(2);
    insert.run(
      'large',
      session.id,
      JSON.stringify({
        id: 'large',
        sessionId: session.id,
        attempt: 3,
        state: 'completed',
        graph: { ...graph, config: { data: '文'.repeat(180000) } },
      }),
    );
    await expect(app.harness.executions({ ...scope, runId: 'large' })).rejects.toMatchObject({
      code: 'tooLarge',
    });
    const { originInstructionId: _origin, ...legacyGraph } = graph;
    const legacy = {
      id: 'legacy',
      sessionId: session.id,
      attempt: 4,
      state: 'completed',
      graph: legacyGraph,
    };
    insert.run(legacy.id, session.id, JSON.stringify(legacy));
    database
      .prepare('INSERT INTO instructions (id, sessionId, runId, consumed) VALUES (?, ?, ?, 1)')
      .run('legacy-instruction', session.id, legacy.id);
    const instruction = {
      id: 'legacy-instruction',
      sessionId: session.id,
      role: 'user',
      text: 'Original input without an origin binding.',
      materials: [],
      state: 'consumed',
      createdAt: new Date().toISOString(),
    };
    const insertMessage = database.prepare(
      'INSERT INTO messages (id, sessionId, value) VALUES (?, ?, ?)',
    );
    insertMessage.run(instruction.id, session.id, JSON.stringify(instruction));
    expect(await app.harness.executions({ ...scope, instructionId: 'legacy-instruction' })).toEqual(
      { runs: [legacy], instruction },
    );
    expect(await app.harness.executions({ ...scope, runId: legacy.id })).toEqual({
      runs: [legacy],
    });
    expect(
      await app.harness.executions({ ...scope, originInstructionId: 'legacy-instruction' }),
    ).toEqual({ runs: [] });
    const updateMessage = database.prepare('UPDATE messages SET value = ? WHERE id = ?');
    const largerInstruction = { ...instruction, text: '文'.repeat(80000) };
    updateMessage.run(JSON.stringify(largerInstruction), instruction.id);
    await expect(
      app.harness.executions({ ...scope, instructionId: instruction.id }),
    ).rejects.toMatchObject({ code: 'tooLarge' });
    expect(
      await app.harness.executions({ ...scope, instructionId: instruction.id, offset: 1 }),
    ).toEqual({ runs: [], instruction: largerInstruction });
    updateMessage.run(
      JSON.stringify({ ...instruction, text: '文'.repeat(180000) }),
      instruction.id,
    );
    await expect(
      app.harness.executions({ ...scope, instructionId: instruction.id, offset: 1 }),
    ).rejects.toMatchObject({ code: 'tooLarge' });
    database.prepare('DELETE FROM messages WHERE id = ?').run(instruction.id);
    await expect(
      app.harness.executions({ ...scope, instructionId: instruction.id }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    const smallOrigin = randomUUID();
    for (let attempt = 1; attempt <= 26; attempt++) {
      const id = `small-${attempt}`;
      insert.run(
        id,
        session.id,
        JSON.stringify({
          id,
          sessionId: session.id,
          attempt,
          state: 'completed',
          graph: { ...graph, originInstructionId: smallOrigin, config: {} },
        }),
      );
    }
    const defaultPage = await app.harness.executions({
      ...scope,
      originInstructionId: smallOrigin,
    });
    expect(defaultPage.runs).toHaveLength(25);
    expect(defaultPage.nextOffset).toBe(25);
    expect(
      (await app.harness.executions({ ...scope, originInstructionId: smallOrigin, limit: 100 }))
        .runs,
    ).toHaveLength(26);
  } finally {
    await app.close();
  }
});
