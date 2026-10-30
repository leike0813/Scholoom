import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { isBaseMessage, ToolMessage } from '@langchain/core/messages';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';
import { Command, isCommand } from '@langchain/langgraph';
import { RpcPeer } from '@scholoom/broker/rpc';
import { createExecutionModel, modelFailure } from '@scholoom/models/execution';
import { OperationError } from '@scholoom/protocol/core';
import {
  type ExecutionControlInputs,
  type ExecutionControlProviders,
  type FrameworkMessage,
  type FrameworkToolResult,
  type InstructionContext,
  isExecutionControlCall,
  isExecutionControlMethod,
  isExecutionControlResult,
} from '@scholoom/protocol/execution';
import Database from 'better-sqlite3';
import { createDeepAgent, registerHarnessProfile } from 'deepagents';
import { createMiddleware, tool as defineTool } from 'langchain';
import { z } from 'zod';
import { InstructionSaver } from './checkpoint.js';
import { callExecutionControl } from './control.js';
import { executionFiles } from './files.js';
import { decodeFrameworkMessage, encodeFrameworkMessage } from './framework-messages.js';
import {
  type AgentConsumer,
  type AgentNodeOptions,
  type AgentState,
  ExecutionGraphs,
  type GraphDriver,
} from './graph-registry.js';

export { callExecutionControl } from './control.js';

export {
  type AgentConsumer,
  type AgentNodeOptions,
  type AgentState,
  ExecutionGraphs,
  type GraphDriver,
  type GraphFactory,
} from './graph-registry.js';

type AgentInitialization = Exclude<
  ExecutionControlInputs['execution.initialize'],
  { graph: unknown }
>;

