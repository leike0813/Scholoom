import { errorInfoSchema } from './core.js';
import { resourceCreationResultSchema, resourceEvidenceSchema } from './resource-contracts.js';
import { content, count, id, object, page, project } from './schema.js';

const title = { type: 'string', minLength: 1, maxLength: 256 } as const;
export const taskStatusSchema = { enum: ['active', 'waiting', 'completed'] } as const;
export const taskRefSchema = object({ ...project, taskId: id, fileId: id }, [
  'projectId',
  'taskId',
  'fileId',
]);
export const taskWorkItemSchema = object(
  {
    id,
    title,
    dependsOn: { type: 'array', items: id, maxItems: 100, uniqueItems: true },
    planLinkId: id,
  },
  ['id', 'title'],
);
export const taskLinkSchema = object(
  {
    id,
    role: { enum: ['source', 'plan', 'process', 'result'] },
    target: {
      anyOf: [
        object({ kind: { const: 'project-file' }, fileId: id }, ['kind', 'fileId']),
        object({ kind: { const: 'library-material' }, attachmentId: id, materialVersionId: id }, [
          'kind',
          'attachmentId',
          'materialVersionId',
        ]),
        object({ kind: { const: 'library-source' }, libraryId: id, sourceId: id }, [
          'kind',
          'libraryId',
          'sourceId',
        ]),
      ],
    },
    workItemId: id,
    basis: id,
    note: { type: 'string', maxLength: 4096 },
  },
  ['id', 'role', 'target'],
);
export const taskMetadataSchema = object(
  {
    kind: { const: 'research-task' },
    formatVersion: { const: 1 },
    id,
    title,
    status: taskStatusSchema,
    workItems: { type: 'array', items: taskWorkItemSchema, maxItems: 100 },
    links: { type: 'array', items: taskLinkSchema, maxItems: 100 },
  },
  ['kind', 'formatVersion', 'id', 'title', 'status'],
);
export const taskSummarySchema = object(
  {
    task: taskRefSchema,
    title,
    status: taskStatusSchema,
    path: id,
    basis: id,
    summary: { type: 'string', maxLength: 512 },
  },
  ['task', 'title', 'status', 'path', 'basis', 'summary'],
);
export const taskReadSchema = object(
  {
    task: taskRefSchema,
    entry: resourceEvidenceSchema,
    path: id,
    metadata: taskMetadataSchema,
    content,
  },
  ['task', 'entry', 'path', 'metadata', 'content'],
);

export const taskOperations = {
  'tasks.list': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, offset: count, limit: page, version: id }, ['projectId']),
    result: object(
      {
        tasks: { type: 'array', items: taskSummarySchema, maxItems: 100 },
        issues: {
          type: 'array',
          items: object({ path: id, fileId: id, error: errorInfoSchema }, ['path', 'error']),
          maxItems: 100,
        },
        offset: count,
        version: id,
        nextOffset: count,
      },
      ['tasks', 'issues', 'offset'],
    ),
  },
  'tasks.read': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ task: taskRefSchema }, ['task']),
    result: taskReadSchema,
  },
  'tasks.create': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, operationId: id, path: id, content }, [
      'projectId',
      'operationId',
      'path',
      'content',
    ]),
    result: resourceCreationResultSchema,
  },
  'tasks.save': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ task: taskRefSchema, basis: id, content }, ['task', 'basis', 'content']),
    result: taskReadSchema,
  },
} as const;
