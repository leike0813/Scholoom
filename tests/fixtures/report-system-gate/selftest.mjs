import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile, readlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';

assert.ok(process.env.SCHOOLOOM_SYSTEM_GATE_CACHE, 'Set the freshly built fixture cache');
const root = resolve(process.env.SCHOOLOOM_SYSTEM_GATE_CACHE);
const paths = Object.fromEntries(
  ['gate', 'probe', 'permit.fifo', 'probe.log', 'extra.txt', 'approved.txt'].map((n) => [
    n,
    join(root, n),
  ]),
);
const cases = [];
const processes = [];
let built;
async function unchanged() {
  for (const file of built.files) {
    const hash = createHash('sha256')
      .update(await readFile(file.path))
      .digest('hex');
    assert.equal(hash, file.sha256, `Changed during tests: ${file.path}`);
  }
}
before(async () => {
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.notEqual(process.getuid(), 0, 'This offline fixture must run as an ordinary UID');
  assert.notEqual(
    process.geteuid(),
    0,
    'This offline fixture must run with an ordinary effective UID',
  );
  built = JSON.parse(await readFile(join(root, 'build.json'), 'utf8'));
  await unchanged();
  await writeFile(paths['approved.txt'], 'approved report bytes\n', { flag: 'wx', mode: 0o400 });
  await writeFile(paths['extra.txt'], 'real inherited descriptor\n', { flag: 'wx', mode: 0o600 });
  await promisify(execFile)('mkfifo', ['-m', '600', paths['permit.fifo']], { timeout: 5000 });
});

async function run(name, permit, direct = false) {
  const input = await open(paths['permit.fifo'], constants.O_RDONLY | constants.O_NONBLOCK);
  const handles = [input];
  let child;
  let closed;
  let processRecord;
  try {
    const writer = await open(paths['permit.fifo'], constants.O_WRONLY | constants.O_NONBLOCK);
    handles.push(writer);
    const output = await open(paths['probe.log'], 'w', 0o600);
    handles.push(output);
    const extra = await open(paths['extra.txt'], 'r');
    handles.push(extra);
    // A real ordinary file is deliberately inherited at descriptor 42, without CLOEXEC.
    const stdio = [input.fd, output.fd, output.fd, 'pipe', ...Array(38).fill('ignore'), extra.fd];
    child = spawn(
      direct ? paths.probe : paths.gate,
      direct ? [paths['approved.txt'], 'normal'] : [],
      {
        stdio,
        env: {},
        timeout: 5000,
        killSignal: 'SIGKILL',
      },
    );
    processRecord = { name, pid: child.pid, closed: false };
    processes.push(processRecord);
    closed = new Promise((resolve_, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => {
        Object.assign(processRecord, { closed: true, code, signal });
        resolve_({ code, signal });
      });
    });
    closed.catch(() => {});
    const record = { name, direct, permitHex: permit.toString('hex'), extraFd: 42 };
    if (!direct) {
      let observed = '';
      for await (const chunk of child.stdio[3]) {
        observed += chunk.toString('ascii');
        assert.ok(observed.length <= 16);
      }
      assert.equal(observed, 'R');
      record.beforePermitExecutable = await readlink(`/proc/${child.pid}/exe`);
      assert.equal(record.beforePermitExecutable, paths.gate);
      const limits = await readFile(`/proc/${child.pid}/limits`, 'utf8');
      const fileLimit = limits.match(/^Max file size\s+(\d+)\s+(\d+)/m);
      assert.ok(fileLimit);
      record.fileSizeLimit = fileLimit.slice(1).map(Number);
      assert.deepEqual(record.fileSizeLimit, [65536, 65536]);
      record.beforePermitOutput = await readFile(paths['probe.log'], 'utf8');
      assert.equal(record.beforePermitOutput, '');
      if (permit.length) assert.equal((await writer.write(permit)).bytesWritten, permit.length);
    }
    await writer.close();
    handles.splice(handles.indexOf(writer), 1);
    Object.assign(record, await closed);
    record.output = await readFile(paths['probe.log'], 'utf8');
    cases.push(record);
    return record;
  } finally {
    if (child && !processRecord.closed) {
      child.kill('SIGKILL');
      await closed.catch(() => {});
    }
    await Promise.all(handles.map((handle) => handle.close()));
  }
}

test('the inherited-FD positive control reaches the unchanged byte-oracle wrapper', {
  timeout: 5000,
}, async () => {
  const result = await run('inherited-fd-control', Buffer.alloc(0), true);
  assert.equal(result.code, 90);
  assert.equal(result.signal, null);
  assert.equal(result.output, '');
});

test('one FIFO permit executes the fixed probe with exact bytes and closes FD42', {
  timeout: 5000,
}, async () => {
  const result = await run('one-permit', Buffer.from('G'));
  assert.equal(result.code, 0);
  assert.equal(result.signal, null);
  assert.equal(result.output, 'fixed probe consumed approved report bytes\n');
});

for (const [name, permit, expected] of [
  ['eof', '', 65],
  ['invalid', 'X', 66],
  ['multiple-permits', 'GG', 66],
]) {
  test(`${name} never executes the fixed probe`, { timeout: 5000 }, async () => {
    const result = await run(name, Buffer.from(permit));
    assert.equal(result.code, expected);
    assert.equal(result.signal, null);
    assert.equal(result.output, '');
  });
}

after(async () => {
  await unchanged();
  await writeFile(
    join(root, 'results.json'),
    `${JSON.stringify(
      {
        uid: process.getuid(),
        euid: process.geteuid(),
        scope: 'ordinary-UID offline FIFO/exec only; no system service or OS isolation claim',
        frozenBuildUnchanged: true,
        cases,
        processes,
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  );
  assert.ok(
    processes.every((p) => p.closed),
    'Every owned child must have emitted close',
  );
});
