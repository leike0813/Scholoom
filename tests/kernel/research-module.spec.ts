import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type { ResearchProjectPort } from '../../packages/protocol/dist/projects.js';
import type {
  ResearchGraph,
  ResearchGraphCall,
  ResearchRequest,
} from '../../packages/protocol/dist/research.js';
import {
  assessGraphDelivery,
  ResearchGraphs,
  ResearchRecords,
  ResearchRuntime,
} from '../../packages/research/dist/node.js';

const Database = createRequire(new URL('../../packages/research/package.json', import.meta.url))(
  'better-sqlite3',
);

const graph: ResearchGraph = {
  definition: {
    graphId: 'calibration',
    version: '1',
    stateFormatVersion: '1',
    requiresModel: false,
    configSchema: {
      type: 'object',
      properties: { goal: { type: 'string' } },
      required: ['goal'],
      additionalProperties: false,
    },
  },
  name: 'Calibration',
  description: 'Mechanism only',
  source: 'builtin',
  purpose: 'calibration',
  resources: [{ nodeKey: 'read', resourceId: 'guidance', source: 'builtin' }],
  delivery: { roles: ['report'] },
};

test('research graph discovery is bounded and selection validates the exact implementation', () => {
  const catalog = new ResearchGraphs([
    graph,
    {
      ...graph,
      definition: { ...graph.definition, graphId: 'second' },
    },
  ]);
  expect(catalog.discover({ limit: 1 })).toMatchObject({ descriptions: [graph], nextOffset: 1 });
  expect(catalog.discover({ offset: 1, limit: 1 }).descriptions[0]?.definition.graphId).toBe(
    'second',
  );
  expect(catalog.select('calibration', '1', { goal: 'check' })).toEqual(graph);
  expect(() => catalog.select('calibration', 'missing', {})).toThrow(
    expect.objectContaining({ code: 'notFound' }),
  );
  expect(() =>
    catalog.select('calibration', '1', { goal: 'check', modulePath: '/tmp/code' }),
  ).toThrow(expect.objectContaining({ code: 'invalidRequest' }));
  expect(() => catalog.discover({ limit: 101 })).toThrow(
    expect.objectContaining({ code: 'invalidRequest' }),
  );
  expect(() => new ResearchGraphs([graph, graph])).toThrow(
    expect.objectContaining({ code: 'invalidRequest' }),
  );
  catalog.describe({ graphId: 'calibration', version: '1' }).definition.version = 'mutated';
  expect(catalog.describe({ graphId: 'calibration', version: '1' }).definition.version).toBe('1');
});

