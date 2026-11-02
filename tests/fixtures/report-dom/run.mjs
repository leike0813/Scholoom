import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const cache = join(homedir(), '.cache', 'scholoom-report-dom');
await mkdir(cache, { recursive: true });
const root = await mkdtemp(join(cache, 'run-'));
await mkdir(join(root, 'tmp'));
console.log(`evidence: ${root}`);
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(6313, '127.0.0.1', resolve);
});
await new Promise((resolve) => probe.close(resolve));
const env = {
  ...process.env,
  TMPDIR: join(root, 'tmp'),
  DISPLAY: ':99',
  SCHOOLOOM_UI_PORT: '6313',
  SCHOOLOOM_TEST_ROOT: process.cwd(),
  SCHOOLOOM_REPORT_DOM_RUN: root,
  SCHOOLOOM_UI_DATA_DIR: join(root, 'kernel'),
  SCHOOLOOM_REPORT_DOM_BUILD: join(root, 'built'),
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
const commands = [];
async function run(name, command, args) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  commands.push({
    name,
    command,
    args,
    exit: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  await writeFile(join(root, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
  console.log(`${name}: exit ${result.status}`);
  if (result.status !== 0) console.log((result.stdout ?? '') + (result.stderr ?? ''));
  return result.status;
}
try {
  assert.equal(await run('display', 'xdpyinfo', ['-display', ':99']), 0);
  assert.equal(
    await run('build', process.execPath, [
      'tests/fixtures/report-dom/build.mjs',
      env.SCHOOLOOM_REPORT_DOM_BUILD,
    ]),
    0,
  );
  assert.equal(
    await run('types', process.execPath, [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '-p',
      'tests/fixtures/report-dom/tsconfig.json',
    ]),
    0,
  );
  process.exitCode =
    (await run('behaviors', process.execPath, [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'tests/fixtures/report-dom/playwright.config.ts',
      ...process.argv.slice(2),
    ])) ?? 1;
} finally {
  await writeFile(join(root, 'commands.json'), JSON.stringify(commands, null, 2));
}
