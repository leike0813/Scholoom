import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { compileContract, protocolVersion } from '../../packages/protocol/dist/core.js';
import {
  executionControlOperations,
  type GraphExecution,
  graphBindingSchema,
  graphProgressSchema,
  graphResumeInputSchema,
} from '../../packages/protocol/dist/execution.js';
import { messageSchema, runSchema } from '../../packages/protocol/dist/harness.js';
import {
  type ResourceEvidence,
  resourceCreationOperations,
  resourceEvidenceSchema,
} from '../../packages/protocol/dist/resources.js';
import {
  type ContextItem,
  isContextItems,
  isWorkbenchContextSnapshot,
  workbenchContextContracts,
} from '../../packages/protocol/dist/workbench-context.js';

const evidence: ResourceEvidence = {
  ref: { source: 'project', projectId: 'p', fileId: 'f' },
  basis: 'b',
};
const resource = {
  ...evidence,
  name: 'report.md',
  format: 'text',
  capabilities: { read: true, write: true, readingRecords: false, render: true },
};
const contextItem: ContextItem = {
  ...evidence,
  kind: 'text',
  itemId: 'i',
  quote: 'Selected text',
  contentState: 'saved',
};
const graph: GraphExecution = {
  kind: 'registered',
  graphId: 'fixed',
  version: '1',
  config: {},
  materials: [evidence],
  workDomain: { kind: 'project', projectId: 'p', sessionId: 's' },
};
const wait = {
  attemptId: 'a',
  waitId: 'w',
  nodeKey: 'node',
  inputSchemaRef: 'fixed/1/answer',
  prompt: 'Answer',
  checkpointRef: 'cp',
};
const facts = { inputs: [evidence], reads: [], results: [] };

test('resource creation separates known saved identity, association and unknown effects', () => {
  const save = compileContract(executionControlOperations['resources.save']);
  expect(save.result({ resource, association: { operationId: 'link', state: 'unknown' } })).toBe(
    true,
  );
  expect(save.result(resource)).toBe(false);
  const validate = compileContract(resourceCreationOperations['resources.create']);
  expect(
    validate.params({ projectId: 'p', path: 'report.md', operationId: 'op', content: 'text' }),
  ).toBe(true);
  expect(validate.params({ projectId: 'p', path: 'report.md', content: 'text' })).toBe(false);
  expect(
    validate.params({
      projectId: 'p',
      path: 'report.md',
      operationId: 'op',
      content: 'text',
      attachmentId: 'library',
    }),
  ).toBe(false);
  expect(
    validate.result({
      operationId: 'op',
      state: 'complete',
      resource,
      association: { operationId: 'link', state: 'pending' },
    }),
  ).toBe(true);
  expect(validate.result({ operationId: 'op', state: 'unknown' })).toBe(true);
  expect(validate.result({ operationId: 'op', state: 'complete' })).toBe(false);
  expect(
    validate.result({
      operationId: 'op',
      state: 'complete',
      resource: {
        ...resource,
        ref: { source: 'library', attachmentId: 'at', materialVersionId: 'v' },
      },
    }),
  ).toBe(false);
  expect(compileContract({ params: resourceEvidenceSchema, result: true }).params(evidence)).toBe(
    true,
  );
});

