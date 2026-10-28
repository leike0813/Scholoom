import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { limits, OperationError } from '@scholoom/protocol/core';
import {
  type IsolationInputs,
  type IsolationOutputs,
  type IsolationPort,
  type IsolationStageInput,
  type IsolationStatus,
  validateIsolationPut,
  validateIsolationStage,
} from '@scholoom/protocol/isolation';
import { reportLimits } from '@scholoom/protocol/reports';
import type { ProcessAdmission, ProcessReservation } from './admission.js';
import { failure } from './errors.js';
import {
  fileStamp,
  IsolationController,
  type IsolationPolicy,
  isolationFileStamp,
  isolationGate,
  isolationLock,
  isolationSupport,
  stopRecoveredIsolation,
} from './isolated-report-controller.js';
import { type IsolationReceipt, IsolationRecords } from './isolated-report-records.js';

export type { IsolationPolicy } from './isolated-report-controller.js';
export type IsolationProgram = {
  id: string;
  version: string;
  policyId: string;
  image: Uint8Array;
  args: readonly string[];
};
export type IsolatedReportOptions = {
  admission: ProcessAdmission;
  privateRoot: string;
  programs: readonly IsolationProgram[];
  policies: readonly IsolationPolicy[];
  /** Host-bound domain recheck. The provider never infers ref/basis/read/send permission. */
  authorize(instanceId: string): Promise<void>;
  signal?(instanceId: string): AbortSignal | undefined;
};
type Instance = {
  receipt: IsolationReceipt;
  reservation?: ProcessReservation;
  controller?: IsolationController;
  stopped: Promise<void>;
  confirm(): void;
  recovered: boolean;
  timer?: ReturnType<typeof setTimeout>;
  detach?: () => void;
  settling?: Promise<void>;
};
const invalid = () => new OperationError('invalidRequest', '隔离执行请求与当前准备状态不一致。');
const uncertain = () =>
  new OperationError('outcomeUnknown', '隔离范围尚未完整确认停止，保留原占用。');

function staticImage(image: Uint8Array): boolean {
  if (image.length < 64 || image.length > reportLimits.dependencyBytes) return false;
  const b = Buffer.from(image);
  if (
    b.subarray(0, 7).toString('hex') !== '7f454c46020101' ||
    b.readUInt16LE(16) !== 2 ||
    b.readUInt16LE(18) !== 62
  )
    return false;
  const start = Number(b.readBigUInt64LE(32)),
    size = b.readUInt16LE(54),
    count = b.readUInt16LE(56);
  if (
    size !== 56 ||
    count < 1 ||
    count > 128 ||
    !Number.isSafeInteger(start) ||
    start < 64 ||
    start + size * count > b.length
  )
    return false;
  let executable = false;
  for (let n = 0; n < count; n++) {
    const type = b.readUInt32LE(start + n * size);
    if (type === 2 || type === 3) return false;
    if (type === 1 && b.readUInt32LE(start + n * size + 4) & 1) executable = true;
  }
  return executable;
}

