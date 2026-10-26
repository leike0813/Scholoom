import { expect, test } from '@playwright/test';
import { compileContract } from '../../packages/protocol/dist/core.js';
import {
  editSchema,
  projectExecutionOperations,
  projectHarnessOperations,
  projectsOperations,
} from '../../packages/protocol/dist/projects.js';
import {
  resourceCreationResultSchema,
  resourceDescriptorSchema,
  resourceSaveResultSchema,
} from '../../packages/protocol/dist/resource-contracts.js';

const evidence = {
  ref: { source: 'project', projectId: 'p', fileId: 'f' },
  basis: 'b',
};
const edit = { id: 'e', path: 'report.md', before: '', after: 'text', createdAt: 'now' };
const execution = {
  kind: 'execution',
  projectId: 'p',
  moduleId: 'harness',
  principal: { kind: 'agent', id: 'a' },
  sessionId: 's',
  runId: 'r',
  instanceId: 'i',
  instructionContext: { state: 'unknown', reason: 'notCaptured' },
  tool: { state: 'unknown', reason: 'notBound' },
};

test('save requests reject self-reported origins', () => {
  const input = { projectId: 'p', path: 'report.md', content: 'text' };
  for (const operation of [
    projectsOperations['files.save'],
    projectExecutionOperations['project.saveFile'],
  ]) {
    const validate = compileContract(operation);
    expect(validate.params(input)).toBe(true);
    expect(validate.params({ ...input, origin: execution })).toBe(false);
  }
  const undo = compileContract(projectsOperations['files.undo']);
  expect(undo.params({ projectId: 'p', editId: 'e', origin: execution })).toBe(false);
});

test('old FileEdits remain valid and new evidence and origin fields are checked', () => {
  const validate = compileContract({ params: editSchema, result: editSchema }).result;
  expect(validate(edit)).toBe(true);
  for (const kind of ['human', 'system']) {
    const origin = { kind, projectId: 'p', moduleId: 'desktop', principal: { kind, id: 'u' } };
    expect(validate({ ...edit, origin })).toBe(true);
    expect(
      validate({ ...edit, origin: { ...origin, principal: { kind: 'agent', id: 'a' } } }),
    ).toBe(false);
  }
  for (const reason of ['unattributed', 'legacy', 'recordUnavailable']) {
    expect(validate({ ...edit, origin: { kind: 'unknown', reason } })).toBe(true);
  }
  expect(validate({ ...edit, origin: { kind: 'unknown', reason: 'guessed' } })).toBe(false);
  const enriched = {
    ...edit,
    fileId: 'f',
    origin: execution,
    beforeEvidence: evidence,
    afterEvidence: { ...evidence, basis: 'next' },
    revertsEditId: 'previous',
  };
  expect(validate(enriched)).toBe(true);
  expect(validate({ ...enriched, beforeEvidence: { ref: evidence.ref } })).toBe(false);
  expect(validate({ ...enriched, revertsEditId: '' })).toBe(false);
  expect(validate({ ...edit, origin: { ...execution, instanceId: undefined } })).toBe(false);
  expect(
    validate({ ...edit, origin: { ...execution, principal: { kind: 'human', id: 'u' } } }),
  ).toBe(false);
  const delegated = { delegationId: 'd', parentInstanceId: 'parent', parentRunId: 'parentRun' };
  expect(validate({ ...edit, origin: { ...execution, delegation: delegated } })).toBe(true);
  expect(validate({ ...edit, origin: { ...execution, delegation: { delegationId: 'd' } } })).toBe(
    false,
  );
});

test('execution origins bound observed instruction sets and keep tools unknown', () => {
  const validate = compileContract({ params: editSchema, result: editSchema }).result;
  for (const count of [0, 2, 100]) {
    const instructionIds = Array.from({ length: count }, (_, index) => `instruction-${index}`);
    expect(
      validate({
        ...edit,
        origin: { ...execution, instructionContext: { state: 'observed', instructionIds } },
      }),
    ).toBe(true);
  }
  for (const instructionIds of [
    ['same', 'same'],
    Array.from({ length: 101 }, (_, index) => `i-${index}`),
    [''],
  ]) {
    expect(
      validate({
        ...edit,
        origin: { ...execution, instructionContext: { state: 'observed', instructionIds } },
      }),
    ).toBe(false);
  }
  for (const reason of ['notCaptured', 'recordUnavailable']) {
    expect(
      validate({
        ...edit,
        origin: { ...execution, instructionContext: { state: 'unknown', reason } },
      }),
    ).toBe(true);
  }
  for (const reason of ['notBound', 'notToolOperation', 'recordUnavailable']) {
    expect(
      validate({ ...edit, origin: { ...execution, tool: { state: 'unknown', reason } } }),
    ).toBe(true);
  }
  for (const patch of [
    { instructionContext: { state: 'observed' } },
    { instructionContext: { state: 'unknown', reason: 'notBound' } },
    { tool: { state: 'verified', receiptId: 'receipt' } },
    { tool: { state: 'unknown', reason: 'notCaptured' } },
  ]) {
    expect(validate({ ...edit, origin: { ...execution, ...patch } })).toBe(false);
  }
});

