import { executionFileOperations } from './execution-files.js';
import { executionGraphOperations } from './execution-graph.js';
import { executionOperations } from './harness.js';
import { modelAdmissionOperations } from './models.js';
import {
  resourceCreationOperations,
  resourceOperations,
  resourceSaveResultSchema,
} from './resources.js';

// The host binds instance, run and shared budget through the owned IPC connection.
export const executionControlOperations = {
  'resources.describe': resourceOperations['resources.describe'],
  'resources.read': resourceOperations['resources.read'],
  'resources.document': resourceOperations['resources.document'],
  'resources.save': { ...resourceOperations['resources.save'], result: resourceSaveResultSchema },
  ...resourceCreationOperations,
  ...executionFileOperations,
  ...executionGraphOperations,
  'execution.files.upload': executionOperations['execution.files.upload'],
  'execution.files.download': executionOperations['execution.files.download'],
  'execution.health': executionOperations['execution.health'],
  'execution.stop': executionOperations['execution.stop'],
  'execution.consume': executionOperations['execution.consume'],
  ...modelAdmissionOperations,
} as const;
