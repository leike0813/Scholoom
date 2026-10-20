import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { ProjectBackend } from '../../packages/harness/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type { ProjectFilePort } from '../../packages/protocol/dist/projects.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('project file tools accept a replaceable narrow port without a broker or host', async () => {
  let content = 'original evidence';
  let basis = 'basis-1';
  let allowed = true;
  const files: ProjectFilePort = {
    'project.check': async () => {
      if (!allowed) throw new OperationError('permissionDenied', 'revoked');
      return { ok: true };
    },
    'project.path': async ({ path }) => resolve('/project', path),
    'project.material': async () => ({
      projectId: 'project',
      fileId: 'file',
      nativePath: '/project/input.md',
      basis,
    }),
    'files.list': async () => ({
      entries: [{ fileId: 'file', name: 'input.md', path: 'input.md', kind: 'file' }],
    }),
    'files.read': async () => ({
      fileId: 'file',
      path: 'input.md',
      content,
      basis,
      truncated: false,
    }),
    'project.saveFile': async (input) => {
      if (input.basis !== basis || input.expectedFileId !== 'file')
        throw new OperationError('contentChanged', 'changed');
      const before = content;
      content = input.content;
      basis = 'basis-2';
      return {
        id: 'edit',
        fileId: 'file',
        path: input.path,
        before,
        after: content,
        createdAt: '2026-10-01',
        created: false,
      };
    },
  };
  const saved: string[] = [];
  const backend = new ProjectBackend(
    files,
    'project',
    new AbortController().signal,
    () => {},
    (path) => {
      saved.push(path);
    },
    undefined,
    { path: 'input.md', fileId: 'file' },
  );
  expect((await backend.read('/input.md')).content).toBe('original evidence');
  expect((await backend.edit('/input.md', 'original', 'updated')).occurrences).toBe(1);
  expect(content).toBe('updated evidence');
  expect(saved).toEqual(['input.md']);
  await backend.read('/input.md');
  allowed = false;
  expect((await backend.edit('/input.md', 'updated', 'forbidden')).error).toContain(
    'permissionDenied',
  );
  expect(content).toBe('updated evidence');
});

