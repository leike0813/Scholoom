import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import { encodeReportHeader } from '../../../packages/editor/dist/report-codec.js';
import { reportNodeTargets } from '../../../packages/protocol/dist/platform-isolation.js';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache', 'scholoom-report-program-files');
await mkdir(base, { recursive: true, mode: 0o700 });
const evidence = await mkdtemp(join(base, 'run-'));
const resources = join(evidence, 'resources');
const bundle = join(evidence, 'check.cjs');
const commands = [{ command: process.execPath, args: process.argv.slice(1), cwd: process.cwd() }];
const result = { state: 'failed', evidence, phase: 'prepare', firstFailure: null };
console.log(`Evidence: ${evidence}`);
const json = (name, value) =>
  writeFile(join(evidence, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const snapshot = async (file) => {
  const name = relative(workspace, resolve(workspace, file));
  assert(!name.startsWith('../') && !name.startsWith('/'));
  const target = join(evidence, 'sources', name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(workspace, name), target);
};
const run = async (name, command, args) => {
  const child = spawnSync(command, args, {
    cwd: workspace,
    env: { PATH: '/usr/bin:/bin', TMPDIR: evidence },
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    killSignal: 'SIGKILL',
  });
  commands.push({
    name,
    command,
    args,
    cwd: workspace,
    env: { PATH: '/usr/bin:/bin', TMPDIR: evidence },
    status: child.status,
    signal: child.signal,
    error: child.error?.message,
  });
  await writeFile(join(evidence, `${name}.stdout`), child.stdout ?? '', { flag: 'wx' });
  await writeFile(join(evidence, `${name}.stderr`), child.stderr ?? '', { flag: 'wx' });
  assert.ifError(child.error);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, `${name}: ${child.stderr}`);
  return child;
};

try {
  await json('instructions.json', {
    scope: [
      'tests/fixtures/report-program/files-check.mjs',
      'tests/fixtures/report-program/files-probe.mjs',
    ],
    boundary:
      'Trusted production Files module IO under ordinary-UID bwrap userns; no malicious-code, cross-UID or PID1 acceptance.',
    constraints: [
      'No production/root/OpenSpec/README/other fixture edits or rollback of concurrent work.',
      'No dependency changes, root, services, accounts, models, network, upstream downloads, /tmp or commits.',
      'No report JavaScript execution; no host-directory fallback when userns is unavailable.',
      'Only eight reportNodeTargets runtime files plus owned resources and bundle are mounted read-only; no whole lib, host, proc or sys mounts.',
    ],
    expected: [
      'Header codec and explicit synthetic project/library refs.',
      'Entry /resources/reports/entry.html; independent encoded entryURL and exact approved bytes/media.',
      'Literal a%2fb.js path uses a%252fb.js module URL; unapproved a%2fb.js URL refused.',
      'POSIX declaration normalization, unapproved HTTPS/file/node URLs and traversal refused.',
      'Preserved symlink refused with NOFOLLOW.',
      'Sparse dependency 8MiB+1 and entry 256KiB+1 refused; invalid UTF8 text refused.',
    ],
    untested: [
      'Total load capacity and all syntax variants',
      'UI, system services, malicious-code isolation, cross-UID, PID1 and complete source/host budgets',
    ],
  });
  for (const file of [
    'tests/fixtures/report-program/files-check.mjs',
    'tests/fixtures/report-program/files-probe.mjs',
    'packages/editor/dist/report-codec.js',
    'packages/protocol/src/platform-isolation.ts',
    'packages/protocol/dist/platform-isolation.js',
  ])
    await snapshot(file);
  assert(process.platform === 'linux' && process.arch === 'x64');
  assert(process.getuid() > 0 && process.getuid() === process.geteuid());
  await run('check-runner-syntax', process.execPath, [
    '--check',
    'tests/fixtures/report-program/files-check.mjs',
  ]);
  await run('check-probe-syntax', process.execPath, [
    '--check',
    'tests/fixtures/report-program/files-probe.mjs',
  ]);
  await mkdir(join(resources, 'reports'), { recursive: true });
  await mkdir(join(resources, 'assets', 'a'), { recursive: true });
  const dependency = (path, fileId, mediaType = 'text/javascript') => ({
    path,
    ref: { source: 'project', projectId: 'synthetic-project', fileId },
    basis: 'synthetic-v1',
    mediaType,
  });
  const manifest = {
    version: 1,
    resources: [
      dependency('../assets/source.js', 'source', 'application/javascript'),
      dependency('../assets/a%2fb.js', 'percent'),
      dependency('../assets/nested/../data.json', 'data', 'application/json'),
      dependency('../assets/invalid.js', 'invalid'),
    ],
    sources: [
      {
        ref: {
          source: 'library',
          attachmentId: 'synthetic-paper',
          materialVersionId: 'synthetic-version',
        },
        basis: 'synthetic-paper-basis',
      },
    ],
    objects: [
      {
        objectId: 'synthetic-result',
        name: '合成结果',
        semantics: 'Only synthetic source metadata',
        sourceIndexes: [0],
      },
    ],
  };
  const expected = {
    entryURL: 'scholoom-report://local/reports/entry.html',
    html: '<main>可信文件 IO 样本</main>',
    manifest,
    source: {
      url: 'scholoom-report://local/assets/source.js',
      text: "export const label = '原始字节 😀';\r\n",
    },
    percent: {
      url: 'scholoom-report://local/assets/a%252fb.js',
      text: "export const literal = 'percent filename';\n",
    },
    json: { url: 'scholoom-report://local/assets/data.json', text: '{"title":"合成数据"}\n' },
    invalid: { url: 'scholoom-report://local/assets/invalid.js' },
  };
  const asset = (name, bytes) =>
    writeFile(join(resources, name), bytes, { flag: 'wx', mode: 0o400 });
  const entry = (name, value = manifest) =>
    asset(`reports/${name}`, `${encodeReportHeader(value)}<!doctype html>${expected.html}`);
  await asset('expected.json', `${JSON.stringify(expected, null, 2)}\n`);
  await asset('assets/source.js', expected.source.text);
  await asset('assets/a%2fb.js', expected.percent.text);
  await asset('assets/a/b.js', 'This different path is not approved.\n');
  await asset('assets/undeclared.js', 'This actual file is not declared.\n');
  await asset('assets/data.json', expected.json.text);
  await asset('assets/invalid.js', Buffer.from([0x61, 0xc3, 0x28]));
  await symlink('source.js', join(resources, 'assets/link.js'));
  await entry('entry.html');
  await entry('入口 space.html');
  for (const [name, path] of [
    ['escape.html', '../../escape.js'],
    ['symlink.html', '../assets/link.js'],
    ['oversize-dependency.html', '../assets/oversize.js'],
  ]) {
    await entry(name, { ...manifest, resources: [dependency(path, name)] });
  }
  for (const [name, size] of [
    ['assets/oversize.js', 8 * 1024 * 1024 + 1],
    ['reports/oversize.html', 256 * 1024 + 1],
  ]) {
    const handle = await open(join(resources, name), 'wx', 0o400);
    try {
      await handle.truncate(size);
    } finally {
      await handle.close();
    }
  }
  result.phase = 'build';
  const built = await build({
    absWorkingDir: workspace,
    entryPoints: ['tests/fixtures/report-program/files-probe.mjs'],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    sourcemap: true,
    metafile: true,
    write: false,
    logLevel: 'silent',
  });
  await json('build.json', {
    entry: 'tests/fixtures/report-program/files-probe.mjs',
    outfile: bundle,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    bundle: true,
    warnings: built.warnings,
    metafile: built.metafile,
  });
  for (const file of built.outputFiles)
    await writeFile(file.path, file.contents, { flag: 'wx', mode: 0o400 });
  for (const file of Object.keys(built.metafile.inputs)) await snapshot(file);
  result.phase = 'runtime-files';
  assert.equal(reportNodeTargets.length, 8);
  assert.equal(reportNodeTargets[0], '/runtime/node');
  const runtime = [];
  for (const target of reportNodeTargets) {
    const source = await realpath(
      target === '/runtime/node'
        ? '/opt/scholoom-report-29a5b38a-e034-433f-989c-bf7b19a4140f/node'
        : target,
    );
    const info = await lstat(source);
    assert(info.isFile() && info.uid === 0 && !(info.mode & 0o022));
    runtime.push({ source, target, uid: info.uid, mode: info.mode, size: info.size });
  }
  await json('mounts.json', { runtime, resources, bundle });
  const mounts = [
    '--unshare-all',
    '--die-with-parent',
    '--new-session',
    '--cap-drop',
    'ALL',
    '--clearenv',
    '--dir',
    '/runtime',
    '--dir',
    '/lib64',
    '--dir',
    '/lib/x86_64-linux-gnu',
    ...runtime.flatMap(({ source, target }) => ['--ro-bind', source, target]),
    '--ro-bind',
    resources,
    '/resources',
    '--ro-bind',
    bundle,
    '/check.cjs',
    '--remount-ro',
    '/',
    '--chdir',
    '/resources',
    '--',
    '/runtime/node',
  ];
  result.phase = 'userns-precondition';
  await run('userns-precondition', '/usr/bin/bwrap', [
    ...mounts,
    '-e',
    'console.log(JSON.stringify({node:process.version,cwd:process.cwd(),uid:process.getuid(),env:process.env}))',
  ]);
  result.phase = 'files-probe';
  const probe = await run('files-probe', '/usr/bin/bwrap', [...mounts, '/check.cjs']);
  const summary = JSON.parse(probe.stdout.trim().split('\n').at(-1));
  assert.equal(summary.state, 'passed');
  assert.equal(summary.passed.length, 9);
  result.state = 'passed';
  result.passed = summary.passed;
} catch (error) {
  result.state =
    result.phase === 'userns-precondition' || result.phase === 'runtime-files'
      ? 'blocked'
      : 'failed';
  result.firstFailure = {
    phase: result.phase,
    name: error.name,
    code: error.code,
    message: error.message,
    stack: error.stack,
  };
  console.error(error);
  process.exitCode = 1;
} finally {
  await json('commands.json', commands);
  await json('result.json', result);
  await json('firstFailure.json', result.firstFailure);
  console.log(JSON.stringify(result));
}
