import assert from 'node:assert/strict';
import {
  AddEventRegistrationIndex as A,
  ADD_EVENT_SUBSCRIPTION_LENGTH as ADD,
  REMOVE_EVENT_SUBSCRIPTION_LENGTH as REMOVE,
  EventSubscriptionMutationIndex as S,
} from '../../../packages/editor/vendor/worker-dom/src/transfer/TransferrableEvent.js';
import { TransferrableKeys as K } from '../../../packages/editor/vendor/worker-dom/src/transfer/TransferrableKeys.js';
import { TransferrableMutationType as M } from '../../../packages/editor/vendor/worker-dom/src/transfer/TransferrableMutation.js';
import {
  createWorkerDOM,
  hydrate,
} from '../../../packages/editor/vendor/worker-dom/src/worker-thread/index.js';
import { runEventCases } from './events-cases.mjs';

const frames = [];
const strings = [];
const globalHandlers = new Set();
const source = createWorkerDOM(
  (message) => {
    assert(frames.length < 128, 'bounded public transfer frames');
    const frame = {
      nodes: Array.from(new Uint16Array(message[K.nodes])),
      mutations: Array.from(new Uint16Array(message[K.mutations])),
      strings: message[K.strings],
    };
    strings.push(...frame.strings);
    frames.push(frame);
  },
  (type, handler) => {
    assert.equal(type, 'message');
    globalHandlers.add(handler);
  },
  (_type, handler) => globalHandlers.delete(handler),
);
hydrate(
  source.document,
  [],
  {},
  [],
  ['onclick'],
  [800, 600],
  { storage: {}, errorMsg: null },
  { storage: {}, errorMsg: null },
);
source.document[K.observe]();

async function transportCase() {
  const node = source.document.createElement('div');
  source.document.body.appendChild(node);
  let start = frames.length;
  await Promise.resolve();
  const created = frames.slice(start).flatMap((frame) => frame.nodes);
  assert.equal(created.length, 5, 'only the owned transport node is created');
  const nodeId = created[0];
  const operations = [];
  const checks = [];
  const active = new Map();
  const handles = [];
  const check = (name, passed) => checks.push({ name, passed });
  const a = () => {};
  const b = () => {};
  const c = () => {};
  const d = () => {};
  const e = () => {};
  const tuple = (type, capture) => `${type}:${capture}`;
  async function step(name, action, expected, type, capture = false) {
    start = frames.length;
    action();
    await Promise.resolve();
    const mutations = frames.slice(start).flatMap((frame) => frame.mutations);
    const records = [];
    for (let offset = 0; offset < mutations.length; ) {
      assert.equal(
        mutations[offset],
        M.EVENT_SUBSCRIPTION,
        'owned step only emits event subscriptions',
      );
      assert.equal(mutations[offset + S.Target], nodeId, 'subscription belongs to owned node');
      const removed = mutations[offset + S.RemoveEventListenerCount];
      const added = mutations[offset + S.AddEventListenerCount];
      let cursor = offset + S.Events;
      for (let i = 0; i < removed + added; i++) {
        const adding = i >= removed;
        const type = strings[mutations[cursor + A.Type]];
        const handle = mutations[cursor + A.Index];
        records.push({
          op: adding ? 'add' : 'remove',
          nodeId,
          type,
          handle,
          ...(adding
            ? {
                capture: !!mutations[cursor + A.Capture],
                once: !!mutations[cursor + A.Once],
                passive: !!mutations[cursor + A.Passive],
              }
            : {}),
        });
        cursor += adding ? ADD : REMOVE;
      }
      assert(cursor <= mutations.length, 'complete public subscription tuple');
      offset = cursor;
    }
    check(`${name}: record count`, records.length === (expected === 'none' ? 0 : 1));
    if (records.length === 1) {
      const record = records[0];
      check(`${name}: operation and type`, record.op === expected && record.type === type);
      if (expected === 'add') {
        check(`${name}: capture`, record.capture === capture);
        check(
          `${name}: fresh U16 handle across types`,
          Number.isInteger(record.handle) &&
            record.handle >= 0 &&
            record.handle <= 65535 &&
            !handles.includes(record.handle),
        );
        check(`${name}: monotonic handle`, handles.length === 0 || record.handle > handles.at(-1));
        handles.push(record.handle);
        active.set(tuple(type, capture), record.handle);
      } else if (expected === 'remove') {
        check(`${name}: original add handle`, record.handle === active.get(tuple(type, capture)));
        active.delete(tuple(type, capture));
      }
    }
    operations.push({ name, records, active: [...active] });
  }
  try {
    await step(
      'add-click-capture',
      () => node.addEventListener('click', a, { capture: true, once: true, passive: true }),
      'add',
      'click',
      true,
    );
    const first = operations[0].records[0];
    check('once and passive public flags', first?.once === true && first?.passive === true);
    await step('add-input', () => node.addEventListener('input', b), 'add', 'input');
    await step('add-click-bubble', () => node.addEventListener('click', c), 'add', 'click');
    await step(
      'duplicate-click-capture',
      () => node.addEventListener('click', a, true),
      'none',
      'click',
      true,
    );
    await step(
      'remove-click-capture',
      () => node.removeEventListener('click', a, true),
      'remove',
      'click',
      true,
    );
    await step('add-change', () => node.addEventListener('change', d), 'add', 'change');
    await step('remove-input', () => node.removeEventListener('input', b), 'remove', 'input');
    await step('readd-input', () => node.addEventListener('input', e), 'add', 'input');
    await step(
      'remove-click-bubble',
      () => node.removeEventListener('click', c),
      'remove',
      'click',
    );
    await step('remove-change', () => node.removeEventListener('change', d), 'remove', 'change');
    await step(
      'remove-readded-input',
      () => node.removeEventListener('input', e),
      'remove',
      'input',
    );
    check('all owned subscriptions released', active.size === 0);
    return { nodeId, operations, checks, passed: checks.every((item) => item.passed) };
  } finally {
    node.remove();
    await Promise.resolve();
  }
}

let result;
try {
  const groups = runEventCases(source);
  await Promise.resolve();
  result = { groups, transport: await transportCase(), frames };
} finally {
  const released = globalHandlers.size;
  globalHandlers.clear();
  assert.equal(source.document.body.childNodes.length, 0, 'all case roots removed');
  if (result)
    result.cleanup = {
      ownedRootsRemaining: 0,
      releasedGlobalHandlers: released,
      globalHandlersRemaining: globalHandlers.size,
    };
}
console.log(JSON.stringify(result));
