import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { BaseMessage } from '@langchain/core/messages';
import { ToolMessage } from '@langchain/core/messages';
import { Command, isCommand } from '@langchain/langgraph';
import { RpcPeer } from '@scholoom/broker/rpc';
import type { ModelExecution } from '@scholoom/models/execution';
import {
  ManagedNode,
  type ProcessAdmission,
  type ProcessReservation,
} from '@scholoom/platform/node';
import { compileContract, limits, OperationError } from '@scholoom/protocol/core';
import {
  type ExecutionControlInputs,
  type ExecutionControlOutputs,
  type ExecutionControlProviders,
  type FrameworkToolResult,
  type GraphProgress,
  type InstructionContext,
  isExecutionControlCall,
  isExecutionControlMethod,
  isExecutionControlResult,
} from '@scholoom/protocol/execution';
import type { ExecutionResourcePort } from '@scholoom/protocol/resources';
import type { BackendProtocolV2, createDeepAgent } from 'deepagents';
import { z } from 'zod';
import type { Consumption } from './checkpoint.js';
import { callExecutionControl } from './control.js';
import { fileProviders } from './files.js';
import { decodeFrameworkMessage, encodeFrameworkMessage } from './framework-messages.js';

type AgentOptions = NonNullable<Parameters<typeof createDeepAgent>[0]>;
type RemoteOptions = {
  model?: ModelExecution;
  backend: BackendProtocolV2;
  middleware?: AgentOptions['middleware'];
  systemPrompt?: string;
  tools?: AgentOptions['tools'];
  checkpointPath?: string;
  confirm?: (value: Consumption) => Promise<void>;
  signal: AbortSignal;
  instanceId: string;
  onStart?: (owned: ManagedNode) => void | Promise<void>;
  onStop?: () => void | Promise<void>;
  onStopping?: () => void | Promise<void>;
  authorize?: () => void;
  processes?: ProcessAdmission;
  reservation?: ProcessReservation;
  workerEntry?: URL;
  registered?: Extract<ExecutionControlInputs['execution.initialize'], { graph: unknown }>;
  resources?: () => ExecutionResourcePort;
  onGraph?: (progress: GraphProgress) => void | Promise<void>;
};
type Event = Omit<
  Extract<ExecutionControlOutputs['execution.next'], { done: false }>['event'],
  'data'
> & { data: { chunk?: BaseMessage; output?: BaseMessage } };

function encode(value: unknown): FrameworkToolResult {
  const result =
    value instanceof ToolMessage
      ? { kind: 'message', value: encodeFrameworkMessage(value) }
      : isCommand(value)
        ? { kind: 'command', update: value.update }
        : value;
  if (!isExecutionControlResult('execution.tool', result))
    throw new OperationError('outcomeUnknown', '工具执行后结果不符合契约。');
  return result;
}

