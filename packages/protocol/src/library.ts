import { Ajv } from 'ajv';
import type { FromSchema } from 'json-schema-to-ts';
import { catalogSelectionOperations } from './catalog-selection.js';
import type { CallArguments } from './core.js';
import { cslMetadataSchema } from './library-metadata.js';
import { libraryRecordOperations } from './library-records.js';
import { array, count, flag, id, object, page, text } from './schema.js';

export * from './catalog-selection.js';
export {
  catalogEditorDates,
  catalogEditorFields,
  catalogEditorNumericDate,
  catalogEditorRoles,
  catalogEditorTypes,
  cslMetadataSchema,
} from './library-metadata.js';
export {
  libraryOrganizationOperations,
  type OrganizationChange,
  type OrganizationInputs,
  type OrganizationOutputs,
  type OrganizationReceipt,
  organizationLimits,
  validateOrganization,
} from './library-organization.js';
export * from './library-records.js';

export const strings = { type: 'array', items: id, maxItems: 100, uniqueItems: true } as const;

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

export const libraryBatchState = {
  enum: ['queued', 'running', 'completed', 'interrupted'],
} as const;

export const libraryError = object({ code: id, message: text }, ['code', 'message']);

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

export const libraryPage = { offset: count, limit: page } as const;

export const readingText = { type: 'string', maxLength: 16384 } as const;

export const readingIndex = {
  type: 'integer',
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
} as const;

export const materialReference = { attachmentId: id, materialVersionId: id } as const;

export const readingAuthorSchema = {
  anyOf: [
    object({ kind: { const: 'user' } }, ['kind']),
    object({ kind: { const: 'agent' }, sessionId: id }, ['kind', 'sessionId']),
  ],
} as const;

export const pdfLocationSchema = object(
  {
    pageIndex: readingIndex,
    rects: {
      type: 'array',
      maxItems: 128,
      items: object(
        {
          x: { type: 'number', minimum: 0 },
          y: { type: 'number', minimum: 0 },
          width: { type: 'number', exclusiveMinimum: 0 },
          height: { type: 'number', exclusiveMinimum: 0 },
        },
        ['x', 'y', 'width', 'height'],
      ),
    },
  },
  ['pageIndex'],
);

export const textLocationSchema = object(
  {
    kind: { const: 'text' },
    normalizationVersion: { const: 1 },
    sectionId: id,
    start: readingIndex,
    end: readingIndex,
  },
  ['kind', 'normalizationVersion', 'sectionId', 'start', 'end'],
);
export const readingLocationSchema = { anyOf: [pdfLocationSchema, textLocationSchema] } as const;

