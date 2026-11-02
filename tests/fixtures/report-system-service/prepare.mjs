import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import { reportNodeTargets } from '../../../packages/protocol/dist/platform-isolation.js';
import { layout, reportNotices, reportRegistration, unitTexts } from './layout.mjs';

assert(process.platform === 'linux' && process.arch === 'x64' && process.getuid() > 0);
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const interactive = process.argv[2] === '--report';
const nodeProfile = interactive || process.argv[2] === '--node';
assert.equal(process.argv.length, nodeProfile ? 3 : 2);
const runtimeNames = nodeProfile
  ? reportNodeTargets.slice(1).map((target) => basename(target))
  : [];
const cache = join(homedir(), '.cache', 'scholoom-report-system-service');
mkdirSync(cache, { recursive: true, mode: 0o700 });
const bundle = mkdtempSync(join(cache, 'bundle-'));
const plan = {
  installId: randomUUID(),
  kernelUid: process.getuid(),
  kernelGid: process.getgid(),
  files: {},
  ...(nodeProfile ? { runtime: 'node', runtimeNames } : {}),
  ...(interactive ? { program: 'scholoom-interactive-report' } : {}),
};
const env = { ...process.env, TMPDIR: bundle };
await build({
  entryPoints: [join(repo, 'apps/kernel/src/report-system-entry.ts')],
  outfile: join(bundle, 'service.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  banner: {
    js: "import {createRequire as reportCreateRequire} from 'node:module'; const require = reportCreateRequire(import.meta.url);",
  },
});
await build({
  entryPoints: [fileURLToPath(new URL('run.mjs', import.meta.url))],
  outfile: join(bundle, 'acceptance.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  banner: {
    js: "import {createRequire as reportCreateRequire} from 'node:module'; const require = reportCreateRequire(import.meta.url);",
  },
});
execFileSync(
  process.execPath,
  [
    join(repo, 'packages/platform/build-report-system.mjs'),
    '/usr',
    join(bundle, 'report-system'),
    join(bundle, 'isolated-report-system'),
  ],
  { cwd: repo, env, stdio: 'inherit' },
);
let probe;
if (interactive) {
  execFileSync(process.execPath, [join(repo, 'packages/editor/build-reports.mjs')], {
    cwd: repo,
    env,
    stdio: 'inherit',
  });
  probe = join(repo, 'packages/editor/dist/report-program.cjs');
  mkdirSync(join(bundle, 'licenses'), { mode: 0o700 });
  for (const name of reportNotices)
    copyFileSync(
      join(repo, 'packages/editor/dist/report-runtime', name),
      join(bundle, 'licenses', name),
      1,
    );
} else if (nodeProfile) {
  probe = join(bundle, 'node-program.cjs');
  await build({
    entryPoints: [fileURLToPath(new URL('./node-program.mjs', import.meta.url))],
    outfile: probe,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
  });
} else
  probe = execFileSync(
    process.execPath,
    [join(repo, 'tests/fixtures/isolated-report-native/rebuild.mjs')],
    { cwd: repo, env, encoding: 'utf8' },
  ).trim();
for (const [source, name] of [
  [process.execPath, 'node'],
  [probe, 'program.bin'],
  ...['isolated-report-scope', 'isolated-report-gate', 'report-channel'].map((name) => [
    join(repo, 'packages/platform/dist', name),
    name,
  ]),
  ...['install.mjs', 'layout.mjs'].map((name) => [
    join(dirname(fileURLToPath(import.meta.url)), name),
    name,
  ]),
])
  copyFileSync(source, join(bundle, name), 1);
for (const name of runtimeNames)
  copyFileSync(join('/usr/lib/x86_64-linux-gnu', name), join(bundle, name), 1);
for (const name of [
  'node',
  'service.mjs',
  'acceptance.mjs',
  'program.bin',
  'isolated-report-system',
  'report-system',
  'isolated-report-scope',
  'isolated-report-gate',
  'report-channel',
  ...runtimeNames,
  ...(interactive ? reportNotices.map((name) => `licenses/${name}`) : []),
])
  plan.files[name] = createHash('sha256')
    .update(readFileSync(join(bundle, name)))
    .digest('hex');
writeFileSync(join(bundle, 'bundle.json'), `${JSON.stringify(plan, null, 2)}\n`, {
  flag: 'wx',
  mode: 0o600,
});
const p = layout(plan);
writeFileSync(
  join(bundle, 'review.json'),
  JSON.stringify(
    {
      ...p,
      registration: reportRegistration(plan),
      boundary: interactive
        ? 'registered generic HTML/JS P; synthetic K/C/M bootstrap acceptance, not UI or full I5'
        : nodeProfile
          ? 'fixed Node/data K/C/M; no arbitrary HTML/UI/model'
          : 'fixed static native T1; no HTML/JS/UI/model',
      actions: `create one dedicated system account, root-owned programs and four persistent socket/service units; C provisions original records; start two sockets without enable; drop to K for one ${interactive ? 'generic bootstrap' : 'fixed T1'} attempt (${interactive ? '8h' : '20s'} PID1 runtime, no automatic retry)`,
      units: [...unitTexts(plan, 60000, 60000)],
    },
    null,
    2,
  ),
);
console.log(join(bundle, 'bundle.json'));
