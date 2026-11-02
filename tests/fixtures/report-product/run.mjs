import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadReportInstallation } from '../../../apps/kernel/dist/report-installation.js';

assert(
  process.argv.length >= 3 && process.argv.length <= 4,
  'Supply installed.json [product|selection|lifecycle]',
);
const scenario = process.argv[3] ?? 'product';
assert(['product', 'selection', 'lifecycle'].includes(scenario), 'Unknown product scenario');
const installationFile = resolve(process.argv[2]);
const cache = join(homedir(), '.cache', 'scholoom-report-product');
await mkdir(cache, { recursive: true, mode: 0o700 });
const root = await mkdtemp(join(cache, 'run-'));
console.log(`Evidence: ${root}`);
const directory = join(root, 'kernel');
await mkdir(directory, { mode: 0o700 });
await mkdir(join(root, 'tmp'), { mode: 0o700 });
await writeFile(
  join(directory, 'host-settings.json'),
  JSON.stringify({
    version: 1,
    kernelDirectory: await realpath(directory),
    zotero: { enabled: false },
    reports: { installationFile },
  }),
  { mode: 0o600, flag: 'wx' },
);
const commands = [];
let phase = 'installation';
try {
  assert(await loadReportInstallation(directory));
  phase = 'port';
  const probe = createServer();
  await new Promise((yes, no) => {
    probe.once('error', no);
    probe.listen(6341, '127.0.0.1', yes);
  });
  await new Promise((yes) => probe.close(yes));
  const env = {
    ...process.env,
    TMPDIR: join(root, 'tmp'),
    DISPLAY: process.env.DISPLAY ?? ':99',
    SCHOOLOOM_UI_PORT: '6341',
    SCHOOLOOM_REPORT_PRODUCT_RUN: root,
    SCHOOLOOM_REPORT_PRODUCT_SCENARIO: scenario,
    SCHOOLOOM_UI_DATA_DIR: directory,
    ELECTRON_OVERRIDE_DIST_PATH: resolve(
      'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
    ),
    ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
  };
  phase = 'product';
  const args = [
    'node_modules/@playwright/test/cli.js',
    'test',
    '--config',
    'tests/fixtures/report-product/playwright.config.ts',
  ];
  const result = spawnSync(process.execPath, args, {
    env,
    encoding: 'utf8',
    timeout: 420_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  commands.push({
    command: process.execPath,
    args,
    exit: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  await writeFile(join(root, 'product.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  console.log((result.stdout ?? '') + (result.stderr ?? ''));
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  phase = 'passed';
} finally {
  await writeFile(
    join(root, 'commands.json'),
    JSON.stringify({ phase, scenario, installationFile, commands }, null, 2),
  );
}