/** Independent host-only deep module; there is no UI, model, or global operation registration. */
export class IsolatedReportProvider {
  private readonly records: IsolationRecords;
  private readonly programs = new Map<string, IsolationProgram>();
  private readonly policies = new Map<string, IsolationPolicy>();
  private readonly instances = new Map<string, Instance>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private lock: Awaited<ReturnType<typeof isolationLock>> | undefined;
  private initialized = false;
  private closing = false;
  constructor(private readonly options: IsolatedReportOptions) {
    this.records = new IsolationRecords(options.privateRoot);
    for (const p of options.policies) {
      if (
        this.policies.has(p.id) ||
        !p.id ||
        !p.version ||
        p.profile !== 'linux-x64-static-v1' ||
        ![
          p.cpuPercent,
          p.memoryBytes,
          p.swapBytes,
          p.tasks,
          p.outputBytes,
          p.runtimeMs,
          p.stopGraceMs,
        ].every(Number.isSafeInteger) ||
        p.cpuPercent < 1 ||
        p.cpuPercent > 100 ||
        p.memoryBytes < 1 ||
        p.swapBytes < 0 ||
        p.tasks < 1 ||
        p.outputBytes < 1 ||
        p.runtimeMs < 1 ||
        p.stopGraceMs < 0 ||
        p.stopGraceMs > limits.lifecycleMs
      )
        throw invalid();
      this.policies.set(p.id, Object.freeze({ ...p }));
    }
    for (const p of options.programs) {
      if (
        !p.id ||
        !p.version ||
        this.programs.has(p.id) ||
        p.args.length > 16 ||
        p.args.some((a) => a.length > 512 || a.includes('\0'))
      )
        throw invalid();
      this.programs.set(p.id, {
        ...p,
        image: Uint8Array.from(p.image),
        args: Object.freeze([...p.args]),
      });
    }
  }
  async check(
    input: IsolationInputs['platform.reportIsolation.check'],
  ): Promise<IsolationOutputs['platform.reportIsolation.check']> {
    try {
      this.registration(input.programId, input.policyId);
      await isolationSupport();
      return { available: true };
    } catch (error) {
      return { available: false, reason: failure(error) };
    }
  }
  private registration(programId: string, policyId: string) {
    const program = this.programs.get(programId),
      policy = this.policies.get(policyId);
    if (!program || !policy || program.policyId !== policy.id || !staticImage(program.image))
      throw new OperationError('unavailable', '固定程序、架构或隔离策略未登记为可执行。');
    return { program, policy };
  }
  async initialize(): Promise<void> {
    if (this.initialized || this.lock) throw invalid();
    await isolationSupport();
    await this.records.initialize();
    try {
      this.lock = await isolationLock(this.records.lockPath);
      const receipts = await this.records.load();
      for (const receipt of receipts) {
        const item = this.instance(receipt, true);
        this.instances.set(receipt.stage.instanceId, item);
        if (!receipt.status.stopConfirmed)
          this.options.admission.retainUnknown(receipt.stage.instanceId);
      }
      // Restore every hold before any reconciliation can release capacity.
      this.initialized = true;
      await this.reconcile();
    } catch (error) {
      this.initialized = false;
      await this.lock?.close();
      this.lock = undefined;
      await this.records.close();
      throw error;
    }
  }
  private instance(receipt: IsolationReceipt, recovered: boolean): Instance {
    let confirm = () => {};
    const stopped = new Promise<void>((resolve) => {
      confirm = resolve;
    });
    return { receipt, stopped, confirm, recovered };
  }
  private ready(): void {
    if (!this.initialized || this.closing || !this.lock?.alive())
      throw new OperationError('unavailable', '隔离提供者尚未完成本配置恢复屏障。');
  }
  private serial<T>(id: string, action: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(id) ?? Promise.resolve()).then(action);
    this.queues.set(
      id,
      next.then(
        () => {},
        () => {},
      ),
    );
    return next;
  }
  private item(id: string): Instance {
    const item = this.instances.get(id);
    if (!item) throw new OperationError('notFound', '隔离执行身份不存在。');
    return item;
  }
  private async authorize(id: string): Promise<void> {
    if (!this.lock?.alive()) throw uncertain();
    const signal = this.options.signal?.(id);
    if (signal?.aborted) throw new OperationError('shuttingDown', '隔离执行已取消。');
    try {
      await this.options.authorize(id);
    } catch (error) {
      throw new OperationError(failure(error).code, '领域批准字节的当前授权未确认。');
    }
    if (signal?.aborted) throw new OperationError('shuttingDown', '隔离执行已取消。');
    await this.records.check();
  }
  private projection(item: Instance): IsolationStatus {
    return structuredClone(item.receipt.status);
  }
  private async save(item: Instance): Promise<void> {
    if (!this.lock?.alive()) throw uncertain();
    await this.records.save(item.receipt);
  }
  private async unknown(item: Instance, error: unknown): Promise<void> {
    if (item.receipt.status.stopConfirmed) return;
    item.receipt.status.phase = 'unknown';
    item.receipt.status.failure ??= failure(error);
    clearTimeout(item.timer);
    await this.save(item).catch(() => {}); // Original receipt remains authoritative when saving fails.
  }
  private confirmed(item: Instance): Promise<void> {
    if (item.receipt.status.stopConfirmed) return Promise.resolve();
    if (item.settling) return item.settling;
    const result = this.persistStopped(item);
    item.settling = result;
    void result.catch(() => {
      delete item.settling;
    });
    return result;
  }
  private async persistStopped(item: Instance): Promise<void> {
    const prior = item.receipt.status;
    const status: IsolationStatus = { ...prior, phase: 'stopped', stopConfirmed: true };
    delete status.next;
    try {
      if (!this.lock?.alive()) throw uncertain();
      await this.records.save({ ...item.receipt, status });
      item.receipt.status = status;
    } catch (error) {
      item.receipt.status = {
        ...prior,
        phase: 'unknown',
        stopConfirmed: false,
        failure: failure(error),
      };
      throw error;
    }
    clearTimeout(item.timer);
    item.detach?.();
    if (item.recovered)
      this.options.admission.settleRecovered(item.receipt.stage.instanceId, item.stopped);
    item.confirm();
    item.reservation?.release();
  }
  async stage(input: IsolationStageInput): Promise<IsolationStatus> {
    this.ready();
    if (!validateIsolationStage(input)) throw invalid();
    return this.serial(input.instanceId, async () => {
      await this.authorize(input.instanceId);
      const { program, policy } = this.registration(input.programId, input.policyId);
      const old = this.instances.get(input.instanceId);
      if (old) {
        const prior = old.receipt.stage;
        if (
          prior.programId !== input.programId ||
          prior.policyId !== input.policyId ||
          prior.entryPath !== input.entryPath ||
          prior.assets.length !== input.assets.length ||
          prior.assets.some(
            (a, i) =>
              a.path !== input.assets[i]?.path || a.byteLength !== input.assets[i]?.byteLength,
          )
        )
          throw invalid();
        return this.projection(old);
      }
      const receipt = await this.records.create(input, program.version, policy.version);
      const item = this.instance(receipt, false);
      this.instances.set(input.instanceId, item);
      try {
        item.reservation = this.options.admission.reserve(true, input.instanceId);
        item.reservation.retainUntil(item.stopped);
      } catch (error) {
        receipt.status.failure = failure(error);
        await this.confirmed(item);
        throw error;
      }
      const signal = this.options.signal?.(input.instanceId);
      const abort = () => {
        void this.stop({ instanceId: input.instanceId }).catch(() => {});
      };
      signal?.addEventListener('abort', abort, { once: true });
      item.detach = () => signal?.removeEventListener('abort', abort);
      void item.reservation.ready
        .then(
          () =>
            this.serial(input.instanceId, async () => {
              if (receipt.status.phase !== 'queued') return;
              try {
                await this.authorize(input.instanceId);
                const directory = await this.records.files(receipt);
                for (const [i] of input.assets.entries()) {
                  const f = await open(join(directory, `asset-${i}.bin`), 'wx', 0o600);
                  await f.sync();
                  receipt.stamps[i] = isolationFileStamp(await f.stat({ bigint: true }));
                  await f.close();
                }
                receipt.status.phase = 'preparing';
                this.next(item);
                await this.save(item);
                item.timer = setTimeout(() => {
                  void this.stop({ instanceId: input.instanceId }).catch(() => {});
                }, limits.processWaitMs);
                item.timer.unref();
              } catch (error) {
                receipt.status.failure = failure(error);
                await this.confirmed(item);
              }
            }),
          (error) =>
            this.serial(input.instanceId, async () => {
              if (!receipt.status.stopConfirmed) {
                receipt.status.failure = failure(error);
                await this.confirmed(item);
              }
            }),
        )
        .catch((error) => this.unknown(item, error));
      return this.projection(item);
    });
  }
  private next(item: Instance): void {
    const r = item.receipt,
      index = r.offsets.findIndex((n, i) => n < (r.stage.assets[i]?.byteLength ?? 0));
    if (index < 0) delete r.status.next;
    else
      r.status.next = {
        path: r.stage.assets[index]?.path as string,
        offset: r.offsets[index] as number,
      };
  }
  async put(input: IsolationInputs['platform.reportIsolation.put']): Promise<IsolationStatus> {
    this.ready();
    if (!validateIsolationPut(input) || !input.base64) throw invalid();
    return this.serial(input.instanceId, async () => {
      await this.authorize(input.instanceId);
      const item = this.item(input.instanceId),
        r = item.receipt;
      if (
        r.status.phase !== 'preparing' ||
        r.status.next?.path !== input.path ||
        r.status.next.offset !== input.offset
      )
        throw invalid();
      const index = r.stage.assets.findIndex((a) => a.path === input.path),
        bytes = Buffer.from(input.base64, 'base64');
      if (index < 0 || input.offset + bytes.length > (r.stage.assets[index]?.byteLength ?? 0))
        throw invalid();
      const path = join(await this.records.files(r), `asset-${index}.bin`);
      const file = await open(
        path,
        constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const info = await file.stat({ bigint: true });
        if (isolationFileStamp(info) !== r.stamps[index] || info.size !== BigInt(input.offset))
          throw new OperationError('contentChanged', '字节准备对象已变化。');
        const result = await file.write(bytes, 0, bytes.length, input.offset);
        if (result.bytesWritten !== bytes.length) throw uncertain();
        await file.sync();
        const stamp = isolationFileStamp(await file.stat({ bigint: true }));
        if ((await fileStamp(path)) !== stamp)
          throw new OperationError('contentChanged', '字节准备对象已被替换。');
        r.stamps[index] = stamp;
        r.offsets[index] = input.offset + bytes.length;
        this.next(item);
        await this.save(item);
      } catch (error) {
        await this.unknown(item, error);
        throw error;
      } finally {
        await file.close();
      }
      return this.projection(item);
    });
  }
  async start(input: IsolationInputs['platform.reportIsolation.start']): Promise<IsolationStatus> {
    this.ready();
    return this.serial(input.instanceId, async () => {
      await this.authorize(input.instanceId);
      const item = this.item(input.instanceId),
        r = item.receipt;
      if (r.status.phase !== 'preparing' || r.status.next) throw invalid();
      const { program, policy } = this.registration(r.stage.programId, r.stage.policyId);
      if (program.version !== r.programVersion || policy.version !== r.policyVersion)
        throw new OperationError('unavailable', '登记策略版本已变化，不能重放原执行。');
      clearTimeout(item.timer);
      try {
        const directory = await this.records.files(r);
        for (const [i, a] of r.stage.assets.entries()) {
          const path = join(directory, `asset-${i}.bin`);
          const f = await open(
            path,
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          );
          try {
            const info = await f.stat({ bigint: true });
            if (isolationFileStamp(info) !== r.stamps[i] || info.size !== BigInt(a.byteLength))
              throw new OperationError('contentChanged', '封存输入的物理对象或内容已变化。');
            await f.chmod(0o400);
            await f.sync();
            const stamp = isolationFileStamp(await f.stat({ bigint: true }));
            if ((await fileStamp(path)) !== stamp)
              throw new OperationError('contentChanged', '封存输入已被替换。');
            r.stamps[i] = stamp;
          } finally {
            await f.close();
          }
        }
        const sealed: Record<string, string> = {};
        for (const [name, bytes] of [
          ['program.bin', program.image],
          ['gate.bin', await readFile(isolationGate)],
        ] as const) {
          const f = await open(join(directory, name), 'wx', 0o600);
          try {
            await f.writeFile(bytes);
            await f.chmod(0o400);
            await f.sync();
            sealed[name] = isolationFileStamp(await f.stat({ bigint: true }));
          } finally {
            await f.close();
          }
        }
        r.sealed = { program: sealed['program.bin'] as string, gate: sealed['gate.bin'] as string };
        const d = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
        await d.sync();
        await d.close();
        r.status.phase = 'starting';
        await this.save(item);
        item.controller = new IsolationController({
          receipt: r,
          path: this.records.nativePath(r),
          policy,
          args: program.args,
          persist: () => this.save(item),
          authorize: () => this.authorize(input.instanceId),
          running: async () => {
            if (r.status.phase === 'starting') r.status.phase = 'running';
            await this.save(item);
          },
          stopped: async (failed) => {
            if (failed)
              r.status.failure ??= {
                code: 'unavailable',
                message: '固定程序或隔离启动未成功完成。',
              };
            await this.confirmed(item);
          },
          uncertain: (error) => this.unknown(item, error),
        });
        await item.controller.start();
      } catch (error) {
        if (!r.scopeIntent) {
          r.status.failure = failure(error);
          await this.confirmed(item);
        } else await this.unknown(item, error);
        throw error;
      }
      return this.projection(item);
    });
  }
  async get(input: IsolationInputs['platform.reportIsolation.get']): Promise<IsolationStatus> {
    this.ready();
    return this.projection(this.item(input.instanceId));
  }
  async stop(input: IsolationInputs['platform.reportIsolation.stop']): Promise<IsolationStatus> {
    this.ready();
    return this.serial(input.instanceId, async () => this.stopItem(this.item(input.instanceId)));
  }
  private async stopItem(item: Instance): Promise<IsolationStatus> {
    const r = item.receipt;
    if (r.status.stopConfirmed) return this.projection(item);
    clearTimeout(item.timer);
    r.status.phase = 'stopping';
    try {
      await this.save(item);
    } catch (error) {
      await this.unknown(item, error);
    }
    try {
      if (!r.scopeIntent) await this.confirmed(item);
      else if (item.controller) {
        if (!(await item.controller.stop())) {
          if (!item.controller.hasExited) await this.unknown(item, uncertain());
          else {
            await stopRecoveredIsolation(r);
            await this.confirmed(item);
          }
        }
      } else {
        const { policy, program } = this.registration(r.stage.programId, r.stage.policyId);
        if (policy.version !== r.policyVersion || program.version !== r.programVersion)
          throw uncertain();
        await stopRecoveredIsolation(r);
        await this.confirmed(item);
      }
    } catch (error) {
      await this.unknown(item, error);
    }
    return this.projection(item);
  }
  /** Internal recovery query never launches or replays a target. */
  async reconcile(): Promise<void> {
    for (const item of this.instances.values())
      if (!item.receipt.status.stopConfirmed)
        await this.serial(item.receipt.stage.instanceId, () => this.stopItem(item));
  }
  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    await Promise.all(
      [...this.instances.values()].map((item) =>
        this.serial(item.receipt.stage.instanceId, () => this.stopItem(item)),
      ),
    );
    if ([...this.instances.values()].some((item) => !item.receipt.status.stopConfirmed)) {
      this.closing = false;
      throw uncertain();
    }
    await this.records.close();
    await this.lock?.close();
    this.lock = undefined;
    this.initialized = false;
  }
  /** Trusted host registers this leaf only in its private broker. */
  port(): IsolationPort {
    return {
      'platform.reportIsolation.check': (i) => this.check(i),
      'platform.reportIsolation.stage': (i) => this.stage(i),
      'platform.reportIsolation.put': (i) => this.put(i),
      'platform.reportIsolation.start': (i) => this.start(i),
      'platform.reportIsolation.get': (i) => this.get(i),
      'platform.reportIsolation.stop': (i) => this.stop(i),
    };
  }
}
