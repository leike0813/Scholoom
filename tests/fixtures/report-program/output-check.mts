import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as turn } from 'node:timers/promises';
import {
  isReportRenderFrame,
  reportRenderLimits as limits,
  type ReportRenderFrame,
} from '@scholoom/protocol/reports';
import {
  type ReportMutationBatch,
  ReportRenderOutput,
} from '../../../packages/editor/src/report-output.js';

const batch = (strings: string[] = []): ReportMutationBatch => ({
  phase: 2,
  nodes: new Uint16Array(),
  strings,
  mutations: new Uint16Array(),
});
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function capture(send?: (frame: ReportRenderFrame) => Promise<void>) {
  const frames: ReportRenderFrame[] = [];
  const failures: unknown[] = [];
  const output = new ReportRenderOutput({
    async send(frame) {
      frames.push(structuredClone(frame));
      await send?.(frame);
    },
    failed: (error) => failures.push(error),
  });
  return { output, frames, failures };
}

async function finish(output: ReportRenderOutput, frames: ReportRenderFrame[], consumed = 0) {
  const end = output.checkpoint();
  // Bound a broken pump without relying on a never-settling drain promise as a timeout.
  for (let attempts = 0; consumed < end && attempts <= end + 4; attempts++) {
    await turn();
    const ready = frames.slice(consumed, consumed + limits.inFlight);
    if (!ready.length) continue;
    output.consume(ready.map((frame) => frame.sequence));
    consumed += ready.length;
  }
  assert.equal(consumed, end, 'all planned frames must actually reach the consumer');
  await output.drained();
  return consumed;
}

type ReceivedNode = {
  type: number;
  name: string;
  namespace: string;
  text: string;
  parent: number;
  children: number[];
  attrs: Map<string, string>;
  properties: Map<string, string | boolean>;
};

// Independent receiver for the exercised vendor transfer tuples, not the production splitter/DOM.
// See vendor/worker-dom/src/transfer/Transferrable{Nodes,Mutation}.ts and commands/attribute.ts.
class Receiver {
  readonly strings: string[] = [];
  readonly nodes = new Map<number, ReceivedNode>([
    [2, this.create(1, 'body', 'http://www.w3.org/1999/xhtml', '')],
  ]);

  private create(type: number, name: string, namespace: string, text: string): ReceivedNode {
    return {
      type,
      name,
      namespace,
      text,
      parent: 0,
      children: [],
      attrs: new Map(),
      properties: new Map(),
    };
  }

  private string(index: number | undefined) {
    assert.ok(index !== undefined);
    const value = this.strings[index];
    assert.ok(typeof value === 'string', `string ${index} must precede its first reference`);
    return value;
  }

  node(id: number | undefined) {
    assert.ok(id !== undefined);
    const value = this.nodes.get(id);
    assert.ok(value, `node ${id} must precede its first reference`);
    return value;
  }

  private detach(id: number) {
    const child = this.node(id);
    if (!child.parent) return;
    const siblings = this.node(child.parent).children;
    const index = siblings.indexOf(id);
    assert.ok(index >= 0);
    siblings.splice(index, 1);
    child.parent = 0;
  }

  apply(value: Pick<ReportMutationBatch, 'nodes' | 'strings' | 'mutations'> | ReportRenderFrame) {
    this.strings.push(...value.strings);
    assert.equal(value.nodes.length % 5, 0);
    for (let i = 0; i < value.nodes.length; i += 5) {
      const [id, type, name, text, namespace] = Array.from(value.nodes.slice(i, i + 5));
      assert.ok(id !== undefined && type !== undefined);
      assert.ok(!this.nodes.has(id));
      this.nodes.set(
        id,
        this.create(
          type,
          this.string(name),
          type === 1 ? this.string(namespace) : '',
          type === 3 ? this.string(text) : '',
        ),
      );
    }
    const m = value.mutations;
    for (let i = 0; i < m.length; ) {
      const targetId = m[i + 1];
      assert.ok(targetId !== undefined);
      const target = this.node(targetId);
      switch (m[i]) {
        case 0: {
          assert.ok(i + 5 <= m.length);
          const name = this.string(m[i + 2]);
          const index = m[i + 4];
          assert.ok(index !== undefined);
          if (index === 0) target.attrs.delete(name);
          else target.attrs.set(name, this.string(index - 1));
          i += 5;
          break;
        }
        case 1:
          assert.ok(i + 3 <= m.length);
          target.text = this.string(m[i + 2]);
          i += 3;
          break;
        case 2: {
          const added = m[i + 4];
          const removed = m[i + 5];
          assert.ok(added !== undefined && removed !== undefined);
          const end = i + 6 + added + removed;
          assert.ok(end <= m.length);
          for (const id of m.slice(i + 6 + added, end)) this.detach(id);
          for (const id of m.slice(i + 6, i + 6 + added)) {
            this.detach(id);
            const before = m[i + 2];
            assert.ok(before !== undefined);
            const at = before === 0 ? target.children.length : target.children.indexOf(before);
            assert.ok(at >= 0, 'nextSibling must still belong to the target');
            target.children.splice(at, 0, id);
            this.node(id).parent = targetId;
          }
          i = end;
          break;
        }
        case 3:
          assert.ok(i + 5 <= m.length);
          target.properties.set(
            this.string(m[i + 2]),
            m[i + 3] ? Boolean(m[i + 4]) : this.string(m[i + 4]),
          );
          i += 5;
          break;
        default:
          assert.fail(`fixture receiver does not implement mutation ${m[i]}`);
      }
    }
  }
}

