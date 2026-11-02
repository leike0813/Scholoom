// Fixed installed Node/data oracle; no report page or domain authority is implemented here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const approved = readFileSync(process.argv[2], 'utf8');
assert.equal(approved, 'approved report bytes\n');
const buffer = Buffer.alloc(65536);
let size = 0;
process.stdin.on('data', (chunk) => {
  for (let offset = 0; offset < chunk.length; ) {
    const newline = chunk.indexOf(10, offset);
    const end = newline < 0 ? chunk.length : newline;
    assert(size + end - offset <= buffer.length);
    chunk.copy(buffer, size, offset, end);
    size += end - offset;
    offset = end + 1;
    if (newline >= 0) {
      const request = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size)),
      );
      assert.deepEqual(request, { action: 'probe' });
      const response = JSON.stringify({ approved, request });
      assert(Buffer.byteLength(response) < buffer.length);
      process.stdout.write(`${response}\n`);
      size = 0;
    }
  }
});
