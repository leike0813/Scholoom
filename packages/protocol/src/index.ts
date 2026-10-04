import type { FromSchema } from 'json-schema-to-ts';

export const protocolVersion = 1;

export const jsonRpcRequestSchema = {
  type: 'object',
  properties: {
    jsonrpc: { const: '2.0' },
    id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    method: { type: 'string', minLength: 1 },
    params: { anyOf: [{ type: 'object' }, { type: 'array' }] },
  },
  required: ['jsonrpc', 'id', 'method'],
  additionalProperties: false,
} as const;

export type JsonRpcRequest = FromSchema<typeof jsonRpcRequestSchema>;

export const kernelRuntimeInfoSchema = {
  type: 'object',
  properties: {
    protocolVersion: { type: 'integer' },
    nodeVersion: { type: 'string' },
    processId: { type: 'integer' },
  },
  required: ['protocolVersion', 'nodeVersion', 'processId'],
  additionalProperties: false,
} as const;

export type KernelRuntimeInfo = FromSchema<typeof kernelRuntimeInfoSchema>;
