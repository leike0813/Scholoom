import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { createModelServer } from '../model-server.js';

test('real worker resolves only current instruction sources and queries the snapshot at tool time', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-query-'));
  const firstId = randomUUID();
  const secondId = randomUUID();
  let phase = 'first';
  let app: KernelApplication;
  let publishLatest = () => {};
  const model = await createModelServer({
    respond: ({ calls }) => {
      const count = calls.filter((name) => name === 'read_workbench_context').length;
      if (phase === 'next')
        return count < 4
          ? { tool: { name: 'read_workbench_context', input: { instructionId: firstId } } }
          : { text: 'Old instruction rejected.' };
      if (count === 0) return { tool: { name: 'read_workbench_context', input: {} } };
      if (count === 1) {
        publishLatest();
        return { tool: { name: 'read_workbench_context', input: { instructionId: firstId } } };
      }
      if (count === 2)
        return { tool: { name: 'read_workbench_context', input: { instructionId: secondId } } };
      return { text: 'Checked the explicitly named sources.' };
    },
  });
  app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  await app.initialize();
  const first = app.connectProduct();
  const second = app.connectProduct();
  const session = app.harness.create('application');
  const scope = { projectId: 'application', sessionId: session.id };
  const snapshot = (revision: number, viewId: string) => ({
    revision,
    viewId,
    receiver: scope,
    selections: [],
    selectedItems: [],
  });
  const execution = app.models.execution.bind(app.models);
  let proceed!: () => void;
  const gate = new Promise<void>((resolve) => {
    proceed = resolve;
  });
  app.models.execution = async (...args) => {
    await gate;
    return execution(...args);
  };
  try {
    await first.call('workbench.context.publish', { snapshot: snapshot(1, 'first-at-send') });
    await second.call('workbench.context.publish', { snapshot: snapshot(1, 'second-most-recent') });
    await first.call('session.send', {
      ...scope,
      instructionId: firstId,
      text: 'MODEL_CHAT first',
      materials: [],
    });
    await second.call('session.send', {
      ...scope,
      instructionId: secondId,
      text: 'MODEL_CHAT second',
      materials: [],
    });
    const source = (await app.snapshot(scope)).messages.find(
      (message) => message.id === firstId,
    )?.source;
    expect(source).toBeDefined();
    publishLatest = () => {
      app.workbenchContexts.publish(source, snapshot(2, 'first-at-tool-time'));
    };
    proceed();
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const tools = (await app.snapshot(scope)).messages.filter(
      (message) => message.tool?.name === 'read_workbench_context',
    );
    expect(JSON.parse(tools[0]?.tool?.output ?? '{}')).toEqual({
      state: 'ambiguous',
      instructionIds: [firstId, secondId],
    });
    expect(JSON.parse(tools[1]?.tool?.output ?? '{}')).toMatchObject({
      state: 'available',
      instructionId: firstId,
      snapshot: { viewId: 'first-at-tool-time' },
    });
    expect(JSON.parse(tools[2]?.tool?.output ?? '{}')).toMatchObject({
      state: 'available',
      instructionId: secondId,
      snapshot: { viewId: 'second-most-recent' },
    });
    phase = 'next';
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT next advancement',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const latest = (await app.snapshot(scope)).messages
      .filter((message) => message.tool?.name === 'read_workbench_context')
      .at(-1);
    expect(latest?.state).toBe('error');
    expect(JSON.parse(latest?.tool?.output ?? '{}')).toMatchObject({
      error: { code: 'invalidRequest' },
    });
  } finally {
    proceed();
    first.close();
    second.close();
    await app.close();
    await model.close();
  }
});

