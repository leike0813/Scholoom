// Generated from workbenchContextContracts; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { workbenchContextContracts } from './workbench-context-contracts.js';

export type Inputs = {
  'workbench.context.publish': FromSchema<
    (typeof workbenchContextContracts)['workbench.context.publish']['params']
  >;
  'workbench.context.read': FromSchema<
    (typeof workbenchContextContracts)['workbench.context.read']['params']
  >;
};
export type Outputs = {
  'workbench.context.publish': FromSchema<
    (typeof workbenchContextContracts)['workbench.context.publish']['result']
  >;
  'workbench.context.read': FromSchema<
    (typeof workbenchContextContracts)['workbench.context.read']['result']
  >;
};
