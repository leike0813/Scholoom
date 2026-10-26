// Generated from harnessModuleOperations; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { harnessModuleOperations } from './harness-module-contracts.js';

export type Inputs = {
  'harness.delegate': FromSchema<(typeof harnessModuleOperations)['harness.delegate']['params']>;
  'harness.execute': FromSchema<(typeof harnessModuleOperations)['harness.execute']['params']>;
  'harness.reportDelegation': FromSchema<
    (typeof harnessModuleOperations)['harness.reportDelegation']['params']
  >;
  'harness.roles': FromSchema<(typeof harnessModuleOperations)['harness.roles']['params']>;
  'harness.snapshot': FromSchema<(typeof harnessModuleOperations)['harness.snapshot']['params']>;
  'harness.startGraph': FromSchema<
    (typeof harnessModuleOperations)['harness.startGraph']['params']
  >;
  'harness.waitDelegation': FromSchema<
    (typeof harnessModuleOperations)['harness.waitDelegation']['params']
  >;
  'session.check': FromSchema<(typeof harnessModuleOperations)['session.check']['params']>;
};
export type Outputs = {
  'harness.delegate': FromSchema<(typeof harnessModuleOperations)['harness.delegate']['result']>;
  'harness.execute': FromSchema<(typeof harnessModuleOperations)['harness.execute']['result']>;
  'harness.reportDelegation': FromSchema<
    (typeof harnessModuleOperations)['harness.reportDelegation']['result']
  >;
  'harness.roles': FromSchema<(typeof harnessModuleOperations)['harness.roles']['result']>;
  'harness.snapshot': FromSchema<(typeof harnessModuleOperations)['harness.snapshot']['result']>;
  'harness.startGraph': FromSchema<
    (typeof harnessModuleOperations)['harness.startGraph']['result']
  >;
  'harness.waitDelegation': FromSchema<
    (typeof harnessModuleOperations)['harness.waitDelegation']['result']
  >;
  'session.check': FromSchema<(typeof harnessModuleOperations)['session.check']['result']>;
};
