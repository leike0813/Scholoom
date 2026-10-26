import { resourceEvidenceSchema } from './resource-contracts.js';
import { array, content, flag, id, object, ok, page, project, text } from './schema.js';
export const fileReferenceSchema = object({ path: id, fileId: id }, ['path', 'fileId']);

export const fileEditOriginSchema = {
  anyOf: [
    object(
      {
        kind: { const: 'human' },
        ...project,
        moduleId: id,
        principal: object({ kind: { const: 'human' }, id }, ['kind', 'id']),
      },
      ['kind', 'projectId', 'moduleId', 'principal'],
    ),
    object(
      {
        kind: { const: 'system' },
        ...project,
        moduleId: id,
        principal: object({ kind: { const: 'system' }, id }, ['kind', 'id']),
      },
      ['kind', 'projectId', 'moduleId', 'principal'],
    ),
    object(
      {
        kind: { const: 'execution' },
        ...project,
        moduleId: id,
        principal: object({ kind: { const: 'agent' }, id }, ['kind', 'id']),
        sessionId: id,
        runId: id,
        instanceId: id,
        instructionContext: {
          anyOf: [
            object(
              {
                state: { const: 'observed' },
                instructionIds: { ...array(id), maxItems: 100, uniqueItems: true },
              },
              ['state', 'instructionIds'],
            ),
            object(
              {
                state: { const: 'unknown' },
                reason: { enum: ['notCaptured', 'recordUnavailable'] },
              },
              ['state', 'reason'],
            ),
          ],
        },
        tool: object(
          {
            state: { const: 'unknown' },
            reason: { enum: ['notBound', 'notToolOperation', 'recordUnavailable'] },
          },
          ['state', 'reason'],
        ),
        delegation: object({ delegationId: id, parentInstanceId: id, parentRunId: id }, [
          'delegationId',
          'parentInstanceId',
          'parentRunId',
        ]),
      },
      [
        'kind',
        'projectId',
        'moduleId',
        'principal',
        'sessionId',
        'runId',
        'instanceId',
        'instructionContext',
        'tool',
      ],
    ),
    object(
      {
        kind: { const: 'unknown' },
        reason: { enum: ['unattributed', 'legacy', 'recordUnavailable'] },
      },
      ['kind', 'reason'],
    ),
  ],
} as const;

const editMetadata = {
  origin: fileEditOriginSchema,
  beforeEvidence: resourceEvidenceSchema,
  afterEvidence: resourceEvidenceSchema,
  revertsEditId: id,
} as const;

export const editSchema = object(
  {
    id,
    fileId: id,
    basis: id,
    path: text,
    before: content,
    after: content,
    createdAt: text,
    created: flag,
    ...editMetadata,
  },
  ['id', 'path', 'before', 'after', 'createdAt'],
);

export const fileChangeSchema = object(
  { editId: id, fileId: id, createdAt: text, ...editMetadata },
  ['editId', 'fileId', 'createdAt'],
);
export const fileChangeCursorSchema = object(
  {
    ...project,
    fileId: id,
    afterEditId: id,
    anchor: { enum: ['notRequested', 'matched', 'missing'] },
    fromEditId: id,
    throughEditId: id,
    beforeEditId: id,
  },
  ['projectId', 'fileId', 'anchor', 'fromEditId', 'throughEditId', 'beforeEditId'],
);
export const fileChangesResultSchema = object(
  {
    changes: { ...array(fileChangeSchema), maxItems: 100 },
    nextCursor: fileChangeCursorSchema,
    coverage: object(
      {
        anchor: { enum: ['notRequested', 'matched', 'missing'] },
        retention: { enum: ['pruned', 'unknown'] },
        current: { enum: ['matchesLatest', 'changedOrUnrecorded', 'unavailable'] },
      },
      ['anchor', 'retention', 'current'],
    ),
  },
  ['changes', 'coverage'],
);
export const fileChangeOperations = {
  'files.changes': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: {
      anyOf: [
        object({ ...project, fileId: id, afterEditId: id, limit: page }, ['projectId', 'fileId']),
        object({ ...project, fileId: id, cursor: fileChangeCursorSchema, limit: page }, [
          'projectId',
          'fileId',
          'cursor',
        ]),
      ],
    },
    result: fileChangesResultSchema,
  },
  'files.edit': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, fileId: id, editId: id }, ['projectId', 'fileId', 'editId']),
    result: editSchema,
  },
} as const;

export const fileSaveOperation = {
  semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  params: object({ ...project, path: id, content, basis: id }, ['projectId', 'path', 'content']),
  result: editSchema,
} as const;

export const projectExecutionOperations = {
  'project.check': {
    params: object({ ...project, access: { enum: ['read', 'write', 'send'] } }, [
      'projectId',
      'access',
    ]),
    result: ok,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'project.path': {
    params: object({ ...project, path: text, allowMissing: flag }, ['projectId', 'path']),
    result: text,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'project.saveFile': {
    params: object(
      { ...fileSaveOperation.params.properties, expectedFileId: id, resourceBasis: id },
      ['projectId', 'path', 'content'],
    ),
    result: fileSaveOperation.result,
    semantics: fileSaveOperation.semantics,
  },
} as const;