test('graph contracts support deterministic initialization, waiting and explicit resume bindings', () => {
  const initialize = compileContract(executionControlOperations['execution.initialize']);
  expect(initialize.params({ graph, attemptId: 'a', input: null })).toBe(true);
  expect(
    initialize.params({
      graph,
      attemptId: 'a',
      input: null,
      tools: [{ name: 'read_context_resource', description: 'Read', schema: {} }],
      middleware: [{ name: 'instructions', before: true, tool: false, model: false }],
    }),
  ).toBe(true);
  expect(
    initialize.params({
      graph,
      attemptId: 'a',
      input: null,
      model: { model: 'model', apiKey: 'synthetic', endpoint: 'http://127.0.0.1' },
      checkpointPath: '/owned/checkpoint.sqlite',
    }),
  ).toBe(true);
  expect(
    initialize.params({
      graph: { ...graph, modulePath: '/tmp/factory' },
      attemptId: 'a',
      input: null,
    }),
  ).toBe(false);
  const resume = {
    attemptId: 'a',
    waitId: 'w',
    instructionIds: ['instruction'],
    value: { answer: true },
  };
  const validateResume = compileContract({ params: graphResumeInputSchema, result: true }).params;
  expect(validateResume(resume)).toBe(true);
  expect(validateResume({ ...resume, instructionIds: [] })).toBe(false);
  expect(validateResume({ ...resume, instructionIds: ['same', 'same'] })).toBe(false);
  expect(initialize.params({ graph, attemptId: 'a', checkpointRef: 'cp', input: resume })).toBe(
    true,
  );
  const binding = {
    graphId: 'fixed',
    version: '1',
    config: {},
    stateFormatVersion: '1',
    checkpointRef: 'cp',
    wait,
  };
  expect(compileContract({ params: graphBindingSchema, result: true }).params(binding)).toBe(true);
  const progress = compileContract({ params: graphProgressSchema, result: true }).params;
  expect(
    progress({
      kind: 'graph.failed',
      attemptId: 'a',
      error: { code: 'outcomeUnknown', message: 'creation unknown' },
      evidence: { ...facts, creations: [{ operationId: 'op', state: 'unknown' }] },
    }),
  ).toBe(true);
  for (const result of [
    { kind: 'graph.waiting', wait, evidence: facts },
    { kind: 'graph.completed', attemptId: 'a', evidence: facts },
    {
      kind: 'graph.failed',
      attemptId: 'a',
      error: { code: 'unavailable', message: 'failure' },
      evidence: facts,
    },
  ]) {
    expect(progress(result)).toBe(true);
    expect(
      compileContract(executionControlOperations['execution.next']).result({
        done: true,
        graph: result,
      }),
    ).toBe(true);
  }
});

test('graph content facts keep actual ranges and exact saves without requiring new fields on old progress', () => {
  const progress = compileContract({ params: graphProgressSchema, result: true }).params;
  const contentReads = [
    {
      kind: 'text',
      offset: 300000,
      length: 12,
      size: 400000,
      truncated: false,
      nextOffset: 300012,
    },
    { kind: 'pdf-page', pageIndex: 2, offset: 20, length: 40, hasText: true },
    {
      kind: 'document-section',
      sectionId: 'chapter',
      normalizationVersion: 1,
      offset: 10,
      length: 25,
      size: 100,
      nextOffset: 35,
    },
    { kind: 'search' },
  ].map((content) => ({ resource: evidence, content }));
  const value = {
    kind: 'graph.completed',
    attemptId: 'a',
    evidence: {
      ...facts,
      contentReads,
      roleResults: [
        {
          role: 'report',
          result: {
            resource,
            editId: 'edit',
            association: { operationId: 'link', state: 'unknown' },
          },
        },
      ],
    },
  };
  expect(progress(value)).toBe(true);
  expect(progress({ ...value, evidence: facts })).toBe(true);
  for (const content of [
    { kind: 'pdf-page', offset: 0, length: 1, hasText: true },
    { kind: 'text', offset: -1, length: 1, size: 2, truncated: false },
    { kind: 'search', length: 100 },
  ])
    expect(
      progress({
        ...value,
        evidence: { ...facts, contentReads: [{ resource: evidence, content }] },
      }),
    ).toBe(false);

  const consume = compileContract(executionControlOperations['execution.consume']).params;
  const confirmation = { checkpointId: 'checkpoint', instructionIds: ['instruction'] };
  expect(consume(confirmation)).toBe(true);
  expect(consume({ ...confirmation, checkpointNamespace: '' })).toBe(true);
  expect(consume({ ...confirmation, checkpointNamespace: 'agent:original-task' })).toBe(true);
  expect(consume({ ...confirmation, checkpointNamespace: 1 })).toBe(false);
});

