import { Ajv } from 'ajv';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

const text = { type: 'string' } as const;
const id = { type: 'string', minLength: 1, maxLength: 1024 } as const;
const flag = { type: 'boolean' } as const;
const count = { type: 'integer', minimum: 0 } as const;
const page = { type: 'integer', minimum: 1, maximum: 100 } as const;
const content = { type: 'string', maxLength: 262144 } as const;
const array = <const T extends JSONSchema>(items: T) => ({ type: 'array', items }) as const;
const object = <
  const P extends Record<string, JSONSchema>,
  const R extends readonly (keyof P & string)[],
>(
  properties: P,
  required: R,
) => ({ type: 'object', properties, required, additionalProperties: false }) as const;

export const projectSchema = object(
  { id, path: id, name: text, read: flag, write: flag, send: flag, autoBackup: flag, recent: flag },
  ['id', 'path', 'name', 'read', 'write', 'send', 'autoBackup'],
);
export const runStateSchema = {
  enum: ['queued', 'running', 'cancelling', 'cancelled', 'completed', 'failed', 'interrupted'],
} as const;
export const sessionSchema = object(
  { id, projectId: id, title: text, updatedAt: text, state: runStateSchema },
  ['id', 'projectId', 'title', 'updatedAt', 'state'],
);
export const messageSchema = object(
  {
    id,
    sessionId: id,
    role: { enum: ['user', 'assistant', 'tool'] },
    text: content,
    state: { enum: ['accepted', 'consumed', 'streaming', 'complete', 'error', 'unknown'] },
    tool: object(
      {
        runId: id,
        name: id,
        input: { type: 'string', maxLength: 16384 },
        output: { type: 'string', maxLength: 16384 },
        inputTruncated: flag,
        outputTruncated: flag,
      },
      ['runId', 'name', 'input', 'inputTruncated'],
    ),
    materials: array(text),
    materialFileIds: array(text),
    createdAt: text,
  },
  ['id', 'sessionId', 'role', 'text', 'state', 'materials', 'createdAt'],
);
export const runSchema = object(
  {
    id,
    sessionId: id,
    attempt: count,
    state: runStateSchema,
    error: text,
    inputTokens: count,
    outputTokens: count,
    remoteOutcome: { enum: ['unknown', 'completed'] },
  },
  ['id', 'sessionId', 'attempt', 'state'],
);
export const providerSchema = object(
  {
    id: { const: 'minimax-cn-m-plan' },
    model: { const: 'MiniMax-M3.1-Flash-Preview' },
    configured: flag,
    source: { enum: ['saved', 'environment', 'missing'] },
    error: text,
  },
  ['id', 'model', 'configured', 'source'],
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
export const editSchema = object(
  { id, fileId: id, path: text, before: content, after: content, createdAt: text, created: flag },
  ['id', 'path', 'before', 'after', 'createdAt'],
);
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
    kind: { enum: ['mkdir', 'rename', 'trash', 'restore'] },
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
const scope = { projectId: id, sessionId: id, before: id, limit: page } as const;
export const snapshotSchema = object(
  {
    revision: count,
    provider: providerSchema,
    projects: array(projectSchema),
    sessions: array(sessionSchema),
    messages: array(messageSchema),
    run: runSchema,
    artifacts: array(artifactSchema),
    nextBefore: id,
    fileRevision: count,
  },
  ['revision', 'provider', 'projects', 'sessions', 'messages', 'artifacts'],
);
export const changeSchema = object(
  { revision: count, projectId: id, sessionId: id, resync: flag },
  ['revision', 'resync'],
);
const ok = object({ ok: { const: true } }, ['ok']);
const project = { projectId: id } as const;
const session = { projectId: id, sessionId: id } as const;

export const businessSchemas = {
  'workbench.snapshot': { params: object(scope, []), result: snapshotSchema },
  'workbench.watch': { params: object(scope, []), result: snapshotSchema },
  'provider.configure': {
    params: object({ apiKey: { type: 'string', minLength: 1, maxLength: 4096 } }, ['apiKey']),
    result: providerSchema,
  },
  'project.open': { params: object({ path: id }, ['path']), result: projectSchema },
  'project.create': { params: object({ path: id, name: id }, ['path']), result: projectSchema },
  'project.rename': {
    params: object({ ...project, name: { type: 'string', minLength: 1, maxLength: 200 } }, [
      'projectId',
      'name',
    ]),
    result: projectSchema,
  },
  'project.forget': { params: object(project, ['projectId']), result: ok },
  'files.mkdir': {
    params: object({ ...project, path: id, operationId: id }, ['projectId', 'path', 'operationId']),
    result: fileOperationSchema,
  },
  'files.rename': {
    params: object({ ...project, path: id, name: id, operationId: id }, [
      'projectId',
      'path',
      'name',
      'operationId',
    ]),
    result: fileOperationSchema,
  },
  'files.trash': {
    params: object({ ...project, path: id, operationId: id }, ['projectId', 'path', 'operationId']),
    result: fileOperationSchema,
  },
  'files.restore': {
    params: object({ ...project, trashId: id, destination: id, operationId: id }, [
      'projectId',
      'trashId',
      'operationId',
    ]),
    result: fileOperationSchema,
  },
  'files.trashList': {
    params: object({ ...project, offset: count, limit: page }, ['projectId']),
    result: object({ entries: array(fileLocationSchema), nextOffset: count }, ['entries']),
  },
  'files.resolve': {
    params: object({ ...project, fileIds: { type: 'array', items: id, maxItems: 100 } }, [
      'projectId',
      'fileIds',
    ]),
    result: array(fileLocationSchema),
  },
  'files.operation': {
    params: object({ ...project, operationId: id }, ['projectId', 'operationId']),
    result: fileOperationSchema,
  },
  'files.resource': {
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
    params: object({ ...project, read: flag, write: flag, send: flag, autoBackup: flag }, [
      'projectId',
      'read',
      'write',
      'send',
      'autoBackup',
    ]),
    result: projectSchema,
  },
  'files.list': {
    params: object({ ...project, path: text, offset: count, limit: page }, ['projectId']),
    result: object({ entries: array(fileEntrySchema), nextOffset: count }, ['entries']),
  },
  'files.read': {
    params: object({ ...project, path: id, offset: count }, ['projectId', 'path']),
    result: fileSchema,
  },
  'files.save': {
    params: object({ ...project, path: id, content, basis: id }, ['projectId', 'path', 'content']),
    result: editSchema,
  },
  'files.history': {
    params: object({ ...project, path: id }, ['projectId', 'path']),
    result: array(editSchema),
  },
  'files.undo': {
    params: object({ ...project, editId: id }, ['projectId', 'editId']),
    result: editSchema,
  },
  'artifacts.reconcile': {
    params: object({ ...session, runId: id, paths: array(id) }, [
      'projectId',
      'sessionId',
      'runId',
      'paths',
    ]),
    result: array(artifactSchema),
  },
  'project.backup': { params: object(project, ['projectId']), result: backupSchema },
  'project.backups': { params: object(project, ['projectId']), result: array(backupSchema) },
  'project.restore': {
    params: object({ ...project, backupId: id, destination: id }, [
      'projectId',
      'backupId',
      'destination',
    ]),
    result: projectSchema,
  },
  'session.create': {
    params: object({ ...project, title: text }, ['projectId']),
    result: sessionSchema,
  },
  'session.send': {
    params: object(
      {
        ...session,
        instructionId: id,
        text: { type: 'string', minLength: 1, maxLength: 32768 },
        materials: array(text),
        materialFileIds: array(text),
      },
      ['projectId', 'sessionId', 'instructionId', 'text', 'materials'],
    ),
    result: object({ instructionId: id, runId: id }, ['instructionId', 'runId']),
  },
  'session.cancel': { params: object(session, ['projectId', 'sessionId']), result: ok },
  'session.resume': { params: object(session, ['projectId', 'sessionId']), result: ok },
} as const;

export type Project = FromSchema<typeof projectSchema>;
export type Session = FromSchema<typeof sessionSchema>;
export type Message = FromSchema<typeof messageSchema>;
export type Run = FromSchema<typeof runSchema>;
export type ProviderStatus = FromSchema<typeof providerSchema>;
export type FileEntry = FromSchema<typeof fileEntrySchema>;
export type FileContent = FromSchema<typeof fileSchema>;
export type FileEdit = FromSchema<typeof editSchema>;
export type FileLocation = FromSchema<typeof fileLocationSchema>;
export type FileOperation = FromSchema<typeof fileOperationSchema>;
export type Artifact = FromSchema<typeof artifactSchema>;
export type ProjectBackup = FromSchema<typeof backupSchema>;
export type WorkbenchSnapshot = FromSchema<typeof snapshotSchema>;
export type WorkbenchChange = FromSchema<typeof changeSchema>;
export type BusinessMethod = keyof typeof businessSchemas;
type Inputs = {
  'project.create': FromSchema<(typeof businessSchemas)['project.create']['params']>;
  'project.rename': FromSchema<(typeof businessSchemas)['project.rename']['params']>;
  'project.forget': FromSchema<(typeof businessSchemas)['project.forget']['params']>;
  'files.mkdir': FromSchema<(typeof businessSchemas)['files.mkdir']['params']>;
  'files.rename': FromSchema<(typeof businessSchemas)['files.rename']['params']>;
  'files.trash': FromSchema<(typeof businessSchemas)['files.trash']['params']>;
  'files.restore': FromSchema<(typeof businessSchemas)['files.restore']['params']>;
  'files.trashList': FromSchema<(typeof businessSchemas)['files.trashList']['params']>;
  'files.resolve': FromSchema<(typeof businessSchemas)['files.resolve']['params']>;
  'files.operation': FromSchema<(typeof businessSchemas)['files.operation']['params']>;
  'files.resource': FromSchema<(typeof businessSchemas)['files.resource']['params']>;
  'artifacts.reconcile': FromSchema<(typeof businessSchemas)['artifacts.reconcile']['params']>;
  'workbench.snapshot': FromSchema<(typeof businessSchemas)['workbench.snapshot']['params']>;
  'workbench.watch': FromSchema<(typeof businessSchemas)['workbench.watch']['params']>;
  'provider.configure': FromSchema<(typeof businessSchemas)['provider.configure']['params']>;
  'project.open': FromSchema<(typeof businessSchemas)['project.open']['params']>;
  'project.grant': FromSchema<(typeof businessSchemas)['project.grant']['params']>;
  'files.list': FromSchema<(typeof businessSchemas)['files.list']['params']>;
  'files.read': FromSchema<(typeof businessSchemas)['files.read']['params']>;
  'files.save': FromSchema<(typeof businessSchemas)['files.save']['params']>;
  'files.history': FromSchema<(typeof businessSchemas)['files.history']['params']>;
  'files.undo': FromSchema<(typeof businessSchemas)['files.undo']['params']>;
  'project.backup': FromSchema<(typeof businessSchemas)['project.backup']['params']>;
  'project.backups': FromSchema<(typeof businessSchemas)['project.backups']['params']>;
  'project.restore': FromSchema<(typeof businessSchemas)['project.restore']['params']>;
  'session.create': FromSchema<(typeof businessSchemas)['session.create']['params']>;
  'session.send': FromSchema<(typeof businessSchemas)['session.send']['params']>;
  'session.cancel': FromSchema<(typeof businessSchemas)['session.cancel']['params']>;
  'session.resume': FromSchema<(typeof businessSchemas)['session.resume']['params']>;
};
type Outputs = {
  'project.create': FromSchema<(typeof businessSchemas)['project.create']['result']>;
  'project.rename': FromSchema<(typeof businessSchemas)['project.rename']['result']>;
  'project.forget': FromSchema<(typeof businessSchemas)['project.forget']['result']>;
  'files.mkdir': FromSchema<(typeof businessSchemas)['files.mkdir']['result']>;
  'files.rename': FromSchema<(typeof businessSchemas)['files.rename']['result']>;
  'files.trash': FromSchema<(typeof businessSchemas)['files.trash']['result']>;
  'files.restore': FromSchema<(typeof businessSchemas)['files.restore']['result']>;
  'files.trashList': FromSchema<(typeof businessSchemas)['files.trashList']['result']>;
  'files.resolve': FromSchema<(typeof businessSchemas)['files.resolve']['result']>;
  'files.operation': FromSchema<(typeof businessSchemas)['files.operation']['result']>;
  'files.resource': FromSchema<(typeof businessSchemas)['files.resource']['result']>;
  'artifacts.reconcile': FromSchema<(typeof businessSchemas)['artifacts.reconcile']['result']>;
  'workbench.snapshot': FromSchema<(typeof businessSchemas)['workbench.snapshot']['result']>;
  'workbench.watch': FromSchema<(typeof businessSchemas)['workbench.watch']['result']>;
  'provider.configure': FromSchema<(typeof businessSchemas)['provider.configure']['result']>;
  'project.open': FromSchema<(typeof businessSchemas)['project.open']['result']>;
  'project.grant': FromSchema<(typeof businessSchemas)['project.grant']['result']>;
  'files.list': FromSchema<(typeof businessSchemas)['files.list']['result']>;
  'files.read': FromSchema<(typeof businessSchemas)['files.read']['result']>;
  'files.save': FromSchema<(typeof businessSchemas)['files.save']['result']>;
  'files.history': FromSchema<(typeof businessSchemas)['files.history']['result']>;
  'files.undo': FromSchema<(typeof businessSchemas)['files.undo']['result']>;
  'project.backup': FromSchema<(typeof businessSchemas)['project.backup']['result']>;
  'project.backups': FromSchema<(typeof businessSchemas)['project.backups']['result']>;
  'project.restore': FromSchema<(typeof businessSchemas)['project.restore']['result']>;
  'session.create': FromSchema<(typeof businessSchemas)['session.create']['result']>;
  'session.send': FromSchema<(typeof businessSchemas)['session.send']['result']>;
  'session.cancel': FromSchema<(typeof businessSchemas)['session.cancel']['result']>;
  'session.resume': FromSchema<(typeof businessSchemas)['session.resume']['result']>;
};
export type BusinessParams<M extends BusinessMethod> = Inputs[M];
export type BusinessResult<M extends BusinessMethod> = Outputs[M];
const ajv = new Ajv();
const validators = new Map(
  Object.entries(businessSchemas).map(([name, schemas]) => [
    name,
    { params: ajv.compile(schemas.params), result: ajv.compile(schemas.result) },
  ]),
);
export const isBusinessMethod = (method: string): method is BusinessMethod =>
  validators.has(method);
export const validateBusiness = (
  method: BusinessMethod,
  kind: 'params' | 'result',
  value: unknown,
): boolean => validators.get(method)?.[kind](value) === true;
export const isWorkbenchChange = ajv.compile<WorkbenchChange>(changeSchema);
export const businessLimits = {
  fileBytes: 262144,
  readBytes: 16384,
  history: 20,
  messages: 50,
} as const;
