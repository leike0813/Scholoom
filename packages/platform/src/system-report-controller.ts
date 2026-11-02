import { constants } from 'node:fs';
import { type FileHandle, lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { compileContract, limits, OperationError } from '@scholoom/protocol/core';
import {
  type ReportManagerObservation,
  type ReportManagerStart,
  reportManagerOperations,
  reportManagerScope,
} from '@scholoom/protocol/isolation';
import { type IsolationController, isolationLock } from './isolated-report-controller.js';
import type { IsolationReceipt } from './isolated-report-records.js';
import type { IsolationNative } from './isolated-reports.js';
import { systemReportNames } from './system-report-unit.js';

export type SystemReportRequest = (
  method: keyof typeof reportManagerOperations,
  input: unknown,
) => Promise<unknown>;
type Options = ConstructorParameters<typeof IsolationController>[0];
const unknown = () => new OperationError('outcomeUnknown', '系统报告的原范围或启动事件尚未确认。');
const contracts = Object.fromEntries(
  Object.entries(reportManagerOperations).map(([name, operation]) => [
    name,
    compileContract(operation),
  ]),
);

function descriptor(receipt: IsolationReceipt): ReportManagerStart {
  if (receipt.version !== 2 || !receipt.systemInputs) throw unknown();
  return {
    configId: receipt.configId,
    storageId: receipt.storageId,
    programId: receipt.stage.programId,
    programVersion: receipt.programVersion,
    policyId: receipt.stage.policyId,
    policyVersion: receipt.policyVersion,
    assets: receipt.stage.assets.length,
    inputs: receipt.systemInputs,
  };
}

/** C keeps the original receipts and event descriptors; M receives only fixed OS identities. */
export function systemReportAdapter(
  configId: string,
  request: SystemReportRequest,
): IsolationNative {
  async function call(
    method: keyof typeof reportManagerOperations,
    input: unknown,
  ): Promise<unknown> {
    const contract = contracts[method];
    if (!contract?.params(input) || (input as { configId: string }).configId !== configId)
      throw new OperationError('invalidRequest', '系统报告请求不属于当前配置。');
    const result = await request(method, input);
    if (!contract.result(result)) throw unknown();
    return result;
  }
  const recover = async (r: IsolationReceipt) => {
    await call('reportManager.recover', {
      ...descriptor(r),
      ...(r.scope ? { scope: reportManagerScope(r.scope) } : {}),
    });
  };
  return {
    route: 'linux-system-service-v1',
    support: async () => {
      await call('reportManager.ping', { configId });
    },
    lock: isolationLock,
    controller: (options) => new SystemController(options, call),
    stopRecovered: recover,
    async releaseStopped(r) {
      if (!r.status.stopConfirmed) throw unknown();
      // A restarted C may have a new authenticated M connection, which cannot grant old work.
      await recover(r);
      await call('reportManager.release', {
        ...descriptor(r),
        ...(r.scope ? { scope: reportManagerScope(r.scope) } : {}),
      });
    },
  };
}

class SystemController {
  private stopRequested = false;
  private confirmed = false;
  private exited = false;
  private settling?: Promise<void>;
  private events?: FileHandle;
  constructor(
    private readonly options: Options,
    private readonly call: SystemReportRequest,
  ) {}

  async start(): Promise<void> {
    const o = this.options,
      r = o.receipt;
    if (
      r.version !== 2 ||
      !['linux-x64-system-v1', 'linux-x64-node-v1'].includes(o.policy.profile) ||
      !r.systemInputs ||
      (o.policy.profile === 'linux-x64-node-v1') !== !!r.systemInputs.node
    )
      throw unknown();
    this.events = await open(join(o.path, 'events'), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      await this.checkEvents();
      r.scopeIntent = true;
      await o.persist();
      const actual = (await this.call(
        'reportManager.start',
        descriptor(r),
      )) as ReportManagerObservation;
      r.scope = { ...actual.scope, cgroup: systemReportNames(r.configId, r.storageId).cgroup };
      r.system = {
        runtimeUid: actual.runtimeUid,
        runtimeGid: actual.runtimeGid,
        permit: { ...r.systemInputs.permit },
      };
      await o.persist();
      void this.monitor()
        .catch(async (error) => {
          await o.uncertain(error);
          await this.settle(true).catch((failure) => o.uncertain(failure));
        })
        .finally(async () => {
          this.exited = true;
          await this.events?.close();
          delete this.events;
        })
        .catch(() => {});
    } catch (error) {
      this.exited = true;
      await this.events.close();
      delete this.events;
      throw error;
    }
  }
  private async checkEvents(): Promise<void> {
    const r = this.options.receipt;
    if (r.version !== 2 || !r.systemInputs || !this.events) throw unknown();
    const held = await this.events.stat({ bigint: true }),
      current = await lstat(join(this.options.path, 'events'), { bigint: true });
    if (
      !held.isFile() ||
      held.uid !== BigInt(process.getuid?.() ?? -1) ||
      held.nlink !== 1n ||
      (held.mode & 0o777n) !== 0o600n ||
      String(held.dev) !== r.systemInputs.events.dev ||
      String(held.ino) !== r.systemInputs.events.ino ||
      held.dev !== current.dev ||
      held.ino !== current.ino ||
      held.size > 4096n
    )
      throw unknown();
  }
  private async monitor(): Promise<void> {
    const o = this.options,
      r = o.receipt;
    const events = this.events;
    if (r.version !== 2 || !r.systemInputs || !r.scope || !events) throw unknown();
    const gate = {
      configId: r.configId,
      storageId: r.storageId,
      scope: reportManagerScope(r.scope),
      permit: r.systemInputs.permit,
    };
    let armed = false,
      ready = false,
      running = false,
      offset = 0,
      pending = '';
    const buffer = Buffer.alloc(4096),
      decoder = new TextDecoder('utf-8', { fatal: true });
    let deadline = Date.now() + limits.lifecycleMs;
    while (!this.stopRequested) {
      await this.checkEvents();
      const { bytesRead } = await events.read(buffer, 0, buffer.length - offset, offset);
      offset += bytesRead;
      pending += decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
      while (pending.includes('\n') && !this.stopRequested) {
        const at = pending.indexOf('\n'),
          line = pending.slice(0, at);
        pending = pending.slice(at + 1);
        const event = JSON.parse(line) as {
          event?: string;
          pid?: number;
          failed?: boolean;
          gateReleased?: boolean;
        };
        if (event.event === 'armed' && !armed && event.pid === r.scope.controllerPid) {
          armed = true;
          if (!this.stopRequested) await this.call('reportManager.arm', gate);
        } else if (event.event === 'ready' && armed && !ready) {
          ready = true;
          await o.authorize();
          if (this.stopRequested) return;
          r.launchIntent = true;
          await o.persist();
          await o.authorize();
          if (!this.stopRequested) await this.call('reportManager.permit', gate);
        } else if (event.event === 'running' && ready && !running && r.launchIntent) {
          running = true;
          r.status.gateReleased = true;
          await o.running();
          deadline = Date.now() + o.policy.runtimeMs + limits.lifecycleMs;
        } else if (
          event.event === 'stopped' &&
          typeof event.failed === 'boolean' &&
          event.gateReleased === running
        ) {
          if (pending || offset < (await events.stat()).size) throw unknown();
          await this.settle(event.failed);
          return;
        } else throw unknown();
      }
      if (Date.now() >= deadline || offset === buffer.length) throw unknown();
      await pause(20);
    }
  }
  private settle(failed: boolean): Promise<void> {
    this.stopRequested = true;
    this.settling ??= (async () => {
      const r = this.options.receipt;
      if (r.scope)
        await this.call('reportManager.stop', {
          configId: r.configId,
          storageId: r.storageId,
          scope: reportManagerScope(r.scope),
        });
      else await this.call('reportManager.recover', descriptor(r));
      await this.options.stopped(failed);
      this.confirmed = true;
    })();
    return this.settling;
  }
  async stop(): Promise<boolean> {
    try {
      await this.settle(false);
    } catch (error) {
      await this.options.uncertain(error);
    }
    return this.confirmed;
  }
  get hasExited(): boolean {
    return this.exited;
  }
}
