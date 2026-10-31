// Scholoom 2026-10-31 regression: string admission must not allocate an encoded copy.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  consume,
  getForTesting,
  store,
} from '../report-worker-dom/vendor/src/worker-thread/strings.js';

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
      const values = Array.from({ length: 1024 }, (_, index) => String(index));
      for (const [index, value] of values.entries()) assert.equal(store(value), index);
      assert.deepEqual(consume(), values);
      rejected('new-entry');
      assert.equal(store(values[0]), 0);
      assert.deepEqual(consume(), []);
    } else {
      const sample = samples[Number(scenario)];
      assert.equal(typeof sample, 'string');
      const sampleBytes = Buffer.byteLength(sample, 'utf8');
      rejected('z'.repeat(65537));
      assert.equal(store(sample), 0);
      assert.deepEqual(consume(), [sample]);

      const remaining = 65536 - sampleBytes;
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
