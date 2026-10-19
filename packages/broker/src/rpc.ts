import {
  type ErrorInfo,
  isErrorInfo,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  limits,
  OperationError,
} from '@scholoom/protocol/core';

export type RpcTransport = { send(frame: string): void | Promise<void>; close?(): void };
export type RpcLimits = {
  inFlight: number;
  incoming: number;
  queued: number;
  control: number;
  frameBytes: number;
};
export const rpcLimits: RpcLimits = {
  inFlight: 64,
  incoming: 64,
  queued: 64,
  control: 8,
  frameBytes: limits.frameBytes,
};
type Pending = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
  loss: ErrorInfo['code'];
};
type WaitingFrame = { frame: string; resolve(): void; reject(error: Error): void };

/** One full duplex correlation mechanism for WS and Node IPC adapters. */
export class RpcPeer {
  private next = 0;
  private readonly pending = new Map<string, Pending>();
  private readonly queue: WaitingFrame[] = [];
  private sending = false;
  private closed = false;
  private incoming = 0;
  private controlIncoming = 0;
  constructor(
    private readonly transport: RpcTransport,
    private readonly options: {
      request?: (method: string, params: unknown) => unknown | Promise<unknown>;
      notification?: (method: string, params: unknown) => void;
      control?: (method: string) => boolean;
      invalid?: (error: OperationError) => void;
      limits?: Partial<RpcLimits>;
    } = {},
  ) {}
  private get capacity(): RpcLimits {
    return { ...rpcLimits, ...this.options.limits };
  }

  request(
    method: string,
    params: unknown,
    options: { waitMs: number; lossCode?: ErrorInfo['code']; control?: boolean },
  ): Promise<unknown> {
    if (this.closed) return Promise.reject(new OperationError('unavailable', 'RPC连接已关闭。'));
    const max = this.capacity.inFlight + (options.control ? this.capacity.control : 0);
    if (this.pending.size >= max)
      return Promise.reject(new OperationError('resourceLimit', 'RPC等待容量已满。'));
    const id = String(++this.next);
    const loss = options.lossCode ?? 'unavailable';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new OperationError(loss, 'RPC等待超时。'));
      }, options.waitMs);
      this.pending.set(id, { resolve, reject, timer, loss });
      void this.send(
        { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) },
        options.control,
      ).catch((error: Error) => {
        if (!this.pending.delete(id)) return;
        clearTimeout(timer);
        // send rejection can mean a partially delivered frame; preserve write uncertainty.
        reject(
          new OperationError(
            error instanceof OperationError && error.code === 'resourceLimit'
              ? 'resourceLimit'
              : loss,
            error.message,
          ),
        );
      });
    });
  }

  notify(method: string, params: unknown, control = false): Promise<void> {
    return this.send(
      { jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) },
      control,
    );
  }

  private async send(value: unknown, control = false): Promise<void> {
    if (this.closed) throw new OperationError('unavailable', 'RPC连接已关闭。');
    const frame = JSON.stringify(value);
    if (new TextEncoder().encode(frame).byteLength > this.capacity.frameBytes)
      throw new OperationError('tooLarge', 'RPC帧超出容量。');
    if (this.queue.length >= this.capacity.queued + (control ? this.capacity.control : 0))
      throw new OperationError('resourceLimit', 'RPC发送队列已满。');
    return new Promise<void>((resolve, reject) => {
      const item = { frame, resolve, reject };
      if (control) this.queue.unshift(item);
      else this.queue.push(item);
      void this.flush();
    });
  }

  private async flush(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      while (!this.closed && this.queue.length) {
        const next = this.queue.shift();
        if (!next) break;
        try {
          await this.transport.send(next.frame);
          next.resolve();
        } catch (error) {
          next.reject(error instanceof Error ? error : new Error('RPC发送失败。'));
        }
      }
    } finally {
      this.sending = false;
    }
  }

  receive(raw: string): void {
    if (this.closed) return;
    let value: unknown;
    try {
      if (new TextEncoder().encode(raw).byteLength > this.capacity.frameBytes)
        throw new Error('frame');
      value = JSON.parse(raw);
    } catch {
      this.invalid();
      return;
    }
    if (isJsonRpcResponse(value)) {
      const pending = value.id === null ? undefined : this.pending.get(String(value.id));
      if (!pending) return;
      this.pending.delete(String(value.id));
      clearTimeout(pending.timer);
      if ('error' in value)
        pending.reject(new OperationError(value.error.data.code, value.error.data.message));
      else pending.resolve(value.result);
      return;
    }
    if (isJsonRpcNotification(value)) {
      try {
        this.options.notification?.(value.method, value.params);
      } catch {
        /* Local notification rejection. */
      }
      return;
    }
    if (!isJsonRpcRequest(value)) {
      this.invalid();
      return;
    }
    const request = value;
    const control = this.options.control?.(request.method) === true;
    if (
      control
        ? this.controlIncoming >= this.capacity.control
        : this.incoming >= this.capacity.incoming
    ) {
      void this.answerError(
        request.id,
        new OperationError('resourceLimit', 'RPC受理容量已满。'),
      ).catch(() => this.close());
      return;
    }
    if (control) this.controlIncoming++;
    else this.incoming++;
    void (async () => {
      try {
        if (!this.options.request) throw new OperationError('invalidRequest', '操作不可用。');
        const result = await this.options.request(request.method, request.params);
        await this.send({ jsonrpc: '2.0', id: request.id, result: result ?? null }, true);
      } catch (error) {
        await this.answerError(request.id, error);
      } finally {
        if (control) this.controlIncoming--;
        else this.incoming--;
      }
    })().catch(() => this.close());
  }

  private async answerError(id: string | number, error: unknown): Promise<void> {
    const info =
      isErrorInfo(error) || error instanceof OperationError
        ? { code: error.code, message: error.message.slice(0, 512) }
        : { code: 'unavailable', message: 'RPC操作失败。' };
    await this.send(
      { jsonrpc: '2.0', id, error: { code: -32010, message: info.message, data: info } },
      true,
    );
  }
  private invalid(): void {
    const error = new OperationError('protocolIncompatible', 'RPC帧不符合契约。');
    this.options.invalid?.(error);
    this.close(error);
  }
  close(info?: ErrorInfo): void {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new OperationError(info?.code ?? pending.loss, info?.message ?? 'RPC连接丢失。'),
      );
    }
    this.pending.clear();
    for (const queued of this.queue.splice(0))
      queued.reject(new OperationError('unavailable', 'RPC连接已关闭。'));
    this.transport.close?.();
  }
}
