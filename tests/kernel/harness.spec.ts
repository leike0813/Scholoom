import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { ToolMessage } from '../../apps/kernel/node_modules/@langchain/core/dist/messages/index.js';
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
      trust: 'trusted',
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
    expect(snapshot.artifacts).toContainEqual(
      expect.objectContaining({
        path: 'result.md',
        runId: receipt.runId,
        state: 'linked',
      }),
    );
    expect(snapshot.messages.filter((message) => message.id === input.instructionId)).toHaveLength(
      1,
    );
    const tools = snapshot.messages.filter((message) => message.role === 'tool');
    expect(tools.map((message) => message.tool?.name)).toEqual(['read_file', 'write_file']);
    expect(tools.every((message) => message.state === 'complete')).toBe(true);
    expect(JSON.parse(tools[0]?.tool?.input ?? '{}').file_path).toBe('/input.md');
    expect(tools[0]?.tool?.output).toContain('合成材料');
    expect(tools.every((message) => message.tool?.runId === receipt.runId)).toBe(true);
    const replies = snapshot.messages.filter((message) => message.role === 'assistant');
    expect(replies.length).toBeGreaterThan(0);
    expect(replies.every((message) => message.runId === receipt.runId)).toBe(true);
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
      project.grant({ trust: 'trusted', autoBackup: false });
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

test('a malformed provider result after saving preserves unknown effects and never enters the graph', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-tool-result-contract-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ trust: 'trusted', autoBackup: false });
    await project.save('input.md', 'controlled evidence');
    const save = project.save.bind(project);
    let saves = 0;
    project.save = async (...args) => {
      const result = await save(...args);
      if (args[0] === 'result.md') {
        saves++;
        return { ...result, path: { invalid_provider_marker: true } } as never;
      }
      return result;
    };
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    const { runId } = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE',
      materials: [],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const snapshot = await app.snapshot(scope);
    expect(snapshot.messages.find((message) => message.tool?.name === 'write_file')?.state).toBe(
      'unknown',
    );
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('outcomeUnknown');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).not.toContain(
      'invalid_provider_marker',
    );
    expect(await readFile(join(root, 'project', 'result.md'), 'utf8')).toContain('合成');
    expect(saves).toBe(1);
    const requests = model.requests.length;
    expect(
      await app.call('artifacts.reconcile', { ...scope, runId, paths: ['result.md'] }),
    ).toContainEqual(expect.objectContaining({ path: 'result.md', state: 'linked' }));
    expect(saves).toBe(1);
    expect(model.requests).toHaveLength(requests);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

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
    project.grant({ trust: 'trusted', autoBackup: false });
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

