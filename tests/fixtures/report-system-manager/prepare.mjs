import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.notEqual(process.geteuid(), 0, 'Prepare as the ordinary caller, never root');
const source = dirname(fileURLToPath(import.meta.url));
const project = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache', 'scholoom-report-system-manager');
mkdirSync(base, { recursive: true });
const bundle = mkdtempSync(join(base, 'bundle-'));
mkdirSync(join(bundle, 'tmp'));
const env = { ...process.env, TMPDIR: join(bundle, 'tmp') };
const configId = randomUUID();
const storageId = randomUUID();
const runtime = `/run/scholoom-report-check-${configId}`;
const programs = `/var/lib/scholoom-report-check-${configId}`;
const unit = `scholoom-report-${configId}-v1@${storageId}.service`;
const slice = `system-scholoomreport${configId.replaceAll('-', '')}${storageId.replaceAll('-', '')}.slice`;
const captureUnit = `scholoom-report-check-${configId}-capture.service`;
const stopUnit = `scholoom-report-check-${configId}-stop.service`;
const commands = [];
function run(command, args) {
  commands.push({ command, args });
  execFileSync(command, args, { cwd: project, env, stdio: 'inherit', timeout: 30_000 });
}
run(process.execPath, [
  'packages/platform/build-report-system.mjs',
  '/usr',
  join(bundle, 'manager'),
]);
run(process.env.CC ?? 'cc', [
  '-std=c11',
  '-O2',
  '-Wall',
  '-Wextra',
  '-Werror',
  '-static',
  join(source, 'probe.c'),
  '-o',
  join(bundle, 'probe'),
]);
const common = `[Unit]
Description=Scholoom fixed native OS verification only
DefaultDependencies=no
[Service]
Type=exec
Restart=no
Delegate=no
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateNetwork=yes
KillMode=control-group
SendSIGKILL=yes
TimeoutStartSec=5s
TimeoutStopSec=5s
LimitCORE=0
LimitFSIZE=65536
StandardInput=null
StandardError=inherit
`;
const retained = `[Unit]
Description=Scholoom retained native verification range
DefaultDependencies=no
StopWhenUnneeded=no
[Slice]
CPUQuotaPeriodSec=100ms
CPUQuota=20%
MemoryMax=67108864
MemorySwapMax=0
TasksMax=16
`;
const probe = `${common}Slice=${slice}
DynamicUser=yes
ProtectControlGroups=strict
ExitType=cgroup
RuntimeMaxSec=20s
ExecStart=${programs}/probe
StandardOutput=file:${runtime}/probe.log
`;
const capture = `${common}User=root
ProtectControlGroups=true
RuntimeMaxSec=10s
ExecStart=${programs}/manager --capture ${configId} ${storageId}
StandardOutput=file:${runtime}/capture.log
`;
const stop = `${common}User=root
ProtectControlGroups=true
RuntimeMaxSec=35s
ExecStart=${programs}/manager --kill ${configId} ${storageId} @BOOT@ @INVOCATION@ @DEV@ @INO@ 10000
StandardOutput=file:${runtime}/stop.log
`;
for (const [name, text] of [
  ['retained.slice', retained],
  ['probe.service', probe],
  ['capture.service', capture],
  ['stop.service.in', stop],
])
  writeFileSync(join(bundle, name), text, { flag: 'wx' });
const immutable = [
  'manager',
  'probe',
  'retained.slice',
  'probe.service',
  'capture.service',
  'stop.service.in',
];
const plan = {
  configId,
  storageId,
  runtime,
  programs,
  unit,
  slice,
  captureUnit,
  stopUnit,
  callerUid: process.getuid(),
  callerGid: process.getgid(),
  commands,
  immutable: Object.fromEntries(
    immutable.map((name) => [
      name,
      createHash('sha256')
        .update(readFileSync(join(bundle, name)))
        .digest('hex'),
    ]),
  ),
};
writeFileSync(join(bundle, 'bundle.json'), `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
console.log(join(bundle, 'bundle.json'));
