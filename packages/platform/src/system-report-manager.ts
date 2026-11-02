import { compileContract, OperationError } from '@scholoom/protocol/core';
import {
  isolationRecordLimits,
  type ReportManagerCapture,
  type ReportManagerGate,
  type ReportManagerObservation,
  type ReportManagerRecover,
  type ReportManagerRelease,
  type ReportManagerStart,
  type ReportManagerStop,
  reportManagerOperations,
  reportManagerScope,
} from '@scholoom/protocol/isolation';
import {
  captureSystemReportScope,
  checkSystemReportStop,
  stopSystemReportScope,
} from './system-report-stop.js';

export type SystemReportBinding = {
  observation: ReportManagerObservation;
  send(command: 'P' | 'G'): Promise<void>;
  close(): Promise<void>;
};
/** Fixed OS effects only. No records, assets, authorization callback or admission lives in M. */
export type SystemReportManagerHost = {
  start(input: ReportManagerStart, signal: AbortSignal): Promise<SystemReportBinding>;
  verify(input: ReportManagerStart, observation: ReportManagerObservation): Promise<void>;
  stop(input: ReportManagerStop): Promise<void>;
  recover(input: ReportManagerRecover): Promise<void>;
  release(input: ReportManagerRelease): Promise<void>;
};
type Entry = {
  input: ReportManagerStart;
  phase:
    | 'starting'
    | 'started'
    | 'arming'
    | 'armed'
    | 'permitting'
    | 'released'
    | 'stopping'
    | 'releasing';
  abort: AbortController;
  binding?: SystemReportBinding;
  starting?: Promise<SystemReportBinding>;
  recovering?: boolean;
};
const contracts = Object.fromEntries(
  Object.entries(reportManagerOperations).map(([name, operation]) => [
    name,
    compileContract(operation),
  ]),
);
const unknown = () => new OperationError('outcomeUnknown', '原系统门或范围尚未完整确认。');
const unavailable = () => new OperationError('unavailable', '固定系统启动提供者尚未装配。');
const invalid = () => new OperationError('invalidRequest', '系统请求不属于当前连接或原实例。');
const sameScope = (a: ReportManagerStop['scope'], b: ReportManagerStop['scope']) =>
  a.bootId === b.bootId && a.invocationId === b.invocationId && a.dev === b.dev && a.ino === b.ino;
const sameStart = (a: ReportManagerStart, b: ReportManagerStart) =>
  a.configId === b.configId &&
  a.storageId === b.storageId &&
  a.programId === b.programId &&
  a.programVersion === b.programVersion &&
  a.policyId === b.policyId &&
  a.policyVersion === b.policyVersion &&
  a.assets === b.assets &&
  a.inputs.bootId === b.inputs.bootId &&
  a.inputs.manifest === b.inputs.manifest &&
  (['permit', 'events', 'stdout', 'stderr'] as const).every(
    (name) =>
      a.inputs[name].dev === b.inputs[name].dev && a.inputs[name].ino === b.inputs[name].ino,
  );

/** One authenticated C connection. Closing the connection permanently closes its permit producers. */
export class SystemReportManager {
  private readonly entries = new Map<string, Entry>();
  private readonly active = new Set<Promise<unknown>>();
  private closed = false;
  constructor(private readonly options: { configId: string; host?: SystemReportManagerHost }) {}

