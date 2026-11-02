import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const cache = join(homedir(), '.cache', 'scholoom-report-dom');
await mkdir(cache, { recursive: true });
const root = await mkdtemp(join(cache, 'program-'));
await mkdir(join(root, 'tmp'));
console.log(`evidence: ${root}`);
const server = createServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(6317, '127.0.0.1', resolve);
});
await new Promise((resolve, reject) =>
  server.close((error) => (error ? reject(error) : resolve())),
);
const staticUI = join(
  homedir(),
  '.cache',
  'scholoom-round13-acceptance/preserved-tmp/static-ui.mjs',
);
await access(staticUI);
await copyFile(staticUI, join(root, 'static-ui.snapshot.mjs'));
for (const name of [
  'source-driver.mjs',
  'program.spec.ts',
  'build.mjs',
  'run.mjs',
  'playwright.config.ts',
  'tsconfig.json',
  'README.md',
]) {
  await copyFile(join('tests/fixtures/report-program', name), join(root, name));
}
const env = {
  ...process.env,
  TMPDIR: join(root, 'tmp'),
  DISPLAY: ':99',
  SCHOOLOOM_UI_PORT: '6317',
  SCHOOLOOM_TEST_ROOT: process.cwd(),
  SCHOOLOOM_REPORT_PROGRAM_RUN: root,
  SCHOOLOOM_REPORT_DOM_BUILD: join(root, 'built'),
  SCHOOLOOM_UI_DATA_DIR: join(root, 'kernel'),
  SCHOOLOOM_STATIC_UI: staticUI,
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
const commands = [];
let enteredUI = false;
async function run(name, args, command = process.execPath) {
  const result = spawnSync(command, args, {
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 240000,
  });
  commands.push({
    name,
    command,
    args,
    exit: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  const log = (result.stdout ?? '') + (result.stderr ?? '');
  await writeFile(join(root, `${name}.log`), log);
  console.log(`${name}: exit ${result.status}`);
  if (result.status !== 0) console.log(log);
  return result.status;
}
try {
  assert.equal(await run('display', ['-display', ':99'], 'xdpyinfo'), 0);
  assert.equal(
    await run('build', ['tests/fixtures/report-program/build.mjs', env.SCHOOLOOM_REPORT_DOM_BUILD]),
    0,
  );
  assert.equal(
    await run('types', [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '-p',
      'tests/fixtures/report-program/tsconfig.json',
    ]),
    0,
  );
  enteredUI = true;
  process.exitCode =
    (await run('program', [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'tests/fixtures/report-program/playwright.config.ts',
      ...process.argv.slice(2),
    ])) ?? 1;
} finally {
  await writeFile(join(root, 'commands.json'), JSON.stringify(commands, null, 2));
  if (enteredUI) {
    const { runKernel } = await import('../../kernel-fixture.ts');
    const result = await runKernel(env.SCHOOLOOM_UI_DATA_DIR, 'stop');
    await writeFile(join(root, 'kernel-stop.json'), JSON.stringify(result, null, 2));
    assert.equal(result.state, 'stopped', 'Owned program fixture kernel did not stop');
  }
}
