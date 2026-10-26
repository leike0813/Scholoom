import { OperationError } from '@scholoom/protocol/core';
import type { ModelDefaults, ProviderStatus } from '@scholoom/protocol/models';
import type { RunModelConfig } from './catalog.js';
import { factoryDefaults, minimaxEfforts, minimaxEndpoint, minimaxModels } from './catalog.js';
import { createExecutionModel, type ModelBudget, type ModelExecution } from './execution-model.js';

export function createModelBudget(): ModelBudget {
  let requests = 0;
  return {
    consume: () => {
      if (requests >= 32)
        throw new OperationError(
          'resourceLimit',
          '本次推进达到 32 次模型请求上限；成果已保留，可显式继续。',
        );
      requests++;
    },
  };
}

interface CredentialAccess {
  get(): Promise<{ key: string; source: 'saved' | 'environment' }>;
  status(): Promise<{
    configured: boolean;
    source: 'saved' | 'environment' | 'missing';
    error?: string;
  }>;
}
interface ModelConfigAccess {
  load(): Promise<ModelDefaults>;
  save(config: ModelDefaults): Promise<void>;
}

export class ModelAccess {
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(
    readonly credentials: CredentialAccess,
    private readonly configs: ModelConfigAccess,
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

  async setDefaults(input: ModelDefaults): Promise<ProviderStatus> {
    if (!minimaxModels.some((item) => item.id === input.model))
      throw new OperationError('invalidRequest', `模型 ${input.model} 不在当前模型目录。`);
    if (!(minimaxEfforts as readonly string[]).includes(input.effort))
      throw new OperationError('invalidRequest', `推理强度 ${input.effort} 不在可用档位。`);
    await this.configs.save({ model: input.model, effort: input.effort });
    return this.status();
  }

  async execution(
    authorize: () => void | Promise<void> = () => {},
    signal: AbortSignal = new AbortController().signal,
    config?: RunModelConfig,
    confirm: () => void = () => {},
    budget: ModelBudget = createModelBudget(),
  ): Promise<ModelExecution> {
    const resolved = config ?? (await this.configs.load());
    const option = minimaxModels.find((item) => item.id === resolved.model);
    if (!option)
      throw new OperationError('invalidRequest', `模型 ${resolved.model} 不在当前模型目录。`);
    const { key } = await this.credentials.get();
    let nextLease = 0;
    const leases = new Set<string>();
    return {
      budget,
      descriptor: {
        model: option.id,
        ...(option.supportsEffort ? { effort: resolved.effort ?? factoryDefaults.effort } : {}),
        apiKey: key,
        endpoint: this.endpoint,
      },
      acquire: async () => {
        await authorize();
        await this.acquireSlot(signal, () => {});
        try {
          signal.throwIfAborted();
          await authorize();
          signal.throwIfAborted();
          confirm();
          budget.consume();
        } catch (error) {
          this.releaseSlot();
          throw error;
        }
        const lease = String(++nextLease);
        leases.add(lease);
        return lease;
      },
      release: (leaseId) => {
        if (leases.delete(leaseId)) this.releaseSlot();
      },
    };
  }

  async create(
    authorize: () => void = () => {},
    signal: AbortSignal = new AbortController().signal,
    config?: RunModelConfig,
  ) {
    const execution = await this.execution(authorize, signal, config);
    return createExecutionModel(execution.descriptor, signal, execution);
  }

  async call<T>(
    signal: AbortSignal,
    authorize: () => void,
    handler: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const budget = createModelBudget();
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      await this.acquireSlot(signal, authorize);
      let deferred = false;
      try {
        budget.consume();
        const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
        const result = await handler(requestSignal);
        if (result instanceof Response && result.body) {
          const reader = result.body.getReader();
          let released = false;
          const release = () => {
            if (!released) {
              released = true;
              requestSignal.removeEventListener('abort', release);
              this.releaseSlot();
            }
          };
          requestSignal.addEventListener('abort', release, { once: true });
          const body = new ReadableStream<Uint8Array>({
            async pull(controller) {
              try {
                const chunk = await reader.read();
                if (chunk.done) {
                  controller.close();
                  release();
                } else controller.enqueue(chunk.value);
              } catch (error) {
                controller.error(error);
                release();
              }
            },
            async cancel(reason) {
              try {
                await reader.cancel(reason);
              } finally {
                release();
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
        if (![500, 502, 503, 529].includes(status ?? 0) || attempt >= 2) throw error;
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
      } finally {
        if (!deferred) this.releaseSlot();
      }
    }
  }

  private acquireSlot(signal: AbortSignal, authorize: () => void): Promise<void> | void {
    signal.throwIfAborted();
    authorize();
    if (this.active < 1) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const wake = () => {
        signal.removeEventListener('abort', abort);
        try {
          signal.throwIfAborted();
          authorize();
          this.active++;
          resolve();
        } catch (error) {
          reject(error);
          this.wakeWaiter();
        }
      };
      const abort = () => {
        this.waiters = this.waiters.filter((item) => item !== wake);
        reject(signal.reason);
      };
      this.waiters.push(wake);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  private releaseSlot(): void {
    this.active--;
    this.wakeWaiter();
  }
  private wakeWaiter(): void {
    this.waiters.shift()?.();
  }
}

export function modelFailure(error: unknown): string {
  const seen = new Set<unknown>();
  for (let cause = error; cause instanceof Error && !seen.has(cause); cause = cause.cause) {
    if (cause instanceof OperationError) return cause.message;
    seen.add(cause);
  }
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) return `MiniMax 凭据或权限不可用（HTTP ${status}）。`;
  if (status === 429) return 'MiniMax 限流或套餐额度受限（HTTP 429），请核对套餐状态后继续。';
  if (status) return `MiniMax 调用失败（HTTP ${status}），已保留当前成果。`;
  if ((error as Error)?.name === 'TimeoutError') return '模型请求超时；远端结果未知，请显式继续。';
  return '执行未完成；已保留成果和指令，请核对当前材料后继续。';
}
