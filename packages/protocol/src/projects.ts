import { Ajv } from 'ajv';
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

export * from './file-explorer-contracts.js';
export * from './project-contracts.js';
export * from './task-contracts.js';
export { taskOperations as projectTaskOperations } from './task-contracts.js';
export * from './work-domains.js';

import type { FromSchema } from 'json-schema-to-ts';
import type {
  importEntrySchema,
  transferEntrySchema,
  transferSchema,
  transferSourceSchema,
} from './file-explorer-contracts.js';
export type FileTransfer = FromSchema<typeof transferSchema>;
export type TransferEntry = FromSchema<typeof transferEntrySchema>;
export type TransferSource = FromSchema<typeof transferSourceSchema>;
export type ImportEntry = FromSchema<typeof importEntrySchema>;

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
import type {
  Inputs as TargetReadInputs,
  Outputs as TargetReadOutputs,
} from './project-target-read-types.js';
import {
  type taskLinkSchema,
  taskMetadataSchema,
  type taskOperations,
  type taskReadSchema,
  type taskRefSchema,
  type taskStatusSchema,
  type taskSummarySchema,
  type taskWorkItemSchema,
} from './task-contracts.js';
import type { projectTargetReadOperations } from './work-domains.js';

export { editSchema, projectExecutionOperations } from './project-file-contracts.js';

export type Project = FromSchema<typeof projectSchema>;
export type FileEntry = FromSchema<typeof fileEntrySchema>;
export type FileContent = FromSchema<typeof fileSchema>;
export type FileEdit = FromSchema<typeof editSchema>;
export type FileLocation = FromSchema<typeof fileLocationSchema>;
export type FileOperation = FromSchema<typeof fileOperationSchema>;
export type Artifact = FromSchema<typeof artifactSchema>;
export type ProjectBackup = FromSchema<typeof backupSchema>;
export type TaskMetadata = FromSchema<typeof taskMetadataSchema>;
export type TaskRef = FromSchema<typeof taskRefSchema>;
export type TaskStatus = FromSchema<typeof taskStatusSchema>;
export type TaskWorkItem = FromSchema<typeof taskWorkItemSchema>;
export type TaskLink = FromSchema<typeof taskLinkSchema>;
export type TaskSummary = FromSchema<typeof taskSummarySchema>;
export type TaskRead = FromSchema<typeof taskReadSchema>;
export type ProjectTaskInputs = {
  [M in keyof typeof taskOperations]: FromSchema<(typeof taskOperations)[M]['params']>;
};
export type ProjectTaskOutputs = {
  [M in keyof typeof taskOperations]: FromSchema<(typeof taskOperations)[M]['result']>;
};
export type TaskPort = {
  [M in keyof ProjectTaskInputs as M extends `tasks.${infer Name}` ? Name : never]: (
    input: ProjectTaskInputs[M],
  ) => Promise<ProjectTaskOutputs[M]>;
};
export const isTaskMetadata = new Ajv().compile<TaskMetadata>(taskMetadataSchema);

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

type CompleteTargetRead<T extends Record<keyof typeof projectTargetReadOperations, unknown>> = T;
export type ProjectTargetReadInputs = CompleteTargetRead<TargetReadInputs>;
export type ProjectTargetReadOutputs = CompleteTargetRead<TargetReadOutputs>;
export type ProjectTargetReadPort = {
  [M in keyof ProjectTargetReadInputs]: (
    input: ProjectTargetReadInputs[M],
  ) => Promise<ProjectTargetReadOutputs[M]>;
};
