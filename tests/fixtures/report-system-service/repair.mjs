import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  constants,
  fchmodSync,
  fchownSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { limits } from '../../../packages/protocol/dist/core.js';
import { isolationControlOperations } from '../../../packages/protocol/dist/platform-isolation.js';
import { layout } from './layout.mjs';
import { checkPreReplacementFailure } from './repair-resume.mjs';

const inventoryWaitMs =
  limits.lifecycleMs +
  2 * limits.requestMs +
  isolationControlOperations['reportControl.open'].semantics.waitMs +
  isolationControlOperations['reportControl.close'].semantics.waitMs;
const bootstrapWaitMs =
  inventoryWaitMs +
  isolationControlOperations['reportControl.prepare'].semantics.waitMs +
  2 * isolationControlOperations['platform.reportIsolation.start'].semantics.waitMs +
  isolationControlOperations['platform.reportIsolation.stop'].semantics.waitMs +
  2 * 30_000;
const manifest = resolve(process.argv[2]);
const bundle = dirname(manifest);
const plan = JSON.parse(readFileSync(manifest, 'utf8'));
const p = layout(plan);
const cleanup = plan.purpose === 'deferred-cleanup';
const networkAdapters = plan.purpose === 'network-adapters';
const programUpdate = plan.purpose === 'initial-restore' || networkAdapters;
const generic = cleanup || programUpdate;
assert(plan.purpose === undefined || generic);
const prefix = networkAdapters
  ? 'network-adapters'
  : programUpdate
    ? 'initial-restore'
    : cleanup
      ? 'cleanup-repair'
      : 'capture-repair';
const passed = programUpdate
  ? `${prefix}-passed.json`
  : cleanup
    ? 'cleanup-repair-passed.json'
    : 't1-passed.json';
