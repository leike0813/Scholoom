import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installProgram, recoverStaging } from './install-program.mjs';
import { assertUnitUnoccupied, unitProperties } from './unit-preflight.mjs';

test('fixed system manager package stays offline until explicit administrator execution', async (t) => {
  assert.notEqual(process.getuid(), 0);
  assert.notEqual(process.geteuid(), 0);
  const project = fileURLToPath(new URL('../../../', import.meta.url));
  const prepared = spawnSync(
    process.execPath,
    ['tests/fixtures/report-system-manager/prepare.mjs'],
    {
      cwd: project,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  assert.ifError(prepared.error);
  assert.equal(prepared.status, 0, prepared.stderr);
  const manifest = prepared.stdout.trim().split('\n').at(-1);
  const root = dirname(manifest);
  const bundle = JSON.parse(readFileSync(manifest, 'utf8'));
  const env = { ...process.env, TMPDIR: join(root, 'tmp') };
  const records = join(root, 'offline-checks.jsonl');
  t.diagnostic(`Bundle and evidence: ${root}`);
  function run(command, args, extra = {}) {
    const result = spawnSync(command, args, {
      cwd: project,
      env: { ...env, ...extra },
      encoding: 'utf8',
      timeout: 30_000,
    });
    appendFileSync(
      records,
      `${JSON.stringify({ command, args, status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, error: result.error?.message ?? null })}\n`,
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  }
  const serviceState = {
    Id: bundle.unit,
    LoadState: 'not-found',
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
  };
  const sliceState = { ...serviceState, Id: bundle.slice, LoadState: 'loaded' };
  await t.test('preflight accepts missing services and an empty synthesized slice', () => {
    for (const state of [serviceState, sliceState]) {
      const text = Object.entries(state)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      assertUnitUnoccupied(unitProperties(text), state.Id, bundle.slice);
    }
  });
  await t.test(
    'preflight rejects configured, running, previously executed and incomplete units',
    () => {
      for (const [key, value] of Object.entries({
        Id: bundle.captureUnit,
        LoadState: 'error',
        ActiveState: 'active',
        SubState: 'start',
        FragmentPath: '/existing.slice',
        SourcePath: '/existing.conf',
        DropInPaths: '/existing.slice.d/policy.conf',
        Transient: 'yes',
        ControlGroup: '/existing.slice',
        InvocationID: '1'.repeat(32),
        Job: '1 /org/freedesktop/systemd1/job/1',
        NeedDaemonReload: 'yes',
      })) {
        assert.throws(() =>
          assertUnitUnoccupied({ ...sliceState, [key]: value }, bundle.slice, bundle.slice),
        );
        const incomplete = { ...sliceState };
        delete incomplete[key];
        assert.throws(() => assertUnitUnoccupied(incomplete, bundle.slice, bundle.slice));
      }
      assert.throws(() =>
        assertUnitUnoccupied({ ...serviceState, LoadState: 'loaded' }, bundle.unit, bundle.slice),
      );
    },
  );
  await t.test('stages a writable source as a caller-owned read-only executable', () => {
    const source = join(root, 'writable-program');
    const destination = join(root, 'installed-program');
    const bytes = Buffer.from('fixed program bytes');
    writeFileSync(source, bytes, { flag: 'wx' });
    chmodSync(source, 0o775);
    const digest = createHash('sha256').update(bytes).digest('hex');
    installProgram(readFileSync(source), destination, digest);
    const info = statSync(destination);
    assert.equal(info.uid, process.geteuid());
    assert.equal(info.gid, process.getegid());
    assert.equal(info.mode & 0o7777, 0o555);
    assert.equal(info.nlink, 1);
    assert.deepEqual(readFileSync(destination), bytes);
    assert.equal(statSync(source).mode & 0o777, 0o775);
    assert.throws(() => installProgram(bytes, destination, digest), { code: 'EEXIST' });
    assert.deepEqual(readFileSync(destination), bytes);
    const link = join(root, 'linked-program');
    symlinkSync(destination, link);
    assert.throws(() => installProgram(bytes, link, digest), { code: 'EEXIST' });
    assert.deepEqual(readFileSync(destination), bytes);
    const invalid = join(root, 'unapproved-program');
    assert.throws(() => installProgram(bytes, invalid, 'invalid-digest'));
    assert.equal(existsSync(invalid), false);
  });
  function failedStage(name) {
    const directory = join(root, name);
    const runtime = join(directory, 'runtime');
    const programs = join(directory, 'programs');
    mkdirSync(runtime, { recursive: true, mode: 0o755 });
    mkdirSync(programs, { mode: 0o755 });
    const changes = { case: name };
    writeFileSync(join(runtime, 'plan.json'), JSON.stringify(changes), { mode: 0o644 });
    const hashes = {};
    for (const program of ['manager', 'probe']) {
      const bytes = Buffer.from(`${program} approved bytes`);
      writeFileSync(join(programs, program), bytes);
      chmodSync(join(programs, program), 0o775);
      hashes[program] = createHash('sha256').update(bytes).digest('hex');
    }
    return { runtime, programs, changes, hashes };
  }
  await t.test('recovers only failed staging, preserving the original bytes and metadata', () => {
    const stage = failedStage('recoverable');
    const before = ['manager', 'probe'].map((name) => readFileSync(join(stage.programs, name)));
    const old = openSync(join(stage.programs, 'manager'), 'r+');
    try {
      recoverStaging(stage.runtime, stage.programs, stage.changes, stage.hashes);
      assert.deepEqual(readdirSync(stage.programs), ['failed-staging']);
      for (const [i, name] of ['manager', 'probe'].entries()) {
        const backup = join(stage.runtime, `failed-${name}.bin`);
        assert.deepEqual(readFileSync(backup), before[i]);
        installProgram(readFileSync(backup), join(stage.programs, name), stage.hashes[name]);
        assert.equal(statSync(join(stage.programs, name)).mode & 0o7777, 0o555);
      }
      const late = Buffer.from('changed through retained writer');
      writeFileSync(old, late);
      assert.deepEqual(readFileSync(join(stage.programs, 'failed-staging/manager')), late);
      assert.deepEqual(readFileSync(join(stage.programs, 'manager')), before[0]);
    } finally {
      closeSync(old);
    }
    const evidence = JSON.parse(readFileSync(join(stage.runtime, 'failed-staging.json'), 'utf8'));
    assert.deepEqual(
      evidence.map(({ mode, uid }) => ({ mode, uid })),
      [
        { mode: 0o775, uid: process.geteuid() },
        { mode: 0o775, uid: process.geteuid() },
      ],
    );
    assert.throws(() => recoverStaging(stage.runtime, stage.programs, stage.changes, stage.hashes));
  });
  for (const fault of ['execution-record', 'modified-program', 'foreign-plan']) {
    await t.test(`recovery refuses ${fault} without removing existing programs`, () => {
      const stage = failedStage(fault);
      if (fault === 'execution-record')
        writeFileSync(join(stage.runtime, 'commands.jsonl'), 'started\n');
      if (fault === 'modified-program') writeFileSync(join(stage.programs, 'probe'), 'user edit');
      if (fault === 'foreign-plan') writeFileSync(join(stage.runtime, 'plan.json'), '{}');
      const before = ['manager', 'probe'].map((name) => readFileSync(join(stage.programs, name)));
      assert.throws(() =>
        recoverStaging(stage.runtime, stage.programs, stage.changes, stage.hashes),
      );
      for (const [i, name] of ['manager', 'probe'].entries())
        assert.deepEqual(readFileSync(join(stage.programs, name)), before[i]);
      assert.equal(existsSync(join(stage.runtime, 'failed-staging.json')), false);
    });
  }
  await t.test('ordinary default invocation only lists the exact derived changes', () => {
    const result = run(process.execPath, [
      'tests/fixtures/report-system-manager/run.mjs',
      manifest,
    ]);
    assert.equal(result.status, 0);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.runtime, bundle.runtime);
    assert.equal(plan.programs, bundle.programs);
    assert.deepEqual(
      plan.units,
      [bundle.unit, bundle.slice, bundle.captureUnit, bundle.stopUnit].map(
        (name) => `/run/systemd/system/${name}`,
      ),
    );
  });
  await t.test('ordinary privileged modes refuse before staging any system files', () => {
    for (const mode of ['--apply', '--resume-staging']) {
      const result = run(process.execPath, [
        'tests/fixtures/report-system-manager/run.mjs',
        manifest,
        mode,
      ]);
      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes('administrator'));
    }
  });
  await t.test('altered bundle content refuses even the read-only listing', () => {
    const altered = join(root, 'altered');
    mkdirSync(altered);
    for (const name of Object.keys(bundle.immutable))
      copyFileSync(join(root, name), join(altered, name));
    writeFileSync(join(altered, 'bundle.json'), JSON.stringify(bundle));
    writeFileSync(join(altered, 'probe.service'), 'altered fixture\n');
    const result = run(process.execPath, [
      'tests/fixtures/report-system-manager/run.mjs',
      join(altered, 'bundle.json'),
    ]);
    assert.notEqual(result.status, 0);
  });
  await t.test('all four unit texts parse in an alternate root without manager access', () => {
    const shadow = join(root, 'offline-root');
    const programs = join(shadow, bundle.programs);
    const units = join(shadow, 'etc/systemd/system');
    mkdirSync(programs, { recursive: true });
    mkdirSync(units, { recursive: true });
    for (const name of ['probe', 'manager']) copyFileSync(join(root, name), join(programs, name));
    writeFileSync(join(units, bundle.unit), readFileSync(join(root, 'probe.service')));
    writeFileSync(join(units, bundle.slice), readFileSync(join(root, 'retained.slice')));
    writeFileSync(join(units, bundle.captureUnit), readFileSync(join(root, 'capture.service')));
    const stop = readFileSync(join(root, 'stop.service.in'), 'utf8')
      .replace('@BOOT@', '11111111-1111-4111-8111-111111111111')
      .replace('@INVOCATION@', '1'.repeat(32))
      .replace('@DEV@', '1')
      .replace('@INO@', '1');
    writeFileSync(join(units, bundle.stopUnit), stop);
    const result = run(
      '/usr/bin/systemd-analyze',
      [
        'verify',
        `--root=${shadow}`,
        '--generators=no',
        '--man=no',
        bundle.unit,
        bundle.slice,
        bundle.captureUnit,
        bundle.stopUnit,
      ],
      {
        DBUS_SYSTEM_BUS_ADDRESS: `unix:path=${root}/no-manager.sock`,
      },
    );
    assert.equal(result.status, 0, result.stderr);
  });
});
