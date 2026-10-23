import { ExecutionGraphs, startExecutionWorker } from '../../../packages/harness/dist/node.js';
import { graphs } from './graphs.mjs';

const factory = graphs.resolve({
  kind: 'registered',
  graphId: 'durable-resource',
  version: '1',
  config: { outputPath: 'unused', operationId: 'unused' },
  materials: [],
  workDomain: { kind: 'project', projectId: 'fixture', sessionId: 'fixture' },
});
export const modelGraphs = new ExecutionGraphs([
  {
    ...factory,
    definition: {
      ...factory.definition,
      requiresModel: true,
      configSchema: {
        ...factory.definition.configSchema,
        properties: {
          ...factory.definition.configSchema.properties,
          modelRequests: { type: 'integer', minimum: 1, maximum: 33 },
        },
      },
    },
  },
]);
if (process.send) startExecutionWorker(modelGraphs);
