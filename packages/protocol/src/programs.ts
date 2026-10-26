import type { FromSchema } from 'json-schema-to-ts';
import { errorInfoSchema } from './core.js';
import { resourceAssociationSchema, resourceEvidenceSchema } from './resources.js';
import { count, flag, id, object } from './schema.js';

const read = { effect: 'read', returns: 'result', waitMs: 5000 } as const;
const write = { effect: 'write', returns: 'result', waitMs: 5000 } as const;
const reference = { ...write, returns: 'reference' } as const;
const page = { type: 'integer', minimum: 1, maximum: 100 } as const;
const evidenceList = {
  type: 'array',
  items: resourceEvidenceSchema,
  maxItems: 100,
} as const;
// The host also checks UTF-8 byte limits (4 KiB each, 64 KiB total) and project scope.
const args = {
  type: 'array',
  items: { type: 'string', maxLength: 4096 },
  maxItems: 128,
} as const;
const paths = { type: 'array', items: id, maxItems: 100, uniqueItems: true } as const;
const timeout = { type: ['integer', 'null'], minimum: 1 } as const;

export const programStateSchema = {
  enum: [
    'queued',
    'running',
    'cancelling',
    'completed',
    'failed',
    'cancelled',
    'interrupted',
    'unknown',
  ],
} as const;
export const programCommandSchema = object({ executableId: id, args, cwd: id, version: id }, [
  'executableId',
  'args',
  'cwd',
]);
export const programExitSchema = object(
  { code: { type: ['integer', 'null'] }, signal: { type: ['string', 'null'] }, reason: id },
  [],
);
export const programLogEntrySchema = object(
  {
    seq: count,
    stream: { enum: ['stdout', 'stderr'] },
    text: { type: 'string', maxLength: 16384 },
  },
  ['seq', 'stream', 'text'],
);
export const programLogMetadataSchema = object(
  { next: count, truncatedBefore: count, lastLogAt: id, error: errorInfoSchema },
  ['next', 'truncatedBefore'],
);
export const programOutputSchema = object(
  {
    declaredPath: id,
    resource: resourceEvidenceSchema,
    before: resourceEvidenceSchema,
    observedAt: id,
    presence: { enum: ['present', 'missing', 'changed', 'unreadable', 'unknown'] },
    completeness: { enum: ['unassessed', 'incomplete'] },
    attribution: { const: 'observed' },
    association: resourceAssociationSchema,
    error: errorInfoSchema,
  },
  ['declaredPath', 'presence', 'completeness', 'attribution'],
);

export const programStartSchema = object(
  {
    projectId: id,
    operationId: id,
    environmentId: id,
    cwd: id,
    entry: resourceEvidenceSchema,
    args,
    inputs: evidenceList,
    outputs: paths,
    overwrite: paths,
    timeoutMs: timeout,
    lifetime: { enum: ['execution', 'background'] },
  },
  ['projectId', 'operationId', 'environmentId', 'entry'],
);
export const programRunReferenceSchema = object({ programRunId: id, state: programStateSchema }, [
  'programRunId',
  'state',
]);
export const programEnvironmentSchema = object(
  {
    environmentId: id,
    kind: { enum: ['node', 'python', 'conda', 'uv'] },
    availability: {
      enum: [
        'unavailable',
        'needsAuthorization',
        'ready',
        'preparing',
        'cancelling',
        'cancelled',
        'failed',
        'interrupted',
        'unknown',
      ],
    },
    version: id,
    diagnostic: errorInfoSchema,
    programRunId: id,
  },
  ['environmentId', 'kind', 'availability'],
);
export const programEnvironmentPlanSchema = object(
  {
    planId: id,
    projectId: id,
    environmentId: id,
    programRunId: id,
    state: { enum: ['pending', 'ready', 'failed', 'unknown'] },
    declarations: evidenceList,
    interpreter: object({ executableId: id, version: id }, ['executableId']),
    targetId: id,
    dependencies: {
      type: 'array',
      items: object({ name: id, version: id, source: id }, ['name']),
      maxItems: 1000,
    },
    actions: { type: 'array', items: programCommandSchema, maxItems: 100 },
    network: { type: 'array', items: id, maxItems: 100, uniqueItems: true },
    installation: flag,
    build: flag,
    authorizationId: id,
    error: errorInfoSchema,
  },
  ['planId', 'projectId', 'environmentId', 'programRunId', 'state'],
);
export const programRunSchema = object(
  {
    programRunId: id,
    projectId: id,
    operationId: id,
    kind: { enum: ['program', 'environmentCheck', 'environmentPreparation'] },
    state: programStateSchema,
    phase: {
      enum: [
        'accepted',
        'environment',
        'admission',
        'starting',
        'executing',
        'stopping',
        'inspecting',
      ],
    },
    stop: { enum: ['pending', 'confirmed', 'unknown'] },
    createdAt: id,
    updatedAt: id,
    request: programStartSchema,
    environmentId: id,
    principal: object({ kind: { enum: ['human', 'agent', 'system'] }, id }, ['kind', 'id']),
    command: programCommandSchema,
    code: resourceEvidenceSchema,
    inputs: evidenceList,
    dependencyCoverage: { const: 'declaredOnly' },
    logs: programLogMetadataSchema,
    outputs: { type: 'array', items: programOutputSchema, maxItems: 100 },
    origin: object({ sessionId: id, harnessRunId: id, instanceId: id }, []),
    backgroundOwner: object(
      {
        kind: { const: 'human' },
        id,
        at: id,
        state: { enum: ['authorized', 'active', 'failed'] },
        error: errorInfoSchema,
      },
      ['kind', 'id', 'at', 'state'],
    ),
    exit: programExitSchema,
    outputAssessment: { enum: ['unassessed', 'partial', 'observed'] },
    cancelReason: id,
    error: errorInfoSchema,
  },
  [
    'programRunId',
    'projectId',
    'operationId',
    'kind',
    'state',
    'phase',
    'stop',
    'createdAt',
    'updatedAt',
  ],
);

