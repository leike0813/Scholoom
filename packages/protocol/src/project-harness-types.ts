// Generated from projectHarnessOperations; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { projectHarnessOperations } from './project-contracts.js';

export type Inputs = {
  'files.changes': FromSchema<(typeof projectHarnessOperations)['files.changes']['params']>;
  'files.edit': FromSchema<(typeof projectHarnessOperations)['files.edit']['params']>;
  'files.mkdir': FromSchema<(typeof projectHarnessOperations)['files.mkdir']['params']>;
  'files.operation': FromSchema<(typeof projectHarnessOperations)['files.operation']['params']>;
  'files.read': FromSchema<(typeof projectHarnessOperations)['files.read']['params']>;
  'files.readBytes': FromSchema<(typeof projectHarnessOperations)['files.readBytes']['params']>;
  'files.rename': FromSchema<(typeof projectHarnessOperations)['files.rename']['params']>;
  'files.resolve': FromSchema<(typeof projectHarnessOperations)['files.resolve']['params']>;
  'files.restore': FromSchema<(typeof projectHarnessOperations)['files.restore']['params']>;
  'files.trash': FromSchema<(typeof projectHarnessOperations)['files.trash']['params']>;
  'files.trashList': FromSchema<(typeof projectHarnessOperations)['files.trashList']['params']>;
  'project.artifacts': FromSchema<(typeof projectHarnessOperations)['project.artifacts']['params']>;
  'project.check': FromSchema<(typeof projectHarnessOperations)['project.check']['params']>;
  'project.fileRevision': FromSchema<
    (typeof projectHarnessOperations)['project.fileRevision']['params']
  >;
  'project.linkArtifact': FromSchema<
    (typeof projectHarnessOperations)['project.linkArtifact']['params']
  >;
  'project.material': FromSchema<(typeof projectHarnessOperations)['project.material']['params']>;
  'project.path': FromSchema<(typeof projectHarnessOperations)['project.path']['params']>;
  'projects.list': FromSchema<(typeof projectHarnessOperations)['projects.list']['params']>;
};
export type Outputs = {
  'files.changes': FromSchema<(typeof projectHarnessOperations)['files.changes']['result']>;
  'files.edit': FromSchema<(typeof projectHarnessOperations)['files.edit']['result']>;
  'files.mkdir': FromSchema<(typeof projectHarnessOperations)['files.mkdir']['result']>;
  'files.operation': FromSchema<(typeof projectHarnessOperations)['files.operation']['result']>;
  'files.read': FromSchema<(typeof projectHarnessOperations)['files.read']['result']>;
  'files.readBytes': FromSchema<(typeof projectHarnessOperations)['files.readBytes']['result']>;
  'files.rename': FromSchema<(typeof projectHarnessOperations)['files.rename']['result']>;
  'files.resolve': FromSchema<(typeof projectHarnessOperations)['files.resolve']['result']>;
  'files.restore': FromSchema<(typeof projectHarnessOperations)['files.restore']['result']>;
  'files.trash': FromSchema<(typeof projectHarnessOperations)['files.trash']['result']>;
  'files.trashList': FromSchema<(typeof projectHarnessOperations)['files.trashList']['result']>;
  'project.artifacts': FromSchema<(typeof projectHarnessOperations)['project.artifacts']['result']>;
  'project.check': FromSchema<(typeof projectHarnessOperations)['project.check']['result']>;
  'project.fileRevision': FromSchema<
    (typeof projectHarnessOperations)['project.fileRevision']['result']
  >;
  'project.linkArtifact': FromSchema<
    (typeof projectHarnessOperations)['project.linkArtifact']['result']
  >;
  'project.material': FromSchema<(typeof projectHarnessOperations)['project.material']['result']>;
  'project.path': FromSchema<(typeof projectHarnessOperations)['project.path']['result']>;
  'projects.list': FromSchema<(typeof projectHarnessOperations)['projects.list']['result']>;
};
