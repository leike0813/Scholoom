import { array, count, id, object, ok, page, project, text } from './schema.js';

export const transferSourceSchema = object({ projectId: id, path: id, fileId: id }, [
  'projectId',
  'path',
  'fileId',
]);
export const transferEntrySchema = object(
  {
    id,
    path: text,
    destination: text,
    kind: { enum: ['file', 'dir'] },
    state: { enum: ['pending', 'copying', 'conflict', 'complete', 'skipped', 'failed', 'unknown'] },
    fileId: id,
    basis: id,
    trashId: id,
    error: text,
  },
  ['id', 'path', 'destination', 'kind', 'state'],
);
export const transferSchema = object(
  {
    id,
    projectId: id,
    state: {
      enum: ['uploading', 'running', 'conflict', 'complete', 'partial', 'cancelled', 'unknown'],
    },
    total: count,
    completed: count,
    entries: array(transferEntrySchema),
    nextOffset: count,
    conflict: transferEntrySchema,
    error: text,
  },
  ['id', 'projectId', 'state', 'total', 'completed', 'entries'],
);
const operation = { ...project, operationId: id } as const;
const target = { ...operation, destination: text } as const;
export const importEntrySchema = object(
  { path: id, kind: { enum: ['file', 'dir'] }, size: count },
  ['path', 'kind'],
);
export const fileExplorerOperations = {
  'files.transfer': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(
      {
        ...target,
        mode: { enum: ['copy', 'move'] },
        sources: { type: 'array', items: transferSourceSchema, minItems: 1, maxItems: 10000 },
      },
      ['projectId', 'operationId', 'destination', 'mode', 'sources'],
    ),
    result: transferSchema,
  },
  'files.transferStatus': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...operation, offset: count, limit: page }, ['projectId', 'operationId']),
    result: transferSchema,
  },
  'files.transferDecide': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(
      { ...operation, entryId: id, basis: id, decision: { enum: ['skip', 'keepBoth', 'replace'] } },
      ['projectId', 'operationId', 'entryId', 'basis', 'decision'],
    ),
    result: transferSchema,
  },
  'files.transferCancel': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(operation, ['projectId', 'operationId']),
    result: transferSchema,
  },
  'files.importBegin': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(
      {
        ...target,
        entries: { type: 'array', items: importEntrySchema, minItems: 1, maxItems: 10000 },
      },
      ['projectId', 'operationId', 'destination', 'entries'],
    ),
    result: transferSchema,
  },
  'files.importChunk': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(
      { ...operation, path: id, offset: count, base64: { type: 'string', maxLength: 349528 } },
      ['projectId', 'operationId', 'path', 'offset', 'base64'],
    ),
    result: ok,
  },
  'files.importFinish': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(operation, ['projectId', 'operationId']),
    result: transferSchema,
  },
  'files.watch': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, paths: { type: 'array', items: text, maxItems: 100 } }, [
      'projectId',
      'paths',
    ]),
    result: object({ watchId: id }, ['watchId']),
  },
  'files.unwatch': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, watchId: id }, ['projectId', 'watchId']),
    result: ok,
  },
} as const;
