import type { FromSchema, JSONSchema } from 'json-schema-to-ts';
import type { CallContext } from './core.js';
import type { LibraryInputs, LibraryOutputs } from './library.js';
import { documentSchemas, readingSchemas } from './library.js';
import type {
  ProjectExecutionInputs,
  ProjectExecutionOutputs,
  ProjectMaterialPort,
  ProjectsInputs,
  ProjectsOutputs,
  ProjectTargetReadPort,
} from './projects.js';
import {
  resourceCreationResultSchema,
  resourceDescriptorSchema,
  type resourceEvidenceSchema,
  resourceLocatorSchema,
  resourceRefSchema,
  type resourceSaveResultSchema,
} from './resource-contracts.js';
import { count, flag, id, object, ok } from './schema.js';

export * from './resource-contracts.js';
export type ResourceEvidence = FromSchema<typeof resourceEvidenceSchema>;
export type ResourceSaveResult = FromSchema<typeof resourceSaveResultSchema>;
export const resourceCreationOperations = {
  'resources.create': {
    params: object(
      { projectId: id, path: id, operationId: id, content: { type: 'string', maxLength: 262144 } },
      ['projectId', 'path', 'operationId', 'content'],
    ),
    result: resourceCreationResultSchema,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'resources.creation': {
    params: object({ projectId: id, operationId: id }, ['projectId', 'operationId']),
    result: resourceCreationResultSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;
export type ResourceCreationInputs = {
  [M in keyof typeof resourceCreationOperations]: FromSchema<
    (typeof resourceCreationOperations)[M]['params']
  >;
};
export type ResourceCreationOutputs = {
  [M in keyof typeof resourceCreationOperations]: FromSchema<
    (typeof resourceCreationOperations)[M]['result']
  >;
};

/** Reuse parser payloads without assigning library ownership to project documents. */
function payload<
  const P extends Record<string, JSONSchema>,
  const R extends readonly (keyof P & string)[],
>(schema: { properties: P; required: R }) {
  const {
    attachmentId: _attachment,
    materialVersionId: _version,
    ...properties
  } = schema.properties;
  return object(
    properties,
    schema.required.filter(
      (key) => key !== 'attachmentId' && key !== 'materialVersionId',
    ) as Exclude<R[number], 'attachmentId' | 'materialVersionId'>[],
  );
}
export const resourceDocumentContracts = {
  pdfInfo: {
    params: payload(readingSchemas['library.pdfInfo'].params),
    result: payload(readingSchemas['library.pdfInfo'].result),
  },
  readPdfPage: {
    params: payload(readingSchemas['library.readPdfPage'].params),
    result: payload(readingSchemas['library.readPdfPage'].result),
  },
  documentInfo: {
    params: payload(documentSchemas['library.documentInfo'].params),
    result: payload(documentSchemas['library.documentInfo'].result),
  },
  readDocumentSection: {
    params: payload(documentSchemas['library.readDocumentSection'].params),
    result: payload(documentSchemas['library.readDocumentSection'].result),
  },
  searchDocument: {
    params: payload(documentSchemas['library.searchDocument'].params),
    result: payload(documentSchemas['library.searchDocument'].result),
  },
  readDocumentResource: {
    params: payload(documentSchemas['library.readDocumentResource'].params),
    result: payload(documentSchemas['library.readDocumentResource'].result),
  },
} as const;
const request = <const M extends string, const S extends JSONSchema>(method: M, input: S) =>
  object({ method: { const: method }, input }, ['method', 'input']);
const readSemantics = { effect: 'read', returns: 'result', waitMs: 5000 } as const;
const access = { ref: resourceRefSchema, basis: id } as const;
export const resourceOperations = {
  'resources.cancel': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ requestId: id }, ['requestId']),
    result: ok,
  },
  'resources.describe': {
    semantics: readSemantics,
    params: object({ locator: resourceLocatorSchema }, ['locator']),
    result: resourceDescriptorSchema,
  },
  'resources.read': {
    semantics: readSemantics,
    params: object(
      {
        ...access,
        encoding: { enum: ['utf8', 'base64'] },
        offset: count,
        limit: { type: 'integer', minimum: 1, maximum: 262144 },
      },
      ['ref', 'basis', 'encoding'],
    ),
    result: object(
      {
        ...access,
        data: { type: 'string', maxLength: 349528 },
        offset: count,
        nextOffset: count,
        size: count,
        unit: { enum: ['utf16', 'byte'] },
        truncated: flag,
      },
      ['ref', 'basis', 'data', 'offset', 'size', 'unit', 'truncated'],
    ),
  },
  'resources.document': {
    semantics: { ...readSemantics, waitMs: 35000 },
    params: object(
      {
        ...access,
        requestId: id,
        request: {
          anyOf: [
            request('pdfInfo', resourceDocumentContracts.pdfInfo.params),
            request('readPdfPage', resourceDocumentContracts.readPdfPage.params),
            request('documentInfo', resourceDocumentContracts.documentInfo.params),
            request('readDocumentSection', resourceDocumentContracts.readDocumentSection.params),
            request('searchDocument', resourceDocumentContracts.searchDocument.params),
            request('readDocumentResource', resourceDocumentContracts.readDocumentResource.params),
          ],
        },
      },
      ['ref', 'basis', 'request'],
    ),
    result: {
      anyOf: [
        resourceDocumentContracts.pdfInfo.result,
        resourceDocumentContracts.readPdfPage.result,
        resourceDocumentContracts.documentInfo.result,
        resourceDocumentContracts.readDocumentSection.result,
        resourceDocumentContracts.searchDocument.result,
        resourceDocumentContracts.readDocumentResource.result,
      ],
    },
  },
  'resources.save': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...access, content: { type: 'string', maxLength: 262144 } }, [
      'ref',
      'basis',
      'content',
    ]),
    result: resourceDescriptorSchema,
  },
} as const;
export type ResourceLocator = FromSchema<typeof resourceLocatorSchema>;
export type ResourceRef = FromSchema<typeof resourceRefSchema>;
export type ResourceDescriptor = FromSchema<typeof resourceDescriptorSchema>;
export function resourceFormatForName(name: string): ResourceDescriptor['format'] {
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.epub$/i.test(name)) return 'epub';
  if (/\.html?$/i.test(name)) return 'html';
  if (/\.(png|jpe?g|gif|webp|zip|docx?|xlsx?|pptx?|exe|so|dll|wasm)$/i.test(name))
    return 'unsupported';
  return 'text';
}
export type ResourceInputs = {
  [M in keyof typeof resourceOperations]: FromSchema<(typeof resourceOperations)[M]['params']>;
};
export type ResourceOutputs = {
  [M in keyof typeof resourceOperations]: FromSchema<(typeof resourceOperations)[M]['result']>;
};
// The payload transformation is only removal of the owning library reference.
// Derive each payload before generic method selection to bound TS instantiation.
type Payload<T> = Omit<T, 'attachmentId' | 'materialVersionId'>;
export type ResourceDocumentInputs = {
  pdfInfo: Payload<LibraryInputs['library.pdfInfo']>;
  readPdfPage: Payload<LibraryInputs['library.readPdfPage']>;
  documentInfo: Payload<LibraryInputs['library.documentInfo']>;
  readDocumentSection: Payload<LibraryInputs['library.readDocumentSection']>;
  searchDocument: Payload<LibraryInputs['library.searchDocument']>;
  readDocumentResource: Payload<LibraryInputs['library.readDocumentResource']>;
};
export type ResourceDocumentOutputs = {
  pdfInfo: Payload<LibraryOutputs['library.pdfInfo']>;
  readPdfPage: Payload<LibraryOutputs['library.readPdfPage']>;
  documentInfo: Payload<LibraryOutputs['library.documentInfo']>;
  readDocumentSection: Payload<LibraryOutputs['library.readDocumentSection']>;
  searchDocument: Payload<LibraryOutputs['library.searchDocument']>;
  readDocumentResource: Payload<LibraryOutputs['library.readDocumentResource']>;
};
export interface ResourcePort {
  describe(locator: ResourceLocator): Promise<ResourceDescriptor>;
  read(input: ResourceInputs['resources.read']): Promise<ResourceOutputs['resources.read']>;
  save(input: ResourceInputs['resources.save']): Promise<ResourceDescriptor>;
  document<M extends keyof ResourceDocumentInputs>(
    resource: Pick<ResourceDescriptor, 'ref' | 'basis'>,
    method: M,
    input: ResourceDocumentInputs[M],
  ): Promise<ResourceDocumentOutputs[M]>;
}
export interface ExecutionResourcePort extends Omit<ResourcePort, 'save'> {
  create(
    input: ResourceCreationInputs['resources.create'],
  ): Promise<ResourceCreationOutputs['resources.create']>;
  creation(
    input: ResourceCreationInputs['resources.creation'],
  ): Promise<ResourceCreationOutputs['resources.creation']>;
  save(input: ResourceInputs['resources.save']): Promise<ResourceSaveResult>;
}
type ProjectMethods = 'files.resolve' | 'files.read' | 'files.readBytes';
export type ResourceProjectPort = {
  [M in ProjectMethods]: (input: ProjectsInputs[M]) => Promise<ProjectsOutputs[M]>;
} & Pick<ProjectMaterialPort, 'project.material'> & {
    'project.saveFile': (
      input: ProjectExecutionInputs['project.saveFile'],
    ) => Promise<ProjectExecutionOutputs['project.saveFile']>;
  };
export type ResourceLibraryMethod =
  | 'library.attachment'
  | 'library.status'
  | 'library.readAttachment'
  | `library.${keyof ResourceDocumentInputs}`;
export type ResourceLibraryPort = {
  [M in ResourceLibraryMethod]: (input: LibraryInputs[M]) => Promise<LibraryOutputs[M]>;
};
export type ResourcePorts = {
  project: ResourceProjectPort;
  library: ResourceLibraryPort;
  target?: ProjectTargetReadPort;
};
export type ResourcePortFactory = (context: CallContext) => ResourcePorts;
export type ReadingRecordPort = {
  [M in
    | 'library.readingRecords'
    | 'library.readingRecord'
    | 'library.readingHistory'
    | 'library.saveReadingRecord'
    | 'library.removeReadingRecord']: (input: LibraryInputs[M]) => Promise<LibraryOutputs[M]>;
};
