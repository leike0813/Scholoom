import { expect, test } from '@playwright/test';
import { Broker } from '../../packages/broker/dist/index.js';
import { isBusinessMethod } from '../../packages/protocol/dist/business.js';
import { type CallContext, compileContract } from '../../packages/protocol/dist/core.js';
import {
  type ProjectTargetReadInputs,
  type ProjectTargetReadOutputs,
  projectTargetReadOperations,
  targetReadScopeSchema,
  workDomainSchema,
} from '../../packages/protocol/dist/projects.js';

const target = projectTargetReadOperations['project.readTarget'];
const validate = compileContract(target);
const domain = compileContract({ params: workDomainSchema, result: targetReadScopeSchema });

test('work domains preserve fixed application identity and read-only target restrictions', () => {
  for (const [value, valid] of [
    [{ kind: 'application', projectId: 'application', sessionId: 's' }, true],
    [{ kind: 'project', projectId: 'p', sessionId: 's' }, true],
    [{ kind: 'application', projectId: 'p', sessionId: 's' }, false],
    [{ kind: 'project', projectId: 'application', sessionId: 's' }, false],
    [{ kind: 'project', projectId: 'p' }, false],
    [{ kind: 'project', projectId: 'p', sessionId: 's', nativePath: '/tmp/p' }, false],
  ] as const) {
    expect(domain.params(value)).toBe(valid);
  }
  expect(domain.result({ targetProjectId: 'p', access: 'read' })).toBe(true);
  expect(domain.result({ targetProjectId: 'p', access: 'write' })).toBe(false);
  expect(domain.result({ targetProjectId: 'application', access: 'read' })).toBe(false);
});

test('target read schemas bound requests to registered identities and bounded slices', () => {
  const reference = { fileId: 'f', basis: 'b' };
  for (const request of [
    { kind: 'list', offset: 0, limit: 100 },
    { kind: 'describe', ...reference },
    { kind: 'readText', ...reference, offset: 0, limit: 262144 },
    { kind: 'readBytes', ...reference, offset: 0, limit: 262144 },
  ]) {
    expect(validate.params({ targetProjectId: 'p', request })).toBe(true);
  }
  for (const request of [
    { kind: 'list', limit: 101 },
    { kind: 'describe', fileId: 'f' },
    { kind: 'readText', ...reference, limit: 262145 },
    { kind: 'readBytes', ...reference, limit: 0 },
    { kind: 'readBytes', ...reference, limit: 262145 },
    { kind: 'readBytes', ...reference, offset: -1 },
    { kind: 'readBytes', ...reference, nativePath: '/tmp/f' },
    { kind: 'save', ...reference, content: 'replacement' },
  ]) {
    expect(validate.params({ targetProjectId: 'p', request })).toBe(false);
  }
  expect(validate.params({ targetProjectId: 'application', request: { kind: 'list' } })).toBe(
    false,
  );
  expect(validate.params({ targetProjectId: 'p', request: { kind: 'list' }, sessionId: 's' })).toBe(
    false,
  );

  const descriptor = { ...reference, path: 'sample.txt', size: 3 };
  for (const result of [
    { kind: 'list', entries: [descriptor] },
    { kind: 'describe', ...descriptor },
    { kind: 'readText', ...descriptor, content: 'abc', offset: 0 },
    { kind: 'readBytes', ...descriptor, data: 'YWJj', offset: 0 },
  ]) {
    expect(validate.result(result)).toBe(true);
    expect(validate.result({ ...result, nativePath: '/tmp/sample.txt' })).toBe(false);
  }
  expect(validate.result({ kind: 'list', entries: [{ path: 'unregistered.txt', size: 0 }] })).toBe(
    false,
  );
  expect(
    validate.result({ kind: 'list', entries: Array.from({ length: 101 }, () => descriptor) }),
  ).toBe(false);
});

test('the internal target port stays unavailable until a provider is registered', async () => {
  const broker = new Broker<
    typeof projectTargetReadOperations,
    ProjectTargetReadInputs,
    ProjectTargetReadOutputs
  >(projectTargetReadOperations);
  const context: CallContext = {
    moduleId: 'harness',
    role: 'execution',
    principal: { kind: 'agent', id: 's' },
    workDomain: { kind: 'application', projectId: 'application', sessionId: 's' },
  };
  const reader = broker.consumer(context, ['project.readTarget']);
  await expect(
    reader.call('project.readTarget', { targetProjectId: 'p', request: { kind: 'list' } }),
  ).rejects.toMatchObject({ code: 'unavailable' });
  expect(isBusinessMethod('project.readTarget')).toBe(false);
});
