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
    expect(app.available()).not.toEqual(expect.arrayContaining(['resources.create']));
    for (const request of [
      () =>
        app.call('resources.create', {
          projectId: 'application',
          path: 'report.md',
          operationId: 'op',
          content: 'text',
        }),
      () => app.call('resources.creation', { projectId: 'application', operationId: 'op' }),
      () =>
        app.call('session.send', {
          projectId: 'application',
          sessionId: session.id,
          instructionId: 'i',
          text: 'read selection',
          materials: [],
          contextItems: [contextItem],
        }),
      () =>
        app.harness.executeCapability(
          { attemptId: 'a', prompt: '', execution: graph },
          { moduleId: 'research', role: 'execution', principal: { kind: 'agent', id: 's' } },
        ),
    ]) {
      await expect(request()).rejects.toMatchObject({ code: 'unavailable' });
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
