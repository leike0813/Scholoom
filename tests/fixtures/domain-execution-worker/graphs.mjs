import { createRequire } from 'node:module';
import { callExecutionControl, ExecutionGraphs } from '../../../packages/harness/dist/node.js';
import { OperationError } from '../../../packages/protocol/dist/core.js';

const require = createRequire(new URL('../../../packages/harness/package.json', import.meta.url));
const { Annotation, Command, END, START, StateGraph, interrupt } = require('@langchain/langgraph');

export const graphs = new ExecutionGraphs([
  {
    definition: {
      graphId: 'durable-resource',
      version: '1',
      stateFormatVersion: '1',
      configSchema: {
        type: 'object',
        properties: { outputPath: { type: 'string' }, operationId: { type: 'string' } },
        required: ['outputPath', 'operationId'],
        additionalProperties: false,
      },
      waitSchemas: {
        approval: {
          type: 'object',
          properties: { approve: { const: true } },
          required: ['approve'],
          additionalProperties: false,
        },
      },
    },
    resume(_wait, messages) {
      const message = messages.at(-1);
      if (!message) return undefined;
      try {
        return { value: JSON.parse(message.text), instructionIds: [message.id] };
      } catch {
        return undefined;
      }
    },
    create(input, { peer, signal, checkpointer }) {
      if (!checkpointer)
        throw new OperationError('unavailable', 'Durable fixture needs its real checkpoint.');
      const material = input.graph.materials[0];
      const state = Annotation.Root({
        instructionIds: Annotation(),
        graphResume: Annotation(),
        graphWait: Annotation(),
        creation: Annotation(),
        approved: Annotation(),
      });
      const graph = new StateGraph(state)
        .addNode('create', async () => {
          const read = await callExecutionControl(peer, 'resources.read', {
            ref: material.ref,
            basis: material.basis,
            encoding: 'utf8',
          });
          const creation = await callExecutionControl(peer, 'resources.create', {
            projectId: input.graph.workDomain.projectId,
            path: input.graph.config.outputPath,
            operationId: input.graph.config.operationId,
            content: `# Durable result\n\n${read.data}`,
          });
          if (creation.state !== 'complete')
            throw new OperationError('outcomeUnknown', 'Creation requires reconciliation.');
          return { creation };
        })
        .addNode('approve', () => ({
          approved: interrupt({ prompt: 'Approve the saved result.' }),
        }))
        .addEdge(START, 'create')
        .addEdge('create', 'approve')
        .addEdge('approve', END)
        .compile({ checkpointer });
      const config = {
        configurable: { thread_id: input.attemptId },
        durability: 'sync',
        signal,
        callbacks: [],
      };
      let result;
      return {
        'execution.next': async () => {
          if (result) return result;
          if (input.model) {
            for (let i = 0; i < (input.graph.config.modelRequests ?? 1); i++) {
              const lease = await callExecutionControl(peer, 'model.acquire', {});
              await callExecutionControl(peer, 'model.release', lease);
            }
          }
          const before = await graph.getState(config);
          if (input.input) {
            await checkpointer.bindGraph(config, {
              instructionIds: input.input.instructionIds,
              graphResume: input.input,
            });
            const waiting = before.tasks.flatMap((task) => task.interrupts ?? []);
            if (waiting.some((item) => item.id === input.input.waitId))
              await graph.invoke(
                new Command({ resume: { [input.input.waitId]: input.input.value } }),
                config,
              );
            else await graph.invoke(null, config);
          } else if (before.createdAt) await graph.invoke(null, config);
          else await graph.invoke({ instructionIds: input.instructionIds ?? [] }, config);
          const current = await graph.getState(config);
          const pending = current.tasks.flatMap((task) => task.interrupts ?? [])[0];
          const creation = current.values.creation;
          const evidence = {
            inputs: input.graph.materials,
            reads: input.graph.materials,
            results: creation
              ? [
                  {
                    resource: creation.resource,
                    ...(creation.association ? { association: creation.association } : {}),
                  },
                ]
              : [],
            creations: creation ? [creation] : [],
          };
          if (pending) {
            const wait = {
              attemptId: input.attemptId,
              waitId: pending.id,
              nodeKey: 'approve',
              inputSchemaRef: 'approval',
              prompt: 'Approve the saved result.',
              checkpointRef: input.checkpointRef,
            };
            await checkpointer.bindGraph(config, { graphWait: wait });
            result = { done: true, graph: { kind: 'graph.waiting', wait, evidence } };
          } else
            result = {
              done: true,
              graph: { kind: 'graph.completed', attemptId: input.attemptId, evidence },
            };
          return result;
        },
      };
    },
  },
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
