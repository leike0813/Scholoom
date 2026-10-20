import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';
import type { RunInstance } from '../../packages/harness/dist/node.js';
import { callExecutionControl } from '../../packages/harness/dist/node.js';
import type { ProcessAdmission } from '../../packages/platform/dist/node.js';
import { ManagedNode } from '../../packages/platform/dist/node.js';
import { createModelServer } from '../model-server.js';

test('owned execution controls validate real IPC payloads and return the actual process identity', async () => {
  const child = await ManagedNode.start({
    entry: new URL('../../packages/harness/dist/execution.js', import.meta.url),
    instanceId: randomUUID(),
  });
  const peer = new RpcPeer({ send: (frame) => child.send(JSON.parse(frame)) });
  child.on('message', (message) => peer.receive(JSON.stringify(message)));
  try {
    const health = await callExecutionControl(peer, 'execution.health', {});
    expect(health.processId).toBe(child.identity?.pid);
    await expect(
      peer.request('execution.health', { processId: 1 }, { waitMs: 1000 }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(
      peer.request('execution.next', { runId: 'untrusted' }, { waitMs: 1000 }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(
      peer.request(
        'execution.initialize',
        { model: { model: 'synthetic', apiKey: 42, endpoint: 'loopback' } },
        { waitMs: 1000 },
      ),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect((await callExecutionControl(peer, 'execution.health', {})).processId).toBe(
      health.processId,
    );
  } finally {
    await child.stop();
    peer.close();
  }
});

test('a failed parent revokes and stops its actual capability process before another model request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-parent-failure-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  let entered!: () => void;
  const acquiring = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const create = app.models.execution.bind(app.models);
  let activeProjectId: string | undefined;
  app.models.execution = async (...args) => {
    const execution = await create(...args);
    let held = false;
    return {
      ...execution,
      acquire: async () => {
        const lease = await execution.acquire();
        const child =
          activeProjectId &&
          app.projects
            .get(activeProjectId)
            .database.prepare(
              "SELECT id FROM run_instances WHERE json_extract(value, '$.parentInstanceId') IS NOT NULL AND json_extract(value, '$.state') = 'running'",
            )
            .get();
        if (child && !held) {
          held = true;
          entered();
          await gate;
        }
        return lease;
      },
    };
  };
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    activeProjectId = project.project.id;
    project.grant({ trust: 'trusted', autoBackup: false });
    await project.save('input.md', 'controlled evidence 42');
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_RESEARCH',
      materials: ['input.md'],
    });
    await acquiring;
    const instances = () =>
      (
        project.database.prepare('SELECT value FROM run_instances').all() as { value: string }[]
      ).map((row) => JSON.parse(row.value) as RunInstance);
    const parent = instances().find((row) => !row.parentInstanceId);
    const child = instances().find((row) => row.parentInstanceId === parent?.instanceId);
    assert(parent?.processId && child?.processId);
    const accepted = model.requests.length;
    process.kill(parent.processId, 'SIGKILL');
    await expect
      .poll(() => instances().find((row) => row.instanceId === child.instanceId)?.state)
      .toBe('exited');
    release();
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
    expect(model.requests).toHaveLength(accepted);
    await expect(stat(join(root, 'project', 'analysis.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const other = app.harness.create(project.project.id);
    await app.harness.send({
      projectId: project.project.id,
      sessionId: other.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT unrelated',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: project.project.id, sessionId: other.id })).run?.state,
      )
      .toBe('completed');
  } finally {
    release();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('a delayed response from a replaced attempt cannot overwrite the current session state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-late-attempt-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    model.hold = true;
    const old = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT old response',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const project = app.projects.get('application');
    const replacement = { id: randomUUID(), sessionId: session.id, attempt: 2, state: 'completed' };
    project.database
      .prepare('INSERT INTO runs(id,sessionId,value) VALUES(?,?,?)')
      .run(replacement.id, session.id, JSON.stringify(replacement));
    project.database
      .prepare("UPDATE sessions SET value=json_set(value,'$.state','completed') WHERE id=?")
      .run(session.id);
    model.release();
    await expect
      .poll(
        () =>
          (
            project.database
              .prepare("SELECT json_extract(value,'$.state') AS state FROM runs WHERE id=?")
              .get(old.runId) as { state: string }
          ).state,
      )
      .toBe('failed');
    expect((await app.snapshot(scope)).run).toMatchObject({
      id: replacement.id,
      state: 'completed',
    });
    expect(app.harness.getSession('application', session.id).state).toBe('completed');
    expect(model.requests).toHaveLength(1);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('health timeout stops only a blocked execution while a healthy model wait and library stay usable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-agent-health-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const start = ManagedNode.start;
  let owned: ManagedNode | undefined;
  ManagedNode.start = async (options) => {
    const child = await start({
      ...options,
      entry: new URL('../fixtures/processes/blocked-agent.mjs', import.meta.url),
    });
    owned = child;
    return child;
  };
  try {
    await app.initialize();
    const blocked = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: blocked.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'controlled blocked event loop',
      materials: [],
    });
    await expect
      .poll(async () =>
        (await app.snapshot(scope)).messages.some((message) => message.state === 'streaming'),
      )
      .toBe(true);
    ManagedNode.start = start;
    const healthy = app.harness.create('application');
    const other = { projectId: 'application', sessionId: healthy.id };
    model.hold = true;
    await app.harness.send({
      ...other,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT healthy model wait',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    expect((await app.call('library.list', {})).sources).toEqual([]);
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 15000 })
      .toBe('failed');
    expect((await app.snapshot(scope)).run?.error).toContain('健康');
    expect((await app.snapshot(other)).run?.state).toBe('running');
    assert(owned);
    await owned.stopped;
    model.release();
    await expect.poll(async () => (await app.snapshot(other)).run?.state).toBe('completed');
    expect((await app.call('library.list', {})).sources).toEqual([]);
  } finally {
    ManagedNode.start = start;
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('health loss after an accepted file effect retains an unknown tool receipt', async () => {
  test.skip(process.platform === 'win32', 'POSIX event-loop suspension');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-tool-health-'));
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
    let runId: string | undefined;
    project.save = async (...args) => {
      const result = await save(...args);
      if (args[0] === 'result.md') {
        const row = project.database
          .prepare('SELECT value FROM run_instances WHERE run_id=?')
          .get(runId) as { value: string } | undefined;
        assert(row);
        const instance = JSON.parse(row.value) as RunInstance;
        assert(instance.processId);
        process.kill(instance.processId, 'SIGSTOP');
      }
      return result;
    };
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    ({ runId } = await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE',
      materials: [],
    }));
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('failed');
    const tool = (await app.snapshot(scope)).messages.find(
      (message) => message.tool?.name === 'write_file',
    );
    expect(tool?.state).toBe('unknown');
    expect((await app.snapshot(scope)).run?.error).toContain('健康');
    expect(await readFile(join(root, 'project', 'result.md'), 'utf8')).toContain('合成');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('an unconfirmed Agent stop retains interrupted state and occupied capacity after user cancellation', async () => {
  test.skip(process.platform === 'win32', 'POSIX signal fault injection');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-agent-stop-unknown-'));
  const app = new KernelApplication(root, { environment: { MINIMAX_CN_API_KEY: 'synthetic' } });
  const start = ManagedNode.start;
  let owned: ManagedNode | undefined;
  ManagedNode.start = async (options) => {
    const fault =
      options.entry.href ===
      new URL('../../packages/harness/dist/execution.js', import.meta.url).href;
    const child = await start({
      ...options,
      ...(fault
        ? { entry: new URL('../fixtures/processes/blocked-agent.mjs', import.meta.url) }
        : {}),
    });
    if (fault) owned = child;
    return child;
  };
  try {
    await app.initialize();
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'controlled busy execution',
      materials: [],
    });
    await expect
      .poll(async () =>
        (await app.snapshot(scope)).messages.some((message) => message.state === 'streaming'),
      )
      .toBe(true);
    assert(owned?.identity);
    const processId = owned.identity.pid;
    const controller = Reflect.get(owned, 'controller') as ChildProcess;
    controller.kill('SIGKILL');
    app.harness.cancel(scope.projectId, scope.sessionId);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('interrupted');
    expect((await app.snapshot(scope)).run?.remoteOutcome).toBe('unknown');
    expect(() => process.kill(processId, 0)).not.toThrow();
    expect((Reflect.get(app, 'processes') as ProcessAdmission).status.active).toBe(1);
  } finally {
    ManagedNode.start = start;
    if (owned?.identity) {
      try {
        process.kill(-owned.identity.pid, 'SIGKILL');
      } catch (error) {
        expect((error as NodeJS.ErrnoException).code).toBe('ESRCH');
      }
    }
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('a failed revocation write still stops the actual execution and retains its diagnosis', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-revocation-write-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const project = app.projects.get('application');
    const session = app.harness.create('application');
    const scope = { projectId: 'application', sessionId: session.id };
    model.hold = true;
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT held',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const instance = JSON.parse(
      (project.database.prepare('SELECT value FROM run_instances').get() as { value: string })
        .value,
    ) as RunInstance;
    assert(instance.processId);
    const processId = instance.processId;
    project.database.exec(
      "CREATE TRIGGER fail_revocation BEFORE UPDATE ON run_instances WHEN json_extract(NEW.value, '$.state') = 'stopping' BEGIN SELECT RAISE(ABORT, 'synthetic revocation failure'); END",
    );
    app.harness.cancel(scope.projectId, scope.sessionId);
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    expect((await app.snapshot(scope)).run?.error).toContain('撤权');
    expect(() => process.kill(processId, 0)).toThrow();
    expect((Reflect.get(app, 'processes') as ProcessAdmission).status.active).toBe(0);
    const current = JSON.parse(
      (
        project.database
          .prepare('SELECT value FROM run_instances WHERE id=?')
          .get(instance.instanceId) as { value: string }
      ).value,
    ) as RunInstance;
    expect(current.state).toBe('exited');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
