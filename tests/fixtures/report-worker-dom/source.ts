import assert from 'node:assert/strict';
import { mountSample } from './sample.js';
import { TransferrableKeys as K } from './vendor/src/transfer/TransferrableKeys.js';
import { createWorkerDOM, hydrate } from './vendor/src/worker-thread/index.js';

const listeners = new Set<Function>();
let sequence = 0;
let credit = 4;
const outstanding = new Set<number>();
const packets: unknown[] = [];
const source = createWorkerDOM(
  (message: any) => {
    assert(credit > 0, 'probeMutationCreditExhausted');
    const nodes = Array.from(new Uint16Array(message[K.nodes]));
    const mutations = Array.from(new Uint16Array(message[K.mutations]));
    const strings = message[K.strings];
    assert(
      nodes.length * 2 + mutations.length * 2 + Buffer.byteLength(JSON.stringify(strings)) <= 65536,
    );
    credit--;
    outstanding.add(++sequence);
    packets.push({
      sequence,
      phase: message[K.phase],
      type: message[K.type],
      nodes,
      strings,
      mutations,
    });
  },
  (type: string, listener: Function) => {
    assert.equal(type, 'message');
    listeners.add(listener);
  },
  (_type: string, listener: Function) => listeners.delete(listener),
);
hydrate(
  source.document,
  [],
  {} as any,
  [],
  [],
  [800, 600],
  { storage: {}, errorMsg: null },
  { storage: {}, errorMsg: null },
);
source.document[K.observe]();
const sample = mountSample(source);
function take() {
  return packets.splice(0);
}
const initial = Promise.resolve().then(() => ({ packets: take(), state: sample.read() }));
let serial = Promise.resolve();
process.on('message', (request: any) => {
  serial = serial
    .then(async () => {
      if (request.op === 'close') {
        listeners.clear();
        process.send!(
          { id: request.id, closed: true, sequence, outstanding: [...outstanding] },
          () => process.disconnect(),
        );
        return;
      }
      for (const consumed of request.consumed ?? []) {
        assert(outstanding.delete(consumed), 'invalidConsumptionAck');
        credit++;
      }
      if (request.op === 'start') {
        process.send!({ id: request.id, ...(await initial), sequence, credit });
        return;
      }
      assert.equal(request.op, 'messages');
      assert(request.messages.length <= 4);
      for (const data of request.messages) {
        const target = data[K.sync]?.[K.index] ?? data[K.event]?.[K.index];
        assert(Number.isInteger(target) && target > 0 && target <= 512);
        const value = data[K.sync]?.[K.value];
        if (value !== undefined) assert(typeof value === 'string' && value.length <= 256);
        for (const listener of listeners) listener({ data });
      }
      // Only the fixed synchronous handlers and their upstream transfer microtask are fenced.
      await Promise.resolve();
      process.send!({
        id: request.id,
        packets: take(),
        sequence,
        credit,
        processed: request.id,
        state: sample.read(),
      });
    })
    .catch((error) => {
      process.send!({ id: request.id, error: String(error) });
      process.exitCode = 1;
    });
});
