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
  {
    definition: {
      graphId: 'fixed-resource',
      version: '1',
      stateFormatVersion: '1',
      configSchema: {
        type: 'object',
        properties: {
          outputPath: { type: 'string', minLength: 1 },
          operationId: { type: 'string', minLength: 1 },
        },
        required: ['outputPath', 'operationId'],
        additionalProperties: false,
      },
    },
    create(input, { peer, signal }) {
      if (input.input)
        throw new OperationError('unavailable', 'Resource fixture has no resume input.');
      const material = input.graph.materials[0];
      if (!material)
        throw new OperationError('invalidRequest', 'Resource fixture needs one material.');
      const { outputPath, operationId } = input.graph.config;
      const projectId = input.graph.workDomain.projectId;
      const state = Annotation.Root({ data: Annotation(), creation: Annotation() });
      const graph = new StateGraph(state)
        .addNode('read', async () => {
          const read = await callExecutionControl(peer, 'resources.read', {
            ref: material.ref,
            basis: material.basis,
            encoding: 'utf8',
          });
          return { data: read.data };
        })
        .addNode('create', async ({ data }) => {
          const creation = await callExecutionControl(peer, 'resources.create', {
            projectId,
            path: outputPath,
            operationId,
            content: `# Graph result\n\n${data}`,
          });
          if (creation.state !== 'complete')
            throw new OperationError('outcomeUnknown', 'Resource creation did not complete.');
          return { creation };
        })
        .addEdge(START, 'read')
        .addEdge('read', 'create')
        .addEdge('create', END)
        .compile();
      let evidence;
      return {
        'execution.next': async () => {
          if (!evidence) {
            const final = await graph.invoke(
              { data: '', creation: undefined },
              { signal, callbacks: [] },
            );
            const creation = final.creation;
            evidence = {
              inputs: input.graph.materials,
              reads: input.graph.materials,
              results: [
                {
                  resource: creation.resource,
                  ...(creation.association ? { association: creation.association } : {}),
                },
              ],
              creations: [creation],
            };
          }
          return {
            done: true,
            graph: {
              kind: 'graph.completed',
              attemptId: input.attemptId,
              evidence,
            },
          };
        },
      };
    },
  },
]);
