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
  {
    id,
    projectId: id,
    title: text,
    updatedAt: text,
    state: runStateSchema,
    archived: flag,
    titleSource: { enum: ['default', 'instruction', 'manual'] },
  },
  ['id', 'projectId', 'title', 'updatedAt', 'state'],
);
const sessionCursor = object({ updatedAt: text, id }, ['updatedAt', 'id']);
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
const scope = {
  projectId: id,
  sessionId: id,
  before: id,
  limit: page,
  includeSessions: flag,
} as const;
export const snapshotSchema = object(
  {
    revision: count,
    provider: providerSchema,
    projects: array(projectSchema),
    sessions: array(sessionSchema),
    session: sessionSchema,
    messages: array(messageSchema),
    run: runSchema,
    artifacts: array(artifactSchema),
    nextBefore: id,
    fileRevision: count,
  },
  ['revision', 'provider', 'projects', 'sessions', 'messages', 'artifacts'],
);
export const changeSchema = object(
  {
    revision: count,
    projectId: id,
    sessionId: id,
    resync: flag,
    sessionsChanged: flag,
    libraryChanged: flag,
  },
  ['revision', 'resync'],
);
const ok = object({ ok: { const: true } }, ['ok']);
const project = { projectId: id } as const;
const session = { projectId: id, sessionId: id } as const;

