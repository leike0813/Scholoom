import { createRequire } from 'node:module';
import { callExecutionControl, ExecutionGraphs } from '../../../packages/harness/dist/node.js';
import { failure } from '../../../packages/platform/dist/node.js';
import { OperationError } from '../../../packages/protocol/dist/core.js';
import {
  assessGraphDelivery,
  completeTextRead,
  graphArtifactOperation,
} from '../../../packages/research/dist/node.js';

const require = createRequire(new URL('../../../apps/kernel/package.json', import.meta.url));
const { Annotation, Command, END, START, StateGraph, interrupt } = require('@langchain/langgraph');

export const description = {
  definition: {
    graphId: 'scholoom.calibration',
    version: '1',
    stateFormatVersion: '1',
    configSchema: {
      type: 'object',
      properties: {
        outputPath: { type: 'string', minLength: 1, maxLength: 1024 },
        goal: { type: 'string', minLength: 1, maxLength: 4096 },
      },
      required: ['outputPath', 'goal'],
      additionalProperties: false,
    },
    waitSchemas: {
      confirmation: {
        type: 'object',
        properties: { confirm: { const: true } },
        required: ['confirm'],
        additionalProperties: false,
      },
    },
    requiresModel: false,
  },
  name: 'Research graph calibration',
  description: 'Read synthetic materials, create a report and wait for confirmation.',
  source: 'Scholoom test fixture',
  purpose: 'calibration',
  resources: [
    { nodeKey: 'read', resourceId: 'fixture', source: 'tests/fixtures/research-graph-worker' },
  ],
  delivery: { roles: ['report'] },
};

