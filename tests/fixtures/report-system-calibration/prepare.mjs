import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.notEqual(process.getuid(), 0);
assert.notEqual(process.geteuid(), 0);
assert.ok(process.env.TMPDIR && isAbsolute(process.env.TMPDIR));
const root = resolve(process.argv[2]);
const source = dirname(fileURLToPath(import.meta.url));
const calibrationId = randomUUID();
const name = `scholoom-report-t10-${calibrationId}`;
const runtime = `/run/${name}`;
const probeUnit = `${name}-probe.service`;
const observerUnit = `${name}-observer.service`;
const offlineRoot = join(root, 'offline-root');
const runtimeRoot = `${offlineRoot}${runtime}`;
const objects = join(runtimeRoot, 'c-owned');
const binary = join(runtimeRoot, 'bin/probe');
const units = join(offlineRoot, 'etc/systemd/system');
mkdirSync(root);
for (const path of [objects, dirname(binary), units])
  mkdirSync(path, { recursive: true, mode: path === objects ? 0o700 : 0o755 });
const commands = [];
function run(cmd, args) {
  commands.push({ cmd, args });
  execFileSync(cmd, args, { stdio: 'inherit' });
}
writeFileSync(
  join(root, 'calibration-config.h'),
  `#define TARGET_UNIT ${JSON.stringify(probeUnit)}\n#define TARGET_CGROUP ${JSON.stringify(`/sys/fs/cgroup/system.slice/${probeUnit}`)}\n`,
);
run(process.env.CC ?? 'cc', [
  '-std=c11',
  '-O2',
  '-Wall',
  '-Wextra',
  '-Werror',
  '-static',
  '-fno-pie',
  '-no-pie',
  '-I',
  root,
  join(source, 'probe.c'),
  '-o',
  binary,
]);
writeFileSync(join(objects, 'approved.txt'), 'approved report bytes\n', {
  flag: 'wx',
  mode: 0o400,
});
writeFileSync(join(objects, 'probe.log'), '', { flag: 'wx', mode: 0o600 });
writeFileSync(join(objects, 'observer.log'), '', { flag: 'wx', mode: 0o600 });
run('mkfifo', ['-m', '600', join(objects, 'permit.fifo')]);
const roles = ['permit.fifo', 'probe.log', 'approved.txt'];
const contract = Buffer.alloc(104);
contract.write('T10OBJ1', 0, 'ascii');
const precheck = roles.map((name, i) => {
  const s = statSync(join(objects, name), { bigint: true });
  [s.dev, s.ino, s.uid, s.mode & 0o170000n].forEach((value, field) => {
    contract.writeBigUInt64LE(value, 8 + i * 32 + field * 8);
  });
  return {
    role: name,
    dev: String(s.dev),
    ino: String(s.ino),
    uid: Number(s.uid),
    type: Number(s.mode & 0o170000n),
  };
});
writeFileSync(join(objects, 'expected.bin'), contract, { flag: 'wx', mode: 0o400 });
const common = `Type=exec
Slice=system.slice
ExecStart=${runtime}/bin/probe
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateNetwork=yes
Delegate=no
Restart=no
RuntimeMaxSec=5s
TimeoutStartSec=5s
TimeoutStopSec=5s
KillMode=control-group
SendSIGKILL=yes
LimitFSIZE=65536
LimitCORE=0
StandardError=inherit
`;
const header =
  '# REVIEW ONLY: offline package, not approved for installation or execution\n[Unit]\nDescription=Fixed T1.0 calibration only\nDefaultDependencies=no\n[Service]\n';
writeFileSync(
  join(units, probeUnit),
  header +
    common +
    `DynamicUser=yes
ProtectControlGroups=strict
StandardInput=file:${runtime}/c-owned/permit.fifo
StandardOutput=file:${runtime}/c-owned/probe.log
OpenFile=${runtime}/c-owned/approved.txt:approved:read-only
OpenFile=${runtime}/c-owned/expected.bin:expected:read-only
`,
);
writeFileSync(
  join(units, observerUnit),
  header +
    common.replace(`ExecStart=${runtime}/bin/probe`, `ExecStart=${runtime}/bin/probe --observe`) +
    `User=root
ProtectControlGroups=true
StandardInput=null
StandardOutput=file:${runtime}/c-owned/observer.log
`,
);
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const immutable = [
  join(source, 'probe.c'),
  join(source, 'prepare.mjs'),
  join(source, 'selftest.mjs'),
  binary,
  join(root, 'calibration-config.h'),
  ...[probeUnit, observerUnit].map((n) => join(units, n)),
  join(objects, 'expected.bin'),
  join(objects, 'approved.txt'),
];
const plan = {
  calibrationId,
  runtime,
  probeUnit,
  observerUnit,
  binary,
  objects,
  units,
  offlineRoot,
  creatorSimulationUid: process.getuid(),
  probeActorIsCreatorRequired: false,
  cImplementationAvailable: false,
  mImplementationAvailable: false,
  lsmPolicyAvailable: false,
  precheck,
  futureObjects: [
    { path: runtime, owner: 'root:root', mode: '0755' },
    { path: `${runtime}/bin/probe`, owner: 'root:root', mode: '0555' },
    { path: `${runtime}/c-owned`, owner: 'approved C UID/GID (unresolved)', mode: '0700' },
    ...['approved.txt', 'expected.bin'].map((n) => ({
      path: `${runtime}/c-owned/${n}`,
      owner: 'approved C UID/GID',
      mode: '0400',
    })),
    ...['permit.fifo', 'probe.log', 'observer.log'].map((n) => ({
      path: `${runtime}/c-owned/${n}`,
      owner: 'approved C UID/GID',
      mode: '0600',
    })),
    ...[probeUnit, observerUnit].map((n) => ({
      path: `/run/systemd/system/${n}`,
      owner: 'root:root',
      mode: '0644',
    })),
  ],
  requestedFutureOperations: [
    'approve C identity/bootstrap and regenerate actual precheck; no account creation authorized',
    'stage only the listed root-controlled temporary binary and unit files',
    'one manager reload plus exact named unit invocations only after separate approval',
    'read original unit/InvocationID/boot/cgroup and object facts',
    'stop only positively owned original units and preserve unknown before removing approved paths',
  ],
  commands,
  immutable: immutable.map((path) => ({ path, sha256: hash(path) })),
};
writeFileSync(join(root, 'bundle.json'), `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx' });
console.log(join(root, 'bundle.json'));
