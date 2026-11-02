import { randomUUID } from 'node:crypto';
import { RpcPeer, type RpcTransport } from '@scholoom/broker/rpc';
import {
  type IsolatedReportOptions,
  IsolatedReportProvider,
  openReportChannel,
  type ProcessAdmission,
  type ProcessReservation,
} from '@scholoom/platform/node';
import { compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type IsolationControlInputs as Inputs,
  type IsolationPort,
  type IsolationStatus,
  isolationOperations,
  isolationRecordLimits,
  type IsolationControlMethod as Method,
  type IsolationControlOutputs as Outputs,
  isolationControlOperations as operations,
  validateIsolationPut,
  validateIsolationStage,
} from '@scholoom/protocol/isolation';
import { reportLimits } from '@scholoom/protocol/reports';

const contracts = Object.fromEntries(
  Object.entries(operations).map(([method, operation]) => [method, compileContract(operation)]),
);
const invalid = () => new OperationError('invalidRequest', '报告控制请求不属于当前绑定。');
const unavailable = () => new OperationError('unavailable', '报告控制端尚未完成恢复屏障。');
const incompatible = () => new OperationError('protocolIncompatible', '报告控制回执不完整。');
type Preparation = Inputs['reportControl.prepare'];
type Frozen = Awaited<ReturnType<Parameters<IsolatedReportProvider['prepare']>[1]>>;

function control(method: string): boolean {
  return (
    method === 'reportControl.open' ||
    method === 'reportControl.close' ||
    method === 'platform.reportIsolation.stop' ||
    (method.startsWith('reportHost.') &&
      method !== 'reportHost.ready' &&
      method !== 'reportHost.freeze' &&
      method !== 'reportHost.read')
  );
}

function input<M extends Method>(method: M, value: unknown): Inputs[M] {
  if (!contracts[method]?.params(value)) throw invalid();
  return value as Inputs[M];
}
async function call<M extends Method>(
  peer: RpcPeer,
  method: M,
  value: Inputs[M],
): Promise<Outputs[M]> {
  input(method, value);
  const semantics = operations[method].semantics;
  const result = await peer.request(method, value, {
    waitMs: semantics.waitMs,
    lossCode: semantics.effect === 'write' ? 'outcomeUnknown' : 'unavailable',
    control: control(method),
  });
  if (!contracts[method]?.result(result)) throw incompatible();
  return result as Outputs[M];
}

/** K owns authorization, immutable freeze inputs and the application's sole admission. */
export class ReportControlClient {
  private peer: RpcPeer | undefined;
  private ready = false;
  private opening: { id: string; inventory: Map<string, IsolationStatus> } | undefined;
  private closing = false;
  private connectionAttempt = 0;
  private readonly owned = new Map<string, { reservation: ProcessReservation; stopped(): void }>();
  private readonly recovered = new Set<string>();
  private readonly released = new Set<string>();
  private readonly requested = new Set<string>();
  private readonly preparations = new Map<
    string,
    { input: Preparation; promise: Promise<IsolationStatus>; load(): Promise<Frozen> }
  >();
  private readonly frozen = new Map<string, Frozen>();
  private readonly loading = new Map<string, Promise<unknown>>();
  private readonly detach = new Map<string, () => void>();
  constructor(
    private readonly options: {
      configId: string;
      admission: ProcessAdmission;
      authorize(instanceId: string): Promise<void>;
      signal?(instanceId: string): AbortSignal | undefined;
    },
  ) {}

  async connectService(endpoint: {
    path: string;
    ownerUid: number;
    serverUid: number;
  }): Promise<void> {
    const attempt = ++this.connectionAttempt;
    let binding: ReturnType<ReportControlClient['connect']> | undefined;
    const channel = await openReportChannel({
      ...endpoint,
      onFrame: (frame) => binding?.receive(frame),
      onClose: () => binding?.disconnect(),
    });
    try {
      if (attempt !== this.connectionAttempt || this.closing) throw unavailable();
      binding = this.connect(channel);
      await this.initialize();
    } catch (error) {
      binding?.disconnect();
      await channel.close();
      throw error;
    }
  }

