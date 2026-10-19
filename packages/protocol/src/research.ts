import { Ajv } from 'ajv';
import type { FromSchema } from 'json-schema-to-ts';
import {
  type researchAttemptSchema,
  type researchInputSchema,
  researchMethodSchema,
  type researchOperations,
  researchRequestSchema,
} from './research-contracts.js';
import type { researchModuleOperations } from './research-module-contracts.js';
import type { Inputs as ModuleInputs, Outputs as ModuleOutputs } from './research-module-types.js';

export * from './research-contracts.js';
export { researchModuleOperations } from './research-module-contracts.js';

type CompleteModule<T extends Record<keyof typeof researchModuleOperations, unknown>> = T;
export type ResearchModuleInputs = CompleteModule<ModuleInputs>;
export type ResearchModuleOutputs = CompleteModule<ModuleOutputs>;
export type ResearchToolsPort = {
  [M in keyof ResearchInputs | 'research.invoke']: (
    input: M extends keyof ResearchInputs
      ? ResearchInputs[M]
      : ResearchModuleInputs['research.invoke'],
  ) => Promise<
    M extends keyof ResearchOutputs ? ResearchOutputs[M] : ResearchModuleOutputs['research.invoke']
  >;
};
export type ResearchProgressPort = (
  input: ResearchModuleInputs['research.progress'],
) => Promise<ResearchModuleOutputs['research.progress']>;

export type ResearchInput = FromSchema<typeof researchInputSchema>;
export type ResearchMethod = FromSchema<typeof researchMethodSchema>;
export type ResearchRequest = FromSchema<typeof researchRequestSchema>;
export type ResearchAttempt = FromSchema<typeof researchAttemptSchema>;
const ajv = new Ajv();
export const isResearchMethod = ajv.compile<ResearchMethod>(researchMethodSchema);
export const isResearchRequest = ajv.compile<ResearchRequest>(researchRequestSchema);
export type ResearchInputs = {
  [M in keyof typeof researchOperations]: FromSchema<(typeof researchOperations)[M]['params']>;
};
export type ResearchOutputs = {
  [M in keyof typeof researchOperations]: FromSchema<(typeof researchOperations)[M]['result']>;
};