export const cslMetadataSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 4096 },
    type: { type: 'string', minLength: 1, maxLength: 200 },
    DOI: { type: 'string', maxLength: 1024 },
    URL: { type: 'string', maxLength: 4096 },
    abstract: { type: 'string', maxLength: 32768 },
  },
  required: ['title'],
  additionalProperties: true,
} as const;
const strings = { type: 'array', items: id, maxItems: 100, uniqueItems: true } as const;
export const librarySourceSchema = object(
  {
    id,
    metadata: cslMetadataSchema,
    version: id,
    revision: count,
    tags: strings,
    collectionIds: strings,
    relatedIds: strings,
    origins: strings,
    createdAt: text,
    updatedAt: text,
    metadataOrigin: { enum: ['provided', 'filename'] },
    attachmentState: { enum: ['unavailable', 'recorded'] },
    analysisState: { const: 'notGenerated' },
  },
  [
    'id',
    'metadata',
    'version',
    'revision',
    'tags',
    'collectionIds',
    'relatedIds',
    'origins',
    'createdAt',
    'updatedAt',
    'attachmentState',
    'metadataOrigin',
    'analysisState',
  ],
);
export const libraryCollectionSchema = object({ id, name: id, parentId: id }, ['id', 'name']);
export const libraryStatusSchema = object(
  { id, read: flag, write: flag, send: flag, autoBackup: flag, revision: count },
  ['id', 'read', 'write', 'send', 'autoBackup', 'revision'],
);
const libraryBatchState = { enum: ['queued', 'running', 'completed', 'interrupted'] } as const;
const libraryError = object({ code: id, message: text }, ['code', 'message']);
export const libraryBatchSchema = object(
  {
    id,
    kind: { enum: ['metadata', 'files'] },
    state: libraryBatchState,
    total: count,
    processed: count,
    failed: count,
    origin: id,
    version: id,
    createdAt: text,
    error: libraryError,
  },
  ['id', 'kind', 'state', 'total', 'processed', 'failed', 'origin', 'version', 'createdAt'],
);
export const libraryEntrySchema = object(
  {
    index: count,
    state: { enum: ['pending', 'created', 'reused', 'failed'] },
    sourceId: id,
    attachmentId: id,
    conflicts: array(text),
    error: libraryError,
    candidate: { type: 'object', additionalProperties: true },
  },
  ['index', 'state', 'conflicts'],
);
export const libraryBackupSchema = object(
  {
    id,
    createdAt: text,
    scope: { enum: ['catalog-database', 'catalog-and-managed-files'] },
    exclusions: array(object({ attachmentId: id, reason: text }, ['attachmentId', 'reason'])),
  },
  ['id', 'createdAt', 'scope'],
);
export const libraryIngestSchema = object(
  {
    batchId: id,
    json: { type: 'string', minLength: 1, maxLength: 262144 },
    version: id,
    origin: id,
    collectionIds: strings,
  },
  ['batchId', 'json', 'version', 'origin'],
);
const libraryPage = { offset: count, limit: page } as const;
export const libraryAttachmentSchema = object(
  {
    id,
    sourceId: id,
    materialVersionId: id,
    name: text,
    purpose: id,
    storage: { enum: ['managed', 'linked'] },
    byteLength: count,
    createdAt: text,
    state: { enum: ['available', 'missing', 'changed', 'unavailable'] },
    error: libraryError,
  },
  [
    'id',
    'sourceId',
    'materialVersionId',
    'name',
    'purpose',
    'storage',
    'byteLength',
    'createdAt',
    'state',
  ],
);
const fileImportOptions = {
  batchId: id,
  sourceId: id,
  purpose: id,
  storage: { enum: ['managed', 'linked'] },
  version: id,
  origin: id,
  collectionIds: strings,
} as const;
const filePaths = {
  type: 'array',
  items: { type: 'string', minLength: 1, maxLength: 4096 },
  minItems: 1,
  maxItems: 100,
} as const;
export const libraryImportFilesSchema = object({ ...fileImportOptions, paths: filePaths }, [
  'batchId',
  'paths',
  'purpose',
  'version',
  'origin',
]);
export const libraryImportProjectFilesSchema = object(
  { ...fileImportOptions, projectId: id, projectPaths: filePaths },
  ['batchId', 'projectId', 'projectPaths', 'purpose', 'version', 'origin'],
);
const librarySchemas = {
  'library.importFiles': { params: libraryImportFilesSchema, result: libraryBatchSchema },
  'library.importProjectFiles': {
    params: libraryImportProjectFilesSchema,
    result: libraryBatchSchema,
  },
  'library.attachments': {
    params: object({ ...libraryPage, sourceId: id }, ['sourceId']),
    result: object({ attachments: array(libraryAttachmentSchema), nextOffset: count }, [
      'attachments',
    ]),
  },
  'library.readAttachment': {
    params: object(
      { attachmentId: id, offset: count, limit: { type: 'integer', minimum: 1, maximum: 262144 } },
      ['attachmentId'],
    ),
    result: object(
      {
        attachmentId: id,
        materialVersionId: id,
        byteLength: count,
        offset: count,
        base64: { type: 'string', maxLength: 349528 },
        nextOffset: count,
      },
      ['attachmentId', 'materialVersionId', 'byteLength', 'offset', 'base64'],
    ),
  },
  'library.relocateAttachment': {
    params: object({ attachmentId: id, path: { type: 'string', minLength: 1, maxLength: 4096 } }, [
      'attachmentId',
      'path',
    ]),
    result: libraryAttachmentSchema,
  },
  'library.status': { params: object({}, []), result: libraryStatusSchema },
  'library.grant': {
    params: object({ read: flag, write: flag, send: flag, autoBackup: flag }, [
      'read',
      'write',
      'send',
      'autoBackup',
    ]),
    result: libraryStatusSchema,
  },
  'library.list': {
    params: object({ ...libraryPage, query: text, collectionId: id, tag: id }, []),
    result: object({ sources: array(librarySourceSchema), nextOffset: count }, ['sources']),
  },
  'library.get': { params: object({ sourceId: id }, ['sourceId']), result: librarySourceSchema },
  'library.ingest': { params: libraryIngestSchema, result: libraryBatchSchema },
  'library.batch': {
    params: object({ ...libraryPage, batchId: id }, ['batchId']),
    result: object(
      { batch: libraryBatchSchema, entries: array(libraryEntrySchema), nextOffset: count },
      ['batch', 'entries'],
    ),
  },
  'library.batches': {
    params: object(libraryPage, []),
    result: object({ batches: array(libraryBatchSchema), nextOffset: count }, ['batches']),
  },
  'library.resume': { params: object({ batchId: id }, ['batchId']), result: libraryBatchSchema },
  'library.update': {
    params: object(
      {
        sourceId: id,
        revision: count,
        metadata: cslMetadataSchema,
        tags: strings,
        collectionIds: strings,
        relatedIds: strings,
      },
      ['sourceId', 'revision', 'metadata', 'tags', 'collectionIds', 'relatedIds'],
    ),
    result: librarySourceSchema,
  },
  'library.collections': {
    params: object(libraryPage, []),
    result: object({ collections: array(libraryCollectionSchema), nextOffset: count }, [
      'collections',
    ]),
  },
  'library.saveCollection': {
    params: object({ id, name: id, parentId: id }, ['name']),
    result: libraryCollectionSchema,
  },
  'library.history': {
    params: object({ ...libraryPage, sourceId: id }, ['sourceId']),
    result: object({ sources: array(librarySourceSchema), nextOffset: count }, ['sources']),
  },
  'library.backup': { params: object({}, []), result: libraryBackupSchema },
  'library.backups': { params: object({}, []), result: array(libraryBackupSchema) },
  'library.restore': {
    params: object({ backupId: id, destination: id }, ['backupId', 'destination']),
    result: object({ directory: id }, ['directory']),
  },
} as const;
export type LibrarySource = FromSchema<typeof librarySourceSchema>;
export type CslMetadata = FromSchema<typeof cslMetadataSchema>;
export type LibraryStatus = FromSchema<typeof libraryStatusSchema>;
export type LibraryCollection = FromSchema<typeof libraryCollectionSchema>;
export type LibraryBatch = FromSchema<typeof libraryBatchSchema>;
export type LibraryEntry = FromSchema<typeof libraryEntrySchema>;
export type LibraryBackup = FromSchema<typeof libraryBackupSchema>;
export type LibraryAttachment = FromSchema<typeof libraryAttachmentSchema>;

