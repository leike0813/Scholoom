import type { FromSchema } from 'json-schema-to-ts';
import { compileContract } from './core.js';
import { id, object, ok } from './schema.js';

const identity = { kernelInstanceId: id, hostInstanceId: id, commandInstanceId: id };
const authentication = object(
  {
    ...identity,
    token: { type: 'string', minLength: 32, maxLength: 128 },
    protocolVersion: { type: 'integer' },
  },
  ['kernelInstanceId', 'hostInstanceId', 'commandInstanceId', 'token', 'protocolVersion'],
);
export const hostBootstrapSchema = object(
  {
    ...authentication.properties,
    url: { type: 'string', maxLength: 1024, pattern: '^ws://127\\.0\\.0\\.1:[0-9]+/$' },
  },
  [...authentication.required, 'url'],
);
const invocation = object({ handle: id, method: id, input: true }, ['handle', 'method', 'input']);
export const hostOperations = {
  'host.authenticate': {
    params: authentication,
    result: ok,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'host.ready': {
    params: object({ scope: id }, ['scope']),
    result: ok,
    semantics: { effect: 'read', returns: 'result', waitMs: 30000 },
  },
  'host.invoke': {
    params: invocation,
    result: true,
    semantics: { effect: 'write', returns: 'result', waitMs: 30000 },
  },
  'host.callback': {
    params: invocation,
    result: true,
    semantics: { effect: 'write', returns: 'result', waitMs: 30000 },
  },
  'host.shutdown': {
    params: object({}, []),
    result: object({ state: { enum: ['closed', 'unknown'] } }, ['state']),
    semantics: { effect: 'write', returns: 'result', waitMs: 5000 },
  },
} as const;
export type HostBootstrap = FromSchema<typeof hostBootstrapSchema>;
export type HostInvocation = FromSchema<typeof invocation>;
export const isHostBootstrap = compileContract({
  params: hostBootstrapSchema,
  result: true,
}).params;
export const hostRecordSchema = object(
  {
    version: { const: 1 },
    ...identity,
    scopeStopped: { type: 'boolean' },
    pluginClosed: { type: 'boolean' },
    unresolved: { type: 'array', items: id, maxItems: 64, uniqueItems: true },
  },
  [
    'version',
    'kernelInstanceId',
    'hostInstanceId',
    'commandInstanceId',
    'scopeStopped',
    'pluginClosed',
    'unresolved',
  ],
);
export type HostRecord = FromSchema<typeof hostRecordSchema>;
export const isHostRecord = compileContract({ params: hostRecordSchema, result: true }).params;
const validators = Object.fromEntries(
  Object.entries(hostOperations).map(([name, contract]) => [name, compileContract(contract)]),
);

export function validateHostMessage(
  method: keyof typeof hostOperations,
  value: unknown,
  result = false,
): boolean {
  const contract = validators[method];
  if (!contract) return false;
  return result ? contract.result(value) === true : contract.params(value) === true;
}
