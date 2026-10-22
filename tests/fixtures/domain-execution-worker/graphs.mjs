import { createRequire } from 'node:module';
import { callExecutionControl, ExecutionGraphs } from '../../../packages/harness/dist/node.js';
import { OperationError } from '../../../packages/protocol/dist/core.js';

const require = createRequire(new URL('../../../packages/harness/package.json', import.meta.url));
const { Annotation, END, START, StateGraph } = require('@langchain/langgraph');

export const graphs = new ExecutionGraphs([
  {
    definition: {
      graphId: 'fixed-counter',
      version: '1',
      stateFormatVersion: '1',
      configSchema: {
        type: 'object',
        properties: { seed: { type: 'integer', minimum: 0, maximum: 100 } },
        required: ['seed'],
        additionalProperties: false,
      },
    },
    create(input, { peer, signal }) {
      if (input.input)
        throw new OperationError('unavailable', 'Counter fixture has no resume input.');
      const state = Annotation.Root({ value: Annotation() });
      const graph = new StateGraph(state)
        .addNode('increment', ({ value }) => ({ value: value + 1 }))
        .addNode('report', async ({ value }) => {
          await callExecutionControl(peer, 'execution.custom', {
            name: 'fixed-node',
            args: { value },
          });
          return {};
        })
        .addEdge(START, 'increment')
        .addEdge('increment', 'report')
        .addEdge('report', END)
        .compile();
      let completed = false;
      return {
        'execution.next': async () => {
          if (!completed) {
            await graph.invoke({ value: input.graph.config.seed }, { signal, callbacks: [] });
            completed = true;
          }
          return {
            done: true,
            graph: {
              kind: 'graph.completed',
              attemptId: input.attemptId,
              evidence: { inputs: [], reads: [], results: [] },
            },
          };
        },
      };
    },
  },
]);
