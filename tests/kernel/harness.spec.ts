import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

test('real graph reads, writes and retains thinking across model tool turns', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-harness-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  await app.initialize();
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: join(root, 'profile'),
    startedAt: new Date().toISOString(),
    state: 'running' as const,
  };
  const server = await startKernelServer(status, () => app.close(), app);
  const client = createKernelClient({ ...status, url: server.url, token: server.token });
  try {
    await mkdir(join(root, 'project'));
    await writeFile(join(root, 'project', 'input.md'), '# 输入\n\n合成材料。\n');
    await client.connect();
    const project = await client.call('project.open', { path: join(root, 'project') });
    await client.call('project.grant', {
      projectId: project.id,
      read: true,
      write: true,
      send: true,
      autoBackup: false,
    });
    const session = await client.call('session.create', { projectId: project.id });
    const changes: number[] = [];
    client.subscribeChanges((change) => changes.push(change.revision));
    await client.call('workbench.watch', { projectId: project.id, sessionId: session.id });
    const input = {
      projectId: project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE 读取 input.md 并保存 result.md',
      materials: ['input.md'],
    };
    const receipt = await client.call('session.send', input);
    expect(await client.call('session.send', input)).toEqual(receipt);
    await expect
      .poll(
        async () =>
          (
            await client.call('workbench.snapshot', {
              projectId: project.id,
              sessionId: session.id,
            })
          ).run?.state,
        { timeout: 20000 },
      )
      .toBe('completed');
    expect(await readFile(join(root, 'project', 'result.md'), 'utf8')).toContain('合成样本');
    const snapshot = await client.call('workbench.snapshot', {
      projectId: project.id,
      sessionId: session.id,
    });
    expect(snapshot.artifacts).toContainEqual({
      path: 'result.md',
      runId: receipt.runId,
      state: 'linked',
    });
    expect(snapshot.messages.filter((message) => message.id === input.instructionId)).toHaveLength(
      1,
    );
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.text).not.toContain(
      '正在分析材料',
    );
    expect(model.requests.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('synthetic-signature');
    await expect.poll(() => changes.length).toBeGreaterThan(0);
  } finally {
    client.dispose();
    await server.stop();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('accepted additions survive cancellation and checkpoint loss until explicit continuation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-continue-'));
  const model = await createModelServer();
  const profile = join(root, 'profile');
  let app = new KernelApplication(profile, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    model.hold = true;
    await app.harness.send({
      projectId: 'application',
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT MODEL_HOLD',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const addition = randomUUID();
    await app.harness.send({
      projectId: 'application',
      sessionId: session.id,
      instructionId: addition,
      text: 'MODEL_CHAT 追加要求',
      materials: [],
    });
    app.harness.cancel('application', session.id);
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
      )
      .toBe('cancelled');
    expect(
      (await app.snapshot({ projectId: 'application', sessionId: session.id })).messages.find(
        (message) => message.id === addition,
      )?.state,
    ).toBe('accepted');
    await app.close();
    await writeFile(join(profile, 'application', '.scholoom', 'checkpoints.sqlite'), 'damaged');
    model.release();
    const priorRequests = model.requests.length;
    app = new KernelApplication(profile, {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    await app.initialize();
    expect(
      (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
    ).toBe('cancelled');
    expect(model.requests).toHaveLength(priorRequests);
    app.harness.resume('application', session.id);
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
        { timeout: 20000 },
      )
      .toBe('completed');
    expect(
      (await app.snapshot({ projectId: 'application', sessionId: session.id })).messages.find(
        (message) => message.id === addition,
      )?.state,
    ).toBe('consumed');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('checkpoint fallback retains every unfinished instruction beyond the history page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-many-instructions-'));
  const model = await createModelServer();
  const profile = join(root, 'profile');
  let app = new KernelApplication(profile, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const append = model.requests.push.bind(model.requests);
  model.requests.push = (...requests) => {
    const count = append(...requests);
    if (count === 2) model.hold = true;
    return count;
  };
  try {
    await app.initialize();
    const session = app.harness.create('application');
    model.hold = true;
    await app.harness.send({
      projectId: 'application',
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT MODEL_HOLD',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const additions = Array.from(
      { length: 40 },
      (_, i) => `requirement_${String(i).padStart(3, '0')}`,
    );
    for (const text of additions)
      await app.harness.send({
        projectId: 'application',
        sessionId: session.id,
        instructionId: randomUUID(),
        text,
        materials: [],
      });
    model.release();
    await expect.poll(() => model.requests.length).toBe(2);
    app.harness.cancel('application', session.id);
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
      )
      .toBe('cancelled');
    await app.close();
    await writeFile(join(profile, 'application', '.scholoom', 'checkpoints.sqlite'), 'damaged');
    model.release();
    app = new KernelApplication(profile, {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    await app.initialize();
    app.harness.resume('application', session.id);
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
        { timeout: 20000 },
      )
      .toBe('completed');
    const request = JSON.stringify(model.requests.at(-1)?.messages);
    for (const text of additions) expect(request).toContain(text);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('failed artifact registration keeps the saved file and reconcile links it once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-artifacts-'));
  const model = await createModelServer();
  const profile = join(root, 'profile');
  const trigger = 'synthetic_artifact_registration_failure';
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(profile, options);
  let projectId = '';
  let sessionId = '';
  try {
    await mkdir(join(root, 'project'));
    await writeFile(join(root, 'project', 'input.md'), '# 输入\n\n合成材料。\n');
    await app.initialize();
    projectId = (
      (await app.call('project.open', { path: join(root, 'project') })) as { id: string }
    ).id;
    await app.call('project.grant', {
      projectId,
      read: true,
      write: true,
      send: true,
      autoBackup: false,
    });
    sessionId = ((await app.call('session.create', { projectId })) as { id: string }).id;
    // Temporary fault injection at the registration boundary; production code is untouched.
    app.projects
      .get(projectId)
      .database.exec(
        `CREATE TRIGGER ${trigger} BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'synthetic registration failure'); END;`,
      );
    const { runId } = await app.harness.send({
      projectId,
      sessionId,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE 读取 input.md 并保存 result.md',
      materials: ['input.md'],
    });
    const unknown = { path: 'result.md', runId, state: 'unknown' };
    await expect
      .poll(async () => (await app.snapshot({ projectId, sessionId })).artifacts, {
        timeout: 20000,
      })
      .toContainEqual(unknown);
    expect((await app.snapshot({ projectId, sessionId })).run?.state).toBe('completed');
    expect(await readFile(join(root, 'project', 'result.md'), 'utf8')).toContain('合成样本');

    await app.close();
    app = new KernelApplication(profile, options);
    await app.initialize();
    expect((await app.snapshot({ projectId, sessionId })).artifacts).toContainEqual(unknown);
    app.projects.get(projectId).database.exec(`DROP TRIGGER ${trigger}`);
    const linked = { path: 'result.md', runId, state: 'linked' };
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        await app.call('artifacts.reconcile', {
          projectId,
          sessionId,
          runId,
          paths: ['result.md'],
        }),
      ).toEqual([linked]);
    expect(
      (await app.snapshot({ projectId, sessionId })).artifacts.filter(
        (artifact) => artifact.path === 'result.md',
      ),
    ).toEqual([linked]);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