export const graphs = new ExecutionGraphs([
  {
    definition: description.definition,
    resume(_wait, messages) {
      for (const message of messages) {
        try {
          const value = JSON.parse(message.text);
          if (value?.confirm === true && Object.keys(value).length === 1)
            return { value, instructionIds: [message.id] };
        } catch {
          /* Unmatched messages remain pending. */
        }
      }
      return undefined;
    },
    create(input, { peer, signal, checkpointer }) {
      if (!checkpointer || !input.originInstructionId)
        throw new OperationError(
          'unavailable',
          'Calibration needs a checkpoint and root identity.',
        );
      const state = Annotation.Root({
        instructionIds: Annotation(),
        graphResume: Annotation(),
        graphWait: Annotation(),
        operationId: Annotation(),
        reads: Annotation(),
        creation: Annotation(),
        reportRead: Annotation(),
        confirmed: Annotation(),
        error: Annotation(),
      });
      const read = (resource) =>
        callExecutionControl(peer, 'resources.read', {
          ref: resource.ref,
          basis: resource.basis,
          encoding: 'utf8',
        });
      const failed = (error) => {
        signal.throwIfAborted();
        return failure(error);
      };
      // Keep confirmed effects if their checkpoint acknowledgement fails.
      const observed = {};
      const evidence = (value) => ({
        inputs: input.graph.materials,
        reads: (value.reads ?? []).map(({ ref, basis }) => ({ ref, basis })),
        results: value.creation?.resource
          ? [
              {
                resource: value.creation.resource,
                ...(value.creation.association ? { association: value.creation.association } : {}),
              },
            ]
          : [],
        creations: value.creation ? [value.creation] : [],
      });
      const graph = new StateGraph(state)
        .addNode('identify', () => ({
          operationId: graphArtifactOperation(input.originInstructionId, 'report'),
        }))
        .addNode('read', async () => {
          const reads = [];
          observed.reads = reads;
          try {
            for (const material of input.graph.materials) {
              const result = await read(material);
              if (!completeTextRead(result))
                throw new OperationError('unavailable', 'Calibration requires complete text.');
              reads.push(result);
            }
            return { reads };
          } catch (error) {
            return { reads, error: failed(error) };
          }
        })
        .addNode('create', async ({ operationId, reads }) => {
          let creation;
          let reportRead;
          try {
            const projectId = input.graph.workDomain.projectId;
            try {
              creation = await callExecutionControl(peer, 'resources.creation', {
                projectId,
                operationId,
              });
            } catch (error) {
              if (error.code !== 'notFound') throw error;
              creation = await callExecutionControl(peer, 'resources.create', {
                projectId,
                operationId,
                path: input.graph.config.outputPath,
                content: [
                  '# Mechanism calibration',
                  input.graph.config.goal,
                  ...reads.map((item) => item.data),
                ].join('\n\n'),
              });
            }
            observed.creation = creation;
            if (creation.state !== 'complete')
              throw new OperationError('unavailable', 'Original creation needs reconciliation.');
            reportRead = await read(creation.resource);
            if (creation.association?.state !== 'confirmed' || !completeTextRead(reportRead))
              throw new OperationError('unavailable', 'Saved report is not fully delivered.');
            return { creation, reportRead };
          } catch (error) {
            return { creation, reportRead, error: failed(error) };
          }
        })
        .addNode('confirm', () => ({ confirmed: interrupt({ prompt: 'Confirm calibration.' }) }))
        .addNode('check', async (value) => {
          try {
            const reportRead = await read(value.creation.resource);
            const progress = {
              kind: 'graph.completed',
              attemptId: input.attemptId,
              evidence: evidence(value),
            };
            const check = assessGraphDelivery(description, input.graph.materials, progress, {
              reads: value.reads,
              artifacts: [{ role: 'report', result: value.creation, read: reportRead }],
            });
            if (check.delivery !== 'usable')
              throw new OperationError('unavailable', 'Calibration delivery check failed.');
            return { reportRead };
          } catch (error) {
            return { error: failed(error) };
          }
        })
        .addEdge(START, 'identify')
        .addEdge('identify', 'read')
        .addConditionalEdges('read', ({ error }) => (error ? END : 'create'))
        .addConditionalEdges('create', ({ error }) => (error ? END : 'confirm'))
        .addEdge('confirm', 'check')
        .addEdge('check', END)
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
          let error;
          try {
            const before = await graph.getState(config);
            if (input.input) {
              await checkpointer.bindGraph(config, {
                instructionIds: [
                  ...new Set([
                    ...(before.values.instructionIds ?? []),
                    ...input.input.instructionIds,
                  ]),
                ],
                graphResume: input.input,
              });
              const waiting = before.tasks.flatMap((task) => task.interrupts ?? []);
              await graph.invoke(
                waiting.some((item) => item.id === input.input.waitId)
                  ? new Command({ resume: { [input.input.waitId]: input.input.value } })
                  : null,
                config,
              );
            } else
              await graph.invoke(
                before.createdAt ? null : { instructionIds: input.instructionIds ?? [] },
                config,
              );
          } catch (caught) {
            error = failed(caught);
          }
          const current = await graph.getState(config);
          const actualEvidence = evidence({ ...current.values, ...observed });
          error ??= current.values.error;
          const pending = current.tasks.flatMap((task) => task.interrupts ?? [])[0];
          let progress;
          if (error)
            progress = {
              kind: 'graph.failed',
              attemptId: input.attemptId,
              error,
              evidence: actualEvidence,
            };
          else if (pending) {
            const wait = {
              attemptId: input.attemptId,
              waitId: pending.id,
              nodeKey: 'confirm',
              inputSchemaRef: 'confirmation',
              prompt: 'Confirm calibration.',
              checkpointRef: input.checkpointRef,
            };
            await checkpointer.bindGraph(config, { graphWait: wait });
            progress = { kind: 'graph.waiting', wait, evidence: actualEvidence };
          } else
            progress = {
              kind: 'graph.completed',
              attemptId: input.attemptId,
              evidence: actualEvidence,
            };
          result = { done: true, graph: progress };
          return result;
        },
      };
    },
  },
]);