  /** The assembly supplies an authenticated transport. Reconnection never grants or replays work. */
  connect(transport: RpcTransport): { receive(frame: string): void; disconnect(): void } {
    if (this.closing) throw unavailable();
    this.connectionAttempt++;
    this.ready = false;
    this.opening = undefined;
    this.peer?.close();
    const peer = new RpcPeer(transport, {
      control,
      request: async (method, raw) => {
        if (this.peer !== peer) throw unavailable();
        return this.request(method, raw, peer);
      },
    });
    this.peer = peer;
    return {
      receive: (frame) => {
        if (this.peer === peer) peer.receive(frame);
      },
      disconnect: () => {
        if (this.peer === peer) this.disconnect();
      },
    };
  }
  disconnect(): void {
    this.connectionAttempt++;
    this.ready = false;
    this.opening = undefined;
    this.peer?.close();
    this.peer = undefined;
    // Unacknowledged leases survive the connection. Only C's complete inventory can settle them.
  }
  async initialize(): Promise<void> {
    if (!this.peer || this.opening || this.closing) throw unavailable();
    const peer = this.peer;
    const opening = { id: randomUUID(), inventory: new Map<string, IsolationStatus>() };
    this.opening = opening;
    this.ready = false;
    try {
      const result = await call(peer, 'reportControl.open', {
        configId: this.options.configId,
        requestId: opening.id,
      });
      if (
        peer !== this.peer ||
        result.configId !== this.options.configId ||
        result.requestId !== opening.id ||
        result.total !== opening.inventory.size
      )
        throw incompatible();
      // A complete inventory also proves that an old, unpersisted preparation created no OS intent.
      for (const id of new Set([...this.owned.keys(), ...this.recovered])) {
        if (opening.inventory.get(id)?.stopConfirmed !== false) this.finish(id);
      }
      for (const [id, status] of opening.inventory) {
        this.requested.add(id);
        if (status.stopConfirmed) this.frozen.delete(id);
      }
      this.ready = true;
    } finally {
      if (this.opening === opening) this.opening = undefined;
    }
  }
  private track(id: string): void {
    if (this.requested.has(id)) return;
    if (this.requested.size >= isolationRecordLimits.instances)
      throw new OperationError('resourceLimit', '报告控制身份容量已满。');
    this.requested.add(id);
    const signal = this.options.signal?.(id);
    const stop = () => {
      void this.invoke('platform.reportIsolation.stop', { instanceId: id }).catch(() => {});
    };
    signal?.addEventListener('abort', stop, { once: true });
    this.detach.set(id, () => signal?.removeEventListener('abort', stop));
  }
  private async authorize(id: string, peer: RpcPeer): Promise<void> {
    if (!this.requested.has(id) || this.released.has(id) || this.options.signal?.(id)?.aborted)
      throw invalid();
    await this.options.authorize(id);
    if (peer !== this.peer || this.released.has(id) || this.options.signal?.(id)?.aborted)
      throw unavailable();
  }
  private finish(id: string): void {
    this.released.add(id);
    this.frozen.delete(id);
    this.detach.get(id)?.();
    this.detach.delete(id);
    const loading = this.loading.get(id);
    if (loading) {
      // C may time out its freeze RPC while K is still reading approved bytes.
      void loading.then(
        () => this.finish(id),
        () => this.finish(id),
      );
      return;
    }
    const owner = this.owned.get(id);
    if (owner) {
      owner.stopped();
      owner.reservation.release();
      this.owned.delete(id);
    } else if (this.recovered.has(id)) {
      this.options.admission.settleRecovered(id, Promise.resolve());
    }
    this.recovered.delete(id);
  }
  private async request(method: string, raw: unknown, peer: RpcPeer): Promise<unknown> {
    switch (method) {
      case 'reportHost.authorize': {
        const p = input(method, raw);
        await this.authorize(p.instanceId, peer);
        return {};
      }
      case 'reportHost.reserve': {
        const { instanceId: id } = input(method, raw);
        if (
          !this.requested.has(id) ||
          this.released.has(id) ||
          this.owned.has(id) ||
          this.recovered.has(id)
        )
          throw invalid();
        const reservation = this.options.admission.reserve(true, id);
        let stopped = () => {};
        reservation.retainUntil(
          new Promise<void>((resolve) => {
            stopped = resolve;
          }),
        );
        this.owned.set(id, { reservation, stopped });
        return {};
      }
      case 'reportHost.ready': {
        const p = input(method, raw);
        const owner = this.owned.get(p.instanceId);
        if (!owner) throw invalid();
        await owner.reservation.ready;
        if (peer !== this.peer || this.owned.get(p.instanceId) !== owner) throw unavailable();
        return {};
      }
      case 'reportHost.release': {
        const { instanceId: id } = input(method, raw);
        if (!this.owned.has(id) && !this.recovered.has(id) && !this.released.has(id))
          throw invalid();
        this.finish(id);
        return {};
      }
      case 'reportHost.recover': {
        const { instanceId: id } = input(method, raw);
        if (!this.opening) throw unavailable();
        if (!this.owned.has(id)) {
          this.options.admission.retainUnknown(id);
          this.recovered.add(id);
        }
        return {};
      }
      case 'reportHost.inventory': {
        const p = input(method, raw);
        const opening = this.opening;
        if (!opening || opening.id !== p.requestId) throw unavailable();
        for (const status of p.statuses) {
          if (
            opening.inventory.has(status.instanceId) ||
            opening.inventory.size >= isolationRecordLimits.instances
          )
            throw incompatible();
          opening.inventory.set(status.instanceId, status);
        }
        return {};
      }
      case 'reportHost.freeze': {
        const { instanceId: id } = input(method, raw);
        const preparation = this.preparations.get(id);
        if (!preparation || this.frozen.has(id) || this.loading.has(id) || !this.owned.has(id))
          throw invalid();
        const work = (async () => {
          await this.authorize(id, peer);
          const frozen = await preparation.load();
          if (
            !frozen ||
            !Array.isArray(frozen.files) ||
            frozen.files.some((file) => !(file?.bytes instanceof Uint8Array))
          )
            throw invalid();
          const stage = {
            ...preparation.input,
            entryPath: frozen.entryPath,
            assets: frozen.files.map((file) => ({
              path: file.path,
              byteLength: file.bytes.byteLength,
            })),
          };
          if (!validateIsolationStage(stage)) throw invalid();
          await this.authorize(id, peer);
          this.frozen.set(id, {
            entryPath: frozen.entryPath,
            files: frozen.files.map((file) => ({
              path: file.path,
              bytes: Uint8Array.from(file.bytes),
            })),
          });
          return stage;
        })();
        this.loading.set(id, work);
        try {
          return await work;
        } finally {
          if (this.loading.get(id) === work) this.loading.delete(id);
        }
      }
      case 'reportHost.read': {
        const p = input(method, raw);
        await this.authorize(p.instanceId, peer);
        const file = this.frozen.get(p.instanceId)?.files.find((file) => file.path === p.path);
        if (!file || p.offset >= file.bytes.length) throw invalid();
        return {
          instanceId: p.instanceId,
          path: p.path,
          offset: p.offset,
          base64: Buffer.from(file.bytes.subarray(p.offset, p.offset + p.limit)).toString('base64'),
        };
      }
      default:
        throw invalid();
    }
  }
  private invoke<M extends keyof IsolationPort>(method: M, value: Inputs[M]): Promise<Outputs[M]> {
    input(method, value);
    if (!this.ready || this.closing || !this.peer) return Promise.reject(unavailable());
    if ('instanceId' in value) this.track(value.instanceId);
    const peer = this.peer;
    return call(peer, method, value).then((result) => {
      if (
        peer === this.peer &&
        'instanceId' in value &&
        'stopConfirmed' in result &&
        result.stopConfirmed
      )
        this.finish(value.instanceId);
      return result;
    });
  }
  prepare(value: Preparation, load: () => Promise<Frozen>): Promise<IsolationStatus> {
    input('reportControl.prepare', value);
    if (!this.ready || this.closing || !this.peer) return Promise.reject(unavailable());
    const prior = this.preparations.get(value.instanceId);
    if (prior) {
      if (prior.input.programId !== value.programId || prior.input.policyId !== value.policyId)
        return Promise.reject(invalid());
      return prior.promise;
    }
    this.track(value.instanceId);
    // Save the loader before sending: the callback may arrive before the request's ACK.
    const peer = this.peer;
    const promise = Promise.resolve().then(() => {
      if (peer !== this.peer || !this.ready || this.closing) throw unavailable();
      return call(peer, 'reportControl.prepare', value);
    });
    this.preparations.set(value.instanceId, { input: { ...value }, promise, load });
    return promise;
  }
  port(): IsolationPort {
    return {
      'platform.reportIsolation.check': (p) => this.invoke('platform.reportIsolation.check', p),
      'platform.reportIsolation.stage': (p) => this.invoke('platform.reportIsolation.stage', p),
      'platform.reportIsolation.put': (p) => this.invoke('platform.reportIsolation.put', p),
      'platform.reportIsolation.start': (p) => this.invoke('platform.reportIsolation.start', p),
      'platform.reportIsolation.get': (p) => this.invoke('platform.reportIsolation.get', p),
      'platform.reportIsolation.stop': (p) => this.invoke('platform.reportIsolation.stop', p),
    };
  }
  async exchange(
    value: Inputs['reportControl.exchange'],
  ): Promise<Outputs['reportControl.exchange']> {
    input('reportControl.exchange', value);
    if (!this.ready || this.closing || !this.peer) throw unavailable();
    const peer = this.peer;
    await this.authorize(value.instanceId, peer);
    const result = await call(peer, 'reportControl.exchange', value);
    if (peer !== this.peer) throw unavailable();
    return result;
  }
  async close(): Promise<void> {
    this.connectionAttempt++;
    const peer = this.peer;
    this.closing = true;
    try {
      if (!peer) throw unavailable();
      await call(peer, 'reportControl.close', {});
      if (peer !== this.peer) throw unavailable();
      for (const id of new Set([...this.owned.keys(), ...this.recovered])) this.finish(id);
      this.disconnect();
    } finally {
      // Losing C rejects the RPC before its accepted domain reads necessarily settle.
      await Promise.allSettled([...this.loading.values()]);
      this.closing = false;
    }
  }
}

