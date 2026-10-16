import { Worker } from 'node:worker_threads';
import type { ErrorInfo } from '@scholoom/protocol';
import { OperationError } from '../errors.js';

export type PdfRequest =
  | { kind: 'info' }
  | { kind: 'geometry'; pageIndex: number }
  | { kind: 'text'; pageIndex: number; offset?: number; limit?: number };
type Job = { start: () => void; cancel: () => void };

/** 串行隔离WASM；容量在读取材料快照前取得，超时释放Worker和等待者。 */
export class PdfReading {
  private queue: Job[] = [];
  private current: Job | undefined;
  private stopped = false;
  run<T>(
    load: (signal: AbortSignal) => Promise<ArrayBuffer>,
    request: PdfRequest,
    options: {
      signal?: AbortSignal | undefined;
      verify?: (value: T, signal: AbortSignal) => Promise<void>;
    } = {},
  ): Promise<T> {
    if (this.stopped)
      return Promise.reject(new OperationError('shuttingDown', 'PDF读取正在停止。'));
    if (this.current && this.queue.length >= 8)
      return Promise.reject(new OperationError('unavailable', 'PDF读取队列已满，请稍后重试。'));
    if (options.signal?.aborted)
      return Promise.reject(new OperationError('shuttingDown', 'PDF读取已取消。'));
    return new Promise<T>((resolve, reject) => {
      let worker: Worker | undefined;
      let settled = false;
      let received = false;
      const controller = new AbortController();
      const finish = (error?: ErrorInfo, value?: T) => {
        if (settled) return;
        settled = true;
        controller.abort();
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', job.cancel);
        this.queue = this.queue.filter((item) => item !== job);
        if (error) reject(new OperationError(error.code, error.message));
        else resolve(value as T);
        void (async () => {
          await worker?.terminate().catch(() => undefined);
          if (this.current === job) {
            this.current = undefined;
            if (!this.stopped) this.queue.shift()?.start();
          }
        })();
      };
      const job: Job = {
        cancel: () => finish({ code: 'shuttingDown', message: 'PDF读取已停止。' }),
        start: () => {
          if (settled) return;
          this.current = job;
          void load(controller.signal)
            .then((bytes) => {
              if (settled) return;
              worker = new Worker(new URL('./pdf-worker.js', import.meta.url), {
                workerData: { bytes, request },
                transferList: [bytes],
              });
              worker.once('message', (message: { result: T; error?: ErrorInfo }) => {
                received = true;
                if (message.error) {
                  finish(message.error);
                  return;
                }
                void (async () => {
                  await options.verify?.(message.result, controller.signal);
                  finish(undefined, message.result);
                })().catch((error) =>
                  finish(
                    error instanceof OperationError
                      ? error
                      : { code: 'unavailable', message: 'PDF交付核查失败。' },
                  ),
                );
              });
              worker.once('error', () =>
                finish({ code: 'unavailable', message: 'PDF读取执行单元失败。' }),
              );
              worker.once('exit', () => {
                if (!received) finish({ code: 'unavailable', message: 'PDF读取未返回结果。' });
              });
            })
            .catch((error) =>
              finish(
                error instanceof OperationError
                  ? error
                  : { code: 'unavailable', message: 'PDF材料读取失败。' },
              ),
            );
        },
      };
      const timer = setTimeout(
        () => finish({ code: 'unavailable', message: 'PDF读取超时，请缩小范围后重试。' }),
        30000,
      );
      options.signal?.addEventListener('abort', job.cancel, { once: true });
      if (this.current) this.queue.push(job);
      else job.start();
    });
  }
  close(): void {
    this.stopped = true;
    this.current?.cancel();
    for (const job of [...this.queue]) job.cancel();
  }
}
