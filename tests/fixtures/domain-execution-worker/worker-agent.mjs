import { appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ExecutionGraphs, startExecutionWorker } from '../../../packages/harness/dist/node.js';

const require = createRequire(new URL('../../../packages/harness/package.json', import.meta.url));
const { Annotation, MessagesAnnotation, END, START, StateGraph } = require('@langchain/langgraph');

export const agentGraphs = new ExecutionGraphs([
  {
    definition: {
      graphId: 'registered-agent',
      version: '1',
      stateFormatVersion: '1',
      requiresModel: true,
      configSchema: { type: 'object', additionalProperties: false },
    },
    create(input, { signal, checkpointer, agent }) {
      const state = Annotation.Root({
        ...MessagesAnnotation.spec,
        instructionIds: Annotation(),
        instructionRunId: Annotation(),
        instructions: Annotation(),
      });
      const graph = new StateGraph(state)
        .addNode('agent', async (value, config) => {
          await appendFile(
            `${input.checkpointPath}.consumer-entries.jsonl`,
            `${JSON.stringify({
              taskId: config.configurable.__pregel_task_id,
              namespace: config.configurable.checkpoint_ns,
              parents: config.configurable.checkpoint_map,
            })}\n`,
          );
          return agent.invoke(value, config, {
            tools: ['write_file'],
            systemPrompt:
              'Use the specified synthetic file once and preserve the full instructions.',
          });
        })
        .addEdge(START, 'agent')
        .addEdge('agent', END)
        .compile({ checkpointer });
      const config = {
        configurable: { thread_id: input.attemptId },
        durability: 'sync',
        signal,
        callbacks: [],
      };
      return {
        'execution.next': async () => {
          const before = await graph.getState(config);
          await graph.invoke(
            before.createdAt
              ? null
              : {
                  messages: [],
                  instructionIds: input.instructionIds,
                  instructionRunId: input.attemptId,
                  instructions: input.instructions,
                },
            config,
          );
          return {
            done: true,
            graph: {
              kind: 'graph.completed',
              attemptId: input.attemptId,
              evidence: { inputs: input.graph.materials, reads: [], results: [] },
            },
          };
        },
      };
    },
  },
]);

if (process.send) startExecutionWorker(agentGraphs);
