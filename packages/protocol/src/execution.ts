import type { CallArguments } from './core.js';
import { compileContract } from './core.js';
import { executionControlOperations } from './execution-contracts.js';
import type { Inputs, Outputs } from './execution-control-types.js';
import type { executionFileOperations } from './execution-files.js';

export { executionControlOperations } from './execution-contracts.js';
export type { FrameworkMessage, FrameworkToolResult } from './execution-graph.js';
export { frameworkMessageSchema } from './execution-graph.js';
export type ExecutionControlMethod = keyof typeof executionControlOperations;
type Complete<T extends Record<ExecutionControlMethod, unknown>> = T;
export type ExecutionControlInputs = Complete<Inputs>;
export type ExecutionControlOutputs = Complete<Outputs>;
export type ExecutionControlProviders = {
  [M in ExecutionControlMethod]: (
    input: ExecutionControlInputs[M],
  ) => ExecutionControlOutputs[M] | Promise<ExecutionControlOutputs[M]>;
};
export type ExecutionFileProviders = Pick<
  ExecutionControlProviders,
  keyof typeof executionFileOperations
>;
const validators = new Map(
  Object.entries(executionControlOperations).map(([method, contract]) => [
    method,
    compileContract(contract),
  ]),
);
export const isExecutionControlMethod = (method: string): method is ExecutionControlMethod =>
  validators.has(method);
export const isExecutionControlCall = (
  args: readonly [string, unknown],
): args is CallArguments<ExecutionControlInputs> =>
  isExecutionControlMethod(args[0]) && validators.get(args[0])?.params(args[1]) === true;
export const isExecutionControlResult = <M extends ExecutionControlMethod>(
  method: M,
  value: unknown,
): value is ExecutionControlOutputs[M] => validators.get(method)?.result(value) === true;