/** Starts host IPC for the current worker process. Entry modules call it; importing it has no effect. */
export function startExecutionWorker(graphs = new ExecutionGraphs()): void {
  registerHarnessProfile('anthropic', {
    generalPurposeSubagent: { enabled: false },
    excludedTools: ['task', 'execute', 'delete'],
    excludedMiddleware: ['AnthropicPromptCachingMiddleware', 'CacheBreakpointMiddleware'],
  });

  const signal = new AbortController();
  const context = new AsyncLocalStorage<string>();
  const handlers = new Map<string, () => Promise<FrameworkToolResult>>();
  let iterator: AsyncIterator<StreamEvent> | undefined;
  let graphDriver: GraphDriver | undefined;
  let graphAttemptId: string | undefined;
  let database: Database.Database | undefined;
  let initialized = false;
  const stagedInstructions = new Map<string, InstructionContext>();
  const currentInstructionIds = new Set<string>();
  let pendingModelUpdate:
    | { token: string; messages: FrameworkMessage[]; instructions: InstructionContext[] }
    | undefined;
  const controlProviders: Pick<ExecutionControlProviders, 'execution.health' | 'execution.stop'> = {
    'execution.health': () => ({ processId: process.pid }),
    'execution.stop': () => {
      signal.abort();
      return { ok: true };
    },
  };

  const buildAgent = (
    input: AgentInitialization,
    saver?: InstructionSaver,
    selection?: AgentNodeOptions,
    inheritedSaver?: InstructionSaver,
  ) => {
    const model = createExecutionModel(input.model, signal.signal, {
      acquire: async () =>
        (
          await callExecutionControl(peer, 'model.acquire', {
            ...(selection?.materials ? { materials: [...selection.materials] } : {}),
          })
        ).leaseId,
      release: (leaseId) => {
        void callExecutionControl(peer, 'model.release', { leaseId }).catch(() => signal.abort());
      },
    });
    const backend = executionFiles(peer, () => context.getStore());
    const instructionState = z.object({
      instructionIds: z.array(z.string()).max(100).default([]),
      instructionRunId: z.string().default(''),
      instructions: z.array(z.custom<InstructionContext>()).max(100).default([]),
    });
    const middleware = input.middleware.map((item) =>
      createMiddleware<typeof instructionState>({
        name: item.name,
        stateSchema: instructionState,
        ...(item.before
          ? {
              beforeModel: async (state) => {
                const pending = {
                  token: randomUUID(),
                  messages: [] as FrameworkMessage[],
                  instructions: [] as InstructionContext[],
                };
                pendingModelUpdate = pending;
                try {
                  const update = await callExecutionControl(peer, 'execution.beforeModel', {
                    name: item.name,
                    token: pending.token,
                    messages: state.messages.map((message) => ({
                      type: message.getType() === 'human' ? 'human' : 'ai',
                      data: { ...(message.id ? { id: message.id } : {}), content: '' },
                    })),
                  });
                  if (update?.instructions)
                    (saver ?? inheritedSaver)?.remember([
                      ...pending.instructions,
                      ...update.instructions,
                    ]);
                  return update
                    ? {
                        ...(update.instructions
                          ? { instructions: [...pending.instructions, ...update.instructions] }
                          : {}),
                        ...(update.instructionRunId
                          ? { instructionRunId: update.instructionRunId }
                          : {}),
                        ...(update.instructionIds ? { instructionIds: update.instructionIds } : {}),
                        ...(update.messages
                          ? {
                              messages: [...pending.messages, ...update.messages].map(
                                decodeFrameworkMessage,
                              ),
                            }
                          : {}),
                      }
                    : undefined;
                } finally {
                  pendingModelUpdate = undefined;
                }
              },
            }
          : {}),
        ...(item.model
          ? {
              wrapModelCall: async (request, handler) => {
                await callExecutionControl(peer, 'execution.wrapModel', { name: item.name });
                return handler(request);
              },
            }
          : {}),
        ...(item.tool
          ? {
              wrapToolCall: async (request, handler) => {
                const token = randomUUID();
                handlers.set(token, async () => {
                  const result = await handler(request);
                  if (result instanceof ToolMessage)
                    return { kind: 'message', value: encodeFrameworkMessage(result) };
                  const encoded = isCommand(result)
                    ? { kind: 'command', update: result.update }
                    : result;
                  if (!isExecutionControlResult('execution.tool', encoded))
                    throw new OperationError('outcomeUnknown', '工具执行后结果不符合契约。');
                  return encoded;
                });
                try {
                  const result = await callExecutionControl(peer, 'execution.wrapTool', {
                    name: item.name,
                    token,
                    toolCall: request.toolCall,
                  });
                  if (result.kind === 'message') {
                    const message = decodeFrameworkMessage(result.value);
                    if (!(message instanceof ToolMessage))
                      throw new OperationError('outcomeUnknown', '工具执行后未返回工具消息。');
                    return message;
                  }
                  return new Command({ update: result.update }) as unknown as Awaited<
                    ReturnType<typeof handler>
                  >;
                } finally {
                  handlers.delete(token);
                }
              },
            }
          : {}),
      }),
    );
    middleware.unshift(
      createMiddleware<typeof instructionState>({
        name: 'ScholoomModelCompletion',
        wrapModelCall: async (request, handler) => {
          const response = await handler(request);
          if (
            response.response_metadata.finish_reason === 'length' ||
            response.additional_kwargs.stop_reason === 'max_tokens'
          )
            throw new OperationError('modelFailed', '模型输出达到上限，未执行本次工具请求。');
          return response;
        },
      }),
    );
    if (selection)
      middleware.unshift(
        createMiddleware<typeof instructionState>({
          name: 'ScholoomAgentTools',
          wrapModelCall: (request, handler) =>
            handler({
              ...request,
              tools: request.tools.filter(
                (tool) => typeof tool.name === 'string' && selection.tools.includes(tool.name),
              ),
            }),
          wrapToolCall: (request, handler) => {
            if (!selection.tools.includes(request.toolCall.name))
              throw new OperationError('permissionDenied', '节点工具不在可信源码选择范围。');
            return handler(request);
          },
        }),
      );
    return createDeepAgent({
      model,
      backend,
      middleware,
      ...((selection?.systemPrompt ?? input.systemPrompt)
        ? { systemPrompt: selection?.systemPrompt ?? input.systemPrompt }
        : {}),
      ...(saver ? { checkpointer: saver } : {}),
      tools: input.tools.map((tool) =>
        defineTool(async (args) => {
          const token = context.getStore();
          const call = [
            'execution.custom',
            { name: tool.name, args, ...(token ? { token } : {}) },
          ] as const;
          if (!isExecutionControlCall(call))
            throw new OperationError('invalidRequest', '工具参数不符合契约。');
          const result = await callExecutionControl(peer, ...call);
          return selection?.prepareToolResult?.(tool.name, call[1].args, result) ?? result;
        }, tool),
      ),
    });
  };

  const graphProviders: Pick<
    ExecutionControlProviders,
    | 'execution.tool'
    | 'execution.instructions'
    | 'execution.initialize'
    | 'execution.next'
    | 'execution.modelUpdate'
  > = {
    'execution.modelUpdate': (input) => {
      if (!pendingModelUpdate || pendingModelUpdate.token !== input.token)
        throw new OperationError('invalidRequest', '没有对应的模型前置更新。');
      if ('message' in input) pendingModelUpdate.messages.push(input.message);
      else pendingModelUpdate.instructions.push(input.instruction);
      return { ok: true };
    },
    'execution.instructions': ({ instruction, current }) => {
      if (initialized) throw new OperationError('invalidRequest', '执行已经初始化。');
      stagedInstructions.set(instruction.instructionId, instruction);
      if (current) currentInstructionIds.add(instruction.instructionId);
      return { ok: true };
    },
    'execution.tool': async ({ token }) => {
      const handler = handlers.get(token);
      if (!handler) throw new OperationError('permissionDenied', '工具接续不可用。');
      return context.run(token, handler);
    },
    'execution.initialize': async (input) => {
      if (!('graph' in input) && input.instructions?.length)
        throw new OperationError(
          'unavailable',
          '初始化指令尚未接线；Agent 指令由模型前置端口注入。',
        );
      if (initialized) throw new OperationError('invalidRequest', '执行已经初始化。');
      if ('graph' in input) {
        input = {
          ...input,
          instructions:
            input.instructions ??
            [...currentInstructionIds].map((id) => {
              const instruction = stagedInstructions.get(id);
              if (!instruction) throw new OperationError('invalidRequest', '完整图指令尚未传入。');
              return instruction;
            }),
          instructionIds: input.instructionIds ?? [...currentInstructionIds],
        };
        if (input.instructions?.length && !input.checkpointPath)
          throw new OperationError('unavailable', '图指令上下文需要持久 checkpoint。');
        const instructionIds = input.instructionIds;
        if (
          input.instructions?.some((item) => !instructionIds?.includes(item.instructionId)) ||
          input.instructionIds?.some(
            (id) => !input.instructions?.some((item) => item.instructionId === id),
          )
        )
          throw new OperationError('invalidRequest', '图指令身份与完整上下文不匹配。');
        const factory = graphs.resolve(input.graph);
        if (
          input.stateFormatVersion &&
          input.stateFormatVersion !== factory.definition.stateFormatVersion
        )
          throw new OperationError('protocolIncompatible', '执行进程的图状态格式不兼容。');
        if (input.input && input.input.attemptId !== input.attemptId)
          throw new OperationError('invalidRequest', '恢复输入不属于当前尝试。');
        initialized = true;
        graphAttemptId = input.attemptId;
        let checkpointer: InstructionSaver | undefined;
        if (input.checkpointPath) {
          database = new Database(input.checkpointPath, { fileMustExist: true });
          checkpointer = new InstructionSaver(
            database,
            async (value) => {
              await callExecutionControl(peer, 'execution.consume', value);
            },
            {
              instructionRunId: input.attemptId,
              instructions: [
                ...stagedInstructions.values(),
                ...(input.checkpointInstructions ?? []),
                ...(input.instructions ?? []),
              ],
            },
          );
          await checkpointer.confirmLatest({ configurable: { thread_id: input.attemptId } });
        }
        const registered = input;
        let activeConsumer = false;
        const consumer: AgentConsumer = {
          invoke: async (state, config, selection) => {
            if (activeConsumer)
              throw new OperationError('unavailable', '同一执行只允许一个活动 Agent consumer。');
            if (!registered.model || !registered.tools || !registered.middleware || !checkpointer)
              throw new OperationError(
                'unavailable',
                '图内 Agent 的可信装配或 checkpoint 不完整。',
              );
            if (
              config.configurable?.thread_id !== registered.attemptId ||
              !config.configurable?.checkpoint_ns
            )
              throw new OperationError('invalidRequest', 'Agent 必须使用所属图的原子任务 config。');
            activeConsumer = true;
            try {
              const child = await checkpointer.getTuple(config);
              if (child) {
                const root = config.configurable.checkpoint_map?.[''];
                if (
                  !root ||
                  child.metadata?.parents?.[''] !== root ||
                  child.checkpoint.channel_values.instructionRunId !== registered.attemptId ||
                  !Array.isArray(child.checkpoint.channel_values.instructions)
                )
                  throw new OperationError('invalidRequest', '子 checkpoint 不属于当前原子任务。');
                checkpointer.remember(
                  child.checkpoint.channel_values.instructions as InstructionContext[],
                );
                await checkpointer.confirmLatest(config);
              }
              const agent = buildAgent(
                {
                  model: registered.model,
                  tools: registered.tools,
                  middleware: registered.middleware,
                  ...(registered.systemPrompt ? { systemPrompt: registered.systemPrompt } : {}),
                  input: null,
                  config: { recursionLimit: 1000, durability: 'sync' },
                },
                undefined,
                selection,
                checkpointer,
              );
              // The child borrows the parent's saver and exact SDK task config.
              return (await agent.graph.invoke(child ? null : state, config)) as AgentState;
            } finally {
              activeConsumer = false;
            }
          },
        };
        graphDriver = await factory.create(input, {
          peer,
          signal: signal.signal,
          agent: consumer,
          ...(checkpointer ? { checkpointer } : {}),
        });
        stagedInstructions.clear();
        currentInstructionIds.clear();
        return { ok: true };
      }
      initialized = true;
      let saver: InstructionSaver | undefined;
      if (input.checkpointPath) {
        database = new Database(input.checkpointPath, { fileMustExist: true });
        saver = new InstructionSaver(database, async (confirmation) => {
          await callExecutionControl(peer, 'execution.consume', confirmation);
        });
        await saver.confirmLatest(input.config);
      }
      const agent = buildAgent(input, saver);
      iterator = agent
        .streamEvents(
          input.input ? { messages: input.input.messages.map(decodeFrameworkMessage) } : null,
          {
            ...input.config,
            signal: signal.signal,
            version: 'v2',
            durability: 'sync',
            callbacks: [],
          },
        )
        [Symbol.asyncIterator]();
      return { ok: true };
    },
    'execution.next': async () => {
      if (graphDriver) {
        const next = await graphDriver['execution.next']({});
        if (!isExecutionControlResult('execution.next', next))
          throw new OperationError('outcomeUnknown', '图推进结果不符合契约。');
        if (next.done) {
          if (!('graph' in next))
            throw new OperationError('outcomeUnknown', '图推进缺少终态或等待依据。');
          const attemptId =
            next.graph.kind === 'graph.waiting' ? next.graph.wait.attemptId : next.graph.attemptId;
          if (attemptId !== graphAttemptId)
            throw new OperationError('outcomeUnknown', '图推进结果不属于当前尝试。');
        }
        return next;
      }
      if (!iterator) throw new OperationError('invalidRequest', '执行尚未初始化。');
      try {
        for (;;) {
          const next = await iterator.next();
          if (next.done) return { done: true };
          const event = next.value;
          if (event.event === 'on_chat_model_stream' || event.event === 'on_chat_model_end') {
            if (
              (event.data.chunk && !isBaseMessage(event.data.chunk)) ||
              (event.data.output && !isBaseMessage(event.data.output))
            )
              throw new OperationError('outcomeUnknown', '模型事件不含有效框架消息。');
            if (event.event === 'on_chat_model_stream' && isBaseMessage(event.data.chunk))
              return {
                done: false,
                event: {
                  event: event.event,
                  run_id: event.run_id,
                  data: { chunk: encodeFrameworkMessage(event.data.chunk) },
                },
              };
            if (event.event === 'on_chat_model_end' && isBaseMessage(event.data.output))
              return {
                done: false,
                event: {
                  event: event.event,
                  run_id: event.run_id,
                  data: { output: encodeFrameworkMessage(event.data.output) },
                },
              };
            throw new OperationError('outcomeUnknown', '模型事件缺少必需消息。');
          }
        }
      } catch (error) {
        throw new OperationError(
          error instanceof OperationError ? error.code : 'modelFailed',
          modelFailure(error),
        );
      }
    },
  };

  const peer = new RpcPeer(
    {
      send: (frame) =>
        new Promise<void>((resolve, reject) => {
          if (!process.connected) {
            reject(new Error('host disconnected'));
            return;
          }
          process.send?.(JSON.parse(frame), (error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    },
    {
      control: (method) => method === 'execution.health' || method === 'execution.stop',
      notification: (method, input) => {
        if (method === 'execution.stop' && isExecutionControlCall([method, input]))
          signal.abort(new Error('Execution stopped'));
      },
      request: async (method, value) => {
        const args: readonly [string, unknown] = [method, value];
        const call = isExecutionControlCall(args) ? args : undefined;
        if (isExecutionControlMethod(method) && !call)
          throw new OperationError('invalidRequest', '执行控制参数不符合契约。');
        if (method === 'execution.health') return controlProviders[method]({});
        if (method === 'execution.stop') return controlProviders[method]({});
        if (signal.signal.aborted) throw new OperationError('shuttingDown', '执行已停止。');
        if (call?.[0] === 'execution.tool') return graphProviders[call[0]](call[1]);
        if (call?.[0] === 'execution.instructions') return graphProviders[call[0]](call[1]);
        if (call?.[0] === 'execution.modelUpdate') return graphProviders[call[0]](call[1]);
        if (call?.[0] === 'execution.initialize') return graphProviders[call[0]](call[1]);
        if (call?.[0] === 'execution.next') return graphProviders[call[0]](call[1]);
        throw new OperationError('invalidRequest', '执行操作不可用。');
      },
    },
  );

  process.on('message', (value) => peer.receive(JSON.stringify(value)));
  process.once('disconnect', () => {
    signal.abort();
    peer.close();
    try {
      graphDriver?.close?.();
    } finally {
      database?.close();
    }
  });
}
