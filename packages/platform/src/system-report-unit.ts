import { basename, join } from 'node:path';
import { OperationError } from '@scholoom/protocol/core';
import {
  type ReportManagerStart,
  reportNodeLimits,
  reportNodeTargets,
} from '@scholoom/protocol/isolation';
import type { IsolationPolicy } from './isolated-report-controller.js';

export function systemReportNames(configId: string, storageId: string) {
  const unit = `scholoom-report-${configId}-v1@${storageId}.service`;
  const slice = `system-scholoomreport${configId.replaceAll('-', '')}${storageId.replaceAll('-', '')}.slice`;
  return { unit, slice, cgroup: `/system.slice/${slice}` };
}

export function systemReportUnitTexts(
  input: ReportManagerStart,
  slot: string,
  config: { launcher: string; controlUid: number; policy: IsolationPolicy; runtimeRoot?: string },
) {
  const policy = config.policy;
  const quote = (value: string) => JSON.stringify(value).replaceAll('%', '%%');
  const unitValue = (value: string) => value.replaceAll('%', '%%');
  // OpenFile splits on colons before C-unescaping and does not accept JSON quoting.
  const openFilePath = (value: string) =>
    unitValue(
      value.replace(/[\\:"]/g, (character) => `\\x${character.charCodeAt(0).toString(16)}`),
    );
  const names = systemReportNames(input.configId, input.storageId);
  const slice = `[Unit]\nDescription=Scholoom retained report range\nDefaultDependencies=no\nStopWhenUnneeded=no\n[Slice]\nCPUQuotaPeriodSec=100ms\nCPUQuota=${policy.cpuPercent}%\nMemoryMax=${policy.memoryBytes}\nMemorySwapMax=${policy.swapBytes}\nTasksMax=${policy.tasks}\n`;
  const node = policy.profile === 'linux-x64-node-v1';
  if (node !== !!input.inputs.node || node !== !!config.runtimeRoot)
    throw new OperationError('unavailable', '报告运行时与登记策略不一致。');
  const fileSize = node
    ? Math.max(reportNodeLimits.fileBytes, policy.outputBytes)
    : policy.outputBytes;
  let service = `[Unit]\nDescription=Scholoom fixed report execution\nDefaultDependencies=no\n[Service]\nType=exec\nExitType=cgroup\nSlice=${names.slice}\nDynamicUser=yes\nRestart=no\nDelegate=no\nNoNewPrivileges=yes\nCapabilityBoundingSet=\nAmbientCapabilities=\nProtectSystem=strict\nProtectHome=yes\nProtectControlGroups=strict\nPrivateNetwork=yes\nKillMode=control-group\nSendSIGKILL=yes\nTimeoutStartSec=10s\nTimeoutStopSec=5s\nRuntimeMaxSec=${policy.runtimeMs}ms\nLimitCORE=0\nLimitFSIZE=${fileSize}\nStandardInput=file:${unitValue(join(slot, 'permit'))}\nStandardOutput=append:${unitValue(join(slot, 'stdout'))}\nStandardError=append:${unitValue(join(slot, 'stderr'))}\nExecStart=${quote(config.launcher)} ${input.configId} ${input.storageId} ${config.controlUid} ${quote(input.inputs.manifest)} ${policy.outputBytes} ${policy.stopGraceMs} ${names.unit}${node ? ' --node' : ''}\n`;
  for (const [file, name, mode] of [
    ['manifest.json', 'manifest', 'read-only'],
    ['program.bin', 'program', 'read-only'],
    ['gate.bin', 'gate', 'read-only'],
    ['events', 'events', 'append'],
    ...Array.from({ length: input.assets }, (_, i) => [`asset-${i}.bin`, `asset${i}`, 'read-only']),
  ])
    service += `OpenFile=${openFilePath(join(slot, file as string))}:${name}:${mode}\n`;
  if (config.runtimeRoot) {
    service += `OpenFile=${openFilePath(join(slot, 'data-in'))}:renderInput:read-only\n`;
    service += `OpenFile=${openFilePath(join(slot, 'data-out'))}:renderOutput:append\n`;
    for (const [i, target] of reportNodeTargets.entries())
      service += `OpenFile=${openFilePath(join(config.runtimeRoot, basename(target)))}:runtime${i}:read-only\n`;
  }
  return new Map([
    [names.slice, slice],
    [names.unit, service],
  ]);
}

export const systemUnitProperties =
  'Id,LoadState,ActiveState,SubState,FragmentPath,SourcePath,DropInPaths,Transient,ControlGroup,InvocationID,Job,NeedDaemonReload';
export function systemUnitFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.trim().split('\n')) {
    const at = line.indexOf('=');
    if (at < 1 || Object.hasOwn(fields, line.slice(0, at)))
      throw new OperationError('unavailable', '系统单元观察不完整。');
    fields[line.slice(0, at)] = line.slice(at + 1);
  }
  return fields;
}
export function vacantSystemUnit(
  fields: Record<string, string>,
  name: string,
  slice: string,
): boolean {
  return (
    fields.Id === name &&
    (fields.LoadState === 'not-found' || (name === slice && fields.LoadState === 'loaded')) &&
    Object.entries({
      ActiveState: 'inactive',
      SubState: 'dead',
      FragmentPath: '',
      SourcePath: '',
      DropInPaths: '',
      Transient: 'no',
      ControlGroup: '',
      InvocationID: '',
      Job: '',
      NeedDaemonReload: 'no',
    }).every(([key, value]) => fields[key] === value)
  );
}
