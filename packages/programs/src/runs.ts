import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { failure } from '@scholoom/platform/node';
import { type CallContext, OperationError } from '@scholoom/protocol/core';
import type {
  ProgramCommandEvent,
  ProgramRun,
  ProgramsInputs,
  ProgramsOutputs,
} from '@scholoom/protocol/programs';
import type { ResourceDescriptor, ResourceEvidence } from '@scholoom/protocol/resources';
import type { ProgramRecords, StoredProgramRun } from './records.js';

export type InternalProgram = {
  projectId: string;
  operationId: string;
  environmentId: string;
  kind: 'environmentCheck' | 'environmentPreparation';
  executableId: string;
  executable: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  declarations?: ResourceEvidence[];
};
export type ProgramPorts = {
  records(
    projectId: string,
  ): Pick<ProgramRecords, 'get' | 'findOperation' | 'put' | 'list' | 'unfinished' | 'close'>;
  check(projectId: string, context: CallContext, write?: boolean): Promise<void>;
  available(): void;
  describe(evidence: ResourceEvidence, context: CallContext): Promise<ResourceDescriptor>;
  output(projectId: string, path: string, context: CallContext): Promise<ResourceDescriptor>;
  mkdir(projectId: string, path: string, context: CallContext): Promise<void>;
  launch(
    run: ProgramRun,
    executable: string,
    args: string[],
    cwd: string,
    timeoutMs: number | null,
    env: Readonly<Record<string, string>> | undefined,
    context: CallContext,
  ): Promise<string>;
  cancel(
    projectId: string,
    runId: string,
    commandInstanceId: string,
    context: CallContext,
  ): Promise<void>;
  environment(
    projectId: string,
    environmentId: string,
  ): { executableId: string; executable: string; version?: string; env?: Record<string, string> };
  changed(projectId: string, runId: string): void;
  retainUnknown(id: string): void;
  /** Validate without detaching; the synchronous commit either fails before effects or transfers control. */
  prepareHandoff(runId: string, context: CallContext): () => void;
};
const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const stamp = () => new Date().toISOString();
const reference = (run: ProgramRun) => ({ programRunId: run.programRunId, state: run.state });

