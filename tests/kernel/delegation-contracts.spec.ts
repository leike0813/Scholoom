import { expect, test } from '@playwright/test';
import { compileContract } from '../../packages/protocol/dist/core.js';
import { delegationInternalOperations } from '../../packages/protocol/dist/harness.js';

test('delegation accepts explicit evidence and rejects forged ownership and unbounded work', () => {
  const validate = compileContract(delegationInternalOperations['harness.delegate']).params;
  const request = {
    delegationId: 'bounded-work',
    roleId: 'worker',
    roleVersion: '1',
    tools: ['resource.read', 'resource.create'],
    workPackage: {
      objective: 'Read the input and save a report',
      requirements: 'Report actual findings',
      materials: [
        { ref: { source: 'project', projectId: 'project', fileId: 'input' }, basis: 'v1' },
      ],
      outputs: [{ kind: 'create', path: 'report.md' }],
    },
  };
  expect(validate(request)).toBe(true);
  expect(validate({ ...request, instanceId: 'forged' })).toBe(false);
  expect(validate({ ...request, delegationId: '../parent' })).toBe(false);
  expect(
    validate({
      ...request,
      workPackage: {
        ...request.workPackage,
        materials: Array(33).fill(request.workPackage.materials[0]),
      },
    }),
  ).toBe(false);
});
