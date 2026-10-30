import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2]);
assert(root.startsWith('/home/joshua/.cache/'));
await mkdir(root, { recursive: true });
const temporary = await mkdtemp('/home/joshua/.cache/wd-');
await writeFile(join(root, 'tmpdir.txt'), temporary);
const env = {
  ...process.env,
  TMPDIR: temporary,
  DISPLAY: ':99',
  SCHOOLOOM_UI_PORT: process.env.SCHOOLOOM_UI_PORT ?? '6259',
  SCHOOLOOM_UI_DATA_DIR: join(root, 'kernel'),
  SCHOOLOOM_WORKER_DOM_BUILD: join(root, 'built'),
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
const commands = [];
function run(name, command, args) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  commands.push({
    name,
    command,
    args,
    exit: result.status,
    signal: result.signal,
    error: result.error?.message,
  });
  return writeFile(join(root, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? '')).then(
    () => {
      console.log(`${name}: exit ${result.status}`);
      return result.status;
    },
  );
}
try {
  for (const [name, command, args] of [
    ['display', 'xdpyinfo', ['-display', ':99']],
    ['provenance', process.execPath, ['tests/fixtures/report-worker-dom/provenance.mjs', root]],
    [
      'build',
      process.execPath,
      ['tests/fixtures/report-worker-dom/build.mjs', env.SCHOOLOOM_WORKER_DOM_BUILD],
    ],
    [
      'types',
      process.execPath,
      [
        'node_modules/typescript/bin/tsc',
        '--noEmit',
        '-p',
        'tests/fixtures/report-worker-dom/tsconfig.json',
      ],
    ],
    [
      'static-config',
      process.execPath,
      [
        '/home/joshua/.cache/scholoom-round13-acceptance/create-ui-config.mjs',
        join(root, 'static.config.mts'),
      ],
    ],
  ])
    assert.equal(await run(name, command, args), 0, name);
  await writeFile(
    join(root, 'probe.config.mts'),
    `import base from './static.config.mts';\nexport default {...base,testDir:${JSON.stringify(resolve('tests/fixtures/report-worker-dom'))},testMatch:'probe.spec.ts',outputDir:${JSON.stringify(join(root, 'results'))},reporter:[['list'],['json',{outputFile:${JSON.stringify(join(root, 'results.json'))}}]],retries:0,maxFailures:0,workers:1};\n`,
  );
  process.exitCode =
    (await run('ui', process.execPath, [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      join(root, 'probe.config.mts'),
    ])) ?? 1;
} finally {
  await writeFile(join(root, 'commands.json'), JSON.stringify(commands, null, 2));
}
