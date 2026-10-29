import { createRequire } from 'node:module';
import { callExecutionControl, ExecutionGraphs } from '../../../packages/harness/dist/node.js';
import { OperationError } from '../../../packages/protocol/dist/core.js';
import { graphArtifactOperation } from '../../../packages/research/dist/node.js';

const require = createRequire(new URL('../../../packages/harness/package.json', import.meta.url));
const { Annotation, Command, END, START, StateGraph, interrupt } = require('@langchain/langgraph');

export const description = {
  definition: {
    graphId: 'scholoom.test.report-reconnection',
    version: '1',
    stateFormatVersion: '1',
    requiresModel: false,
    configSchema: {
      type: 'object',
      properties: { mode: { enum: ['publish', 'read-saved'] } },
      required: ['mode'],
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
  },
  name: 'Report reconnection mechanism fixture',
  description: 'Publish an actual report, wait, and read saved evidence without a model.',
  source: 'Scholoom tests/fixtures/report-reconnection',
  purpose: 'calibration',
  resources: [],
  delivery: { roles: ['report'] },
};

export const graphs = new ExecutionGraphs([
  {
    definition: description.definition,
    resume(_wait, messages) {
      for (const message of messages) {
        try {
          const value = JSON.parse(message.text);
          if (value.confirm === true && Object.keys(value).length === 1)
            return { value, instructionIds: [message.id] };
        } catch {
          // Unmatched instructions remain pending under the real host policy.
        }
      }
      return undefined;
    },
    create(input, { peer, signal, checkpointer }) {
      if (!checkpointer) throw new OperationError('unavailable', 'Real checkpoint required.');
      const projectId = input.graph.workDomain.projectId;
      const read = async (evidence) => {
        const result = await callExecutionControl(peer, 'resources.read', {
          ref: evidence.ref,
          basis: evidence.basis,
          encoding: 'utf8',
        });
        if (result.truncated || result.nextOffset !== undefined)
          throw new OperationError('tooLarge', 'Fixture requires the complete small input.');
        return result;
      };
      const create = async (role, path, content) => {
        const value = await callExecutionControl(peer, 'resources.create', {
          projectId,
          operationId: graphArtifactOperation(input.originInstructionId, role),
          path,
          content,
        });
        if (value.state !== 'complete' || value.association?.state !== 'confirmed')
          throw new OperationError('outcomeUnknown', 'Save and association need reconciliation.');
        return value;
      };
      const state = Annotation.Root({
        instructionIds: Annotation(),
        graphResume: Annotation(),
        graphWait: Annotation(),
        reads: Annotation(),
        report: Annotation(),
        continuation: Annotation(),
      });
      const graph = new StateGraph(state)
        .addNode('publish', async () => {
          const reads = [];
          for (const material of input.graph.materials) reads.push(await read(material));
          if (input.graph.config.mode === 'read-saved') {
            return {
              reads,
              continuation: await create('fresh-read', 'fresh-read.json', JSON.stringify(reads)),
            };
          }
          const [data, source] = reads;
          if (data?.ref.source !== 'project' || source?.ref.source !== 'library')
            throw new OperationError('invalidRequest', 'Expected project data and library source.');
          const doses = JSON.parse(data.data);
          if (JSON.stringify(doses) !== '[10,20]')
            throw new OperationError('invalidRequest', 'Unexpected fixed synthetic sample.');
          const manifest = {
            version: 1,
            resources: [
              {
                path: 'assets/data.json',
                ref: data.ref,
                basis: data.basis,
                mediaType: 'application/json',
              },
            ],
            sources: [{ ref: source.ref, basis: source.basis }],
            objects: [
              {
                objectId: 'dose',
                name: 'Doses',
                semantics: 'Compare doses 10 and 20',
                sourceIndexes: [0],
              },
            ],
          };
          // Independent wire sample, as in report.ts; not Markdown with a renamed extension.
          const header = JSON.stringify(manifest)
            .replaceAll('<', '\\u003c')
            .replaceAll('>', '\\u003e')
            .replaceAll('-', '\\u002d');
          const html = `<!--scholoom-report-v1\n${header}\n-->\n<!doctype html><html><body><h1>Fixed dose comparison</h1><table><tr><th>Dose</th></tr>${doses.map((dose) => `<tr><td>${dose}</td></tr>`).join('')}</table><p>Next step: verify dose 20 against the declared source.</p></body></html>`;
          return { reads, report: await create('report', 'report.html', html) };
        })
        .addNode('confirm', () => {
          interrupt({ prompt: 'Confirm the saved report before continuing.' });
          return {};
        })
        .addNode('continue', async ({ report }) => {
          const reads = [await read(report.resource)];
          for (const material of input.graph.materials) reads.push(await read(material));
          return {
            continuation: await create(
              'continuation',
              'continuation.json',
              JSON.stringify({
                waitId: input.input?.waitId,
                instructions: input.instructions,
                reads,
              }),
            ),
          };
        })
        .addEdge(START, 'publish')
        .addConditionalEdges('publish', () =>
          input.graph.config.mode === 'publish' ? 'confirm' : END,
        )
        .addEdge('confirm', 'continue')
        .addEdge('continue', END)
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
            const pending = before.tasks.flatMap((task) => task.interrupts ?? []);
            await graph.invoke(
              pending.some((item) => item.id === input.input.waitId)
                ? new Command({ resume: { [input.input.waitId]: input.input.value } })
                : null,
              config,
            );
          } else
            await graph.invoke(
              before.createdAt ? null : { instructionIds: input.instructionIds ?? [] },
              config,
            );
          const current = await graph.getState(config);
          const creations = [current.values.report, current.values.continuation].filter(Boolean);
          const evidence = {
            inputs: input.graph.materials,
            reads: (current.values.reads ?? []).map(({ ref, basis }) => ({ ref, basis })),
            results: creations.map((value) => ({
              resource: value.resource,
              association: value.association,
            })),
            creations,
          };
          const pending = current.tasks.flatMap((task) => task.interrupts ?? [])[0];
          if (pending) {
            const wait = {
              attemptId: input.attemptId,
              waitId: pending.id,
              nodeKey: 'confirm',
              inputSchemaRef: 'confirmation',
              prompt: 'Confirm the saved report before continuing.',
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
]);