test('the production file port binds project scope and keeps final authorization in projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-project-port-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const first = await app.projects.create(join(root, 'first'));
    const second = await app.projects.create(join(root, 'second'));
    for (const project of [first, second]) {
      project.grant({ trust: 'trusted', autoBackup: false });
      await project.save('input.md', project.project.id);
    }
    const port = app.projectFiles({
      moduleId: 'caller',
      role: 'product',
      principal: { kind: 'human', id: 'cannot-overwrite-host-role' },
      projectId: first.project.id,
    });
    expect(
      (await port['files.read']({ projectId: first.project.id, path: 'input.md' })).content,
    ).toBe(first.project.id);
    await expect(
      port['files.read']({ projectId: second.project.id, path: 'input.md' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    first.grant({ trust: 'restricted', autoBackup: false });
    await expect(
      port['files.read']({ projectId: first.project.id, path: 'input.md' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    const humanRead = await app.call('files.read', {
      projectId: first.project.id,
      path: 'input.md',
    });
    await app.call('files.save', {
      projectId: first.project.id,
      path: 'input.md',
      basis: humanRead.basis,
      content: 'human edit in restricted project',
    });
    expect((await first.read('input.md')).content).toBe('human edit in restricted project');
    await expect(
      port['project.material']({ projectId: first.project.id, path: 'input.md', agent: false }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('revoking trust while an Agent save waits prevents its final write and keeps manual access', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-trust-save-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const store = await app.projects.create(join(root, 'project'));
    store.grant({ trust: 'trusted', autoBackup: false });
    const created = await store.save('input.md', 'original');
    const source = await store.read('input.md');
    const entered = deferred();
    const release = deferred();
    const path = store.path.bind(store);
    let delayed = false;
    store.path = async (...args) => {
      const result = await path(...args);
      if (!delayed) {
        delayed = true;
        entered.resolve();
        await release.promise;
      }
      return result;
    };
    const files = app.projectFiles({
      moduleId: 'harness',
      role: 'execution',
      principal: { kind: 'agent', id: 'session' },
      projectId: store.project.id,
    });
    const saving = files['project.saveFile']({
      projectId: store.project.id,
      path: 'input.md',
      content: 'Agent edit',
      basis: source.basis,
      ...(created.fileId ? { expectedFileId: created.fileId } : {}),
    });
    const rejected = expect(saving).rejects.toMatchObject({ code: 'permissionDenied' });
    await entered.promise;
    store.grant({ trust: 'restricted', autoBackup: false });
    release.resolve();
    await rejected;
    expect((await store.read('input.md')).content).toBe('original');
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('project material batches preserve Agent origin across delayed work while manual imports allow restricted projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-trust-library-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const store = await app.projects.create(join(root, 'project'));
    store.grant({ trust: 'restricted', autoBackup: false });
    await store.save('input.md', 'source evidence');
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const request = {
      projectId: store.project.id,
      projectPaths: ['input.md'],
      purpose: 'evidence',
      version: 'unspecified',
      origin: 'trust-test',
    };
    const batch = await app.call('library.importProjectFiles', { ...request, batchId: 'manual' });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    expect((await app.call('library.batch', { batchId: batch.id })).batch.failed).toBe(0);
    const agent = app.libraryTools({
      moduleId: 'harness',
      role: 'execution',
      principal: { kind: 'agent', id: 'session' },
      projectId: store.project.id,
    });
    await expect(
      agent.call('library.importProjectFiles', { ...request, batchId: 'denied' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    store.grant({ trust: 'trusted', autoBackup: false });
    const entered = deferred();
    const release = deferred();
    const material = store.material.bind(store);
    let delayed = false;
    store.material = async (path) => {
      const result = await material(path);
      if (!delayed) {
        delayed = true;
        entered.resolve();
        await release.promise;
      }
      return result;
    };
    const pending = await agent.call('library.importProjectFiles', {
      ...request,
      batchId: 'delayed',
    });
    await entered.promise;
    store.grant({ trust: 'restricted', autoBackup: false });
    release.resolve();
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: pending.id })).batch.state)
      .toBe('interrupted');
    expect((await app.call('library.batch', { batchId: pending.id })).batch.error?.code).toBe(
      'permissionDenied',
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

for (const origin of ['manual', 'agent'] as const) {
  test(`${origin} project material batch keeps its source access rules after restart`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-batch-trust-restart-'));
    const directory = join(root, 'profile');
    let app = new ManualApplication(directory);
    try {
      await app.initialize();
      const store = await app.projects.create(join(root, 'project'));
      store.grant({ trust: 'trusted', autoBackup: false });
      await store.save('input.md', 'retained source');
      await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
      const entered = deferred(),
        release = deferred();
      const material = store.material.bind(store);
      let delayed = false;
      store.material = async (path) => {
        const value = await material(path);
        if (!delayed) {
          delayed = true;
          entered.resolve();
          await release.promise;
        }
        return value;
      };
      const input = {
        projectId: store.project.id,
        batchId: `restart-${origin}`,
        projectPaths: ['input.md'],
        purpose: 'evidence',
        version: 'unspecified',
        origin: 'trust-restart',
      };
      const batch =
        origin === 'manual'
          ? await app.call('library.importProjectFiles', input)
          : await app
              .libraryTools({
                moduleId: 'harness',
                role: 'execution',
                principal: { kind: 'agent', id: 'session' },
                projectId: store.project.id,
              })
              .call('library.importProjectFiles', input);
      await entered.promise;
      await app.call('library.grant', { read: true, write: false, send: false, autoBackup: false });
      release.resolve();
      await expect
        .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('interrupted');
      store.grant({ trust: 'restricted', autoBackup: false });
      await app.close();
      app = new ManualApplication(directory);
      await app.initialize();
      await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
      await app.call('library.resume', { batchId: batch.id });
      await expect
        .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe(origin === 'manual' ? 'completed' : 'interrupted');
      const actual = (await app.call('library.batch', { batchId: batch.id })).batch;
      if (origin === 'manual') expect(actual.failed).toBe(0);
      else expect(actual.error?.code).toBe('permissionDenied');
    } finally {
      await app.close();
      await rm(root, { recursive: true });
    }
  });
}

test('a moved expected report directory does not prevent saving an unrelated file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-report-scope-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ trust: 'trusted', autoBackup: false });
    await project.files.mutate('mkdir', 'reports-directory', { path: 'reports' });
    const report = await project.save('reports/result.md', 'original report');
    if (!report.fileId) throw new Error('Expected the report identity');
    await project.save('notes.md', 'original notes');
    const port = app.projectFiles({
      moduleId: 'harness',
      role: 'execution',
      principal: { kind: 'agent', id: 'fixture' },
      projectId: project.project.id,
    });
    const backend = new ProjectBackend(
      port,
      project.project.id,
      new AbortController().signal,
      () => {},
      () => {},
      undefined,
      { path: report.path, fileId: report.fileId },
    );
    await backend.read('/notes.md');
    await project.files.mutate('rename', 'move-reports', { path: 'reports', name: 'kept' });
    expect((await backend.edit('/notes.md', 'original', 'updated')).occurrences).toBe(1);
    expect((await project.read('notes.md')).content).toBe('updated notes');
    expect((await project.read('kept/result.md')).content).toBe('original report');
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});
