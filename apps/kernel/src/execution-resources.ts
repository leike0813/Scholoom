import { type CallContext, OperationError } from '@scholoom/protocol/core';
import type {
  ExecutionResourcePort,
  ResourceCreationInputs,
  ResourceCreationOutputs,
  ResourceInputs,
  ResourceLocator,
  ResourceOutputs,
} from '@scholoom/protocol/resources';

export type ExecutionResourceInputs = Omit<ResourceInputs, 'resources.cancel'> &
  ResourceCreationInputs;
export type ExecutionResourceOutputs = ResourceOutputs & ResourceCreationOutputs;
export type ResourceCalls = {
  [M in keyof ExecutionResourceInputs]: (
    input: ExecutionResourceInputs[M],
  ) => Promise<ExecutionResourceOutputs[M]>;
};

/** Bind target restrictions per operation; callers cannot replace the execution identity. */
export function executionResources(
  context: CallContext,
  connect: (context: CallContext) => ResourceCalls,
): ExecutionResourcePort {
  const source = Object.freeze({
    ...context,
    principal: Object.freeze({ ...context.principal }),
    ...(context.workDomain ? { workDomain: Object.freeze({ ...context.workDomain }) } : {}),
    ...(context.targetRead ? { targetRead: Object.freeze({ ...context.targetRead }) } : {}),
  });
  const port = (locator: ResourceLocator): ResourceCalls => {
    if (
      locator.source === 'project' &&
      (locator.projectId !== source.projectId || source.targetRead)
    ) {
      if (source.targetRead && source.targetRead.targetProjectId !== locator.projectId)
        throw new OperationError('permissionDenied', '不能扩大资源目标读取范围。');
      return connect({
        ...source,
        targetRead: { targetProjectId: locator.projectId, access: 'read' },
      });
    }
    return connect(source);
  };
  return {
    describe: (locator) => port(locator)['resources.describe']({ locator }),
    read: (input) => port(input.ref)['resources.read'](input),
    document: (resource, method, input) =>
      port(resource.ref)['resources.document']({
        ref: resource.ref,
        basis: resource.basis,
        request: { method, input } as ResourceInputs['resources.document']['request'],
      }) as Promise<import('@scholoom/protocol/resources').ResourceDocumentOutputs[typeof method]>,
    save: async (input) => ({ resource: await port(input.ref)['resources.save'](input) }),
    create: (input) => connect(source)['resources.create'](input),
    creation: (input) => connect(source)['resources.creation'](input),
  };
}