/** One authority for human and Agent program facts; files remain project-owned. */
export class ProgramRuns {
  private readonly records = new Map<string, ReturnType<ProgramPorts['records']>>();
  private readonly active = new Map<
    string,
    { projectId: string; context: CallContext; done: Promise<void>; finish: () => void }
  >();
  private readonly notifications = new Map<string, ReturnType<typeof setTimeout>>();
  private closing = false;
  private readonly unconfirmed = new Map<string, string>();
  private readonly observationErrors = new Map<string, ReturnType<typeof failure>>();
  private readonly handoffReceipts = new Map<string, NonNullable<ProgramRun['backgroundOwner']>>();
  private readonly updates = new Map<string, Promise<unknown>>();
  constructor(private readonly ports: ProgramPorts) {}
  private serial<T>(id: string, action: () => Promise<T>): Promise<T> {
    const result = (this.updates.get(id) ?? Promise.resolve()).then(action);
    this.updates.set(id, result);
    void result
      .finally(() => {
        if (this.updates.get(id) === result) this.updates.delete(id);
      })
      .catch(() => {});
    return result;
  }
  private store(projectId: string) {
    let record = this.records.get(projectId);
    if (!record) {
      record = this.ports.records(projectId);
      this.records.set(projectId, record);
    }
    return record;
  }
  private save(stored: StoredProgramRun, immediate = false) {
    const receipt = this.handoffReceipts.get(stored.run.programRunId);
    if (receipt) {
      stored.run.backgroundOwner = { ...receipt };
      delete stored.run.backgroundOwner.error;
    }
    stored.run.updatedAt = stamp();
    this.store(stored.run.projectId).put(stored);
    if (receipt) this.handoffReceipts.delete(stored.run.programRunId);
    const key = stored.run.programRunId;
    if (immediate) {
      clearTimeout(this.notifications.get(key));
      this.notifications.delete(key);
      this.ports.changed(stored.run.projectId, key);
    } else if (!this.notifications.has(key)) {
      this.notifications.set(
        key,
        setTimeout(() => {
          this.notifications.delete(key);
          this.ports.changed(stored.run.projectId, key);
        }, 250),
      );
    }
  }
  initialize(projectIds: readonly string[]) {
    for (const id of projectIds) {
      if (id === 'application' || this.records.has(id)) continue;
      for (const stored of this.store(id).unfinished()) {
        if (stored.run.stop === 'confirmed' || !stored.commandInstanceId)
          stored.run.state = 'interrupted';
        else {
          stored.run.state = 'unknown';
          stored.run.stop = 'unknown';
          this.ports.retainUnknown(stored.commandInstanceId);
        }
        stored.run.error = {
          code: 'outcomeUnknown',
          message: '宿主已重启；未自动重跑，请核查原运行和实际结果。',
        };
        this.save(stored, true);
      }
    }
  }
  private async admit(
    projectId: string,
    operationId: string,
    context: CallContext,
    requestKey: string,
    kind: ProgramRun['kind'],
  ) {
    if (this.closing) throw new OperationError('shuttingDown', '程序模块正在关闭。');
    await this.ports.check(projectId, context, true);
    const records = this.store(projectId);
    const prior = records.findOperation(operationId, context.principal);
    if (prior) {
      if (
        !prior.requestKey ||
        !isDeepStrictEqual(JSON.parse(prior.requestKey), JSON.parse(requestKey))
      )
        throw new OperationError('invalidRequest', '同一操作身份的参数已变化。');
      return { stored: prior, created: false };
    }
    this.ports.available();
    const unfinished = records.unfinished();
    if (
      [...this.unconfirmed.values()].includes(projectId) ||
      unfinished.some((item) => item.run.state === 'unknown')
    )
      throw new OperationError('outcomeUnknown', '项目仍有停止未确认的程序。');
    if (unfinished.length >= 100)
      throw new OperationError('resourceLimit', '项目待处理运行已达上限。');
    const run: ProgramRun = {
      programRunId: randomUUID(),
      projectId,
      operationId,
      kind,
      state: 'queued',
      phase: 'accepted',
      stop: 'pending',
      createdAt: stamp(),
      updatedAt: stamp(),
      principal: { ...context.principal },
      logs: { next: 0, truncatedBefore: 0 },
      dependencyCoverage: 'declaredOnly',
    };
    if (context.sessionId)
      run.origin = {
        sessionId: context.sessionId,
        ...(context.runId ? { harnessRunId: context.runId } : {}),
        ...(context.instanceId ? { instanceId: context.instanceId } : {}),
      };
    const stored: StoredProgramRun = { run, entries: [], requestKey };
    this.save(stored, true);
    return { stored, created: true };
  }
  private track(stored: StoredProgramRun, context: CallContext) {
    let finish = () => {};
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.active.set(stored.run.programRunId, {
      projectId: stored.run.projectId,
      context,
      done,
      finish,
    });
  }
  private async dispatch(
    stored: StoredProgramRun,
    executable: string,
    args: string[],
    cwd: string,
    timeoutMs: number | null,
    env: Record<string, string> | undefined,
    context: CallContext,
  ) {
    if (!this.active.has(stored.run.programRunId)) this.track(stored, context);
    try {
      const instanceId = await this.ports.launch(
        stored.run,
        executable,
        args,
        cwd,
        timeoutMs,
        env,
        context,
      );
      const current = this.store(stored.run.projectId).get(stored.run.programRunId);
      if (!current.commandInstanceId) {
        current.commandInstanceId = instanceId;
        this.save(current);
      }
    } catch (error) {
      const current = this.store(stored.run.projectId).get(stored.run.programRunId);
      current.run.error = failure(error);
      current.run.state = current.commandInstanceId
        ? 'unknown'
        : current.run.cancelReason
          ? 'cancelled'
          : 'failed';
      current.run.stop = current.commandInstanceId ? 'unknown' : 'confirmed';
      this.save(current, true);
      this.finish(current.run.programRunId);
    }
  }
  async start(
    input: ProgramsInputs['programs.start'],
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.start']> {
    input = {
      ...input,
      cwd: input.cwd ?? '.',
      args: input.args ?? [],
      inputs: input.inputs ?? [],
      outputs: input.outputs ?? [],
      overwrite: input.overwrite ?? [],
      timeoutMs: input.timeoutMs ?? null,
      lifetime: input.lifetime ?? (context.principal.kind === 'human' ? 'background' : 'execution'),
    };
    const requestKey = JSON.stringify(input);
    const admitted = await this.admit(
      input.projectId,
      input.operationId,
      context,
      requestKey,
      'program',
    );
    let stored = admitted.stored;
    const created = admitted.created;
    if (!created) return reference(stored.run);
    if (this.store(input.projectId).get(stored.run.programRunId).run.state !== 'queued')
      return reference(this.store(input.projectId).get(stored.run.programRunId).run);
    this.track(stored, context);
    try {
      const environment = this.ports.environment(input.projectId, input.environmentId);
      if (context.principal.kind === 'agent' && input.lifetime === 'background')
        throw new OperationError('permissionDenied', '后台移交需要明确的人类授权。');
      const entries = [input.entry, ...(input.inputs ?? [])];
      for (const evidence of entries) {
        if (evidence.ref.source !== 'project' || evidence.ref.projectId !== input.projectId)
          throw new OperationError('permissionDenied', '程序只使用本项目已声明材料。');
      }
      const descriptors = await Promise.all(
        entries.map((item) => this.ports.describe(item, context)),
      );
      const entry = descriptors[0];
      if (!entry?.path || !/\.(?:m?js|py)$/i.test(entry.path))
        throw new OperationError('invalidRequest', '请选择支持的项目程序文件。');
      if (environment.executableId === 'node' && !/\.m?js$/i.test(entry.path))
        throw new OperationError('invalidRequest', 'Node需要JS或MJS程序。');
      const args = input.args ?? [];
      if (
        args.some((arg) => Buffer.byteLength(arg) > 4096) ||
        Buffer.byteLength(args.join('')) > 65536
      )
        throw new OperationError('tooLarge', '程序参数超过容量。');
      const cwd = input.cwd ?? '.';
      const outputs = [];
      for (const path of input.outputs ?? []) {
        try {
          const before = await this.ports.output(input.projectId, path, context);
          if (!input.overwrite?.includes(path))
            throw new OperationError('contentChanged', '输出已存在，请明确允许覆盖。');
          outputs.push({
            declaredPath: path,
            before: { ref: before.ref, basis: before.basis },
            presence: 'present' as const,
            completeness: 'unassessed' as const,
            attribution: 'observed' as const,
          });
        } catch (error) {
          if (failure(error).code !== 'notFound') throw error;
          outputs.push({
            declaredPath: path,
            presence: 'missing' as const,
            completeness: 'unassessed' as const,
            attribution: 'observed' as const,
          });
        }
        const parent = posix.dirname(path);
        if (this.store(input.projectId).get(stored.run.programRunId).run.state !== 'queued')
          throw new OperationError('shuttingDown', '启动准备已取消。');
        if (parent !== '.') await this.ports.mkdir(input.projectId, parent, context);
      }
      stored = this.store(input.projectId).get(stored.run.programRunId);
      if (stored.run.state !== 'queued')
        throw new OperationError('shuttingDown', '启动准备已取消。');
      stored.run.request = input;
      stored.run.environmentId = input.environmentId;
      stored.run.code = input.entry;
      stored.run.inputs = input.inputs ?? [];
      stored.run.outputs = outputs;
      const entryArg = `./${posix.relative(cwd, entry.path)}`;
      stored.run.command = {
        executableId: environment.executableId,
        args: [entryArg, ...args],
        cwd,
        ...(environment.version ? { version: environment.version } : {}),
      };
      this.save(stored);
      void this.dispatch(
        stored,
        environment.executable,
        [entryArg, ...args],
        cwd,
        input.timeoutMs ?? null,
        environment.env,
        context,
      );
      return reference(stored.run);
    } catch (error) {
      stored = this.store(input.projectId).get(stored.run.programRunId);
      stored.run.state = stored.run.cancelReason ? 'cancelled' : 'failed';
      stored.run.stop = 'confirmed';
      stored.run.error = failure(error);
      this.save(stored, true);
      this.finish(stored.run.programRunId);
      if (stored.run.cancelReason) return reference(stored.run);
      throw error;
    }
  }
  async launch(input: InternalProgram, context: CallContext) {
    const { stored, created } = await this.admit(
      input.projectId,
      input.operationId,
      context,
      JSON.stringify(input),
      input.kind,
    );
    if (created) {
      stored.run.environmentId = input.environmentId;
      stored.run.inputs = input.declarations ?? [];
      stored.run.command = {
        executableId: input.executableId,
        args: input.args,
        cwd: input.cwd ?? '.',
      };
      this.save(stored);
      void this.dispatch(
        stored,
        input.executable,
        input.args,
        input.cwd ?? '.',
        input.timeoutMs,
        input.env,
        context,
      );
    }
    return reference(stored.run);
  }
  event(input: ProgramCommandEvent) {
    return this.serial(input.programRunId, () => this.acceptEvent(input));
  }
  private async acceptEvent(input: ProgramCommandEvent) {
    const active = this.active.get(input.programRunId);
    if (!active) throw new OperationError('instanceMismatch', '程序实例不再活动。');
    const stored = this.store(active.projectId).get(input.programRunId);
    if (
      active.context.principal.kind === 'agent' &&
      active.context.signal?.aborted &&
      stored.run.backgroundOwner?.state !== 'active'
    )
      stored.run.cancelReason ??= 'parentStopped';
    if (
      (stored.commandInstanceId && stored.commandInstanceId !== input.commandInstanceId) ||
      (stored.hostInstanceId && stored.hostInstanceId !== input.hostInstanceId)
    )
      throw new OperationError('instanceMismatch', '程序观察不属于当前实例。');
    if (input.seq <= (stored.lastEventSeq ?? -1)) return { ack: input.seq };
    stored.commandInstanceId = input.commandInstanceId;
    stored.hostInstanceId = input.hostInstanceId;
    stored.lastEventSeq = input.seq;
    const event = input.event;
    if (event.kind === 'intent' && stored.run.state !== 'queued')
      throw new OperationError('shuttingDown', '程序已取消，不再启动。');
    if (event.kind === 'intent') stored.run.phase = 'starting';
    if (event.kind === 'started') {
      stored.run.state = 'running';
      stored.run.phase = 'executing';
    }
    if (event.kind === 'output') {
      const seq = stored.run.logs?.next ?? 0;
      stored.entries.push({ seq, stream: event.stream, text: event.text });
      let size = stored.entries.reduce((sum, line) => sum + Buffer.byteLength(line.text), 0);
      while (size > 1048576 && stored.entries.length > 1)
        size -= Buffer.byteLength(stored.entries.shift()?.text ?? '');
      stored.run.logs = {
        next: seq + 1,
        truncatedBefore: stored.entries[0]?.seq ?? seq,
        lastLogAt: stamp(),
      };
    }
    if (event.kind === 'exited') {
      stored.run.exit = {
        ...(event.code !== undefined ? { code: event.code } : {}),
        ...(event.signal !== undefined ? { signal: event.signal } : {}),
        ...(event.reason ? { reason: event.reason } : {}),
      };
      if (event.reason === 'timeout') {
        stored.run.cancelReason = 'timeout';
        stored.run.state = 'cancelling';
        stored.run.phase = 'stopping';
      }
    }
    if (event.kind === 'stopped') {
      this.unconfirmed.delete(input.programRunId);
      stored.run.stop = 'confirmed';
      stored.run.state = stored.run.cancelReason
        ? stored.run.cancelReason === 'timeout'
          ? 'failed'
          : 'cancelled'
        : stored.run.exit?.code === 0
          ? 'completed'
          : 'failed';
    }
    if (event.kind === 'unknown') {
      stored.run.error = event.error;
      if (stored.run.stop !== 'confirmed') {
        this.unconfirmed.set(input.programRunId, active.projectId);
        stored.run.state = 'unknown';
        stored.run.stop = 'unknown';
      } else if (!stored.run.cancelReason) stored.run.state = 'failed';
    }
    this.save(stored, event.kind !== 'output');
    if (event.kind === 'stopped' || event.kind === 'unknown') {
      await this.inspect(stored, active.context);
      // A stopped event precedes a possible command failure; leave its historical receipt readable.
      if (event.kind === 'unknown' || stored.run.exit) this.finish(input.programRunId);
    }
    return { ack: input.seq };
  }
  private finish(id: string) {
    const active = this.active.get(id);
    active?.finish();
    this.active.delete(id);
  }
  observationFailed(id: string, error: unknown) {
    const active = this.active.get(id);
    if (!active) return;
    this.unconfirmed.set(id, active.projectId);
    this.observationErrors.set(id, failure(error));
    this.ports.changed(active.projectId, id);
    this.finish(id);
  }
  private async inspect(stored: StoredProgramRun, context: CallContext) {
    const outputs = stored.run.outputs ?? [];
    for (const output of outputs) {
      output.observedAt = stamp();
      try {
        const current = output.resource
          ? await this.ports.describe(output.resource, context)
          : await this.ports.output(stored.run.projectId, output.declaredPath, context);
        if (!output.resource) output.resource = { ref: current.ref, basis: current.basis };
        output.presence = 'present';
        output.completeness = stored.run.state === 'completed' ? 'unassessed' : 'incomplete';
        delete output.error;
      } catch (error) {
        output.error = failure(error);
        output.presence =
          output.error.code === 'contentChanged'
            ? 'changed'
            : output.error.code === 'notFound'
              ? 'missing'
              : output.error.code === 'permissionDenied'
                ? 'unreadable'
                : 'unknown';
      }
    }
    stored.run.outputAssessment = !outputs.length
      ? 'unassessed'
      : outputs.some((output) => output.presence !== 'present') || stored.run.state !== 'completed'
        ? 'partial'
        : 'observed';
    this.save(stored, true);
  }
  async run(input: ProgramsInputs['programs.run'], context: CallContext) {
    await this.ports.check(input.projectId, context);
    const stored =
      'programRunId' in input
        ? this.store(input.projectId).get(input.programRunId)
        : this.store(input.projectId).findOperation(input.operationId, context.principal);
    if (!stored) throw new OperationError('notFound', '没有找到该运行。');
    return this.view(stored.run);
  }
  private view(run: ProgramRun): ProgramRun {
    const receipt = this.handoffReceipts.get(run.programRunId);
    const error = this.observationErrors.get(run.programRunId);
    return {
      ...run,
      ...(receipt ? { backgroundOwner: receipt } : {}),
      ...(error ? { state: 'unknown' as const, stop: 'unknown' as const, error } : {}),
    };
  }
  async list(input: ProgramsInputs['programs.runs'], context: CallContext) {
    await this.ports.check(input.projectId, context);
    const page = this.store(input.projectId).list(input.before, input.limit);
    return {
      ...page,
      runs: page.runs.map((run) => this.view(run)),
    };
  }
  async logs(
    input: ProgramsInputs['programs.logs'],
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.logs']> {
    await this.ports.check(input.projectId, context);
    const stored = this.store(input.projectId).get(input.programRunId);
    const entries = [];
    let bytes = 0;
    for (const item of stored.entries) {
      if (item.seq < (input.after ?? 0)) continue;
      const size = Buffer.byteLength(item.text);
      if (!entries.length && size > (input.limitBytes ?? 65536))
        throw new OperationError(
          'tooLarge',
          '单片日志超过请求容量，请增大limitBytes后按原游标读取。',
        );
      if (bytes + size > (input.limitBytes ?? 65536)) break;
      entries.push(item);
      bytes += size;
    }
    return {
      ...(stored.run.logs ?? { next: 0, truncatedBefore: 0 }),
      entries,
      next: entries.length ? (entries.at(-1)?.seq ?? 0) + 1 : (input.after ?? 0),
    };
  }
  cancel(input: ProgramsInputs['programs.cancel'], context: CallContext) {
    return this.serial(input.programRunId, () => this.cancelRun(input, context));
  }
  private async cancelRun(input: ProgramsInputs['programs.cancel'], context: CallContext) {
    await this.ports.check(input.projectId, context, true);
    const stored = this.store(input.projectId).get(input.programRunId);
    if (terminal.has(stored.run.state) || stored.run.state === 'unknown')
      return reference(stored.run);
    stored.run.state = 'cancelling';
    stored.run.phase = 'stopping';
    stored.run.cancelReason = 'user';
    this.save(stored, true);
    if (stored.commandInstanceId)
      await this.ports.cancel(
        input.projectId,
        input.programRunId,
        stored.commandInstanceId,
        context,
      );
    else if (!this.active.has(input.programRunId)) {
      stored.run.state = 'cancelled';
      stored.run.stop = 'confirmed';
      this.save(stored, true);
      this.finish(input.programRunId);
    }
    return reference(stored.run);
  }
  handoff(input: { projectId: string; programRunId: string }, context: CallContext) {
    return this.serial(input.programRunId, () => this.handoffRun(input, context));
  }
  private async handoffRun(
    input: { projectId: string; programRunId: string },
    context: CallContext,
  ) {
    await this.ports.check(input.projectId, context, true);
    if (context.principal.kind !== 'human' || context.role !== 'product' || context.workDomain)
      throw new OperationError('permissionDenied', '后台移交需要人工明确操作。');
    const stored = this.store(input.projectId).get(input.programRunId);
    const active = this.active.get(input.programRunId);
    if (!active || stored.run.state !== 'running')
      throw new OperationError('unavailable', '当前运行不能移交后台。');
    if (this.view(stored.run).backgroundOwner?.state === 'active') return reference(stored.run);
    if (!stored.run.origin) throw new OperationError('invalidRequest', '人工程序无需移交。');
    const commit = this.ports.prepareHandoff(input.programRunId, context);
    stored.run.backgroundOwner = {
      kind: 'human',
      id: context.principal.id,
      at: stamp(),
      state: 'authorized',
    };
    this.save(stored, true);
    try {
      commit();
    } catch (error) {
      stored.run.backgroundOwner.state = 'failed';
      stored.run.backgroundOwner.error = failure(error);
      try {
        this.save(stored, true);
      } catch {
        this.handoffReceipts.set(input.programRunId, { ...stored.run.backgroundOwner });
      }
      throw error;
    }
    active.context = context;
    stored.run.backgroundOwner.state = 'active';
    if (stored.run.request) stored.run.request.lifetime = 'background';
    try {
      this.save(stored, true);
    } catch {
      this.handoffReceipts.set(input.programRunId, {
        ...stored.run.backgroundOwner,
        error: {
          code: 'outcomeUnknown',
          message: '授权已持久保存且宿主已接管；完成收据未保存，重启后须核查。',
        },
      });
      throw new OperationError('outcomeUnknown', '授权已保存并已接管，但完成收据尚未保存。');
    }
    return reference(stored.run);
  }
  async settleExecution(context: CallContext) {
    const owned = [...this.active.entries()].filter(
      ([, item]) =>
        item.context.instanceId === context.instanceId &&
        item.context.runId === context.runId &&
        item.context.sessionId === context.sessionId,
    );
    for (const [id, item] of owned) {
      await this.serial(id, async () => {
        const current = this.store(item.projectId).get(id);
        if (
          this.view(current.run).backgroundOwner?.state === 'active' ||
          terminal.has(current.run.state)
        )
          return;
        current.run.cancelReason = 'parentStopped';
        current.run.state = 'cancelling';
        current.run.phase = 'stopping';
        this.save(current, true);
        const { signal: _signal, ...source } = context;
        if (current.commandInstanceId)
          await this.ports.cancel(item.projectId, id, current.commandInstanceId, source);
      });
    }
    const stopping = owned.filter(
      ([, item]) =>
        item.context.instanceId === context.instanceId &&
        item.context.runId === context.runId &&
        item.context.sessionId === context.sessionId,
    );
    await Promise.all(stopping.map(([, item]) => item.done));
    for (const [id, item] of stopping)
      if (this.store(item.projectId).get(id).run.stop === 'unknown')
        throw new OperationError('outcomeUnknown', '所属程序停止尚未确认。');
    if (context.projectId && context.projectId !== 'application') {
      const unresolved = this.store(context.projectId)
        .unfinished()
        .some(
          (item) =>
            this.view(item.run).backgroundOwner?.state !== 'active' &&
            item.run.origin?.harnessRunId === context.runId &&
            item.run.origin?.instanceId === context.instanceId,
        );
      if (unresolved) throw new OperationError('outcomeUnknown', '所属程序仍有持久的未确认归属。');
    }
  }
  async reconcile(input: ProgramsInputs['programs.reconcile'], context: CallContext) {
    await this.ports.check(input.projectId, context);
    return this.serial(input.programRunId, async () => {
      const stored = this.store(input.projectId).get(input.programRunId);
      await this.inspect(stored, context);
      return reference(stored.run);
    });
  }
  async wait(projectId: string, id: string, context: CallContext) {
    const active = this.active.get(id);
    if (active) await active.done;
    return this.run({ projectId, programRunId: id }, context);
  }
  async releaseProject(projectId: string) {
    if ([...this.unconfirmed.values()].includes(projectId))
      throw new OperationError('outcomeUnknown', '程序观察或停止收据未确认，项目仍在使用。');
    for (const stored of this.store(projectId).unfinished())
      if (stored.run.state === 'unknown')
        throw new OperationError('outcomeUnknown', '程序停止未确认，项目仍在使用。');
    const active = [...this.active.entries()].filter(([, value]) => value.projectId === projectId);
    await Promise.all(
      active.map(([id, value]) => this.cancel({ projectId, programRunId: id }, value.context)),
    );
    await Promise.all(active.map(([, value]) => value.done));
    if (
      this.store(projectId)
        .unfinished()
        .some((item) => item.run.state === 'unknown')
    )
      throw new OperationError('outcomeUnknown', '程序停止未确认。');
    this.records.get(projectId)?.close();
    this.records.delete(projectId);
  }
  assertIdle(projectId: string) {
    if (
      [...this.unconfirmed.values()].includes(projectId) ||
      this.store(projectId).unfinished().length
    )
      throw new OperationError('outcomeUnknown', '项目仍有活动或停止未确认的程序，不能移出登记。');
  }
  async close() {
    this.closing = true;
    const active = [...this.active.entries()];
    await Promise.all(
      active.map(([id, value]) =>
        this.cancel({ projectId: value.projectId, programRunId: id }, value.context).catch(
          () => {},
        ),
      ),
    );
    await Promise.all(active.map(([, value]) => value.done));
    if (this.unconfirmed.size)
      throw new OperationError(
        'outcomeUnknown',
        '本次宿主仍有停止或观察收据未确认的程序，不能报告收尾完成。',
      );
    for (const timer of this.notifications.values()) clearTimeout(timer);
    for (const record of this.records.values()) record.close();
    this.records.clear();
  }
}