test('large legal batches preserve strings, node tuples, attributes and multi-part child lists', {
  timeout: 15000,
}, async (t) => {
  const { output, frames, failures } = capture();
  t.after(() => output.close());
  const original = new Receiver();
  const received = new Receiver();
  let consumed = 0;
  async function deliver(input: ReportMutationBatch) {
    original.apply(input);
    const start = frames.length;
    output.write(input);
    const checkpoint = output.checkpoint();
    consumed = await finish(output, frames, consumed);
    assert.equal(frames.length, checkpoint);
    const emitted = frames.slice(start);
    assert.deepEqual(
      emitted.flatMap((frame) => frame.nodes),
      Array.from(input.nodes),
    );
    assert.deepEqual(
      emitted.flatMap((frame) => frame.strings),
      input.strings,
    );
    for (const frame of emitted) {
      assert.ok(isReportRenderFrame(frame), `frame ${frame.sequence} must match the public schema`);
      assert.ok(bytes(frame) <= limits.frameBytes);
      assert.equal(frame.phase, input.phase);
      received.apply(frame);
    }
    assert.deepEqual(received, original);
    return emitted;
  }

  const initial = [
    '',
    'http://www.w3.org/1999/xhtml',
    'span',
    'input',
    '#text',
    'old text',
    'title',
    'original',
    'value',
    'checked',
  ];
  await deliver({
    phase: 1,
    strings: initial,
    nodes: new Uint16Array([3, 1, 2, 0, 1, 4, 1, 3, 0, 1, 5, 3, 4, 5, 0]),
    mutations: new Uint16Array([0, 3, 6, 0, 8, 2, 2, 0, 0, 3, 0, 3, 4, 5]),
  });
  const ids = Array.from({ length: 9000 }, (_, i) => i + 6);
  const strings = Array.from({ length: 48 }, (_, i) => `${i}:é中😀"\\\n\0${'x'.repeat(4096)}`);
  const last = initial.length + strings.length - 1;
  const nodes = ids.flatMap((id, i) =>
    i % 2 ? [id, 3, 4, initial.length + (i % strings.length), 0] : [id, 1, 2, 0, 1],
  );
  const attrs = ids
    .slice(0, 600)
    .filter((id) => id % 2 === 0)
    .flatMap((id) => [0, id, 6, 0, last + 1]);
  const input = {
    phase: 2,
    nodes: new Uint16Array(nodes),
    strings,
    mutations: new Uint16Array([...attrs, 2, 2, 3, 0, ids.length, 0, ...ids]),
  };
  assert.ok(input.nodes.length / 5 > 512);
  assert.ok(
    bytes({ ...input, nodes, mutations: Array.from(input.mutations) }) > 4 * limits.frameBytes,
  );
  const largeFrames = await deliver(input);
  assert.ok(largeFrames.length > limits.inFlight);
  assert.deepEqual(received.node(2).children, [...ids, 3, 4, 5]);
  assert.equal(received.node(6).attrs.get('title'), strings.at(-1));
  assert.equal(received.node(7).text, strings[1]);

  let previousOrder = ids;
  for (const order of [[...ids].reverse(), [...ids.slice(4500), ...ids.slice(0, 4500)]]) {
    const change = new Uint16Array([
      ...[2, 2, 3, 0, ids.length, ids.length, ...order, ...previousOrder],
      ...[0, 3, 6, 0, 0],
      ...[0, 4, 6, 0, 8],
      ...[1, 5, last],
      ...[3, 4, 8, 0, last],
      ...[3, 4, 9, 1, 1],
    ]);
    assert.ok(bytes(Array.from(change)) > limits.frameBytes);
    const parts = await deliver({ ...batch(), mutations: change });
    assert.ok(parts.length > 1);
    assert.deepEqual(received.node(2).children, [...order, 3, 4, 5]);
    previousOrder = order;
  }
  assert.deepEqual(received.strings, [...initial, ...strings]);
  assert.equal(received.node(3).attrs.has('title'), false);
  assert.equal(received.node(4).attrs.get('title'), 'original');
  assert.equal(received.node(5).text, strings.at(-1));
  assert.equal(received.node(4).properties.get('value'), strings.at(-1));
  assert.equal(received.node(4).properties.get('checked'), true);
  assert.deepEqual(
    frames.map((frame) => frame.sequence),
    Array.from({ length: output.checkpoint() }, (_, i) => i + 1),
  );
  assert.deepEqual(failures, []);
  t.diagnostic(
    `input: 9003 new nodes, ${initial.length + strings.length} strings; output: ${frames.length} frames, maximum ${Math.max(...frames.map(bytes))} UTF-8 bytes`,
  );
});

