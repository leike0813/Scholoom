import assert from 'node:assert/strict';

export const reportNotices = [
  'LICENSE',
  'MODIFICATIONS.md',
  'upstream-manifest.json',
  'local.patch',
  'html-parser-LICENSE',
  'css-tree-LICENSE',
  'mdn-data-LICENSE',
  'source-map-js-LICENSE',
];

export function reportRegistration(plan) {
  assert(plan.runtime === undefined || plan.runtime === 'node');
  assert(plan.program === undefined || plan.program === 'scholoom-interactive-report');
  const node = plan.runtime === 'node',
    interactive = plan.program === 'scholoom-interactive-report';
  assert(!interactive || node);
  const programId = interactive
    ? 'scholoom-interactive-report'
    : node
      ? 'fixed-node-t1'
      : 'fixed-native-t1';
  return {
    programId,
    programVersion: '1',
    programArgs: node ? [] : ['normal'],
    ...(node ? { runtimeRoot: layout(plan).programs } : {}),
    policy: {
      id: programId,
      version: '1',
      profile: node ? 'linux-x64-node-v1' : 'linux-x64-system-v1',
      cpuPercent: 20,
      memoryBytes: node ? 536870912 : 67108864,
      swapBytes: 0,
      tasks: node ? 32 : 16,
      outputBytes: 65536,
      runtimeMs: interactive ? 8 * 60 * 60 * 1000 : 20000,
      stopGraceMs: 100,
    },
  };
}

export function layout(plan) {
  assert.match(plan.installId, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  for (const key of ['kernelUid', 'kernelGid'])
    assert(Number.isSafeInteger(plan[key]) && plan[key] > 0 && plan[key] < 0xffffffff);
  const name = `scholoom-report-${plan.installId}`;
  return {
    name,
    user: `srpt${plan.installId.replaceAll('-', '').slice(0, 24)}`,
    programs: `/opt/${name}`,
    data: `/var/lib/${name}`,
    runtime: `/run/${name}`,
    controlSocket: `${name}-control.socket`,
    managerSocket: `${name}-manager.socket`,
    controlService: `${name}-control@.service`,
    managerService: `${name}-manager@.service`,
  };
}

export function unitTexts(plan, controlUid, controlGid) {
  const p = layout(plan);
  assert(Number.isSafeInteger(controlUid) && controlUid > 0 && controlUid !== plan.kernelUid);
  assert(Number.isSafeInteger(controlGid) && controlGid > 0);
  const common =
    '[Unit]\nDescription=Scholoom fixed report control\n[Service]\nType=exec\nStandardInput=socket\nStandardOutput=socket\nStandardError=journal\nRestart=no\nNoNewPrivileges=yes\nProtectSystem=strict\nProtectHome=yes\nPrivateNetwork=yes\nRestrictAddressFamilies=AF_UNIX\nUMask=0077\nLimitCORE=0\nTimeoutStopSec=40s\n';
  const entry = `${p.programs}/node ${p.programs}/service.mjs`,
    config = `${p.programs}/installed.json`;
  const socket = (target, group) =>
    `[Unit]\nDescription=Scholoom authenticated report socket\n[Socket]\nListenStream=${p.runtime}/${target}.sock\nDirectoryMode=0755\nAccept=yes\nSocketUser=root\nSocketGroup=${group}\nSocketMode=0660\nMaxConnections=4\nRemoveOnStop=yes\n`;
  return new Map([
    [p.controlSocket, socket('control', plan.kernelGid)],
    [p.managerSocket, socket('manager', controlGid)],
    [
      p.controlService,
      `${common}ProtectControlGroups=strict\nUser=${controlUid}\nGroup=${controlGid}\nCapabilityBoundingSet=\nAmbientCapabilities=\nReadWritePaths=${p.data}/records\nExecStart=${entry} --control ${config}\n`,
    ],
    [
      p.managerService,
      `${common}ProtectControlGroups=yes\nUser=root\nGroup=root\nCapabilityBoundingSet=CAP_DAC_OVERRIDE CAP_DAC_READ_SEARCH\nAmbientCapabilities=\nReadWritePaths=/run/systemd/system ${p.data}/records ${p.programs}/manager.lock\nExecStart=${entry} --manager ${config}\n`,
    ],
  ]);
}
