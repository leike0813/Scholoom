import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import { compileContract } from '../../../packages/protocol/dist/core.js';
import {
  reportNodeLimits,
  reportNodeTargets,
  systemReportManifestSchema,
} from '../../../packages/protocol/dist/platform-isolation.js';

// Ordinary-UID named-FD simulation; no PID1, cross-UID, quota or complete stop receipt.
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.ok(process.getuid() > 0 && process.getuid() === process.geteuid());
const cwd = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache', 'scholoom-report-system-native');
mkdirSync(base, { recursive: true, mode: 0o700 });
const cache = mkdtempSync(join(base, 'node-launch-'));
const environment = { ...process.env, TMPDIR: cache };
const helper = join(cache, 'isolated-report-system');
const scope = join(cache, 'isolated-report-scope');
const gate = join(cache, 'isolated-report-gate');
const shim = join(cache, 'node-launch-shim');
const program = join(cache, 'node-program.cjs');
const evidence = join(cache, 'commands.jsonl');
const record = (value) => appendFileSync(evidence, `${JSON.stringify(value)}\n`);
const bytes = Buffer.from('approved report bytes\n');
const validManifest = compileContract({
  params: systemReportManifestSchema,
  result: systemReportManifestSchema,
}).params;
console.log(`Evidence: ${cache}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGKILL',
    ...options,
  });
  record({
    command: [command, ...args],
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
}

run(process.execPath, [
  'packages/platform/build-report-system.mjs',
  '/usr',
  join(cache, 'report-system'),
  helper,
]);
const flags = ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror'];
const cc = process.env.CC ?? 'cc';
run(cc, [...flags, 'packages/platform/native/isolated-report-scope.c', '-o', scope]);
run(cc, [
  ...flags,
  '-nostdlib',
  '-static',
  '-fno-stack-protector',
  '-fno-builtin',
  '-fno-pie',
  '-no-pie',
  '-Wl,-e,_start',
  'packages/platform/native/isolated-report-gate.c',
  '-o',
  gate,
]);
run(cc, [
  ...flags,
  `-DHELPER_PATH="${helper}"`,
  'tests/fixtures/report-system-native/node-launch-shim.c',
  '-o',
  shim,
]);
await build({
  entryPoints: [
    fileURLToPath(new URL('../report-system-service/node-program.mjs', import.meta.url)),
  ],
  outfile: program,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
});

function stamp(info) {
  return [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].join(':');
}
function identity(info) {
  return { dev: String(info.dev), ino: String(info.ino) };
}
function lines(path) {
  return readFileSync(path, 'utf8').split('\n').slice(0, -1).filter(Boolean).map(JSON.parse);
}
const runtime = reportNodeTargets.map((target) => {
  const path = realpathSync(
    target === '/runtime/node'
      ? '/opt/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f/node'
      : join('/usr/lib/x86_64-linux-gnu', basename(target)),
  );
  const info = lstatSync(path, { bigint: true });
  assert.ok(info.isFile() && info.uid === 0n && info.nlink === 1n && !(info.mode & 0o022n));
  assert.ok(info.size > 0n && info.size <= BigInt(reportNodeLimits.fileBytes));
  return { target, path, stamp: stamp(info) };
});
assert.ok(
  runtime.reduce((sum, file) => sum + lstatSync(file.path, { bigint: true }).size, 0n) <=
    BigInt(reportNodeLimits.totalBytes),
);
writeFileSync(
  join(cache, 'context.json'),
  `${JSON.stringify(
    {
      cwd,
      uid: process.getuid(),
      euid: process.geteuid(),
      node: process.version,
      helper,
      scope,
      gate,
      program,
      runtime,
      boundary:
        'ordinary-UID named FDs; synthetic C objects; actual root-owned runtime; no PID1/cross-UID/quota/complete stop receipt',
    },
    null,
    2,
  )}\n`,
);

for (const scenario of ['normal', 'runtime-stamp', 'data-input-file']) {
  test(scenario, { timeout: 25_000 }, async (t) => {
    const directory = mkdtempSync(join(cache, `${scenario}-`));
    const held = [];
    let child, closed, outcome, spawnError, timer, forced;
    let timedOut = false;
    const commands = [];
    const hold = (path, flags) => {
      const fd = openSync(path, flags | constants.O_NOFOLLOW);
      held.push(fd);
      return fd;
    };
    const logs = () =>
      Object.fromEntries(
        ['events', 'stdout', 'stderr'].map((name) => [
          name,
          readFileSync(join(directory, name), 'utf8'),
        ]),
      );
    try {
      const configId = randomUUID(),
        storageId = randomUUID();
      const sealed = {};
      for (const [name, content] of [
        ['program', readFileSync(program)],
        ['gate', readFileSync(gate)],
        ['asset-0', bytes],
      ]) {
        const path = join(directory, `${name}.bin`);
        writeFileSync(path, content, { flag: 'wx', mode: 0o400 });
        sealed[name] = stamp(lstatSync(path, { bigint: true }));
      }
      const dirfd = hold(directory, constants.O_RDONLY | constants.O_DIRECTORY);
      for (const name of ['permit', 'data-in', 'data-out'])
        run(scope, ['--fifo', name], { stdio: ['ignore', 'pipe', 'pipe', dirfd] });
      for (const name of ['events', 'stdout', 'stderr'])
        writeFileSync(join(directory, name), '', { flag: 'wx', mode: 0o600 });
      const files = Object.fromEntries(
        ['permit', 'events', 'stdout', 'stderr'].map((name) => [
          name,
          identity(lstatSync(join(directory, name), { bigint: true })),
        ]),
      );
      const manifest = {
        version: 1,
        configId,
        storageId,
        ownerUid: process.getuid(),
        stage: {
          instanceId: randomUUID(),
          programId: 'fixed-node',
          policyId: 'fixed-node',
          entryPath: 'reports/entry.txt',
          assets: [{ path: 'reports/entry.txt', byteLength: bytes.length }],
        },
        programVersion: 'program-3',
        policyVersion: 'node-policy-1',
        args: [],
        stamps: [sealed['asset-0']],
        sealed: { program: sealed.program, gate: sealed.gate },
        files,
        node: {
          files: runtime.map(({ target, stamp }) => ({ target, stamp })),
          input: identity(lstatSync(join(directory, 'data-in'), { bigint: true })),
          output: identity(lstatSync(join(directory, 'data-out'), { bigint: true })),
        },
      };
      if (scenario === 'runtime-stamp')
        manifest.node.files[0].stamp = `${runtime[0].stamp.split(':').slice(0, -1).join(':')}:0`;
      assert.equal(validManifest(manifest), true);
      const manifestPath = join(directory, 'manifest.json');
      writeFileSync(manifestPath, JSON.stringify(manifest), { flag: 'wx', mode: 0o400 });
      const input = hold(join(directory, 'permit'), constants.O_RDONLY | constants.O_NONBLOCK);
      const permit = hold(join(directory, 'permit'), constants.O_RDWR | constants.O_NONBLOCK);
      const dataIn = hold(join(directory, 'data-in'), constants.O_RDWR | constants.O_NONBLOCK);
      const dataOut = hold(join(directory, 'data-out'), constants.O_RDWR | constants.O_NONBLOCK);
      const renderInput = hold(
        join(directory, 'data-in'),
        constants.O_RDONLY | constants.O_NONBLOCK,
      );
      const output = hold(join(directory, 'stdout'), constants.O_WRONLY | constants.O_APPEND);
      const error = hold(join(directory, 'stderr'), constants.O_WRONLY | constants.O_APPEND);
      const events = hold(join(directory, 'events'), constants.O_RDWR | constants.O_APPEND);
      for (const [name, fd] of [
        ['permit', input],
        ['data-in', renderInput],
        ['data-out', dataOut],
      ]) {
        const info = fstatSync(fd, { bigint: true });
        assert.ok(info.isFIFO() && info.uid === BigInt(process.getuid()) && info.nlink === 1n);
        assert.equal(info.mode & 0o777n, 0o600n);
        assert.deepEqual(
          identity(info),
          name === 'permit' ? files.permit : manifest.node[name === 'data-in' ? 'input' : 'output'],
        );
      }
      const runtimeFDs = runtime.map((file) => {
        const fd = hold(file.path, constants.O_RDONLY | constants.O_NONBLOCK);
        assert.equal(stamp(fstatSync(fd, { bigint: true })), file.stamp);
        return fd;
      });
      // Permute names so the production entry must resolve every FD by its declared name.
      const names = [
        'asset0',
        'renderOutput',
        'events',
        'runtime7',
        'gate',
        'manifest',
        'program',
        'renderInput',
        ...runtime.slice(0, -1).map((_, i) => `runtime${i}`),
      ];
      const descriptors = [
        hold(join(directory, 'asset-0.bin'), constants.O_RDONLY),
        dataOut,
        events,
        runtimeFDs[7],
        hold(join(directory, 'gate.bin'), constants.O_RDONLY),
        hold(manifestPath, constants.O_RDONLY),
        hold(join(directory, 'program.bin'), constants.O_RDONLY),
        scenario === 'data-input-file'
          ? hold(join(directory, 'asset-0.bin'), constants.O_RDONLY)
          : renderInput,
        ...runtimeFDs.slice(0, -1),
      ];
      const args = [
        configId,
        storageId,
        String(process.getuid()),
        stamp(lstatSync(manifestPath, { bigint: true })),
        '1048576',
        '200',
        `scholoom-report-${configId}-v1@${storageId}.service`,
        '--node',
      ];
      const supervisorEvidence = join(directory, 'supervisor.jsonl');
      const env = {
        PATH: '/usr/bin:/bin',
        LANG: 'C',
        LISTEN_FDS: String(descriptors.length),
        LISTEN_FDNAMES: names.join(':'),
        NODE_LAUNCH_EVIDENCE: supervisorEvidence,
      };
      record({
        scenario,
        command: [shim, ...args],
        helper,
        env,
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
        }, 6000);
      }, 12_000);
      async function waitFor(predicate, name) {
        for (;;) {
          assert.ifError(spawnError);
          const value = predicate();
          if (value) return value;
          assert.equal(timedOut, false, `Timed out waiting for ${name}: ${JSON.stringify(logs())}`);
          assert.equal(outcome, undefined, `Exited before ${name}: ${JSON.stringify(logs())}`);
          await delay(10);
        }
      }
      const waitEvent = (name) =>
        waitFor(() => lines(join(directory, 'events')).find((event) => event.event === name), name);
      const send = (command) => {
        assert.equal(writeSync(permit, command), command.length);
        commands.push({ command, at: new Date().toISOString() });
      };
      if (scenario !== 'data-input-file') {
        const armed = await waitEvent('armed');
        const supervisor = lines(supervisorEvidence)[0];
        assert.equal(armed.pid, supervisor.helperPid);
        assert.equal(supervisor.supervisorPid, child.pid);
        send('P');
      }
      if (scenario === 'normal') {
        await waitEvent('ready');
        assert.equal(logs().stdout, '');
        assert.equal(logs().stderr, '');
        assert.equal(
          lines(join(directory, 'events')).some((event) => event.event === 'running'),
          false,
        );
        const buffer = Buffer.alloc(65536);
        assert.throws(() => readSync(dataOut, buffer, 0, buffer.length, null), { code: 'EAGAIN' });
        writeFileSync(join(directory, 'before-G.json'), JSON.stringify(logs(), null, 2));
        send('G');
        await waitEvent('running');
        const request = { action: 'probe' };
        const wire = `${JSON.stringify(request)}\n`;
        assert.equal(writeSync(dataIn, wire), Buffer.byteLength(wire));
        let response = '';
        await waitFor(() => {
          try {
            const size = readSync(dataOut, buffer, 0, buffer.length, null);
            response += buffer.subarray(0, size).toString('utf8');
            assert.ok(Buffer.byteLength(response) < buffer.length);
          } catch (error) {
            if (error.code !== 'EAGAIN') throw error;
          }
          return response.endsWith('\n');
        }, 'fixed Node echo');
        assert.deepEqual(JSON.parse(response), {
          approved: 'approved report bytes\n',
          request: { action: 'probe' },
        });
        writeFileSync(join(directory, 'response.json'), response);
        assert.equal(outcome, undefined, 'fixed Node echo must remain alive until S');
        send('S');
        await waitEvent('stopped');
      }
      await closed;
      assert.ifError(spawnError);
      assert.equal(timedOut, false);
      assert.equal(outcome.signal, null);
      const eventsRead = lines(join(directory, 'events'));
      if (scenario === 'normal') {
        assert.equal(outcome.code, 0);
        assert.deepEqual(
          eventsRead.map((event) => event.event),
          ['armed', 'ready', 'running', 'stopped'],
        );
        assert.equal(eventsRead.at(-1).gateReleased, true);
        assert.equal(logs().stdout, '');
        assert.equal(logs().stderr, '');
      } else {
        assert.equal(outcome.code, 120);
        assert.equal(
          eventsRead.some((event) => ['ready', 'running'].includes(event.event)),
          false,
        );
        const stage = scenario === 'runtime-stamp' ? 'input' : 'manifest-object';
        assert.ok(
          [...eventsRead, ...lines(join(directory, 'stderr'))].some(
            (event) => event.stage === stage,
          ),
          JSON.stringify(logs()),
        );
      }
      const supervision = lines(supervisorEvidence);
      assert.equal(supervision.at(-1).cleanupComplete, true);
      assert.equal(
        supervision.some((event) => event.cleanupKill),
        false,
        'normal/rejected native entry must leave no descendants',
      );
      for (const pid of [child.pid, supervision[0].helperPid])
        assert.equal(existsSync(`/proc/${pid}`), false);
      t.diagnostic(`Evidence: ${directory}`);
    } finally {
      if (child && !outcome) {
        child.kill('SIGTERM');
        await Promise.race([closed, delay(6000)]);
        if (!outcome) child.kill('SIGKILL');
        await closed;
      }
      clearTimeout(timer);
      clearTimeout(forced);
      for (const fd of held) closeSync(fd);
      record({
        scenario,
        directory,
        pid: child?.pid,
        outcome,
        timedOut,
        spawnError: spawnError?.message,
        commands,
        ...(existsSync(join(directory, 'events')) ? logs() : {}),
      });
    }
  });
}
