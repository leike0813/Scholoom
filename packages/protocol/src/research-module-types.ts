// Generated from researchModuleOperations; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { researchModuleOperations } from './research-module-contracts.js';

export type Inputs = {
  'research.invoke': FromSchema<(typeof researchModuleOperations)['research.invoke']['params']>;
  'research.progress': FromSchema<(typeof researchModuleOperations)['research.progress']['params']>;
};
export type Outputs = {
  'research.invoke': FromSchema<(typeof researchModuleOperations)['research.invoke']['result']>;
  'research.progress': FromSchema<(typeof researchModuleOperations)['research.progress']['result']>;
};
