import { expect, test } from '@playwright/test';
import { compileContract } from '../../packages/protocol/src/core.js';
import {
  libraryOrganizationOperations,
  type OrganizationChange,
  type OrganizationInputs,
  type OrganizationOutputs,
  type OrganizationReceipt,
  organizationLimits,
  validateOrganization,
} from '../../packages/protocol/src/library-organization.js';
import {
  libraryRecordOperations,
  recordLimits,
} from '../../packages/protocol/src/library-records.js';

const scope = { libraryId: 'library', requestId: 'request' };
const change: OrganizationChange = { sourceId: 'source', revision: 0, tags: [] };
const organize: OrganizationInputs['library.organize'] = { ...scope, changes: [change] };
const error = { code: 'contentChanged', message: 'Synthetic conflict' };
const receipt: OrganizationReceipt = {
  ...scope,
  state: 'committed',
  results: [{ sourceId: 'source', status: 'applied', revision: 1 }],
};
const editQuery = { libraryId: 'library', editRequestId: 'request' };
const revert: OrganizationInputs['library.revertOrganization'] = {
  ...scope,
  requestId: 'undo-request',
  editRequestId: 'request',
  expectedEditRevision: 1,
  direction: 'undo',
};
const edit: OrganizationOutputs['library.organizationEdit'] = {
  ...editQuery,
  originLibraryId: 'library',
  editRevision: 1,
  position: 'applied',
  lastActionRequestId: 'request',
  eligibility: { eligible: true, blocked: [] },
  changes: [{ sourceId: 'source', field: 'tags', value: 'tag', before: false, after: true }],
};

test('organization inputs preserve omission, clearing and exact string values', () => {
  const schema = compileContract(libraryOrganizationOperations['library.organize']);
  const valid: unknown[] = [
    organize,
    { ...scope, changes: [{ sourceId: 'source', revision: 0, collectionIds: [] }] },
    {
      ...scope,
      changes: [{ ...change, tags: ['Tag', 'tag', ' tag '], collectionIds: ['a', 'b'] }],
    },
    {
      ...scope,
      changes: [{ ...change, revision: Number.MAX_SAFE_INTEGER, tags: ['中'.repeat(100)] }],
    },
    {
      ...scope,
      changes: [{ ...change, tags: Array.from({ length: 100 }, (_, index) => `tag-${index}`) }],
    },
    {
      ...scope,
      changes: [{ ...change, collectionIds: Array.from({ length: 100 }, (_, i) => `id-${i}`) }],
    },
    {
      ...scope,
      changes: Array.from({ length: 100 }, (_, index) => ({ ...change, sourceId: `s-${index}` })),
    },
  ];
  for (const value of valid) {
    const before = JSON.stringify(value);
    expect(schema.params(value)).toBe(true);
    expect(validateOrganization('library.organize', 'params', value)).toBe(true);
    expect(JSON.stringify(value)).toBe(before);
  }
  const invalid: unknown[] = [
    { ...scope, changes: [] },
    {
      ...scope,
      changes: Array.from({ length: 101 }, (_, i) => ({ ...change, sourceId: `s-${i}` })),
    },
    { ...scope, changes: [{ sourceId: 'source', revision: 0 }] },
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((revision) => ({
      ...scope,
      changes: [{ ...change, revision }],
    })),
    ...[[''], ['   '], ['x'.repeat(101)], ['tag', 'tag'], [1], null].map((tags) => ({
      ...scope,
      changes: [{ ...change, tags }],
    })),
    ...[[''], ['x'.repeat(1025)], ['a', 'a'], Array(101).fill('a')].map((collectionIds) => ({
      ...scope,
      changes: [{ ...change, collectionIds }],
    })),
    { ...scope, changes: [{ ...change, tags: Array.from({ length: 101 }, (_, i) => `t-${i}`) }] },
    { ...scope, libraryId: '', changes: [change] },
    { ...scope, requestId: '', changes: [change] },
    { ...scope, changes: [{ ...change, sourceId: '' }] },
    ...['metadata', 'original', 'key', 'relatedIds', 'attachmentId'].map((field) => ({
      ...scope,
      changes: [{ ...change, [field]: {} }],
    })),
    { ...organize, actor: 'self-reported' },
  ];
  for (const value of invalid) {
    expect(schema.params(value)).toBe(false);
    expect(validateOrganization('library.organize', 'params', value)).toBe(false);
  }
});