const runIdentity = object({ projectId: id, programRunId: id }, ['projectId', 'programRunId']);
const registration = { projectId: id, operationId: id, interpreterPath: id } as const;
export const programsOperations = {
  'programs.environments': {
    params: object({ projectId: id, before: id, limit: page }, ['projectId']),
    result: object(
      {
        environments: { type: 'array', items: programEnvironmentSchema, maxItems: 100 },
        before: id,
      },
      ['environments'],
    ),
    semantics: read,
  },
  'programs.registerEnvironment': {
    params: {
      anyOf: [
        object({ ...registration, kind: { enum: ['python', 'conda'] } }, [
          'projectId',
          'operationId',
          'kind',
          'interpreterPath',
        ]),
        object({ ...registration, kind: { const: 'uv' }, uvPath: id }, [
          'projectId',
          'operationId',
          'kind',
          'interpreterPath',
          'uvPath',
        ]),
      ],
    },
    result: object({ environmentId: id, programRunId: id }, ['environmentId']),
    semantics: reference,
  },
  'programs.environmentPlan': {
    params: object(
      { projectId: id, operationId: id, environmentId: id, declarations: evidenceList },
      ['projectId', 'operationId', 'environmentId', 'declarations'],
    ),
    result: object({ planId: id, programRunId: id }, ['planId', 'programRunId']),
    semantics: reference,
  },
  'programs.environmentPlanStatus': {
    params: object({ projectId: id, planId: id }, ['projectId', 'planId']),
    result: programEnvironmentPlanSchema,
    semantics: read,
  },
  'programs.authorizeEnvironment': {
    params: object({ projectId: id, planId: id }, ['projectId', 'planId']),
    result: object({ planId: id, authorizationId: id }, ['planId', 'authorizationId']),
    semantics: write,
  },
  'programs.environmentPrepare': {
    params: object({ projectId: id, planId: id, operationId: id }, [
      'projectId',
      'planId',
      'operationId',
    ]),
    result: programRunReferenceSchema,
    semantics: reference,
  },
  'programs.start': {
    params: programStartSchema,
    result: programRunReferenceSchema,
    semantics: reference,
  },
  'programs.run': {
    params: {
      anyOf: [
        runIdentity,
        object({ projectId: id, operationId: id }, ['projectId', 'operationId']),
      ],
    },
    result: programRunSchema,
    semantics: read,
  },
  'programs.runs': {
    params: object({ projectId: id, before: id, limit: page }, ['projectId']),
    result: object(
      { runs: { type: 'array', items: programRunSchema, maxItems: 100 }, before: id },
      ['runs'],
    ),
    semantics: read,
  },
  'programs.logs': {
    params: object(
      {
        projectId: id,
        programRunId: id,
        after: count,
        limitBytes: { type: 'integer', minimum: 1, maximum: 65536 },
      },
      ['projectId', 'programRunId'],
    ),
    result: object(
      {
        ...programLogMetadataSchema.properties,
        entries: { type: 'array', items: programLogEntrySchema, maxItems: 1024 },
      },
      ['entries', ...programLogMetadataSchema.required],
    ),
    semantics: read,
  },
  'programs.cancel': {
    params: runIdentity,
    result: programRunReferenceSchema,
    semantics: reference,
  },
  'programs.handoff': {
    params: runIdentity,
    result: programRunReferenceSchema,
    semantics: reference,
  },
  'programs.reconcile': {
    params: runIdentity,
    result: programRunReferenceSchema,
    semantics: reference,
  },
} as const;

