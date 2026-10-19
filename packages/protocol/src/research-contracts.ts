import { fileReferenceSchema as researchFile } from './project-file-contracts.js';
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

export const researchOperations = {
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
