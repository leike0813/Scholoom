import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('report-system SDK and ordinary UID checks', async (t) => {
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.notEqual(process.getuid(), 0, 'Run with an ordinary real UID');
  assert.notEqual(process.geteuid(), 0, 'Run with an ordinary effective UID');

  const cwd = fileURLToPath(new URL('../../../', import.meta.url));
  const base = join(homedir(), '.cache', 'scholoom-report-system-native');
  mkdirSync(base, { recursive: true });
  const cache = mkdtempSync(join(base, 'run-'));
  const tmp = join(cache, 'tmp');
  mkdirSync(tmp);
  const helper = join(cache, 'report-system');
  const evidence = join(cache, 'commands.jsonl');
  writeFileSync(
    join(cache, 'context.json'),
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        cwd,
        uid: process.getuid(),
        euid: process.geteuid(),
        node: process.version,
        sdk: '/usr',
        TMPDIR: tmp,
        CC: process.env.CC ?? 'cc',
      },
      null,
      2,
    )}\n`,
  );
  t.diagnostic(`Evidence: ${cache}`);

  function run(name, command, args) {
    const result = spawnSync(command, args, {
      cwd,
      env: { ...process.env, TMPDIR: tmp },
      encoding: 'utf8',
      timeout: 30_000,
      killSignal: 'SIGKILL',
    });
    appendFileSync(
      evidence,
      `${JSON.stringify({
        name,
        command: [command, ...args],
        cwd,
        exitCode: result.status,
        signal: result.signal,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error?.message ?? null,
      })}\n`,
    );
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  }

  await t.test('installed SDK versions', () => {
    const result = run('sdk', 'dpkg-query', ['-W', 'libsystemd-dev', 'libsystemd0']);
    assert.equal(result.status, 0);
  });
  const build = run('build', process.execPath, [
    'packages/platform/build-report-system.mjs',
    '/usr',
    helper,
  ]);
  assert.equal(build.status, 0);

  await t.test('readonly --check', () => {
    const result = run('check', helper, ['--check']);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'available');
  });

  const uuid = '11111111-1111-4111-8111-111111111111';
  const kill = ['--kill', uuid, uuid, uuid, '1'.repeat(32), '1', '1', '1000'];
  for (const [name, args, stage] of [
    ['no arguments', [], 'arguments'],
    ['unknown verb with full arguments', ['--unknown', ...kill.slice(1)], 'arguments'],
    ['check with extra argument', ['--check', 'extra'], 'arguments'],
    ['kill with missing argument', kill.slice(0, -1), 'arguments'],
    ['kill with extra argument', [...kill, 'extra'], 'arguments'],
    ['full kill under ordinary UID', kill, 'manager-identity'],
    ['capture with missing argument', ['--capture', uuid], 'arguments'],
    ['capture with extra argument', ['--capture', uuid, uuid, 'extra'], 'arguments'],
    ['full capture under ordinary UID', ['--capture', uuid, uuid], 'manager-identity'],
    ['parent under ordinary UID', ['--parent', uuid, uuid], 'manager-identity'],
    [
      'recovery with original parent under ordinary UID',
      ['--recover', uuid, uuid, uuid, '1', '1'],
      'manager-identity',
    ],
    [
      'empty observation with original parent under ordinary UID',
      ['--empty', uuid, uuid, uuid, '1', '1'],
      'manager-identity',
    ],
    ['recovery without original parent', ['--recover', uuid, uuid, uuid], 'arguments'],
  ]) {
    await t.test(name, () => {
      const result = run(name, helper, args);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, '');
      assert.ok(result.stderr.includes(`:${stage}:`));
    });
  }

  const readers = join(cache, 'capture-readers');
  const compile = run('build capture readers', process.env.CC ?? 'cc', [
    '-std=c11',
    '-O2',
    '-Wall',
    '-Wextra',
    '-Werror',
    `-DHEADER_SOURCE="${join(cwd, 'packages/platform/native/report-system.c')}"`,
    'tests/fixtures/report-system-native/capture-readers.c',
    '-Wl,-l:libsystemd.so.0',
    '-o',
    readers,
  ]);
  assert.equal(compile.status, 0);

  await t.test('real proc birth and accounts match independent Node reads', () => {
    const stat = readFileSync('/proc/self/stat', 'utf8');
    const status = readFileSync('/proc/self/status', 'utf8');
    const fields = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    // The suffix starts at field 3; starttime is field 22, at offset 19.
    const expectedBirth = BigInt(fields[19]).toString();
    const uid = status.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m);
    const gid = status.match(/^Gid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m);
    assert.ok(uid);
    assert.ok(gid);
    assert.deepEqual(uid.slice(1).map(Number), Array(4).fill(process.getuid()));
    assert.deepEqual(gid.slice(1).map(Number), Array(4).fill(process.getgid()));
    writeFileSync(
      join(cache, 'proc-oracle.json'),
      `${JSON.stringify({ pid: process.pid, stat, status, expectedBirth, uid: uid[1], gid: gid[1] })}\n`,
    );
    const result = run('real proc readers', readers, ['proc', `/proc/${process.pid}`]);
    assert.equal(result.status, 0);
    assert.deepEqual(result.stdout.trim().split(/\s+/), [expectedBirth, uid[1], gid[1]]);
  });

  const inputs = join(cache, 'inputs');
  mkdirSync(inputs);
  const statFields = Array.from({ length: 50 }, (_, index) => String(index + 3));
  statFields[0] = 'S';
  const syntheticStat = `123 (fixture ) with\nnewline) ${statFields.join(' ')}\n`;
  for (const [name, operation, file, content, expected, stage] of [
    ['birth field 22 with newline in comm', 'birth', 'stat', syntheticStat, '22', null],
    ['birth missing field 22', 'birth', 'stat', '123 (fixture) S 1 2\n', null, 'capture-birth'],
    ['numeric limit', 'limit', 'value', '12345\n', '12345', null],
    ['zero swap limit', 'limit', 'value', '0\n', '0', null],
    ['uint64 limit', 'limit', 'value', '18446744073709551615\n', '18446744073709551615', null],
    ['overflow limit', 'limit', 'value', '18446744073709551616\n', null, 'number'],
    ['empty limit', 'limit', 'value', '', null, 'observation-empty'],
    ['oversized limit', 'limit', 'value', '1'.repeat(64), null, 'observation-size'],
    ['max limit', 'limit', 'value', 'max\n', null, 'number'],
    ['limit missing newline', 'limit', 'value', '12345', null, 'capture-limit'],
    [
      'account unequal IDs',
      'account',
      'status',
      'Uid:\t1\t2\t1\t1\nGid:\t1\t1\t1\t1\n',
      null,
      'capture-account',
    ],
    ['account missing newline', 'account', 'status', 'Uid:\t1\t1\t1\t1', null, 'capture-account'],
    ['read at capacity minus one', 'read', 'value', 'a'.repeat(15), 'a'.repeat(15), null],
    ['read at capacity', 'read', 'value', 'a'.repeat(16), null, 'observation-size'],
    ['read symlink', 'read', 'link', null, null, 'observation-open'],
  ]) {
    await t.test(name, () => {
      const directory = join(inputs, name);
      mkdirSync(directory);
      if (content === null) {
        writeFileSync(join(directory, 'value'), 'owned\n');
        symlinkSync('value', join(directory, file));
      } else writeFileSync(join(directory, file), content);
      const result = run(name, readers, [operation, directory, file]);
      if (stage) {
        assert.notEqual(result.status, 0);
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.includes(`:${stage}:`));
      } else {
        assert.equal(result.status, 0);
        assert.equal(result.stdout.trim(), expected);
      }
    });
  }
});
