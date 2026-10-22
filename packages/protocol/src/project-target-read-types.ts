// Generated from projectTargetReadOperations; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { projectTargetReadOperations } from './work-domains.js';

export type Inputs = {
  'project.readTarget': FromSchema<
    (typeof projectTargetReadOperations)['project.readTarget']['params']
  >;
};
export type Outputs = {
  'project.readTarget': FromSchema<
    (typeof projectTargetReadOperations)['project.readTarget']['result']
  >;
};
