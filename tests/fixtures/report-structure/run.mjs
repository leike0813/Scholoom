import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.argv[2];
assert(root && resolve(root) === root, 'Supply a new dedicated absolute cache result directory');
await mkdir(root, { recursive: true });
const temporary = await mkdtemp(join(homedir(), '.cache/r2b-'));
await writeFile(join(root, 'short-tmpdir.txt'), temporary + '\n');
const env = {
  ...process.env,
  TMPDIR: temporary,
  DISPLAY: process.env.DISPLAY ?? ':99',
  SCHOOLOOM_UI_PORT: process.env.SCHOOLOOM_UI_PORT ?? '6193',
  SCHOOLOOM_UI_DATA_DIR: join(root, 'profile'),
  XDG_CONFIG_HOME: join(root, 'xdg-config'),
  SCHOOLOOM_REPORT_STRUCTURE_BUILD: join(root, 'built'),
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
function run(name, cmd, args) {
  const r = spawnSync(cmd, args, { env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const text = (r.stdout ?? '') + (r.stderr ?? '');
  return writeFile(join(root, name + '.log'), text).then(() => {
    console.log(name + ': ' + r.status);
    if (r.status !== 0) console.log(text.slice(-7000));
    assert.equal(r.status, 0, name);
  });
}
await run('display', 'xdpyinfo', ['-display', env.DISPLAY]);
await run('build', process.execPath, [
  'tests/fixtures/report-structure/build.ts',
  env.SCHOOLOOM_REPORT_STRUCTURE_BUILD,
]);
await run('types', process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '-p',
  'tests/fixtures/report-structure/tsconfig.json',
]);
await run('static-config', process.execPath, [
  '/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs',
  join(root, 'static.config.mts'),
]);
await writeFile(
  join(root, 'structure.config.mts'),
  `import base from './static.config.mts';\nexport default {...base,testDir:${JSON.stringify(resolve('tests/fixtures/report-structure'))},testMatch:'structure.spec.ts',outputDir:${JSON.stringify(join(root, 'results'))},reporter:[['list'],['json',{outputFile:${JSON.stringify(join(root, 'results.json'))}}]]};\n`,
);
await run('ui', process.execPath, [
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  join(root, 'structure.config.mts'),
]);
