import type { FromSchema } from 'json-schema-to-ts';
import { compileContract } from './core.js';
import { errorInfoSchema as error } from './error-contracts.js';
import { recordLimits } from './library-records.js';
import { id, object, page } from './schema.js';

export const organizationLimits = {
  changes: recordLimits.changes,
  requestBytes: recordLimits.requestBytes,
  historyBytes: 262144,
  responseBytes: 524288,
} as const;

const revision = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
const tag = { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' } as const;
const change = {
  ...object(
    {
      sourceId: id,
      revision,
      tags: { type: 'array', items: tag, maxItems: 100, uniqueItems: true },
      collectionIds: { type: 'array', items: id, maxItems: 100, uniqueItems: true },
    },
    ['sourceId', 'revision'],
  ),
  anyOf: [{ required: ['tags'] }, { required: ['collectionIds'] }],
} as const;
const receiptScope = { libraryId: id, requestId: id, error } as const;
const receipt = {
  anyOf: [
    object(
      {
        ...receiptScope,
        state: { const: 'committed' },
        results: {
          type: 'array',
          maxItems: organizationLimits.changes,
          items: object({ sourceId: id, status: { enum: ['applied', 'unchanged'] }, revision }, [
            'sourceId',
            'status',
            'revision',
          ]),
        },
      },
      ['libraryId', 'requestId', 'state', 'results'],
    ),
    object(
      {
        ...receiptScope,
        state: { const: 'rejected' },
        results: {
          type: 'array',
          maxItems: organizationLimits.changes,
          items: {
            anyOf: [
              object({ sourceId: id, status: { const: 'blocked' }, error }, [
                'sourceId',
                'status',
                'error',
              ]),
              object({ sourceId: id, status: { const: 'notApplied' }, error }, [
                'sourceId',
                'status',
              ]),
            ],
          },
        },
      },
      ['libraryId', 'requestId', 'state', 'results'],
    ),
  ],
} as const;
const editScope = { libraryId: id, editRequestId: id } as const;

export const libraryOrganizationOperations = {
  'library.organize': {
    params: object(
      {
        libraryId: id,
        requestId: id,
        changes: {
          type: 'array',
          minItems: 1,
          maxItems: organizationLimits.changes,
          items: change,
        },
      },
      ['libraryId', 'requestId', 'changes'],
    ),
    result: receipt,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'library.organizationResult': {
    params: object({ libraryId: id, requestId: id }, ['libraryId', 'requestId']),
    result: object(
      {
        libraryId: id,
        outcome: {
          anyOf: [
            receipt,
            object({ requestId: id, state: { const: 'notFound' } }, ['requestId', 'state']),
          ],
        },
      },
      ['libraryId', 'outcome'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'library.organizationEdit': {
    params: {
      ...object({ ...editScope, offset: revision, limit: page, expectedEditRevision: revision }, [
        'libraryId',
        'editRequestId',
      ]),
      anyOf: [{ properties: { offset: { const: 0 } } }, { required: ['expectedEditRevision'] }],
    },
    result: object(
      {
        ...editScope,
        originLibraryId: id,
        editRevision: revision,
        position: { enum: ['applied', 'undone', 'unchanged'] },
        lastActionRequestId: id,
        eligibility: object(
          {
            eligible: { type: 'boolean' },
            error,
            blocked: {
              type: 'array',
              maxItems: organizationLimits.changes,
              items: object({ sourceId: id, error }, ['sourceId', 'error']),
            },
          },
          ['eligible', 'blocked'],
        ),
        changes: {
          type: 'array',
          maxItems: 100,
          items: {
            anyOf: [
              object(
                {
                  sourceId: id,
                  field: { const: 'tags' },
                  value: tag,
                  before: { type: 'boolean' },
                  after: { type: 'boolean' },
                },
                ['sourceId', 'field', 'value', 'before', 'after'],
              ),
              object(
                {
                  sourceId: id,
                  field: { const: 'collectionIds' },
                  value: id,
                  before: { type: 'boolean' },
                  after: { type: 'boolean' },
                },
                ['sourceId', 'field', 'value', 'before', 'after'],
              ),
            ],
          },
        },
        nextOffset: revision,
      },
      [
        'libraryId',
        'originLibraryId',
        'editRequestId',
        'editRevision',
        'position',
        'lastActionRequestId',
        'eligibility',
        'changes',
      ],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'library.revertOrganization': {
    params: object(
      {
        ...editScope,
        requestId: id,
        expectedEditRevision: revision,
        direction: { enum: ['undo', 'redo'] },
      },
      ['libraryId', 'requestId', 'editRequestId', 'expectedEditRevision', 'direction'],
    ),
    result: receipt,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;

export type OrganizationChange = FromSchema<typeof change>;
export type OrganizationReceipt = FromSchema<typeof receipt>;
export type OrganizationInputs = {
  [M in keyof typeof libraryOrganizationOperations]: FromSchema<
    (typeof libraryOrganizationOperations)[M]['params']
  >;
};
export type OrganizationOutputs = {
  [M in keyof typeof libraryOrganizationOperations]: FromSchema<
    (typeof libraryOrganizationOperations)[M]['result']
  >;
};

const validators = new Map(
  Object.entries(libraryOrganizationOperations).map(([method, operation]) => [
    method,
    compileContract(operation),
  ]),
);

export function validateOrganization<
  M extends keyof OrganizationInputs,
  K extends 'params' | 'result',
>(
  method: M,
  kind: K,
  value: unknown,
): value is K extends 'params' ? OrganizationInputs[M] : OrganizationOutputs[M] {
  if (!validators.get(method)?.[kind](value)) return false;
  if (method === 'library.organize' && kind === 'params') {
    const { changes } = value as OrganizationInputs['library.organize'];
    return new Set(changes.map((item) => item.sourceId)).size === changes.length;
  }
  return true;
}