test('graph delivery needs actual complete reads, current saved results and confirmed association', () => {
  const input = {
    ref: { source: 'project' as const, projectId: 'p', fileId: 'input' },
    basis: 'input-v1',
  };
  const output = {
    ref: { source: 'project' as const, projectId: 'p', fileId: 'output' },
    basis: 'output-v1',
    name: 'result.md',
    format: 'text' as const,
    capabilities: { read: true, write: true, render: true, readingRecords: false },
  };
  const read = {
    ...input,
    data: 'source',
    offset: 0,
    size: 6,
    unit: 'utf16' as const,
    truncated: false,
  };
  const result = {
    resource: output,
    association: { operationId: 'save', state: 'confirmed' as const },
  };
  const artifact = {
    role: 'report',
    result,
    read: { ...read, ref: output.ref, basis: output.basis },
  };
  const progress = {
    kind: 'graph.completed' as const,
    attemptId: 'run',
    evidence: { inputs: [input], reads: [input], results: [result] },
  };
  const check = (changes = {}) =>
    assessGraphDelivery(graph, [input], progress, {
      reads: [read],
      artifacts: [artifact],
      ...changes,
    });
  expect(check()).toMatchObject({
    delivery: 'usable',
    researchAssessment: 'notAssessed',
    issues: [],
  });
  for (const reads of [
    [],
    [{ ...read, truncated: true }],
    [{ ...read, offset: 6, data: '' }],
    [{ ...read, basis: 'other' }],
  ])
    expect(check({ reads }).issues).toContainEqual(
      expect.objectContaining({ code: 'inputNotRead' }),
    );
  expect(check({ artifacts: [] }).issues).toContainEqual(
    expect.objectContaining({ code: 'artifactMissing' }),
  );
  expect(
    check({
      artifacts: [
        {
          ...artifact,
          result: { ...result, association: { operationId: 'save', state: 'unknown' } },
        },
      ],
    }).delivery,
  ).toBe('incomplete');
  expect(
    assessGraphDelivery(
      graph,
      [input],
      { ...progress, evidence: { ...progress.evidence, results: [] } },
      { reads: [read], artifacts: [artifact] },
    ).delivery,
  ).toBe('incomplete');

  const rangedGraph: ResearchGraph = {
    ...graph,
    delivery: { ...graph.delivery, inputReadMode: 'content-ranges' },
  };
  const contentRead = {
    resource: input,
    content: { kind: 'pdf-page' as const, pageIndex: 0, offset: 20, length: 3, hasText: true },
  };
  const rangedProgress = {
    ...progress,
    evidence: { ...progress.evidence, contentReads: [contentRead] },
  };
  const availability = {
    ...read,
    unit: 'byte' as const,
    data: 'AA==',
    truncated: true,
    nextOffset: 1,
  };
  const rangedChecks = { reads: [availability], artifacts: [artifact] };
  expect(assessGraphDelivery(rangedGraph, [input], rangedProgress, rangedChecks).delivery).toBe(
    'usable',
  );
  expect(assessGraphDelivery(graph, [input], rangedProgress, rangedChecks).delivery).toBe(
    'incomplete',
  );
  for (const contentReads of [
    [],
    [{ ...contentRead, resource: { ...input, basis: 'wrong' } }],
    [{ ...contentRead, content: { ...contentRead.content, hasText: false } }],
    [{ ...contentRead, content: { ...contentRead.content, length: 0 } }],
    [{ resource: input, content: { kind: 'search' as const } }],
  ])
    expect(
      assessGraphDelivery(
        rangedGraph,
        [input],
        { ...progress, evidence: { ...progress.evidence, contentReads } },
        rangedChecks,
      ).issues,
    ).toContainEqual(expect.objectContaining({ code: 'inputNotRead' }));
  const added = { ...input, ref: { ...input.ref, fileId: 'adopted-later' } };
  const adoptedProgress = {
    ...progress,
    evidence: {
      ...progress.evidence,
      reads: [input, added],
      contentReads: [contentRead, { ...contentRead, resource: added }],
    },
  };
  expect(
    assessGraphDelivery(rangedGraph, [input], adoptedProgress, rangedChecks).issues,
  ).toContainEqual(expect.objectContaining({ code: 'inputNotRead', resource: added }));
  expect(
    assessGraphDelivery(rangedGraph, [input], adoptedProgress, {
      ...rangedChecks,
      reads: [availability, { ...availability, ...added }],
    }).delivery,
  ).toBe('usable');
});

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

    runtime.releaseProject(projectId);
    const mixed = new Database(join(root, 'project.sqlite'));
    const graphCall: ResearchGraphCall = {
      kind: 'graph',
      id: 'graph-call',
      projectId,
      sessionId,
      invocationId: 'invocation',
      instructionId: 'instruction',
      graphId: 'calibration',
      version: '1',
      config: { goal: 'check' },
      text: 'Calibration',
      materials: [
        { ref: { source: 'project', projectId, fileId: 'input-file' }, basis: 'input-file-basis' },
      ],
      graph,
      createdAt: '2026-10-25T00:00:00.000Z',
    };
    mixed
      .prepare('INSERT INTO research_attempts (id, value) VALUES (?, ?)')
      .run(graphCall.id, JSON.stringify(graphCall));
    mixed.close();
    runtime.initialize(projectId);
    expect((await runtime.list({ projectId, sessionId })).attempts).toHaveLength(2);
    runtime.close();
    const check = new Database(join(root, 'project.sqlite'), { readonly: true });
    try {
      expect(check.prepare('SELECT count(*) AS count FROM research_attempts').get()).toEqual({
        count: 3,
      });
      expect(
        JSON.parse(
          check.prepare('SELECT value FROM research_attempts WHERE id = ?').get(graphCall.id).value,
        ),
      ).toEqual(graphCall);
    } finally {
      check.close();
    }
  } finally {
    runtime.close();
    await rm(root, { recursive: true });
  }
});
