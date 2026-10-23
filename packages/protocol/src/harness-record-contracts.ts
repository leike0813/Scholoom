import { graphBindingSchema, graphProgressSchema } from './graph-contracts.js';
import { modelPreferenceSchema, runModelConfigSchema } from './models.js';
import { artifactSchema } from './project-contracts.js';
import { array, content, count, flag, id, object, text } from './schema.js';
import { contextItemsSchema, workbenchSourceSchema } from './workbench-context.js';
export const runStateSchema = {
  enum: ['queued', 'running', 'waiting', 'cancelling', 'cancelled', 'completed', 'failed', 'interrupted'],
} as const;
export const sessionSchema = object(
  {
    id,
    projectId: id,
    title: text,
    updatedAt: text,
    state: runStateSchema,
    archived: flag,
    titleSource: { enum: ['default', 'instruction', 'manual'] },
    modelConfig: modelPreferenceSchema,
  },
  ['id', 'projectId', 'title', 'updatedAt', 'state'],
);

export const messageSchema = object(
  {
    id,
    sessionId: id,
    runId: id,
    role: { enum: ['user', 'assistant', 'tool'] },
    text: content,
    state: { enum: ['accepted', 'consumed', 'streaming', 'complete', 'error', 'unknown'] },
    tool: object(
      {
        runId: id,
        name: id,
        input: { type: 'string', maxLength: 16384 },
        output: { type: 'string', maxLength: 16384 },
        inputTruncated: flag,
        outputTruncated: flag,
      },
      ['runId', 'name', 'input', 'inputTruncated'],
    ),
    materials: array(text),
    materialFileIds: array(text),
    contextItems: contextItemsSchema,
    source: workbenchSourceSchema,
    createdAt: text,
  },
  ['id', 'sessionId', 'role', 'text', 'state', 'materials', 'createdAt'],
);

export const runSchema = object(
  {
    id,
    sessionId: id,
    attempt: count,
    state: runStateSchema,
    error: text,
    inputTokens: count,
    outputTokens: count,
    remoteOutcome: { enum: ['unknown', 'completed'] },
    graph: graphBindingSchema,
    graphProgress: graphProgressSchema,
    modelConfig: runModelConfigSchema,
  },
  ['id', 'sessionId', 'attempt', 'state'],
);

export const harnessSnapshotSchema = object(
  {
    sessions: array(sessionSchema),
    session: sessionSchema,
    messages: array(messageSchema),
    run: runSchema,
    artifacts: array(artifactSchema),
    nextBefore: id,
  },
  ['sessions', 'messages', 'artifacts'],
);
