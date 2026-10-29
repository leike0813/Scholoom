// One-command owned fixture entry. Existing installed tools only; no product rebuild.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = process.argv[2];
assert(root && resolve(root) === root, 'Supply an absolute, new dedicated cache result directory');
await mkdir(root, { recursive: true });
const env = {
  ...process.env,
  TMPDIR: root,
  DISPLAY: process.env.DISPLAY ?? ':99',
  SCHOOLOOM_REPORT_SURFACE_BUILD: join(root, 'built'),
  SCHOOLOOM_UI_PORT: process.env.SCHOOLOOM_UI_PORT ?? '6183',
  SCHOOLOOM_UI_DATA_DIR: join(root, 'ui-profile'),
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
function run(name, command, args) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const text = (result.stdout ?? '') + (result.stderr ?? '');
  process.stdout.write(`${name}: exit ${result.status}\n`);
  if (result.status !== 0) process.stdout.write(text.slice(-8000));
  return writeFile(join(root, `${name}.log`), text).then(() => {
    assert.equal(result.status, 0, `${name} failed (see ${root})`);
  });
}
await run('display-preflight', 'xdpyinfo', ['-display', env.DISPLAY]);
await run('build', process.execPath, [
  'tests/fixtures/report-surface/build.ts',
  env.SCHOOLOOM_REPORT_SURFACE_BUILD,
]);
await run('types', process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '-p',
  'tests/fixtures/report-surface/tsconfig.json',
]);
await run('static-config', process.execPath, [
  '/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs',
  join(root, 'static.config.mts'),
]);
await writeFile(
  join(root, 'surface.config.mts'),
  `import base from './static.config.mts';\nexport default {...base,testDir:${JSON.stringify(resolve('tests/fixtures/report-surface'))},testMatch:'surface.spec.ts',outputDir:${JSON.stringify(join(root, 'results'))},reporter:[['list'],['json',{outputFile:${JSON.stringify(join(root, 'results.json'))}}]]};\n`,
);
await run('ui-first', process.execPath, [
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  join(root, 'surface.config.mts'),
]);
