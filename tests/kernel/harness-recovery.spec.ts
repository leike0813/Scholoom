import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { SqliteSaver } from '../../apps/kernel/node_modules/@langchain/langgraph-checkpoint-sqlite/dist/index.js';
import {
  HarnessRecords,
  InstructionSaver,
  openCheckpoint,
} from '../../packages/harness/dist/node.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import { createModelServer } from '../model-server.js';

const Database = createRequire(new URL('../../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

for (const boundary of ['save', 'ack', 'receipt'] as const) {
  test(`real execution IPC stops after ${boundary} failure and recovers the saved instruction once`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-ipc-checkpoint-'));
    const model = await createModelServer();
    const profile = join(root, 'profile');
    const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
    let app = new KernelApplication(profile, options);
    const confirm = HarnessRecords.prototype.confirmConsumption;
    try {
      await app.initialize();
      const project = app.projects.get('application');
      const session = app.harness.create('application');
      const scope = { projectId: 'application', sessionId: session.id };
      const instructionId = randomUUID();
      let proceed!: () => void;
      const gate = new Promise<void>((resolve) => {
        proceed = resolve;
      });
      const execution = app.models.execution.bind(app.models);
      app.models.execution = async (...args) => {
        await gate;
        return execution(...args);
      };
      const receipt = await app.harness.send({
        ...scope,
        instructionId,
        text: 'MODEL_CHAT original_unique_instruction',
        materials: [],
      });
      const checkpoint = await openCheckpoint(project.internal, receipt.runId);
      if (boundary === 'save')
        checkpoint.database.exec(
          "CREATE TRIGGER fail_save BEFORE INSERT ON checkpoints BEGIN SELECT RAISE(ABORT, 'synthetic disk failure'); END",
        );
      else if (boundary === 'ack')
        project.database.exec(
          "CREATE TRIGGER fail_ack BEFORE UPDATE OF consumed ON instructions BEGIN SELECT RAISE(ABORT, 'synthetic acknowledgement failure'); END",
        );
      else
        HarnessRecords.prototype.confirmConsumption = function (...args) {
          const changed = confirm.apply(this, args);
          if (args[2].instructionIds.includes(instructionId))
            throw new Error('lost IPC confirmation receipt');
          return changed;
        };
      checkpoint.database.close();
      proceed();
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
      expect(model.requests).toHaveLength(0);
      expect(
        (await app.snapshot(scope)).messages.find((message) => message.id === instructionId)?.state,
      ).toBe(boundary === 'receipt' ? 'consumed' : 'accepted');
      await app.close();
      HarnessRecords.prototype.confirmConsumption = confirm;
      const db = new Database(checkpoint.path);
      const reader = new SqliteSaver(db);
      const saved = await reader.getTuple({ configurable: { thread_id: receipt.runId } });
      expect(saved?.checkpoint.channel_values.instructionIds ?? []).toEqual(
        boundary === 'save' ? [] : [instructionId],
      );
      if (boundary === 'save') db.exec('DROP TRIGGER fail_save');
      db.close();
      if (boundary === 'ack') {
        const records = new Database(join(project.internal, 'project.sqlite'));
        records.exec('DROP TRIGGER fail_ack');
        records.close();
      }
      app = new KernelApplication(profile, options);
      await app.initialize();
      await app.harness.send({
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT latest_unique_direction',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      const messages = JSON.stringify(model.requests.at(-1)?.messages);
      expect(messages.match(/original_unique_instruction/g)).toHaveLength(1);
      expect(messages).toContain('latest_unique_direction');
      expect(
        (await app.snapshot(scope)).messages.find((message) => message.id === instructionId)?.state,
      ).toBe('consumed');
    } finally {
      HarnessRecords.prototype.confirmConsumption = confirm;
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}

test('normal next attempt imports the effective graph after restart instead of the last message page', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-context-seed-'));
  const model = await createModelServer();
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  const profile = join(root, 'profile');
  let app = new KernelApplication(profile, options);
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
    await project.save('input.md', 'independent_tool_evidence_73');
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    const first = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE retain_early_constraint_73',
      materials: ['input.md'],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const records = new HarnessRecords(project.internal);
    for (let i = 0; i < 40; i++)
      records.db.$client.prepare('INSERT INTO messages(id,sessionId,value) VALUES (?,?,?)').run(
        randomUUID(),
        session.id,
        JSON.stringify({
          id: randomUUID(),
          sessionId: session.id,
          role: 'assistant',
          state: 'complete',
          text: `projection_only_${i}`,
          materials: [],
          createdAt: new Date().toISOString(),
        }),
      );
    records.close();
    await app.close();
    app = new KernelApplication(profile, options);
    await app.initialize();
    const second = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT next_round',
      materials: [],
    });
    expect(second.runId).not.toBe(first.runId);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const messages = JSON.stringify(model.requests.at(-1)?.messages);
    expect(messages).toContain('retain_early_constraint_73');
    expect(messages).toContain('independent_tool_evidence_73');
    expect(messages).toContain('synthetic-signature');
    expect(messages).toContain('next_round');
    expect(messages).not.toContain('projection_only_');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('scratch content remains usable across attempts and restart without exposing it to another session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-session-scratch-'));
  const model = await createModelServer();
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(root, options);
  try {
    await app.initialize();
    const first = app.harness.create('application');
    const send = (sessionId: string, text: string) =>
      app.harness.send({
        projectId: 'application',
        sessionId,
        instructionId: randomUUID(),
        text,
        materials: [],
      });
    const scope = { projectId: 'application', sessionId: first.id };
    await send(first.id, 'MODEL_SCRATCH_WRITE');
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const project = app.projects.get('application');
    expect(
      await readFile(
        join(project.internal, 'harness', 'sessions', first.id, 'scratch', 'context.md'),
        'utf8',
      ),
    ).toBe('session_private_scratch_73');
    project.database
      .prepare('DELETE FROM harness_meta WHERE key=?')
      .run(`scratch-isolated:${first.id}`);
    await rename(
      join(project.internal, 'harness', 'sessions', first.id, 'scratch'),
      join(project.internal, 'scratch'),
    );
    await app.close();
    app = new KernelApplication(root, options);
    await app.initialize();
    await send(first.id, 'MODEL_SCRATCH_READ');
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('session_private_scratch_73');
    expect(await readFile(join(project.internal, 'scratch', 'context.md'), 'utf8')).toBe(
      'session_private_scratch_73',
    );
    const second = app.harness.create('application');
    const execution = app.models.execution.bind(app.models);
    app.models.execution = async () => {
      throw new Error('synthetic before scratch creation');
    };
    await send(second.id, 'MODEL_CHAT first failure');
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: second.id })).run?.state,
      )
      .toBe('failed');
    app.models.execution = execution;
    await send(second.id, 'MODEL_SCRATCH_READ');
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: second.id })).run?.state,
      )
      .toBe('completed');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).not.toContain(
      'session_private_scratch_73',
    );
    const tool = (
      await app.snapshot({ projectId: 'application', sessionId: second.id })
    ).messages.find((message) => message.tool?.name === 'read_file');
    expect(tool?.state).toBe('error');
    await rename(
      join(project.internal, 'harness', 'sessions', first.id, 'scratch', 'context.md'),
      join(root, 'retained-context.md'),
    );
    await send(first.id, 'MODEL_SCRATCH_READ missing context');
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('context_incomplete');
    expect(await readFile(join(root, 'retained-context.md'), 'utf8')).toBe(
      'session_private_scratch_73',
    );
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('legacy scratch uncertainty survives failure before its diagnostic reaches the graph', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-scratch-migration-window-'));
  const model = await createModelServer();
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(root, options);
  const confirm = InstructionSaver.prototype.confirmLatest;
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    const send = (text: string) =>
      app.harness.send({ ...scope, instructionId: randomUUID(), text, materials: [] });
    await send('MODEL_CHAT original graph');
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const project = app.projects.get('application');
    project.database
      .prepare('DELETE FROM harness_meta WHERE key=?')
      .run(`scratch-isolated:${session.id}`);
    InstructionSaver.prototype.confirmLatest = async () => {
      throw new Error('synthetic interruption after migration marker');
    };
    await send('MODEL_CHAT interrupted migration');
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
    expect(
      project.database
        .prepare('SELECT value FROM harness_meta WHERE key=?')
        .get(`scratch-isolated:${session.id}`),
    ).toMatchObject({ value: 'legacy-unverified' });
    InstructionSaver.prototype.confirmLatest = confirm;
    await app.close();
    app = new KernelApplication(root, options);
    await app.initialize();
    await send('MODEL_CHAT next round');
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('context_incomplete');
  } finally {
    InstructionSaver.prototype.confirmLatest = confirm;
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('automatic tool-result offload is checked without a summary or an explicit scratch read', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-offload-context-'));
  const model = await createModelServer();
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(root, options);
  try {
    await app.initialize();
    const project = app.projects.get('application');
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    project.database.transaction(() => {
      for (let index = 0; index < 25; index++) {
        const id = randomUUID();
        project.database.prepare('INSERT INTO messages(id,sessionId,value) VALUES(?,?,?)').run(
          id,
          session.id,
          JSON.stringify({
            id,
            sessionId: session.id,
            role: 'user',
            state: 'consumed',
            text: `persisted constraint ${index} ${'synthetic '.repeat(450)}`,
            materials: [],
            createdAt: new Date().toISOString(),
          }),
        );
        project.database
          .prepare('INSERT INTO instructions(id,sessionId,runId,consumed) VALUES(?,?,?,1)')
          .run(id, session.id, 'historical');
      }
    })();
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_OFFLOAD 核查全部持久指令',
      materials: [],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const scratch = join(project.internal, 'harness', 'sessions', session.id, 'scratch');
    const files = await readdir(scratch);
    const offloaded = files.find((file) => file.endsWith('.txt'));
    if (!offloaded) throw new Error('Expected an actual offloaded tool result');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('/large_tool_results/');
    await app.close();
    await rename(join(scratch, offloaded), join(root, 'retained-tool-result.txt'));
    app = new KernelApplication(root, options);
    await app.initialize();
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT 接续核查',
      materials: [],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('context_incomplete');
    expect(await readFile(join(root, 'retained-tool-result.txt'), 'utf8')).toContain(
      'persisted constraint',
    );
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('an empty saved scratch file remains a valid resource on the next attempt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-empty-context-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    for (const text of ['MODEL_SCRATCH_WRITE_EMPTY', 'MODEL_CHAT next round']) {
      await app.harness.send({ ...scope, instructionId: randomUUID(), text, materials: [] });
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    }
    const project = app.projects.get('application');
    expect(
      await readFile(
        join(project.internal, 'harness', 'sessions', session.id, 'scratch', 'context.md'),
        'utf8',
      ),
    ).toBe('');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).not.toContain('context_incomplete');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('real framework compression shares model admission and preserves its summary and history across restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-framework-context-'));
  const model = await createModelServer();
  const profile = join(root, 'profile');
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(profile, options);
  const start = ManagedNode.start;
  ManagedNode.start = (config) =>
    start({
      ...config,
      ...(config.entry.href ===
      new URL('../../packages/harness/dist/execution.js', import.meta.url).href
        ? { entry: new URL('../fixtures/processes/compressing-agent.mjs', import.meta.url) }
        : {}),
    });
  let admissions = 0;
  const observe = () => {
    const create = app.models.execution.bind(app.models);
    app.models.execution = async (...args) => {
      const execution = await create(...args);
      return {
        ...execution,
        acquire: async () => {
          const lease = await execution.acquire();
          admissions++;
          return lease;
        },
      };
    };
  };
  try {
    observe();
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
    await project.save('input.md', 'reading_evidence_73');
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: `MODEL_SUMMARY_CONTEXT effective_constraint_73 ${'background '.repeat(2000)}`,
      materials: ['input.md'],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const summaryRequests = model.requests.filter(
      (request) => !Array.isArray(request.tools) || request.tools.length === 0,
    );
    expect(summaryRequests.length).toBeGreaterThan(0);
    expect(
      (await app.snapshot(scope)).messages.find((message) => message.tool?.name === 'read_file')
        ?.tool?.output,
    ).toContain('reading_evidence_73');
    expect(JSON.stringify(summaryRequests[0]?.messages)).toContain('effective_constraint_73');
    expect(admissions).toBe(model.requests.length);
    const scratch = join(project.internal, 'harness', 'sessions', session.id, 'scratch');
    const historyFiles = (await readdir(scratch)).filter((file) => file.endsWith('.md'));
    expect(historyFiles.length).toBeGreaterThan(0);
    const history = await Promise.all(
      historyFiles.map((file) => readFile(join(scratch, file), 'utf8')),
    );
    expect(history.join('\n')).toContain('effective_constraint_73');
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: `MODEL_SUMMARY_CONTEXT appended_constraint_91 ${'additional '.repeat(2000)}`,
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    const appended = await Promise.all(
      historyFiles.map((file) => readFile(join(scratch, file), 'utf8')),
    );
    expect(appended.join('\n')).toContain('effective_constraint_73');
    expect(appended.join('\n')).toContain('appended_constraint_91');
    expect(appended.join('\n').length).toBeGreaterThan(history.join('\n').length);
    await app.close();
    for (const file of historyFiles)
      await rename(join(scratch, file), join(root, `retained-${file}`));
    ManagedNode.start = start;
    app = new KernelApplication(profile, options);
    observe();
    await app.initialize();
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT next context round',
      materials: [],
    });
    await expect
      .poll(
        async () => {
          const run = (await app.snapshot(scope)).run;
          if (run?.state === 'failed') throw new Error(run.error);
          return run?.state;
        },
        { timeout: 20000 },
      )
      .toBe('completed');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('effective_constraint_73');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('reading_evidence_73');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('context_incomplete');
    expect(admissions).toBe(model.requests.length);
  } finally {
    ManagedNode.start = start;
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('a possibly live prior writer prevents execution reuse without signalling an unrelated PID', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-old-writer-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    const first = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT initial',
      materials: [],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    const records = new HarnessRecords(app.projects.get('application').internal);
    try {
      const value = {
        instanceId: 'unresolved-owner',
        hostInstanceId: 'old-host',
        runId: first.runId,
        processId: process.pid,
        state: 'running',
      };
      records.db.$client
        .prepare('INSERT INTO run_instances(id,run_id,host_instance_id,value) VALUES (?,?,?,?)')
        .run(value.instanceId, value.runId, value.hostInstanceId, JSON.stringify(value));
      const count = model.requests.length;
      await app.harness.send({
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT next',
        materials: [],
      });
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
      expect(model.requests).toHaveLength(count);
      records.db.$client.prepare('DELETE FROM run_instances WHERE id=?').run(value.instanceId);
      await app.harness.send({
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT retry after ownership resolved',
        materials: [],
      });
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    } finally {
      records.close();
    }
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('serialized checkpoint corruption falls back to a new attempt and preserves the unusable source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-checkpoint-content-'));
  const model = await createModelServer();
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  const app = new KernelApplication(join(root, 'profile'), options);
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    model.hold = true;
    const first = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT unfinished_content',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    app.harness.cancel(scope.projectId, scope.sessionId);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    const opened = await openCheckpoint(app.projects.get('application').internal, first.runId);
    opened.database
      .prepare('UPDATE checkpoints SET checkpoint=?')
      .run(Buffer.from('invalid serialized content'));
    opened.database.close();
    model.release();
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT latest_content',
      materials: [],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    expect((await app.snapshot(scope)).run?.id).not.toBe(first.runId);
    const source = new Database(opened.path, { readonly: true });
    try {
      expect(source.pragma('quick_check', { simple: true })).toBe('ok');
      expect(
        source.prepare('SELECT checkpoint FROM checkpoints LIMIT 1').get().checkpoint.toString(),
      ).toBe('invalid serialized content');
    } finally {
      source.close();
    }
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('unfinished_content');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('failed interruption diagnostics cannot retain the private checkpoint claim', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-checkpoint-cleanup-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    model.hold = true;
    const receipt = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT held',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const db = app.projects.get('application').database;
    const id = randomUUID();
    db.prepare('INSERT INTO messages(id,sessionId,value) VALUES (?,?,?)').run(
      id,
      session.id,
      JSON.stringify({
        id,
        sessionId: session.id,
        role: 'tool',
        state: 'streaming',
        text: 'synthetic in-flight fact',
        materials: [],
        createdAt: new Date().toISOString(),
        tool: { runId: receipt.runId, name: 'synthetic', input: '{}', inputTruncated: false },
      }),
    );
    db.exec(
      "CREATE TRIGGER fail_cleanup BEFORE UPDATE ON messages WHEN json_extract(OLD.value,'$.role')='tool' BEGIN SELECT RAISE(ABORT,'synthetic diagnostic failure'); END",
    );
    app.harness.cancel(scope.projectId, scope.sessionId);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    db.exec('DROP TRIGGER fail_cleanup');
    model.release();
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT retry_after_cleanup_failure',
      materials: [],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
