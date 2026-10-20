import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { RunInstance } from '../../packages/harness/dist/node.js';
import { createModelServer } from '../model-server.js';

test('two actual execution processes share one model slot and release it when the stream ends', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-model-process-slot-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const create = app.models.execution.bind(app.models);
  let executions = 0;
  const requested = new Set<number>(),
    granted = new Set<number>();
  app.models.execution = async (...args) => {
    const execution = await create(...args),
      id = ++executions;
    return {
      ...execution,
      acquire: async () => {
        requested.add(id);
        const lease = await execution.acquire();
        granted.add(id);
        return lease;
      },
    };
  };
  try {
    await app.initialize();
    const first = app.harness.create('application'),
      second = app.harness.create('application');
    const send = (sessionId: string) =>
      app.harness.send({
        projectId: 'application',
        sessionId,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT concurrent',
        materials: [],
      });
    model.hold = true;
    await send(first.id);
    await expect.poll(() => model.requests.length).toBe(1);
    await send(second.id);
    await expect.poll(() => requested.size).toBe(2);
    expect([...granted]).toEqual([1]);
    expect(model.requests).toHaveLength(1);
    const instances = (
      app.projects.get('application').database.prepare('SELECT value FROM run_instances').all() as {
        value: string;
      }[]
    ).map((row) => JSON.parse(row.value) as RunInstance);
    expect(instances).toHaveLength(2);
    expect(new Set(instances.map((instance) => instance.processId)).size).toBe(2);
    expect(
      instances.every(
        (instance) => instance.state === 'running' && instance.processId !== process.pid,
      ),
    ).toBe(true);
    model.release();
    for (const session of [first, second])
      await expect
        .poll(
          async () =>
            (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
        )
        .toBe('completed');
    expect([...granted]).toEqual([1, 2]);
    expect(model.requests).toHaveLength(2);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('parent and capability keep a single 32-request budget after the capability exits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-shared-model-budget-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ trust: 'trusted', autoBackup: false });
    await project.save('input.md', 'bounded evidence 42');
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_RESEARCH MODEL_SHARED_BUDGET',
      materials: ['input.md'],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 30000 })
      .toBe('failed');
    expect(model.requests).toHaveLength(32);
    expect(
      model.requests.filter((request) => JSON.stringify(request.messages).includes('MODEL_BUDGET')),
    ).toHaveLength(29);
    const attempt = (await app.research.list(scope)).attempts[0];
    assert(attempt);
    expect(attempt).toMatchObject({ state: 'failed', delivery: 'incomplete' });
    expect(attempt.issues.some((issue) => issue.includes('32'))).toBe(true);
    expect((await app.snapshot(scope)).run?.error).toContain('32');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

for (const revocation of ['send', 'instance'] as const) {
  test(`revoking ${revocation} while another process waits for model admission prevents its HTTP request`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-model-revocation-'));
    const model = await createModelServer();
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    const create = app.models.execution.bind(app.models);
    let requests = 0;
    app.models.execution = async (...args) => {
      const execution = await create(...args);
      return {
        ...execution,
        acquire: async () => {
          requests++;
          return execution.acquire();
        },
      };
    };
    try {
      await app.initialize();
      const project = await app.projects.create(join(root, 'project'));
      project.grant({ trust: 'trusted', autoBackup: false });
      const first = app.harness.create(project.project.id),
        second = app.harness.create(project.project.id);
      const send = (sessionId: string) =>
        app.harness.send({
          projectId: project.project.id,
          sessionId,
          instructionId: randomUUID(),
          text: 'MODEL_CHAT held',
          materials: [],
        });
      model.hold = true;
      await send(first.id);
      await expect.poll(() => model.requests.length).toBe(1);
      await send(second.id);
      await expect.poll(() => requests).toBe(2);
      if (revocation === 'send') project.grant({ trust: 'restricted', autoBackup: false });
      else {
        const runId = (await app.snapshot({ projectId: project.project.id, sessionId: second.id }))
          .run?.id;
        project.database
          .prepare(
            "UPDATE run_instances SET value=json_set(value,'$.state','stopping') WHERE run_id=?",
          )
          .run(runId);
      }
      model.release();
      await expect
        .poll(
          async () =>
            (await app.snapshot({ projectId: project.project.id, sessionId: second.id })).run
              ?.state,
        )
        .toBe('failed');
      expect(model.requests).toHaveLength(1);
    } finally {
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}
