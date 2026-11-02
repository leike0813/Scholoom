import assert from 'node:assert/strict';
import {
  copyFrame,
  type Frame,
  type FrameContext,
  measureFrame,
  preflightFrame,
  stringBytes,
} from './frame-budget.mjs';

const context: FrameContext = {
  received: 0,
  staged: 0,
  stagedBytes: 0,
  stringCount: 0,
  stringBytes: 0,
  nodeIds: new Set([1, 2]),
  stringAt: () => '',
};
const frame = (text = 'p'): Frame => ({
  sequence: 1,
  phase: 1,
  nodes: [],
  strings: [text],
  mutations: [],
});
const oracle = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
for (const text of ['ASCII', 'é中😀', '"\\\n\b\t\f\r\0', '\ud800', '\udc00', '\ud800x\udc00']) {
  assert.equal(stringBytes(text), Buffer.byteLength(text, 'utf8'));
  assert.equal(stringBytes(text, true), oracle(text));
  const candidate = frame(text);
  candidate.bytes = measureFrame(candidate, true).compactBytes;
  assert.equal(measureFrame(candidate).wireBytes, oracle(candidate));
}
const typed = {
  ...frame('text'),
  nodes: new Uint16Array([3, 3, 0, 0, 0]),
  mutations: new Uint16Array([1, 3, 65535]),
};
const copied = copyFrame(typed);
assert.equal(measureFrame(typed, true).wireBytes, oracle(copied));
assert.deepEqual(copied.nodes, [3, 3, 0, 0, 0]);

// Find the wire boundary using native JSON as an independent oracle.
let boundary = 0;
for (let n = 65400; n <= 65536; n++) {
  const candidate = { ...frame('x'.repeat(n)), bytes: n + 4 };
  if (oracle(candidate) <= 65536) boundary = n;
}
const exact = { ...frame('x'.repeat(boundary)), bytes: boundary + 4 };
assert.equal(oracle(exact), 65536);
assert.equal(measureFrame(exact).wireBytes, 65536);
assert.throws(() => measureFrame({ ...frame('x'.repeat(boundary + 1)), bytes: boundary + 5 }));

const nativeStringify = JSON.stringify;
const nativeEncode = TextEncoder.prototype.encode;
const nativeFrom = Array.from;
try {
  JSON.stringify = () => {
    throw new Error('unexpectedJsonCopy');
  };
  TextEncoder.prototype.encode = () => {
    throw new Error('unexpectedEncodedCopy');
  };
  Array.from = () => {
    throw new Error('unexpectedArrayCopy');
  };
  assert.equal(measureFrame(exact).wireBytes, 65536);
  assert.throws(() => measureFrame(frame('\0'.repeat(12000))), { message: 'mutationFrameBudget' });
  assert.throws(() => copyFrame(frame('\0'.repeat(12000))), { message: 'mutationFrameBudget' });
  assert.throws(() => copyFrame({ ...frame(), nodes: [65536, 1, 0, 0, 0] }), {
    message: 'invalidU16',
  });
  assert.throws(() => measureFrame(frame('x'.repeat(65537))), { message: 'mutationFrameBudget' });
  assert.throws(() => measureFrame({ ...frame(), nodes: [65536, 1, 0, 0, 0] }), {
    message: 'invalidU16',
  });
} finally {
  JSON.stringify = nativeStringify;
  TextEncoder.prototype.encode = nativeEncode;
  Array.from = nativeFrom;
}

const nodeFrame: Frame = { ...frame(), nodes: [3, 1, 0, 0, 0] };
assert.doesNotThrow(() => preflightFrame(nodeFrame, context));
const fullNodes = { ...context, nodeIds: new Set(Array.from({ length: 511 }, (_, i) => i + 1)) };
assert.doesNotThrow(() => preflightFrame({ ...nodeFrame, nodes: [512, 1, 0, 0, 0] }, fullNodes));
const originalIds = [...context.nodeIds];
for (const [candidate, state] of [
  [{ ...nodeFrame, nodes: [3, 1, 0, 0, 0, 3, 1, 0, 0, 0] }, context],
  [{ ...nodeFrame, nodes: [1, 1, 0, 0, 0] }, context],
  [nodeFrame, { ...context, nodeIds: new Set(Array.from({ length: 512 }, (_, i) => i + 1)) }],
  [nodeFrame, { ...context, stringCount: 1024 }],
  [nodeFrame, { ...context, stringBytes: 65536 }],
  [nodeFrame, { ...context, staged: 4 }],
  [{ ...nodeFrame, mutations: [0, 3, 0, 0] }, context],
] as [Frame, FrameContext][]) {
  const before = { ...state, nodeIds: [...state.nodeIds] };
  assert.throws(() => preflightFrame(candidate, state));
  assert.deepEqual({ ...state, nodeIds: [...state.nodeIds] }, before);
}
assert.deepEqual([...context.nodeIds], originalIds);
assert.doesNotThrow(() =>
  preflightFrame(nodeFrame, { ...context, stringCount: 1023, stringAt: () => 'p' }),
);
assert.doesNotThrow(() => preflightFrame(frame('x'), { ...context, stringBytes: 65535 }));
console.log(
  'frame preflight passed: exact wire/Unicode sizes, no bulk copies, limits and unchanged state',
);
