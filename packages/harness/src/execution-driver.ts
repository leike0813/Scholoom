import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { isBaseMessage, ToolMessage } from '@langchain/core/messages';
import type { StreamEvent } from '@langchain/core/tracers/log_stream';
import { Command, isCommand } from '@langchain/langgraph';
import { RpcPeer } from '@scholoom/broker/rpc';
import { createExecutionModel, modelFailure } from '@scholoom/models/execution';
import { OperationError } from '@scholoom/protocol/core';
import {
  type ExecutionControlProviders,
  type FrameworkToolResult,
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
import { ExecutionGraphs, type GraphDriver } from './graph-registry.js';

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
  const controlProviders: Pick<ExecutionControlProviders, 'execution.health' | 'execution.stop'> = {
    'execution.health': () => ({ processId: process.pid }),
    'execution.stop': () => {
      signal.abort();
      return { ok: true };
    },
  };

  const graphProviders: Pick<
    ExecutionControlProviders,
    'execution.tool' | 'execution.initialize' | 'execution.next'
  > = {
    'execution.tool': async ({ token }) => {
      const handler = handlers.get(token);
      if (!handler) throw new OperationError('permissionDenied', '工具接续不可用。');
      return context.run(token, handler);
    },
    'execution.initialize': async (input) => {
      if (input.instructions?.length)
        throw new OperationError('unavailable', '结构化指令上下文尚未接线。');
      if (initialized) throw new OperationError('invalidRequest', '执行已经初始化。');
      if ('graph' in input) {
        const factory = graphs.resolve(input.graph);
        if (input.input && input.input.attemptId !== input.attemptId)
          throw new OperationError('invalidRequest', '恢复输入不属于当前尝试。');
        initialized = true;
        graphAttemptId = input.attemptId;
        graphDriver = await factory.create(input, { peer, signal: signal.signal });
        return { ok: true };
      }
      initialized = true;
      const model = createExecutionModel(input.model, signal.signal, {
        acquire: async () => (await callExecutionControl(peer, 'model.acquire', {})).leaseId,
        release: (leaseId) => {
          void callExecutionControl(peer, 'model.release', { leaseId }).catch(() => signal.abort());
        },
      });
      const backend = executionFiles(peer, () => context.getStore());
      const instructionState = z.object({
        instructionIds: z.array(z.string()).max(100).default([]),
      });
      const middleware = input.middleware.map((item) =>
        createMiddleware<typeof instructionState>({
          name: item.name,
          stateSchema: instructionState,
          ...(item.before
            ? {
                beforeModel: async (state) => {
                  const update = await callExecutionControl(peer, 'execution.beforeModel', {
                    name: item.name,
                    messages: state.messages.map((message) => ({
                      type: message.getType() === 'human' ? 'human' : 'ai',
                      data: { ...(message.id ? { id: message.id } : {}), content: '' },
                    })),
                  });
                  return update
                    ? {
                        ...(update.instructionIds ? { instructionIds: update.instructionIds } : {}),
                        ...(update.messages
                          ? { messages: update.messages.map(decodeFrameworkMessage) }
                          : {}),
                      }
                    : undefined;
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
      let saver: InstructionSaver | undefined;
      if (input.checkpointPath) {
        database = new Database(input.checkpointPath, { fileMustExist: true });
        saver = new InstructionSaver(database, async (confirmation) => {
          await callExecutionControl(peer, 'execution.consume', confirmation);
        });
        await saver.confirmLatest(input.config);
      }
      const agent = createDeepAgent({
        model,
        backend,
        middleware,
        ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
        ...(saver ? { checkpointer: saver } : {}),
        tools: input.tools.map((tool) =>
          defineTool((args) => {
            const token = context.getStore();
            const call = [
              'execution.custom',
              { name: tool.name, args, ...(token ? { token } : {}) },
            ] as const;
            if (!isExecutionControlCall(call))
              throw new OperationError('invalidRequest', '工具参数不符合契约。');
            return callExecutionControl(peer, ...call);
          }, tool),
        ),
      });
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