test('source identity uniqueness applies across distinct change objects', () => {
  for (const changes of [
    [change, { ...change }],
    [change, { ...change, revision: 2, tags: ['other'] }],
    [change, { sourceId: 'source', revision: 0, collectionIds: [] }],
  ]) {
    expect(validateOrganization('library.organize', 'params', { ...scope, changes })).toBe(false);
  }
});

test('receipt states admit only their atomic per-source outcomes', () => {
  const valid: unknown[] = [
    receipt,
    { ...receipt, results: [{ sourceId: 'source', status: 'unchanged', revision: 0 }] },
    {
      ...scope,
      state: 'rejected',
      results: [
        { sourceId: 'source', status: 'blocked', error },
        { sourceId: 'other', status: 'notApplied' },
      ],
    },
    {
      ...scope,
      state: 'rejected',
      error: { code: 'resourceLimit', message: 'Synthetic budget' },
      results: [{ sourceId: 'source', status: 'notApplied' }],
    },
  ];
  const invalid: unknown[] = [
    { requestId: 'request', state: 'committed' },
    { ...receipt, results: undefined },
    { ...receipt, results: [{ sourceId: 'source', status: 'applied' }] },
    { ...receipt, results: [{ sourceId: 'source', status: 'unchanged' }] },
    { ...receipt, results: [{ sourceId: 'source', status: 'blocked', error }] },
    { ...receipt, results: [{ sourceId: 'source', status: 'notApplied' }] },
    { ...receipt, state: 'rejected' },
    { ...receipt, state: 'rejected', results: [{ sourceId: 'source', status: 'blocked' }] },
    { ...receipt, results: [{ sourceId: 'source', status: 'applied', revision: -1 }] },
    { ...receipt, results: Array(101).fill(receipt.results[0]) },
    { ...receipt, results: [{ sourceId: 'source', revision: 1, keyCandidate: 'accepted' }] },
    { ...receipt, error: { code: 'resourceLimit' } },
    { ...receipt, error: { code: 'originMismatch', message: 'Synthetic origin mismatch' } },
  ];
  for (const method of ['library.organize', 'library.revertOrganization'] as const) {
    for (const value of valid) expect(validateOrganization(method, 'result', value)).toBe(true);
    for (const value of invalid) expect(validateOrganization(method, 'result', value)).toBe(false);
  }
  const legacy = {
    requestId: 'request',
    state: 'committed',
    results: [{ sourceId: 'source', revision: 1 }],
  };
  expect(compileContract(libraryRecordOperations['library.commitRecords']).result(legacy)).toBe(
    true,
  );
  expect(validateOrganization('library.organize', 'result', legacy)).toBe(false);
  expect(compileContract(libraryRecordOperations['library.commitRecords']).result(receipt)).toBe(
    false,
  );
});

test('result queries wrap current library identity and retain the original receipt', () => {
  expect(validateOrganization('library.organizationResult', 'params', scope)).toBe(true);
  for (const outcome of [receipt, { requestId: 'request', state: 'notFound' }]) {
    expect(
      validateOrganization('library.organizationResult', 'result', { libraryId: 'copy', outcome }),
    ).toBe(true);
  }
  for (const value of [
    receipt,
    { outcome: receipt },
    { libraryId: 'copy', outcome: { state: 'notFound' } },
  ]) {
    expect(validateOrganization('library.organizationResult', 'result', value)).toBe(false);
  }
});

