import type { CallArguments } from './core.js';
import { compileContract } from './core.js';
import { executionControlOperations } from './execution-contracts.js';
import type { Inputs, Outputs } from './execution-control-types.js';
import type { executionFileOperations } from './execution-files.js';

export { executionControlOperations } from './execution-contracts.js';
export type { FrameworkMessage, FrameworkToolResult } from './execution-graph.js';
export { frameworkMessageSchema } from './execution-graph.js';
export * from './graph-contracts.js';
export type { InstructionContext } from './workbench-context.js';
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
export const isExecutionControlMethod = (method: string): method is ExecutionControlMethod =>
  Object.hasOwn(executionControlOperations, method);
export const isExecutionControlCall = (
  args: readonly [string, unknown],
): args is CallArguments<ExecutionControlInputs> =>
  isExecutionControlMethod(args[0]) &&
  compileContract(executionControlOperations[args[0]]).params(args[1]) === true;
export const isExecutionControlResult = <M extends ExecutionControlMethod>(
  method: M,
  value: unknown,
): value is ExecutionControlOutputs[M] =>
  isExecutionControlMethod(method) &&
  compileContract(executionControlOperations[method]).result(value) === true;
