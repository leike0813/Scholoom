import { delegationInternalOperations } from './delegation-contracts.js';
import {
  graphExecutionSchema,
  graphResumeInputSchema,
  registeredGraphSchema,
} from './graph-contracts.js';
import {
  harnessSnapshotSchema,
  messageSchema,
  runSchema,
  sessionSchema,
} from './harness-record-contracts.js';
import { fileReferenceSchema } from './project-file-contracts.js';
import { array, content, count, flag, id, object, ok, page, session } from './schema.js';

const executionFactsSchema = {
  anyOf: [
    object({ state: { const: 'unknown' } }, ['state']),
    object(
      {
        state: { const: 'verified' },
        principal: object({ kind: { const: 'agent' }, id }, ['kind', 'id']),
        ...session,
        runId: id,
        instanceId: id,
        delegation: {
          anyOf: [
            object({ state: { enum: ['none', 'unknown'] } }, ['state']),
            object(
              {
                state: { const: 'verified' },
                delegationId: id,
                parentInstanceId: id,
                parentRunId: id,
              },
              ['state', 'delegationId', 'parentInstanceId', 'parentRunId'],
            ),
          ],
        },
        instructionContext: object(
          { state: { const: 'unknown' }, reason: { const: 'notCaptured' } },
          ['state', 'reason'],
        ),
        tool: object({ state: { const: 'unknown' }, reason: { const: 'notBound' } }, [
          'state',
          'reason',
        ]),
      },
      [
        'state',
        'principal',
        'projectId',
        'sessionId',
        'runId',
        'instanceId',
        'delegation',
        'instructionContext',
        'tool',
      ],
    ),
  ],
} as const;
export const harnessModuleOperations = {
  ...delegationInternalOperations,
  'harness.executionFacts': {
    params: object({}, []),
    result: executionFactsSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'harness.executions': {
    params: {
      ...object(
        {
          ...session,
          runId: id,
          instructionId: id,
          originInstructionId: id,
          offset: count,
          limit: page,
        },
        ['projectId', 'sessionId'],
      ),
      oneOf: [
        { required: ['runId'] },
        { required: ['instructionId'] },
        { required: ['originInstructionId'] },
      ],
    },
    result: object(
      {
        runs: { ...array(runSchema), maxItems: 100 },
        nextOffset: count,
        instruction: messageSchema,
      },
      ['runs'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'harness.startGraph': {
    params: object(
      { ...session, instructionId: id, text: content, execution: registeredGraphSchema },
      ['projectId', 'sessionId', 'instructionId', 'text', 'execution'],
    ),
    result: object({ instructionId: id, runId: id }, ['instructionId', 'runId']),
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
  },
  'harness.snapshot': {
    params: object(
      { projectId: id, sessionId: id, before: id, limit: page, includeSessions: flag },
      [],
    ),
    result: harnessSnapshotSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'session.check': {
    params: object(session, ['projectId', 'sessionId']),
    result: sessionSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'harness.execute': {
    params: object(
      {
        attemptId: id,
        prompt: content,
        expectedOutput: fileReferenceSchema,
        execution: graphExecutionSchema,
        resume: graphResumeInputSchema,
      },
      ['attemptId', 'prompt'],
    ),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 3600000 },
  },
} as const;
