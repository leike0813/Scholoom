import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { compileContract, limits, OperationError } from '@scholoom/protocol/core';
import {
  type ReportManagerCapture,
  type ReportManagerObservation,
  type ReportManagerStart,
  type ReportManagerStop,
  reportManagerOperations,
} from '@scholoom/protocol/isolation';

const execute = promisify(execFile);
const binary = fileURLToPath(new URL('./report-system', import.meta.url));
const valid = compileContract(reportManagerOperations['reportManager.stop']).params;
const capture = compileContract(reportManagerOperations['reportManager.capture']);
const scopeProperties =
  reportManagerOperations['reportManager.stop'].params.properties.scope.properties;
const recovery = compileContract({
  params: reportManagerOperations['reportManager.start'].params,
  result: {
    type: 'object',
    properties: {
      bootId: scopeProperties.bootId,
      dev: scopeProperties.dev,
      ino: scopeProperties.ino,
    },
    required: ['bootId', 'dev', 'ino'],
    additionalProperties: false,
  } as const,
});
export type SystemReportParent = Pick<ReportManagerStop['scope'], 'bootId' | 'dev' | 'ino'>;
export function validSystemReportParent(value: unknown): value is SystemReportParent {
  return recovery.result(value) === true;
}

async function run(args: string[]): Promise<string> {
  if (process.platform !== 'linux' || process.arch !== 'x64' || process.geteuid?.() !== 0)
    throw new OperationError('unavailable', '固定系统管理门未在受保护身份中运行。');
  try {
    const result = await execute(binary, args, {
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
      maxBuffer: 4096,
      timeout: 35_000,
    });
    return result.stdout;
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const diagnostic =
      typeof stderr === 'string' ? /^report-system:([a-z-]{1,40}):(\d+)\n$/.exec(stderr) : null;
    throw new OperationError(
      args[0] === '--check' ? 'unavailable' : 'outcomeUnknown',
      diagnostic
        ? `系统管理接口或原执行范围尚未确认：stage=${diagnostic[1]}, errno=${diagnostic[2]}。`
        : '系统管理接口或原执行范围尚未确认。',
    );
  }
}

export async function checkSystemReportStop(): Promise<void> {
  if ((await run(['--check'])) !== 'available\n')
    throw new OperationError('unavailable', '系统管理接口未确认可用。');
}

/** Fixed-instance OS observations; the caller must separately verify its policy and gate objects. */
export async function captureSystemReportScope(
  input: ReportManagerCapture,
): Promise<ReportManagerObservation> {
  if (!capture.params(input)) throw new OperationError('invalidRequest', '系统采证身份不完整。');
  const text = await run(['--capture', input.configId, input.storageId]);
  let result: unknown;
  try {
    result = JSON.parse(text);
  } catch {
    throw new OperationError('outcomeUnknown', '系统范围观察格式不可核查。');
  }
  if (!capture.result(result))
    throw new OperationError('outcomeUnknown', '系统范围观察身份或限额不完整。');
  return result as ReportManagerObservation;
}

/** M only: kills the original service invocation and confirms its pinned, retained parent range. */
export async function stopSystemReportScope(input: ReportManagerStop): Promise<void> {
  if (!valid(input)) throw new OperationError('invalidRequest', '系统停止身份不完整。');
  const result = await run([
    '--kill',
    input.configId,
    input.storageId,
    input.scope.bootId,
    input.scope.invocationId,
    input.scope.dev,
    input.scope.ino,
    String(limits.lifecycleMs),
  ]);
  if (result !== 'stopped\n')
    throw new OperationError('outcomeUnknown', '原系统执行范围停止尚未确认。');
}

/** Before starting a service, M persists this newly-created original empty parent. */
export async function captureSystemReportParent(
  input: ReportManagerStart,
): Promise<SystemReportParent> {
  if (!recovery.params(input)) throw new OperationError('invalidRequest', '系统恢复身份不完整。');
  const text = await run(['--parent', input.configId, input.storageId]);
  let result: unknown;
  try {
    result = JSON.parse(text);
  } catch {
    throw new OperationError('outcomeUnknown', '原系统范围尚未确认。');
  }
  if (!recovery.result(result) || (result as SystemReportParent).bootId !== input.inputs.bootId)
    throw new OperationError('outcomeUnknown', '原系统范围观察不完整。');
  return result as SystemReportParent;
}

/** Only M after checking its original fixed unit files against C's durable start descriptor. */
export async function settleSystemReportFixed(
  input: ReportManagerStart,
  parent: SystemReportParent,
  observeOnly = false,
): Promise<void> {
  if (!recovery.params(input) || !recovery.result(parent) || parent.bootId !== input.inputs.bootId)
    throw new OperationError('invalidRequest', '系统恢复身份不完整。');
  const text = await run([
    observeOnly ? '--empty' : '--recover',
    input.configId,
    input.storageId,
    parent.bootId,
    parent.dev,
    parent.ino,
  ]);
  if (text !== 'stopped\n') throw new OperationError('outcomeUnknown', '固定原范围尚未确认排空。');
}
