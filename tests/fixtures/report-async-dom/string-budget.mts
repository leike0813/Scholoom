// Scholoom 2026-10-31 regression: string admission must not allocate an encoded copy.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reportRenderLimits } from '@scholoom/protocol/reports';
import {
  consume,
  getForTesting,
  store,
} from '../../../packages/editor/vendor/worker-dom/src/worker-thread/strings.js';

const samples = ['A', 'é', '中', '😀', '\ud800', '\udc00', 'Aé中😀\ud800x\udc00'];
const scenario = process.argv[2];
if (scenario === undefined) {
  // Each child gets the actual module's fresh cumulative table; no reset hook is needed.
  for (const name of [...samples.map((_, index) => String(index)), 'count']) {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), name], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 65536,
    });
    assert.equal(result.status, 0, `${name}: ${result.error ?? result.stderr}`);
  }
  console.log('8 string-budget scenarios passed: no encoding, UTF8 boundaries, consume and dedup');
  const { createWorkerDOM } = await import('../../../packages/editor/vendor/worker-dom/src/worker-thread/index.js');
  const { TransferrableKeys: K } = await import('../../../packages/editor/vendor/worker-dom/src/transfer/TransferrableKeys.js');
  const nodes = await import('../../../packages/editor/vendor/worker-dom/src/worker-thread/nodes.js');
  assert(reportRenderLimits.nodes <= 65535 && reportRenderLimits.strings <= 65535);
  const { document } = createWorkerDOM(() => {}, () => {}, () => {});
  assert.equal(document[K.index], 1);
  assert.equal(document.body[K.index], 2);
  assert.equal(nodes.get(1), document);
  assert.equal(nodes.get(2), document.body);
  document[K.observe]();
  let last = document.body;
  let pending = 0;
  for (let index = 3; index <= reportRenderLimits.nodes; index++) {
    last = document.createElement('div');
    assert.equal(last[K.index], index);
    pending++;
    if (index === Math.floor(reportRenderLimits.nodes / 2)) {
      assert.equal(nodes.consume().length, pending);
      pending = 0;
    }
  }
  assert.equal(nodes.consume().length, pending);
  assert.throws(() => document.createElement('div'), { message: 'probeNodeBudget' });
  assert.equal(nodes.get(reportRenderLimits.nodes), last);
  assert.equal(nodes.get(reportRenderLimits.nodes + 1), null);
  assert.equal(nodes.store(last), reportRenderLimits.nodes);
  assert.deepEqual(nodes.consume(), []);
  console.log('Node registry boundary passed: Document/body identities, cumulative consume and U16 indices');
} else {
  const original = TextEncoder.prototype.encode;
  let encodings = 0;
  TextEncoder.prototype.encode = () => {
    encodings++;
    throw new Error('unexpectedStringEncoding');
  };
  const rejected = (value: string) => {
    assert.throws(() => store(value), { message: 'probeStringBudget' });
    assert.equal(getForTesting(value), undefined);
    assert.deepEqual(consume(), []);
  };
  try {
    if (scenario === 'count') {
      const values = Array.from({ length: reportRenderLimits.strings }, (_, index) => String(index));
      for (const [index, value] of values.entries()) assert.equal(store(value), index);
      assert.deepEqual(consume(), values);
      rejected('new-entry');
      assert.equal(store(values[0]), 0);
      assert.deepEqual(consume(), []);
    } else {
      const sample = samples[Number(scenario)];
      assert.equal(typeof sample, 'string');
      const sampleBytes = Buffer.byteLength(sample, 'utf8');
      rejected('z'.repeat(reportRenderLimits.stringBytes + 1));
      assert.equal(store(sample), 0);
      assert.deepEqual(consume(), [sample]);

      const remaining = reportRenderLimits.stringBytes - sampleBytes;
      rejected(sample.repeat(Math.floor(remaining / sampleBytes) + 1));
      assert.equal(store(sample), 0);
      assert.deepEqual(consume(), []);

      const boundary =
        sample.repeat(Math.floor(remaining / sampleBytes)) + '\0'.repeat(remaining % sampleBytes);
      assert.equal(Buffer.byteLength(boundary, 'utf8'), remaining);
      assert.equal(store(boundary), 1);
      assert.deepEqual(consume(), [boundary]);
      assert.equal(store(boundary), 1);
      rejected('!');
    }
    assert.equal(encodings, 0);
  } finally {
    TextEncoder.prototype.encode = original;
  }
}
