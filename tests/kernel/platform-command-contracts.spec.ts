import { expect, test } from '@playwright/test';
import { compileContract } from '../../packages/protocol/dist/core.js';
import { platformCommandOperations } from '../../packages/protocol/dist/platform.js';

test('platform command contracts require resolved identities and bounded execution data', () => {
  const validate = compileContract(platformCommandOperations['platform.command']);
  const valid = {
    workspaceId: 'workspace',
    executableId: 'quarto',
    args: ['--version'],
    timeoutMs: 1000,
  };

  expect(validate.params(valid)).toBe(true);
  expect(validate.params({ ...valid, args: Array.from({ length: 128 }, () => '') })).toBe(true);
  for (const invalid of [
    { ...valid, cwd: '/tmp' },
    { ...valid, nativePath: '/usr/bin/quarto' },
    { ...valid, executable: '/usr/bin/quarto' },
    { ...valid, ownerModuleId: 'editor' },
    { ...valid, workDomain: { kind: 'project', projectId: 'project' } },
    { ...valid, principal: { kind: 'agent', id: 'agent' } },
    { ...valid, timeoutMs: -1 },
    { ...valid, timeoutMs: 180001 },
    { workspaceId: 'workspace', args: [], timeoutMs: 1000 },
    { ...valid, args: Array.from({ length: 129 }, () => '') },
    { ...valid, args: ['x'.repeat(4097)] },
  ]) {
    expect(validate.params(invalid)).toBe(false);
  }

  expect(validate.result({ code: 0, stdout: '', stderr: '' })).toBe(true);
  expect(
    validate.result({
      code: 0,
      stdout: 'x'.repeat(1048576),
      stderr: 'x'.repeat(65536),
    }),
  ).toBe(true);
  for (const invalid of [
    { code: -1, stdout: '', stderr: '' },
    { code: 0, stdout: 'x'.repeat(1048577), stderr: '' },
    { code: 0, stdout: '', stderr: 'x'.repeat(65537) },
  ]) {
    expect(validate.result(invalid)).toBe(false);
  }
});