for (const scenario of [
  'sameSource',
  'mixedCli',
  'noSource',
  'noSnapshot',
  'disconnected',
  'receiverMismatch',
  'unadaptedSelection',
  'bareSelection',
] as const) {
  test(`context tool diagnoses ${scenario} through the actual worker`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-context-scope-'));
    const model = await createModelServer({
      respond: ({ calls }) =>
        calls.includes('read_workbench_context')
          ? { text: 'Checked.' }
          : { tool: { name: 'read_workbench_context', input: {} } },
    });
    const app = new KernelApplication(root, {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    await app.initialize();
    const connection = app.connectProduct();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    const original = app.models.execution.bind(app.models);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    app.models.execution = async (...args) => {
      await gate;
      return original(...args);
    };
    const firstId = randomUUID();
    const secondId = randomUUID();
    try {
      if (scenario !== 'noSnapshot')
        await connection.call('workbench.context.publish', {
          snapshot: {
            revision: 1,
            receiver: scope,
            viewId: 'scope',
            selectedItems: scenario === 'bareSelection' ? ['private-row-id'] : [],
            selections:
              scenario === 'unadaptedSelection'
                ? [
                    {
                      kind: 'text',
                      itemId: 'selection',
                      basis: 'old-version',
                      ref: { source: 'project', projectId: 'application', fileId: 'fixture' },
                      quote: 'unadapted_snapshot_secret',
                      contentState: 'saved',
                    },
                  ]
                : [],
          },
        });
      const input = {
        ...scope,
        instructionId: firstId,
        text: 'MODEL_CHAT scoped query',
        materials: [],
      };
      if (scenario === 'noSource') await app.call('session.send', input);
      else await connection.call('session.send', input);
      if (scenario === 'sameSource')
        await connection.call('session.send', { ...input, instructionId: secondId });
      if (scenario === 'mixedCli')
        await app.call('session.send', { ...input, instructionId: secondId });
      if (scenario === 'disconnected') connection.close();
      if (scenario === 'receiverMismatch')
        await connection.call('workbench.context.publish', {
          snapshot: {
            revision: 2,
            receiver: { ...scope, sessionId: 'other-session' },
            viewId: 'other',
            selectedItems: [],
            selections: [],
          },
        });
      release();
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      const tool = (await app.snapshot(scope)).messages.find(
        (message) => message.tool?.name === 'read_workbench_context',
      );
      const result = JSON.parse(tool?.tool?.output ?? '{}');
      if (scenario === 'sameSource')
        expect(result).toMatchObject({ state: 'available', instructionId: firstId });
      else if (scenario === 'mixedCli')
        expect(result).toEqual({ state: 'ambiguous', instructionIds: [firstId, secondId] });
      else if (scenario === 'unadaptedSelection' || scenario === 'bareSelection') {
        expect(result).toMatchObject({ error: { code: 'unavailable' } });
        expect(tool?.state).toBe('error');
        expect(JSON.stringify(model.requests)).not.toContain('unadapted_snapshot_secret');
        expect(JSON.stringify(model.requests)).not.toContain('private-row-id');
      } else expect(result).toEqual({ state: 'unavailable', reason: scenario });
    } finally {
      release();
      connection.close();
      await app.close();
      await model.close();
    }
  });
}

test('a source consumed by an automatic next run survives interruption without importing predecessor sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-next-run-'));
  let recovering = false;
  const lateId = randomUUID();
  const recoveryId = randomUUID();
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (!recovering) {
        model.hold = true;
        return { text: 'First advancement complete.' };
      }
      const count = calls.filter((name) => name === 'read_workbench_context').length;
      if (!count) return { tool: { name: 'read_workbench_context', input: {} } };
      if (count === 1)
        return { tool: { name: 'read_workbench_context', input: { instructionId: lateId } } };
      return { text: 'Recovered current advancement.' };
    },
  });
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(root, options);
  await app.initialize();
  const original = app.connectProduct();
  const late = app.connectProduct();
  let replacement: ReturnType<KernelApplication['connectProduct']> | undefined;
  const session = app.harness.create('application');
  const scope = { projectId: 'application', sessionId: session.id };
  try {
    model.hold = true;
    const initial = await original.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT initial',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const lateReceipt = await late.call('session.send', {
      ...scope,
      instructionId: lateId,
      text: 'MODEL_CHAT late addition',
      materials: [],
    });
    expect(lateReceipt.runId).toBe(initial.runId);
    model.release();
    await expect.poll(() => model.requests.length, { timeout: 20000 }).toBe(2);
    const current = (await app.snapshot(scope)).run;
    expect(current?.id).not.toBe(initial.runId);
    expect(
      (await app.snapshot(scope)).messages.find((message) => message.id === lateId)?.state,
    ).toBe('consumed');
    await app.harness.cancel(scope.projectId, scope.sessionId);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    original.close();
    late.close();
    await app.close();
    recovering = true;
    model.release();
    app = new KernelApplication(root, options);
    await app.initialize();
    replacement = app.connectProduct();
    await replacement.call('session.send', {
      ...scope,
      instructionId: recoveryId,
      text: 'MODEL_CHAT recover',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const tools = (await app.snapshot(scope)).messages.filter(
      (message) => message.tool?.name === 'read_workbench_context',
    );
    expect(JSON.parse(tools[0]?.tool?.output ?? '{}')).toEqual({
      state: 'ambiguous',
      instructionIds: [lateId, recoveryId],
    });
    expect(JSON.parse(tools[1]?.tool?.output ?? '{}')).toEqual({
      state: 'unavailable',
      reason: 'disconnected',
    });
  } finally {
    model.release();
    original.close();
    late.close();
    replacement?.close();
    await app.close();
    await model.close();
  }
});
