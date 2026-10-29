import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.argv[2];
assert(root && resolve(root) === root, 'Supply a new absolute cache result directory');
await mkdir(root, { recursive: true });
const temporary = await mkdtemp(join(homedir(), '.cache/lc20-'));
const env = {
  ...process.env,
  TMPDIR: temporary,
  DISPLAY: process.env.DISPLAY ?? ':99',
  SCHOOLOOM_UI_PORT: process.env.SCHOOLOOM_UI_PORT ?? '6211',
  SCHOOLOOM_UI_DATA_DIR: join(root, 'kernel-profile'),
  SCHOOLOOM_REPORT_LIFECYCLE_BUILD: join(root, 'built'),
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
await writeFile(
  join(root, 'temporary.json'),
  JSON.stringify(
    {
      TMPDIR: temporary,
      DISPLAY: env.DISPLAY,
      port: env.SCHOOLOOM_UI_PORT,
      profile: env.SCHOOLOOM_UI_DATA_DIR,
    },
    null,
    2,
  ),
);
const commands = [];
async function run(name, cmd, args) {
  const result = spawnSync(cmd, args, { env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  await writeFile(join(root, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
  commands.push({
    name,
    cwd: process.cwd(),
    argv: [cmd, ...args],
    code: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  await writeFile(join(root, 'commands.json'), JSON.stringify(commands, null, 2));
  console.log(`${name}: ${result.status}`);
  if (result.status !== 0)
    console.log(((result.stdout ?? '') + (result.stderr ?? '')).slice(-8000));
  assert.equal(result.status, 0, name);
}
await run('display', 'xdpyinfo', ['-display', env.DISPLAY]);
await run('build', process.execPath, [
  'tests/fixtures/report-lifecycle/build.ts',
  env.SCHOOLOOM_REPORT_LIFECYCLE_BUILD,
]);
await run('types', process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '-p',
  'tests/fixtures/report-lifecycle/tsconfig.json',
]);
await run('tools', process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '-p',
  'tsconfig.tools.json',
]);
await run('static-config', process.execPath, [
  '/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs',
  join(root, 'static.config.mts'),
]);
await writeFile(
  join(root, 'ui.config.mts'),
  `import base from './static.config.mts';\nexport default {...base,outputDir:${JSON.stringify(join(root, 'results'))},reporter:[['list'],['json',{outputFile:${JSON.stringify(join(root, 'results.json'))}}]]};\n`,
);
await run('ui', process.execPath, [
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  join(root, 'ui.config.mts'),
  'tests/ui/report-lifecycle.spec.ts',
]);