test('edit pagination requires a safe observed generation after the first page', () => {
  const valid: unknown[] = [
    editQuery,
    { ...editQuery, offset: 0, limit: 25 },
    { ...editQuery, offset: 1, limit: 100, expectedEditRevision: 0 },
    {
      ...editQuery,
      offset: Number.MAX_SAFE_INTEGER,
      expectedEditRevision: Number.MAX_SAFE_INTEGER,
    },
  ];
  const invalid: unknown[] = [
    { ...editQuery, offset: 1 },
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].flatMap((value) => [
      { ...editQuery, offset: value, expectedEditRevision: 1 },
      { ...editQuery, expectedEditRevision: value },
    ]),
    ...[0, 101, 1.5].map((limit) => ({ ...editQuery, limit })),
  ];
  const schema = compileContract(libraryOrganizationOperations['library.organizationEdit']);
  for (const value of valid) {
    expect(schema.params(value)).toBe(true);
    expect(validateOrganization('library.organizationEdit', 'params', value)).toBe(true);
  }
  for (const value of invalid) {
    expect(schema.params(value)).toBe(false);
    expect(validateOrganization('library.organizationEdit', 'params', value)).toBe(false);
  }
  for (const value of [
    edit,
    {
      ...edit,
      position: 'undone',
      eligibility: { eligible: false, error, blocked: [{ sourceId: 'source', error }] },
    },
    {
      ...edit,
      position: 'unchanged',
      editRevision: 0,
      eligibility: { eligible: false, blocked: [] },
      changes: [],
    },
    {
      ...edit,
      changes: [
        {
          sourceId: 'source',
          field: 'collectionIds',
          value: 'c'.repeat(1024),
          before: true,
          after: false,
        },
      ],
      nextOffset: 1,
    },
  ])
    expect(validateOrganization('library.organizationEdit', 'result', value)).toBe(true);
  for (const value of [
    { ...edit, editRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...edit, nextOffset: -1 },
    { ...edit, position: 'rejected' },
    { ...edit, lastActionRequestId: '' },
    { ...edit, eligibility: { eligible: false } },
    {
      ...edit,
      eligibility: { eligible: false, blocked: Array(101).fill({ sourceId: 'source', error }) },
    },
    { ...edit, changes: Array(101).fill(edit.changes[0]) },
    ...['metadata', 'relatedIds'].map((field) => ({
      ...edit,
      changes: [{ ...edit.changes[0], field }],
    })),
    { ...edit, changes: [{ ...edit.changes[0], value: 'x'.repeat(101) }] },
    { ...edit, metadata: {} },
  ])
    expect(validateOrganization('library.organizationEdit', 'result', value)).toBe(false);
});

test('history actions require explicit generation and direction with existing wait semantics', () => {
  for (const direction of ['undo', 'redo']) {
    expect(
      validateOrganization('library.revertOrganization', 'params', { ...revert, direction }),
    ).toBe(true);
  }
  for (const value of [
    scope,
    { ...revert, expectedEditRevision: undefined },
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((expectedEditRevision) => ({
      ...revert,
      expectedEditRevision,
    })),
    { ...revert, direction: 'force' },
    { ...revert, force: true },
  ])
    expect(validateOrganization('library.revertOrganization', 'params', value)).toBe(false);
  for (const [method, operation] of Object.entries(libraryOrganizationOperations)) {
    expect(operation.semantics).toEqual({
      effect:
        method === 'library.organize' || method === 'library.revertOrganization' ? 'write' : 'read',
      returns: 'result',
      waitMs: 5000,
    });
  }
  expect(organizationLimits).toEqual({
    changes: 100,
    requestBytes: 262144,
    historyBytes: 262144,
    responseBytes: 524288,
  });
  expect(organizationLimits.changes).toBe(recordLimits.changes);
  expect(organizationLimits.requestBytes).toBe(recordLimits.requestBytes);
});

test('the validator narrows params and result DTOs from unknown values', () => {
  const input: unknown = organize;
  const output: unknown = edit;
  if (!validateOrganization('library.organize', 'params', input))
    throw new Error('Invalid fixture');
  if (!validateOrganization('library.organizationEdit', 'result', output))
    throw new Error('Invalid fixture');
  const typedInput: OrganizationInputs['library.organize'] = input;
  const typedOutput: OrganizationOutputs['library.organizationEdit'] = output;
  expect(typedInput.changes[0]?.sourceId).toBe('source');
  expect(typedOutput.editRevision).toBe(1);
  const outcomes: unknown[] = [
    receipt,
    { ...scope, state: 'rejected', results: [{ sourceId: 'source', status: 'blocked', error }] },
  ];
  for (const outcome of outcomes) {
    if (!validateOrganization('library.organize', 'result', outcome))
      throw new Error('Invalid fixture');
    if (outcome.state === 'committed') {
      const results: { status: 'applied' | 'unchanged'; revision: number }[] = outcome.results;
      expect(results[0]?.revision).toBe(1);
    } else {
      const results: { status: 'blocked' | 'notApplied' }[] = outcome.results;
      expect(results[0]?.status).toBe('blocked');
    }
  }
});
