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
    const tools = snapshot.messages.filter((message) => message.role === 'tool');
    expect(tools.map((message) => message.tool?.name)).toEqual(['read_file', 'write_file']);
    expect(tools.every((message) => message.state === 'complete')).toBe(true);
    expect(JSON.parse(tools[0]?.tool?.input ?? '{}').file_path).toBe('/input.md');
    expect(tools[0]?.tool?.output).toContain('合成材料');
    expect(tools.every((message) => message.tool?.runId === receipt.runId)).toBe(true);
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

for (const parallel of [false, true]) {
  test(`tool failures survive restart without replaying effects (parallel=${parallel})`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-tool-failure-'));
    const model = await createModelServer();
    const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
    let app = new KernelApplication(join(root, 'profile'), options);
    try {
      await mkdir(join(root, 'project'));
      await writeFile(join(root, 'project', 'input.md'), 'Error: is ordinary source content');
      await writeFile(join(root, 'project', 'result.md'), 'protected existing result');
      await app.initialize();
      const project = await app.projects.open(join(root, 'project'));
      project.grant({ read: true, write: true, send: true, autoBackup: false });
      const session = app.harness.create(project.project.id);
      const scope = { projectId: project.project.id, sessionId: session.id };
      const snapshot = () => app.snapshot(scope);
      await app.harness.send({
        ...scope,
        instructionId: randomUUID(),
        text: parallel ? 'MODEL_FIXTURE MODEL_PARALLEL' : 'MODEL_FIXTURE',
        materials: [],
      });
      await expect
        .poll(async () => (await snapshot()).run?.state, { timeout: 20000 })
        .toBe('completed');
      const messages = (await snapshot()).messages;
      expect(messages.find((message) => message.tool?.name === 'read_file')?.state).toBe(
        'complete',
      );
      const failed = messages.find((message) => message.tool?.name === 'write_file');
      expect(failed?.state).toBe('error');
      expect(failed?.tool?.output).toContain('contentChanged');
      expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('contentChanged');
      expect(await readFile(join(root, 'project', 'result.md'), 'utf8')).toBe(
        'protected existing result',
      );
      const requests = model.requests.length;
      await app.close();
      app = new KernelApplication(join(root, 'profile'), options);
      await app.initialize();
      expect((await snapshot()).messages.find((message) => message.id === failed?.id)).toEqual(
        failed,
      );
      expect(model.requests).toHaveLength(requests);
    } finally {
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}

test('large tool previews are bounded without truncating the saved artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-tool-preview-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await mkdir(join(root, 'project'));
    await writeFile(join(root, 'project', 'input.md'), '合成材料'.repeat(6000));
    await app.initialize();
    const project = await app.projects.open(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE MODEL_LARGE_TOOL',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const tool = (await app.snapshot(scope)).messages.find(
      (message) => message.tool?.name === 'write_file',
    );
    expect(tool?.state).toBe('complete');
    expect(tool?.tool?.input.length).toBeLessThanOrEqual(16384);
    expect(tool?.tool?.inputTruncated).toBe(true);
    const read = (await app.snapshot(scope)).messages.find(
      (message) => message.tool?.name === 'read_file',
    );
    expect(read?.tool?.output?.length).toBeLessThanOrEqual(16384);
    expect(read?.tool?.outputTruncated).toBe(true);
    expect(await readFile(join(root, 'project', 'result.md'), 'utf8')).toBe(
      '合成预览'.repeat(5000),
    );
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('cancelling an in-flight tool preserves unknown outcome across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-tool-cancel-'));
  const model = await createModelServer();
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(join(root, 'profile'), options);
  let release = () => {};
  try {
    await mkdir(join(root, 'project'));
    await writeFile(join(root, 'project', 'input.md'), 'synthetic');
    await app.initialize();
    const project = await app.projects.open(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
    const original = project.read.bind(project);
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    project.read = async (...args) => {
      await held;
      return original(...args);
    };
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot(scope)).messages.find((message) => message.tool?.name === 'read_file')
            ?.state,
      )
      .toBe('streaming');
    app.harness.cancel(scope.projectId, scope.sessionId);
    release();
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    expect(
      (await app.snapshot(scope)).messages.find((message) => message.tool?.name === 'read_file')
        ?.state,
    ).toBe('unknown');
    await app.close();
    app = new KernelApplication(join(root, 'profile'), options);
    await app.initialize();
    expect(
      (await app.snapshot(scope)).messages.find((message) => message.tool?.name === 'read_file')
        ?.state,
    ).toBe('unknown');
  } finally {
    release();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('startup marks unfinished tool records unknown and retains confirmed results', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-tool-interrupted-'));
  let app = new KernelApplication(root, { environment: {} });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const store = app.projects.get('application');
    const runId = randomUUID();
    store.database
      .prepare('INSERT INTO runs (id, sessionId, value) VALUES (?, ?, ?)')
      .run(
        runId,
        session.id,
        JSON.stringify({ id: runId, sessionId: session.id, attempt: 1, state: 'running' }),
      );
    for (const state of ['streaming', 'complete']) {
      const id = `${runId}:${state}`;
      store.database.prepare('INSERT INTO messages (id, sessionId, value) VALUES (?, ?, ?)').run(
        id,
        session.id,
        JSON.stringify({
          id,
          sessionId: session.id,
          role: 'tool',
          state,
          text: 'read_file',
          materials: [],
          createdAt: new Date().toISOString(),
          tool: { runId, name: 'read_file', input: '{}', inputTruncated: false },
        }),
      );
    }
    await app.close();
    app = new KernelApplication(root, { environment: {} });
    await app.initialize();
    const snapshot = await app.snapshot({ projectId: 'application', sessionId: session.id });
    expect(snapshot.run?.state).toBe('interrupted');
    expect(snapshot.messages.map((message) => message.state)).toEqual(['unknown', 'complete']);
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('scratch backend errors also produce failed tool records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-scratch-error-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_SCRATCH_ERROR',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const tool = (await app.snapshot(scope)).messages.find(
      (message) => message.tool?.name === 'edit_file',
    );
    expect(tool?.state).toBe('error');
    expect(tool?.tool?.output).toBeTruthy();
  } finally {
    await app.close();
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
