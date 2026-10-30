import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

const root = resolve(
  '/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom',
  `run-${Date.now()}`,
);
console.log(`evidence: ${root}`);
await mkdir(join(root, 'tmp'), { recursive: true });
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(6309, '127.0.0.1', resolve);
});
await new Promise((resolve) => probe.close(resolve));
const env = {
  ...process.env,
  TMPDIR: join(root, 'tmp'),
  DISPLAY: ':99',
  SCHOOLOOM_UI_PORT: '6309',
  SCHOOLOOM_TEST_ROOT: process.cwd(),
  SCHOOLOOM_UI_DATA_DIR: join(root, 'kernel'),
  SCHOOLOOM_ASYNC_DOM_BUILD: join(root, 'built'),
  ELECTRON_OVERRIDE_DIST_PATH: resolve(
    'node_modules/.pnpm/electron@44.5.1/node_modules/electron/dist',
  ),
  ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
};
const commands = [];
async function run(name, command, args) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
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
  return result.status;
}
try {
  for (const [name, command, args] of [
    ['display', 'xdpyinfo', ['-display', ':99']],
    ['provenance', process.execPath, ['tests/fixtures/report-worker-dom/provenance.mjs', root]],
    [
      'build',
      process.execPath,
      ['tests/fixtures/report-async-dom/build.mjs', env.SCHOOLOOM_ASYNC_DOM_BUILD],
    ],
    [
      'types',
      process.execPath,
      [
        'node_modules/typescript/bin/tsc',
        '--noEmit',
        '-p',
        'tests/fixtures/report-async-dom/tsconfig.json',
      ],
    ],
    [
      'credits',
      process.execPath,
      [
        'tests/fixtures/report-async-dom/credits.mjs',
        env.SCHOOLOOM_ASYNC_DOM_BUILD,
        join(root, 'credits'),
      ],
    ],
  ])
    assert.equal(await run(name, command, args), 0, name);
  // Existing static UI/bootstrap entry; no Vite server or shared build.
  await writeFile(
    join(root, 'probe.config.mts'),
    `import base from ${JSON.stringify(resolve('playwright.ui.config.ts'))};
export default {...base,testDir:${JSON.stringify(resolve('tests/fixtures/report-async-dom'))},testMatch:'probe.spec.ts',outputDir:${JSON.stringify(join(root, 'results'))},reporter:[['list'],['json',{outputFile:${JSON.stringify(join(root, 'results.json'))}}]],retries:0,maxFailures:0,workers:1,globalTeardown:${JSON.stringify(resolve('tests/ui/teardown.ts'))},webServer:{...base.webServer,cwd:${JSON.stringify(process.cwd())},command:'node /home/joshua/.cache/scholoom-round13-acceptance/preserved-tmp/static-ui.mjs'}};
`,
  );
  const stage = process.argv[2] ?? 'baseline|unsupported';
  process.exitCode =
    (await run(stage.startsWith('race') ? 'races' : 'baseline', process.execPath, [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      join(root, 'probe.config.mts'),
      '--grep',
      stage,
    ])) ?? 1;
} finally {
  await writeFile(join(root, 'commands.json'), JSON.stringify(commands, null, 2));
}
