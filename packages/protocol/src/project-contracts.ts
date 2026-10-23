import { fileExplorerOperations } from './file-explorer-contracts.js';
import {
  editSchema,
  fileSaveOperation,
  projectExecutionOperations,
} from './project-file-contracts.js';
import {
  array,
  content,
  count,
  flag,
  id,
  object,
  ok,
  page,
  project,
  session,
  text,
} from './schema.js';

export const projectTrustSchema = { enum: ['pending', 'trusted', 'restricted'] } as const;
const trustDecision = { enum: ['trusted', 'restricted'] } as const;
export const projectSchema = object(
  { id, path: id, name: text, trust: projectTrustSchema, autoBackup: flag, recent: flag },
  ['id', 'path', 'name', 'trust', 'autoBackup'],
);

export const fileEntrySchema = object(
  { fileId: id, path: text, name: text, kind: { enum: ['file', 'dir'] } },
  ['path', 'name', 'kind'],
);

export const fileSchema = object({ fileId: id, path: text, content, basis: id, truncated: flag }, [
  'path',
  'content',
  'basis',
  'truncated',
]);

export const fileLocationSchema = object(
  {
    fileId: id,
    path: text,
    kind: { enum: ['file', 'dir'] },
    state: { enum: ['present', 'trashed', 'missing'] },
    trashId: id,
  },
  ['fileId', 'path', 'kind', 'state'],
);

export const fileOperationSchema = object(
  {
    id,
    kind: { enum: ['mkdir', 'rename', 'move', 'trash', 'restore', 'create'] },
    state: { enum: ['prepared', 'complete', 'unknown', 'failed'] },
    path: text,
    destination: text,
    fileId: id,
    trashId: id,
    error: text,
  },
  ['id', 'kind', 'state', 'path'],
);

export const artifactSchema = object(
  {
    path: text,
    fileId: id,
    location: fileLocationSchema,
    runId: id,
    state: { enum: ['linked', 'unlinked', 'unknown'] },
  },
  ['path', 'runId', 'state'],
);

export const backupSchema = object({ id, createdAt: text, omitted: array(text) }, [
  'id',
  'createdAt',
  'omitted',
]);

