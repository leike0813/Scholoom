import type { FromSchema } from 'json-schema-to-ts';
import { encodedBytesSchema } from './execution-files.js';
import type { harnessModuleOperations } from './harness-module-contracts.js';
import type { Inputs as ModuleInputs, Outputs as ModuleOutputs } from './harness-module-types.js';
import {
  type harnessSnapshotSchema,
  messageSchema,
  type runSchema,
  sessionSchema,
} from './harness-record-contracts.js';
import { contextItemsSchema } from './workbench-context.js';

export * from './delegation-contracts.js';
export { harnessModuleOperations } from './harness-module-contracts.js';
export {
  harnessSnapshotSchema,
  messageSchema,
  runSchema,
  runStateSchema,
  sessionSchema,
} from './harness-record-contracts.js';
export type {
  ContextItem,
  InstructionContext,
  WorkbenchContextOutputs,
  WorkbenchSource,
} from './workbench-context.js';
export { isContextItems, workbenchContextInternalOperations } from './workbench-context.js';

type CompleteModule<T extends Record<keyof typeof harnessModuleOperations, unknown>> = T;
export type HarnessModuleInputs = CompleteModule<ModuleInputs>;
export type HarnessModuleOutputs = CompleteModule<ModuleOutputs>;
export type CapabilityExecution = HarnessModuleInputs['harness.execute'];
export type ResearchSessionPort = (
  input: HarnessModuleInputs['session.check'],
) => Promise<HarnessModuleOutputs['session.check']>;

import { modelPreferenceSchema } from './models.js';
import { projectSchema } from './projects.js';
import { array, flag, id, object, ok, page, project, session, text } from './schema.js';

export const sessionCursor = object({ updatedAt: text, id }, ['updatedAt', 'id']);

export type HarnessSnapshot = FromSchema<typeof harnessSnapshotSchema>;

export const harnessOperations = {
  'session.create': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...project, title: text }, ['projectId']),
    result: sessionSchema,
  },
  'session.list': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object(
      {
        ...project,
        archived: flag,
        query: { type: 'string', maxLength: 200 },
        cursor: sessionCursor,
        limit: page,
      },
      ['projectId'],
    ),
    result: object({ sessions: array(sessionSchema), nextCursor: sessionCursor }, ['sessions']),
  },
  'session.search': {
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
    params: object({ query: { type: 'string', maxLength: 200 }, limit: page }, ['query']),
    result: object(
      {
        results: array(
          object({ project: projectSchema, session: sessionSchema }, ['project', 'session']),
        ),
        truncated: flag,
      },
      ['results', 'truncated'],
    ),
  },
  'session.rename': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...session, title: { type: 'string', minLength: 1, maxLength: 200 } }, [
      'projectId',
      'sessionId',
      'title',
    ]),
    result: sessionSchema,
  },
  'session.archive': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object({ ...session, archived: flag }, ['projectId', 'sessionId', 'archived']),
    result: sessionSchema,
  },
  'session.configure': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(
      { ...session, modelConfig: { anyOf: [modelPreferenceSchema, { const: null }] } },
      ['projectId', 'sessionId', 'modelConfig'],
    ),
    result: sessionSchema,
  },
  'session.send': {
    semantics: { effect: 'write', returns: 'reference', waitMs: 5000 },
    params: object(
      {
        ...session,
        instructionId: id,
        text: { type: 'string', minLength: 1, maxLength: 32768 },
        materials: array(text),
        materialFileIds: array(text),
        contextItems: contextItemsSchema,
      },
      ['projectId', 'sessionId', 'instructionId', 'text', 'materials'],
    ),
    result: object({ instructionId: id, runId: id }, ['instructionId', 'runId']),
  },
  'session.cancel': {
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
    params: object(session, ['projectId', 'sessionId']),
    result: ok,
  },
} as const;

export type Session = FromSchema<typeof sessionSchema>;
export type Message = FromSchema<typeof messageSchema>;
export type Run = FromSchema<typeof runSchema>;
export type HarnessInputs = {
  [M in keyof typeof harnessOperations]: FromSchema<(typeof harnessOperations)[M]['params']>;
};
export type HarnessOutputs = {
  [M in keyof typeof harnessOperations]: FromSchema<(typeof harnessOperations)[M]['result']>;
};

export const runtimeIdentitySchema = object(
  { hostInstanceId: id, instanceId: id, projectId: id, sessionId: id, runId: id },
  ['hostInstanceId', 'instanceId', 'projectId', 'sessionId', 'runId'],
);
export type RuntimeIdentity = FromSchema<typeof runtimeIdentitySchema>;
const transferError = {
  enum: ['file_not_found', 'permission_denied', 'is_directory', 'invalid_path', null],
} as const;
const fileBytes = encodedBytesSchema;
export const executionOperations = {
  'execution.files.upload': {
    params: object(
      {
        files: {
          type: 'array',
          items: object({ path: text, content: fileBytes }, ['path', 'content']),
          maxItems: 100,
        },
        token: id,
      },
      ['files'],
    ),
    result: object(
      { files: array(object({ path: text, error: transferError }, ['path', 'error'])) },
      ['files'],
    ),
    semantics: { effect: 'write', returns: 'result', waitMs: 35000 },
  },
  'execution.files.download': {
    params: object({ paths: { type: 'array', items: text, maxItems: 100 }, token: id }, ['paths']),
    result: object(
      {
        files: array(
          object(
            { path: text, content: { anyOf: [fileBytes, { const: null }] }, error: transferError },
            ['path', 'content', 'error'],
          ),
        ),
      },
      ['files'],
    ),
    semantics: { effect: 'read', returns: 'result', waitMs: 35000 },
  },
  'execution.health': {
    params: object({}, []),
    result: object({ processId: { type: 'integer', minimum: 1 } }, ['processId']),
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'execution.stop': {
    params: object({}, []),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 10000 },
  },
  'execution.consume': {
    params: object(
      {
        checkpointId: id,
        instructionIds: { type: 'array', items: id, maxItems: 100 },
      },
      ['checkpointId', 'instructionIds'],
    ),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'execution.message': {
    params: object({ identity: runtimeIdentitySchema, message: messageSchema }, [
      'identity',
      'message',
    ]),
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;
