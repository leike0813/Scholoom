import type { FromSchema } from 'json-schema-to-ts';
import { readingIndex, readingLocationSchema } from './library.js';
import { resourceEvidenceSchema } from './resources.js';
import { array, content, count, id, object, ok, text } from './schema.js';
import { workbenchSourceSchema } from './workbench-source.js';

export const contextLimits = {
  items: 16,
  selectedItems: 100,
  excerptUnits: 8192,
  commentUnits: 4096,
  bodyBytes: 65536,
} as const;
const excerpt = { type: 'string', maxLength: contextLimits.excerptUnits } as const;
const comment = { type: 'string', maxLength: contextLimits.commentUnits } as const;
const base = {
  itemId: id,
  ref: resourceEvidenceSchema.properties.ref,
  basis: id,
  comment,
} as const;
export const contextItemSchema = {
  anyOf: [
    object({ kind: { const: 'resource' }, ...base }, ['kind', 'itemId', 'ref', 'basis']),
    object(
      {
        kind: { const: 'text' },
        ...base,
        quote: excerpt,
        contentState: { enum: ['saved', 'draft'] },
        location: readingLocationSchema,
      },
      ['kind', 'itemId', 'ref', 'basis', 'quote', 'contentState'],
    ),
    object(
      {
        kind: { const: 'region' },
        ...base,
        target: {
          anyOf: [
            object({ kind: { const: 'image' } }, ['kind']),
            object(
              {
                kind: { const: 'pdf' },
                pageIndex: readingIndex,
                width: { type: 'number', exclusiveMinimum: 0 },
                height: { type: 'number', exclusiveMinimum: 0 },
              },
              ['kind', 'pageIndex', 'width', 'height'],
            ),
            object({ kind: { const: 'object' }, providerId: id, objectId: id }, [
              'kind',
              'providerId',
              'objectId',
            ]),
          ],
        },
        region: object(
          {
            x: { type: 'number', minimum: 0, maximum: 1 },
            y: { type: 'number', minimum: 0, maximum: 1 },
            width: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
            height: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
          },
          ['x', 'y', 'width', 'height'],
        ),
      },
      ['kind', 'itemId', 'ref', 'basis', 'region'],
    ),
    object(
      {
        kind: { const: 'object' },
        ...base,
        providerId: id,
        objectId: id,
        name: id,
        semantics: excerpt,
        contentState: { enum: ['saved', 'draft'] },
      },
      ['kind', 'itemId', 'ref', 'basis', 'providerId', 'objectId', 'name', 'semantics'],
    ),
  ],
} as const;
export const contextItemsSchema = {
  type: 'array',
  items: contextItemSchema,
  maxItems: contextLimits.items,
} as const;
export const instructionContextSchema = object(
  {
    instructionId: id,
    source: workbenchSourceSchema,
    contextItems: contextItemsSchema,
    text: content,
    materials: array(text),
    materialFileIds: array(text),
  },
  ['instructionId'],
);
export const instructionContextsSchema = {
  type: 'array',
  items: instructionContextSchema,
  maxItems: 100,
} as const;
export const workbenchContextSnapshotSchema = object(
  {
    revision: count,
    receiver: {
      anyOf: [
        object({ projectId: id, sessionId: id }, ['projectId', 'sessionId']),
        { const: null },
      ],
    },
    viewId: id,
    selectedItems: {
      type: 'array',
      items: id,
      maxItems: contextLimits.selectedItems,
      uniqueItems: true,
    },
    selections: contextItemsSchema,
  },
  ['revision', 'receiver', 'viewId', 'selectedItems', 'selections'],
);
export const workbenchContextOperations = {
  'workbench.context.publish': {
    params: object({ snapshot: { anyOf: [workbenchContextSnapshotSchema, { const: null }] } }, [
      'snapshot',
    ]),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;
export const workbenchContextInternalOperations = {
  'workbench.context.read': {
    params: object({ instructionId: id }, []),
    result: {
      anyOf: [
        object(
          {
            state: { const: 'available' },
            instructionId: id,
            snapshot: workbenchContextSnapshotSchema,
          },
          ['state', 'instructionId', 'snapshot'],
        ),
        object(
          {
            state: { const: 'unavailable' },
            reason: { enum: ['noSource', 'disconnected', 'receiverMismatch', 'noSnapshot'] },
          },
          ['state', 'reason'],
        ),
        object(
          {
            state: { const: 'ambiguous' },
            instructionIds: {
              type: 'array',
              items: id,
              minItems: 1,
              maxItems: 100,
              uniqueItems: true,
            },
          },
          ['state', 'instructionIds'],
        ),
      ],
    },
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;
export const workbenchContextContracts = {
  ...workbenchContextOperations,
  ...workbenchContextInternalOperations,
} as const;
export type ContextItem = FromSchema<typeof contextItemSchema>;
export type InstructionContext = FromSchema<typeof instructionContextSchema>;
export type WorkbenchContextSnapshot = FromSchema<typeof workbenchContextSnapshotSchema>;
