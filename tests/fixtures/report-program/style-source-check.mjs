import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from '../../../packages/editor/node_modules/esbuild/lib/main.js';
import { generate, parse } from '../../../packages/editor/node_modules/css-tree/lib/index.js';
import { reportSourceBuildOptions } from '../../../packages/editor/report/build-options.mjs';
import { runStyleCases } from './style-source-cases.mjs';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache/scholoom-style-source');
await mkdir(base, { recursive: true, mode: 0o700 });
const evidence = await mkdtemp(join(base, 'run-'));
const temporary = join(evidence, 'temporary');
await mkdir(temporary);
const env = { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary };
const save = (name, value) => writeFile(join(evidence, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const result = { state: 'failed', evidence, phase: 'build', firstFailure: null };
const cleanup = { browserClosed: false, browserProcesses: [], source: null };
let browser;
console.log(`Evidence: ${evidence}`);
try {
  const outfile = join(evidence, 'source.mjs');
  const built = await build({
    absWorkingDir: workspace,
    entryPoints: ['tests/fixtures/report-program/style-source-driver.mjs'],
    outfile, bundle: true, platform: 'node', format: 'esm', target: 'node24',
    ...reportSourceBuildOptions,
    define: { ...reportSourceBuildOptions.define, DEBUG: 'false' },
    sourcemap: true, metafile: true, write: false, logLevel: 'silent',
  });
  for (const file of built.outputFiles) await writeFile(file.path, file.contents, { flag: 'wx' });
  await save('build.json', { warnings: built.warnings, metafile: built.metafile });
  const files = new Set([...Object.keys(built.metafile.inputs), 'tests/fixtures/report-program/style-source-check.mjs']);
  for (const file of files) {
    assert(!file.startsWith('../') && !file.startsWith('/'));
    const target = join(evidence, 'sources', file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(workspace, file), target);
  }
  result.phase = 'native oracle';
  browser = await chromium.launch({ headless: true, timeout: 15000, env,
    args: ['--disable-background-networking', '--disable-component-update', '--disable-dev-shm-usage', '--no-proxy-server'] });
  const cdp = await browser.newBrowserCDPSession();
  const version = await cdp.send('Browser.getVersion');
  const context = await browser.newContext({ offline: true, serviceWorkers: 'block' });
  const requests = [];
  await context.route('**/*', (route) => { requests.push(route.request().url()); return route.abort(); });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<!doctype html><title>Fixed synthetic CSS declaration oracle</title>');
  await writeFile(join(evidence, 'native-scenario.js'), `(${runStyleCases.toString()})(document)`, { flag: 'wx' });
  const native = await page.evaluate(`(${runStyleCases.toString()})(document)`);
  // Reparse serialization in the independent browser, comparing observable fields and property order.
  const nativeRoundtrip = await page.evaluate((groups) => groups.map((group) => group.steps.map((step) => {
    const style = document.createElement('div').style;
    style.cssText = step.cssText;
    return { order: Array.from(style), properties: step.properties.map(({key}) => ({key, value: style.getPropertyValue(key), priority: style.getPropertyPriority(key)})) };
  })), native);
  await save('native.json', { version, groups: native, roundtrip: nativeRoundtrip, requests, errors });
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  result.phase = 'source runtime';
  const child = spawnSync(process.execPath, ['--enable-source-maps', outfile], {
    cwd: workspace, env, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 1048576,
  });
  cleanup.source = { pid: child.pid, status: child.status, signal: child.signal, error: child.error?.message };
  await writeFile(join(evidence, 'source.stdout'), child.stdout ?? '', { flag: 'wx' });
  await writeFile(join(evidence, 'source.stderr'), child.stderr ?? '', { flag: 'wx' });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  const source = JSON.parse(child.stdout);
  await save('source.json', source);
  result.phase = 'compare';
  const canonicalValue = (value) => value === '' ? '' : generate(parse(value, { context: 'value', parseCustomProperty: true }));
  const canonical = (properties) => properties.map(({key, value, priority}) => ({key, value: canonicalValue(value), priority}));
  const sourceRoundtrip = await page.evaluate((groups) => groups.map((group) => group.steps.map((step) => {
    const style = document.createElement('div').style;
    style.cssText = step.cssText;
    return { order: Array.from(style), properties: step.properties.map(({key}) => ({key, value: style.getPropertyValue(key), priority: style.getPropertyPriority(key)})) };
  })), source.groups);
  cleanup.browserProcesses = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(({ id, type }) => ({ pid: id, type }));
  await save('source-roundtrip.json', sourceRoundtrip);
  assert(source.groups.length > 0);
  assert.equal(source.groups.length, native.length);
  for (let i = 0; i < native.length; i++) {
    assert.equal(source.groups[i].name, native[i].name);
    assert.equal(source.groups[i].steps.length, native[i].steps.length);
    for (let j = 0; j < native[i].steps.length; j++) {
      result.case = `${native[i].name}/${j}`;
      const actual = source.groups[i].steps[j];
      const expected = native[i].steps[j];
      assert.equal(canonicalValue(actual.returned ?? ''), canonicalValue(expected.returned ?? ''), result.case);
      assert.deepEqual(canonical(actual.properties), canonical(expected.properties), result.case);
      assert.deepEqual(sourceRoundtrip[i][j].order, nativeRoundtrip[i][j].order, result.case);
      assert.deepEqual(canonical(sourceRoundtrip[i][j].properties), canonical(nativeRoundtrip[i][j].properties), result.case);
    }
  }
  result.groups = native.map(({name}) => name);
  result.limits = source.limits;
  result.singleReplacementMutation = source.singleReplacementMutation;
  result.state = 'passed';
} catch (error) {
  result.firstFailure = { phase: result.phase, case: result.case, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (browser) { await browser.close(); cleanup.browserClosed = true; }
  for (const entry of cleanup.browserProcesses) {
    try { process.kill(entry.pid, 0); entry.exited = false; }
    catch (error) { entry.exited = error.code === 'ESRCH'; }
  }
  await save('cleanup.json', cleanup);
  await save('first-failure.json', result.firstFailure);
  await save('result.json', result);
  console.log(JSON.stringify(result));
}
