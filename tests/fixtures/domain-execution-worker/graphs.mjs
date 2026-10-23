import { createRequire } from 'node:module';
import { callExecutionControl, ExecutionGraphs } from '../../../packages/harness/dist/node.js';
import { createExecutionModel } from '../../../packages/models/dist/execution.js';
import { OperationError } from '../../../packages/protocol/dist/core.js';
import { instructionContextsSchema } from '../../../packages/protocol/dist/workbench-context.js';

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
        properties: {
          outputPath: { type: 'string' },
          operationId: { type: 'string' },
          retainInstructionIds: { type: 'boolean' },
        },
        required: ['outputPath', 'operationId'],
        additionalProperties: false,
      },
      waitSchemas: {
        approval: {
          type: 'object',
          properties: { approve: { const: true }, instructions: instructionContextsSchema },
          required: ['approve'],
          additionalProperties: false,
        },
      },
    },
    resume(_wait, messages) {
      for (const message of messages) {
        try {
          const value = JSON.parse(message.text);
          if (value.approve !== true) continue;
          const { id, ...instruction } = message;
          return { value: { ...value, instructions: [instruction] }, instructionIds: [id] };
        } catch {
          /* Unmatched messages remain pending. */
        }
      }
      return undefined;
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
        contextReads: Annotation(),
        contextCreation: Annotation(),
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
        .addNode('context', async ({ approved }) => {
          const instructions = input.instructions ?? [];
          if (!instructions.some((item) => item.contextItems?.length || item.materials?.length))
            return {};
          if (JSON.stringify(approved.instructions) !== JSON.stringify(instructions))
            throw new OperationError('invalidRequest', 'Resume mapping lost instruction context.');
          const reads = [];
          for (const instruction of instructions) {
            for (const item of instruction.contextItems ?? [])
              reads.push(
                await callExecutionControl(peer, 'resources.read', {
                  ref: item.ref,
                  basis: item.basis,
                  encoding: 'utf8',
                }),
              );
            for (const [index, path] of (instruction.materials ?? []).entries()) {
              const resource = await callExecutionControl(peer, 'resources.describe', {
                locator: {
                  source: 'project',
                  projectId: input.graph.workDomain.projectId,
                  ...(instruction.materialFileIds?.[index]
                    ? { fileId: instruction.materialFileIds[index] }
                    : { path }),
                },
              });
              reads.push(
                await callExecutionControl(peer, 'resources.read', {
                  ref: resource.ref,
                  basis: resource.basis,
                  encoding: 'utf8',
                }),
              );
            }
          }
          const content = JSON.stringify({ instructions, reads });
          if (input.model) {
            const model = createExecutionModel(input.model, signal, {
              acquire: async () => (await callExecutionControl(peer, 'model.acquire', {})).leaseId,
              release: (leaseId) => {
                void callExecutionControl(peer, 'model.release', { leaseId });
              },
            });
            await model.invoke(content);
          }
          const creation = await callExecutionControl(peer, 'resources.create', {
            projectId: input.graph.workDomain.projectId,
            path: `${input.graph.config.outputPath}.context.md`,
            operationId: `${input.graph.config.operationId}-context`,
            content,
          });
          if (creation.state !== 'complete')
            throw new OperationError('outcomeUnknown', 'Context output unknown.');
          return {
            contextReads: reads.map(({ ref, basis }) => ({ ref, basis })),
            contextCreation: creation,
          };
        })
        .addEdge(START, 'create')
        .addEdge('create', 'approve')
        .addEdge('approve', 'context')
        .addEdge('context', END)
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
              instructionIds: [
                ...new Set([
                  ...(input.graph.config.retainInstructionIds
                    ? (before.values.instructionIds ?? [])
                    : []),
                  ...input.input.instructionIds,
                ]),
              ],
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
            inputs: [
              ...input.graph.materials,
              ...(input.instructions ?? []).flatMap((item) =>
                (item.contextItems ?? []).map(({ ref, basis }) => ({ ref, basis })),
              ),
            ],
            reads: [...input.graph.materials, ...(current.values.contextReads ?? [])],
            results: creation
              ? [
                  {
                    resource: creation.resource,
                    ...(creation.association ? { association: creation.association } : {}),
                  },
                ]
              : [],
            creations: [creation, current.values.contextCreation].filter(Boolean),
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
      graphId: 'terminal-context',
      version: '1',
      stateFormatVersion: '1',
      configSchema: { type: 'object', additionalProperties: false },
    },
    create(input, { peer, signal, checkpointer }) {
      if (!checkpointer) throw new OperationError('unavailable', 'Checkpoint required.');
      const state = Annotation.Root({ instructionIds: Annotation(), creation: Annotation() });
      const graph = new StateGraph(state)
        .addNode('deliver', async () => ({
          creation: await callExecutionControl(peer, 'resources.create', {
            projectId: input.graph.workDomain.projectId,
            path: 'terminal.md',
            operationId: 'terminal-result',
            content: JSON.stringify(input.instructions),
          }),
          instructionIds: input.instructionIds,
        }))
        .addEdge(START, 'deliver')
        .addEdge('deliver', END)
        .compile({ checkpointer });
      const config = {
        configurable: { thread_id: input.attemptId },
        signal,
        durability: 'sync',
        callbacks: [],
      };
      return {
        'execution.next': async () => {
          const before = await graph.getState(config);
          await graph.invoke(before.createdAt ? null : { instructionIds: [] }, config);
          const after = await graph.getState(config);
          return {
            done: true,
            graph: {
              kind: 'graph.completed',
              attemptId: input.attemptId,
              evidence: {
                inputs: input.graph.materials,
                reads: [],
                results: [],
                creations: [after.values.creation],
              },
            },
          };
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
