import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { checkArchitecture } from '../../scripts/check-architecture.js';

const execute = promisify(execFile);
const fixtures = fileURLToPath(new URL('../fixtures/architecture', import.meta.url));
const checker = fileURLToPath(new URL('../../scripts/check-architecture.ts', import.meta.url));

function locations(report: ReturnType<typeof checkArchitecture>, category: string): string[] {
  return report.findings
    .filter((finding) => finding.category === category)
    .map((finding) => `${finding.file}:${finding.line}`);
}

test('architecture check accepts a legal module composition', () => {
  const report = checkArchitecture({ root: join(fixtures, 'legal') });
  expect(report.findings).toEqual([]);
  expect(report.notes.some((note) => note.startsWith('allowed adapter system uses: '))).toBe(true);
});

test('architecture check reports reverse dependencies, cycles, private paths and system access', () => {
  const report = checkArchitecture({ root: join(fixtures, 'violations') });
  expect(locations(report, 'reverse-dependency')).toEqual(['src/index.ts:2', 'src/typed.ts:3']);
  expect(locations(report, 'cycle')).toEqual(['src/cycle-b.ts:2']);
  expect(locations(report, 'private-path')).toEqual([
    'src/dynamic.ts:4',
    'src/private.ts:2',
    'src/private.ts:3',
  ]);
  expect(locations(report, 'system-access')).toEqual([
    'src/dynamic.ts:3',
    'src/require.ts:1',
    'src/require.ts:2',
    'src/system.ts:2',
    'src/system.ts:3',
    'src/system.ts:10',
  ]);
  expect(locations(report, 'undeclared-dependency')).toEqual([
    'src/typed.ts:4',
    'src/undeclared.ts:2',
  ]);
  expect(locations(report, 'duplicate-capability')).toHaveLength(1);
  expect(
    report.findings
      .filter((finding) => finding.file === 'src/typed.ts')
      .map((finding) => finding.category),
  ).toEqual(['reverse-dependency', 'undeclared-dependency']);
});

test('architecture check grants only import edges and paths named by policy', () => {
  const report = checkArchitecture({ root: join(fixtures, 'exceptions') });
  expect(report.findings).toEqual([]);
  expect(report.exceptions).toHaveLength(1);
  expect(report.exceptions[0]).toContain('task 2.1');
});

test('architecture check rejects whole-module and removal-less migration exceptions', () => {
  const report = checkArchitecture({ root: join(fixtures, 'invalid-exception') });
  const errors = report.findings.filter((finding) => finding.category === 'policy-error');
  expect(errors).toHaveLength(2);
  expect(errors.some((error) => error.detail.includes('whole module'))).toBe(true);
  expect(errors.some((error) => error.detail.includes('removal'))).toBe(true);
});

test('architecture CLI reports violations through its exit code', async () => {
  const legal = await execute(process.execPath, [checker, '--root', join(fixtures, 'legal')]);
  expect(legal.stdout).toContain('0 findings');
  const violations = await execute(process.execPath, [
    checker,
    '--root',
    join(fixtures, 'violations'),
  ])
    .then(() => undefined)
    .catch((error: unknown) => error as { code?: number; stdout?: string });
  expect(violations?.code).toBe(1);
  expect(violations?.stdout ?? '').toContain('reverse-dependency');
});
