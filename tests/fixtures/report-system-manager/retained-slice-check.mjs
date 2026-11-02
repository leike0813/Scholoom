import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

test('ordinary UID retains an active slice and reads its original empty cgroup', async (t) => {
  assert.equal(process.platform, 'linux');
  const uid = process.getuid();
  assert.notEqual(uid, 0);
  assert.equal(process.geteuid(), uid);
  const cache = join(homedir(), '.cache/scholoom-report-system-stop');
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const evidence = mkdtempSync(join(cache, 'retained-slice-'));
  t.diagnostic(`Evidence: ${evidence}`);
  const name = `scholoomretained${randomUUID().replaceAll('-', '')}`;
  const slice = `${name}.slice`;
  const service = `${name}.service`;
  const result = {
    uid,
    slice,
    service,
    command: [process.execPath, '--test', fileURLToPath(import.meta.url)],
    passed: false,
    cleanup: [],
  };
  const descriptors = [];
  function run(command, args, required = true) {
    const execution = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 5_000,
      maxBuffer: 65_536,
    });
    appendFileSync(
      join(evidence, 'commands.jsonl'),
      `${JSON.stringify({ time: new Date().toISOString(), command, args, status: execution.status, signal: execution.signal, stdout: execution.stdout, stderr: execution.stderr, error: execution.error?.message ?? null })}\n`,
    );
    assert.ifError(execution.error);
    assert.equal(execution.signal, null);
    if (required) assert.equal(execution.status, 0, execution.stderr);
    return execution;
  }
  function show(unit, property) {
    return run('/usr/bin/systemctl', [
      '--user',
      'show',
      unit,
      `--property=${property}`,
      '--value',
    ]).stdout.trim();
  }
  function retain(path, flags) {
    const fd = openSync(path, flags);
    descriptors.push(fd);
    return fd;
  }
  function identity(fd) {
    const { dev, ino } = fstatSync(fd, { bigint: true });
    return { dev: String(dev), ino: String(ino) };
  }
  function events(fd) {
    const buffer = Buffer.alloc(4096);
    return buffer.toString('utf8', 0, readSync(fd, buffer, 0, buffer.length, 0));
  }
  try {
    run('/usr/bin/systemd-run', [
      '--user',
      `--unit=${service}`,
      `--slice=${slice}`,
      '--property=Type=exec',
      '--property=Restart=no',
      '--property=ExitType=cgroup',
      '--property=RuntimeMaxSec=5s',
      '--property=TimeoutStopSec=2s',
      '--property=CPUQuota=20%',
      '--property=MemoryMax=67108864',
      '--property=MemorySwapMax=0',
      '--property=TasksMax=16',
      '/usr/bin/sleep',
      '1',
    ]);
    const parent = show(slice, 'ControlGroup');
    const child = show(service, 'ControlGroup');
    result.paths = { parent, child };
    assert.ok(parent.endsWith(`/${slice}`));
    assert.equal(child, `${parent}/${service}`);
    const parentPath = `/sys/fs/cgroup${parent}`;
    const parentDir = retain(parentPath, constants.O_RDONLY | constants.O_DIRECTORY);
    const childDir = retain(`/sys/fs/cgroup${child}`, constants.O_RDONLY | constants.O_DIRECTORY);
    const parentEvents = retain(`/proc/self/fd/${parentDir}/cgroup.events`, constants.O_RDONLY);
    const childEvents = retain(`/proc/self/fd/${childDir}/cgroup.events`, constants.O_RDONLY);
    result.original = {
      parentDir: identity(parentDir),
      childDir: identity(childDir),
      parentEvents: identity(parentEvents),
      childEvents: identity(childEvents),
    };
    result.live = { parent: events(parentEvents), child: events(childEvents) };
    assert.match(result.live.parent, /^populated 1$/m);
    assert.match(result.live.child, /^populated 1$/m);
    result.limits = Object.fromEntries(
      ['cpu.max', 'memory.max', 'memory.swap.max', 'pids.max'].map((file) => [
        file,
        readFileSync(`/proc/self/fd/${childDir}/${file}`, 'utf8'),
      ]),
    );
    const [quota, period] = result.limits['cpu.max'].trim().split(/\s+/).map(Number);
    assert.equal(quota / period, 0.2);
    assert.equal(result.limits['memory.max'].trim(), '67108864');
    assert.equal(result.limits['memory.swap.max'].trim(), '0');
    assert.equal(result.limits['pids.max'].trim(), '16');
    assert.equal(show(service, 'RuntimeMaxUSec'), '5s');

    const deadline = Date.now() + 8_000;
    do {
      result.serviceState = show(service, 'ActiveState');
      if (result.serviceState === 'inactive') break;
      assert.notEqual(result.serviceState, 'failed');
      await setTimeout(50);
    } while (Date.now() < deadline);
    assert.equal(result.serviceState, 'inactive');
    result.serviceResult = show(service, 'Result');
    assert.equal(result.serviceResult, 'success');

    do {
      result.childRetired = {};
      try {
        result.childRetired.originalEvents = events(childEvents);
      } catch (error) {
        result.childRetired.originalEventsError = { code: error.code, syscall: error.syscall };
        assert.equal(error.code, 'ENODEV');
      }
      try {
        result.childRetired.reopenedEvents = readFileSync(
          `/proc/self/fd/${childDir}/cgroup.events`,
          'utf8',
        );
      } catch (error) {
        result.childRetired.reopenError = { code: error.code, syscall: error.syscall };
        assert.equal(error.code, 'ENOENT');
      }
      if (result.childRetired.originalEventsError || result.childRetired.reopenError) break;
      await setTimeout(50);
    } while (Date.now() < deadline);
    assert.ok(result.childRetired.originalEventsError || result.childRetired.reopenError);

    result.retained = {
      identity: identity(parentDir),
      originalEvents: events(parentEvents),
      freshEvents: readFileSync(`/proc/self/fd/${parentDir}/cgroup.events`, 'utf8'),
      state: show(slice, 'ActiveState'),
    };
    const current = statSync(parentPath, { bigint: true });
    result.retained.pathIdentity = { dev: String(current.dev), ino: String(current.ino) };
    assert.deepEqual(result.retained.identity, result.original.parentDir);
    assert.deepEqual(result.retained.pathIdentity, result.original.parentDir);
    assert.match(result.retained.originalEvents, /^populated 0$/m);
    assert.match(result.retained.freshEvents, /^populated 0$/m);
    assert.equal(result.retained.state, 'active');
    // Retirement errors are diagnostic only; only a successful original-parent read proves empty.
    result.emptyObserved = true;
  } catch (error) {
    result.error = { code: error.code, message: error.message, stack: error.stack };
    throw error;
  } finally {
    const failures = [];
    for (const unit of [service, slice]) {
      try {
        const stop = run('/usr/bin/systemctl', ['--user', 'stop', unit], false);
        const state = show(unit, 'ActiveState');
        result.cleanup.push({ unit, stopStatus: stop.status, state });
        assert.equal(state, 'inactive');
      } catch (error) {
        result.cleanup.push({ unit, error: error.message });
        failures.push(error);
      }
    }
    for (const fd of descriptors.reverse()) {
      try {
        closeSync(fd);
      } catch (error) {
        failures.push(error);
      }
    }
    result.finalUid = { real: process.getuid(), effective: process.geteuid() };
    try {
      assert.deepEqual(result.finalUid, { real: uid, effective: uid });
    } catch (error) {
      failures.push(error);
    }
    result.cleanupErrors = failures.map((error) => error.message);
    result.passed = result.emptyObserved === true && !result.error && failures.length === 0;
    writeFileSync(join(evidence, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
    assert.equal(failures.length, 0, JSON.stringify(result.cleanupErrors));
  }
  assert.equal(result.passed, true);
});
