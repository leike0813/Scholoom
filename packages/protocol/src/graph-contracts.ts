import type { FromSchema } from 'json-schema-to-ts';
import { errorInfoSchema } from './core.js';
import {
  resourceCreationResultSchema,
  resourceEvidenceSchema,
  resourceSaveResultSchema,
} from './resource-contracts.js';
import { count, flag, id, object } from './schema.js';
import { workDomainSchema } from './work-domains.js';

const jsonObject = { type: 'object', additionalProperties: true } as const;
const evidenceList = { type: 'array', items: resourceEvidenceSchema, maxItems: 1000 } as const;
export const graphDefinitionSchema = object(
  {
    graphId: id,
    version: id,
    stateFormatVersion: id,
    configSchema: jsonObject,
    waitSchemas: { type: 'object', additionalProperties: jsonObject },
    requiresModel: flag,
  },
  ['graphId', 'version', 'stateFormatVersion', 'configSchema'],
);
export const registeredGraphSchema = object(
  {
    kind: { const: 'registered' },
    graphId: id,
    version: id,
    config: jsonObject,
    materials: evidenceList,
    workDomain: workDomainSchema,
  },
  ['kind', 'graphId', 'version', 'config', 'materials', 'workDomain'],
);
export const graphExecutionSchema = {
  anyOf: [object({ kind: { const: 'agent' } }, ['kind']), registeredGraphSchema],
} as const;
export const graphWaitSchema = object(
  {
    attemptId: id,
    waitId: id,
    nodeKey: id,
    inputSchemaRef: id,
    prompt: { type: 'string', maxLength: 8192 },
    checkpointRef: id,
  },
  ['attemptId', 'waitId', 'nodeKey', 'inputSchemaRef', 'prompt', 'checkpointRef'],
);
export const graphBindingSchema = object(
  {
    originInstructionId: id,
    graphId: id,
    version: id,
    config: jsonObject,
    stateFormatVersion: id,
    checkpointRef: id,
    wait: graphWaitSchema,
    materials: evidenceList,
  },
  ['graphId', 'version', 'config', 'stateFormatVersion', 'checkpointRef'],
);
export const graphResumeInputSchema = object(
  {
    attemptId: id,
    waitId: id,
    instructionIds: { type: 'array', items: id, minItems: 1, maxItems: 100, uniqueItems: true },
    value: {
      anyOf: [
        { type: 'null' },
        { type: 'boolean' },
        { type: 'number' },
        { type: 'string' },
        { type: 'array' },
        jsonObject,
      ],
    },
  },
  ['attemptId', 'waitId', 'instructionIds', 'value'],
);
const contentRange = { offset: count, length: count, nextOffset: count } as const;
export const graphContentReadSchema = object(
  {
    resource: resourceEvidenceSchema,
    content: {
      anyOf: [
        object(
          {
            kind: { enum: ['text', 'bytes'] },
            ...contentRange,
            size: count,
            truncated: flag,
          },
          ['kind', 'offset', 'length', 'size', 'truncated'],
        ),
        object({ kind: { const: 'pdf-page' }, ...contentRange, pageIndex: count, hasText: flag }, [
          'kind',
          'offset',
          'length',
          'pageIndex',
          'hasText',
        ]),
        object(
          {
            kind: { const: 'document-section' },
            ...contentRange,
            sectionId: id,
            normalizationVersion: { const: 1 },
            size: count,
          },
          ['kind', 'offset', 'length', 'sectionId', 'normalizationVersion', 'size'],
        ),
        object({ kind: { enum: ['directory', 'search'] } }, ['kind']),
      ],
    },
  },
  ['resource', 'content'],
);
export const graphRoleResultSchema = object({ role: id, result: resourceSaveResultSchema }, [
  'role',
  'result',
]);
export const graphEvidenceSchema = object(
  {
    inputs: evidenceList,
    reads: evidenceList,
    results: { type: 'array', items: resourceSaveResultSchema, maxItems: 1000 },
    creations: { type: 'array', items: resourceCreationResultSchema, maxItems: 1000 },
    contentReads: { type: 'array', items: graphContentReadSchema, maxItems: 1000 },
    roleResults: { type: 'array', items: graphRoleResultSchema, maxItems: 100 },
  },
  ['inputs', 'reads', 'results'],
);
export const graphProgressSchema = {
  anyOf: [
    object(
      { kind: { const: 'graph.waiting' }, wait: graphWaitSchema, evidence: graphEvidenceSchema },
      ['kind', 'wait', 'evidence'],
    ),
    object({ kind: { const: 'graph.completed' }, attemptId: id, evidence: graphEvidenceSchema }, [
      'kind',
      'attemptId',
      'evidence',
    ]),
    object(
      {
        kind: { const: 'graph.failed' },
        attemptId: id,
        error: errorInfoSchema,
        evidence: graphEvidenceSchema,
      },
      ['kind', 'attemptId', 'error', 'evidence'],
    ),
  ],
} as const;
export type GraphDefinition = FromSchema<typeof graphDefinitionSchema>;
export type GraphWait = FromSchema<typeof graphWaitSchema>;
export type GraphExecution = FromSchema<typeof graphExecutionSchema>;
export type GraphBinding = FromSchema<typeof graphBindingSchema>;
export type GraphResumeInput = FromSchema<typeof graphResumeInputSchema>;
export type GraphProgress = FromSchema<typeof graphProgressSchema>;
export type GraphContentRead = FromSchema<typeof graphContentReadSchema>;
export type GraphRoleResult = FromSchema<typeof graphRoleResultSchema>;