export const documentNodeSchema = object(
  {
    tag: {
      enum: [
        'text',
        'p',
        'div',
        'span',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'strong',
        'em',
        'sup',
        'sub',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'a',
        'img',
        'br',
      ],
    },
    parent: { type: 'integer', minimum: -1 },
    start: count,
    end: count,
    text: { type: 'string', maxLength: 32768 },
    href: { type: 'string', maxLength: 4096 },
    resourceId: id,
    alt: { type: 'string', maxLength: 1024 },
    anchor: id,
  },
  ['tag', 'parent', 'start', 'end'],
);
const documentSectionSchema = object({ id, title: { type: 'string', maxLength: 1024 } }, [
  'id',
  'title',
]);
const documentCursorSchema = object({ sectionIndex: count, offset: count }, [
  'sectionIndex',
  'offset',
]);
const documentWait = { effect: 'read', returns: 'result', waitMs: 35000 } as const;
export const documentSchemas = {
  'library.documentInfo': {
    semantics: documentWait,
    params: object({ ...materialReference, ...libraryPage, offset: readingIndex }, [
      'attachmentId',
      'materialVersionId',
    ]),
    result: object(
      {
        ...materialReference,
        format: { enum: ['epub', 'html'] },
        title: { type: 'string', maxLength: 1024 },
        sectionCount: count,
        sections: { type: 'array', maxItems: 100, items: documentSectionSchema },
        nextOffset: count,
      },
      ['attachmentId', 'materialVersionId', 'format', 'title', 'sectionCount', 'sections'],
    ),
  },
  'library.readDocumentSection': {
    semantics: documentWait,
    params: object(
      {
        ...materialReference,
        sectionId: id,
        offset: readingIndex,
        limit: { type: 'integer', minimum: 1, maximum: 32768 },
        anchor: id,
        textOnly: flag,
      },
      ['attachmentId', 'materialVersionId', 'sectionId'],
    ),
    result: object(
      {
        ...materialReference,
        sectionId: id,
        normalizationVersion: { const: 1 },
        offset: count,
        text: { type: 'string', maxLength: 32768 },
        length: count,
        nodes: { type: 'array', maxItems: 4096, items: documentNodeSchema },
        nextOffset: count,
      },
      [
        'attachmentId',
        'materialVersionId',
        'sectionId',
        'normalizationVersion',
        'offset',
        'text',
        'length',
        'nodes',
      ],
    ),
  },
  'library.searchDocument': {
    semantics: documentWait,
    params: object(
      {
        ...materialReference,
        query: { type: 'string', minLength: 1, maxLength: 256 },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        cursor: documentCursorSchema,
      },
      ['attachmentId', 'materialVersionId', 'query'],
    ),
    result: object(
      {
        ...materialReference,
        hits: {
          type: 'array',
          maxItems: 100,
          items: object(
            { sectionId: id, start: count, end: count, quote: { type: 'string', maxLength: 1024 } },
            ['sectionId', 'start', 'end', 'quote'],
          ),
        },
        complete: flag,
        nextCursor: documentCursorSchema,
      },
      ['attachmentId', 'materialVersionId', 'hits', 'complete'],
    ),
  },
  'library.readDocumentResource': {
    semantics: documentWait,
    params: object({ ...materialReference, sectionId: id, resourceId: id, offset: readingIndex }, [
      'attachmentId',
      'materialVersionId',
      'sectionId',
      'resourceId',
    ]),
    result: object(
      {
        ...materialReference,
        mimeType: { enum: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] },
        byteLength: count,
        offset: count,
        base64: { type: 'string', maxLength: 349528 },
        nextOffset: count,
      },
      ['attachmentId', 'materialVersionId', 'mimeType', 'byteLength', 'offset', 'base64'],
    ),
  },
} as const;

export const readingFields = {
  ...materialReference,
  kind: { enum: ['bookmark', 'highlight', 'note'] },
  location: readingLocationSchema,
  quote: readingText,
  body: readingText,
} as const;

export const readingRecordSchema = object(
  {
    ...readingFields,
    id,
    sourceId: id,
    createdBy: readingAuthorSchema,
    updatedBy: readingAuthorSchema,
    createdAt: text,
    updatedAt: text,
    revision: count,
    deleted: flag,
  },
  [
    'id',
    'sourceId',
    'attachmentId',
    'materialVersionId',
    'kind',
    'quote',
    'body',
    'createdBy',
    'updatedBy',
    'createdAt',
    'updatedAt',
    'revision',
    'deleted',
  ],
);

export const saveReadingRecordSchema = object(
  { ...readingFields, recordId: id, expectedRevision: readingIndex },
  ['recordId', 'attachmentId', 'materialVersionId', 'kind', 'quote', 'body'],
);

export const readingSchemas = {
  ...documentSchemas,
  'library.pdfInfo': {
    semantics: { effect: 'read', returns: 'result', waitMs: 35000 },
    params: object(materialReference, ['attachmentId', 'materialVersionId']),
    result: object({ ...materialReference, pageCount: count }, [
      'attachmentId',
      'materialVersionId',
      'pageCount',
    ]),
  },
  'library.readPdfPage': {
    semantics: { effect: 'read', returns: 'result', waitMs: 35000 },
    params: object(
      {
        ...materialReference,
        pageIndex: readingIndex,
        offset: readingIndex,
        limit: { type: 'integer', minimum: 1, maximum: 32768 },
      },
      ['attachmentId', 'materialVersionId', 'pageIndex'],
    ),
    result: object(
      {
        ...materialReference,
        pageIndex: count,
        width: { type: 'number', exclusiveMinimum: 0 },
        height: { type: 'number', exclusiveMinimum: 0 },
        offset: count,
        text: { type: 'string', maxLength: 32768 },
        nextOffset: count,
        hasText: flag,
      },
      [
        'attachmentId',
        'materialVersionId',
        'pageIndex',
        'width',
        'height',
        'offset',
        'text',
        'hasText',
      ],
    ),
  },
  'library.readingRecords': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...materialReference, ...libraryPage, offset: readingIndex }, [
      'attachmentId',
      'materialVersionId',
    ]),
    result: object({ records: array(readingRecordSchema), nextOffset: count }, ['records']),
  },
  'library.readingRecord': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ recordId: id }, ['recordId']),
    result: readingRecordSchema,
  },
  'library.readingHistory': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ recordId: id, ...libraryPage, offset: readingIndex }, ['recordId']),
    result: object({ records: array(readingRecordSchema), nextOffset: count }, ['records']),
  },
  'library.saveReadingRecord': {
    semantics: {
      effect: 'write',
      returns: 'result',
      waitMs: 5000,
      conditionalWait: { parameter: 'location', waitMs: 35000 },
    },
    params: saveReadingRecordSchema,
    result: readingRecordSchema,
  },
  'library.removeReadingRecord': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ recordId: id, expectedRevision: readingIndex }, [
      'recordId',
      'expectedRevision',
    ]),
    result: readingRecordSchema,
  },
} as const;

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