test('context contracts preserve selections and bound aggregate data and normalized regions', () => {
  expect(isContextItems([contextItem])).toBe(true);
  expect(isContextItems([{ ...contextItem, contentState: 'draft' }])).toBe(true);
  expect(isContextItems([contextItem, contextItem])).toBe(false);
  expect(
    isContextItems(Array.from({ length: 17 }, (_, i) => ({ ...contextItem, itemId: String(i) }))),
  ).toBe(false);
  expect(isContextItems([{ ...contextItem, quote: 'x'.repeat(8193) }])).toBe(false);
  expect(isContextItems([{ ...contextItem, quote: '😀'.repeat(4097) }])).toBe(false);
  expect(isContextItems([{ ...contextItem, comment: '😀'.repeat(2049) }])).toBe(false);
  expect(
    isContextItems(
      Array.from({ length: 16 }, (_, i) => ({
        ...contextItem,
        itemId: String(i),
        quote: '汉'.repeat(8192),
      })),
    ),
  ).toBe(false);
  const region = {
    kind: 'region',
    itemId: 'region',
    ...evidence,
    region: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  };
  expect(isContextItems([region])).toBe(true);
  expect(isContextItems([{ ...region, target: { kind: 'image' } }])).toBe(true);
  expect(
    isContextItems([{ ...region, target: { kind: 'pdf', pageIndex: 0, width: 600, height: 800 } }]),
  ).toBe(true);
  expect(isContextItems([{ ...region, target: { kind: 'pdf', pageIndex: -1 } }])).toBe(false);
  expect(
    isContextItems([
      { ...contextItem, location: { pageIndex: 0, rects: [{ x: 1, y: 2, width: 3, height: 4 }] } },
    ]),
  ).toBe(true);
  const location = {
    kind: 'text',
    normalizationVersion: 1,
    sectionId: 'chapter',
    start: 2,
    end: 8,
  };
  expect(isContextItems([{ ...contextItem, location }])).toBe(true);
  expect(isContextItems([{ ...contextItem, location: { ...location, end: 1 } }])).toBe(false);
  expect(isContextItems([{ ...region, region: { ...region.region, width: 0.6 } }])).toBe(false);
  const snapshot = {
    revision: 1,
    receiver: { projectId: 'p', sessionId: 's' },
    viewId: 'view',
    selectedItems: ['f'],
    selections: [contextItem],
  };
  expect(isWorkbenchContextSnapshot(snapshot)).toBe(true);
  expect(isWorkbenchContextSnapshot({ ...snapshot, connectionId: 'forged' })).toBe(false);
  const read = compileContract(workbenchContextContracts['workbench.context.read']);
  expect(read.result({ state: 'ambiguous', instructionIds: ['first', 'second'] })).toBe(true);
  expect(read.result({ state: 'unavailable', reason: 'disconnected' })).toBe(true);
});

test('historical messages and runs remain readable without graph or selection fields', () => {
  expect(protocolVersion).toBe(4);
  expect(
    compileContract({ params: messageSchema, result: runSchema }).params({
      id: 'old',
      sessionId: 's',
      role: 'user',
      text: 'old',
      state: 'complete',
      materials: [],
      createdAt: 'time',
    }),
  ).toBe(true);
  expect(
    compileContract({ params: messageSchema, result: runSchema }).result({
      id: 'old',
      sessionId: 's',
      attempt: 1,
      state: 'completed',
    }),
  ).toBe(true);
});

test('unwired capabilities reject before accepting work or losing explicit context', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-contract-baseline-'));
  const app = new KernelApplication(directory, { environment: {} });
  try {
    await app.initialize();
    const session = app.harness.create('application');
    expect(app.available()).toEqual(
      expect.arrayContaining(['resources.create', 'resources.creation']),
    );
    await expect(
      app.call('resources.create', {
        projectId: 'application',
        path: 'report.md',
        operationId: 'op',
        content: 'text',
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      app.call('resources.creation', { projectId: 'application', operationId: 'op' }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    for (const [request, code] of [
      [
        () =>
          app.call('session.send', {
            projectId: 'application',
            sessionId: session.id,
            instructionId: 'i',
            text: 'read selection',
            materials: [],
            contextItems: [contextItem],
          }),
        'notFound',
      ],
      [
        () =>
          app.harness.executeCapability(
            { attemptId: 'a', prompt: '', execution: graph },
            { moduleId: 'research', role: 'execution', principal: { kind: 'agent', id: 's' } },
          ),
        'unavailable',
      ],
    ] as const) {
      await expect(request()).rejects.toMatchObject({ code });
    }
    await expect(app.call('workbench.context.publish', { snapshot: null })).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    const snapshot = await app.snapshot({ projectId: 'application', sessionId: session.id });
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.run).toBeUndefined();
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
