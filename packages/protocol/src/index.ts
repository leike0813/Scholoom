import { Ajv } from 'ajv';
import type { FromSchema } from 'json-schema-to-ts';

export * from './business.js';

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
    processId: { type: 'integer', minimum: 1 },
  },
  required: ['protocolVersion', 'nodeVersion', 'processId'],
  additionalProperties: false,
} as const;

export type KernelRuntimeInfo = FromSchema<typeof kernelRuntimeInfoSchema>;

export const errorInfoSchema = {
  type: 'object',
  properties: {
    code: {
      enum: [
        'authenticationFailed',
        'protocolIncompatible',
        'instanceMismatch',
        'invalidRequest',
        'unavailable',
        'outcomeUnknown',
        'shuttingDown',
        'permissionDenied',
        'startupFailed',
        'notFound',
        'contentChanged',
        'targetAmbiguous',
        'tooLarge',
        'credentialUnavailable',
        'modelFailed',
        'resourceLimit',
      ],
    },
    message: { type: 'string', maxLength: 512 },
  },
  required: ['code', 'message'],
  additionalProperties: false,
} as const;
export type ErrorInfo = FromSchema<typeof errorInfoSchema>;

export const kernelStatusSchema = {
  type: 'object',
  properties: {
    ...kernelRuntimeInfoSchema.properties,
    instanceId: { type: 'string', minLength: 1 },
    dataDirectory: { type: 'string', minLength: 1 },
    startedAt: { type: 'string', minLength: 1 },
    state: { enum: ['running', 'stopping'] },
  },
  required: [
    ...kernelRuntimeInfoSchema.required,
    'instanceId',
    'dataDirectory',
    'startedAt',
    'state',
  ],
  additionalProperties: false,
} as const;
export type KernelStatus = FromSchema<typeof kernelStatusSchema>;

export const kernelEndpointSchema = {
  type: 'object',
  properties: {
    ...kernelStatusSchema.properties,
    url: { type: 'string', pattern: '^ws://127\\.0\\.0\\.1:[0-9]+/$' },
    token: { type: 'string', minLength: 32 },
  },
  required: [...kernelStatusSchema.required, 'url', 'token'],
  additionalProperties: false,
} as const;
export type KernelEndpoint = FromSchema<typeof kernelEndpointSchema>;

export const bootstrapRequestSchema = {
  type: 'object',
  properties: { mode: { enum: ['inspect', 'ensure'] } },
  required: ['mode'],
  additionalProperties: false,
} as const;
export type BootstrapRequest = FromSchema<typeof bootstrapRequestSchema>;

export const developmentAttachSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export const bootstrapResultSchema = {
  anyOf: [
    {
      type: 'object',
      properties: { state: { const: 'running' }, endpoint: kernelEndpointSchema },
      required: ['state', 'endpoint'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        state: { enum: ['stopped', 'unreachable', 'unknown'] },
        error: errorInfoSchema,
      },
      required: ['state'],
      additionalProperties: false,
    },
  ],
} as const;
export type BootstrapResult = FromSchema<typeof bootstrapResultSchema>;

export const authenticationSchema = {
  type: 'object',
  properties: {
    token: { type: 'string' },
    protocolVersion: { type: 'integer' },
    instanceId: { type: 'string' },
  },
  required: ['token', 'protocolVersion', 'instanceId'],
  additionalProperties: false,
} as const;

export const shutdownSchema = {
  type: 'object',
  properties: { instanceId: { type: 'string', minLength: 1 } },
  required: ['instanceId'],
  additionalProperties: false,
} as const;
export const shutdownAcceptedSchema = {
  ...shutdownSchema,
  properties: { ...shutdownSchema.properties, state: { const: 'stopping' } },
  required: ['instanceId', 'state'],
} as const;
export type ShutdownAccepted = FromSchema<typeof shutdownAcceptedSchema>;

export const jsonRpcResponseSchema = {
  anyOf: [
    {
      type: 'object',
      properties: {
        jsonrpc: { const: '2.0' },
        id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        result: {},
      },
      required: ['jsonrpc', 'id', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        jsonrpc: { const: '2.0' },
        id: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
        error: {
          type: 'object',
          properties: {
            code: { type: 'integer' },
            message: { type: 'string' },
            data: errorInfoSchema,
          },
          required: ['code', 'message', 'data'],
          additionalProperties: false,
        },
      },
      required: ['jsonrpc', 'id', 'error'],
      additionalProperties: false,
    },
  ],
} as const;
export type JsonRpcResponse = FromSchema<typeof jsonRpcResponseSchema>;

export const jsonRpcNotificationSchema = {
  type: 'object',
  properties: {
    jsonrpc: { const: '2.0' },
    method: { type: 'string', minLength: 1 },
    params: { anyOf: [{ type: 'object' }, { type: 'array' }] },
  },
  required: ['jsonrpc', 'method'],
  additionalProperties: false,
} as const;
export type JsonRpcNotification = FromSchema<typeof jsonRpcNotificationSchema>;

const ajv = new Ajv();
export const isErrorInfo = ajv.compile<ErrorInfo>(errorInfoSchema);
export const isJsonRpcRequest = ajv.compile<JsonRpcRequest>(jsonRpcRequestSchema);
export const isJsonRpcResponse = ajv.compile<JsonRpcResponse>(jsonRpcResponseSchema);
export const isJsonRpcNotification = ajv.compile<JsonRpcNotification>(jsonRpcNotificationSchema);
export const isKernelStatus = ajv.compile<KernelStatus>(kernelStatusSchema);
export const isKernelEndpoint = ajv.compile<KernelEndpoint>(kernelEndpointSchema);
export const isBootstrapRequest = ajv.compile<BootstrapRequest>(bootstrapRequestSchema);
export const isDevelopmentAttach = ajv.compile(developmentAttachSchema);
export const isBootstrapResult = ajv.compile<BootstrapResult>(bootstrapResultSchema);
export const isAuthentication =
  ajv.compile<FromSchema<typeof authenticationSchema>>(authenticationSchema);
export const isShutdown = ajv.compile<FromSchema<typeof shutdownSchema>>(shutdownSchema);
export const isShutdownAccepted = ajv.compile<ShutdownAccepted>(shutdownAcceptedSchema);

export const limits = {
  authenticationMs: 3_000,
  requestMs: 5_000,
  lifecycleMs: 10_000,
  frameBytes: 2 * 1024 * 1024,
  reconnectDelays: [250, 500, 1_000, 2_000],
} as const;
