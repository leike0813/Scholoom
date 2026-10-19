import { RpcPeer } from '@scholoom/broker/rpc';
import type { ErrorInfo, KernelEndpoint, KernelStatus, ShutdownAccepted } from '@scholoom/protocol';
import {
  type BusinessInputs,
  type BusinessOutputs,
  businessSchemas,
  type CallArguments,
  isJsonRpcNotification,
  isKernelEndpoint,
  isKernelStatus,
  isShutdownAccepted,
  isWorkbenchChange,
  limits,
  operationWait,
  protocolVersion,
  validateBusiness,
  type WorkbenchChange,
} from '@scholoom/protocol';

/** Connection state shared by every host of the kernel client. */
export interface ConnectionSnapshot {
  phase: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stopping' | 'error';
  status?: KernelStatus;
  error?: ErrorInfo;
}

type Phase = ConnectionSnapshot['phase'];

/** Kernel failure carrying a protocol ErrorInfo code. */
export class KernelClientError extends Error implements ErrorInfo {
  readonly code: ErrorInfo['code'];

  constructor(code: ErrorInfo['code'], message: string) {
    super(message);
    this.name = 'KernelClientError';
    this.code = code;
  }
}

const stoppingInfo: ErrorInfo = {
  code: 'shuttingDown',
  message: 'Kernel is stopping; exit has not been confirmed.',
};

/** Shared client for one discovered kernel endpoint: JSON-RPC correlation and bounded reconnect. */
export class KernelClient {
  private readonly endpoint: KernelEndpoint;
  private listeners = new Set<() => void>();
  private changeListeners = new Set<(change: WorkbenchChange) => void>();
  private snapshot: ConnectionSnapshot = { phase: 'disconnected' };
  private phase: Phase = 'disconnected';
  private kernelStatus: KernelStatus | null = null;

  private socket: WebSocket | null = null;
  private generation = 0;
  private peer: RpcPeer | null = null;
  private inFlight: Promise<KernelStatus> | null = null;

  private reconnectAllowed = true;
  private reconnectRun = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectWaiter: (() => void) | null = null;

  private shutdownAccepted = false;
  private shutdownPending = 0;
  private disposed = false;
  private developmentOwner = false;

  constructor(endpoint: KernelEndpoint) {
    if (!isKernelEndpoint(endpoint)) {
      throw new KernelClientError('invalidRequest', 'Invalid local kernel endpoint.');
    }
    this.endpoint = endpoint;
  }

  readonly getSnapshot = (): ConnectionSnapshot => this.snapshot;

  readonly subscribeChanges = (listener: (change: WorkbenchChange) => void): (() => void) => {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  };