test('change queries enforce pagination bounds and cursor anchor exclusivity', () => {
  const cursor = {
    projectId: 'p',
    fileId: 'f',
    afterEditId: 'anchor',
    anchor: 'matched',
    fromEditId: 'first',
    throughEditId: 'latest',
    beforeEditId: 'previous',
  };
  for (const operations of [projectsOperations, projectHarnessOperations]) {
    const validate = compileContract(operations['files.changes']);
    const input = { projectId: 'p', fileId: 'f' };
    for (const params of [
      input,
      { ...input, afterEditId: 'anchor' },
      { ...input, limit: 1 },
      { ...input, limit: 100 },
      { ...input, cursor },
    ]) {
      expect(validate.params(params)).toBe(true);
    }
    for (const params of [
      { ...input, cursor, afterEditId: 'anchor' },
      { ...input, cursor: { projectId: 'p', fileId: 'f', beforeEditId: 'previous' } },
      ...[0, 101, 1.5].map((limit) => ({ ...input, limit })),
      { projectId: 'p' },
      { ...input, origin: execution },
    ]) {
      expect(validate.params(params)).toBe(false);
    }
    const result = {
      changes: [
        {
          editId: 'e',
          fileId: 'f',
          createdAt: 'now',
          origin: execution,
          beforeEvidence: evidence,
          afterEvidence: evidence,
          revertsEditId: 'old',
        },
      ],
      nextCursor: cursor,
      coverage: { anchor: 'matched', retention: 'pruned', current: 'matchesLatest' },
    };
    expect(validate.result(result)).toBe(true);
    expect(
      validate.result({
        changes: [],
        coverage: { anchor: 'notRequested', retention: 'unknown', current: 'unavailable' },
      }),
    ).toBe(true);
    expect(
      validate.result({
        changes: [],
        coverage: { anchor: 'missing', retention: 'unknown', current: 'changedOrUnrecorded' },
      }),
    ).toBe(true);
    expect(validate.result({ changes: [] })).toBe(false);
    expect(
      validate.result({ ...result, changes: [{ ...result.changes[0], before: 'full text' }] }),
    ).toBe(false);
    expect(
      validate.result({ ...result, coverage: { ...result.coverage, retention: 'complete' } }),
    ).toBe(false);
    const detail = compileContract(operations['files.edit']);
    expect(detail.params({ ...input, editId: 'e' })).toBe(true);
    expect(detail.params(input)).toBe(false);
    expect(detail.result(edit)).toBe(true);
    expect(detail.result({ ...edit, origin: execution, afterEvidence: evidence })).toBe(true);
  }
});

test('resource editIds are optional and only complete creations accept them', () => {
  const resource = {
    ...evidence,
    name: 'report.md',
    format: 'text',
    capabilities: { read: true, write: true, readingRecords: false, render: true },
  };
  const save = compileContract({
    params: resourceDescriptorSchema,
    result: resourceSaveResultSchema,
  });
  expect(save.result({ resource })).toBe(true);
  expect(save.result({ resource, editId: 'e' })).toBe(true);
  expect(save.result({ resource, editId: '' })).toBe(false);
  expect(save.params({ ...resource, editId: 'e' })).toBe(false);
  const creation = compileContract({
    params: resourceCreationResultSchema,
    result: resourceCreationResultSchema,
  }).result;
  expect(creation({ operationId: 'op', state: 'complete', resource })).toBe(true);
  expect(creation({ operationId: 'op', state: 'complete', resource, editId: 'e' })).toBe(true);
  for (const state of ['prepared', 'unknown']) {
    expect(creation({ operationId: 'op', state, resource })).toBe(true);
    expect(creation({ operationId: 'op', state, resource, editId: 'e' })).toBe(false);
  }
  const failed = {
    operationId: 'op',
    state: 'failed',
    error: { code: 'unavailable', message: 'unavailable' },
  };
  expect(creation(failed)).toBe(true);
  expect(creation({ ...failed, editId: 'e' })).toBe(false);
});
