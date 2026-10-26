import type { FromSchema } from 'json-schema-to-ts';
import { errorInfoSchema } from './core.js';
import { modelProfileSchema, runModelConfigSchema } from './models.js';
import {
  resourceEvidenceSchema,
  resourceRefSchema,
  resourceSaveResultSchema,
} from './resources.js';
import { array, count, flag, id, object, ok, page, session } from './schema.js';

const prose = { type: 'string', maxLength: 32768 } as const;
const delegationId = { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,128}$' } as const;
export const delegationToolSchema = {
  enum: [
    'resource.read',
    'resource.describe',
    'resource.document',
    'resource.create',
    'resource.save',
    'resource.creation',
    'scratch',
  ],
} as const;
const tools = { ...array(delegationToolSchema), maxItems: 7, uniqueItems: true } as const;
const materials = { ...array(resourceEvidenceSchema), maxItems: 32 } as const;
export const delegationRoleSchema = object(
  {
    id,
    version: id,
    guidance: prose,
    tools,
    modelProfileId: id,
  },
  ['id', 'version', 'guidance', 'tools'],
);
export const delegationOutputSchema = {
  anyOf: [
    object({ kind: { const: 'create' }, path: id }, ['kind', 'path']),
    object({ kind: { const: 'save' }, ref: resourceRefSchema, basis: id }, [
      'kind',
      'ref',
      'basis',
    ]),
  ],
} as const;
export const delegationRequestSchema = object(
  {
    delegationId,
    roleId: id,
    roleVersion: id,
    modelProfileId: id,
    tools,
    workPackage: object(
      {
        objective: { ...prose, minLength: 1 },
        requirements: { ...prose, minLength: 1 },
        materials,
        outputs: { ...array(delegationOutputSchema), maxItems: 16 },
      },
      ['objective', 'requirements', 'materials', 'outputs'],
    ),
  },
  ['delegationId', 'roleId', 'roleVersion', 'tools', 'workPackage'],
);
export const delegationReportSchema = object(
  {
    findings: prose,
    unfinished: prose,
    blockers: prose,
    artifacts: { ...array(resourceEvidenceSchema), maxItems: 16 },
  },
  ['findings', 'unfinished', 'blockers', 'artifacts'],
);
export const delegationStateSchema = {
  enum: ['accepted', 'running', 'cancelling', 'completed', 'failed', 'cancelled', 'interrupted'],
} as const;
const savedArtifacts = { ...array(resourceSaveResultSchema), maxItems: 16 } as const;
export const delegationRecordSchema = object(
  {
    id: delegationId,
    projectId: id,
    sessionId: id,
    parentRunId: id,
    parentInstanceId: id,
    childInstanceId: id,
    request: delegationRequestSchema,
    role: delegationRoleSchema,
    parentProcessId: count,
    childProcessId: count,
    tools,
    modelConfig: runModelConfigSchema,
    modelProfile: modelProfileSchema,
    state: delegationStateSchema,
    createdAt: id,
    updatedAt: id,
    report: delegationReportSchema,
    reads: { ...array(resourceEvidenceSchema), maxItems: 64 },
    artifacts: savedArtifacts,
    creations: {
      ...array(
        object(
          {
            operationId: id,
            resourceOperationId: id,
            path: id,
            state: { enum: ['pending', 'complete', 'failed', 'unknown'] },
          },
          ['operationId', 'resourceOperationId', 'path', 'state'],
        ),
      ),
      maxItems: 16,
    },
    writes: {
      ...array(
        object(
          {
            id,
            ref: resourceRefSchema,
            basis: id,
            state: { enum: ['pending', 'complete', 'unknown'] },
          },
          ['id', 'ref', 'basis', 'state'],
        ),
      ),
      maxItems: 64,
    },
    resultState: { enum: ['available', 'partial', 'missing', 'unknown'] },
    error: errorInfoSchema,
  },
  [
    'id',
    'projectId',
    'sessionId',
    'parentRunId',
    'parentInstanceId',
    'request',
    'role',
    'tools',
    'modelConfig',
    'state',
    'createdAt',
    'updatedAt',
    'reads',
    'artifacts',
    'creations',
    'writes',
    'resultState',
  ],
);
export const delegationReferenceSchema = object({ delegationId }, ['delegationId']);
const publicReference = object({ ...session, delegationId }, [
  'projectId',
  'sessionId',
  'delegationId',
]);
const read = { effect: 'read', returns: 'result', waitMs: 5000 } as const;
export const delegationOperations = {
  'delegation.get': { params: publicReference, result: delegationRecordSchema, semantics: read },
  'delegation.list': {
    params: object({ ...session, cursor: count, limit: page }, ['projectId', 'sessionId']),
    result: object(
      {
        delegations: {
          ...array(
            object(
              {
                id: delegationId,
                parentRunId: id,
                state: delegationStateSchema,
                roleId: id,
                modelConfig: runModelConfigSchema,
                resultState: delegationRecordSchema.properties.resultState,
                updatedAt: id,
              },
              ['id', 'parentRunId', 'state', 'roleId', 'modelConfig', 'resultState', 'updatedAt'],
            ),
          ),
          maxItems: 100,
        },
        nextCursor: count,
      },
      ['delegations'],
    ),
    semantics: read,
  },
  'delegation.cancel': {
    params: publicReference,
    result: delegationRecordSchema,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;
export const delegationInternalOperations = {
  'harness.delegate': {
    params: delegationRequestSchema,
    result: delegationReferenceSchema,
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
  },
  'harness.waitDelegation': {
    params: object({ delegationId, waitMs: { type: 'integer', minimum: 0, maximum: 5000 } }, [
      'delegationId',
    ]),
    result: object({ delegation: delegationRecordSchema, timedOut: flag }, [
      'delegation',
      'timedOut',
    ]),
    semantics: { ...read, waitMs: 10000 },
  },
  'harness.reportDelegation': {
    params: delegationReportSchema,
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'harness.roles': {
    params: object({}, []),
    result: object({ roles: { ...array(delegationRoleSchema), maxItems: 100 } }, ['roles']),
    semantics: read,
  },
} as const;
export type DelegationTool = FromSchema<typeof delegationToolSchema>;
export type DelegationRole = FromSchema<typeof delegationRoleSchema>;
export type DelegationRequest = FromSchema<typeof delegationRequestSchema>;
export type DelegationRecord = FromSchema<typeof delegationRecordSchema>;
export type DelegationReport = FromSchema<typeof delegationReportSchema>;
export type DelegationInputs = {
  [M in keyof typeof delegationOperations]: FromSchema<(typeof delegationOperations)[M]['params']>;
};
export type DelegationOutputs = {
  [M in keyof typeof delegationOperations]: FromSchema<(typeof delegationOperations)[M]['result']>;
};
