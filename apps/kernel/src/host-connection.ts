import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { RpcPeer } from '@scholoom/broker/rpc';
import {
  atomicPrivateFile,
  type ProcessAdmission,
  privateDirectory,
} from '@scholoom/platform/node';
import {
  type CallContext,
  compileContract,
  limits,
  type OperationContract,
  OperationError,
  protocolVersion,
} from '@scholoom/protocol/core';
import {
  type HostBootstrap,
  type HostInvocation,
  type HostRecord,
  isHostRecord,
  validateHostMessage,
} from '@scholoom/protocol/host';
import { type WebSocket, WebSocketServer } from 'ws';
import type { CommandWorkspace, ManagedCommands } from './commands.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  void promise.catch(() => {});
  return { promise, resolve, reject };
}
function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new OperationError('outcomeUnknown', 'Host wait expired')),
      ms,
    );
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
      .catch(() => {});
  });
}
type Contracts = Readonly<Record<string, OperationContract>>;
type State = 'idle' | 'starting' | 'ready' | 'closing' | 'closed' | 'unknown';
type Options = {
  directory: string;
  kernelInstanceId: string;
  executable: string;
  args: readonly string[];
  scope: string;
  commands: Pick<ManagedCommands, 'start' | 'cancel'>;
  admission: ProcessAdmission;
  operations: Contracts;
  callbacks: {
    contracts: Contracts;
    authorize(
      operation: { method: string; input: unknown },
      callback: { method: string; input: unknown },
      context: CallContext,
    ): void;
    call(method: string, input: unknown, context: CallContext): Promise<unknown>;
  };
  waitMs?: number;
};

/** One configuration owner holds its kernel lock; this Module never attaches by stored PID. */
export class HostConnection {
  readonly instanceId = randomUUID();
  private readonly context: CallContext;
  private readonly token = randomBytes(32).toString('hex');
  private readonly ready = deferred<void>();
  private readonly stopped = deferred<void>();
  private readonly inflight = new Map<
    string,
    {
      context: CallContext;
      method: string;
      input: unknown;
      write: boolean;
      callbacks: Promise<unknown>[];
      pendingCallbacks: number;
      accepting: boolean;
      work: Promise<unknown>;
    }
  >();
  private state: State = 'idle';
  private record: HostRecord;
  private url = '';
  private supplied = false;
  private authenticated = false;
  private closing: Promise<ReturnType<HostConnection['status']>> | undefined;
  private peer: RpcPeer | undefined;
  private server: WebSocketServer | undefined;
  private readonly sockets = new Set<WebSocket>();
  private writes: Promise<void> = Promise.resolve();
  private storeFailed = false;
  private recoveryHeld = false;
  private recoveryBlocked = false;
  private ownedIntent = false;
  private starting: Promise<ReturnType<HostConnection['status']>> | undefined;
  private error: string | undefined;
  private output = '';

