import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type { ResearchProjectPort } from '../../packages/protocol/dist/projects.js';
import type { ResearchRequest } from '../../packages/protocol/dist/research.js';
import { ResearchRecords, ResearchRuntime } from '../../packages/research/dist/node.js';

const Database = createRequire(new URL('../../packages/research/package.json', import.meta.url))(
  'better-sqlite3',
);

test('research persists attempts with only its own table and replaceable ports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-research-module-'));
  const projectId = 'project';
  const sessionId = 'session';
  const projectRoot = join(root, 'project');
  const database = new Database(join(root, 'project.sqlite'));
  database.exec(
    'CREATE TABLE research_attempts (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
  database.close();

  const contents = new Map([
    ['input.md', { fileId: 'input-file', content: '合成材料：结果42，只有一个样本。' }],
  ]);
  const files: ResearchProjectPort = {
    'project.check': async () => ({ ok: true }),
    'project.path': async ({ path }) => resolve(projectRoot, path),
    'project.material': async ({ path }) => {
      const file = contents.get(path);
      if (!file) throw new OperationError('notFound', path);
      return {
        projectId,
        fileId: file.fileId,
        nativePath: resolve(projectRoot, path),
        basis: `${file.fileId}-basis`,
      };
    },
    'files.read': async ({ path }) => {
      const file = contents.get(path);
      if (!file) throw new OperationError('notFound', path);
      return {
        fileId: file.fileId,
        path,
        content: file.content,
        basis: `${file.fileId}-basis`,
        truncated: false,
      };
    },
    'files.resolve': async ({ fileIds }) =>
      fileIds.flatMap((fileId) => {
        const file = [...contents].find(([, value]) => value.fileId === fileId);
        return file
          ? [{ fileId, path: file[0], kind: 'file' as const, state: 'present' as const }]
          : [];
      }),
  };
  let mode: 'deliver' | 'fail' = 'deliver';
  let notifications = 0;
  let sessionChecks = 0;
  let runtime!: ResearchRuntime;
  runtime = new ResearchRuntime(() => notifications++, {
    records: () => new ResearchRecords(root),
    files: () => files,
    session: async ({ projectId: checkedProjectId, sessionId: checkedSessionId }) => {
      sessionChecks++;
      return {
        id: checkedSessionId,
        projectId: checkedProjectId,
        title: 'module fixture',
        updatedAt: '2026-10-19T00:00:00.000Z',
        state: 'completed',
        archived: false,
        titleSource: 'manual',
      };
    },
    execute: async (execution, context) => {
      if (mode === 'fail') {
        await runtime.progress(
          {
            attemptId: execution.attemptId,
            event: { kind: 'failed', issue: 'modelFailed: synthetic' },
          },
          context,
        );
        return;
      }
      const input = await files['files.read']({ projectId, path: 'input.md' });
      const inputId = input.fileId ?? 'input-file';
      await runtime.progress(
        {
          attemptId: execution.attemptId,
          event: { kind: 'read', file: { path: 'input.md', fileId: inputId } },
        },
        context,
      );
      contents.set('analysis.md', {
        fileId: 'report-file',
        content: '来源 input.md；结果42；只有一个样本。',
      });
      await runtime.progress(
        {
          attemptId: execution.attemptId,
          event: { kind: 'saved', file: { path: 'analysis.md', fileId: 'report-file' } },
        },
        context,
      );
    },
  });
  const request: ResearchRequest = {
    methodId: 'scholoom.material-analysis',
    version: '1.0.0',
    input: {
      materialPaths: ['input.md'],
      outputPath: 'analysis.md',
      goal: '核对结果42的依据与限制',
    },
  };

  try {
    const attempt = await runtime.invoke(request, {
      projectId,
      sessionId,
      runId: 'run',
      instanceId: 'instance',
      signal: new AbortController().signal,
      isStopping: () => false,
    });
    expect(attempt).toMatchObject({
      state: 'completed',
      delivery: 'usable',
      reportFileId: 'report-file',
    });
    expect(attempt.used).toEqual([{ path: 'input.md', fileId: 'input-file' }]);
    expect((await runtime.list({ projectId, sessionId })).attempts).toEqual([attempt]);

    mode = 'fail';
    const failed = await runtime.invoke(request, {
      projectId,
      sessionId,
      runId: 'run',
      instanceId: 'instance',
      signal: new AbortController().signal,
      isStopping: () => false,
    });
    expect(failed).toMatchObject({ state: 'completed', delivery: 'incomplete' });
    expect(failed.issues).toContain('modelFailed: synthetic');
    expect((await runtime.list({ projectId, sessionId, limit: 1 })).nextOffset).toBe(1);
    expect(notifications).toBeGreaterThan(0);
    expect(sessionChecks).toBeGreaterThan(0);

    runtime.close();
    const check = new Database(join(root, 'project.sqlite'), { readonly: true });
    try {
      expect(check.prepare('SELECT count(*) AS count FROM research_attempts').get()).toEqual({
        count: 2,
      });
    } finally {
      check.close();
    }
  } finally {
    runtime.close();
    await rm(root, { recursive: true });
  }
});