const replacement = programUpdate ? 'program.bin' : 'service.mjs';
const backup = programUpdate ? `program.before-${prefix}.bin` : `service.before-${prefix}.mjs`;
const staged = programUpdate ? `program.${prefix}-staged.bin` : `service.${prefix}-staged.mjs`;
const previousDigest = programUpdate ? plan.previousProgramDigest : plan.previousServiceDigest;
const resume = process.argv[3] === '--resume-before-replace';
const apply = process.argv[3] === '--apply' || resume;
assert.equal(process.argv.length, apply ? 4 : 3);
assert(
  !resume || networkAdapters,
  'Only the fixed network adapter pre-replacement phase can resume',
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const approved = new Map();
for (const name of [
  replacement,
  'verify-original.mjs',
  ...(programUpdate ? ['verify-restoration.mjs'] : []),
  ...(networkAdapters ? ['verify-isolation.mjs'] : []),
]) {
  const fd = openSync(join(bundle, name), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    assert(fstatSync(fd).isFile());
    const bytes = readFileSync(fd);
    assert.equal(digest(bytes), plan.files[name]);
    approved.set(name, bytes);
  } finally {
    closeSync(fd);
  }
}
function protectedFile(path) {
  for (let directory = dirname(path); directory !== '/'; directory = dirname(directory)) {
    const info = lstatSync(directory);
    assert(info.isDirectory() && info.uid === 0 && !(info.mode & 0o022));
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    assert(info.isFile() && info.uid === 0 && info.nlink === 1 && !(info.mode & 0o022));
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}
const configFile = join(p.programs, 'installed.json');
const configBytes = protectedFile(configFile);
assert.equal(digest(configBytes), plan.configDigest);
const config = JSON.parse(configBytes);
assert.equal(config.configId, plan.configId);
assert.equal(config.kernelUid, plan.kernelUid);
const original = join(p.programs, replacement);
assert.equal(digest(protectedFile(original)), previousDigest);
if (programUpdate)
  assert.equal(digest(protectedFile(join(p.programs, 'service.mjs'))), plan.previousServiceDigest);
assert.equal(
  JSON.parse(protectedFile(join(p.programs, 'installation-receipt.json'))).configId,
  config.configId,
);
for (const name of ['node', 'acceptance.mjs'])
  assert.equal(digest(protectedFile(join(p.programs, name))), plan.installedFiles[name]);
if (generic) {
  assert.equal(config.programId, 'scholoom-interactive-report');
  assert.equal(config.policy.profile, 'linux-x64-node-v1');
  const bootstrap = protectedFile(join(p.programs, 'bootstrap-passed.json'));
  assert.equal(digest(bootstrap), plan.bootstrapDigest);
  assert.equal(JSON.parse(bootstrap).accepted, true);
  assert.equal(JSON.parse(bootstrap).configId, config.configId);
}
if (programUpdate) {
  const receipt = protectedFile(join(p.programs, 'cleanup-repair-passed.json'));
  assert.equal(digest(receipt), plan.cleanupDigest);
  assert.equal(JSON.parse(receipt).accepted, true);
  assert.equal(JSON.parse(receipt).configId, config.configId);
}
if (networkAdapters) {
  const receipt = protectedFile(join(p.programs, 'initial-restore-passed.json'));
  assert.equal(digest(receipt), plan.initialRestoreDigest);
  assert.equal(JSON.parse(receipt).accepted, true);
  assert.equal(JSON.parse(receipt).configId, config.configId);
}
for (const name of [passed, `${prefix}.json`, backup, staged])
  assert.throws(() => lstatSync(join(p.programs, name)), { code: 'ENOENT' });
console.log(JSON.stringify({ programs: p.programs, configId: config.configId, replace: original }));
if (!apply) process.exit(0);
assert.equal(process.getuid(), 0);
assert.equal(process.geteuid(), 0);

if (resume) {
  const entries = protectedFile(join(p.programs, `${prefix}-commands.jsonl`))
    .toString('utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  checkPreReplacementFailure(entries, { ...p, kernelUid: config.kernelUid });
  assert.equal(
    digest(protectedFile(join(p.programs, `${prefix}-verify.mjs`))),
    plan.files['verify-original.mjs'],
  );
}
const log = join(p.programs, `${prefix}${resume ? '-resume' : ''}-commands.jsonl`);
const logFd = openSync(log, 'wx', 0o600);
closeSync(logFd);
function run(file, args, timeout = 45_000) {
  const result = spawnSync(file, args, {
    env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', SYSTEMD_PAGER: 'cat' },
    encoding: 'utf8',
    timeout,
    maxBuffer: 65536,
  });
  appendFileSync(log, `${JSON.stringify({ file, args, ...result })}\n`);
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function write(name, bytes) {
  const fd = openSync(
    join(p.programs, name),
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o444,
  );
  try {
    fchownSync(fd, 0, 0);
    writeFileSync(fd, bytes);
    fchmodSync(fd, 0o444);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
const account = run('/usr/bin/getent', ['passwd', String(config.kernelUid)]).split(':');
assert.equal(Number(account[2]), config.kernelUid);
if (programUpdate)
  run('/usr/bin/systemctl', ['--system', 'start', p.managerSocket, p.controlSocket]);
const verifier = `${prefix}-verify.mjs`;
if (!resume) write(verifier, approved.get('verify-original.mjs'));
console.log(
  run(
    '/usr/sbin/runuser',
    [
      '-u',
      account[0],
      '--',
      join(p.programs, 'node'),
      join(p.programs, verifier),
      configFile,
      ...(generic ? [] : [plan.originalInstanceId]),
    ],
    inventoryWaitMs,
  ),
);
run('/usr/bin/systemctl', ['--system', 'stop', p.controlSocket, p.managerSocket]);
function activeRoles() {
  return run('/usr/bin/systemctl', [
    '--system',
    'list-units',
    '--no-legend',
    '--plain',
    '--no-pager',
    '--state=active,activating,deactivating,reloading',
    p.controlService.replace('@.service', '@*.service'),
    p.managerService.replace('@.service', '@*.service'),
  ]);
}
async function waitForRoleExit() {
  let active = activeRoles();
  const deadline = Date.now() + 10_000;
  while (active && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    active = activeRoles();
  }
  assert.equal(active, '', 'An original role is still active; preserve its evidence.');
}
if (programUpdate) await waitForRoleExit();
else assert.equal(activeRoles(), '', 'An original role is still active; preserve its evidence.');
assert.equal(digest(protectedFile(original)), previousDigest);
write(staged, approved.get(replacement));
renameSync(original, join(p.programs, backup));
renameSync(join(p.programs, staged), original);
const directory = openSync(p.programs, constants.O_RDONLY | constants.O_DIRECTORY);
fsyncSync(directory);
closeSync(directory);
write(`${prefix}.json`, JSON.stringify({ configId: config.configId, plan }));
run('/usr/bin/systemctl', ['--system', 'start', p.managerSocket, p.controlSocket]);
console.log(
  run(
    '/usr/sbin/runuser',
    [
      '-u',
      account[0],
      '--',
      join(p.programs, 'node'),
      join(p.programs, 'acceptance.mjs'),
      configFile,
    ],
    bootstrapWaitMs,
  ),
);
if (programUpdate) {
  const verification = `${prefix}-acceptance.mjs`;
  write(verification, approved.get('verify-restoration.mjs'));
  console.log(
    run(
      '/usr/sbin/runuser',
      [
        '-u',
        account[0],
        '--',
        join(p.programs, 'node'),
        join(p.programs, verification),
        configFile,
        '--initial-restore',
      ],
      bootstrapWaitMs,
    ),
  );
}
if (networkAdapters) {
  await waitForRoleExit();
  const verification = 'network-adapters-isolation.mjs';
  write(verification, approved.get('verify-isolation.mjs'));
  console.log(
    run(
      '/usr/sbin/runuser',
      [
        '-u',
        account[0],
        '--',
        join(p.programs, 'node'),
        join(p.programs, verification),
        configFile,
        '--isolation',
      ],
      2 * bootstrapWaitMs,
    ),
  );
}
write(
  passed,
  JSON.stringify({
    configId: config.configId,
    accepted: true,
    boundary: networkAdapters
      ? 'generic K/C/M bootstrap, initial restoration, network capability rejection and busy stop; synthetic bytes/authorization, not UI or I5'
      : programUpdate
        ? 'generic K/C/M initial restoration before ready; synthetic bytes/authorization, not UI or I5'
        : cleanup
          ? 'generic K/C/M bootstrap after confirmed-stop cleanup repair; not UI or I5'
          : 'fixed native K/C/M positive path; not generic JS, UI, full recovery or I5',
  }),
);
console.log(
  `Passed repaired installed K/C/M ${programUpdate ? 'initial restoration' : cleanup ? 'generic bootstrap' : 'fixed native'} positive path. Evidence: ${log}`,
);