export const researchInputSchema = object(
  {
    materialPaths: { type: 'array', items: id, minItems: 1, maxItems: 10, uniqueItems: true },
    outputPath: id,
    goal: { type: 'string', minLength: 1, maxLength: 4096 },
  },
  ['materialPaths', 'outputPath', 'goal'],
);
export const researchMethodSchema = object(
  {
    formatVersion: { const: 1 },
    id,
    version: id,
    name: id,
    description: text,
    scope: { const: 'builtin' },
    source: id,
    inputSchema: { const: 'project-material-analysis' },
    execution: { const: 'agent' },
    resources: { type: 'array', items: { enum: ['read', 'write', 'send'] }, uniqueItems: true },
    artifactRole: { const: 'report' },
  },
  [
    'formatVersion',
    'id',
    'version',
    'name',
    'description',
    'scope',
    'source',
    'inputSchema',
    'execution',
    'resources',
    'artifactRole',
  ],
);
export const researchRequestSchema = object(
  { methodId: id, version: id, input: researchInputSchema, invocationId: id },
  ['methodId', 'version', 'input'],
);
const researchFile = object({ path: id, fileId: id }, ['path', 'fileId']);
export const researchAttemptSchema = object(
  {
    id,
    invocationId: id,
    attempt: count,
    sessionId: id,
    runId: id,
    method: researchMethodSchema,
    input: researchInputSchema,
    state: { enum: ['running', 'completed', 'failed', 'cancelled', 'interrupted'] },
    sources: array(researchFile),
    used: array(researchFile),
    artifacts: array(researchFile),
    reportFileId: id,
    delivery: { enum: ['pending', 'usable', 'incomplete'] },
    issues: array(text),
    researchAssessment: { const: 'notAssessed' },
    createdAt: text,
    finishedAt: text,
  },
  [
    'id',
    'invocationId',
    'attempt',
    'sessionId',
    'runId',
    'method',
    'input',
    'state',
    'sources',
    'used',
    'artifacts',
    'delivery',
    'issues',
    'researchAssessment',
    'createdAt',
  ],
);
export type ResearchInput = FromSchema<typeof researchInputSchema>;
export type ResearchMethod = FromSchema<typeof researchMethodSchema>;
export type ResearchRequest = FromSchema<typeof researchRequestSchema>;
export type ResearchAttempt = FromSchema<typeof researchAttemptSchema>;

