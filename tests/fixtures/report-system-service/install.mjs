import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chownSync,
  closeSync,
  constants,
  fchmodSync,
  fchownSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { layout, reportNotices, reportRegistration, unitTexts } from './layout.mjs';

const manifest = resolve(process.argv[2]),
  bundle = dirname(manifest),
  plan = JSON.parse(readFileSync(manifest, 'utf8'));
const p = layout(plan),
  apply = process.argv[3] === '--apply';
const registration = reportRegistration(plan);
const nodeProfile = plan.runtime === 'node';
const interactive = plan.program === 'scholoom-interactive-report';
const runtimeNames = nodeProfile ? plan.runtimeNames : [];
assert(Array.isArray(runtimeNames) && runtimeNames.length === (nodeProfile ? 7 : 0));
assert.equal(new Set(runtimeNames).size, runtimeNames.length);
for (const name of runtimeNames)
  assert(
    typeof name === 'string' &&
      name.length <= 128 &&
      name === basename(name) &&
      name !== '.' &&
      name !== '..' &&
      /^[a-zA-Z0-9_.+-]+$/.test(name),
  );
assert.equal(process.argv.length, apply ? 4 : 3);
const files = [
  'node',
  'service.mjs',
  'acceptance.mjs',
  'program.bin',
  'isolated-report-system',
  'report-system',
  'isolated-report-scope',
  'isolated-report-gate',
  'report-channel',
  ...runtimeNames,
  ...(interactive ? reportNotices.map((name) => `licenses/${name}`) : []),
];
assert.deepEqual(Object.keys(plan.files).sort(), [...files].sort());
const approved = new Map();
for (const name of files) {
  const fd = openSync(join(bundle, name), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    assert(info.isFile() && info.nlink === 1);
    const bytes = readFileSync(fd);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), plan.files[name]);
    approved.set(name, bytes);
  } finally {
    closeSync(fd);
  }
}
console.log(
  JSON.stringify(
    {
      ...p,
      registration,
      account: p.user,
      start: [p.controlSocket, p.managerSocket],
      enable: false,
    },
    null,
    2,
  ),
);
if (!apply) process.exit(0);
assert.equal(process.getuid(), 0);
assert.equal(process.geteuid(), 0);
const env = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', SYSTEMD_PAGER: 'cat' };
let installed = false;
function run(file, args) {
  const result = spawnSync(file, args, {
    env,
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 65536,
  });
  if (installed)
    appendFileSync(
      join(p.programs, 'install-commands.jsonl'),
      `${JSON.stringify({ file, args, ...result, error: result.error?.message })}\n`,
      { mode: 0o600 },
    );
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function absent(path) {
  assert.throws(() => lstatSync(path), { code: 'ENOENT' });
}
function protectedDirectory(path) {
  const info = lstatSync(path);
  assert(info.isDirectory() && info.uid === 0 && !(info.mode & 0o022));
}
for (const path of [
  '/opt',
  '/var',
  '/var/lib',
  '/etc',
  '/etc/systemd',
  '/etc/systemd/system',
  '/run',
  '/run/systemd',
  '/run/systemd/system',
])
  protectedDirectory(path);
for (const path of [p.programs, p.data, p.runtime]) absent(path);
const names = [p.controlSocket, p.managerSocket, p.controlService, p.managerService];
for (const name of names) {
  for (const base of ['/etc/systemd/system', '/run/systemd/system', '/usr/lib/systemd/system']) {
    absent(join(base, name));
    absent(join(base, `${name}.d`));
  }
}
// Account creation fails rather than attaching an existing account to this installation.
assert.equal(spawnSync('/usr/bin/getent', ['passwd', p.user], { env }).status, 2);
assert.equal(spawnSync('/usr/bin/getent', ['group', p.user], { env }).status, 2);
run('/usr/sbin/useradd', [
  '--system',
  '--user-group',
  '--no-create-home',
  '--home-dir',
  '/nonexistent',
  '--shell',
  '/usr/sbin/nologin',
  p.user,
]);
const controlUid = Number(run('/usr/bin/id', ['-u', p.user])),
  controlGid = Number(run('/usr/bin/id', ['-g', p.user]));
assert(
  controlUid > 0 &&
    controlUid !== plan.kernelUid &&
    controlGid > 0 &&
    controlGid !== plan.kernelGid,
);
for (const path of [p.programs, p.data, p.runtime]) mkdirSync(path, { mode: 0o755 });
installed = true;
function write(path, bytes, mode = 0o444) {
  const fd = openSync(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    mode,
  );
  try {
    writeFileSync(fd, bytes);
    fchownSync(fd, 0, 0);
    fchmodSync(fd, mode);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
if (interactive) mkdirSync(join(p.programs, 'licenses'), { mode: 0o755 });
for (const [name, bytes] of approved)
  write(
    join(p.programs, name),
    bytes,
    name.startsWith('licenses/') || name.endsWith('.mjs') ? 0o444 : 0o555,
  );
write(join(p.programs, 'manager.lock'), '', 0o600);
const privateRoot = join(p.data, 'records');
mkdirSync(privateRoot, { mode: 0o700 });
chownSync(privateRoot, controlUid, controlGid);
const config = {
  configId: '',
  controlUid,
  controlGid,
  kernelUid: plan.kernelUid,
  kernelGid: plan.kernelGid,
  privateRoot,
  launcher: join(p.programs, 'isolated-report-system'),
  managerSocket: join(p.runtime, 'manager.sock'),
  ...registration,
};
const seed = join(p.programs, 'provision.json');
write(seed, JSON.stringify(config));
const provision = JSON.parse(
  run('/usr/sbin/runuser', [
    '-u',
    p.user,
    '--',
    join(p.programs, 'node'),
    join(p.programs, 'service.mjs'),
    '--provision',
    seed,
  ]),
);
assert.match(provision.configId, /^[a-f0-9-]{36}$/);
config.configId = provision.configId;
write(join(p.programs, 'installed.json'), JSON.stringify(config));
const units = unitTexts(plan, controlUid, controlGid);
for (const [name, text] of units) write(`/etc/systemd/system/${name}`, text, 0o644);
const directory = openSync('/etc/systemd/system', constants.O_RDONLY | constants.O_DIRECTORY);
try {
  fsyncSync(directory);
} finally {
  closeSync(directory);
}
run('/usr/bin/systemctl', ['--system', 'daemon-reload']);
for (const [name] of units) {
  const actual = run('/usr/bin/systemctl', [
    '--system',
    'show',
    name.replace('@.service', '@preflight.service'),
    '--property=LoadState,FragmentPath,DropInPaths',
  ]);
  const fields = Object.fromEntries(
    actual.split('\n').map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
  );
  assert.equal(fields.LoadState, 'loaded');
  assert.equal(fields.FragmentPath, `/etc/systemd/system/${name}`);
  assert.equal(fields.DropInPaths, '');
}
run('/usr/bin/systemctl', ['--system', 'start', p.managerSocket, p.controlSocket]);
write(
  join(p.programs, 'installation-receipt.json'),
  JSON.stringify({
    ...p,
    controlUid,
    controlGid,
    configId: config.configId,
    kernelUid: plan.kernelUid,
  }),
);
console.log(
  `Installed ${interactive ? 'generic report' : `fixed ${nodeProfile ? 'Node/data' : 'native'} T1`} endpoints. Evidence: ${p.programs}/install-commands.jsonl`,
);
const account = run('/usr/bin/getent', ['passwd', String(plan.kernelUid)]).split(':');
assert.equal(Number(account[2]), plan.kernelUid);
const acceptance = run('/usr/sbin/runuser', [
  '-u',
  account[0],
  '--',
  join(p.programs, 'node'),
  join(p.programs, 'acceptance.mjs'),
  join(p.programs, 'installed.json'),
]);
console.log(acceptance);
write(
  join(p.programs, interactive ? 'bootstrap-passed.json' : 't1-passed.json'),
  JSON.stringify({
    configId: config.configId,
    accepted: true,
    profile: config.policy.profile,
    boundary: interactive
      ? 'generic HTML/JS bootstrap with real K/C/M; not UI, full recovery or I5'
      : nodeProfile
        ? 'fixed Node/data K/C/M positive path; not arbitrary HTML, UI, full recovery or I5'
        : 'fixed native K/C/M positive path; not generic JS, UI, full recovery or I5',
  }),
);
console.log(
  `Passed installed K/C/M ${interactive ? 'generic report bootstrap' : `fixed ${nodeProfile ? 'Node/data' : 'native'}`} positive path.`,
);
