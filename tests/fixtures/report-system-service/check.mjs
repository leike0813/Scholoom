import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { layout, reportNotices, unitTexts } from './layout.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const base = join(homedir(), '.cache', 'scholoom-report-system-service');
mkdirSync(base, { recursive: true, mode: 0o700 });
const evidence = mkdtempSync(join(base, 'offline-'));
function run(file, args, env = {}) {
  const result = spawnSync(file, args, {
    cwd: repo,
    env: { ...process.env, TMPDIR: evidence, ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

for (const [label, args] of [
  ['native', []],
  ['node', ['--node']],
  ['report', ['--report']],
])
  test(`${label} service bundle is reviewable offline and refuses ordinary-UID installation`, () => {
    assert(process.getuid() > 0);
    const prepared = run(process.execPath, [
      'tests/fixtures/report-system-service/prepare.mjs',
      ...args,
    ]);
    assert.equal(prepared.status, 0, prepared.stderr);
    const manifest = prepared.stdout.trim().split('\n').at(-1),
      bundle = dirname(manifest);
    const plan = JSON.parse(readFileSync(manifest, 'utf8')),
      p = layout(plan);
    assert.equal(plan.program, label === 'report' ? 'scholoom-interactive-report' : undefined);
    assert.equal(plan.runtime, label === 'native' ? undefined : 'node');
    if (label === 'report') {
      assert.deepEqual(
        readFileSync(join(bundle, 'program.bin')),
        readFileSync(join(repo, 'packages/editor/dist/report-program.cjs')),
      );
      for (const name of reportNotices) {
        assert(Object.hasOwn(plan.files, `licenses/${name}`));
        assert.deepEqual(
          readFileSync(join(bundle, 'licenses', name)),
          readFileSync(join(repo, 'packages/editor/dist/report-runtime', name)),
        );
      }
    }
    const listed = run(process.execPath, [join(bundle, 'install.mjs'), manifest]);
    assert.equal(listed.status, 0, listed.stderr);
    const listedPlan = JSON.parse(listed.stdout);
    assert.deepEqual(listedPlan.start, [p.controlSocket, p.managerSocket]);
    assert.equal(
      listedPlan.registration.programId,
      label === 'report' ? 'scholoom-interactive-report' : `fixed-${label}-t1`,
    );
    assert.equal(listedPlan.registration.policy.runtimeMs, label === 'report' ? 28800000 : 20000);
    assert.equal(
      listedPlan.registration.policy.profile,
      label === 'native' ? 'linux-x64-system-v1' : 'linux-x64-node-v1',
    );
    const denied = run(process.execPath, [join(bundle, 'install.mjs'), manifest, '--apply']);
    assert.notEqual(denied.status, 0);
    assert(denied.stderr.includes('AssertionError'));
    const unprotected = join(evidence, `${label}-unprotected.json`);
    writeFileSync(
      unprotected,
      JSON.stringify({
        kernelUid: process.getuid(),
        managerSocket: join(p.runtime, 'manager.sock'),
      }),
    );
    const role = run(process.execPath, [join(bundle, 'service.mjs'), '--control', unprotected]);
    assert.notEqual(role.status, 0);
    assert.equal(JSON.parse(role.stderr).code, 'unavailable');
    const client = run(process.execPath, [join(bundle, 'acceptance.mjs'), unprotected]);
    assert.notEqual(client.status, 0);
    assert(client.stderr.includes('authenticationFailed'));
    writeFileSync(join(evidence, `${label}-bundle-path.txt`), `${manifest}\n`);
    writeFileSync(
      join(evidence, `${label}-commands.json`),
      JSON.stringify({ prepared, listed, denied, role, client }, null, 2),
    );
    for (const [name, text] of unitTexts(plan, 60000, 60000)) {
      // Only the substitute executable path changes for offline syntax validation.
      writeFileSync(join(evidence, name), text.replaceAll(p.programs, bundle));
    }
    const syntax = run('/usr/bin/systemd-analyze', [
      'verify',
      ...[...unitTexts(plan, 60000, 60000).keys()].map((name) => join(evidence, name)),
    ]);
    writeFileSync(join(evidence, `${label}-unit-syntax.json`), JSON.stringify(syntax, null, 2));
    assert.equal(syntax.status, 0, syntax.stderr);
    console.log(`Evidence: ${evidence}`);
  });

test('installation roles reject injected names, root/shared control identities and invalid host accounts', () => {
  const plan = {
    installId: '11111111-2222-4333-8444-555555555555',
    kernelUid: process.getuid(),
    kernelGid: process.getgid(),
  };
  for (const installId of ['../unit', `${plan.installId}\nExecStart=/bin/true`])
    assert.throws(() => layout({ ...plan, installId }));
  for (const controlUid of [0, plan.kernelUid, -1, NaN])
    assert.throws(() => unitTexts(plan, controlUid, 60000));
  assert.throws(() => layout({ ...plan, kernelUid: 0 }));
});
