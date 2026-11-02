import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { IsolationAssets } from '../../../packages/platform/dist/isolated-report-assets.js';
import { isolationLock } from '../../../packages/platform/dist/isolated-report-controller.js';
import { IsolationRecords } from '../../../packages/platform/dist/isolated-report-records.js';
import { compileContract } from '../../../packages/protocol/dist/core.js';
import { systemReportManifestSchema } from '../../../packages/protocol/dist/platform-isolation.js';

// Ordinary-UID named-FD simulation; no PID1, cross-UID, cgroup quota or product acceptance.
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.notEqual(process.getuid(), 0);
assert.equal(process.getuid(), process.geteuid());
const cwd = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache', 'scholoom-report-system-inputs');
mkdirSync(base, { recursive: true, mode: 0o700 });
const cache = mkdtempSync(join(base, 'system-launch-'));
const environment = { ...process.env, TMPDIR: cache, SCHOOLOOM_ISOLATION_TEST_CACHE: cache };
const helper = join(base, 'isolated-report-system');
const shim = join(cache, 'system-launch-shim');
const evidence = join(cache, 'commands.jsonl');
const record = (value) => appendFileSync(evidence, `${JSON.stringify(value)}\n`);
const bytes = Buffer.from('approved report bytes\n');
const validManifest = compileContract({
  params: systemReportManifestSchema,
  result: systemReportManifestSchema,
}).params;
console.log(`Evidence: ${cache}`);
writeFileSync(
  join(cache, 'context.json'),
  `${JSON.stringify(
    {
      cwd,
      uid: process.getuid(),
      euid: process.geteuid(),
      node: process.version,
      helper,
      helperStat: lstatSync(helper, { bigint: true }),
      command: [process.execPath, '--test', fileURLToPath(import.meta.url)],
      boundary: 'ordinary UID named descriptors; not PID1/cross-UID/quotas/product acceptance',
    },
    (_, value) => (typeof value === 'bigint' ? String(value) : value),
    2,
  )}\n`,
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: 'utf8',
    timeout: 10_000,
    killSignal: 'SIGKILL',
  });
  record({ command: [command, ...args], ...result, error: result.error?.message });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

const probe = run(process.execPath, ['tests/fixtures/isolated-report-native/rebuild.mjs']);
run(process.env.CC ?? 'cc', [
  '-std=c11',
  '-O2',
  '-Wall',
  '-Wextra',
  '-Werror',
  `-DHELPER_PATH="${helper}"`,
  'tests/fixtures/report-system-native/system-launch-shim.c',
  '-o',
  shim,
]);

function stamp(info) {
  return [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].join(':');
}

function jsonLines(path) {
  return readFileSync(path, 'utf8').split('\n').slice(0, -1).filter(Boolean).map(JSON.parse);
}

