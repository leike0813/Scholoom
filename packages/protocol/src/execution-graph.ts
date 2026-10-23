import type { FromSchema } from 'json-schema-to-ts';
import {
  graphProgressSchema,
  graphResumeInputSchema,
  registeredGraphSchema,
} from './graph-contracts.js';
import { modelDescriptorSchema } from './models.js';
import { array, count, flag, id, object, ok, text } from './schema.js';
import { instructionContextsSchema } from './workbench-context.js';

// Framework payloads preserve content blocks and provider metadata as JSON objects.
export const frameworkMessageSchema = object(
  {
    type: text,
    data: {
      type: 'object',
      properties: {
        content: { anyOf: [text, array({ type: 'object', additionalProperties: true })] },
      },
      required: ['content'],
      additionalProperties: true,
    },
  },
  ['type', 'data'],
);
const messageUpdate = object(
  {
    messages: array(frameworkMessageSchema),
    instructionIds: array(id),
    instructionRunId: id,
    instructions: instructionContextsSchema,
  },
  [],
);
const toolCall = object(
  {
    name: id,
    args: { type: 'object', additionalProperties: true },
    id,
    type: { const: 'tool_call' },
  },
  ['name', 'args'],
);
export const frameworkToolResultSchema = {
  anyOf: [
    object({ kind: { const: 'message' }, value: frameworkMessageSchema }, ['kind', 'value']),
    object({ kind: { const: 'command' }, update: { type: 'object', additionalProperties: true } }, [
      'kind',
      'update',
    ]),
  ],
} as const;
export const agentInitializationSchema = object(
  {
    model: modelDescriptorSchema,
    tools: array(
      object(
        { name: id, description: text, schema: { type: 'object', additionalProperties: true } },
        ['name', 'description', 'schema'],
      ),
    ),
    systemPrompt: text,
    checkpointPath: text,
    instructions: instructionContextsSchema,
    middleware: array(
      object({ name: id, before: flag, tool: flag, model: flag }, [
        'name',
        'before',
        'tool',
        'model',
      ]),
    ),
    input: {
      anyOf: [object({ messages: array(frameworkMessageSchema) }, ['messages']), { const: null }],
    },
    config: object(
      {
        configurable: object({ thread_id: id }, ['thread_id']),
        recursionLimit: count,
        durability: { const: 'sync' },
      },
      ['recursionLimit', 'durability'],
    ),
  },
  ['model', 'tools', 'middleware', 'input', 'config'],
);
export const executionGraphOperations = {
  'execution.initialize': {
    params: {
      anyOf: [
        agentInitializationSchema,
        object(
          {
            graph: registeredGraphSchema,
            model: modelDescriptorSchema,
            attemptId: id,
            checkpointRef: id,
            checkpointPath: text,
            input: { anyOf: [graphResumeInputSchema, { const: null }] },
            instructions: instructionContextsSchema,
          },
          ['graph', 'attemptId', 'input'],
        ),
      ],
    },
    result: ok,
    semantics: { effect: 'write', returns: 'result', waitMs: 10000 },
  },
  'execution.next': {
    params: object({}, []),
    result: {
      anyOf: [
        object({ done: { const: true }, graph: graphProgressSchema }, ['done', 'graph']),
        object({ done: { const: true } }, ['done']),
        object(
          {
            done: { const: false },
            event: {
              anyOf: [
                object(
                  {
                    event: { const: 'on_chat_model_stream' },
                    run_id: id,
                    data: object({ chunk: frameworkMessageSchema }, ['chunk']),
                  },
                  ['event', 'run_id', 'data'],
                ),
                object(
                  {
                    event: { const: 'on_chat_model_end' },
                    run_id: id,
                    data: object({ output: frameworkMessageSchema }, ['output']),
                  },
                  ['event', 'run_id', 'data'],
                ),
              ],
            },
          },
          ['done', 'event'],
        ),
      ],
    },
    semantics: { effect: 'write', returns: 'result', waitMs: 3600000 },
  },
  'execution.tool': {
    params: object({ token: id }, ['token']),
    result: frameworkToolResultSchema,
    semantics: { effect: 'write', returns: 'result', waitMs: 3600000 },
  },
  'execution.beforeModel': {
    params: object({ name: id, messages: array(frameworkMessageSchema) }, ['name', 'messages']),
    result: { anyOf: [messageUpdate, { const: null }] },
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
  'execution.wrapModel': {
    params: object({ name: id }, ['name']),
    result: ok,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'execution.wrapTool': {
    params: object({ name: id, token: id, toolCall }, ['name', 'token', 'toolCall']),
    result: frameworkToolResultSchema,
    semantics: { effect: 'write', returns: 'result', waitMs: 3600000 },
  },
  'execution.custom': {
    params: object({ name: id, token: id, args: { type: 'object', additionalProperties: true } }, [
      'name',
      'args',
    ]),
    result: text,
    semantics: { effect: 'write', returns: 'result', waitMs: 3600000 },
  },
} as const;
export type FrameworkMessage = FromSchema<typeof frameworkMessageSchema>;
export type FrameworkToolResult = FromSchema<typeof frameworkToolResultSchema>;