test('send completion grants no credit; partial consumption and global checkpoints', {
  timeout: 5000,
}, async (t) => {
  const { output, frames, failures } = capture();
  t.after(() => output.close());
  const input = batch(Array.from({ length: 10 }, () => 'x'.repeat(40000)));
  output.write(input);
  const first = output.checkpoint();
  assert.ok(first > limits.inFlight);
  let state = 'pending';
  const drain = output.drained().then(
    () => {
      state = 'resolved';
    },
    () => {
      state = 'rejected';
    },
  );
  for (let i = 0; i < 3; i++) {
    await turn();
    assert.equal(frames.length, limits.inFlight);
    assert.equal(state, 'pending');
  }
  output.consume([1]);
  await turn();
  assert.equal(frames.length, limits.inFlight + 1);
  assert.equal(state, 'pending');
  output.consume([2, 3]);
  await turn();
  assert.equal(frames.length, limits.inFlight + 3);
  assert.equal(state, 'pending');
  let consumed = 3;
  while (frames.length < first) {
    const next = frames[consumed];
    assert.ok(next);
    output.consume([next.sequence]);
    consumed++;
    await turn();
    assert.equal(state, 'pending');
    assert.ok(frames.length - consumed <= limits.inFlight);
  }
  output.consume(frames.slice(consumed, -1).map((frame) => frame.sequence));
  await turn();
  assert.equal(state, 'pending', 'the final sent but unconsumed frame still holds drain');
  await finish(output, frames, first - 1);
  await drain;
  assert.equal(state, 'resolved');
  output.write(batch(['after drain']));
  assert.equal(output.checkpoint(), first + 1);
  await finish(output, frames, first);
  assert.deepEqual(
    frames.map((frame) => frame.sequence),
    Array.from({ length: first + 1 }, (_, i) => i + 1),
  );
  assert.deepEqual(failures, []);
});

test('invalid ACK groups cannot consume a valid prefix or release credit', {
  timeout: 5000,
}, async (t) => {
  for (const [name, ack] of [
    ['invalid sequence', [0]],
    ['fraction', [1.5]],
    ['out of order', [2]],
    ['planned but unsent', [5]],
    ['too many', [1, 2, 3, 4, 5]],
    ['duplicate within group', [1, 1]],
    ['valid prefix then unsent', [1, 5]],
  ] as const) {
    await t.test(name, async (t) => {
      const { output, frames } = capture();
      t.after(() => output.close());
      output.write(batch(Array.from({ length: 6 }, () => 'a'.repeat(40000))));
      await turn();
      assert.equal(frames.length, limits.inFlight);
      assert.throws(() => output.consume(ack));
      await turn();
      assert.equal(frames.length, limits.inFlight);
      assert.doesNotThrow(
        () => output.consume([1]),
        'rejected ACK group must leave sequence 1 consumable',
      );
      await turn();
      assert.equal(frames.length, limits.inFlight + 1);
      assert.throws(() => output.consume([1]), 'already consumed ACK must be rejected');
      await finish(output, frames, 1);
    });
  }
});

