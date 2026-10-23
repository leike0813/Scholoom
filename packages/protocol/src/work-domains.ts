import type { FromSchema } from 'json-schema-to-ts';
import { projectLimits, projectsOperations } from './project-contracts.js';
import { count, id, object, page } from './schema.js';

const targetProjectId = { ...id, not: { const: 'application' } } as const;
export const workDomainSchema = {
  anyOf: [
    object({ kind: { const: 'application' }, projectId: { const: 'application' }, sessionId: id }, [
      'kind',
      'projectId',
      'sessionId',
    ]),
    object({ kind: { const: 'project' }, projectId: targetProjectId, sessionId: id }, [
      'kind',
      'projectId',
      'sessionId',
    ]),
  ],
} as const;
export type WorkDomain = FromSchema<typeof workDomainSchema>;

/** Host-established target restriction; the source work domain remains unchanged. */
export const targetReadScopeSchema = object({ targetProjectId, access: { const: 'read' } }, [
  'targetProjectId',
  'access',
]);
export type TargetReadScope = FromSchema<typeof targetReadScopeSchema>;

const reference = { fileId: id, basis: id } as const;
const { resourceBasis: _resourceBasis, ...byteProperties } =
  projectsOperations['files.readBytes'].result.properties;
const byteResult = {
  properties: byteProperties,
  required: projectsOperations['files.readBytes'].result.required.filter(
    (key) => key !== 'resourceBasis',
  ),
};
const descriptor = object(
  { ...reference, path: byteResult.properties.path, size: byteResult.properties.size },
  ['fileId', 'basis', 'path', 'size'],
);
const textLimit = { type: 'integer', minimum: 1, maximum: projectLimits.fileBytes } as const;
const byteLimit = projectsOperations['files.readBytes'].params.properties.limit;

/** Internal owner port: requests contain targets, never caller identity or native paths. */
export const projectTargetReadOperations = {
  'project.readTarget': {
    params: object(
      {
        targetProjectId,
        request: {
          anyOf: [
            object({ kind: { const: 'list' }, offset: count, limit: page }, ['kind']),
            object({ kind: { const: 'describe' }, ...reference }, ['kind', 'fileId']),
            object({ kind: { const: 'readText' }, ...reference, offset: count, limit: textLimit }, [
              'kind',
              'fileId',
              'basis',
            ]),
            object(
              { kind: { const: 'readBytes' }, ...reference, offset: count, limit: byteLimit },
              ['kind', 'fileId', 'basis'],
            ),
          ],
        },
      },
      ['targetProjectId', 'request'],
    ),
    result: {
      anyOf: [
        object(
          {
            kind: { const: 'list' },
            entries: { type: 'array', items: descriptor, maxItems: 100 },
            nextOffset: count,
          },
          ['kind', 'entries'],
        ),
        object({ kind: { const: 'describe' }, ...descriptor.properties }, [
          'kind',
          ...descriptor.required,
        ]),
        object(
          {
            kind: { const: 'readText' },
            ...descriptor.properties,
            content: projectsOperations['files.read'].result.properties.content,
            offset: count,
            nextOffset: count,
          },
          ['kind', ...descriptor.required, 'content', 'offset'],
        ),
        object({ kind: { const: 'readBytes' }, ...byteResult.properties }, [
          'kind',
          ...byteResult.required,
        ]),
      ],
    },
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;
