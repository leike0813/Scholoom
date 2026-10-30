import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startProbe } from '../report-worker-dom/controller.ts';

const [built, output] = process.argv.slice(2);
const controller = await startProbe(built, output);
const replies = [];
async function request(body) {
  const response = await fetch(`${controller.origin}/wire`, {
    method: 'POST',
    body: JSON.stringify({ generation: 1, consumed: [], ...body }),
  });
  assert.equal(response.status, 200);
  const reply = await response.json();
  replies.push(reply);
  return reply;
}
try {
  let reply = await request({ op: 'start' });
  assert.equal(reply.credit, 3);
  for (let remaining = 2; remaining >= 0; remaining--) {
    reply = await request({ op: 'mutate' });
    assert.equal(reply.credit, remaining);
    assert.equal(reply.failure, '');
  }
  const failed = await request({ op: 'mutate' });
  assert.equal(failed.failure, 'mutationCreditExhausted');
  assert.equal(failed.processed, undefined);
  assert.deepEqual(failed.packets, []);
  assert.deepEqual(failed.receipts, []);
  assert.equal(failed.sequence, 4);
  assert.equal(failed.credit, 0);
} finally {
  await writeFile(join(output, 'credits.json'), JSON.stringify(replies, null, 2));
  await controller.close();
}
const closed = JSON.parse(await readFile(join(output, 'closed.json'), 'utf8'));
assert.equal(closed.source.closed, true);
assert.equal(closed.source.code, 0);
assert.deepEqual(closed.reply.outstanding, [1, 2, 3, 4]);
assert.equal(closed.reply.credit, 0);
console.log('4 unacknowledged frames exhaust credits; failure has no ACK; owned source closed');
