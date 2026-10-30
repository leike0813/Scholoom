import assert from 'node:assert/strict';
import { TransferrableKeys as K } from '../report-worker-dom/vendor/src/transfer/TransferrableKeys.js';
import { Node } from '../report-worker-dom/vendor/src/worker-thread/dom/Node.js';
import { Event } from '../report-worker-dom/vendor/src/worker-thread/Event.js';
import { createWorkerDOM, hydrate } from '../report-worker-dom/vendor/src/worker-thread/index.js';
import { get } from '../report-worker-dom/vendor/src/worker-thread/nodes.js';
import { mountSample } from './sample.mjs';

const listeners = new Set<Function>();
let sequence = 0,
  credit = 4,
  failure = '',
  suppressed = 0,
  bridgeAccepted = 0;
const outstanding = new Set<number>();
const packets: any[] = [];
const owned = new WeakSet<object>();
let arm: { index: number; type: string } | undefined;
const dispatch = Node.prototype.dispatchEvent;
Node.prototype.dispatchEvent = function (event) {
  if (arm && this[K.index] === arm.index && event.type === arm.type) {
    owned.add(event);
    arm = undefined;
  }
  return dispatch.call(this, event);
};
const prevent = Event.prototype.preventDefault;
Event.prototype.preventDefault = function () {
  if (owned.has(this) && this.cancelable) {
    failure = 'unsupportedSynchronousInput';
    throw new Error(failure);
  }
  return prevent.call(this);
};
const source = createWorkerDOM(
  (message: any) => {
    if (failure) {
      suppressed++;
      return;
    }
    if (credit === 0) {
      failure = 'mutationCreditExhausted';
      return;
    }
    const nodes = Array.from(new Uint16Array(message[K.nodes]));
    const mutations = Array.from(new Uint16Array(message[K.mutations]));
    const strings = message[K.strings];
    const bytes =
      nodes.length * 2 + mutations.length * 2 + Buffer.byteLength(JSON.stringify(strings));
    if (bytes > 65536) {
      failure = 'mutationFrameBudget';
      return;
    }
    const packet = {
      sequence: sequence + 1,
      phase: message[K.phase],
      nodes,
      strings,
      mutations,
      bytes,
    };
    if (Buffer.byteLength(JSON.stringify(packet)) > 65536) {
      failure = 'mutationFrameBudget';
      return;
    }
    credit--;
    outstanding.add(++sequence);
    packets.push(packet);
  },
  (_type: string, listener: Function) => listeners.add(listener),
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
let sample: ReturnType<typeof mountSample>;
let serial = Promise.resolve();
const generation = 1;
process.on('message', (request: any) => {
  serial = serial
    .then(async () => {
      if (request.op === 'close') {
        listeners.clear();
        process.send!(
          {
            id: request.id,
            closed: true,
            failure,
            sequence,
            credit,
            outstanding: [...outstanding],
            suppressed,
            bridgeAccepted,
          },
          () => process.disconnect(),
        );
        return;
      }
      assert(Buffer.byteLength(JSON.stringify(request)) <= 16384, 'eventFrameBudget');
      assert.equal(request.generation, generation, 'staleGeneration');
      if (failure) {
        process.send!({
          id: request.id,
          generation,
          failure,
          packets: [],
          receipts: [],
          state: sample.read(),
          sequence,
          credit,
          suppressed,
          bridgeAccepted,
        });
        return;
      }
      for (const ack of request.consumed ?? []) {
        assert(outstanding.delete(ack), 'invalidConsumptionAck');
        credit++;
      }
      const receipts: any[] = [];
      if (request.op === 'start') {
        assert(!sample, 'duplicateStart');
        sample = mountSample(source, request.options, () => {
          assert(!failure, failure);
          bridgeAccepted++;
        });
      } else if (request.op === 'mutate') sample.mutate();
      else if (request.op === 'replace') sample.replace();
      else {
        assert.equal(request.op, 'messages');
        assert(request.messages.length <= 32, 'eventCountBudget');
        for (const { message: data, revision } of request.messages) {
          assert(Number.isSafeInteger(revision) && revision >= 0, 'inputRevision');
          const index = data[K.sync]?.[K.index] ?? data[K.event]?.[K.index];
          assert(Number.isInteger(index) && index > 0 && index <= 512, 'nodeIdentity');
          const node = get(index);
          assert(node && source.document.body.contains(node), 'staleInputNode');
          const value = data[K.sync]?.[K.value];
          if (value !== undefined) assert(typeof value === 'string' && value.length <= 1024);
          const event = data[K.event];
          if (event?.[K.isTrusted]) arm = { index, type: event[K.type] };
          try {
            for (const listener of listeners) listener({ data });
          } finally {
            arm = undefined;
          }
          if (failure) break;
          if (event && ['input', 'compositionend'].includes(event[K.type])) {
            const value = (node as any).value;
            assert(typeof value === 'string' && value.length <= 1024, 'confirmedInputBudget');
            receipts.push({ index, revision, generation, type: event[K.type], value });
          }
        }
      }
      await Promise.resolve();
      process.send!({
        id: request.id,
        generation,
        failure,
        packets: failure ? [] : packets.splice(0),
        receipts: failure ? [] : receipts,
        state: sample.read(),
        sequence,
        credit,
        suppressed,
        bridgeAccepted,
        ...(failure ? {} : { processed: request.id }),
      });
    })
    .catch((error) => {
      failure ||= String(error);
      process.send!({
        id: request.id,
        generation,
        failure,
        packets: [],
        receipts: [],
        sequence,
        credit,
        state: sample?.read(),
        suppressed,
        bridgeAccepted,
      });
    });
});
