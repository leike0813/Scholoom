import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { installProgram, recoverStaging } from './install-program.mjs';
import { assertUnitUnoccupied, preflightProperties, unitProperties } from './unit-preflight.mjs';

const manifest = resolve(process.argv[2]);
const bundle = dirname(manifest);
const plan = JSON.parse(readFileSync(manifest, 'utf8'));
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
assert.match(plan.configId, uuid);
assert.match(plan.storageId, uuid);
const { configId, storageId } = plan;
const runtime = `/run/scholoom-report-check-${configId}`;
const programs = `/var/lib/scholoom-report-check-${configId}`;
const unit = `scholoom-report-${configId}-v1@${storageId}.service`;
const slice = `system-scholoomreport${configId.replaceAll('-', '')}${storageId.replaceAll('-', '')}.slice`;
const captureUnit = `scholoom-report-check-${configId}-capture.service`;
const stopUnit = `scholoom-report-check-${configId}-stop.service`;
assert.deepEqual(
  [plan.runtime, plan.programs, plan.unit, plan.slice, plan.captureUnit, plan.stopUnit],
  [runtime, programs, unit, slice, captureUnit, stopUnit],
);
const approved = new Map();
for (const name of [
  'manager',
  'probe',
  'retained.slice',
  'probe.service',
  'capture.service',
  'stop.service.in',
]) {
  const path = join(bundle, name);
  const info = lstatSync(path);
  assert.ok(info.isFile() && info.nlink === 1);
  const bytes = readFileSync(path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), plan.immutable[name]);
  approved.set(name, bytes);
}
const changes = {
  runtime,
  programs,
  units: [unit, slice, captureUnit, stopUnit].map((name) => `/run/systemd/system/${name}`),
  actions:
    'stage two fixed binaries and four temporary units, reload, start one trusted native probe in a retained slice, capture original range, kill original service invocation and confirm parent empty; stop the exact empty slice and remove these exact unit and binary files and their empty program directory only on confirmed success; preserve evidence',
};
const resume = process.argv[3] === '--resume-staging';
const preflight = process.argv[3] === '--preflight';
if (process.argv[3] !== '--apply' && !resume && !preflight) {
  assert.equal(process.argv.length, 3, 'Use bundle.json, optionally followed by --apply');
  console.log(JSON.stringify(changes, null, 2));
  process.exit(0);
}
assert.equal(process.argv.length, 4);
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
if (!preflight) {
  assert.equal(process.getuid(), 0, 'Explicit administrator execution is required');
  assert.equal(process.geteuid(), 0);
}
const fixed = { PATH: '/usr/bin:/bin', LANG: 'C', SYSTEMD_PAGER: 'cat', SYSTEMD_COLORS: '0' };
let staged = false;
function command(args, required = true) {
  const result = spawnSync('/usr/bin/systemctl', ['--system', ...args], {
    env: fixed,
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 65536,
  });
  const record = {
    command: ['/usr/bin/systemctl', '--system', ...args],
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message ?? null,
  };
  if (staged) appendFileSync(join(runtime, 'commands.jsonl'), `${JSON.stringify(record)}\n`);
  if (required) {
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, JSON.stringify(record));
  }
  return result;
}
function protectedDirectory(path) {
  const info = lstatSync(path);
  assert.ok(info.isDirectory() && info.uid === 0 && !(info.mode & 0o022), path);
}
for (const path of ['/run', '/run/systemd', '/run/systemd/system', '/var', '/var/lib'])
  protectedDirectory(path);
assert.equal(existsSync(runtime), resume);
assert.equal(existsSync(programs), resume);
for (const name of [unit, slice, captureUnit, stopUnit]) {
  for (const base of ['/run/systemd/system', '/etc/systemd/system', '/usr/lib/systemd/system']) {
    assert.equal(existsSync(join(base, name)), false);
    assert.equal(existsSync(join(base, `${name}.d`)), false);
  }
  const previous = command(['show', name, `--property=${preflightProperties}`]);
  assertUnitUnoccupied(unitProperties(previous.stdout), name, slice);
}
if (preflight) {
  console.log(JSON.stringify({ status: 'ready', ...changes }, null, 2));
  process.exit(0);
}
if (resume) recoverStaging(runtime, programs, changes, plan.immutable);
else {
  mkdirSync(runtime, { mode: 0o755 });
  mkdirSync(programs, { mode: 0o755 });
  writeFileSync(join(runtime, 'plan.json'), JSON.stringify(changes, null, 2), { flag: 'wx' });
}
staged = true;
const binaries = new Map();
for (const name of ['manager', 'probe'])
  installProgram(approved.get(name), join(programs, name), plan.immutable[name]);
for (const name of ['manager', 'probe']) {
  const info = lstatSync(join(programs, name));
  assert.ok(
    info.isFile() &&
      info.uid === 0 &&
      info.nlink === 1 &&
      info.mode & 0o111 &&
      !(info.mode & 0o022),
  );
  binaries.set(name, { dev: info.dev, ino: info.ino });
}
for (const name of ['probe.log', 'capture.log', 'stop.log'])
  writeFileSync(join(runtime, name), '', { flag: 'wx', mode: 0o644 });