  constructor(private readonly options: Options) {
    this.context = {
      moduleId: 'managed-host',
      role: 'host',
      principal: { kind: 'system', id: options.kernelInstanceId },
    };
    this.record = {
      version: 1,
      kernelInstanceId: options.kernelInstanceId,
      hostInstanceId: this.instanceId,
      commandInstanceId: 'not-started',
      scopeStopped: false,
      pluginClosed: false,
      unresolved: [],
    };
  }
  private get waitMs() {
    return this.options.waitMs ?? limits.lifecycleMs;
  }
  status() {
    return {
      state: this.state,
      instanceId: this.instanceId,
      commandInstanceId: this.record.commandInstanceId,
      scopeStopped: this.record.scopeStopped,
      pluginClosed: this.record.pluginClosed,
      unresolved: [...this.record.unresolved],
      pendingCallbacks: [...this.inflight.values()].reduce(
        (total, entry) => total + entry.pendingCallbacks,
        0,
      ),
      diagnostics: this.output,
      ...(this.error ? { reason: this.error } : {}),
    };
  }
  workspace(): CommandWorkspace {
    return {
      ownerModuleId: 'managed-host',
      directory: this.options.directory,
      executables: new Map([['host', this.options.executable]]),
      launchInput: this.launchInput,
    };
  }
  private launchInput = async (commandInstanceId: string) => {
    if (
      this.supplied ||
      this.state !== 'starting' ||
      commandInstanceId !== this.record.commandInstanceId
    )
      throw new OperationError('permissionDenied', 'Host launch qualification expired');
    this.supplied = true;
    const value: HostBootstrap = {
      kernelInstanceId: this.options.kernelInstanceId,
      hostInstanceId: this.instanceId,
      commandInstanceId,
      token: this.token,
      protocolVersion,
      url: this.url,
    };
    return JSON.stringify(value);
  };
  private save() {
    const snapshot = JSON.stringify(this.record);
    if (!isHostRecord(this.record) || Buffer.byteLength(snapshot) > 65536) {
      this.storeFailed = true;
      this.fail('supervisionRecordInvalid');
      return Promise.reject(
        new OperationError('tooLarge', 'Host supervision record exceeds capacity'),
      );
    }
    const saved = this.writes.then(() =>
      atomicPrivateFile(this.options.directory, 'host-supervision.json', snapshot),
    );
    this.writes = saved.catch(() => {
      this.storeFailed = true;
      this.state = 'unknown';
      this.error = 'supervisionPersistenceFailed';
    });
    return saved;
  }
  private fail(code: string) {
    this.state = 'unknown';
    this.error ??= code;
    this.ready.reject(new OperationError('outcomeUnknown', code));
  }
  private retainUnknownScope() {
    if (this.recoveryHeld) return;
    this.recoveryHeld = true;
    this.options.admission.retainUnknown(
      this.record.commandInstanceId === 'not-started'
        ? `host:${this.options.directory}`
        : this.record.commandInstanceId,
    );
  }
  start() {
    if (this.state !== 'idle')
      return Promise.reject(new OperationError('invalidRequest', 'Use a fresh host connection'));
    this.state = 'starting';
    this.starting = this.initialize();
    return this.starting.catch(async (error) => {
      this.fail('hostStartupFailed');
      await this.close();
      throw error;
    });
  }
  private ensureStarting() {
    if (this.state !== 'starting')
      throw new OperationError('shuttingDown', 'Host startup was interrupted');
  }
  private async initialize() {
    await privateDirectory(this.options.directory);
    this.ensureStarting();
    try {
      const file = await open(join(this.options.directory, 'host-supervision.json'), 'r');
      let previous: unknown;
      try {
        if ((await file.stat()).size > 65536)
          throw new OperationError('tooLarge', 'Host record exceeds capacity');
        previous = JSON.parse(await file.readFile('utf8'));
      } finally {
        await file.close();
      }
      if (!isHostRecord(previous))
        throw new OperationError('invalidRequest', 'Invalid supervision record');
      const record = previous as HostRecord;
      if (!record.scopeStopped || !record.pluginClosed || record.unresolved.length) {
        this.record = record;
        if (!record.scopeStopped) this.retainUnknownScope();
        this.fail('previousHostRequiresReconciliation');
        throw new OperationError('outcomeUnknown', 'Previous host still requires reconciliation');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.recoveryBlocked = true;
        if (!this.record.scopeStopped) this.retainUnknownScope();
        this.fail('supervisionRecoveryFailed');
        throw error;
      }
    }
    this.ensureStarting();
    const server = new WebSocketServer({
      host: '127.0.0.1',
      port: 0,
      maxPayload: limits.frameBytes,
    });
    this.server = server;
    server.on('connection', (socket) => this.accept(socket));
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    this.ensureStarting();
    const address = this.server.address();
    if (!address || typeof address === 'string')
      throw new OperationError('unavailable', 'Host listener unavailable');
    this.url = `ws://127.0.0.1:${address.port}/`;
    try {
      const accepted = await this.options.commands.start(
        {
          workspaceId: this.instanceId,
          executableId: 'host',
          args: [...this.options.args],
          timeoutMs: null,
        },
        this.context,
        async (event, commandInstanceId) => {
          this.record.commandInstanceId = commandInstanceId;
          if (event.kind === 'intent') this.ownedIntent = true;
          if (event.kind === 'stopped') this.record.scopeStopped = true;
          if (event.kind === 'unknown' && !this.record.pluginClosed) this.fail(event.error.code);
          if (event.kind === 'exited' && event.code !== 0) {
            this.record.pluginClosed = false;
            this.fail('hostExitedAbnormally');
          }
          if (event.kind === 'output') {
            this.output = (this.output + event.text)
              .replaceAll(this.token, '<credential>')
              .replaceAll(this.options.directory, '<hostDirectory>')
              .slice(-4096);
            return;
          }
          await this.save();
          if (event.kind === 'stopped') {
            if (!this.record.pluginClosed) this.fail('hostStoppedWithoutShutdown');
            this.stopped.resolve();
          }
        },
        () => {
          this.fail('commandObservationFailed');
          this.stopped.reject(new OperationError('outcomeUnknown', 'Host stop observation lost'));
        },
      );
      this.record.commandInstanceId = accepted.commandInstanceId;
      await bounded(this.ready.promise, this.waitMs);
      this.ensureReady();
      return this.status();
    } catch (error) {
      this.fail('hostStartupFailed');
      throw error;
    }
  }
  private ensureReady() {
    if (this.state !== 'ready')
      throw new OperationError('shuttingDown', 'Host startup was interrupted');
  }
  private accept(socket: WebSocket) {
    if (this.sockets.size >= 2 || this.authenticated || this.state !== 'starting') {
      socket.terminate();
      return;
    }
    this.sockets.add(socket);
    let authorized = false;
    const timer = setTimeout(() => socket.terminate(), this.waitMs);
    const peer = new RpcPeer(
      {
        send: (frame) =>
          new Promise<void>((resolve, reject) => {
            if (socket.readyState !== 1 || socket.bufferedAmount > limits.frameBytes) {
              reject(new OperationError('unavailable', 'Host transport unavailable'));
              return;
            }
            socket.send(frame, (error) => (error ? reject(error) : resolve()));
          }),
        close: () => socket.close(),
      },
      {
        control: (method) => method === 'host.authenticate' || method === 'host.ready',
        request: async (method, params) => {
          if (!authorized) {
            if (method !== 'host.authenticate' || !validateHostMessage(method, params))
              throw new OperationError('authenticationFailed', 'Host authentication required');
            const credentials = params as HostBootstrap;
            const token = Buffer.from(credentials.token);
            if (
              this.authenticated ||
              credentials.protocolVersion !== protocolVersion ||
              credentials.kernelInstanceId !== this.options.kernelInstanceId ||
              credentials.hostInstanceId !== this.instanceId ||
              credentials.commandInstanceId !== this.record.commandInstanceId ||
              token.length !== this.token.length ||
              !timingSafeEqual(token, Buffer.from(this.token))
            ) {
              setImmediate(() => socket.close());
              throw new OperationError('authenticationFailed', 'Host credentials rejected');
            }
            clearTimeout(timer);
            authorized = this.authenticated = true;
            this.peer = peer;
            return { ok: true };
          }
          if (
            method === 'host.ready' &&
            this.state === 'starting' &&
            validateHostMessage(method, params) &&
            (params as { scope: string }).scope === this.options.scope
          ) {
            await this.save();
            this.ensureStarting();
            this.state = 'ready';
            this.ready.resolve();
            return { ok: true };
          }
          if (method !== 'host.callback' || !validateHostMessage(method, params))
            throw new OperationError('permissionDenied', 'Host method not allowed');
          const request = params as HostInvocation;
          const invocation = this.inflight.get(request.handle);
          const contract = this.options.callbacks.contracts[request.method];
          if (!invocation?.accepting || !contract)
            throw new OperationError('permissionDenied', 'Callback outside accepted operation');
          if (
            (!invocation.write && contract.semantics.effect === 'write') ||
            invocation.callbacks.length >= 64
          )
            throw new OperationError('permissionDenied', 'Callback exceeds operation authority');
          this.options.callbacks.authorize(
            { method: invocation.method, input: invocation.input },
            { method: request.method, input: request.input },
            invocation.context,
          );
          invocation.context.signal?.throwIfAborted();
          const validation = compileContract(contract);
          if (!validation.params(request.input))
            throw new OperationError('invalidRequest', 'Invalid callback parameters');
          invocation.pendingCallbacks++;
          const work = Promise.resolve()
            .then(async () => {
              invocation.context.signal?.throwIfAborted();
              const result = await this.options.callbacks.call(
                request.method,
                request.input,
                invocation.context,
              );
              if (!validation.result(result))
                throw new OperationError(
                  contract.semantics.effect === 'write' ? 'outcomeUnknown' : 'unavailable',
                  'Invalid callback result',
                );
              return result;
            })
            .finally(() => {
              invocation.pendingCallbacks--;
            });
          invocation.callbacks.push(work);
          void work.catch(() => {});
          return work;
        },
      },
    );
    socket.on('message', (bytes, binary) => {
      if (binary) peer.close();
      else peer.receive(bytes.toString());
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      clearTimeout(timer);
      this.sockets.delete(socket);
      peer.close();
      if (authorized && this.state !== 'closing' && this.state !== 'closed') {
        this.fail('hostConnectionLost');
        this.cancel();
      }
    });
  }
  call(
    method: string,
    input: unknown,
    context: CallContext,
    operationId?: string,
  ): Promise<unknown> {
    const contract = this.options.operations[method];
    if (this.state !== 'ready' || !this.peer)
      return Promise.reject(new OperationError('unavailable', 'Host is not ready'));
    if (!contract || !compileContract(contract).params(input))
      return Promise.reject(new OperationError('invalidRequest', 'Host operation not declared'));
    const write = contract.semantics.effect === 'write';
    if (
      write &&
      (!operationId || operationId.length > 1024 || this.record.unresolved.includes(operationId))
    )
      return Promise.reject(
        new OperationError('invalidRequest', 'Stable operation identity required'),
      );
    if (this.inflight.size >= 64 || (write && this.record.unresolved.length >= 64))
      return Promise.reject(new OperationError('resourceLimit', 'Host operations full'));
    if (context.signal?.aborted) return Promise.reject(context.signal.reason);
    if (
      write &&
      Buffer.byteLength(
        JSON.stringify({ ...this.record, unresolved: [...this.record.unresolved, operationId] }),
      ) > 65536
    )
      return Promise.reject(
        new OperationError('resourceLimit', 'Host operation references exceed capacity'),
      );
    input = structuredClone(input);
    const handle = randomUUID();
    const trusted = Object.freeze({
      ...context,
      principal: Object.freeze({ ...context.principal }),
      ...(context.workDomain ? { workDomain: Object.freeze({ ...context.workDomain }) } : {}),
      ...(context.targetRead ? { targetRead: Object.freeze({ ...context.targetRead }) } : {}),
    });
    const peer = this.peer;
    if (write && operationId) this.record.unresolved.push(operationId);
    const callbacks: Promise<unknown>[] = [];
    const work = Promise.resolve().then(async () => {
      let sent = false;
      try {
        trusted.signal?.throwIfAborted();
        if (write) await this.save();
        trusted.signal?.throwIfAborted();
        sent = true;
        const expires = Date.now() + contract.semantics.waitMs;
        const result = await peer.request(
          'host.invoke',
          { handle, method, input },
          { waitMs: contract.semantics.waitMs, lossCode: write ? 'outcomeUnknown' : 'unavailable' },
        );
        const invocation = this.inflight.get(handle);
        if (invocation) invocation.accepting = false;
        let completed = 0;
        while (completed < callbacks.length) {
          const batch = callbacks.slice(completed);
          completed = callbacks.length;
          await bounded(Promise.all(batch), Math.max(1, expires - Date.now()));
        }
        if (!compileContract(contract).result(result))
          throw new OperationError(write ? 'outcomeUnknown' : 'unavailable', 'Invalid host result');
        trusted.signal?.throwIfAborted();
        if (write) {
          this.record.unresolved = this.record.unresolved.filter((id) => id !== operationId);
          await this.save();
        }
        return result;
      } catch (error) {
        if (write && sent) this.fail('mutationOutcomeUnknown');
        if (write && !sent) {
          this.record.unresolved = this.record.unresolved.filter((id) => id !== operationId);
          await this.save();
        }
        throw error;
      } finally {
        const invocation = this.inflight.get(handle);
        if (invocation) invocation.accepting = false;
      }
    });
    // A request can expire while its accepted callbacks still own work and capacity.
    const drained = Promise.allSettled([work]).then(async () => {
      await Promise.allSettled(callbacks);
      this.inflight.delete(handle);
    });
    this.inflight.set(handle, {
      context: trusted,
      method,
      input,
      write,
      callbacks,
      pendingCallbacks: 0,
      accepting: true,
      work: drained,
    });
    return work;
  }
  cancel() {
    this.fail('hostCancelled');
    if (this.record.commandInstanceId !== 'not-started')
      this.options.commands.cancel(
        { workspaceId: this.instanceId, commandInstanceId: this.record.commandInstanceId },
        this.context,
      );
  }
  close() {
    this.closing ??= this.stop();
    return this.closing;
  }
  private async stop() {
    this.state = 'closing';
    this.ready.reject(new OperationError('shuttingDown', 'Host is closing'));
    await this.starting?.catch(() => {});
    this.state = 'closing';
    const peer = this.peer;
    try {
      await bounded(
        Promise.allSettled([...this.inflight.values()].map((entry) => entry.work)),
        this.waitMs,
      );
      if (peer && !this.record.unresolved.length && !this.storeFailed) {
        const result = await peer.request(
          'host.shutdown',
          {},
          { waitMs: this.waitMs, control: true, lossCode: 'outcomeUnknown' },
        );
        if (
          !validateHostMessage('host.shutdown', result, true) ||
          (result as { state: string }).state !== 'closed'
        )
          throw new OperationError('outcomeUnknown', 'Plugin shutdown unconfirmed');
        this.record.pluginClosed = true;
        await this.save();
      }
    } catch {
      this.fail('hostShutdownUnconfirmed');
    }
    peer?.close();
    try {
      if (this.ownedIntent) await bounded(this.stopped.promise, this.waitMs);
    } catch {
      this.options.commands.cancel(
        { workspaceId: this.instanceId, commandInstanceId: this.record.commandInstanceId },
        this.context,
      );
      await bounded(this.stopped.promise, this.waitMs).catch(() =>
        this.fail('nativeStopUnconfirmed'),
      );
    }
    for (const socket of this.sockets) socket.terminate();
    const server = this.server;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!this.ownedIntent && !this.recoveryBlocked) {
      this.record.scopeStopped = true;
      this.record.pluginClosed = true;
    }
    this.state =
      this.record.scopeStopped &&
      this.record.pluginClosed &&
      !this.record.unresolved.length &&
      this.inflight.size === 0 &&
      !this.storeFailed &&
      !this.recoveryBlocked
        ? 'closed'
        : 'unknown';
    if (this.ownedIntent) await this.save().catch(() => {});
    return this.status();
  }
}