/** Host supplies capabilities; the graph, checkpoint and SDK execute only in the owned child. */
export class RemoteAgent {
  constructor(private readonly options: RemoteOptions) {}
  async *streamEvents(
    input: { messages: BaseMessage[] } | null,
    config: { configurable?: { thread_id: string }; [key: string]: unknown },
  ): AsyncGenerator<Event> {
    const reservation = this.options.reservation ?? this.options.processes?.reserve();
    try {
      await reservation?.ready;
      yield* this.executeEvents(input, config, reservation);
    } finally {
      reservation?.release();
    }
  }
  private async *executeEvents(
    input: { messages: BaseMessage[] } | null,
    config: { configurable?: { thread_id: string }; [key: string]: unknown },
    reservation?: ProcessReservation,
  ): AsyncGenerator<Event> {
    const options = this.options;
    options.signal.throwIfAborted();
    const leases = new Set<string>();
    let valid = true;
    let healthTimer: ReturnType<typeof setTimeout> | undefined;
    let peer: RpcPeer;
    const contexts = new Map<string, ReturnType<typeof AsyncLocalStorage.snapshot>>();
    const resourcesInFlight = new Set<Promise<unknown>>();
    const middleware = (options.middleware ?? []) as readonly {
      name: string;
      beforeModel?: (...args: never[]) => unknown;
      wrapToolCall?: (...args: never[]) => unknown;
      wrapModelCall?: (...args: never[]) => unknown;
    }[];
    const nativeTools = new Map(
      (options.tools ?? []).map((value) => {
        const tool = value as {
          name: string;
          description: string;
          schema: object;
          func?: (input: unknown) => unknown;
          invoke?: (input: unknown) => unknown;
        };
        return [tool.name, tool] as const;
      }),
    );
    const tools = [...nativeTools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      schema: {
        ...(tool.schema instanceof z.ZodType
          ? z.toJSONSchema(tool.schema, { target: 'draft-7', io: 'input', unrepresentable: 'any' })
          : tool.schema),
      },
    }));
    const toolValidators = new Map(
      tools.map((tool) => [
        tool.name,
        compileContract({ params: tool.schema, result: true }).params,
      ]),
    );
    const findMiddleware = (name: string) => {
      const item = middleware.find((item) => item.name === name);
      if (!item) throw new OperationError('permissionDenied', '执行中间件不可用。');
      return item;
    };
    const graphProviders: Pick<
      ExecutionControlProviders,
      'execution.beforeModel' | 'execution.wrapModel' | 'execution.wrapTool' | 'execution.custom'
    > = {
      'execution.beforeModel': async ({ name, token, messages }) => {
        const item = findMiddleware(name);
        if (!item.beforeModel) throw new OperationError('permissionDenied', '模型前置能力不可用。');
        const result = await item.beforeModel({
          messages: messages.map(decodeFrameworkMessage),
        } as never);
        if (!result || typeof result !== 'object') return null;
        const update = result as {
          messages?: BaseMessage[];
          instructionIds?: string[];
          instructionRunId?: string;
          instructions?: InstructionContext[];
        };
        const encoded = {
          ...(update.instructions ? { instructions: update.instructions } : {}),
          ...(update.instructionRunId ? { instructionRunId: update.instructionRunId } : {}),
          ...(update.instructionIds ? { instructionIds: update.instructionIds } : {}),
          ...(update.messages
            ? { messages: update.messages.map((message) => encodeFrameworkMessage(message)) }
            : {}),
        };
        // Reserve framing space without changing the complete SDK update or its consumption boundary.
        if (Buffer.byteLength(JSON.stringify(encoded), 'utf8') < limits.frameBytes / 2)
          return encoded;
        for (const message of encoded.messages ?? [])
          await callExecutionControl(peer, 'execution.modelUpdate', { token, message });
        for (const instruction of encoded.instructions ?? [])
          await callExecutionControl(peer, 'execution.modelUpdate', { token, instruction });
        return {
          ...encoded,
          ...(encoded.messages ? { messages: [] } : {}),
          ...(encoded.instructions ? { instructions: [] } : {}),
        };
      },
      'execution.wrapModel': async ({ name }) => {
        const item = findMiddleware(name);
        if (!item.wrapModelCall)
          throw new OperationError('permissionDenied', '模型封装能力不可用。');
        await item.wrapModelCall({} as never, (async () => ({})) as never);
        return { ok: true };
      },
      'execution.wrapTool': async (request) => {
        const item = findMiddleware(request.name);
        if (!item.wrapToolCall)
          throw new OperationError('permissionDenied', '工具封装能力不可用。');
        try {
          const result = await item.wrapToolCall(
            request as never,
            (async () => {
              contexts.set(request.token, AsyncLocalStorage.snapshot());
              const result = await callExecutionControl(peer, 'execution.tool', {
                token: request.token,
              }).catch((error: unknown) => {
                if (
                  !valid ||
                  options.signal.aborted ||
                  (error instanceof OperationError &&
                    [
                      'unavailable',
                      'protocolIncompatible',
                      'shuttingDown',
                      'outcomeUnknown',
                    ].includes(error.code))
                )
                  throw new OperationError('outcomeUnknown', '执行失联，已受理工具效果尚待核查。');
                throw error;
              });
              return result.kind === 'message'
                ? decodeFrameworkMessage(result.value)
                : new Command({ update: result.update });
            }) as never,
          );
          return encode(result);
        } finally {
          contexts.delete(request.token);
        }
      },
      'execution.custom': async ({ name, args }) => {
        const tool = nativeTools.get(name);
        if (!tool || !toolValidators.get(name)?.(args))
          throw new OperationError('invalidRequest', '工具输入不符合已注册声明。');
        const input = tool.schema instanceof z.ZodType ? tool.schema.parse(args) : args;
        const result = await (tool.func ? tool.func(input) : tool.invoke?.(input));
        if (!isExecutionControlResult('execution.custom', result))
          throw new OperationError('outcomeUnknown', '工具执行后结果不符合契约。');
        return result;
      },
    };
    const controlProviders: Pick<
      ExecutionControlProviders,
      | 'model.acquire'
      | 'model.release'
      | 'execution.consume'
      | 'execution.files.upload'
      | 'execution.files.download'
    > = {
      'execution.files.upload': async ({ files }) => {
        if (!options.backend.uploadFiles)
          throw new OperationError('unavailable', '文件上传能力不可用。');
        return {
          files: await options.backend.uploadFiles(
            files.map(({ path, content }) => [path, Buffer.from(content, 'base64')]),
          ),
        };
      },
      'execution.files.download': async ({ paths }) => {
        if (!options.backend.downloadFiles)
          throw new OperationError('unavailable', '文件下载能力不可用。');
        return {
          files: (await options.backend.downloadFiles(paths)).map(({ path, content, error }) => ({
            path,
            content: content === null ? null : Buffer.from(content).toString('base64'),
            error,
          })),
        };
      },
      'model.acquire': async () => {
        if (!options.model)
          throw new OperationError('credentialUnavailable', '本图没有模型执行资格。');
        const lease = await options.model.acquire();
        try {
          options.signal.throwIfAborted();
          options.authorize?.();
          if (!valid) throw new OperationError('shuttingDown', '执行已停止。');
        } catch (error) {
          options.model.release(lease);
          throw error;
        }
        leases.add(lease);
        return { leaseId: lease };
      },
      'model.release': ({ leaseId }) => {
        if (leases.delete(leaseId)) options.model?.release(leaseId);
        return { ok: true };
      },
      'execution.consume': async (input) => {
        if (!options.confirm) throw new OperationError('unavailable', '消费确认提供者不可用。');
        await options.confirm(input);
        return { ok: true };
      },
    };
    const files = fileProviders(options.backend);
    const owned = await ManagedNode.start({
      entry: options.workerEntry ?? new URL('./execution.js', import.meta.url),
      instanceId: options.instanceId,
      ...(reservation ? { reservation } : {}),
    });
    peer = new RpcPeer(
      { send: (frame) => owned.send(JSON.parse(frame)) },
      {
        control: (method) => method === 'model.release' || method === 'execution.health',
        request: async (method, value) => {
          const controlArgs: readonly [string, unknown] = [method, value];
          const control = isExecutionControlCall(controlArgs) ? controlArgs : undefined;
          if (isExecutionControlMethod(method) && !control)
            throw new OperationError('invalidRequest', '执行控制参数不符合契约。');
          const token = control && 'token' in control[1] ? control[1].token : undefined;
          const dispatch = async () => {
            if (!valid || options.signal.aborted)
              throw new OperationError('shuttingDown', '执行实例已失效。');
            options.authorize?.();
            if (control && options.resources) {
              const resources = options.resources();
              if (control[0] === 'resources.describe')
                return resources.describe(control[1].locator);
              if (control[0] === 'resources.read') return resources.read(control[1]);
              if (control[0] === 'resources.save') return resources.save(control[1]);
              if (control[0] === 'resources.create') return resources.create(control[1]);
              if (control[0] === 'resources.creation') return resources.creation(control[1]);
              if (control[0] === 'resources.document') {
                const request = control[1];
                return resources.document(
                  request,
                  request.request.method,
                  request.request.input as never,
                );
              }
            }
            if (control?.[0] === 'model.acquire')
              return controlProviders['model.acquire'](control[1]);
            if (control?.[0] === 'model.release')
              return controlProviders['model.release'](control[1]);
            if (control?.[0] === 'execution.consume')
              return controlProviders['execution.consume'](control[1]);
            if (control?.[0] === 'execution.files.upload')
              return controlProviders['execution.files.upload'](control[1]);
            if (control?.[0] === 'execution.files.download')
              return controlProviders['execution.files.download'](control[1]);
            if (control?.[0] === 'execution.files.ls') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.files.read') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.files.readRaw') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.files.write') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.files.edit') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.files.glob') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.files.grep') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.files.delete') return files[control[0]](control[1]);
            if (control?.[0] === 'execution.beforeModel')
              return graphProviders[control[0]](control[1]);
            if (control?.[0] === 'execution.wrapModel')
              return graphProviders[control[0]](control[1]);
            if (control?.[0] === 'execution.wrapTool')
              return graphProviders[control[0]](control[1]);
            if (control?.[0] === 'execution.custom') return graphProviders[control[0]](control[1]);
            throw new OperationError('permissionDenied', '执行能力不可用。');
          };
          const runner = token ? contexts.get(token) : undefined;
          const done = runner ? runner(dispatch) : dispatch();
          if (method.startsWith('resources.')) {
            resourcesInFlight.add(done);
            void done.then(
              () => resourcesInFlight.delete(done),
              () => resourcesInFlight.delete(done),
            );
          }
          return done;
        },
      },
    );
    owned.on('message', (message) => peer.receive(JSON.stringify(message)));
    owned.once('exit', () =>
      peer.close({ code: 'unavailable', message: '执行进程已退出，未确认的工具效果仍需核查。' }),
    );
    const stop = () => {
      valid = false;
      peer.close({ code: 'shuttingDown', message: '执行已停止。' });
      void owned.stop().catch(() => {});
    };
    options.signal.addEventListener('abort', stop, { once: true });
    try {
      await options.onStart?.(owned);
      options.signal.throwIfAborted();
      const descriptor = options.model?.descriptor;
      let initialization =
        options.registered ??
        (descriptor
          ? {
              model: descriptor,
              tools,
              ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
              ...(options.checkpointPath ? { checkpointPath: options.checkpointPath } : {}),
              middleware: middleware.map((item) => ({
                name: item.name,
                before: !!item.beforeModel,
                tool: !!item.wrapToolCall,
                model: !!item.wrapModelCall,
              })),
              input: input
                ? { messages: input.messages.map((message) => encodeFrameworkMessage(message)) }
                : null,
              config: {
                ...(config.configurable ? { configurable: config.configurable } : {}),
                recursionLimit:
                  typeof config.recursionLimit === 'number' ? config.recursionLimit : 1000,
                durability: 'sync' as const,
              },
            }
          : undefined);
      if (!initialization) throw new OperationError('credentialUnavailable', '缺少模型配置。');
      if ('graph' in initialization) {
        const {
          instructions = [],
          checkpointInstructions = [],
          instructionIds: _ids,
          ...selection
        } = initialization;
        for (const [items, current] of [
          [checkpointInstructions, false],
          [instructions, true],
        ] as const)
          for (const instruction of items) {
            options.signal.throwIfAborted();
            options.authorize?.();
            await callExecutionControl(peer, 'execution.instructions', { instruction, current });
          }
        initialization = selection;
      }
      await callExecutionControl(peer, 'execution.initialize', initialization);
      const health = async () => {
        if (!valid) return;
        try {
          options.authorize?.();
          const reply = await callExecutionControl(peer, 'execution.health', {});
          if (reply.processId !== owned.identity?.pid)
            throw new OperationError('instanceMismatch', '执行健康响应身份不符。');
          if (valid) healthTimer = setTimeout(() => void health(), limits.processHealthMs);
        } catch (error) {
          if (!valid) return;
          valid = false;
          peer.close({
            code:
              error instanceof OperationError && error.code === 'instanceMismatch'
                ? error.code
                : 'unavailable',
            message:
              error instanceof OperationError && error.code === 'instanceMismatch'
                ? error.message
                : '执行事件循环健康检查超时或失联；停止该执行并保留成果。',
          });
        }
      };
      healthTimer = setTimeout(() => void health(), limits.processHealthMs);
      for (;;) {
        options.authorize?.();
        const next = await callExecutionControl(peer, 'execution.next', {});
        options.authorize?.();
        if (next.done) {
          if ('graph' in next) {
            if (!options.registered || !options.onGraph)
              throw new OperationError('unavailable', '缺少图结果接收者。');
            await options.onGraph(next.graph);
          } else if (options.registered)
            throw new OperationError('outcomeUnknown', '缺少图执行结果。');
          break;
        }
        if (next.event) {
          const event = next.event;
          yield {
            ...event,
            data: {
              ...(event.event === 'on_chat_model_stream'
                ? { chunk: decodeFrameworkMessage(event.data.chunk) }
                : { output: decodeFrameworkMessage(event.data.output) }),
            },
          };
        }
      }
    } finally {
      valid = false;
      clearTimeout(healthTimer);
      options.signal.removeEventListener('abort', stop);
      try {
        await this.finishExecution(owned, leases, peer);
      } finally {
        await Promise.allSettled([...resourcesInFlight]);
      }
    }
  }
  private async finishExecution(
    owned: ManagedNode,
    leases: Set<string>,
    peer: RpcPeer,
  ): Promise<void> {
    let stoppingFailed = false;
    try {
      await this.options.onStopping?.();
    } catch {
      stoppingFailed = true;
    }
    try {
      await owned.stop();
    } catch (error) {
      if (stoppingFailed && error instanceof OperationError)
        throw new OperationError(error.code, `${error.message}撤权记录亦保存失败。`);
      throw error;
    }
    for (const lease of leases) this.options.model?.release(lease);
    peer.close();
    try {
      await this.options.onStop?.();
    } catch (error) {
      if (error instanceof OperationError && error.code === 'outcomeUnknown') throw error;
      throw new OperationError('unavailable', '执行已停止，但退出登记保存失败。');
    }
    if (stoppingFailed) throw new OperationError('unavailable', '执行已停止，但撤权记录保存失败。');
  }
  async invoke(input: { messages: BaseMessage[] }, config: Record<string, unknown>): Promise<void> {
    for await (const _event of this.streamEvents(input, config)) {
      /* Drain backpressure. */
    }
  }
}

export const executionInstanceId = randomUUID;
