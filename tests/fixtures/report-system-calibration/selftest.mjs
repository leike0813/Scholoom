import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';

assert.ok(process.env.SCHOOLOOM_T10_BUNDLE);
const root = resolve(process.env.SCHOOLOOM_T10_BUNDLE);
const bundle = JSON.parse(await readFile(join(root, 'bundle.json'), 'utf8'));
const observations = [];
const processes = [];
async function frozen() {
  for (const file of bundle.immutable)
    assert.equal(
      createHash('sha256')
        .update(await readFile(file.path))
        .digest('hex'),
      file.sha256,
      file.path,
    );
}
before(async () => {
  assert.notEqual(process.getuid(), 0);
  assert.notEqual(process.geteuid(), 0);
  await frozen();
});

async function execute(observer = false) {
  const handles = [];
  let child, closed, state;
  try {
    let reader, writer, approved, expected;
    if (!observer) {
      reader = await open(
        join(bundle.objects, 'permit.fifo'),
        constants.O_RDONLY | constants.O_NONBLOCK,
      );
      handles.push(reader);
      writer = await open(
        join(bundle.objects, 'permit.fifo'),
        constants.O_WRONLY | constants.O_NONBLOCK,
      );
      handles.push(writer);
      approved = await open(join(bundle.objects, 'approved.txt'), 'r');
      handles.push(approved);
      expected = await open(join(bundle.objects, 'expected.bin'), 'r');
      handles.push(expected);
      assert.equal((await writer.write('G')).bytesWritten, 1);
    }
    const log = join(bundle.objects, observer ? 'observer.log' : 'probe.log');
    const output = await open(log, 'w', 0o600);
    handles.push(output);
    child = spawn(bundle.binary, [observer ? '--observe' : '--offline'], {
      env: {},
      timeout: 5000,
      killSignal: 'SIGKILL',
      stdio: observer
        ? ['ignore', output.fd, output.fd]
        : [reader.fd, output.fd, output.fd, approved.fd, expected.fd],
    });
    state = { pid: child.pid, observer, closed: false };
    processes.push(state);
    closed = new Promise((resolve_, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        Object.assign(state, { closed: true, code, signal });
        resolve_({ code, signal });
      });
    });
    closed.catch(() => {});
    if (writer) {
      await writer.close();
      handles.splice(handles.indexOf(writer), 1);
    }
    const outcome = await closed;
    const raw = await readFile(log, 'utf8');
    const result = { ...outcome, observation: JSON.parse(raw) };
    observations.push(result);
    return result;
  } finally {
    if (child && !state.closed) {
      child.kill('SIGKILL');
      await closed.catch(() => {});
    }
    await Promise.all(handles.map((h) => h.close()));
  }
}

test('ordinary UID observes the actual inherited prechecked objects and fixed bytes', async () => {
  const result = await execute();
  assert.equal(result.code, 0);
  assert.equal(result.signal, null);
  assert.equal(result.observation.numericFdSimulation, true);
  assert.equal(result.observation.uid, process.getuid());
  assert.equal(result.observation.euid, process.geteuid());
  assert.equal(result.observation.objectsMatch, true);
  assert.equal(result.observation.inputMatch, true);
  assert.equal(result.observation.statusErrno, 0);
  for (const [fd, role] of [
    [0, 'permit.fifo'],
    [1, 'probe.log'],
    [2, 'probe.log'],
    [3, 'approved.txt'],
  ]) {
    const actual = result.observation.fds.find((item) => item.fd === fd);
    const expected = bundle.precheck.find((item) => item.role === role);
    assert.equal(actual.dev, expected.dev);
    assert.equal(actual.ino, expected.ino);
    assert.equal(actual.uid, expected.uid);
  }
});

test('opening a replacement after the precheck refuses object continuity', async () => {
  const approved = join(bundle.objects, 'approved.txt');
  const saved = join(bundle.objects, 'approved.saved');
  await rename(approved, saved);
  try {
    await writeFile(approved, 'approved report bytes\n', { flag: 'wx', mode: 0o400 });
    const result = await execute();
    assert.equal(result.code, 65);
    assert.equal(result.signal, null);
    assert.equal(result.observation.objectsMatch, false);
    assert.equal(result.observation.inputMatch, false);
    assert.notEqual(
      result.observation.fds.find((item) => item.fd === 3).ino,
      bundle.precheck.find((item) => item.role === 'approved.txt').ino,
    );
  } finally {
    // Replace only this test's newly created cache file with its saved original object.
    await rename(saved, approved);
  }
});

test('ordinary observer reports the absent system scope as missing evidence', async () => {
  const result = await execute(true);
  assert.equal(result.code, 2);
  assert.equal(result.signal, null);
  assert.equal(result.observation.uid, process.getuid());
  assert.equal(result.observation.targetUnit, bundle.probeUnit);
  assert.equal(result.observation.scopeErrno, 2);
  assert.equal(result.observation.eventsErrno, 2);
  assert.match(result.observation.capEff, /^[0-9a-f]{16}$/);
});

after(async () => {
  await frozen();
  assert.ok(processes.every((p) => p.closed));
  await writeFile(
    join(root, 'offline-results.json'),
    `${JSON.stringify(
      {
        origin: 'ordinary UID simulation, no PID1/C/M/LSM invocation',
        uid: process.getuid(),
        euid: process.geteuid(),
        frozenUnchanged: true,
        observations,
        processes,
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
});
