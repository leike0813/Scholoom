import { startExecutionWorker } from '@scholoom/harness/worker';
import { executionGraphs } from './execution-graphs.js';

startExecutionWorker(executionGraphs);
