import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.ok(process.env.TMPDIR && isAbsolute(process.env.TMPDIR), 'Set a private TMPDIR first');
const root = resolve(process.argv[2]);
const source = dirname(fileURLToPath(import.meta.url));
const repository = resolve(source, '../../..');
const nativeSource = join(repository, 'packages/platform/native/isolated-report-scope.c');
const controller = readFileSync(nativeSource, 'utf8');
const begin = controller.indexOf('#define DENY ');
const end = controller.indexOf('\nstatic int children(', begin);
assert.ok(begin >= 0 && end > begin, 'Original policy extraction seam changed; review it');
const policy = controller.slice(begin, end);
const commands = [];
function run(command, args, env = process.env) {
  commands.push({ command, args, TMPDIR: env.TMPDIR });
  execFileSync(command, args, { stdio: 'inherit', env });
}
mkdirSync(root, { recursive: true });
writeFileSync(join(root, 'native-policy.h'), policy);
writeFileSync(
  join(root, 'fixture-config.h'),
  [
    ['PROBE_PATH', join(root, 'probe')],
    ['INPUT_PATH', join(root, 'approved.txt')],
    ['PERMIT_PATH', join(root, 'permit.fifo')],
    ['LOG_PATH', join(root, 'probe.log')],
  ]
    .map(([key, value]) => `#define ${key} ${JSON.stringify(value)}\n`)
    .join(''),
);
// Use the original fixture compiler/flags for its unchanged oracle as a build reference.
run(process.execPath, [join(source, '../isolated-report-native/rebuild.mjs')], {
  ...process.env,
  SCHOOLOOM_ISOLATION_TEST_CACHE: root,
});
const common = ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', '-static', '-fno-pie', '-no-pie'];
for (const [name, extra] of [
  ['gate', []],
  ['probe', ['-nostdlib', '-fno-stack-protector', '-fno-builtin', '-Wl,-e,_start']],
]) {
  run(process.env.CC ?? 'cc', [
    ...common,
    ...extra,
    '-I',
    root,
    join(source, `${name}.c`),
    '-o',
    join(root, name),
  ]);
}
const fingerprint = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputs = [
  nativeSource,
  join(source, '../isolated-report-native/probe.c'),
  ...['gate.c', 'probe.c', 'rebuild.mjs', 'selftest.mjs'].map((n) => join(source, n)),
];
const outputs = [
  'gate',
  'probe',
  'native-policy.h',
  'fixture-config.h',
  'isolated-report-native/probe',
].map((n) => join(root, n));
writeFileSync(
  join(root, 'build.json'),
  `${JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      node: process.version,
      commands,
      policySource: nativeSource,
      policyStartLine: controller.slice(0, begin).split('\n').length,
      files: [...inputs, ...outputs].map((path) => ({ path, sha256: fingerprint(path) })),
    },
    null,
    2,
  )}\n`,
);
console.log(join(root, 'build.json'));