for (const confirmed of [false, true]) {
  test(`cancelling an in-flight tool preserves its receipt across restart (confirmed=${confirmed})`, async () => {
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
      project.grant({ trust: 'trusted', autoBackup: false });
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
            (await app.snapshot(scope)).messages.find(
              (message) => message.tool?.name === 'read_file',
            )?.state,
        )
        .toBe('streaming');
      app.harness.cancel(scope.projectId, scope.sessionId);
      release();
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
      expect(
        (await app.snapshot(scope)).messages.find((message) => message.tool?.name === 'read_file')
          ?.state,
      ).toBe('unknown');
      if (confirmed) {
        const receipt = (await app.snapshot(scope)).messages.find(
          (message) => message.tool?.name === 'read_file',
        );
        assert(receipt?.tool);
        const result = new ToolMessage({
          tool_call_id: receipt.id.slice(`tool:${receipt.tool.runId}:`.length),
          name: 'read_file',
          content: 'confirmed_tool_result_73',
        });
        project.database
          .prepare('UPDATE harness_meta SET value=? WHERE key=?')
          .run(JSON.stringify({ result: result.toDict() }), receipt.id);
      }
      await app.close();
      app = new KernelApplication(join(root, 'profile'), options);
      await app.initialize();
      expect(
        (await app.snapshot(scope)).messages.find((message) => message.tool?.name === 'read_file')
          ?.state,
      ).toBe('unknown');
      const previousRun = (await app.snapshot(scope)).run;
      const accepted = await app.harness.send({
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_WITHDRAW_GOAL 撤回旧目标；不再写报告，仅确认最新要求。',
        materials: [],
      });
      expect(accepted.runId).toBe(previousRun?.id);
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
      const request = model.requests.at(-1);
      expect(JSON.stringify(request?.messages)).toContain('MODEL_WITHDRAW_GOAL');
      const blocks = (
        (request?.messages ?? []) as {
          content?: { type: string; id?: string; tool_use_id?: string }[];
        }[]
      ).flatMap((message) => (Array.isArray(message.content) ? message.content : []));
      expect(blocks.filter((block) => block.type === 'tool_use').length).toBeGreaterThan(0);
      expect(JSON.stringify(blocks.filter((block) => block.type === 'tool_result'))).toContain(
        confirmed ? 'confirmed_tool_result_73' : 'outcomeUnknown',
      );
      expect(
        blocks
          .filter((block) => block.type === 'tool_result')
          .map((block) => block.tool_use_id)
          .sort(),
      ).toEqual(
        blocks
          .filter((block) => block.type === 'tool_use')
          .map((block) => block.id)
          .sort(),
      );
      expect(
        (await app.projects.get(scope.projectId).list()).entries.map((entry) => entry.path),
      ).toEqual(['input.md']);
    } finally {
      release();
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}

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
    const store = await app.projects.create(join(root, 'project'));
    store.grant({ trust: 'trusted', autoBackup: false });
    const projectId = store.project.id;
    const material = await store.save('attached.md', 'Original material');
    if (!material.fileId) throw new Error('Expected a registered material');
    const session = app.harness.create(projectId);
    model.hold = true;
    const firstReceipt = await app.harness.send({
      projectId,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT MODEL_HOLD',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const addition = randomUUID();
    await app.harness.send({
      projectId,
      sessionId: session.id,
      instructionId: addition,
      text: 'MODEL_CHAT 追加要求',
      materials: ['attached.md'],
      materialFileIds: [material.fileId],
    });
    await store.files.mutate('rename', 'move-attachment', {
      path: 'attached.md',
      name: 'moved.md',
    });
    await store.save('attached.md', 'Replacement');
    app.harness.cancel(projectId, session.id);
    await expect
      .poll(async () => (await app.snapshot({ projectId, sessionId: session.id })).run?.state)
      .toBe('cancelled');
    expect(
      (await app.snapshot({ projectId, sessionId: session.id })).messages.find(
        (message) => message.id === addition,
      )?.state,
    ).toBe('accepted');
    await app.close();
    await writeFile(
      join(store.internal, 'harness', 'checkpoints', `${firstReceipt.runId}.sqlite`),
      'damaged',
    );
    model.release();
    const priorRequests = model.requests.length;
    app = new KernelApplication(profile, {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    await app.initialize();
    expect((await app.snapshot({ projectId, sessionId: session.id })).run?.state).toBe('cancelled');
    expect(model.requests).toHaveLength(priorRequests);
    await app.harness.send({
      projectId,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT 核对材料后接续',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot({ projectId, sessionId: session.id })).run?.state, {
        timeout: 20000,
      })
      .toBe('completed');
    const delivered = JSON.stringify(model.requests.at(-1)?.messages);
    expect(delivered).toContain('moved.md');
    expect(delivered).toContain(material.fileId);
    const historical = (await app.snapshot({ projectId, sessionId: session.id })).messages.find(
      (message) => message.id === addition,
    );
    expect(historical?.materials).toEqual(['attached.md']);
    expect(
      (await app.snapshot({ projectId, sessionId: session.id })).messages.find(
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
      { length: 120 },
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
    const stoppedRun = (await app.snapshot({ projectId: 'application', sessionId: session.id }))
      .run;
    if (!stoppedRun) throw new Error('Expected the stopped attempt');
    await app.close();
    await writeFile(
      join(
        profile,
        'application',
        '.scholoom',
        'harness',
        'checkpoints',
        `${stoppedRun.id}.sqlite`,
      ),
      'damaged',
    );
    model.release();
    app = new KernelApplication(profile, {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    await app.initialize();
    const requestsBeforeRecovery = model.requests.length;
    await app.harness.send({
      projectId: 'application',
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT 核对所有未完成指令后接续',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.state,
        { timeout: 20000 },
      )
      .toBe('completed');
    expect(
      (await app.snapshot({ projectId: 'application', sessionId: session.id })).run?.attempt,
    ).toBeGreaterThan(stoppedRun.attempt);
    const request = JSON.stringify(
      model.requests.slice(requestsBeforeRecovery).map((item) => item.messages),
    );
    for (const text of additions) expect(request).toContain(text);
    const history: string[] = [];
    let before: string | undefined;
    do {
      const page = await app.snapshot({
        projectId: 'application',
        sessionId: session.id,
        limit: 25,
        ...(before ? { before } : {}),
      });
      history.push(
        ...page.messages.filter((item) => item.role === 'user').map((item) => item.text),
      );
      before = page.nextBefore;
    } while (before);
    for (const text of additions) expect(history).toContain(text);
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
      trust: 'trusted',
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
      .toContainEqual(expect.objectContaining(unknown));
    await expect
      .poll(async () => (await app.snapshot({ projectId, sessionId })).run?.state)
      .toBe('completed');
    expect(await readFile(join(root, 'project', 'result.md'), 'utf8')).toContain('合成样本');

    await app.close();
    app = new KernelApplication(profile, options);
    await app.initialize();
    expect((await app.snapshot({ projectId, sessionId })).artifacts).toContainEqual(
      expect.objectContaining(unknown),
    );
    app.projects.get(projectId).database.exec(`DROP TRIGGER ${trigger}`);
    const report = join(root, 'project', 'result.md');
    const original = join(root, 'original-result.md');
    const content = await readFile(report, 'utf8');
    await rename(report, original);
    await writeFile(report, content);
    expect(
      await app.call('artifacts.reconcile', {
        projectId,
        sessionId,
        runId,
        paths: ['result.md'],
      }),
    ).toEqual([expect.objectContaining(unknown)]);
    await rename(original, report);
    const linked = { path: 'result.md', runId, state: 'linked' };
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        await app.call('artifacts.reconcile', {
          projectId,
          sessionId,
          runId,
          paths: ['result.md'],
        }),
      ).toEqual([expect.objectContaining(linked)]);
    expect(
      (await app.snapshot({ projectId, sessionId })).artifacts.filter(
        (artifact) => artifact.path === 'result.md',
      ),
    ).toEqual([expect.objectContaining(linked)]);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('Agent structure tools use shared storage and keep saved artifact identity through directory recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-agent-structure-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const store = await app.projects.create(join(root, 'project'));
    store.grant({ trust: 'trusted', autoBackup: false });
    const session = app.harness.create(store.project.id);
    await app.harness.send({
      projectId: store.project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_STRUCTURE',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: store.project.id, sessionId: session.id })).run?.state,
      )
      .toBe('completed');
    expect(await readFile(join(store.project.path, 'recovered', 'result.md'), 'utf8')).toContain(
      '42',
    );
    const snapshot = await app.snapshot({ projectId: store.project.id, sessionId: session.id });
    expect(snapshot.artifacts).toEqual([
      expect.objectContaining({
        path: 'managed/result.md',
        state: 'linked',
        location: expect.objectContaining({ path: 'recovered/result.md', state: 'present' }),
      }),
    ]);
    for (const name of [
      'mkdir_project_path',
      'rename_project_path',
      'trash_project_path',
      'restore_project_path',
    ])
      expect(snapshot.messages).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          state: 'complete',
          tool: expect.objectContaining({ name }),
        }),
      );
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
