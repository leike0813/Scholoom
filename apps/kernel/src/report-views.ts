import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { ReportResources } from '@scholoom/editor/node';
import type { ProcessAdmission } from '@scholoom/platform/node';
import type { CallContext } from '@scholoom/protocol/core';
import { OperationError } from '@scholoom/protocol/core';
import { type IsolationStatus, isolationRecordLimits } from '@scholoom/protocol/isolation';
import {
  isReportProgramCommand,
  isReportProgramPacket,
  type ReportProgramPacket,
} from '@scholoom/protocol/reports';
import type {
  ResourceEvidence,
  ResourceInputs,
  ResourceOutputs,
} from '@scholoom/protocol/resources';
import { ReportControlClient } from './report-control.js';

export type ReportViewInstallation = {
  configId: string;
  programId: string;
  policyId: string;
  connect(client: ReportControlClient): Promise<void>;
};
type Binding = ResourceInputs['resources.reportGet'];
type Open = ResourceInputs['resources.reportOpen'];
type Frozen = Awaited<ReturnType<ReportResources['freeze']>>;
type View = {
  connectionId: string;
  input: Open;
  instanceId: string;
  controller: AbortController;
  authorize(): Promise<void>;
  opened: Promise<ResourceOutputs['resources.reportOpen']>;
  frozen?: Frozen | undefined;
  stopped?: Promise<IsolationStatus> | undefined;
};
const unavailable = () => new OperationError('unavailable', '报告执行尚不可用。');
const denied = () => new OperationError('permissionDenied', '报告视图不属于当前工作台连接。');

