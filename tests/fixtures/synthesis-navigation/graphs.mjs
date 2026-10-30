import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { setTimeout } from 'node:timers/promises';
import { linkTaskResearchArtifacts } from '../../../apps/kernel/dist/research-graphs/task-navigation.js';
import { callExecutionControl, ExecutionGraphs } from '../../../packages/harness/dist/node.js';
import { failure } from '../../../packages/platform/dist/node.js';
import { OperationError } from '../../../packages/protocol/dist/core.js';

const require = createRequire(new URL('../../../apps/kernel/package.json', import.meta.url));
const { Annotation, END, START, StateGraph } = require('@langchain/langgraph');

export const description = {
  definition: {
    graphId: 'scholoom.synthesis-navigation-fixture',
    version: '1',
    stateFormatVersion: '1',
    configSchema: {
      type: 'object',
      properties: {
        control: { type: 'string' },
        fault: { enum: ['conflict', 'unknown-before', 'unknown-after', 'permission'] },
        artifacts: { type: 'array' },
        targets: { type: 'array' },
      },
      required: ['control'],
      additionalProperties: false,
    },
    waitSchemas: {},
    requiresModel: true,
  },
  name: 'Task navigation fixture',
  description: 'Save synthetic files and exercise the production task navigation helper.',
  source: 'Scholoom test fixture',
  purpose: 'calibration',
  resources: [],
  delivery: { roles: ['report', 'process'] },
};

export const graphs = new ExecutionGraphs([
  {
    definition: description.definition,
    create(input, { peer, signal, checkpointer }) {
      const config = input.graph.config;
      const read = (resource) =>
        callExecutionControl(peer, 'resources.read', {
          ref: resource.ref,
          basis: resource.basis,
          encoding: 'utf8',
        });
      const observations = { resourceSaves: 0, taskSaves: 0 };
      const barrier = async (name) => {
        await writeFile(`${config.control}.${name}`, 'ready');
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
          signal.throwIfAborted();
          try {
            await readFile(`${config.control}.${name}-release`);
            return;
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
          await setTimeout(20, undefined, { signal });
        }
        throw new Error(`Timed out at ${name}`);
      };
      const navigationPeer = {
        request: async (method, args, options) => {
          if (method === 'execution.custom' && args.name === 'save_research_task') {
            observations.taskSaves++;
            if (config.fault === 'unknown-before')
              throw new OperationError('outcomeUnknown', 'Fixture lost the save request.');
            if (config.fault === 'permission')
              return JSON.stringify({
                error: { code: 'permissionDenied', message: 'Fixture denial.' },
              });
          }
          const result = await peer.request(method, args, options);
          if (
            method === 'execution.custom' &&
            args.name === 'read_research_task' &&
            config.fault === 'conflict'
          )
            await barrier('read');
          if (
            method === 'execution.custom' &&
            args.name === 'save_research_task' &&
            config.fault === 'unknown-after'
          )
            throw new OperationError('outcomeUnknown', 'Fixture lost the save receipt.');
          return result;
        },
      };
      const state = Annotation.Root({
        instructionIds: Annotation(),
        artifacts: Annotation(),
        navigation: Annotation(),
      });
      const graph = new StateGraph(state)
        .addNode('save', async () => {
          const snapshotEvidence = input.graph.materials.find((item) => item.role === 'task-input');
          if (!snapshotEvidence) throw new Error('Missing original task snapshot');
          const snapshot = JSON.parse((await read(snapshotEvidence)).data);
          const artifacts = config.artifacts ?? [];
          if (!config.artifacts) {
            for (const role of ['report', 'process']) {
              const target = config.targets?.find((item) => item.role === role)?.resource;
              if (target) await read(target);
              observations.resourceSaves++;
              const result = target
                ? await callExecutionControl(peer, 'resources.save', {
                    ...target,
                    content: `${role}: revised comparison and next steps`,
                  })
                : await callExecutionControl(peer, 'resources.create', {
                    projectId: snapshot.task.projectId,
                    operationId: `${input.originInstructionId}-${role}`,
                    path: `${input.originInstructionId}-${role}.md`,
                    content: `${role}: synthetic comparison, uncertainty and next steps`,
                  });
              if ('state' in result && result.state !== 'complete')
                throw new Error('Research file was not saved');
              const { resource, association, editId } = result;
              artifacts.push({
                role,
                result: {
                  resource,
                  ...(association ? { association } : {}),
                  ...(editId ? { editId } : {}),
                },
              });
            }
          }
          await writeFile(`${config.control}.artifacts.json`, JSON.stringify(artifacts));
          await barrier('saved');
          return { artifacts };
        })
        .addNode('navigate', async ({ artifacts }) => {
          const evidence = input.graph.materials.find((item) => item.role === 'task-input');
          const snapshot = JSON.parse((await read(evidence)).data);
          const navigation = await linkTaskResearchArtifacts(navigationPeer, snapshot, artifacts);
          await writeFile(
            `${config.control}.observed.json`,
            JSON.stringify({ ...observations, navigation }),
          );
          return { navigation };
        })
        .addEdge(START, 'save')
        .addEdge('save', 'navigate')
        .addEdge('navigate', END)
        .compile({ checkpointer });
      return {
        'execution.next': async () => {
          let value;
          let error;
          try {
            value = await graph.invoke(
              { instructionIds: input.instructionIds ?? [] },
              { configurable: { thread_id: input.attemptId }, durability: 'sync', signal },
            );
            if (value.navigation.state !== 'confirmed') error = value.navigation.error;
          } catch (caught) {
            signal.throwIfAborted();
            error = failure(caught);
          }
          return {
            done: true,
            graph: {
              kind: error ? 'graph.failed' : 'graph.completed',
              attemptId: input.attemptId,
              ...(error ? { error } : {}),
              evidence: {
                inputs: input.graph.materials,
                reads: [],
                results: [],
                roleResults: value?.artifacts ?? [],
              },
            },
          };
        },
      };
    },
  },
]);
