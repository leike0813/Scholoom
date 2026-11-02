import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

assert(process.platform === 'linux' && process.arch === 'x64' && process.getuid() > 0);
const base = join(homedir(), '.cache', 'scholoom-report-node-runtime');
mkdirSync(base, { recursive: true, mode: 0o700 });
const evidence = mkdtempSync(join(base, 'run-'));
const node = '/opt/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f/node';
const unit = `scholoom-node-runtime-${randomUUID()}.service`;
function run(file, args, options = {}) {
  return spawnSync(file, args, {
    env: {
      PATH: '/usr/bin:/bin',
      HOME: homedir(),
      TMPDIR: evidence,
      LANG: 'C',
      ...Object.fromEntries(
        ['DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR']
          .filter((name) => typeof process.env[name] === 'string')
          .map((name) => [name, process.env[name]]),
      ),
    },
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 65536,
    ...options,
  });
}
function successful(file, args, name) {
  const result = run(file, args);
  writeFileSync(join(evidence, name), JSON.stringify({ file, args, ...result }, null, 2));
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  return result;
}
successful(
  '/usr/bin/cc',
  [
    '-Wall',
    '-Wextra',
    '-Werror',
    '-O2',
    fileURLToPath(new URL('./policy.c', import.meta.url)),
    '-o',
    join(evidence, 'policy'),
  ],
  'compile.json',
);
const policy = join(evidence, 'policy.bpf');
const fd = openSync(policy, 'wx', 0o600);
try {
  const generated = run(join(evidence, 'policy'), [], {
    encoding: null,
    stdio: ['ignore', fd, 'pipe'],
  });
  assert.ifError(generated.error);
  assert.equal(generated.status, 0);
} finally {
  closeSync(fd);
}
successful(
  process.execPath,
  [fileURLToPath(new URL('./build.mjs', import.meta.url)), evidence],
  'build.json',
);
const approved = join(evidence, 'approved.txt');
writeFileSync(approved, 'approved report bytes\n', { flag: 'wx', mode: 0o400 });

const files = [
  [node, '/runtime/node'],
  ['/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2', '/lib64/ld-linux-x86-64.so.2'],
  ...[
    'libdl.so.2',
    'libstdc++.so.6',
    'libm.so.6',
    'libgcc_s.so.1',
    'libpthread.so.0',
    'libc.so.6',
  ].map((name) => [`/usr/lib/x86_64-linux-gnu/${name}`, `/lib/x86_64-linux-gnu/${name}`]),
];
const views = files.map(([source, target]) => {
  const path = realpathSync(source),
    info = lstatSync(path);
  assert(info.isFile() && info.uid === 0 && !(info.mode & 0o022));
  return [path, target];
});
writeFileSync(join(evidence, 'file-view.json'), JSON.stringify(views, null, 2));
const bwrap = [
  '/usr/bin/bwrap',
  '--unshare-all',
  '--new-session',
  '--die-with-parent',
  '--cap-drop',
  'ALL',
  '--clearenv',
  '--dir',
  '/runtime',
  '--dir',
  '/lib64',
  '--dir',
  '/lib/x86_64-linux-gnu',
  '--dir',
  '/resources',
  ...views.flatMap(([source, target]) => ['--ro-bind', source, target]),
  '--ro-bind',
  join(evidence, 'bootstrap.cjs'),
  '/runtime/bootstrap.cjs',
  '--ro-bind',
  approved,
  '/resources/approved.txt',
  '--remount-ro',
  '/',
  '--seccomp',
  '3',
  '--chdir',
  '/',
  '--',
  '/runtime/node',
  '--max-old-space-size=64',
  '/runtime/bootstrap.cjs',
];
const args = [
  '--user',
  '--wait',
  '--pipe',
  '--quiet',
  `--unit=${unit}`,
  '-p',
  'CPUQuota=20%',
  '-p',
  'MemoryMax=536870912',
  '-p',
  'MemorySwapMax=0',
  '-p',
  'TasksMax=32',
  '-p',
  'RuntimeMaxSec=10s',
  '-p',
  'TimeoutStopSec=3s',
  '-p',
  'UnsetEnvironment=LD_PRELOAD LD_AUDIT LD_LIBRARY_PATH BASH_ENV ENV SHELLOPTS BASHOPTS NODE_OPTIONS',
  '/bin/bash',
  '-o',
  'pipefail',
  '-c',
  'set -e; exec 3<"$1"; IFS=: read -r hierarchy controllers group < /proc/self/cgroup; test "$hierarchy" = 0; test -z "$controllers"; printf "0::%s\\n" "$group" >"$3"; /usr/bin/cat "/sys/fs/cgroup$group/cpu.max" "/sys/fs/cgroup$group/memory.max" "/sys/fs/cgroup$group/memory.swap.max" "/sys/fs/cgroup$group/pids.max" >"$2"; shift 3; /usr/bin/cat | "$@" 2>&1 | /usr/bin/cat',
  'report-node-policy',
  policy,
  join(evidence, 'live-limits.txt'),
  join(evidence, 'live-cgroup.txt'),
  ...bwrap,
];
const result = run('/usr/bin/systemd-run', args, { input: '{"request":"fixed-node-runtime"}\n' });
writeFileSync(join(evidence, 'execution.json'), JSON.stringify({ args, ...result }, null, 2));
const state = run('/usr/bin/systemctl', [
  '--user',
  'show',
  unit,
  '--property=Id,ActiveState,SubState,Result,ControlGroup,CPUQuotaPerSecUSec,MemoryMax,MemorySwapMax,TasksMax',
]);
writeFileSync(join(evidence, 'unit-after.json'), JSON.stringify(state, null, 2));
console.log(`Evidence: ${evidence}`);
assert.ifError(result.error);
assert.equal(result.signal, null);
assert.equal(result.status, 0, result.stderr);
assert.deepEqual(readFileSync(join(evidence, 'live-limits.txt'), 'utf8').trim().split('\n'), [
  '20000 100000',
  '536870912',
  '0',
  '32',
]);
const output = JSON.parse(result.stdout.trim());
assert.equal(output.accepted, true);
assert.equal(readFileSync(approved, 'utf8'), 'approved report bytes\n');
console.log(
  'Passed isolated fixed Node/WorkerDOM calibration; not installed C/M, arbitrary reports, stop receipts or UI.',
);
