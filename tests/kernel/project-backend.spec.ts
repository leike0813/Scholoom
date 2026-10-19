import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { ProjectBackend } from '../../packages/harness/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type { ProjectFilePort } from '../../packages/protocol/dist/projects.js';

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
      project.grant({ read: true, write: true, send: true, autoBackup: false });
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
    first.grant({ read: false, write: true, send: true, autoBackup: false });
    await expect(
      port['files.read']({ projectId: first.project.id, path: 'input.md' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('a moved expected report directory does not prevent saving an unrelated file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-report-scope-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
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
