import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import { reportSourceBuildOptions } from '../../../packages/editor/report/build-options.mjs';
import { runEventCases } from './events-cases.mjs';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache', 'scholoom-report-events');
await mkdir(base, { recursive: true, mode: 0o700 });
const evidence = await mkdtemp(join(base, 'run-'));
const temporary = join(evidence, 'temporary');
await mkdir(temporary);
process.env.TMPDIR = temporary;
process.env.TMP = temporary;
process.env.TEMP = temporary;
const result = { state: 'failed', evidence, phase: 'prepare', firstFailure: null };
const commands = [{ command: process.execPath, args: process.argv.slice(1), cwd: process.cwd() }];
const cleanup = { browserStarted: false, browserClosed: false, browserProcesses: [], source: null };
const json = (name, value) =>
  writeFile(join(evidence, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const snapshot = async (file) => {
  const name = relative(workspace, resolve(workspace, file));
  assert(!name.startsWith('../') && !name.startsWith('/'));
  const destination = join(evidence, 'sources', name);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(workspace, name), destination);
};
let browser;
console.log(`Evidence: ${evidence}`);
try {
  await json('instructions.json', {
    command: 'node tests/fixtures/report-program/events-check.mjs',
    scope:
      'Fixed benign synthetic events in one source DOM and an independent Chromium native DOM; browser traces define event expectations.',
    groups: [
      'order/phases/boolean capture',
      'duplicate callback/capture',
      'once/recursive new Event',
      'dispatch snapshots',
      'noncancelable propagation stops',
      'passive/cancelable cancellation',
      'onproperty cancellation/replacement/removal',
    ],
    transport:
      'Only public transfer ABI; per-node handles across types, original add/remove tuple, preserved active handles and fresh monotonic U16 allocation; no exact handle values.',
    constraints: [
      'Only three new events-{cases,source,check}.mjs files',
      'No production/root/OpenSpec/README edits',
      'No report JS, models, services, network, root, /tmp, dependency installation or shared process cleanup',
      'One createWorkerDOM/hydrate and per-case owned temporary divs',
    ],
    excluded: [
      'listener exceptions',
      'AbortSignal',
      'shadow DOM',
      'object handleEvent',
      'full Web platform compatibility',
      'exact timestamps',
      'real native default cancellation guard (parent-owned)',
      'I5/UI/OS isolation acceptance',
    ],
    policy:
      'Keep the first failure; stop for parent production repair. Rerun this same fixture after parent confirmation; never change oracle assertions to force green.',
  });
  for (const name of ['events-cases.mjs', 'events-source.mjs', 'events-check.mjs']) {
    const file = `tests/fixtures/report-program/${name}`;
    await snapshot(file);
    const syntax = spawnSync(process.execPath, ['--check', file], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, TMPDIR: temporary },
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
  result.phase = 'build-source';
  const outfile = join(evidence, 'source.mjs');
  const options = {
    absWorkingDir: workspace,
    entryPoints: ['tests/fixtures/report-program/events-source.mjs'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
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
    if (!file.startsWith('tests/fixtures/report-program/events-')) await snapshot(file);
  }

  result.phase = 'native-oracle';
  const browserErrors = [];
  const networkRequests = [];
  const launch = {
    headless: true,
    timeout: 20000,
    env: { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary },
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-dev-shm-usage',
      '--no-proxy-server',
    ],
  };
  commands.push({
    api: 'chromium.launch',
    executable: chromium.executablePath(),
    args: launch.args,
    headless: true,
    TMPDIR: temporary,
  });
  browser = await chromium.launch(launch);
  cleanup.browserStarted = true;
  const cdp = await browser.newBrowserCDPSession();
  const version = await cdp.send('Browser.getVersion');
  const context = await browser.newContext({ offline: true, serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    networkRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.setContent(
    '<!doctype html><html><head><title>Fixed synthetic event oracle</title></head><body></body></html>',
  );
  await writeFile(
    join(evidence, 'native-scenario.js'),
    `(${runEventCases.toString()})({document,Event})\n`,
    { flag: 'wx' },
  );
  const groups = await page.evaluate(`(${runEventCases.toString()})({document,Event})`);
  cleanup.browserProcesses = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(
    ({ id, type }) => ({ pid: id, type }),
  );
  await cdp.detach();
  const ownedRootsRemaining = await page.locator('body > *').count();
  await json('native-oracle.json', {
    version,
    groups,
    browserErrors,
    networkRequests,
    ownedRootsRemaining,
  });
  assert.equal(groups.length, 7);
  assert.equal(ownedRootsRemaining, 0);
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(networkRequests, []);
  await context.close();
  await browser.close();
  cleanup.browserClosed = true;
  browser = undefined;

  result.phase = 'source-runtime';
  const args = [outfile];
  const child = spawnSync(process.execPath, args, {
    cwd: workspace,
    env: { PATH: '/usr/bin:/bin', TMPDIR: temporary },
    encoding: 'utf8',
    timeout: 15000,
    killSignal: 'SIGKILL',
    maxBuffer: 4 * 1024 * 1024,
  });
  cleanup.source = {
    pid: child.pid,
    status: child.status,
    signal: child.signal,
    error: child.error?.message,
    exited: child.status !== null || child.signal !== null,
  };
  commands.push({
    command: process.execPath,
    args,
    cwd: workspace,
    env: { PATH: '/usr/bin:/bin', TMPDIR: temporary },
    ...cleanup.source,
  });
  await writeFile(join(evidence, 'source.stdout'), child.stdout ?? '', { flag: 'wx' });
  await writeFile(join(evidence, 'source.stderr'), child.stderr ?? '', { flag: 'wx' });
  assert.ifError(child.error);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
  const source = JSON.parse(child.stdout);
  await json('source-result.json', source);
  result.phase = 'compare';
  const comparisons = groups.map((expected, index) => {
    const actual = source.groups[index];
    try {
      assert.deepEqual(actual, expected);
      return { name: expected.name, passed: true };
    } catch (error) {
      return { name: expected.name, passed: false, expected, actual, difference: error.message };
    }
  });
  await json('comparison.json', { comparisons, transport: source.transport });
  result.groups = comparisons.map(({ name, passed }) => ({ name, passed }));
  result.transportPassed = source.transport.passed;
  const first = comparisons.find((item) => !item.passed);
  if (first) result.firstFailure = { phase: 'compare', ...first };
  else if (!source.transport.passed)
    result.firstFailure = {
      phase: 'transport',
      checks: source.transport.checks.filter((item) => !item.passed),
    };
  assert.equal(
    result.firstFailure,
    null,
    'Production event semantics/public transfer disagree; see preserved first-failure.json and comparison.json. Stop for parent repair.',
  );
  result.state = 'passed';
} catch (error) {
  result.firstFailure ??= {
    phase: result.phase,
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) {
    try {
      await browser.close();
      cleanup.browserClosed = true;
    } catch (error) {
      cleanup.closeError = error.message;
      process.exitCode = 1;
    }
  }
  cleanup.browserProcesses = cleanup.browserProcesses.map((entry) => {
    try {
      process.kill(entry.pid, 0);
      return { ...entry, exited: false };
    } catch (error) {
      return { ...entry, exited: error.code === 'ESRCH' };
    }
  });
  await json('commands.json', commands);
  await json('cleanup.json', cleanup);
  await json('first-failure.json', result.firstFailure);
  await json('result.json', result);
  console.log(
    JSON.stringify({
      ...result,
      firstFailure: result.firstFailure
        ? { phase: result.firstFailure.phase, name: result.firstFailure.name }
        : null,
    }),
  );
}
