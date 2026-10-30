import { errorInfoSchema } from './core.js';
import { graphDefinitionSchema } from './graph-contracts.js';
import { runSchema } from './harness-record-contracts.js';
import { fileReferenceSchema as researchFile } from './project-file-contracts.js';
import { resourceEvidenceSchema } from './resources.js';
import { array, content, count, id, object, page, session, text } from './schema.js';

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

export { researchFile };

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

export const researchGraphSchema = object(
  {
    definition: graphDefinitionSchema,
    name: id,
    description: text,
    source: id,
    purpose: { enum: ['research', 'calibration'] },
    resources: {
      type: 'array',
      maxItems: 100,
      items: object({ nodeKey: id, resourceId: id, source: id }, [
        'nodeKey',
        'resourceId',
        'source',
      ]),
    },
    delivery: object(
      {
        roles: { type: 'array', items: id, minItems: 1, maxItems: 10, uniqueItems: true },
        inputReadMode: { const: 'content-ranges' },
      },
      ['roles'],
    ),
  },
  ['definition', 'name', 'description', 'source', 'purpose', 'resources', 'delivery'],
);

export const researchGraphStartSchema = object(
  {
    ...session,
    invocationId: id,
    instructionId: id,
    graphId: id,
    version: id,
    config: { type: 'object', additionalProperties: true },
    materials: { type: 'array', items: resourceEvidenceSchema, minItems: 1, maxItems: 10 },
    text: { type: 'string', minLength: 1, maxLength: 32768 },
  },
  [
    'projectId',
    'sessionId',
    'invocationId',
    'instructionId',
    'graphId',
    'version',
    'config',
    'materials',
    'text',
  ],
);

export const researchGraphCallSchema = object(
  {
    kind: { const: 'graph' },
    id,
    ...researchGraphStartSchema.properties,
    graph: researchGraphSchema,
    createdAt: text,
    runId: id,
    error: errorInfoSchema,
    restoredFromProjectId: id,
  },
  ['kind', 'id', ...researchGraphStartSchema.required, 'graph', 'createdAt'],
);

export const researchGraphReceiptSchema = object(
  { invocationId: id, instructionId: id, runId: id },
  ['invocationId', 'instructionId', 'runId'],
);

export const researchGraphDeliverySchema = object(
  {
    delivery: { enum: ['pending', 'usable', 'incomplete'] },
    researchAssessment: { const: 'notAssessed' },
    issues: {
      type: 'array',
      maxItems: 100,
      items: object(
        {
          code: {
            enum: [
              'inputNotRead',
              'artifactMissing',
              'artifactUnavailable',
              'associationIncomplete',
              'executionIncomplete',
            ],
          },
          role: id,
          resource: resourceEvidenceSchema,
        },
        ['code'],
      ),
    },
  },
  ['delivery', 'researchAssessment', 'issues'],
);

export const researchOperations = {
  'research.requestGraph': {
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
    params: researchGraphStartSchema,
    result: researchGraphReceiptSchema,
  },
  'research.graphs': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ offset: count, limit: page }, []),
    result: object(
      {
        descriptions: { ...array(researchGraphSchema), maxItems: page.maximum },
        nextOffset: count,
      },
      ['descriptions'],
    ),
  },
  'research.graph': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ graphId: id, version: id }, ['graphId', 'version']),
    result: researchGraphSchema,
  },
  'research.graphCalls': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(
      { ...session, invocationId: id, offset: count, limit: page, executionOffset: count },
      ['projectId', 'sessionId'],
    ),
    result: object(
      {
        calls: {
          ...array(
            object(
              {
                call: researchGraphCallSchema,
                executions: {
                  ...array(
                    object({ run: runSchema, check: researchGraphDeliverySchema }, [
                      'run',
                      'check',
                    ]),
                  ),
                  maxItems: 25,
                },
                nextExecutionOffset: count,
                error: errorInfoSchema,
              },
              ['call', 'executions'],
            ),
          ),
          maxItems: page.maximum,
        },
        nextOffset: count,
      },
      ['calls'],
    ),
  },
  'research.methods': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({}, []),
    result: array(researchMethodSchema),
  },
  'research.method': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ methodId: id, version: id }, ['methodId', 'version']),
    result: object({ method: researchMethodSchema, content }, ['method', 'content']),
  },
  'research.attempts': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ ...session, invocationId: id, offset: count, limit: page }, [
      'projectId',
      'sessionId',
    ]),
    result: object({ attempts: array(researchAttemptSchema), nextOffset: count }, ['attempts']),
  },
} as const;
