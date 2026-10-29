import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.argv[2];
assert(root && resolve(root) === root, 'Supply a new absolute cache directory');
await mkdir(root, { recursive: true });
const temporary = await mkdtemp(join(homedir(), '.cache/r2c-'));
await writeFile(join(root, 'short-tmpdir.txt'), `${temporary}\n`);
const env = {
  ...process.env,
  TMPDIR: temporary,
  DISPLAY: process.env.DISPLAY ?? ':99',
  SCHOOLOOM_UI_PORT: process.env.SCHOOLOOM_UI_PORT ?? '6203',
  SCHOOLOOM_UI_DATA_DIR: join(root, 'kernel'),
  SCHOOLOOM_REPORT_INPUT_BUILD: join(root, 'built'),
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
async function run(name, command, args) {
  const r = spawnSync(command, args, { env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const body = (r.stdout ?? '') + (r.stderr ?? '');
  await writeFile(join(root, `${name}.log`), body);
  console.log(`${name}: ${r.status}`);
  if (r.status !== 0) console.log(body.slice(-8000));
  assert.equal(r.status, 0, name);
}
await run('display', 'xdpyinfo', ['-display', env.DISPLAY]);
await run('build', process.execPath, [
  'tests/fixtures/report-input/build.ts',
  env.SCHOOLOOM_REPORT_INPUT_BUILD,
]);
await run('types', process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '-p',
  'tests/fixtures/report-input/tsconfig.json',
]);
await run('static-config', process.execPath, [
  '/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs',
  join(root, 'static.config.mts'),
]);
await writeFile(
  join(root, 'input.config.mts'),
  `import base from './static.config.mts';\nexport default {...base,testDir:${JSON.stringify(resolve('tests/fixtures/report-input'))},testMatch:'input.spec.ts',outputDir:${JSON.stringify(join(root, 'results'))},reporter:[['list'],['json',{outputFile:${JSON.stringify(join(root, 'results.json'))}}]]};\n`,
);
await run('ui', process.execPath, [
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  join(root, 'input.config.mts'),
]);