/** C owns the original provider and all its mutable receipts. No record or native path crosses RPC. */
export class ReportControlHost {
  private readonly peer: RpcPeer;
  private readonly provider: IsolatedReportProvider;
  private readonly signals = new Map<string, AbortController>();
  private readonly pending = new Set<Promise<void>>();
  private initialized?: Promise<void>;
  private opened = false;
  private opening = false;
  private closing: Promise<void> | undefined;
  constructor(
    transport: RpcTransport,
    private readonly options: Omit<IsolatedReportOptions, 'admission' | 'authorize' | 'signal'> & {
      configId: string;
      native?: ConstructorParameters<typeof IsolatedReportProvider>[1];
    },
  ) {
    this.peer = new RpcPeer(transport, {
      control,
      request: (method, raw) => this.request(method, raw),
    });
    this.provider = new IsolatedReportProvider(
      {
        ...options,
        admission: {
          reserve: (_wait, id) => {
            if (!id) throw invalid();
            const registered = call(this.peer, 'reportHost.reserve', { instanceId: id });
            const ready = registered
              .then(() => call(this.peer, 'reportHost.ready', { instanceId: id }))
              .then(() => {});
            void ready.catch(() => {});
            let retained = 0,
              released = false,
              requested = false;
            const release = () => {
              if (released || retained || !requested) return;
              released = true;
              this.track(
                registered
                  .then(() => call(this.peer, 'reportHost.release', { instanceId: id }))
                  .then(() => {}),
              );
            };
            return {
              ready,
              retainUntil: (stopped) => {
                retained++;
                void stopped.then(
                  () => {
                    retained--;
                    release();
                  },
                  () => {},
                );
              },
              release: () => {
                requested = true;
                release();
              },
            };
          },
          retainUnknown: async (id) => {
            await call(this.peer, 'reportHost.recover', { instanceId: id });
          },
          settleRecovered: (id, stopped) => {
            this.track(
              stopped
                .then(() => call(this.peer, 'reportHost.release', { instanceId: id }))
                .then(() => {}),
            );
          },
        },
        authorize: async (id) => {
          await call(this.peer, 'reportHost.authorize', { instanceId: id });
        },
        signal: (id) => {
          let signal = this.signals.get(id);
          if (!signal) {
            if (this.signals.size >= isolationRecordLimits.instances) throw invalid();
            signal = new AbortController();
            this.signals.set(id, signal);
          }
          return signal.signal;
        },
      },
      options.native,
    );
  }
  receive(frame: string): void {
    this.peer.receive(frame);
  }
  private track(work: Promise<void>): void {
    this.pending.add(work);
    // A lost release ACK leaves K's lease unknown; the complete close/inventory barrier settles it.
    void work.catch(() => {}).finally(() => this.pending.delete(work));
  }
  private async drain(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }
  private closeProvider(): Promise<void> {
    if (this.closing) return this.closing;
    const closing = (this.initialized ?? Promise.resolve())
      .then(() => this.provider.close())
      .then(() => this.drain());
    this.closing = closing;
    void closing.catch(() => {
      if (this.closing === closing) this.closing = undefined;
    });
    return this.closing;
  }
  async disconnect(): Promise<void> {
    this.peer.close();
    try {
      await this.closeProvider();
    } catch {
      /* K retains unknown leases; C's receipts remain authoritative. */
    }
  }
  private async request(method: string, raw: unknown): Promise<unknown> {
    if (method === 'reportControl.open') {
      const p = input(method, raw);
      if (p.configId !== this.options.configId || this.closing || this.opening || this.opened)
        throw invalid();
      this.opening = true;
      try {
        this.initialized ??= this.provider.initialize();
        await this.initialized;
        const inventory = this.provider.inventory();
        const pageSize = operations['reportHost.inventory'].params.properties.statuses.maxItems;
        for (let offset = 0; offset < inventory.length; offset += pageSize) {
          await call(this.peer, 'reportHost.inventory', {
            requestId: p.requestId,
            statuses: inventory.slice(offset, offset + pageSize),
          });
        }
        this.opened = true;
        return { configId: this.options.configId, requestId: p.requestId, total: inventory.length };
      } finally {
        this.opening = false;
      }
    }
    if (method === 'reportControl.close') {
      input(method, raw);
      await this.closeProvider();
      return {};
    }
    if (!this.opened || !this.initialized || this.closing) throw unavailable();
    await this.initialized;
    if (method === 'reportControl.exchange') return this.provider.exchange(input(method, raw));
    if (method === 'reportControl.prepare') {
      const p = input(method, raw);
      return this.provider.prepare(p, async () => {
        const manifest = await call(this.peer, 'reportHost.freeze', { instanceId: p.instanceId });
        if (
          !validateIsolationStage(manifest) ||
          manifest.instanceId !== p.instanceId ||
          manifest.programId !== p.programId ||
          manifest.policyId !== p.policyId
        )
          throw incompatible();
        const files: Frozen['files'][number][] = [];
        for (const asset of manifest.assets) {
          const bytes = Buffer.alloc(asset.byteLength);
          for (let offset = 0; offset < bytes.length; ) {
            const chunk = await call(this.peer, 'reportHost.read', {
              instanceId: p.instanceId,
              path: asset.path,
              offset,
              limit: Math.min(reportLimits.entryBytes, bytes.length - offset),
            });
            if (
              !validateIsolationPut(chunk) ||
              chunk.instanceId !== p.instanceId ||
              chunk.path !== asset.path ||
              chunk.offset !== offset
            )
              throw incompatible();
            const data = Buffer.from(chunk.base64, 'base64');
            if (data.length !== Math.min(reportLimits.entryBytes, bytes.length - offset))
              throw incompatible();
            bytes.set(data, offset);
            offset += data.length;
          }
          files.push({ path: asset.path, bytes });
        }
        return { entryPath: manifest.entryPath, files };
      });
    }
    if (!Object.hasOwn(isolationOperations, method)) throw invalid();
    const name = method as keyof IsolationPort;
    const value = input(name, raw);
    if (name === 'platform.reportIsolation.stop' && 'instanceId' in value)
      this.signals.get(value.instanceId)?.abort();
    return this.provider.port()[name](value as never);
  }
}
