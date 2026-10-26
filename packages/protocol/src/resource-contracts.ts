import { errorInfoSchema } from './error-contracts.js';
import { flag, id, object, text } from './schema.js';

const projectRef = object({ source: { const: 'project' }, projectId: id, fileId: id }, [
  'source',
  'projectId',
  'fileId',
]);
const libraryRef = object(
  { source: { const: 'library' }, attachmentId: id, materialVersionId: id },
  ['source', 'attachmentId', 'materialVersionId'],
);
export const resourceRefSchema = { anyOf: [projectRef, libraryRef] } as const;
export const resourceEvidenceSchema = object({ ref: resourceRefSchema, basis: id, role: id }, [
  'ref',
  'basis',
]);
export const resourceLocatorSchema = {
  anyOf: [
    object({ ...projectRef.properties, path: id }, ['source', 'projectId', 'fileId']),
    object({ ...projectRef.properties, path: id }, ['source', 'projectId', 'path']),
    libraryRef,
  ],
} as const;
export const resourceDescriptorSchema = object(
  {
    ref: resourceRefSchema,
    name: id,
    path: text,
    basis: id,
    unavailableReason: text,
    format: { enum: ['text', 'pdf', 'epub', 'html', 'unsupported'] },
    capabilities: object({ read: flag, write: flag, readingRecords: flag, render: flag }, [
      'read',
      'write',
      'readingRecords',
      'render',
    ]),
  },
  ['ref', 'name', 'basis', 'format', 'capabilities'],
);
export const resourceAssociationSchema = object(
  { operationId: id, state: { enum: ['confirmed', 'pending', 'unknown'] } },
  ['operationId', 'state'],
);
export const resourceSaveResultSchema = object(
  { resource: resourceDescriptorSchema, association: resourceAssociationSchema, editId: id },
  ['resource'],
);
const createdResource = {
  ...resourceDescriptorSchema,
  properties: { ...resourceDescriptorSchema.properties, ref: projectRef },
} as const;
export const resourceCreationResultSchema = {
  anyOf: [
    object(
      {
        operationId: id,
        state: { const: 'complete' },
        resource: createdResource,
        association: resourceAssociationSchema,
        editId: id,
      },
      ['operationId', 'state', 'resource'],
    ),
    object(
      {
        operationId: id,
        state: { enum: ['prepared', 'unknown'] },
        resource: createdResource,
        association: resourceAssociationSchema,
        error: errorInfoSchema,
      },
      ['operationId', 'state'],
    ),
    object({ operationId: id, state: { const: 'failed' }, error: errorInfoSchema }, [
      'operationId',
      'state',
      'error',
    ]),
  ],
} as const;
