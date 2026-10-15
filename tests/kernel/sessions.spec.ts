import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { BusinessParams, WorkbenchChange } from '../../packages/protocol/dist/index.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { createModelServer } from '../model-server.js';

test('session discovery, naming and reversible archiving use persisted facts and scoped notifications', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-sessions-'));
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
  const observer = createKernelClient({ ...status, url: server.url, token: server.token });
  try {
    await client.connect();
    await observer.connect();
    const scope = { projectId: 'application' };
    const first = await client.call('session.create', scope);
    const other = await client.call('session.create', { ...scope, title: '保留手动标题' });
    await observer.call('workbench.watch', {
      ...scope,
      sessionId: other.id,
      includeSessions: false,
    });
    const changes: WorkbenchChange[] = [];
    observer.subscribeChanges((change) => changes.push(change));
    await client.call('session.rename', { ...scope, sessionId: first.id, title: '字面 %_ 查找' });
    await observer.call('workbench.watch', {
      ...scope,
      sessionId: first.id,
      includeSessions: false,
    });
    await expect.poll(() => changes.some((change) => change.sessionsChanged)).toBe(true);
    expect(
      (await client.call('session.list', { ...scope, query: '%_' })).sessions.map(
        (item) => item.id,
      ),
    ).toEqual([first.id]);
    for (let index = 0; index < 110; index++)
      await client.call('session.create', { ...scope, title: `分页 ${index}` });
    const ids: string[] = [];
    let cursor: BusinessParams<'session.list'>['cursor'];
    do {
      const page = await client.call('session.list', {
        ...scope,
        ...(cursor ? { cursor } : {}),
        limit: 30,
      });
      expect(page.sessions.length).toBeLessThanOrEqual(30);
      ids.push(...page.sessions.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(112);
    expect(new Set(ids).size).toBe(112);
    await mkdir(join(root, 'other-project'));
    const otherProject = await client.call('project.open', { path: join(root, 'other-project') });
    changes.length = 0;
    await client.call('session.rename', {
      ...scope,
      sessionId: first.id,
      title: '范围切换前的标题',
    });
    await observer.call('workbench.watch', { projectId: otherProject.id, includeSessions: false });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      changes.some((change) => change.projectId === otherProject.id && change.sessionsChanged),
    ).toBe(false);
    await observer.call('workbench.watch', {
      ...scope,
      sessionId: other.id,
      includeSessions: false,
    });
    const current = await client.call('workbench.snapshot', {
      ...scope,
      sessionId: first.id,
      includeSessions: false,
    });
    expect(current.sessions).toEqual([]);
    expect(current.session?.id).toBe(first.id);

    const automatic = await client.call('session.create', scope);
    model.hold = true;
    const input = {
      ...scope,
      sessionId: automatic.id,
      instructionId: randomUUID(),
      text: `  首条\n指令   生成标题 ${'长'.repeat(60)}`,
      materials: [],
    };
    const receipts = await Promise.all([
      client.call('session.send', input),
      observer.call('session.send', input),
    ]);
    const receipt = receipts[0];
    expect(receipts[1]).toEqual(receipt);
    const named = (await client.call('workbench.snapshot', { ...scope, sessionId: automatic.id }))
      .session;
    expect(named?.title).toHaveLength(40);
    expect(named?.title.startsWith('首条 指令 生成标题 ')).toBe(true);
    await expect(
      client.call('session.archive', { ...scope, sessionId: automatic.id, archived: true }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await client.call('session.rename', { ...scope, sessionId: automatic.id, title: '人工标题' });
    await client.call('session.cancel', { ...scope, sessionId: automatic.id });
    await expect
      .poll(
        async () =>
          (await client.call('workbench.snapshot', { ...scope, sessionId: automatic.id })).run
            ?.state,
      )
      .toBe('cancelled');
    await client.call('session.archive', { ...scope, sessionId: automatic.id, archived: true });
    expect(await client.call('session.send', input)).toEqual(receipt);
    await expect(
      client.call('session.send', { ...input, instructionId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await expect(
      client.call('session.resume', { ...scope, sessionId: automatic.id }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(
      (await client.call('session.list', { ...scope, archived: true })).sessions.map(
        (item) => item.id,
      ),
    ).toEqual([automatic.id]);
    const requests = model.requests.length;
    await client.call('session.archive', { ...scope, sessionId: automatic.id, archived: false });
    const recovered = await client.call('workbench.snapshot', {
      ...scope,
      sessionId: automatic.id,
    });
    expect(recovered.run?.state).toBe('cancelled');
    expect(recovered.session?.title).toBe('人工标题');
    expect(model.requests.length).toBe(requests);
    expect(recovered.messages.some((message) => message.id === input.instructionId)).toBe(true);
    model.release();
  } finally {
    client.dispose();
    observer.dispose();
    await server.stop();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('final acceptance rechecks archive and manual title after credential waiting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-session-race-'));
  const model = await createModelServer();
  const app = new KernelApplication(root, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const status = await app.credentials.status();
    const original = app.credentials.status;
    for (const action of ['archive', 'rename'] as const) {
      const session = app.harness.create('application');
      let release: () => void = () => {};
      app.credentials.status = () =>
        new Promise((resolve) => {
          release = () => resolve(status);
        });
      const pending = app.harness.send({
        projectId: 'application',
        sessionId: session.id,
        instructionId: randomUUID(),
        text: '自动标题候选',
        materials: [],
      });
      if (action === 'archive') app.harness.archive('application', session.id, true);
      else app.harness.rename('application', session.id, '并发人工标题');
      release();
      app.credentials.status = original;
      if (action === 'archive')
        await expect(pending).rejects.toMatchObject({ code: 'invalidRequest' });
      else {
        await pending;
        app.harness.cancel('application', session.id);
      }
      const snapshot = await app.snapshot({ projectId: 'application', sessionId: session.id });
      if (action === 'archive') {
        expect(snapshot.run).toBeUndefined();
        expect(snapshot.messages).toEqual([]);
      } else expect(snapshot.session?.title).toBe('并发人工标题');
    }
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('archived session metadata and history survive restart and independent backup recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-session-backup-'));
  const directory = join(root, 'profile');
  let app = new KernelApplication(directory, { environment: {} });
  try {
    await app.initialize();
    await mkdir(join(root, 'project'));
    const project = await app.projects.open(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
    await writeFile(join(root, 'project', 'note.md'), '保留成果');
    const session = app.harness.create(project.project.id, '保留标题');
    app.harness.archive(project.project.id, session.id, true);
    const backup = await project.backup();
    const restoredPath = await project.restore(backup.id, join(root, 'recovered'));
    const copy = await app.projects.open(restoredPath);
    expect(app.harness.snapshot(copy.project.id, session.id).session).toMatchObject({
      title: '保留标题',
      archived: true,
      projectId: copy.project.id,
    });
    await app.close();
    app = new KernelApplication(directory, { environment: {} });
    await app.initialize();
    expect(app.harness.snapshot(project.project.id, session.id).session).toMatchObject({
      title: '保留标题',
      archived: true,
    });
    expect(app.harness.list({ projectId: project.project.id }).sessions).toEqual([]);
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('reading a replacement at the same path retains both actual material identities', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-identities-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const store = await app.projects.create(join(root, 'project'));
    store.grant({ read: true, write: true, send: true, autoBackup: false });
    await writeFile(join(store.project.path, 'input.md'), '原始材料');
    const original = await store.files.reference('input.md');
    const session = app.harness.create(store.project.id);
    await app.harness.send({
      projectId: store.project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_REPLACED_MATERIAL',
      materials: [],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: store.project.id, sessionId: session.id })).run?.state,
      )
      .toBe('completed');
    const snapshot = await app.snapshot({ projectId: store.project.id, sessionId: session.id });
    const message = snapshot.messages.findLast((item) => item.role === 'assistant');
    const replacement = await store.files.reference('input.md');
    expect(message?.materialFileIds).toEqual([original.fileId, replacement.fileId]);
    expect(message?.materials).toEqual(['input.md', 'input.md']);
    expect(store.files.location(original.fileId).path).toBe('original.md');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('a concurrent receipt survives material changes during credential preflight', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-receipt-preflight-'));
  const model = await createModelServer();
  model.hold = true;
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const store = await app.projects.create(join(root, 'project'));
    store.grant({ read: true, write: true, send: true, autoBackup: false });
    await writeFile(join(store.project.path, 'input.md'), '合成材料');
    const material = await store.files.reference('input.md');
    const session = app.harness.create(store.project.id);
    const original = app.credentials.status;
    const status = await app.credentials.status();
    let checks = 0;
    let release: () => void = () => {};
    app.credentials.status = () =>
      ++checks === 2
        ? new Promise((resolve) => {
            release = () => resolve(status);
          })
        : Promise.resolve(status);
    const input = {
      projectId: store.project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: '合成指令',
      materials: ['input.md'],
      materialFileIds: [material.fileId],
    };
    const first = app.harness.send(input);
    const second = app.harness.send(input);
    const receipt = await first;
    await store.files.mutate('rename', randomUUID(), { path: 'input.md', name: 'renamed.md' });
    release();
    app.credentials.status = original;
    expect(await second).toEqual(receipt);
    expect(
      (await app.snapshot({ projectId: store.project.id, sessionId: session.id })).messages.filter(
        (item) => item.role === 'user',
      ),
    ).toHaveLength(1);
    app.harness.cancel(store.project.id, session.id);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
