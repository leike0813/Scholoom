import { expect, test } from '@playwright/test';
import { compileContract } from '../../packages/protocol/dist/core.js';
import {
  platformCommandOperations,
  platformProgramOperations,
} from '../../packages/protocol/dist/platform.js';
import {
  programsInternalOperations,
  programsOperations,
} from '../../packages/protocol/dist/programs.js';

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

test('program contracts bound data and refuse caller-supplied execution authority', () => {
  const start = compileContract(programsOperations['programs.start']).params;
  const valid = {
    projectId: 'project',
    operationId: 'operation',
    environmentId: 'node',
    entry: { ref: { source: 'project', projectId: 'project', fileId: 'code' }, basis: 'basis' },
  };
  expect(start(valid)).toBe(true);
  for (const invalid of [
    { ...valid, principal: { kind: 'human', id: 'local' } },
    { ...valid, nativePath: '/usr/bin/node' },
    { ...valid, backgroundOwner: { kind: 'human', id: 'local' } },
    { ...valid, args: ['x'.repeat(4097)] },
    { ...valid, timeoutMs: -1 },
    { ...valid, entry: { ...valid.entry, basis: '' } },
  ])
    expect(start(invalid)).toBe(false);
  const platform = compileContract(platformProgramOperations['platform.programStart']).params;
  const command = { workspaceId: 'workspace', executableId: 'node', args: [], timeoutMs: null };
  expect(platform(command)).toBe(true);
  expect(platform({ ...command, executable: '/usr/bin/node' })).toBe(false);
  const event = compileContract(programsInternalOperations['programs.commandEvent']).params;
  const observed = {
    programRunId: 'run',
    hostInstanceId: 'host',
    commandInstanceId: 'command',
    seq: 0,
    event: { kind: 'output', stream: 'stdout', text: 'progress' },
  };
  expect(event(observed)).toBe(true);
  for (const change of [
    { kind: 'output', stream: 'stdin', text: '' },
    { kind: 'output', stream: 'stdout', text: 'x'.repeat(16385) },
    { kind: 'stopped', code: 0 },
  ])
    expect(event({ ...observed, event: change })).toBe(false);
});