const installed = new Map();
function install(name, text) {
  const path = `/run/systemd/system/${name}`;
  writeFileSync(path, text, { flag: 'wx', mode: 0o644 });
  const info = lstatSync(path, { bigint: true });
  installed.set(path, { dev: info.dev, ino: info.ino, text });
}
function effective(name) {
  const result = command(['show', name, '--property=FragmentPath,DropInPaths,LoadState']);
  const fields = unitProperties(result.stdout);
  assert.equal(fields.LoadState, 'loaded');
  assert.equal(fields.FragmentPath, `/run/systemd/system/${name}`);
  assert.equal(fields.DropInPaths, '', 'Inherited unit drop-ins require separate review');
}
try {
  install(slice, approved.get('retained.slice').toString('utf8'));
  install(unit, approved.get('probe.service').toString('utf8'));
  install(captureUnit, approved.get('capture.service').toString('utf8'));
  command(['daemon-reload']);
  effective(unit);
  effective(slice);
  effective(captureUnit);
  command(['start', unit]);
  let actors;
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const text = readFileSync(join(runtime, 'probe.log'), 'utf8');
    if (text.endsWith('\n')) {
      actors = JSON.parse(text);
      break;
    }
    await setTimeout(20);
  }
  assert.ok(
    actors &&
      Number.isSafeInteger(actors.pid) &&
      actors.pid > 1 &&
      Number.isSafeInteger(actors.child) &&
      actors.child > 1,
  );
  command(['start', '--wait', captureUnit]);
  const captured = JSON.parse(readFileSync(join(runtime, 'capture.log'), 'utf8'));
  const s = captured.scope;
  assert.match(s.bootId, uuid);
  assert.match(s.invocationId, /^(?!0{32}$)[a-f0-9]{32}$/);
  for (const field of ['dev', 'ino', 'controllerBirth']) assert.match(s[field], /^[0-9]{1,20}$/);
  assert.equal(s.controllerPid, actors.pid);
  const parentPath = `/sys/fs/cgroup/system.slice/${slice}`;
  const parent = lstatSync(parentPath, { bigint: true });
  assert.equal(s.dev, String(parent.dev));
  assert.equal(s.ino, String(parent.ino));
  assert.match(readFileSync(join(parentPath, 'cgroup.events'), 'utf8'), /^populated 1$/m);
  assert.ok(captured.runtimeUid > 0 && captured.runtimeUid !== plan.callerUid);
  assert.ok(captured.runtimeGid > 0 && captured.runtimeGid !== plan.callerGid);
  assert.deepEqual(captured.limits, {
    cpuQuota: '20000',
    cpuPeriod: '100000',
    memoryBytes: '67108864',
    swapBytes: '0',
    tasks: '16',
  });
  const expectedGroup = `0::/system.slice/${slice}/${unit}\n`;
  const births = new Map();
  for (const pid of [actors.pid, actors.child]) {
    assert.equal(readFileSync(`/proc/${pid}/cgroup`, 'utf8'), expectedGroup);
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    births.set(pid, stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]);
  }
  assert.equal(births.get(actors.pid), s.controllerBirth);
  writeFileSync(join(runtime, 'actors.json'), JSON.stringify([...births], null, 2), { flag: 'wx' });
  let stop = approved.get('stop.service.in').toString('utf8');
  for (const [token, value] of [
    ['BOOT', s.bootId],
    ['INVOCATION', s.invocationId],
    ['DEV', s.dev],
    ['INO', s.ino],
  ])
    stop = stop.replace(`@${token}@`, value);
  install(stopUnit, stop);
  command(['daemon-reload']);
  effective(unit);
  effective(slice);
  effective(captureUnit);
  effective(stopUnit);
  command(['start', '--wait', stopUnit]);
  assert.equal(readFileSync(join(runtime, 'stop.log'), 'utf8'), 'stopped\n');
  const stoppedParent = lstatSync(parentPath, { bigint: true });
  assert.equal(stoppedParent.dev, parent.dev);
  assert.equal(stoppedParent.ino, parent.ino);
  assert.match(readFileSync(join(parentPath, 'cgroup.events'), 'utf8'), /^populated 0$/m);
  for (const [pid, original] of births) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      assert.ok(fields[19] !== original || ['Z', 'X'].includes(fields[0]));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  // A successful pinned-scope result precedes any removal; unknown retains every installed object.
  for (const [path, original] of installed) {
    const current = lstatSync(path, { bigint: true });
    assert.ok(current.uid === 0n && current.dev === original.dev && current.ino === original.ino);
    assert.equal(readFileSync(path, 'utf8'), original.text);
  }
  // The retained parent is stopped only after the pinned-range empty receipt above.
  command(['stop', slice]);
  command(['reset-failed', unit, captureUnit, stopUnit], false);
  for (const path of installed.keys()) unlinkSync(path);
  command(['daemon-reload']);
  for (const name of ['manager', 'probe']) {
    const path = join(programs, name);
    const info = lstatSync(path);
    assert.ok(info.isFile() && info.uid === 0 && info.nlink === 1);
    assert.deepEqual({ dev: info.dev, ino: info.ino }, binaries.get(name));
    assert.equal(
      createHash('sha256').update(readFileSync(path)).digest('hex'),
      plan.immutable[name],
    );
    unlinkSync(path);
  }
  if (!resume) rmdirSync(programs);
  writeFileSync(
    join(runtime, 'RESULT.json'),
    JSON.stringify(
      {
        status: 'passed',
        captured,
        actors,
        unitsRemoved: true,
        programsRemoved: !resume,
        failedStaging: resume ? join(programs, 'failed-staging') : null,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  console.log(`Passed fixed native scope capture/stop. Evidence preserved: ${runtime}`);
} catch (error) {
  writeFileSync(join(runtime, 'FAILURE.txt'), `${error.stack}\n`, { flag: 'wx' });
  console.error(
    `Not accepted; preserve original units and evidence: ${runtime}. The probe has a 20s PID1 runtime limit; that limit alone is not a stop receipt.`,
  );
  throw error;
}
