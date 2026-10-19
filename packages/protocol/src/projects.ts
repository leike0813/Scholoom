import type {
  artifactSchema,
  backupSchema,
  fileEntrySchema,
  fileLocationSchema,
  fileOperationSchema,
  fileSchema,
  projectHarnessOperations,
  projectMaterialOperations,
  projectSchema,
  projectsOperations,
} from './project-contracts.js';

export * from './project-contracts.js';

import type { FromSchema } from 'json-schema-to-ts';
import type { ContractParams, ContractResult } from './core.js';
import type {
  Inputs as ExecutionInputs,
  Outputs as ExecutionOutputs,
} from './project-execution-types.js';
import type { editSchema, projectExecutionOperations } from './project-file-contracts.js';
import type {
  Inputs as HarnessProjectInputs,
  Outputs as HarnessProjectOutputs,
} from './project-harness-types.js';

export { editSchema, projectExecutionOperations } from './project-file-contracts.js';

export type Project = FromSchema<typeof projectSchema>;
export type FileEntry = FromSchema<typeof fileEntrySchema>;
export type FileContent = FromSchema<typeof fileSchema>;
export type FileEdit = FromSchema<typeof editSchema>;
export type FileLocation = FromSchema<typeof fileLocationSchema>;
export type FileOperation = FromSchema<typeof fileOperationSchema>;
export type Artifact = FromSchema<typeof artifactSchema>;
export type ProjectBackup = FromSchema<typeof backupSchema>;
export type ProjectsInputs = {
  [M in keyof typeof projectsOperations]: FromSchema<(typeof projectsOperations)[M]['params']>;
};
export type ProjectsOutputs = {
  [M in keyof typeof projectsOperations]: FromSchema<(typeof projectsOperations)[M]['result']>;
};
export type ProjectMaterial = ContractResult<
  (typeof projectMaterialOperations)['project.material']
>;
export type ProjectMaterialInputs = {
  'project.checkRead': ContractParams<(typeof projectMaterialOperations)['project.checkRead']>;
  'project.material': ContractParams<(typeof projectMaterialOperations)['project.material']>;
};
export type ProjectMaterialOutputs = {
  'project.checkRead': ContractResult<(typeof projectMaterialOperations)['project.checkRead']>;
  'project.material': ProjectMaterial;
};
export type ProjectMaterialPort = {
  [M in keyof ProjectMaterialInputs]: (
    input: ProjectMaterialInputs[M],
  ) => Promise<ProjectMaterialOutputs[M]>;
};

type CompleteExecution<T extends Record<keyof typeof projectExecutionOperations, unknown>> = T;
export type ProjectExecutionInputs = CompleteExecution<ExecutionInputs>;
export type ProjectExecutionOutputs = CompleteExecution<ExecutionOutputs>;
type FileInputs = Pick<ProjectsInputs, 'files.list' | 'files.read'> &
  ProjectExecutionInputs &
  Pick<ProjectMaterialInputs, 'project.material'>;
type FileOutputs = Pick<ProjectsOutputs, 'files.list' | 'files.read'> &
  ProjectExecutionOutputs &
  Pick<ProjectMaterialOutputs, 'project.material'>;
export type ProjectFilePort = {
  [M in keyof FileInputs]: (input: FileInputs[M]) => Promise<FileOutputs[M]>;
};
export type ResearchProjectPort = Pick<
  ProjectFilePort,
  'project.check' | 'project.path' | 'project.material' | 'files.read'
> & {
  'files.resolve': (
    input: ProjectsInputs['files.resolve'],
  ) => Promise<ProjectsOutputs['files.resolve']>;
};

type CompleteHarness<T extends Record<keyof typeof projectHarnessOperations, unknown>> = T;
export type ProjectHarnessInputs = CompleteHarness<HarnessProjectInputs>;
export type ProjectHarnessOutputs = CompleteHarness<HarnessProjectOutputs>;
export type HarnessProjectPort = {
  [M in Exclude<keyof ProjectHarnessInputs, 'project.fileRevision'>]: (
    input: ProjectHarnessInputs[M],
  ) => Promise<ProjectHarnessOutputs[M]>;
};
