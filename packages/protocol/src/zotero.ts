import type { FromSchema } from 'json-schema-to-ts';
import { type CallArguments, OperationError } from './core.js';
import { cslMetadataSchema } from './library-metadata.js';
import { libraryRecordOperations, originalRecordSchema } from './library-records.js';
import { count, id, object } from './schema.js';

const selected = object({ sourceId: id, revision: count }, ['sourceId', 'revision']);
const scope = {
  libraryId: id,
  sources: { type: 'array', minItems: 1, maxItems: 100, items: selected },
} as const;
const receipt = libraryRecordOperations['library.commitRecords'].result;
const identity = originalRecordSchema.properties.identity;
const expression = object({ kind: { const: 'zotero-original' }, identity }, ['kind', 'identity']);
const inspection = object(
  {
    sourceId: id,
    revision: count,
    csl: cslMetadataSchema,
    original: originalRecordSchema,
    citationKey: libraryRecordOperations['library.record'].result.properties.citationKey,
    comparison: object(
      { title: { enum: ['equal', 'different'] }, remaining: { const: 'notComparable' } },
      ['title', 'remaining'],
    ),
  },
  ['sourceId', 'revision', 'csl', 'original', 'citationKey', 'comparison'],
);
const inspections = { type: 'array', minItems: 1, maxItems: 100, items: inspection } as const;
const exportSources = {
  type: 'array',
  minItems: 1,
  maxItems: 100,
  items: object(
    {
      sourceId: id,
      revision: count,
      citationKey: libraryRecordOperations['library.record'].result.properties.citationKey.anyOf[0],
      expression,
    },
    ['sourceId', 'revision', 'citationKey', 'expression'],
  ),
} as const;
export const zoteroOperations = {
  'zotero.inspect': {
    params: object(scope, ['libraryId', 'sources']),
    result: object({ sources: inspections }, ['sources']),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'zotero.replaceTitle': {
    params: object(
      {
        libraryId: id,
        requestId: id,
        sourceId: id,
        revision: count,
        identity,
        title: cslMetadataSchema.properties.title,
      },
      ['libraryId', 'requestId', 'sourceId', 'revision', 'identity', 'title'],
    ),
    result: object(
      { requestId: id, state: { enum: ['committed', 'rejected', 'queried'] }, receipt },
      ['requestId', 'state', 'receipt'],
    ),
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'zotero.fillKeys': {
    params: object({ ...scope, operationId: id }, ['libraryId', 'sources', 'operationId']),
    result: {
      ...object(
        {
          operationId: id,
          state: { enum: ['committed', 'rejected', 'unchanged', 'queried'] },
          receipt,
          notification: { enum: ['delivered', 'failed', 'notRun'] },
          notificationReason: { type: 'string', maxLength: 512 },
        },
        ['operationId', 'state', 'notification'],
      ),
      anyOf: [
        { properties: { state: { const: 'unchanged' }, notification: { const: 'notRun' } } },
        {
          properties: { state: { enum: ['committed', 'rejected', 'queried'] } },
          required: ['receipt'],
        },
      ],
    },
    semantics: { effect: 'write', returns: 'result', waitMs: 30000 },
  },
  'zotero.export': {
    params: object(
      {
        ...scope,
        sources: {
          ...scope.sources,
          items: object({ sourceId: id, revision: count, expression }, ['sourceId', 'revision']),
        },
        format: { enum: ['bibtex', 'biblatex'] },
      },
      ['libraryId', 'sources', 'format'],
    ),
    result: {
      anyOf: [
        object(
          {
            state: { const: 'exported' },
            format: { enum: ['bibtex', 'biblatex'] },
            text: { type: 'string', maxLength: 262144 },
            sources: exportSources,
          },
          ['state', 'format', 'text', 'sources'],
        ),
        object({ state: { const: 'selectionRequired' }, sources: inspections }, [
          'state',
          'sources',
        ]),
      ],
    },
    semantics: { effect: 'read', returns: 'result', waitMs: 30000 },
  },
  'zotero.result': libraryRecordOperations['library.commitResult'],
} as const;
export type ZoteroInputs = {
  [M in keyof typeof zoteroOperations]: FromSchema<(typeof zoteroOperations)[M]['params']>;
};
export type ZoteroOutputs = {
  [M in keyof typeof zoteroOperations]: FromSchema<(typeof zoteroOperations)[M]['result']>;
};
export type ZoteroInspection = FromSchema<typeof inspection>;
export type ZoteroPort = {
  call<A extends CallArguments<ZoteroInputs>>(...args: A): Promise<ZoteroOutputs[A[0]]>;
};

// Host projections reuse the actual library record contract; they are never another authority.
export const zoteroSnapshotSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 100,
  items: libraryRecordOperations['library.record'].result,
} as const;
export type ZoteroSnapshot = FromSchema<typeof zoteroSnapshotSchema>;
export const zoteroHostCallbacks = {
  'zotero.readCommitted': {
    params: object({}, []),
    result: zoteroSnapshotSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;

// Zotero schema 44, zotero-schema 70c3aa98627413d6a30dca955886eafbde085ce9.
// This is the bounded compatibility declaration, not a second bibliographic model.
const journalFields = [
  'title',
  'abstractNote',
  'publicationTitle',
  'publisher',
  'place',
  'date',
  'volume',
  'issue',
  'section',
  'partNumber',
  'partTitle',
  'pages',
  'series',
  'seriesTitle',
  'seriesText',
  'journalAbbreviation',
  'DOI',
  'citationKey',
  'url',
  'accessDate',
  'PMID',
  'PMCID',
  'ISSN',
  'archive',
  'archiveLocation',
  'shortTitle',
  'language',
  'libraryCatalog',
  'callNumber',
  'rights',
  'extra',
];
const journalCreators = ['author', 'contributor', 'editor', 'translator', 'reviewedAuthor'];
export function journalOriginal(record: ZoteroSnapshot[number]) {
  const original = record.originals[0];
  if (
    record.nextOffset !== undefined ||
    record.originals.length !== 1 ||
    !original ||
    original.schemaVersion !== '44' ||
    original.itemType !== 'journalArticle' ||
    Object.keys(original.relations).length ||
    Object.entries(original.fields).some(
      ([key, value]) => !journalFields.includes(key) || typeof value !== 'string',
    ) ||
    original.creators.some(
      (creator, i) =>
        !journalCreators.includes(String(creator.creatorType)) ||
        Object.entries(creator).some(([key, value]) =>
          key === 'orderIndex'
            ? value !== i
            : key === 'fieldMode'
              ? value !== 0 && value !== 1
              : !['creatorType', 'firstName', 'lastName', 'name'].includes(key) ||
                typeof value !== 'string',
        ),
    )
  ) {
    throw new OperationError('unavailable', '需要唯一且可映射的 schema 44 普通期刊原值。');
  }
  return original;
}