export const fileImportOptions = {
  batchId: id,
  sourceId: id,
  purpose: id,
  storage: { enum: ['managed', 'linked'] },
  version: id,
  origin: id,
  collectionIds: strings,
} as const;

export const filePaths = {
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

export const librarySchemas = {
  ...libraryRecordOperations,
  'library.attachment': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ attachmentId: id }, ['attachmentId']),
    result: libraryAttachmentSchema,
  },
  ...readingSchemas,
  'library.importFiles': {
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
    params: libraryImportFilesSchema,
    result: libraryBatchSchema,
  },
  'library.importProjectFiles': {
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
    params: libraryImportProjectFilesSchema,
    result: libraryBatchSchema,
  },
  'library.attachments': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...libraryPage, sourceId: id }, ['sourceId']),
    result: object({ attachments: array(libraryAttachmentSchema), nextOffset: count }, [
      'attachments',
    ]),
  },
  'library.readAttachment': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
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
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ attachmentId: id, path: { type: 'string', minLength: 1, maxLength: 4096 } }, [
      'attachmentId',
      'path',
    ]),
    result: libraryAttachmentSchema,
  },
  'library.status': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({}, []),
    result: libraryStatusSchema,
  },
  'library.grant': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ read: flag, write: flag, send: flag, autoBackup: flag }, [
      'read',
      'write',
      'send',
      'autoBackup',
    ]),
    result: libraryStatusSchema,
  },
  'library.list': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...libraryPage, query: text, collectionId: id, tag: id }, []),
    result: object({ sources: array(librarySourceSchema), nextOffset: count }, ['sources']),
  },
  'library.get': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ sourceId: id }, ['sourceId']),
    result: librarySourceSchema,
  },
  'library.ingest': {
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
    params: libraryIngestSchema,
    result: libraryBatchSchema,
  },
  'library.batch': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...libraryPage, batchId: id }, ['batchId']),
    result: object(
      { batch: libraryBatchSchema, entries: array(libraryEntrySchema), nextOffset: count },
      ['batch', 'entries'],
    ),
  },
  'library.batches': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(libraryPage, []),
    result: object({ batches: array(libraryBatchSchema), nextOffset: count }, ['batches']),
  },
  'library.resume': {
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
    params: object({ batchId: id }, ['batchId']),
    result: libraryBatchSchema,
  },
  'library.update': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
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
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...libraryPage, parentId: { anyOf: [id, { type: 'null' }] } }, []),
    result: object({ collections: array(libraryCollectionSchema), nextOffset: count }, [
      'collections',
    ]),
  },
  'library.saveCollection': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ id, name: id, parentId: id }, ['name']),
    result: libraryCollectionSchema,
  },
  'library.history': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...libraryPage, sourceId: id }, ['sourceId']),
    result: object({ sources: array(librarySourceSchema), nextOffset: count }, ['sources']),
  },
  'library.backup': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({}, []),
    result: libraryBackupSchema,
  },
  'library.backups': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({}, []),
    result: array(libraryBackupSchema),
  },
  'library.restore': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
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
export type ReadingAuthor = FromSchema<typeof readingAuthorSchema>;
export type ReadingLocation = FromSchema<typeof readingLocationSchema>;
export type TextLocation = FromSchema<typeof textLocationSchema>;
export type DocumentNode = FromSchema<typeof documentNodeSchema>;
export type DocumentInputs = {
  'library.documentInfo': FromSchema<(typeof documentSchemas)['library.documentInfo']['params']>;
  'library.readDocumentSection': FromSchema<
    (typeof documentSchemas)['library.readDocumentSection']['params']
  >;
  'library.searchDocument': FromSchema<
    (typeof documentSchemas)['library.searchDocument']['params']
  >;
  'library.readDocumentResource': FromSchema<
    (typeof documentSchemas)['library.readDocumentResource']['params']
  >;
};
export type DocumentOutputs = {
  'library.documentInfo': FromSchema<(typeof documentSchemas)['library.documentInfo']['result']>;
  'library.readDocumentSection': FromSchema<
    (typeof documentSchemas)['library.readDocumentSection']['result']
  >;
  'library.searchDocument': FromSchema<
    (typeof documentSchemas)['library.searchDocument']['result']
  >;
  'library.readDocumentResource': FromSchema<
    (typeof documentSchemas)['library.readDocumentResource']['result']
  >;
};
export type ReadingRecord = FromSchema<typeof readingRecordSchema>;
export type PdfInfo = FromSchema<(typeof readingSchemas)['library.pdfInfo']['result']>;
export type PdfPageText = FromSchema<(typeof readingSchemas)['library.readPdfPage']['result']>;
const ajv = new Ajv();
export const isCslMetadata = ajv.compile<CslMetadata>(cslMetadataSchema);
export { librarySchemas as libraryOperations };
export type LibraryInputs = {
  [M in keyof typeof librarySchemas]: FromSchema<(typeof librarySchemas)[M]['params']>;
};
export type LibraryOutputs = {
  [M in keyof typeof librarySchemas]: FromSchema<(typeof librarySchemas)[M]['result']>;
};
const operationValidators = new Map(
  Object.entries(librarySchemas).map(([method, schema]) => [
    method,
    {
      params: ajv.compile(schema.params),
      result: ajv.compile(schema.result),
    },
  ]),
);
export const validateLibrary = (
  method: keyof typeof librarySchemas,
  kind: 'params' | 'result',
  value: unknown,
): boolean => operationValidators.get(method)?.[kind](value) === true;

