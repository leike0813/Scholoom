import { content, flag, id, object, ok, project, text } from './schema.js';
export const fileReferenceSchema = object({ path: id, fileId: id }, ['path', 'fileId']);

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
  },
  ['id', 'path', 'before', 'after', 'createdAt'],
);
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
