import { ChatAnthropic } from '@langchain/anthropic';
import type { Effort, ModelOption, ProviderStatus } from '@scholoom/protocol';
import type { CredentialStore } from '../credentials/store.js';
import { OperationError } from '../errors.js';
import type { ModelConfigStore } from './config-store.js';

export const minimaxEndpoint = 'https://api.minimax.cn/anthropic';
export const minimaxEfforts = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const minimaxModels: readonly ModelOption[] = [
  { id: 'MiniMax-M3.1-Flash-Preview', supportsEffort: true },
  { id: 'MiniMax-M3', supportsEffort: false },
  { id: 'MiniMax-M2.7', supportsEffort: false },
  { id: 'MiniMax-M2.7-highspeed', supportsEffort: false },
];
export const factoryDefaults: { model: string; effort: Effort } = {
  model: 'MiniMax-M3.1-Flash-Preview',
  effort: 'medium',
};
const adaptiveThinking = new Set(['MiniMax-M3.1-Flash-Preview', 'MiniMax-M3']);

export interface RunModelConfig {
  model: string;
  effort?: Effort;
}

export class ModelAccess {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(
    readonly credentials: CredentialStore,
    private readonly configs: ModelConfigStore,
    private readonly endpoint = minimaxEndpoint,
  ) {
    if (endpoint !== minimaxEndpoint) {
      const url = new URL(endpoint);
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1')
        throw new OperationError('invalidRequest', '测试模型只能使用 loopback HTTP。');
    }
  }

  async status(): Promise<ProviderStatus> {
    const credential = await this.credentials.status();
    let model = factoryDefaults.model;
    let effort = factoryDefaults.effort;
    let error = credential.error;
    try {
      const defaults = await this.configs.load();
      model = defaults.model;
      effort = defaults.effort;
    } catch (cause) {
      error = cause instanceof OperationError ? cause.message : '默认模型配置不可用。';
    }
    return {
      id: 'minimax-cn-m-plan',
      model,
      defaultEffort: effort,
      models: [...minimaxModels],
      efforts: [...minimaxEfforts],
      configured: credential.configured,
      source: credential.source,
      ...(error ? { error } : {}),
    };
  }

  async setDefaults(input: { model: string; effort: Effort }): Promise<ProviderStatus> {
    if (!minimaxModels.some((item) => item.id === input.model))
      throw new OperationError('invalidRequest', `模型 ${input.model} 不在当前模型目录。`);
    if (!(minimaxEfforts as readonly string[]).includes(input.effort))
      throw new OperationError('invalidRequest', `推理强度 ${input.effort} 不在可用档位。`);
    await this.configs.save({ model: input.model, effort: input.effort });
    return this.status();
  }

  async create(
    authorize: () => void = () => {},
    signal: AbortSignal = new AbortController().signal,
    config?: RunModelConfig,
  ): Promise<ChatAnthropic> {
    const resolved = config ?? (await this.configs.load());
    const option = minimaxModels.find((item) => item.id === resolved.model);
    if (!option)
      throw new OperationError('invalidRequest', `模型 ${resolved.model} 不在当前模型目录。`);
    const { key } = await this.credentials.get();
    let requests = 0;
    const permitted = () => {
      authorize();
      if (++requests > 32)
        throw new OperationError(
          'resourceLimit',
          '本次推进达到 32 次模型请求上限；成果已保留，可显式继续。',
        );
    };
    return new ChatAnthropic({
      model: option.id,
      apiKey: key,
      anthropicApiUrl: this.endpoint,
      maxTokens: 16384,
      ...(adaptiveThinking.has(option.id) ? { thinking: { type: 'adaptive' as const } } : {}),
      ...(option.supportsEffort
        ? { outputConfig: { effort: resolved.effort ?? factoryDefaults.effort } }
        : {}),
      maxRetries: 0,
      clientOptions: {
        timeout: 180000,
        fetch: (input, init) =>
          this.call(signal, permitted, (requestSignal) =>
            fetch(input, {
              ...init,
              signal: AbortSignal.any([requestSignal, ...(init?.signal ? [init.signal] : [])]),
            }).then(async (response) => {
              if ([500, 502, 503, 529].includes(response.status)) {
                await response.body?.cancel();
                throw Object.assign(new Error('Temporary model failure'), {
                  status: response.status,
                  headers: response.headers,
                });
              }
              return response;
            }),
          ),
      },
      streamUsage: true,
      callbacks: [],
    });
  }

  async call<T>(
    signal: AbortSignal,
    authorize: () => void,
    handler: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    while (this.active >= 1) {
      signal.throwIfAborted();
      await new Promise<void>((resolve, reject) => {
        const wake = () => {
          signal.removeEventListener('abort', abort);
          resolve();
        };
        const abort = () => {
          this.waiters = this.waiters.filter((item) => item !== wake);
          reject(signal.reason);
        };
        this.waiters.push(wake);
        signal.addEventListener('abort', abort, { once: true });
      });
    }
    this.active += 1;
    let deferred = false;
    const release = () => {
      this.active -= 1;
      this.waiters.shift()?.();
    };
    try {
      for (let attempt = 0; ; attempt++) {
        signal.throwIfAborted();
        authorize();
        try {
          const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
          const result = await handler(requestSignal);
          if (result instanceof Response && result.body) {
            const reader = result.body.getReader();
            let released = false;
            const finish = () => {
              if (!released) {
                released = true;
                requestSignal.removeEventListener('abort', finish);
                release();
              }
            };
            requestSignal.addEventListener('abort', finish, { once: true });
            const body = new ReadableStream<Uint8Array>({
              async pull(controller) {
                try {
                  const next = await reader.read();
                  if (next.done) {
                    controller.close();
                    finish();
                  } else controller.enqueue(next.value);
                } catch (error) {
                  controller.error(error);
                  finish();
                }
              },
              async cancel(reason) {
                try {
                  await reader.cancel(reason);
                } finally {
                  finish();
                }
              },
            });
            deferred = true;
            return new Response(body, {
              status: result.status,
              statusText: result.statusText,
              headers: result.headers,
            }) as T;
          }
          return result;
        } catch (error) {
          if (signal.aborted) throw error;
          const status = (error as { status?: number }).status;
          const retryable = status === 500 || status === 502 || status === 503 || status === 529;
          if (!retryable || attempt >= 2) throw error;
          const header = (error as { headers?: Headers }).headers?.get?.('retry-after');
          const wait = header ? Number(header) * 1000 : 500 * 2 ** attempt;
          if (!Number.isFinite(wait) || wait > 60000) throw error;
          await new Promise<void>((resolve, reject) => {
            const abort = () => {
              clearTimeout(timer);
              reject(signal.reason);
            };
            const timer = setTimeout(
              () => {
                signal.removeEventListener('abort', abort);
                resolve();
              },
              Math.max(0, wait),
            );
            signal.addEventListener('abort', abort, { once: true });
          });
        }
      }
    } finally {
      if (!deferred) release();
    }
  }
}

export function modelFailure(error: unknown): string {
  if (error instanceof OperationError) return error.message;
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) return `MiniMax 凭据或权限不可用（HTTP ${status}）。`;
  if (status === 429) return 'MiniMax 限流或套餐额度受限（HTTP 429），请核对套餐状态后继续。';
  if (status) return `MiniMax 调用失败（HTTP ${status}），已保留当前成果。`;
  if ((error as Error)?.name === 'TimeoutError') return '模型请求超时；远端结果未知，请显式继续。';
  return '执行未完成；已保留成果和指令，请核对当前材料后继续。';
}