export const libraryModuleOperations = {
  ...catalogSelectionOperations,
  'library.check': {
    params: object({ access: { enum: ['read', 'write', 'send'] } }, ['access']),
    result: object({ ok: { const: true } }, ['ok']),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;
export type LibraryModuleInputs = {
  'library.check': FromSchema<(typeof libraryModuleOperations)['library.check']['params']>;
  'library.selection': FromSchema<(typeof libraryModuleOperations)['library.selection']['params']>;
  'library.checkSelection': FromSchema<
    (typeof libraryModuleOperations)['library.checkSelection']['params']
  >;
};
export type LibraryModuleOutputs = {
  'library.check': FromSchema<(typeof libraryModuleOperations)['library.check']['result']>;
  'library.selection': FromSchema<(typeof libraryModuleOperations)['library.selection']['result']>;
  'library.checkSelection': FromSchema<
    (typeof libraryModuleOperations)['library.checkSelection']['result']
  >;
};
export const libraryToolMethods = [
  'library.list',
  'library.get',
  'library.ingest',
  'library.batch',
  'library.batches',
  'library.resume',
  'library.update',
  'library.collections',
  'library.saveCollection',
  'library.history',
  'library.attachments',
  'library.readAttachment',
  'library.pdfInfo',
  'library.readPdfPage',
  'library.documentInfo',
  'library.readDocumentSection',
  'library.searchDocument',
  'library.readDocumentResource',
  'library.importProjectFiles',
  'library.readingRecords',
  'library.readingRecord',
  'library.readingHistory',
  'library.saveReadingRecord',
  'library.removeReadingRecord',
] as const;
type LibraryToolMethod = (typeof libraryToolMethods)[number];
type LibraryToolInputs = Pick<LibraryInputs, LibraryToolMethod> & LibraryModuleInputs;
type LibraryToolOutputs = Pick<LibraryOutputs, LibraryToolMethod> & LibraryModuleOutputs;
export type LibraryToolPort = {
  call: <A extends CallArguments<LibraryToolInputs>>(
    ...args: A
  ) => Promise<LibraryToolOutputs[A[0]]>;
};
export const isLibraryToolCall = (
  args: readonly [string, unknown],
): args is CallArguments<Pick<LibraryInputs, LibraryToolMethod>> =>
  libraryToolMethods.some((method) => method === args[0]) &&
  operationValidators.get(args[0])?.params(args[1]) === true;