  async call<A extends CallArguments<BusinessInputs>>(...args: A): Promise<BusinessOutputs[A[0]]> {
    const [method, params] = args;
    if (!validateBusiness(method, 'params', params))
      throw new KernelClientError('invalidRequest', 'Invalid operation parameters.');
    const contract = businessSchemas[method];
    const result = await this.request(
      method,
      params,
      operationWait(contract, params),
      contract.semantics.effect === 'read' ? 'unavailable' : 'outcomeUnknown',
    );
    if (!validateBusiness(method, 'result', result))
      throw this.terminal({ code: 'protocolIncompatible', message: 'Invalid operation result.' });
    return result as BusinessOutputs[A[0]];
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Authenticates against the endpoint and reads the actual kernel status. */
  async connect(): Promise<KernelStatus> {
    if (this.disposed) throw new KernelClientError('unavailable', 'Client has been disposed.');
    if (this.phase === 'connected' && this.kernelStatus !== null && this.isOpen()) {
      return this.kernelStatus;
    }
    this.cancelReconnect();
    try {
      return await this.startConnection('connecting');
    } catch (error) {
      if (!this.disposed && this.phase !== 'error' && this.phase !== 'stopping')
        this.update('disconnected', toErrorInfo(error));
      throw error;
    }
  }

  /** Queries the status of the connected kernel without starting one. */
  async status(): Promise<KernelStatus> {
    if (this.disposed) throw new KernelClientError('unavailable', 'Client has been disposed.');
    if (!this.isOpen()) throw new KernelClientError('unavailable', 'Not connected to the kernel.');
    const status = this.verifyStatus(
      await this.request('kernel.status', undefined, limits.requestMs),
    );
    this.kernelStatus = status;
    if (status.state === 'stopping') this.reconnectAllowed = false;
    this.update(
      this.phase === 'stopping' || status.state === 'stopping' ? 'stopping' : 'connected',
    );
    return status;
  }

  /** Owns a development kernel until this connection closes. */
  async attachDevelopment(): Promise<KernelStatus> {
    const status = this.verifyStatus(
      await this.request('kernel.development.attach', {}, limits.requestMs),
    );
    this.developmentOwner = true;
    return status;
  }

  /** Requests an explicit kernel shutdown; resolves once the kernel accepts it. */
  async shutdown(): Promise<ShutdownAccepted> {
    if (this.disposed) throw new KernelClientError('unavailable', 'Client has been disposed.');
    if (!this.isOpen()) throw new KernelClientError('unavailable', 'Not connected to the kernel.');
    this.shutdownPending += 1;
    try {
      const result = await this.request(
        'kernel.shutdown',
        { instanceId: this.endpoint.instanceId },
        limits.requestMs,
        'outcomeUnknown',
      );
      if (!isShutdownAccepted(result) || result.instanceId !== this.endpoint.instanceId) {
        throw this.terminal({
          code: 'protocolIncompatible',
          message: 'Kernel accepted an invalid shutdown.',
        });
      }
      this.shutdownAccepted = true;
      this.reconnectAllowed = false;
      return result;
    } catch (error) {
      if (!this.disposed) {
        const info = toErrorInfo(error);
        if (info.code === 'outcomeUnknown') {
          this.reconnectAllowed = false;
          this.update('error', info);
        } else if (this.phase === 'connected' || this.phase === 'stopping') {
          this.update(this.phase, info);
        }
      }
      throw error;
    } finally {
      this.shutdownPending -= 1;
    }
  }

  /** Closes the connection, releasing any development ownership. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reconnectAllowed = false;
    this.cancelReconnect();
    this.rejectPending();
    this.closeSocket();
    this.update('disconnected');
  }

  private isOpen(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private startConnection(phase: 'connecting' | 'reconnecting'): Promise<KernelStatus> {
    if (this.inFlight !== null) return this.inFlight;
    const run = this.runConnection(phase);
    const tracked = run.finally(() => {
      if (this.inFlight === tracked) this.inFlight = null;
    });
    this.inFlight = tracked;
    return tracked;
  }

  private async runConnection(phase: 'connecting' | 'reconnecting'): Promise<KernelStatus> {
    this.update(phase);
    this.closeSocket();
    try {
      const socket = this.openSocket();
      await this.waitForOpen(socket);
      const authentication = await this.request(
        'kernel.authenticate',
        { token: this.endpoint.token, protocolVersion, instanceId: this.endpoint.instanceId },
        limits.authenticationMs,
      );
      this.verifyStatus(authentication);
      const status = this.verifyStatus(
        await this.request('kernel.status', undefined, limits.requestMs),
      );
      this.kernelStatus = status;
      if (this.developmentOwner) await this.attachDevelopment();
      this.reconnectAllowed = this.phase !== 'stopping' && status.state !== 'stopping';
      if (this.reconnectAllowed) this.shutdownAccepted = false;
      this.update(this.reconnectAllowed ? 'connected' : 'stopping');
      return status;
    } catch (error) {
      if (this.phase === 'error') throw error;
      if (error instanceof KernelClientError && error.code !== 'unavailable') {
        throw this.terminal(toErrorInfo(error));
      }
      this.closeSocket();
      throw toKernelClientError(error);
    }
  }

  private openSocket(): WebSocket {
    const generation = ++this.generation;
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.endpoint.url);
    } catch (error) {
      throw toKernelClientError(error);
    }
    this.socket = socket;
    this.peer = new RpcPeer(
      {
        send: (frame) => {
          if (socket.readyState !== WebSocket.OPEN)
            throw new KernelClientError('unavailable', 'Connection closed.');
          if (socket.bufferedAmount > limits.frameBytes)
            throw new KernelClientError('resourceLimit', 'Connection backlog is full.');
          socket.send(frame);
        },
      },
      {
        notification: (method, params) => this.handleNotification(method, params),
        invalid: (error) => {
          this.terminal(error);
        },
      },
    );
    socket.addEventListener('message', (event: MessageEvent) => {
      if (generation === this.generation) this.handleMessage(event.data);
    });
    socket.addEventListener('close', () => {
      if (generation === this.generation) this.handleClose();
    });
    // A close event follows a socket error; the listener keeps it from being unhandled.
    socket.addEventListener('error', () => {});
    return socket;
  }

  private waitForOpen(socket: WebSocket): Promise<void> {
    if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        settle(
          new KernelClientError('unavailable', 'Kernel did not accept the connection in time.'),
        );
      }, limits.authenticationMs);
      const onOpen = (): void => settle();
      const onFailure = (): void =>
        settle(new KernelClientError('unavailable', 'Unable to reach the kernel.'));
      const settle = (error?: KernelClientError): void => {
        clearTimeout(timer);
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('error', onFailure);
        socket.removeEventListener('close', onFailure);
        if (error === undefined) resolve();
        else reject(error);
      };
      socket.addEventListener('open', onOpen);
      socket.addEventListener('error', onFailure);
      socket.addEventListener('close', onFailure);
    });
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.generation += 1;
    if (socket === null) return;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      try {
        socket.close();
      } catch {
        // The socket is already unusable.
      }
    }
  }

  private handleClose(): void {
    this.socket = null;
    const wasConnected = this.phase === 'connected';
    const stopped = this.phase === 'stopping' || this.shutdownAccepted;
    const receiptLost = this.shutdownPending > 0;
    if (receiptLost) this.reconnectAllowed = false;
    this.rejectPending();
    if (this.disposed) return;
    if (stopped && !receiptLost) {
      this.update('stopping', stoppingInfo);
      return;
    }
    if (!this.reconnectAllowed) return;
    if (wasConnected) this.beginReconnect();
  }

  private beginReconnect(): void {
    this.update('reconnecting');
    const run = ++this.reconnectRun;
    void this.runReconnect(run);
  }

  private async runReconnect(run: number): Promise<void> {
    for (const delay of limits.reconnectDelays) {
      await this.wait(delay);
      if (run !== this.reconnectRun || this.disposed || !this.reconnectAllowed) return;
      try {
        await this.startConnection('reconnecting');
        return;
      } catch {
        if (run !== this.reconnectRun || this.disposed || !this.reconnectAllowed) return;
        if (this.phase === 'error') return;
      }
    }
    if (run !== this.reconnectRun || this.disposed || !this.reconnectAllowed) return;
    if (this.phase === 'reconnecting') {
      this.update('disconnected', { code: 'unavailable', message: 'Kernel is unreachable.' });
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.reconnectWaiter = resolve;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnectWaiter = null;
        resolve();
      }, ms);
    });
  }

  private cancelReconnect(): void {
    this.reconnectRun += 1;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const waiter = this.reconnectWaiter;
    this.reconnectWaiter = null;
    if (waiter !== null) waiter();
  }

  private request(
    method: string,
    params: unknown,
    timeoutMs: number,
    lossCode: ErrorInfo['code'] = 'unavailable',
  ): Promise<unknown> {
    if (!this.isOpen() || !this.peer)
      return Promise.reject(new KernelClientError('unavailable', 'Not connected to the kernel.'));
    return this.peer
      .request(method, params, {
        waitMs: timeoutMs,
        lossCode,
        control: method.startsWith('kernel.'),
      })
      .catch((error: unknown) => {
        const info = error as ErrorInfo;
        throw new KernelClientError(
          info.code ?? lossCode,
          info.message ?? 'Kernel request failed.',
        );
      });
  }

  private verifyStatus(result: unknown): KernelStatus {
    if (!isKernelStatus(result)) {
      throw this.terminal({
        code: 'protocolIncompatible',
        message: 'Kernel returned an invalid status.',
      });
    }
    if (
      result.instanceId !== this.endpoint.instanceId ||
      result.dataDirectory !== this.endpoint.dataDirectory
    ) {
      throw this.terminal({
        code: 'instanceMismatch',
        message: 'Kernel instance does not match the discovered endpoint.',
      });
    }
    if (result.protocolVersion !== this.endpoint.protocolVersion) {
      throw this.terminal({
        code: 'protocolIncompatible',
        message: 'Kernel protocol version does not match the discovered endpoint.',
      });
    }
    return result;
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') {
      this.terminal({ code: 'protocolIncompatible', message: 'Kernel sent a non-text frame.' });
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      this.terminal({ code: 'protocolIncompatible', message: 'Kernel sent invalid JSON.' });
      return;
    }
    if (isJsonRpcNotification(message)) this.handleNotification(message.method, message.params);
    else this.peer?.receive(raw);
  }

  private handleNotification(method: string, params: unknown): void {
    if (method === 'kernel.stopping') this.handleStopping(params);
    if (method === 'workbench.changed') {
      if (!isWorkbenchChange(params)) return;
      for (const listener of this.changeListeners) listener(params);
    }
  }

  private handleStopping(params: unknown): void {
    if (!isShutdownAccepted(params)) {
      this.terminal({
        code: 'protocolIncompatible',
        message: 'Kernel sent an invalid stopping notification.',
      });
      return;
    }
    if (params.instanceId !== this.endpoint.instanceId) {
      this.terminal({
        code: 'instanceMismatch',
        message: 'Kernel stopping notification targets another instance.',
      });
      return;
    }
    this.reconnectAllowed = false;
    if (this.kernelStatus !== null) this.kernelStatus = { ...this.kernelStatus, state: 'stopping' };
    this.update('stopping');
  }

  private rejectPending(info?: ErrorInfo): void {
    this.peer?.close(info);
    this.peer = null;
  }

  // Marks the connection as dead; callers decide whether to rethrow the returned error.
  private terminal(info: ErrorInfo): KernelClientError {
    this.reconnectAllowed = false;
    if (this.phase !== 'error') this.update('error', info);
    this.rejectPending(info);
    this.closeSocket();
    return new KernelClientError(info.code, info.message);
  }

  private update(phase: Phase, error?: ErrorInfo): void {
    this.phase = phase;
    const snapshot: ConnectionSnapshot = { phase };
    if (
      this.kernelStatus !== null &&
      (phase === 'connected' || phase === 'reconnecting' || phase === 'stopping')
    ) {
      snapshot.status = this.kernelStatus;
    }
    if (error !== undefined) snapshot.error = error;
    this.snapshot = snapshot;
    for (const listener of [...this.listeners]) listener();
  }
}

export function createKernelClient(endpoint: KernelEndpoint): KernelClient {
  return new KernelClient(endpoint);
}

function toKernelClientError(
  error: unknown,
  code: ErrorInfo['code'] = 'unavailable',
): KernelClientError {
  if (error instanceof KernelClientError) return error;
  const message = error instanceof Error ? error.message : 'Kernel connection failed.';
  return new KernelClientError(code, message);
}

function toErrorInfo(error: unknown): ErrorInfo {
  const clientError = toKernelClientError(error);
  return { code: clientError.code, message: clientError.message };
}
