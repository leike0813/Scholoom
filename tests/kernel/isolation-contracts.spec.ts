import { expect, test } from '@playwright/test';
import { compileContract } from '../../packages/protocol/dist/core.js';
import {
  isolationOperations,
  validateIsolationPut,
  validateIsolationStage,
} from '../../packages/protocol/dist/platform-isolation.js';

const stage = {
  instanceId: 'isolation-1',
  programId: 'fixed-reader',
  policyId: 'native-readonly',
  entryPath: 'entry.js',
  assets: [
    { path: 'entry.js', byteLength: 3 },
    { path: 'data/input.json', byteLength: 2 },
  ],
};
const put = { instanceId: 'isolation-1', path: 'entry.js', offset: 0, base64: 'YWJj' };

test('isolation operations accept narrow identities and strict shared status', () => {
  const check = compileContract(isolationOperations['platform.reportIsolation.check']);
  expect(check.params({ programId: 'fixed-reader', policyId: 'native-readonly' })).toBe(true);
  expect(check.params({ programId: 'fixed-reader' })).toBe(false);
  expect(check.result({ available: true })).toBe(true);
  expect(
    check.result({ available: false, reason: { code: 'unavailable', message: 'No policy' } }),
  ).toBe(true);
  expect(check.result({ available: false, reason: 'No policy' })).toBe(false);

  const status = {
    instanceId: 'isolation-1',
    phase: 'preparing',
    gateReleased: false,
    stopConfirmed: false,
    next: { path: 'entry.js', offset: 0 },
  };
  for (const method of ['start', 'get', 'stop'] as const) {
    const validate = compileContract(isolationOperations[`platform.reportIsolation.${method}`]);
    expect(validate.params({ instanceId: 'isolation-1' })).toBe(true);
    expect(validate.params({ instanceId: 'isolation-1', argv: [] })).toBe(false);
  }
  for (const method of ['stage', 'put', 'start', 'get', 'stop'] as const) {
    const result = compileContract(
      isolationOperations[`platform.reportIsolation.${method}`],
    ).result;
    for (const phase of [
      'queued',
      'preparing',
      'starting',
      'running',
      'stopping',
      'stopped',
      'unknown',
    ])
      expect(result({ ...status, phase })).toBe(true);
    for (const invalid of [
      { phase: 'running', gateReleased: true, stopConfirmed: false },
      { instanceId: 'isolation-1', phase: 'running', gateReleased: true },
      { instanceId: 'isolation-1', phase: 'stopped', stopConfirmed: true },
      { ...status, phase: 'ready' },
      { ...status, next: { path: 'entry.js' } },
      { ...status, failure: { code: 'custom', message: 'Unknown' } },
      { ...status, nativePath: '/private/receipt' },
    ])
      expect(result(invalid)).toBe(false);
    expect(
      result({ ...status, failure: { code: 'outcomeUnknown', message: 'Stop unconfirmed' } }),
    ).toBe(true);
  }
});

test('stage rejects unsafe paths, conflicting files and unbounded asset declarations', () => {
  const validate = compileContract(isolationOperations['platform.reportIsolation.stage']).params;
  expect(validate(stage)).toBe(true);
  expect(validateIsolationStage(stage)).toBe(true);
  for (const path of [
    '',
    '/entry.js',
    '../entry.js',
    'data/../entry.js',
    './entry.js',
    'data/./entry.js',
    'data\\entry.js',
    'data//entry.js',
    'data/',
    'entry\u0000.js',
    'https://example.test/entry.js',
    'file:entry.js',
    'C:/entry.js',
    'x'.repeat(513),
  ]) {
    const input = { ...stage, entryPath: path, assets: [{ path, byteLength: 1 }] };
    expect(validate(input)).toBe(false);
    expect(validateIsolationStage(input)).toBe(false);
  }
  expect(
    validateIsolationStage({
      ...stage,
      assets: [{ path: 'x'.repeat(512), byteLength: 0 }],
      entryPath: 'x'.repeat(512),
    }),
  ).toBe(true);
  for (const assets of [
    [],
    [{ path: 'other.js', byteLength: 1 }],
    [...stage.assets, { path: 'entry.js', byteLength: 4 }],
    [...stage.assets, { path: 'data', byteLength: 0 }],
    [{ path: 'data', byteLength: 0 }, ...stage.assets],
    [{ path: 'entry.js', byteLength: 262145 }],
    [...stage.assets, { path: 'large.bin', byteLength: 8388609 }],
    [...stage.assets, { path: 'negative.bin', byteLength: -1 }],
    [...stage.assets, { path: 'fraction.bin', byteLength: 0.5 }],
    [
      { path: 'entry.js', byteLength: 3 },
      ...Array.from({ length: 4 }, (_, index) => ({ path: `data/${index}`, byteLength: 8388608 })),
    ],
    [
      { path: 'entry.js', byteLength: 0 },
      ...Array.from({ length: 33 }, (_, index) => ({ path: `asset-${index}`, byteLength: 0 })),
    ],
  ])
    expect(validateIsolationStage({ ...stage, assets })).toBe(false);
  expect(
    validateIsolationStage({
      ...stage,
      assets: [
        { path: 'entry.js', byteLength: 262144 },
        ...Array.from({ length: 32 }, (_, index) => ({
          path: `data/${index}`,
          byteLength: 1040384,
        })),
      ],
    }),
  ).toBe(true);
  expect(
    validateIsolationStage({
      ...stage,
      assets: [...stage.assets, { path: 'large.bin', byteLength: 8388608 }],
    }),
  ).toBe(true);
  for (const extra of [{ argv: [] }, { env: {} }, { nativePath: '/private/entry.js' }])
    expect(validate({ ...stage, ...extra })).toBe(false);
});

test('put bounds the schema before decoding and requires canonical base64 within byte limits', () => {
  const validate = compileContract(isolationOperations['platform.reportIsolation.put']).params;
  expect(validate(put)).toBe(true);
  for (const base64 of ['', 'YQ==', 'YWI=', 'YWJj', '/w==', '//8=', `${'A'.repeat(349524)}AA==`])
    expect(validateIsolationPut({ ...put, base64 })).toBe(true);
  for (const base64 of [
    'YQ',
    'YQ=',
    'YR==',
    'YWJ=',
    'YQ==\n',
    'Y Q==',
    '_w==',
    'YQ===',
    '!!!!',
    `${'A'.repeat(349524)}AAA=`,
    'A'.repeat(349528),
  ])
    expect(validateIsolationPut({ ...put, base64 })).toBe(false);
  expect(validate({ ...put, base64: 'A'.repeat(349529) })).toBe(false);
  for (const change of [
    { offset: -1 },
    { offset: 0.5 },
    { offset: 8388609 },
    { offset: 8388608, base64: 'YQ==' },
    { path: '../entry.js' },
    { executable: '/bin/reader' },
  ])
    expect(validateIsolationPut({ ...put, ...change })).toBe(false);
});
