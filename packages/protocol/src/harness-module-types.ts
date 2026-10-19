// Generated from harnessModuleOperations; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { harnessModuleOperations } from './harness-module-contracts.js';

export type Inputs = {
  'harness.execute': FromSchema<(typeof harnessModuleOperations)['harness.execute']['params']>;
  'harness.snapshot': FromSchema<(typeof harnessModuleOperations)['harness.snapshot']['params']>;
  'session.check': FromSchema<(typeof harnessModuleOperations)['session.check']['params']>;
};
export type Outputs = {
  'harness.execute': FromSchema<(typeof harnessModuleOperations)['harness.execute']['result']>;
  'harness.snapshot': FromSchema<(typeof harnessModuleOperations)['harness.snapshot']['result']>;
  'session.check': FromSchema<(typeof harnessModuleOperations)['session.check']['result']>;
};
