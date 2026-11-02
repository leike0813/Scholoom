import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { type BuildOptions, build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import {
  isReportProgramCommand,
  isReportProgramPacket,
} from '../../packages/protocol/dist/report-contracts.js';

const binding = { version: 1, viewId: 'view', generation: 1, basis: 'report-v1' };
const start = {
  ...binding,
  type: 'start',
  viewport: [800, 600],
  cssProperties: [],
  eventProperties: ['oninput'],
};
const input = {
  ...binding,
  type: 'input',
  input: {
    nodeId: 3,
    revision: 1,
    eventType: 'input',
    bubbles: true,
    cancelable: false,
    isTrusted: true,
    value: 'note',
  },
};

test('program rejects unsupported capabilities without losing caught errors or local JS', async () => {
  const { reportSourceBuildOptions }: { reportSourceBuildOptions: BuildOptions } = await import(
    new URL('../../packages/editor/report/build-options.mjs', import.meta.url).href
  );
  const bundle = await build({
    absWorkingDir: fileURLToPath(new URL('../../', import.meta.url)),
    entryPoints: ['tests/fixtures/report-program/capabilities-driver.mjs'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    ...reportSourceBuildOptions,
  });
  const script = bundle.outputFiles?.[0]?.text;
  assert(script);
  for (const mode of ['caught', 'uncaught']) {
    const child = spawnSync(process.execPath, ['--input-type=commonjs', '-', mode], {
      input: `(function () {\n${script}\n})();`,
      encoding: 'utf8',
      timeout: 8000,
      maxBuffer: 65536,
    });
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({ mode, state: 'passed' });
  }
});

test('program commands retain explicit binding and consumption shapes', () => {
  for (const command of [
    start,
    { ...start, restorePending: true },
    input,
    { type: 'consume', sequences: [1, 2, 3, 4] },
    { ...binding, type: 'restore', browse: {}, draft: {}, dirty: false },
  ])
    expect(isReportProgramCommand(command)).toBe(true);
  for (const command of [
    { ...start, sessionId: 'other-recipient' },
    { ...start, version: 2 },
    { ...start, viewport: [0, 600] },
    { ...start, restorePending: false },
    { type: 'consume', sequences: [1, 1] },
    { type: 'consume', sequences: [1, 2, 3, 4, 5] },
    { ...input, input: { ...input.input, nodeId: 0 } },
    { ...input, input: { ...input.input, file: '/other/file' } },
    { ...binding, type: 'tool', command: 'run' },
  ])
    expect(isReportProgramCommand(command)).toBe(false);
});

test('program output contains only rendering, original bridge or confirmed input data', () => {
  const frame = { sequence: 1, phase: 1, nodes: [], strings: ['text'], mutations: [] };
  const receipt = {
    ...binding,
    type: 'inputConfirmed',
    nodeId: 3,
    revision: 1,
    through: 2,
    value: 'note',
  };
  for (const packet of [
    frame,
    receipt,
    { ...binding, type: 'ready' },
    { ...binding, type: 'select', objectIds: ['known-object'], request: 'Compare' },
  ])
    expect(isReportProgramPacket(packet)).toBe(true);
  for (const packet of [
    { ...frame, sequence: 0 },
    { ...receipt, recipient: 'another-session' },
    { ...receipt, value: 'x'.repeat(16385) },
    { ...binding, type: 'execute', file: '/other' },
  ])
    expect(isReportProgramPacket(packet)).toBe(false);
});

test('whole program messages bound UTF8 and reject cyclic or expanding state safely', () => {
  const tooLarge = {
    ...input,
    input: { ...input.input, value: '中'.repeat(12000), data: '文'.repeat(12000) },
  };
  expect(isReportProgramCommand(tooLarge)).toBe(false);
  expect(
    isReportProgramPacket({
      sequence: 1,
      phase: 1,
      nodes: [],
      strings: ['中'.repeat(30000)],
      mutations: [],
    }),
  ).toBe(false);
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const draft of [
    cycle,
    (() => {
      let value: unknown = 'leaf';
      for (let i = 0; i < 24; i++) value = [value, value];
      return value;
    })(),
  ]) {
    const state = { ...binding, type: 'state', browse: {}, draft, dirty: true };
    expect(isReportProgramCommand(state)).toBe(false);
    expect(isReportProgramPacket(state)).toBe(false);
  }
});
