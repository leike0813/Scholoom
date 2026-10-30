import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  graphPrompt,
  graphResults,
  toThreadMessages,
} from '../../apps/desktop/src/renderer/src/workbench/projection.js';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import type { ResourceDescriptor, Run } from '../../packages/protocol/src/index.js';

const resource = {
  ref: { source: 'project', projectId: 'project', fileId: 'report' },
  name: 'report.md',
  basis: 'saved-version',
  format: 'text',
  capabilities: { read: true, write: true, render: false, readingRecords: false },
} satisfies ResourceDescriptor;
const wait = {
  attemptId: 'attempt',
  waitId: 'wait',
  nodeKey: 'confirm',
  inputSchemaRef: 'confirmation',
  prompt: 'Which source should be used?\nPlease confirm the scope.',
  checkpointRef: 'checkpoint',
};
const run: Run = {
  id: 'run',
  sessionId: 'session',
  attempt: 1,
  state: 'waiting',
  graph: {
    graphId: 'graph',
    version: '1',
    config: {},
    stateFormatVersion: '1',
    checkpointRef: 'checkpoint',
    wait,
  },
  graphProgress: {
    kind: 'graph.waiting',
    wait,
    evidence: { inputs: [], reads: [], results: [] },
  },
};

test('current graph projects once without a saved message, fabricated source or ordinary timing', () => {
  const project = (value: Run, sessionId = 'session') =>
    toThreadMessages([], [], { run: value, sessionId });
  const [view] = project(run);
  expect(view).toBeDefined();
  expect(view?.metadata?.custom?.source).toBeUndefined();
  expect(view?.metadata?.custom?.artifacts).toBeUndefined();
  expect(view?.createdAt).toBeUndefined();
  expect(view?.metadata?.custom?.graphRun).toBe(run);
  expect(project(structuredClone(run))).toEqual([view]);
  expect(project(run, 'other-session')).toEqual([]);
  const next = { ...run, id: 'new-run' };
  expect(project(next)).toHaveLength(1);
  expect(project(next)[0]?.id).not.toBe(view?.id);
  assert(run.graph);
  const nextWait = { ...run, graph: { ...run.graph, wait: { ...wait, waitId: 'new-wait' } } };
  expect(project(nextWait)[0]?.id).not.toBe(view?.id);
  expect(graphPrompt(run)).toBe(wait.prompt);
  expect(graphPrompt({ ...run, state: 'completed' })).toBeUndefined();
});

function incompleteRun() {
  const value = structuredClone(run);
  assert(value.graphProgress);
  const evidence = value.graphProgress.evidence;
  const result = {
    resource,
    editId: 'edit',
    association: { operationId: 'link', state: 'unknown' as const },
  };
  evidence.roleResults = [{ role: 'report', result }];
  evidence.results = [
    result,
    {
      resource: { ...resource, basis: 'other-version' },
      association: { operationId: 'pending', state: 'pending' },
    },
  ];
  evidence.creations = [
    {
      operationId: 'creation',
      state: 'unknown',
      resource,
      error: { code: 'outcomeUnknown', message: 'Unconfirmed creation' },
    },
    {
      operationId: 'failed',
      state: 'failed',
      error: { code: 'contentChanged', message: 'Existing target' },
    },
  ];
  return value;
}

test('role, old save and creation evidence retain incomplete effects and exact saved basis', () => {
  const value = incompleteRun();
  const before = structuredClone(value);
  const rows = graphResults(value);
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({
    role: 'report',
    result: {
      editId: 'edit',
      resource: { basis: 'saved-version' },
      association: { state: 'unknown' },
    },
    creation: { state: 'unknown' },
  });
  expect(rows[1]?.result?.association?.state).toBe('pending');
  expect(rows[2]?.creation?.state).toBe('failed');
  expect(value).toEqual(before);
  expect(graphResults({ ...value, state: 'completed' })).toEqual(rows);
});

test('graph view keeps unknown, pending and failed effects after execution ends and opens only the original ref', async ({
  page,
}) => {
  const value = { ...incompleteRun(), state: 'completed' };
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {GraphRunContent,MessageFiles} from './src/renderer/src/workbench/MessageContent';
        const run=${JSON.stringify(value)};
        const opened=window.opened=[];
        const root=createRoot(document.getElementById('root'));
        window.showGraph=value=>root.render(<MessageFiles.Provider value={{documentKey:'graph',openResource:async ref=>{opened.push(ref);throw new Error('Unavailable current resource');}}}><GraphRunContent run={value}/></MessageFiles.Provider>);
        window.showGraph(run);`,
      loader: 'tsx',
      resolveDir: fileURLToPath(new URL('../../apps/desktop/', import.meta.url)),
    },
    bundle: true,
    loader: { '.css': 'empty' },
    write: false,
    platform: 'browser',
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0]?.text ?? '' });
  const view = page.getByRole('region', { name: '科研图状态', exact: true });
  await expect(view).toContainText('执行结束');
  await expect(view).toContainText('关联结果未知');
  await expect(view).toContainText('关联待核查');
  await expect(view).toContainText('创建失败');
  await expect(view).not.toContainText(wait.prompt);
  await view.getByRole('button', { name: '打开当前成果 report.md', exact: true }).first().click();
  expect(await page.evaluate(() => Reflect.get(window, 'opened'))).toEqual([resource.ref]);
  await expect(view.getByRole('alert')).toBeVisible();
  await view.getByText('保存时资源依据', { exact: true }).first().click();
  await expect(view.getByText(/saved-version/)).toBeVisible();
  const many = incompleteRun();
  assert(many.graphProgress);
  many.graphProgress.evidence = {
    inputs: [],
    reads: [],
    results: Array.from({ length: 26 }, (_, index) => ({
      resource: { ...resource, basis: `version-${index}` },
    })),
  };
  await page.evaluate((value) => Reflect.get(window, 'showGraph')(value), many);
  await expect(
    view.getByRole('button', { name: '打开当前成果 report.md', exact: true }),
  ).toHaveCount(25);
  await view.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(
    view.getByRole('button', { name: '打开当前成果 report.md', exact: true }),
  ).toHaveCount(1);
});