export const businessSchemas = {
  ...librarySchemas,
  'research.methods': { params: object({}, []), result: array(researchMethodSchema) },
  'research.method': {
    params: object({ methodId: id, version: id }, ['methodId', 'version']),
    result: object({ method: researchMethodSchema, content }, ['method', 'content']),
  },
  'research.attempts': {
    params: object({ ...session, invocationId: id, offset: count, limit: page }, [
      'projectId',
      'sessionId',
    ]),
    result: object({ attempts: array(researchAttemptSchema), nextOffset: count }, ['attempts']),
  },
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
  'session.list': {
    params: object(
      {
        ...project,
        archived: flag,
        query: { type: 'string', maxLength: 200 },
        cursor: sessionCursor,
        limit: page,
      },
      ['projectId'],
    ),
    result: object({ sessions: array(sessionSchema), nextCursor: sessionCursor }, ['sessions']),
  },
  'session.rename': {
    params: object({ ...session, title: { type: 'string', minLength: 1, maxLength: 200 } }, [
      'projectId',
      'sessionId',
      'title',
    ]),
    result: sessionSchema,
  },
  'session.archive': {
    params: object({ ...session, archived: flag }, ['projectId', 'sessionId', 'archived']),
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
  'library.importFiles': FromSchema<(typeof librarySchemas)['library.importFiles']['params']>;
  'library.importProjectFiles': FromSchema<
    (typeof librarySchemas)['library.importProjectFiles']['params']
  >;
  'library.attachments': FromSchema<(typeof librarySchemas)['library.attachments']['params']>;
  'library.readAttachment': FromSchema<(typeof librarySchemas)['library.readAttachment']['params']>;
  'library.relocateAttachment': FromSchema<
    (typeof librarySchemas)['library.relocateAttachment']['params']
  >;
  'library.status': FromSchema<(typeof librarySchemas)['library.status']['params']>;
  'library.grant': FromSchema<(typeof librarySchemas)['library.grant']['params']>;
  'library.list': FromSchema<(typeof librarySchemas)['library.list']['params']>;
  'library.get': FromSchema<(typeof librarySchemas)['library.get']['params']>;
  'library.ingest': FromSchema<(typeof librarySchemas)['library.ingest']['params']>;
  'library.batch': FromSchema<(typeof librarySchemas)['library.batch']['params']>;
  'library.batches': FromSchema<(typeof librarySchemas)['library.batches']['params']>;
  'library.resume': FromSchema<(typeof librarySchemas)['library.resume']['params']>;
  'library.update': FromSchema<(typeof librarySchemas)['library.update']['params']>;
  'library.collections': FromSchema<(typeof librarySchemas)['library.collections']['params']>;
  'library.saveCollection': FromSchema<(typeof librarySchemas)['library.saveCollection']['params']>;
  'library.history': FromSchema<(typeof librarySchemas)['library.history']['params']>;
  'library.backup': FromSchema<(typeof librarySchemas)['library.backup']['params']>;
  'library.backups': FromSchema<(typeof librarySchemas)['library.backups']['params']>;
  'library.restore': FromSchema<(typeof librarySchemas)['library.restore']['params']>;
  'research.methods': FromSchema<(typeof businessSchemas)['research.methods']['params']>;
  'research.method': FromSchema<(typeof businessSchemas)['research.method']['params']>;
  'research.attempts': FromSchema<(typeof businessSchemas)['research.attempts']['params']>;
  'session.list': FromSchema<(typeof businessSchemas)['session.list']['params']>;
  'session.rename': FromSchema<(typeof businessSchemas)['session.rename']['params']>;
  'session.archive': FromSchema<(typeof businessSchemas)['session.archive']['params']>;
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
  'library.importFiles': FromSchema<(typeof librarySchemas)['library.importFiles']['result']>;
  'library.importProjectFiles': FromSchema<
    (typeof librarySchemas)['library.importProjectFiles']['result']
  >;
  'library.attachments': FromSchema<(typeof librarySchemas)['library.attachments']['result']>;
  'library.readAttachment': FromSchema<(typeof librarySchemas)['library.readAttachment']['result']>;
  'library.relocateAttachment': FromSchema<
    (typeof librarySchemas)['library.relocateAttachment']['result']
  >;
  'library.status': FromSchema<(typeof librarySchemas)['library.status']['result']>;
  'library.grant': FromSchema<(typeof librarySchemas)['library.grant']['result']>;
  'library.list': FromSchema<(typeof librarySchemas)['library.list']['result']>;
  'library.get': FromSchema<(typeof librarySchemas)['library.get']['result']>;
  'library.ingest': FromSchema<(typeof librarySchemas)['library.ingest']['result']>;
  'library.batch': FromSchema<(typeof librarySchemas)['library.batch']['result']>;
  'library.batches': FromSchema<(typeof librarySchemas)['library.batches']['result']>;
  'library.resume': FromSchema<(typeof librarySchemas)['library.resume']['result']>;
  'library.update': FromSchema<(typeof librarySchemas)['library.update']['result']>;
  'library.collections': FromSchema<(typeof librarySchemas)['library.collections']['result']>;
  'library.saveCollection': FromSchema<(typeof librarySchemas)['library.saveCollection']['result']>;
  'library.history': FromSchema<(typeof librarySchemas)['library.history']['result']>;
  'library.backup': FromSchema<(typeof librarySchemas)['library.backup']['result']>;
  'library.backups': FromSchema<(typeof librarySchemas)['library.backups']['result']>;
  'library.restore': FromSchema<(typeof librarySchemas)['library.restore']['result']>;
  'research.methods': FromSchema<(typeof businessSchemas)['research.methods']['result']>;
  'research.method': FromSchema<(typeof businessSchemas)['research.method']['result']>;
  'research.attempts': FromSchema<(typeof businessSchemas)['research.attempts']['result']>;
  'session.list': FromSchema<(typeof businessSchemas)['session.list']['result']>;
  'session.rename': FromSchema<(typeof businessSchemas)['session.rename']['result']>;
  'session.archive': FromSchema<(typeof businessSchemas)['session.archive']['result']>;
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
export const isCslMetadata = ajv.compile<CslMetadata>(cslMetadataSchema);
export const isResearchMethod = ajv.compile<ResearchMethod>(researchMethodSchema);
export const isResearchRequest = ajv.compile<ResearchRequest>(researchRequestSchema);
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
