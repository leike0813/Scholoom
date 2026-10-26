import type { FromSchema } from 'json-schema-to-ts';
import { cslMetadataSchema } from './library-metadata.js';
import { id, object, page } from './schema.js';

export const recordLimits = { changes: 100, requestBytes: 262144, originalBytes: 65536 } as const;
const revision = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
const jsonObject = { type: 'object', additionalProperties: true } as const;
const identity = object({ instanceId: id, libraryLocator: id, objectKey: id }, [
  'instanceId',
  'libraryLocator',
  'objectKey',
]);
export const originalRecordSchema = object(
  {
    identity,
    schemaVersion: id,
    itemType: id,
    fields: jsonObject,
    creators: { type: 'array', maxItems: 1000, items: jsonObject },
    relations: jsonObject,
  },
  ['identity', 'schemaVersion', 'itemType', 'fields', 'creators', 'relations'],
);
const keyState = object(
  { value: { type: 'string', minLength: 1, maxLength: 1024 }, pinned: { type: 'boolean' } },
  ['value', 'pinned'],
);
const receipt = object(
  {
    requestId: id,
    state: { enum: ['committed', 'rejected'] },
    results: {
      type: 'array',
      maxItems: recordLimits.changes,
      items: object({ sourceId: id, revision, keyCandidate: { enum: ['accepted', 'preserved'] } }, [
        'sourceId',
        'revision',
      ]),
    },
    error: object({ code: id, message: { type: 'string' } }, ['code', 'message']),
  },
  ['requestId', 'state'],
);
const scope = { libraryId: id, sourceId: id, offset: revision, limit: page } as const;
export const libraryRecordOperations = {
  'library.createSourceInstance': {
    params: object(
      { requestId: id, libraryId: id, label: { type: 'string', minLength: 1, maxLength: 200 } },
      ['requestId', 'libraryId', 'label'],
    ),
    result: object({ id, libraryId: id, label: { type: 'string' } }, ['id', 'libraryId', 'label']),
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'library.record': {
    params: object(scope, ['libraryId', 'sourceId']),
    result: object(
      {
        sourceId: id,
        revision,
        citationKey: { anyOf: [keyState, { type: 'null' }] },
        originals: { type: 'array', maxItems: 100, items: originalRecordSchema },
        nextOffset: revision,
      },
      ['sourceId', 'revision', 'citationKey', 'originals'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'library.recordHistory': {
    params: object(scope, ['libraryId', 'sourceId']),
    result: object(
      {
        records: {
          type: 'array',
          maxItems: 100,
          items: object({ revision, kind: { enum: ['original', 'key'] }, value: {} }, [
            'revision',
            'kind',
            'value',
          ]),
        },
        nextOffset: revision,
      },
      ['records'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'library.commitRecords': {
    params: object(
      {
        requestId: id,
        libraryId: id,
        changes: {
          type: 'array',
          minItems: 1,
          maxItems: recordLimits.changes,
          items: object(
            {
              sourceId: id,
              revision,
              metadata: cslMetadataSchema,
              original: originalRecordSchema,
              key: object(
                {
                  value: { anyOf: [keyState.properties.value, { type: 'null' }] },
                  pinned: { type: 'boolean' },
                  intent: { enum: ['candidate', 'explicit'] },
                },
                ['value', 'pinned', 'intent'],
              ),
            },
            ['sourceId', 'revision'],
          ),
        },
      },
      ['requestId', 'libraryId', 'changes'],
    ),
    result: receipt,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'library.commitResult': {
    params: object({ libraryId: id, requestId: id }, ['libraryId', 'requestId']),
    result: {
      anyOf: [
        receipt,
        object({ requestId: id, state: { const: 'notFound' } }, ['requestId', 'state']),
      ],
    },
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;
export type OriginalRecord = FromSchema<typeof originalRecordSchema>;
export type RecordReceipt = FromSchema<typeof receipt>;