  request(method: string, raw: unknown): Promise<unknown> {
    const contract = Object.hasOwn(reportManagerOperations, method) ? contracts[method] : undefined;
    if (
      this.closed ||
      !contract?.params(raw) ||
      (raw as { configId: string }).configId !== this.options.configId
    )
      return Promise.reject(invalid());
    const work = this.perform(method, raw).then((result) => {
      if (!contract.result(result)) throw unknown();
      return result;
    });
    this.active.add(work);
    void work.finally(() => this.active.delete(work)).catch(() => {});
    return work;
  }
  private async perform(method: string, raw: unknown): Promise<unknown> {
    if (method === 'reportManager.ping') {
      await checkSystemReportStop();
      return {};
    }
    if (method === 'reportManager.capture')
      return captureSystemReportScope(raw as ReportManagerCapture);
    const host = this.options.host;
    if (method === 'reportManager.stop') {
      const input = raw as ReportManagerStop;
      const entry = this.entries.get(input.storageId);
      if (entry?.phase === 'releasing') throw invalid();
      if (entry) {
        entry.phase = 'stopping';
        entry.abort.abort();
        await entry.binding?.close();
      }
      if (host) await host.stop(input);
      else await stopSystemReportScope(input);
      return { scopeEmpty: true };
    }
    if (!host) throw unavailable();
    if (method === 'reportManager.start') {
      const input = structuredClone(raw as ReportManagerStart);
      if (this.entries.has(input.storageId)) throw invalid();
      if (this.entries.size >= isolationRecordLimits.instances)
        throw new OperationError('resourceLimit', '系统连接的有界实例表已满。');
      const entry: Entry = { input, phase: 'starting', abort: new AbortController() };
      this.entries.set(input.storageId, entry);
      try {
        entry.starting = host.start(input, entry.abort.signal);
        entry.binding = await entry.starting;
        if (entry.phase !== 'starting' || this.closed) throw unknown();
        entry.phase = 'started';
        return entry.binding.observation;
      } catch (error) {
        entry.phase = 'stopping';
        await entry.binding?.close();
        throw error;
      } finally {
        delete entry.starting;
      }
    }
    if (method === 'reportManager.arm' || method === 'reportManager.permit') {
      const input = raw as ReportManagerGate,
        entry = this.entries.get(input.storageId);
      const expected = method === 'reportManager.arm' ? 'started' : 'armed';
      if (
        !entry ||
        entry.phase !== expected ||
        !entry.binding ||
        !sameScope(input.scope, entry.binding.observation.scope) ||
        input.permit.dev !== entry.input.inputs.permit.dev ||
        input.permit.ino !== entry.input.inputs.permit.ino
      )
        throw invalid();
      await host.verify(entry.input, entry.binding.observation);
      if (this.closed || entry.phase !== expected || entry.abort.signal.aborted) throw unknown();
      entry.phase = method === 'reportManager.arm' ? 'arming' : 'permitting';
      try {
        await entry.binding.send(method === 'reportManager.arm' ? 'P' : 'G');
        if (this.closed || entry.abort.signal.aborted) throw unknown();
        entry.phase = method === 'reportManager.arm' ? 'armed' : 'released';
        return method === 'reportManager.arm' ? { armed: true } : { released: true };
      } catch (error) {
        entry.phase = 'stopping';
        entry.abort.abort();
        await entry.binding.close();
        throw error;
      }
    }
    if (method === 'reportManager.recover') {
      const input = raw as ReportManagerRecover;
      let entry = this.entries.get(input.storageId);
      if (
        entry &&
        (entry.phase === 'releasing' ||
          entry.recovering ||
          !sameStart(entry.input, input) ||
          (input.scope &&
            entry.binding &&
            !sameScope(input.scope, entry.binding.observation.scope)))
      )
        throw invalid();
      if (!entry) {
        if (this.entries.size >= isolationRecordLimits.instances)
          throw new OperationError('resourceLimit', '系统连接的有界实例表已满。');
        entry = { input: structuredClone(input), phase: 'stopping', abort: new AbortController() };
        this.entries.set(input.storageId, entry);
      }
      entry.phase = 'stopping';
      entry.abort.abort();
      entry.recovering = true;
      try {
        // A timed-out start RPC may still be completing OS work; abort does not settle that work.
        await entry.starting?.catch(() => {});
        await entry.binding?.close();
        await host.recover(input);
      } finally {
        delete entry.recovering;
      }
      return { scopeEmpty: true };
    }
    if (method === 'reportManager.release') {
      const input = raw as ReportManagerRelease,
        entry = this.entries.get(input.storageId);
      if (
        !entry ||
        entry.recovering ||
        !sameStart(entry.input, input) ||
        entry.phase !== 'stopping' ||
        (input.scope && entry.binding && !sameScope(input.scope, entry.binding.observation.scope))
      )
        throw invalid();
      entry.phase = 'releasing';
      try {
        await host.release(input);
        this.entries.delete(input.storageId);
      } catch (error) {
        entry.phase = 'stopping';
        throw error;
      }
      return {};
    }
    throw invalid();
  }
  async disconnect(): Promise<void> {
    this.closed = true;
    for (const entry of this.entries.values()) {
      entry.phase = 'stopping';
      entry.abort.abort();
      void entry.binding?.close().catch(() => {});
    }
    await Promise.allSettled([...this.active]);
    await Promise.allSettled(
      [...this.entries.values()].map(async (entry) => {
        await entry.binding?.close();
        if (entry.binding)
          await this.options.host?.stop({
            configId: entry.input.configId,
            storageId: entry.input.storageId,
            scope: reportManagerScope(entry.binding.observation.scope),
          });
      }),
    );
  }
}
