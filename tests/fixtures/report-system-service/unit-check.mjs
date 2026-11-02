import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { systemReportUnitTexts } from '../../../packages/platform/dist/system-report-unit.js';
import { reportNodeTargets } from '../../../packages/protocol/dist/platform-isolation.js';

test('dynamic report units parse with ordinary and escaped OpenFile paths', async (t) => {
  assert.notEqual(process.getuid(), 0);
  assert.notEqual(process.geteuid(), 0);
  const base = join(homedir(), '.cache', 'scholoom-report-system-service');
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const evidence = mkdtempSync(join(base, 'unit-check-'));
  t.diagnostic(`Parse-only evidence; /bin/true substitutes for the launcher: ${evidence}`);
  const input = {
    configId: randomUUID(),
    storageId: randomUUID(),
    programId: 'fixed',
    programVersion: 'program-3',
    policyId: 'fixed',
    policyVersion: 'policy-2',
    assets: 2,
    inputs: {
      bootId: randomUUID(),
      manifest: '31:712:500:100:100',
      permit: { dev: '32', ino: '32001' },
      events: { dev: '32', ino: '32002' },
      stdout: { dev: '32', ino: '32003' },
      stderr: { dev: '32', ino: '32004' },
    },
  };
  const config = {
    launcher: '/bin/true',
    controlUid: process.getuid(),
    policy: {
      id: 'fixed',
      version: 'policy-2',
      profile: 'linux-x64-system-v1',
      cpuPercent: 20,
      memoryBytes: 67108864,
      swapBytes: 0,
      tasks: 16,
      outputBytes: 1048576,
      runtimeMs: 30000,
      stopGraceMs: 200,
    },
  };
  for (const [label, slotName] of [
    ['ordinary', 'slot'],
    ['escaped', 'slot with spaces:100%\\"quoted'],
    ['node', 'node-slot'],
    ['node-escaped', 'node slot:100%\\"quoted'],
  ]) {
    await t.test(label, () => {
      const directory = join(evidence, label);
      const slot = join(directory, slotName);
      mkdirSync(slot, { recursive: true, mode: 0o700 });
      const request = structuredClone(input),
        installation = structuredClone(config);
      if (label.startsWith('node')) {
        installation.policy.profile = 'linux-x64-node-v1';
        installation.runtimeRoot = join(slot, 'runtime');
        request.inputs.node = {
          files: reportNodeTargets.map((target) => ({ target, stamp: '31:712:500:100:100' })),
          input: { dev: '32', ino: '32005' },
          output: { dev: '32', ino: '32006' },
        };
        assert.throws(() => systemReportUnitTexts(input, slot, installation), {
          code: 'unavailable',
        });
        assert.throws(() => systemReportUnitTexts(request, slot, config), { code: 'unavailable' });
      }
      const paths = [];
      for (const [name, text] of systemReportUnitTexts(request, slot, installation)) {
        const path = join(directory, name);
        writeFileSync(path, text);
        paths.push(path);
      }
      const result = spawnSync('/usr/bin/systemd-analyze', ['verify', ...paths], {
        env: { ...process.env, LANG: 'C', SYSTEMD_COLORS: '0' },
        encoding: 'utf8',
        timeout: 30_000,
      });
      writeFileSync(join(directory, 'verify.json'), JSON.stringify(result, null, 2));
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, 0, result.stderr);
      const diagnostics = `${result.stdout}\n${result.stderr}`
        .split('\n')
        .filter((line) => paths.some((path) => line.includes(path)))
        .join('\n');
      // systemd can ignore malformed OpenFile entries while still returning success.
      assert.doesNotMatch(diagnostics, /Failed to parse OpenFile=/);
    });
  }
});
