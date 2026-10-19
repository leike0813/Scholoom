import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import { createModelServer } from '../model-server.js';

test('a capability crash stays local and an explicit retry keeps its invocation and prior attempt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-capability-isolation-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const start = ManagedNode.start;
  let executions = 0;
  ManagedNode.start = (options) => {
    const execution =
      options.entry.href ===
      new URL('../../packages/harness/dist/execution.js', import.meta.url).href;
    return start({
      ...options,
      ...(execution && ++executions === 2
        ? { entry: new URL('../fixtures/processes/crashing-agent.mjs', import.meta.url) }
        : {}),
    });
  };
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
    await project.save('input.md', 'controlled result 42');
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    const send = (text: string) =>
      app.harness.send({ ...scope, instructionId: randomUUID(), text, materials: [] });
    await send('MODEL_RESEARCH');
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const failed = (await app.research.list(scope)).attempts[0];
    if (!failed) throw new Error('Expected the failed capability attempt');
    expect(failed).toMatchObject({ state: 'failed', delivery: 'incomplete', attempt: 1 });
    expect(failed.issues.some((issue) => issue.startsWith('reportMissing:'))).toBe(true);
    expect((await app.call('library.list', {})).sources).toEqual([]);
    ManagedNode.start = start;
    const other = app.harness.create('application');
    await app.harness.send({
      projectId: 'application',
      sessionId: other.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT unrelated',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: other.id })).run?.state,
      )
      .toBe('completed');
    await send(`MODEL_RETRY ${failed.invocationId}`);
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const attempts = (await app.research.list(scope)).attempts;
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      invocationId: failed.invocationId,
      attempt: 2,
      state: 'completed',
      delivery: 'usable',
    });
    expect(attempts[1]).toEqual(failed);
    expect(await readFile(join(root, 'project', 'analysis.md'), 'utf8')).toContain('42');
    expect((await app.call('library.list', {})).sources).toEqual([]);
  } finally {
    ManagedNode.start = start;
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
