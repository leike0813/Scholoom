import type { FromSchema } from 'json-schema-to-ts';
import { type CallContext, errorInfoSchema } from './core.js';
import { graphDefinitionSchema } from './graph-contracts.js';
import type { LibrarySource } from './library.js';
import { resourceCreationResultSchema, resourceEvidenceSchema } from './resource-contracts.js';
import { content, count, id, object, page, project } from './schema.js';
import { taskRefSchema } from './task-contracts.js';

export const taskGraphInputOperation = (processOperationId: string): string =>
  `${processOperationId}_input`;

const materialSource = object({ linkId: id, evidence: resourceEvidenceSchema }, [
  'linkId',
  'evidence',
]);
const catalogSource = object(
  {
    linkId: id,
    catalog: object({ libraryId: id, sourceId: id, version: id, revision: count }, [
      'libraryId',
      'sourceId',
      'version',
      'revision',
    ]),
  },
  ['linkId', 'catalog'],
);
const inputSnapshot = object(
  {
    kind: { const: 'research-task-graph-input' },
    formatVersion: { const: 1 },
    task: taskRefSchema,
    entry: resourceEvidenceSchema,
    workItemId: id,
    sessionId: id,
    invocationId: id,
    instructionId: id,
    sources: {
      type: 'array',
      maxItems: 100,
      items: materialSource,
    },
    content,
  },
  [
    'kind',
    'formatVersion',
    'task',
    'entry',
    'sessionId',
    'invocationId',
    'instructionId',
    'sources',
    'content',
  ],
);
export const taskGraphInputSnapshotSchema = {
  anyOf: [
    inputSnapshot,
    {
      ...inputSnapshot,
      properties: {
        ...inputSnapshot.properties,
        formatVersion: { const: 2 },
        sources: {
          ...inputSnapshot.properties.sources,
          items: { anyOf: [materialSource, catalogSource] },
        },
      },
    },
  ],
} as const;
export type TaskGraphInputSnapshot = FromSchema<typeof taskGraphInputSnapshotSchema>;

/** The library owner checks identity and current read/send access on every read. */
export interface TaskCatalogPort {
  read(
    input: { libraryId: string; sourceId: string },
    context: CallContext,
  ): Promise<Pick<LibrarySource, 'id' | 'version' | 'revision'>>;
}

export const taskGraphOperations = {
  'tasks.graphs': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, offset: count, limit: page }, ['projectId']),
    result: object(
      {
        graphs: {
          type: 'array',
          items: object({ definition: graphDefinitionSchema, name: id }, ['definition', 'name']),
          maxItems: 100,
        },
        nextOffset: count,
        unavailableReason: { type: 'string', maxLength: 512 },
      },
      ['graphs'],
    ),
  },
  'tasks.runGraph': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(
      {
        task: taskRefSchema,
        basis: id,
        sessionId: id,
        invocationId: id,
        instructionId: id,
        processOperationId: {
          type: 'string',
          minLength: 1,
          maxLength: 96,
          pattern: '^[A-Za-z0-9_-]+$',
        },
        graphId: id,
        version: id,
        config: { type: 'object', additionalProperties: true },
        sourceLinkIds: { type: 'array', items: id, maxItems: 100, uniqueItems: true },
        workItemId: id,
      },
      [
        'task',
        'basis',
        'sessionId',
        'invocationId',
        'instructionId',
        'processOperationId',
        'graphId',
        'version',
        'config',
        'sourceLinkIds',
      ],
    ),
    result: object(
      {
        call: object(
          { ...project, sessionId: id, invocationId: id, instructionId: id, runId: id },
          ['projectId', 'sessionId', 'invocationId', 'instructionId', 'runId'],
        ),
        process: resourceCreationResultSchema,
        inputSnapshot: resourceCreationResultSchema.anyOf[0],
        taskAssociation: object(
          {
            state: { enum: ['confirmed', 'failed', 'unknown', 'pending'] },
            error: errorInfoSchema,
          },
          ['state'],
        ),
      },
      ['call', 'process', 'taskAssociation'],
    ),
  },
} as const;

export type TaskGraphInputs = {
  [M in keyof typeof taskGraphOperations]: FromSchema<(typeof taskGraphOperations)[M]['params']>;
};
export type TaskGraphOutputs = {
  [M in keyof typeof taskGraphOperations]: FromSchema<(typeof taskGraphOperations)[M]['result']>;
};

/** The research owner authorizes and deduplicates starts under the original human identity. */
export interface TaskResearchPort {
  graphs(
    input: Omit<TaskGraphInputs['tasks.graphs'], 'projectId'>,
    context: CallContext,
  ): Promise<TaskGraphOutputs['tasks.graphs']>;
  start(
    input: Pick<
      TaskGraphInputs['tasks.runGraph'],
      'sessionId' | 'invocationId' | 'instructionId' | 'graphId' | 'version' | 'config'
    > & {
      projectId: TaskGraphInputs['tasks.graphs']['projectId'];
      materials: FromSchema<typeof resourceEvidenceSchema>[];
      text: string;
    },
    context: CallContext,
  ): Promise<
    Pick<TaskGraphOutputs['tasks.runGraph']['call'], 'invocationId' | 'instructionId' | 'runId'>
  >;
}
