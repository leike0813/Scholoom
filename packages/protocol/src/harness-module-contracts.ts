import {
  graphExecutionSchema,
  graphResumeInputSchema,
  registeredGraphSchema,
} from './graph-contracts.js';
import { harnessSnapshotSchema, sessionSchema } from './harness-record-contracts.js';
import { fileReferenceSchema } from './project-file-contracts.js';
import { content, flag, id, object, ok, page, session } from './schema.js';
export const harnessModuleOperations = {
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
