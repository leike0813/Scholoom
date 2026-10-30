import { ExecutionGraphs } from '@scholoom/harness/worker';
import { researchGraphFactories } from './research-graphs/index.js';

export const executionGraphs = new ExecutionGraphs(researchGraphFactories);
