import type { RpcPeer } from '@scholoom/broker/rpc';
import { type CallArguments, OperationError, operationWait } from '@scholoom/protocol/core';
import {
  type ExecutionControlInputs,
  type ExecutionControlOutputs,
  executionControlOperations,
  isExecutionControlCall,
  isExecutionControlResult,
} from '@scholoom/protocol/execution';

/** Only controls of this owned execution use this port; graph and SDK adapters stay separate. */
export async function callExecutionControl<A extends CallArguments<ExecutionControlInputs>>(
  peer: RpcPeer,
  ...args: A
): Promise<ExecutionControlOutputs[A[0]]> {
  if (!isExecutionControlCall(args))
    throw new OperationError('invalidRequest', '执行控制参数不符合契约。');
  const [method, input] = args;
  const contract = executionControlOperations[method];
  const result = await peer.request(method, input, {
    waitMs: operationWait(contract, input),
    lossCode: contract.semantics.effect === 'write' ? 'outcomeUnknown' : 'unavailable',
    control:
      method === 'model.release' || method === 'execution.health' || method === 'execution.stop',
  });
  if (!isExecutionControlResult<A[0]>(args[0], result))
    throw new OperationError(
      contract.semantics.effect === 'write' ? 'outcomeUnknown' : 'unavailable',
      '执行控制结果不符合契约。',
    );
  return result;
}
