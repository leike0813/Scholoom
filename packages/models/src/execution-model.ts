import { ChatAnthropic } from '@langchain/anthropic';
import type { ModelDescriptor } from '@scholoom/protocol/models';
import { adaptiveThinking } from './catalog.js';

export interface ModelExecution {
  descriptor: ModelDescriptor;
  acquire: () => Promise<string>;
  release: (leaseId: string) => void;
}

export type { ModelDescriptor } from '@scholoom/protocol/models';
export type ModelAdmission = Pick<ModelExecution, 'acquire' | 'release'>;

export function createExecutionModel(
  descriptor: ModelDescriptor,
  signal: AbortSignal,
  admission: ModelAdmission,
): ChatAnthropic {
  return new ChatAnthropic({
    model: descriptor.model,
    apiKey: descriptor.apiKey,
    anthropicApiUrl: descriptor.endpoint,
    maxTokens: 16384,
    ...(adaptiveThinking.has(descriptor.model) ? { thinking: { type: 'adaptive' as const } } : {}),
    ...(descriptor.effort ? { outputConfig: { effort: descriptor.effort } } : {}),
    maxRetries: 0,
    clientOptions: {
      timeout: 180000,
      fetch: async (input, init) => {
        for (let attempt = 0; ; attempt++) {
          const leaseId = await admission.acquire();
          const requestSignal = AbortSignal.any([
            signal,
            AbortSignal.timeout(180000),
            ...(init?.signal ? [init.signal] : []),
          ]);
          try {
            const response = await fetch(input, { ...init, signal: requestSignal });
            if ([500, 502, 503, 529].includes(response.status)) {
              await response.body?.cancel();
              throw Object.assign(new Error('Temporary model failure'), {
                status: response.status,
                headers: response.headers,
              });
            }
            if (!response.body) {
              admission.release(leaseId);
              return response;
            }
            const reader = response.body.getReader();
            let released = false;
            const release = () => {
              if (!released) {
                released = true;
                requestSignal.removeEventListener('abort', release);
                admission.release(leaseId);
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
            return new Response(body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          } catch (error) {
            admission.release(leaseId);
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
          }
        }
      },
    },
    streamUsage: true,
    callbacks: [],
  });
}
