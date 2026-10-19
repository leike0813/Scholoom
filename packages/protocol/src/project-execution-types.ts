// Generated from projectExecutionOperations; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { projectExecutionOperations } from './project-file-contracts.js';

export type Inputs = {
  'project.check': FromSchema<(typeof projectExecutionOperations)['project.check']['params']>;
  'project.path': FromSchema<(typeof projectExecutionOperations)['project.path']['params']>;
  'project.saveFile': FromSchema<(typeof projectExecutionOperations)['project.saveFile']['params']>;
};
export type Outputs = {
  'project.check': FromSchema<(typeof projectExecutionOperations)['project.check']['result']>;
  'project.path': FromSchema<(typeof projectExecutionOperations)['project.path']['result']>;
  'project.saveFile': FromSchema<(typeof projectExecutionOperations)['project.saveFile']['result']>;
};