for (const scenario of ['normal', 'same-bytes-new-inode', 'bad-manifest-stamp', 'duplicate-name']) {
  test(scenario, { timeout: 10_000 }, async (t) => {
    const root = mkdtempSync(join(cache, `${scenario}-`));
    const records = new IsolationRecords(root, 'linux-system-service-v1');
    let lock;
    let child;
    let closed;
    let outcome;
    let spawnError;
    let timer;
    let forced;
    let timedOut = false;
    let writer;
    let directory;
    const held = [];
    const commands = [];
    const hold = (name, flags) => {
      const fd = openSync(join(directory, name), flags | constants.O_NOFOLLOW);
      held.push(fd);
      return fd;
    };
    const logs = () => ({
      events: readFileSync(join(directory, 'events'), 'utf8'),
      stdout: readFileSync(join(directory, 'stdout'), 'utf8'),
      stderr: readFileSync(join(directory, 'stderr'), 'utf8'),
    });
    try {
      await records.initializeExisting();
      lock = await isolationLock(records.lockPath);
      assert.equal(lock.alive(), true);
      const { configId, receipts } = await records.provisionEmpty();
      assert.deepEqual(receipts, []);
      const receipt = await records.create(
        {
          instanceId: randomUUID(),
          programId: 'fixed',
          policyId: 'fixed',
          entryPath: 'reports/entry.txt',
          assets: [{ path: 'reports/entry.txt', byteLength: bytes.length }],
        },
        'program-3',
        'policy-2',
      );
      const assets = new IsolationAssets(records);
      await assets.prepare(receipt);
      await assets.put(receipt, 0, 0, bytes, () => records.save(receipt));
      await assets.seal(receipt, readFileSync(probe));
      await assets.systemInputs(receipt, ['normal']);
      await records.save(receipt);
      assert.equal(receipt.version, 2);
      assert.ok(receipt.systemInputs);
      directory = records.nativePath(receipt);
      const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
      assert.equal(validManifest(manifest), true);
      assert.deepEqual(manifest.args, ['normal']);
      assert.deepEqual(manifest.stage, receipt.stage);
      assert.deepEqual(JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8')), receipt);
      for (const [name, expected] of [
        ['manifest.json', receipt.systemInputs.manifest],
        ['program.bin', receipt.sealed.program],
        ['gate.bin', receipt.sealed.gate],
        ['asset-0.bin', receipt.stamps[0]],
      ]) {
        const info = lstatSync(join(directory, name), { bigint: true });
        assert.equal(stamp(info), expected);
        assert.equal(info.mode & 0o777n, 0o400n);
      }
      if (scenario === 'same-bytes-new-inode') {
        const path = join(directory, 'asset-0.bin');
        const original = lstatSync(path, { bigint: true });
        renameSync(path, join(directory, 'original-asset.bin'));
        writeFileSync(path, bytes, { flag: 'wx', mode: 0o400 });
        assert.notEqual(lstatSync(path, { bigint: true }).ino, original.ino);
        assert.deepEqual(readFileSync(path), bytes);
      }
      const input = hold('permit', constants.O_RDONLY | constants.O_NONBLOCK);
      writer = openSync(
        join(directory, 'permit'),
        constants.O_WRONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
      );
      const output = hold('stdout', constants.O_WRONLY | constants.O_APPEND);
      const error = hold('stderr', constants.O_WRONLY | constants.O_APPEND);
      const events = hold('events', constants.O_RDWR | constants.O_APPEND);
      for (const [name, fd, fifo] of [
        ['permit', input, true],
        ['stdout', output, false],
        ['stderr', error, false],
        ['events', events, false],
      ]) {
        const info = fstatSync(fd, { bigint: true });
        assert.equal(fifo ? info.isFIFO() : info.isFile(), true);
        assert.equal(info.uid, BigInt(process.getuid()));
        assert.equal(info.nlink, 1n);
        assert.equal(info.mode & 0o777n, 0o600n);
        const identity = { dev: String(info.dev), ino: String(info.ino) };
        assert.deepEqual(identity, receipt.systemInputs[name]);
        assert.deepEqual(identity, manifest.files[name]);
      }
      assert.deepEqual(logs(), { events: '', stdout: '', stderr: '' });
      // Deliberately permute the named descriptors to exercise name-based routing.
      const names = ['asset0', 'events', 'gate', 'manifest', 'program'];
      const descriptors = [
        hold('asset-0.bin', constants.O_RDONLY),
        events,
        hold('gate.bin', constants.O_RDONLY),
        hold('manifest.json', constants.O_RDONLY),
        hold('program.bin', constants.O_RDONLY),
      ];
      if (scenario === 'duplicate-name') names[4] = 'gate';
      const manifestStamp =
        scenario === 'bad-manifest-stamp'
          ? `${receipt.systemInputs.manifest.split(':').slice(0, -1).join(':')}:0`
          : receipt.systemInputs.manifest;
      const args = [
        configId,
        receipt.storageId,
        String(process.getuid()),
        manifestStamp,
        '1048576',
        '200',
        `scholoom-report-${configId}-v1@${receipt.storageId}.service`,
      ];
      const env = {
        PATH: '/usr/bin:/bin',
        LANG: 'C',
        LISTEN_FDS: String(descriptors.length),
        LISTEN_FDNAMES: names.join(':'),
      };
      record({
        scenario,
        command: [shim, ...args],
        helper,
        env,
        root,
        directory,
        fdNames: names.map((name, i) => ({ fd: i + 3, name })),
      });
      child = spawn(shim, args, { cwd, env, stdio: [input, output, error, ...descriptors] });
      child.once('error', (error) => {
        spawnError = error;
      });
      closed = new Promise((resolve) =>
        child.once('close', (code, signal) => {
          outcome = { code, signal };
          resolve();
        }),
      );
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        forced = setTimeout(() => {
          if (!outcome) child.kill('SIGKILL');
        }, 500);
      }, 8000);
      async function waitEvent(name) {
        for (;;) {
          assert.ifError(spawnError);
          const events = jsonLines(join(directory, 'events'));
          const found = events.find((event) => event.event === name);
          if (found) return found;
          assert.equal(timedOut, false, `Timed out waiting for ${name}`);
          assert.equal(outcome, undefined, `Exited before ${name}: ${JSON.stringify(logs())}`);
          await delay(10);
        }
      }
      function send(value) {
        assert.equal(lock.alive(), true);
        assert.equal(writeSync(writer, value), value.length);
        commands.push({ command: value, at: new Date().toISOString() });
      }
      if (scenario === 'normal' || scenario === 'same-bytes-new-inode') {
        const armed = await waitEvent('armed');
        assert.equal(armed.pid, child.pid);
        send('P');
      }
      if (scenario === 'normal') {
        await waitEvent('ready');
        const beforeG = logs();
        writeFileSync(join(root, 'before-G.json'), JSON.stringify(beforeG, null, 2));
        assert.equal(beforeG.stdout, '');
        assert.equal(beforeG.stderr, '');
        assert.equal(
          jsonLines(join(directory, 'events')).some((e) => e.event === 'running'),
          false,
        );
        send('G');
        closeSync(writer);
        writer = undefined;
        commands.push({ command: 'EOF', at: new Date().toISOString() });
        await waitEvent('running');
        await waitEvent('stopped');
      }
      await closed;
      assert.ifError(spawnError);
      assert.equal(timedOut, false);
      assert.equal(outcome.signal, null);
      const eventsRead = jsonLines(join(directory, 'events'));
      if (scenario === 'normal') {
        assert.equal(outcome.code, 0);
        assert.deepEqual(
          eventsRead.map((e) => e.event),
          ['armed', 'ready', 'running', 'stopped'],
        );
        assert.equal(eventsRead.at(-1).gateReleased, true);
        assert.equal(eventsRead.at(-1).failed, false, JSON.stringify(logs()));
        assert.equal(logs().stdout, '');
        assert.equal(logs().stderr, '');
      } else {
        assert.equal(outcome.code, 120);
        assert.equal(
          eventsRead.some((e) => ['ready', 'running'].includes(e.event)),
          false,
        );
        assert.equal(logs().stdout, '');
        const diagnostics = [...eventsRead, ...jsonLines(join(directory, 'stderr'))];
        const stage =
          scenario === 'same-bytes-new-inode'
            ? 'input'
            : scenario === 'bad-manifest-stamp'
              ? 'manifest-binding'
              : 'descriptor-duplicate';
        assert.ok(
          diagnostics.some((e) => e.stage === stage),
          JSON.stringify(logs()),
        );
      }
      t.diagnostic(`Evidence: ${root}`);
    } finally {
      if (writer !== undefined) closeSync(writer);
      if (child && !outcome) {
        child.kill('SIGTERM');
        await Promise.race([closed, delay(500)]);
        if (!outcome) child.kill('SIGKILL');
        await closed;
      }
      clearTimeout(timer);
      clearTimeout(forced);
      for (const fd of held) closeSync(fd);
      record({
        scenario,
        root,
        pid: child?.pid,
        outcome,
        timedOut,
        commands,
        spawnError: spawnError?.message,
        ...(directory ? logs() : {}),
      });
      try {
        await records.close();
      } finally {
        await lock?.close();
      }
    }
  });
}
