import { randomUUID } from 'node:crypto';
import {
  ManagedNode,
  type ProcessAdmission,
  type ProcessReservation,
} from '@scholoom/platform/node';
import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import { MATERIAL_CHUNK } from './material-files.js';

export type PdfRequest =
  | { kind: 'info' }
  | { kind: 'geometry'; pageIndex: number }
  | { kind: 'text'; pageIndex: number; offset?: number; limit?: number };
type Job = { start: () => void; cancel: () => void; done: Promise<unknown> };

const EXECUTION_ENTRY = new URL('./pdf-execution.js', import.meta.url);

/** 中止即视为读取结束：不响应取消的材料读取不能永久占用唯一计算容量。 */
async function readOrAbort(read: Promise<ArrayBuffer>, signal: AbortSignal): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  let abort = () => {};
  try {
    return await Promise.race([
      read,
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(new OperationError('shuttingDown', 'PDF材料读取已中止。'));
        signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

/**
 * 串行隔离WASM到受管计算进程：容量在读取材料快照前取得，实际进程退出并释放材料后才安排下一项。
 * PDF字节按受控引用与当前任务令牌分块取回，停止或超时等真实收尾完成再复用容量。
 */
export class PdfReading {
  private queue: Job[] = [];
  private current: Job | undefined;
  private stopped = false;
  /** 计算进程入口可注入夹具，以核对分块协议边界。 */
  constructor(
    private readonly entry: URL = EXECUTION_ENTRY,
    private readonly processes?: ProcessAdmission,
  ) {}
  run<T>(
    load: (signal: AbortSignal) => Promise<ArrayBuffer>,
    request: PdfRequest,
    options: {
      signal?: AbortSignal | undefined;
      waitForCapacity?: boolean;
      verify?: (value: T, signal: AbortSignal) => Promise<void>;
    } = {},
  ): Promise<T> {
    if (this.stopped)
      return Promise.reject(new OperationError('shuttingDown', 'PDF读取正在停止。'));
    if (this.current && this.queue.length >= 8)
      return Promise.reject(new OperationError('unavailable', 'PDF读取队列已满，请稍后重试。'));
    if (options.signal?.aborted)
      return Promise.reject(new OperationError('shuttingDown', 'PDF读取已取消。'));
    let immediateReservation: ProcessReservation | undefined;
    try {
      if (options.waitForCapacity === false) immediateReservation = this.processes?.reserve();
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise<T>((resolve, reject) => {
      let complete!: () => void;
      const done = new Promise<void>((finish) => {
        complete = finish;
      });
      let settled = false;
      let delivered = false;
      let child: Promise<ManagedNode> | undefined;
      let loading: Promise<ArrayBuffer> | undefined;
      let reservation: ProcessReservation | undefined = immediateReservation;
      const controller = new AbortController();
      const finish = (error?: ErrorInfo, value?: T) => {
        if (settled) return;
        settled = true;
        controller.abort();
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', job.cancel);
        this.queue = this.queue.filter((item) => item !== job);
        void release()
          .then(
            () => {
              if (error) reject(new OperationError(error.code, error.message));
              else resolve(value as T);
            },
            (error) =>
              reject(
                error instanceof OperationError
                  ? error
                  : new OperationError('outcomeUnknown', 'PDF资源停止尚未确认。'),
              ),
          )
          .finally(complete);
      };
      const release = async () => {
        await loading?.catch(() => undefined);
        const owned = await child?.catch(() => undefined);
        await owned?.stop();
        reservation?.release();
        if (this.current !== job) return;
        this.current = undefined;
        if (!this.stopped) this.queue.shift()?.start();
      };
      const execute = async () => {
        try {
          reservation ??= this.processes?.reserve(true);
          await reservation?.ready;
          controller.signal.throwIfAborted();
          loading = readOrAbort(load(controller.signal), controller.signal);
          const bytes = await loading;
          if (settled) return;
          const ref = randomUUID();
          const token = randomUUID();
          child = ManagedNode.start({
            entry: this.entry,
            instanceId: token,
            ...(reservation ? { reservation } : {}),
          });
          const owned = await child;
          if (settled) return;
          owned.on('message', (value: unknown) => {
            const message = value as {
              kind?: string;
              ref?: string;
              token?: string;
              offset?: number;
              length?: number;
              data?: string;
              result?: T;
              error?: ErrorInfo;
            };
            if (message?.ref !== ref || message?.token !== token) return;
            if (message.kind === 'chunk') {
              const offset = message.offset ?? 0;
              const length = message.length ?? 0;
              const within =
                Number.isSafeInteger(length) &&
                Number.isSafeInteger(offset) &&
                length > 0 &&
                length <= MATERIAL_CHUNK &&
                offset >= 0 &&
                offset + length <= bytes.byteLength;
              void owned
                .send(
                  within
                    ? {
                        kind: 'chunk',
                        ref,
                        token,
                        offset,
                        data: Buffer.from(bytes, offset, length).toString('base64'),
                      }
                    : {
                        kind: 'chunk',
                        ref,
                        token,
                        offset,
                        error: {
                          code: 'invalidRequest' as const,
                          message: 'PDF分块范围无效。',
                        },
                      },
                )
                .catch(() => undefined);
            } else if (message.kind === 'result') {
              delivered = true;
              void (async () => {
                await options.verify?.(message.result as T, controller.signal);
                finish(undefined, message.result);
              })().catch((error) =>
                finish(
                  error instanceof OperationError
                    ? error
                    : { code: 'unavailable', message: 'PDF交付核查失败。' },
                ),
              );
            } else if (message.kind === 'failure')
              finish(message.error ?? { code: 'unavailable', message: 'PDF读取执行单元失败。' });
          });
          owned.once('failure', () =>
            finish({ code: 'unavailable', message: 'PDF读取执行单元失败。' }),
          );
          owned.once('exit', () => {
            if (!delivered) finish({ code: 'unavailable', message: 'PDF读取未返回结果。' });
          });
          await owned.send({ kind: 'run', ref, token, size: bytes.byteLength, request });
        } catch (error) {
          finish(
            error instanceof OperationError
              ? error
              : { code: 'unavailable', message: 'PDF材料读取失败。' },
          );
        }
      };
      const job: Job = {
        done,
        cancel: () => finish({ code: 'shuttingDown', message: 'PDF读取已停止。' }),
        start: () => {
          if (settled) return;
          this.current = job;
          void execute();
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
  async close(): Promise<void> {
    this.stopped = true;
    const jobs = [...(this.current ? [this.current] : []), ...this.queue];
    this.current?.cancel();
    for (const job of [...this.queue]) job.cancel();
    await Promise.allSettled(jobs.map((job) => job.done));
  }
}