export const projectsOperations = {
  ...fileExplorerOperations,
  'project.open': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ path: id, trust: trustDecision }, ['path']),
    result: projectSchema,
  },
  'project.create': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ path: id, trust: trustDecision }, ['path']),
    result: projectSchema,
  },
  'project.forget': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(project, ['projectId']),
    result: ok,
  },
  'project.browseDirectories': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ path: id, limit: page }, []),
    result: object(
      {
        path: id,
        parent: id,
        directories: array(object({ name: id, path: id }, ['name', 'path'])),
        truncated: flag,
      },
      ['path', 'directories', 'truncated'],
    ),
  },
  'files.mkdir': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, path: id, operationId: id }, ['projectId', 'path', 'operationId']),
    result: fileOperationSchema,
  },
  'files.rename': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, path: id, name: id, operationId: id, expectedFileId: id }, [
      'projectId',
      'path',
      'name',
      'operationId',
    ]),
    result: fileOperationSchema,
  },
  'files.trash': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, path: id, operationId: id, expectedFileId: id }, [
      'projectId',
      'path',
      'operationId',
    ]),
    result: fileOperationSchema,
  },
  'files.restore': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, trashId: id, destination: id, operationId: id }, [
      'projectId',
      'trashId',
      'operationId',
    ]),
    result: fileOperationSchema,
  },
  'files.trashList': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, offset: count, limit: page }, ['projectId']),
    result: object({ entries: array(fileLocationSchema), nextOffset: count }, ['entries']),
  },
  'files.resolve': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, fileIds: { type: 'array', items: id, maxItems: 100 } }, [
      'projectId',
      'fileIds',
    ]),
    result: array(fileLocationSchema),
  },
  'files.operation': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, operationId: id }, ['projectId', 'operationId']),
    result: fileOperationSchema,
  },
  'files.resource': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, path: id }, ['projectId', 'path']),
    result: object(
      {
        mimeType: { enum: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] },
        data: { type: 'string', maxLength: 1398104 },
      },
      ['mimeType', 'data'],
    ),
  },
  'project.grant': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, trust: trustDecision, autoBackup: flag }, [
      'projectId',
      'trust',
      'autoBackup',
    ]),
    result: projectSchema,
  },
  'files.list': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(
      { ...project, path: text, offset: count, limit: page, version: id, anchor: text },
      ['projectId'],
    ),
    result: object(
      { entries: array(fileEntrySchema), nextOffset: count, version: id, offset: count },
      ['entries'],
    ),
  },
  'files.read': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, path: id, offset: count }, ['projectId', 'path']),
    result: fileSchema,
  },
  'files.readBytes': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(
      {
        ...project,
        fileId: id,
        basis: id,
        resourceBasis: id,
        offset: count,
        limit: { type: 'integer', minimum: 1, maximum: 262144 },
      },
      ['projectId', 'fileId'],
    ),
    result: object(
      {
        fileId: id,
        path: id,
        basis: id,
        resourceBasis: id,
        size: { type: 'integer', minimum: 0, maximum: 134217728 },
        offset: count,
        data: { type: 'string', maxLength: 349528 },
        nextOffset: count,
      },
      ['fileId', 'path', 'basis', 'resourceBasis', 'size', 'offset', 'data'],
    ),
  },
  'files.save': fileSaveOperation,
  'files.history': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...project, path: id }, ['projectId', 'path']),
    result: array(editSchema),
  },
  'files.undo': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, editId: id }, ['projectId', 'editId']),
    result: editSchema,
  },
  'artifacts.reconcile': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...session, runId: id, paths: array(id) }, [
      'projectId',
      'sessionId',
      'runId',
      'paths',
    ]),
    result: array(artifactSchema),
  },
  'project.backup': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(project, ['projectId']),
    result: backupSchema,
  },
  'project.backups': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(project, ['projectId']),
    result: array(backupSchema),
  },
  'project.restore': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, backupId: id, destination: id }, [
      'projectId',
      'backupId',
      'destination',
    ]),
    result: projectSchema,
  },
} as const;

export const projectLimits = {
  fileBytes: 262144,
  readBytes: 16384,
  binaryFileBytes: 134217728,
  binaryChunkBytes: 262144,
  history: 20,
} as const;

export const projectMaterialOperations = {
  'project.checkRead': {
    params: object({ ...project, agent: flag }, ['projectId']),
    result: ok,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'project.material': {
    params: object({ ...project, path: id, agent: flag }, ['projectId', 'path']),
    result: object({ projectId: id, fileId: id, nativePath: text, basis: id }, [
      'projectId',
      'fileId',
      'nativePath',
      'basis',
    ]),
    semantics: { effect: 'read', returns: 'reference', waitMs: 5000 },
  },
} as const;

export const projectHarnessOperations = {
  'project.fileRevision': {
    params: object(project, ['projectId']),
    result: count,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'project.check': projectExecutionOperations['project.check'],
  'project.path': projectExecutionOperations['project.path'],
  'project.material': projectMaterialOperations['project.material'],
  'files.read': projectsOperations['files.read'],
  'files.readBytes': projectsOperations['files.readBytes'],
  'files.resolve': projectsOperations['files.resolve'],
  'files.operation': projectsOperations['files.operation'],
  'files.mkdir': projectsOperations['files.mkdir'],
  'files.rename': projectsOperations['files.rename'],
  'files.trash': projectsOperations['files.trash'],
  'files.restore': projectsOperations['files.restore'],
  'files.trashList': projectsOperations['files.trashList'],
  'projects.list': {
    params: object({}, []),
    result: array(projectSchema),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'project.artifacts': {
    params: object(session, ['projectId', 'sessionId']),
    result: array(artifactSchema),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'project.linkArtifact': {
    params: object({ ...session, artifact: artifactSchema }, [
      'projectId',
      'sessionId',
      'artifact',
    ]),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;