test('oversized or malformed writes are rejected synchronously without publishing a prefix', {
  timeout: 10000,
}, async (t) => {
  const cases: [string, ReportMutationBatch][] = [
    [
      'node budget including root',
      {
        ...batch(),
        nodes: new Uint16Array(
          Array.from({ length: limits.nodes }, (_, i) => [i + 3, 3, 0, 0, 0]).flat(),
        ),
      },
    ],
    ['string count', batch(Array.from({ length: limits.strings + 1 }, () => ''))],
    ['UTF-8 string budget', batch(Array.from({ length: 70 }, () => '中'.repeat(10000)))],
    ['one unframeable string', batch(['x'.repeat(limits.frameBytes)])],
    ['one unframeable multibyte string', batch(['😀'.repeat(20000)])],
    ['incomplete node tuple', { ...batch(), nodes: new Uint16Array([3]) }],
    ['mutation word budget', { ...batch(), mutations: new Uint16Array(32769) }],
    [
      'incomplete child list after valid operation',
      { ...batch(), mutations: new Uint16Array([0, 2, 0, 0, 0, 2, 2, 0, 0, 3, 0, 3]) },
    ],
  ];
  for (const [name, input] of cases) {
    await t.test(name, async (t) => {
      const { output, frames } = capture();
      t.after(() => output.close());
      assert.throws(() => output.write(input));
      assert.equal(output.checkpoint(), 0);
      await turn();
      assert.deepEqual(frames, []);
      output.write(batch(['accepted after rejection']));
      assert.equal(output.checkpoint(), 1);
      await finish(output, frames);
    });
  }
  await t.test('bounded backlog while send is pending', async (t) => {
    const gate = deferred();
    const { output, frames } = capture(() => gate.promise);
    t.after(() => output.close());
    for (let i = 0; i < limits.inFlight; i++) output.write(batch([`queued ${i}`]));
    const checkpoint = output.checkpoint();
    assert.throws(() => output.write(batch(['queue overflow'])));
    assert.equal(output.checkpoint(), checkpoint);
    assert.equal(frames.length, 1);
    const rejected = assert.rejects(output.drained());
    output.close();
    gate.resolve();
    await rejected;
    await turn();
    assert.equal(frames.length, 1);
  });
});

test('node count, string count and UTF-8 bytes accumulate across drained writes', {
  timeout: 10000,
}, async (t) => {
  for (const [name, seed] of [
    ['count', Array.from({ length: limits.strings / 2 }, () => '')],
    ['bytes', Array.from({ length: 32 }, () => 'é'.repeat(16384))],
  ] as const) {
    await t.test(name, async (t) => {
      const { output, frames } = capture();
      t.after(() => output.close());
      let consumed = 0;
      for (let i = 0; i < 2; i++) {
        output.write(batch([...seed]));
        consumed = await finish(output, frames, consumed);
      }
      const checkpoint = output.checkpoint();
      assert.throws(() => output.write(batch(['x'])));
      assert.equal(output.checkpoint(), checkpoint);
      await output.drained();
      assert.equal(frames.length, checkpoint);
    });
  }
  await t.test('node count including the existing root', async (t) => {
    const { output, frames } = capture();
    t.after(() => output.close());
    let consumed = 0;
    for (const [start, count] of [
      [3, 8191],
      [8194, 8192],
    ] as const) {
      const nodes = new Uint16Array(
        Array.from({ length: count }, (_, i) => [start + i, 3, 0, 0, 0]).flat(),
      );
      output.write({ ...batch(start === 3 ? ['#text'] : []), nodes });
      consumed = await finish(output, frames, consumed);
    }
    const checkpoint = output.checkpoint();
    assert.throws(() => output.write({ ...batch(), nodes: new Uint16Array([16386, 3, 0, 0, 0]) }));
    assert.equal(output.checkpoint(), checkpoint);
    await output.drained();
    assert.equal(frames.length, checkpoint);
  });
});

test('send failure or close during send rejects drain and stops later sends', {
  timeout: 5000,
}, async (t) => {
  for (const mode of ['send failure', 'close then resolve', 'close then reject'] as const) {
    await t.test(mode, async (t) => {
      const gate = deferred();
      const failure = new Error(mode);
      const { output, frames, failures } = capture(() => gate.promise);
      t.after(() => output.close());
      output.write(batch(Array.from({ length: 6 }, () => 'x'.repeat(40000))));
      assert.equal(frames.length, 1);
      const drains = [output.drained(), output.drained()].map((promise) =>
        assert.rejects(promise, (error) => error === failure),
      );
      if (mode !== 'send failure') output.close(failure);
      if (mode === 'close then resolve') gate.resolve();
      else gate.reject(failure);
      await Promise.all(drains);
      await turn();
      assert.equal(frames.length, 1);
      if (mode === 'send failure') assert.equal(failures.length, 1);
      if (mode === 'close then resolve') assert.equal(failures.length, 0);
      if (failures.length) assert.equal(failures[0], failure);
      assert.throws(() => output.write(batch(['late'])));
      assert.throws(() => output.consume([1]));
      await assert.rejects(output.drained());
      output.close(failure);
      await turn();
      assert.equal(frames.length, 1);
      assert.ok(failures.length <= 1);
    });
  }
});
