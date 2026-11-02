import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import { reportSourceBuildOptions } from '../../../packages/editor/report/build-options.mjs';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache', 'scholoom-report-native-events');
await mkdir(base, { recursive: true, mode: 0o700 });
const evidence = await mkdtemp(join(base, 'run-'));
const temporary = join(evidence, 'temporary');
await mkdir(temporary);
const commands = [{ command: process.execPath, args: process.argv.slice(1), cwd: process.cwd() }];
const cases = [
  'passive',
  'noncancelable',
  'caught-cancel',
  'property-cancel',
  'redispatch',
  'reentrant',
  'multiple',
];
const result = { state: 'failed', evidence, phase: 'prepare', cases: [], firstFailure: null };
const cleanup = [];
const json = (name, value) =>
  writeFile(join(evidence, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
async function snapshot(file) {
  const name = relative(workspace, resolve(workspace, file));
  assert(!name.startsWith('../') && !name.startsWith('/'));
  const destination = join(evidence, 'sources', name);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(workspace, name), destination);
}
console.log(`Evidence: ${evidence}`);
try {
  await json('instructions.json', {
    command: 'node tests/fixtures/report-program/native-events-check.mjs',
    scope:
      'Seven fixed benign scripts through actual createReportProgram; one ordinary Node child per case because the program installs globals.',
    authority:
      'Explicit synthetic approved-files substitute and fixed request binding; input adapter exercised via public start/frame/consume/ready/input and queued commands. Node identities come from public frames; only script-owned diagnostics are read directly.',
    expected: {
      passive:
        'Cancelable native passive preventDefault has no effect, no failure, and inputConfirmed.',
      noncancelable:
        'Noncancelable native preventDefault has no effect, no failure, and inputConfirmed.',
      'caught-cancel':
        'Cancelable native preventDefault latches unavailable despite the page catch, no inputConfirmed, later input cannot run.',
      'property-cancel':
        'Native onproperty return false latches unavailable without inputConfirmed.',
      redispatch:
        'Saved native Event redispatched after original dispatch becomes untrusted; ordinary local preventDefault succeeds without native-guard failure.',
      reentrant:
        'Redispatching the currently dispatching Event throws InvalidStateError; catching it preserves outer listeners and confirmation.',
      multiple:
        'A select multiple initially selects A and B; public input value=A/selectedIndex=0 latches one unavailable without confirmation or dispatch and preserves both selections before assignment.',
    },
    limits: {
      childMilliseconds: 8000,
      watchdogMilliseconds: 6000,
      commands: 32,
      packets: 32,
      frames: 16,
      outputBytes: 1048576,
    },
    excluded: [
      'Real reports or malicious JavaScript',
      'Real browser input/default actions',
      'OS isolation and I5 acceptance',
      'Models, services, root, network, /tmp and dependency installation',
    ],
    writeScope: [
      'tests/fixtures/report-program/native-events-driver.mjs',
      'tests/fixtures/report-program/native-events-check.mjs',
    ],
    failurePolicy:
      'Preserve first failure and stop for parent production repair; do not weaken expectations.',
  });
  for (const name of ['native-events-driver.mjs', 'native-events-check.mjs']) {
    const file = `tests/fixtures/report-program/${name}`;
    await snapshot(file);
    const syntax = spawnSync(process.execPath, ['--check', file], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 8000,
      env: { PATH: '/usr/bin:/bin', TMPDIR: temporary },
    });
    commands.push({
      command: process.execPath,
      args: ['--check', file],
      status: syntax.status,
      signal: syntax.signal,
      error: syntax.error?.message,
    });
    assert.ifError(syntax.error);
    assert.equal(syntax.status, 0, syntax.stderr);
  }
  result.phase = 'build';
  const outfile = join(evidence, 'driver.cjs');
  const options = {
    absWorkingDir: workspace,
    entryPoints: ['tests/fixtures/report-program/native-events-driver.mjs'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    ...reportSourceBuildOptions,
    define: { ...reportSourceBuildOptions.define, DEBUG: 'false' },
    sourcemap: true,
    metafile: true,
    write: false,
    logLevel: 'silent',
  };
  const built = await build(options);
  await json('build.json', { options, warnings: built.warnings, metafile: built.metafile });
  for (const file of built.outputFiles) await writeFile(file.path, file.contents, { flag: 'wx' });
  for (const file of Object.keys(built.metafile.inputs)) {
    if (file !== 'tests/fixtures/report-program/native-events-driver.mjs') await snapshot(file);
  }
  for (const name of cases) {
    result.phase = name;
    const env = { PATH: '/usr/bin:/bin', TMPDIR: temporary, TMP: temporary, TEMP: temporary };
    const args = ['--enable-source-maps', outfile, name];
    const start = Date.now();
    const child = spawnSync(process.execPath, args, {
      cwd: workspace,
      env,
      encoding: 'utf8',
      timeout: 8000,
      killSignal: 'SIGKILL',
      maxBuffer: 1048576,
    });
    const elapsedMilliseconds = Date.now() - start;
    const exit = {
      name,
      pid: child.pid,
      status: child.status,
      signal: child.signal,
      error: child.error?.message,
      elapsedMilliseconds,
      exited: child.status !== null || child.signal !== null,
    };
    cleanup.push(exit);
    commands.push({ command: process.execPath, args, cwd: workspace, env, ...exit });
    await writeFile(join(evidence, `${name}.stdout`), child.stdout ?? '', { flag: 'wx' });
    await writeFile(join(evidence, `${name}.stderr`), child.stderr ?? '', { flag: 'wx' });
    let detail;
    if (child.stdout?.trim()) {
      detail = JSON.parse(child.stdout);
      await json(`${name}.json`, detail);
    }
    result.cases.push({
      name,
      passed: child.status === 0 && !child.error && detail?.state === 'passed',
      elapsedMilliseconds,
    });
    assert.ifError(child.error);
    assert.equal(child.signal, null);
    if (detail?.firstFailure) result.firstFailure = { case: name, ...detail.firstFailure };
    assert.equal(child.status, 0, detail?.firstFailure?.message ?? child.stderr);
    assert.equal(detail?.state, 'passed');
    assert.equal(detail.closed, true);
    assert(elapsedMilliseconds < 10000, 'per-case time budget');
  }
  result.state = 'passed';
} catch (error) {
  result.firstFailure ??= {
    phase: result.phase,
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  console.error(result.firstFailure.message);
  process.exitCode = 1;
} finally {
  await json('commands.json', commands);
  await json('cleanup.json', cleanup);
  await json('first-failure.json', result.firstFailure);
  await json('result.json', result);
  console.log(JSON.stringify(result));
}