export const programCommandEventSchema = object(
  {
    programRunId: id,
    hostInstanceId: id,
    commandInstanceId: id,
    seq: count,
    event: {
      anyOf: [
        object({ kind: { const: 'intent' } }, ['kind']),
        object({ kind: { const: 'started' } }, ['kind']),
        object(
          {
            kind: { const: 'output' },
            stream: programLogEntrySchema.properties.stream,
            text: programLogEntrySchema.properties.text,
          },
          ['kind', 'stream', 'text'],
        ),
        object({ kind: { const: 'exited' }, ...programExitSchema.properties }, ['kind']),
        object({ kind: { const: 'stopped' } }, ['kind']),
        object({ kind: { const: 'unknown' }, error: errorInfoSchema }, ['kind', 'error']),
      ],
    },
  },
  ['programRunId', 'hostInstanceId', 'commandInstanceId', 'seq', 'event'],
);
export const programsInternalOperations = {
  'programs.commandEvent': {
    params: programCommandEventSchema,
    result: object({ ack: count }, ['ack']),
    semantics: write,
  },
} as const;

export type ProgramState = FromSchema<typeof programStateSchema>;
export type ProgramCommand = FromSchema<typeof programCommandSchema>;
export type ProgramExit = FromSchema<typeof programExitSchema>;
export type ProgramLogEntry = FromSchema<typeof programLogEntrySchema>;
export type ProgramLogMetadata = FromSchema<typeof programLogMetadataSchema>;
export type ProgramOutput = FromSchema<typeof programOutputSchema>;
export type ProgramEnvironment = FromSchema<typeof programEnvironmentSchema>;
export type ProgramEnvironmentPlan = FromSchema<typeof programEnvironmentPlanSchema>;
export type ProgramRun = FromSchema<typeof programRunSchema>;
export type ProgramCommandEvent = FromSchema<typeof programCommandEventSchema>;
export type ProgramsInputs = {
  'programs.environments': FromSchema<
    (typeof programsOperations)['programs.environments']['params']
  >;
  'programs.registerEnvironment': FromSchema<
    (typeof programsOperations)['programs.registerEnvironment']['params']
  >;
  'programs.environmentPlan': FromSchema<
    (typeof programsOperations)['programs.environmentPlan']['params']
  >;
  'programs.environmentPlanStatus': FromSchema<
    (typeof programsOperations)['programs.environmentPlanStatus']['params']
  >;
  'programs.authorizeEnvironment': FromSchema<
    (typeof programsOperations)['programs.authorizeEnvironment']['params']
  >;
  'programs.environmentPrepare': FromSchema<
    (typeof programsOperations)['programs.environmentPrepare']['params']
  >;
  'programs.start': FromSchema<(typeof programsOperations)['programs.start']['params']>;
  'programs.run': FromSchema<(typeof programsOperations)['programs.run']['params']>;
  'programs.runs': FromSchema<(typeof programsOperations)['programs.runs']['params']>;
  'programs.logs': FromSchema<(typeof programsOperations)['programs.logs']['params']>;
  'programs.cancel': FromSchema<(typeof programsOperations)['programs.cancel']['params']>;
  'programs.handoff': FromSchema<(typeof programsOperations)['programs.handoff']['params']>;
  'programs.reconcile': FromSchema<(typeof programsOperations)['programs.reconcile']['params']>;
};
export type ProgramsOutputs = {
  'programs.environments': FromSchema<
    (typeof programsOperations)['programs.environments']['result']
  >;
  'programs.registerEnvironment': FromSchema<
    (typeof programsOperations)['programs.registerEnvironment']['result']
  >;
  'programs.environmentPlan': FromSchema<
    (typeof programsOperations)['programs.environmentPlan']['result']
  >;
  'programs.environmentPlanStatus': FromSchema<
    (typeof programsOperations)['programs.environmentPlanStatus']['result']
  >;
  'programs.authorizeEnvironment': FromSchema<
    (typeof programsOperations)['programs.authorizeEnvironment']['result']
  >;
  'programs.environmentPrepare': FromSchema<
    (typeof programsOperations)['programs.environmentPrepare']['result']
  >;
  'programs.start': FromSchema<(typeof programsOperations)['programs.start']['result']>;
  'programs.run': FromSchema<(typeof programsOperations)['programs.run']['result']>;
  'programs.runs': FromSchema<(typeof programsOperations)['programs.runs']['result']>;
  'programs.logs': FromSchema<(typeof programsOperations)['programs.logs']['result']>;
  'programs.cancel': FromSchema<(typeof programsOperations)['programs.cancel']['result']>;
  'programs.handoff': FromSchema<(typeof programsOperations)['programs.handoff']['result']>;
  'programs.reconcile': FromSchema<(typeof programsOperations)['programs.reconcile']['result']>;
};
export type ProgramsPort = {
  [M in keyof ProgramsInputs]: (input: ProgramsInputs[M]) => Promise<ProgramsOutputs[M]>;
};
export type ProgramsInternalInputs = {
  'programs.commandEvent': FromSchema<
    (typeof programsInternalOperations)['programs.commandEvent']['params']
  >;
};
export type ProgramsInternalOutputs = {
  'programs.commandEvent': FromSchema<
    (typeof programsInternalOperations)['programs.commandEvent']['result']
  >;
};
