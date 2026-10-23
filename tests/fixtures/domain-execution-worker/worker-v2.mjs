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
export const upgraded = new ExecutionGraphs([
  { ...factory, definition: { ...factory.definition, version: '2', stateFormatVersion: '2' } },
]);
if (process.send) startExecutionWorker(upgraded);