/** Owns product-view lifetimes; C alone owns execution receipts and releases K's admission. */
export class ReportViews {
  private readonly connections = new Set<string>();
  private readonly views = new Map<string, View>();
  private readonly instances = new Map<string, View>();
  private readonly control: ReportControlClient | undefined;
  private initialized = false;
  private closing: Promise<void> | undefined;
  constructor(
    private readonly options: {
      admission: ProcessAdmission;
      installation?: ReportViewInstallation;
      freeze(entry: Open['entry'], context: CallContext): Promise<Frozen>;
      authorization(evidence: readonly ResourceEvidence[], context: CallContext): () => void;
    },
  ) {
    if (options.installation)
      this.control = new ReportControlClient({
        configId: options.installation.configId,
        admission: options.admission,
        authorize: async (id) => {
          const view = this.instances.get(id);
          if (!view || view.controller.signal.aborted || !this.connections.has(view.connectionId))
            throw denied();
          await view.authorize();
        },
      });
  }
  async initialize(): Promise<void> {
    if (!this.control || !this.options.installation) return;
    await this.options.installation.connect(this.control);
    this.initialized = true;
  }
  connect(connectionId: string): void {
    if (this.closing) throw unavailable();
    this.connections.add(connectionId);
  }
  disconnect(connectionId: string): void {
    this.connections.delete(connectionId);
    for (const view of this.views.values()) {
      if (view.connectionId === connectionId) {
        // The persistent C receipt keeps unknown stops charged; disconnect is never a receipt.
        void this.stop(view).catch(() => {});
      }
    }
  }
  private owner(context: CallContext): string {
    const id = context.workbenchSource?.connectionId;
    if (
      this.closing ||
      context.role !== 'product' ||
      context.principal.kind !== 'human' ||
      !id ||
      !this.connections.has(id)
    )
      throw denied();
    return id;
  }
  private key(connectionId: string, input: Binding): string {
    return JSON.stringify([connectionId, input.viewId, input.generation]);
  }
  private view(input: Binding, context: CallContext): View {
    const view = this.views.get(this.key(this.owner(context), input));
    if (!view) throw denied();
    return view;
  }
  private client(): ReportControlClient {
    if (!this.initialized || !this.control || this.closing) throw unavailable();
    return this.control;
  }
  private async readable(view: View, context: CallContext): Promise<void> {
    try {
      if (view.controller.signal.aborted) throw unavailable();
      await view.authorize();
      this.owner(context);
      if (view.controller.signal.aborted) throw unavailable();
    } catch (error) {
      void this.stop(view).catch(() => {});
      throw error;
    }
  }
  private async deliver(
    view: View,
    context: CallContext,
  ): Promise<ResourceOutputs['resources.reportOpen']> {
    const result = await view.opened;
    await this.readable(view, context);
    return structuredClone(result);
  }
  open(input: Open, context: CallContext): Promise<ResourceOutputs['resources.reportOpen']> {
    const owner = this.owner(context);
    const client = this.client();
    const key = this.key(owner, input);
    const prior = this.views.get(key);
    if (prior) {
      if (!isDeepStrictEqual(prior.input, input))
        throw new OperationError('instanceMismatch', '不能替换原报告视图的资源身份。');
      if (prior.controller.signal.aborted) throw unavailable();
      return this.deliver(prior, context);
    }
    if (this.views.size >= isolationRecordLimits.instances)
      throw new OperationError('resourceLimit', '报告视图身份容量已满。');
    const authorize = this.options.authorization([input.entry], context);
    authorize();
    const view: View = {
      connectionId: owner,
      input: structuredClone(input),
      instanceId: randomUUID(),
      controller: new AbortController(),
      authorize: async () => authorize(),
      opened: undefined as unknown as View['opened'],
    };
    this.views.set(key, view);
    this.instances.set(view.instanceId, view);
    // Register ownership before C can call back into authorization or preparation.
    view.opened = Promise.resolve().then(async () => {
      if (view.controller.signal.aborted) throw unavailable();
      const installation = this.options.installation!;
      const prepared = await client.prepare(
        {
          instanceId: view.instanceId,
          programId: installation.programId,
          policyId: installation.policyId,
        },
        async () => {
          const frozen = await this.options.freeze(view.input.entry, context);
          if (view.controller.signal.aborted) throw unavailable();
          const { resource, manifest } = frozen.snapshot;
          const confirm = this.options.authorization(
            [resource, ...manifest.resources, ...manifest.sources],
            context,
          );
          view.authorize = async () => {
            authorize();
            confirm();
          };
          view.frozen = frozen;
          await view.authorize();
          return { entryPath: frozen.snapshot.resource.path!, files: frozen.files };
        },
      );
      if (prepared.failure)
        throw new OperationError(prepared.failure.code, prepared.failure.message);
      if (view.controller.signal.aborted) throw unavailable();
      const status = await client
        .port()
        ['platform.reportIsolation.start']({ instanceId: view.instanceId });
      if (!view.frozen || status.failure || status.stopConfirmed)
        throw status.failure
          ? new OperationError(status.failure.code, status.failure.message)
          : unavailable();
      await view.authorize();
      if (view.controller.signal.aborted || !this.connections.has(owner)) throw unavailable();
      return {
        status,
        snapshot: view.frozen.snapshot,
        files: view.frozen.files.map(({ path, bytes }) => ({ path, byteLength: bytes.length })),
      };
    });
    // Failed/unknown opens are not replayed. Attempt only the idempotent original stop.
    void view.opened.catch(() => {
      void this.stop(view).catch(() => {});
    });
    return this.deliver(view, context);
  }
  async get(input: Binding, context: CallContext): Promise<IsolationStatus> {
    const view = this.view(input, context);
    const status = await this.client()
      .port()
      ['platform.reportIsolation.get']({ instanceId: view.instanceId });
    if (status.stopConfirmed) view.frozen = undefined;
    return status;
  }
  async read(
    input: ResourceInputs['resources.reportRead'],
    context: CallContext,
  ): Promise<ResourceOutputs['resources.reportRead']> {
    const view = this.view(input, context);
    await this.readable(view, context);
    const file = view.frozen?.files.find((file) => file.path === input.path);
    if (!file || input.offset > file.bytes.length)
      throw new OperationError('notFound', '报告冻结资源分片不存在。');
    const end = Math.min(file.bytes.length, input.offset + input.limit);
    return {
      base64: file.bytes.subarray(input.offset, end).toString('base64'),
      offset: input.offset,
      size: file.bytes.length,
      ...(end < file.bytes.length ? { nextOffset: end } : {}),
    };
  }
  async exchange(
    input: ResourceInputs['resources.reportExchange'],
    context: CallContext,
  ): Promise<ResourceOutputs['resources.reportExchange']> {
    const view = this.view(input, context);
    const client = this.client();
    if (view.controller.signal.aborted) throw unavailable();
    if (input.command) {
      const command = input.command;
      if (
        !isReportProgramCommand(command) ||
        ('viewId' in command &&
          (command.viewId !== view.input.viewId ||
            command.generation !== view.input.generation ||
            command.basis !== view.input.entry.basis))
      )
        throw new OperationError('invalidRequest', '报告命令版本不属于本视图。');
    }
    try {
      const result = await client.exchange({
        instanceId: view.instanceId,
        ...(input.command ? { frame: JSON.stringify(input.command) } : {}),
      });
      const packets: ReportProgramPacket[] = [];
      for (const frame of result.frames) {
        const packet: unknown = JSON.parse(frame);
        if (
          !isReportProgramPacket(packet) ||
          ('viewId' in packet &&
            (packet.viewId !== view.input.viewId ||
              packet.generation !== view.input.generation ||
              packet.basis !== view.input.entry.basis))
        )
          throw new OperationError('protocolIncompatible', '报告输出不符合呈现契约。');
        packets.push(packet);
      }
      await this.readable(view, context);
      return { packets };
    } catch (error) {
      void this.stop(view).catch(() => {});
      throw error;
    }
  }
  stopView(input: Binding, context: CallContext): Promise<IsolationStatus> {
    return this.stop(this.view(input, context));
  }
  private stop(view: View): Promise<IsolationStatus> {
    if (view.stopped) return view.stopped;
    view.controller.abort();
    // The view can no longer read; C retains its own transfer bytes and execution receipt.
    view.frozen = undefined;
    const stopped = this.control!.port()['platform.reportIsolation.stop']({
      instanceId: view.instanceId,
    });
    view.stopped = stopped;
    // Stop itself is idempotent; an unconfirmed outcome remains explicitly queryable/retryable.
    void stopped.then(
      (status) => {
        if (!status.stopConfirmed && view.stopped === stopped) view.stopped = undefined;
      },
      () => {
        if (view.stopped === stopped) view.stopped = undefined;
      },
    );
    return stopped;
  }
  close(): Promise<void> {
    this.closing ??= (async () => {
      this.connections.clear();
      for (const view of this.views.values()) view.controller.abort();
      try {
        if (this.control && this.initialized) await this.control.close();
      } finally {
        await Promise.allSettled([...this.views.values()].map((view) => view.opened));
        this.views.clear();
        this.instances.clear();
      }
    })();
    return this.closing;
  }
}
