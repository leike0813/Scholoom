import { MutatorProcessor } from './vendor/src/main-thread/mutator.js';
import { NodeContext } from './vendor/src/main-thread/nodes.js';
import { ObjectContext } from './vendor/src/main-thread/object-context.js';
import { StringContext } from './vendor/src/main-thread/strings.js';
import type { WorkerContext } from './vendor/src/main-thread/worker.js';

function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}
type Packet = {
  sequence: number;
  phase: number;
  type: number;
  nodes: number[];
  strings: string[];
  mutations: number[];
};
export function startReceiver(document: Document) {
  const strings = new StringContext(),
    nodes = new NodeContext(strings, document.body);
  const trace: unknown[] = [];
  let sequence = 0,
    closed = false,
    running = false,
    error = '',
    source: unknown;
  let stringCount = 0,
    stringBytes = 0,
    queueBytes = 0;
  const queue: any[] = [];
  const consumed: number[] = [];
  const port = {
    messageToWorker(message: unknown) {
      enqueue({ op: 'messages', messages: [message] });
    },
    disposeEvents: () => {},
  };
  function record(value: unknown) {
    check(trace.length < 256, 'hostTraceBudget');
    trace.push(value);
  }
  const mutator = new MutatorProcessor(
    strings,
    nodes,
    port as unknown as WorkerContext,
    {
      authorURL: '',
      domURL: '',
      executorsAllowed: [0, 1, 2, 3, 4],
      mutationPump: (flush) => flush(),
    },
    new ObjectContext(),
  );
  function apply(packet: Packet) {
    check(packet.sequence === sequence + 1, 'mutationSequence');
    check(packet.nodes.length % 5 === 0, 'nodeTuple');
    check(
      packet.nodes.length * 2 +
        packet.mutations.length * 2 +
        JSON.stringify(packet.strings).length <=
        65536,
      'packetBudget',
    );
    for (const n of [...packet.nodes, ...packet.mutations])
      check(Number.isInteger(n) && n >= 0 && n <= 65535, 'invalidU16');
    check(stringCount + packet.strings.length <= 1024, 'stringCount');
    const bytes = packet.strings.reduce(
      (total, s) => total + new TextEncoder().encode(s).length,
      0,
    );
    check(stringBytes + bytes <= 65536, 'stringBytes');
    const allStrings = [...packet.strings];
    const lookup = (index: number) =>
      index < stringCount ? strings.get(index) : allStrings[index - stringCount];
    for (let i = 0; i < packet.nodes.length; i += 5) {
      const type = packet.nodes[i + 1],
        name = lookup(packet.nodes[i + 2]!);
      check([1, 3, 8, 11].includes(type!), 'unsupportedNodeType');
      if (type === 1)
        check(
          !!name &&
            !['script', 'iframe', 'link', 'style', 'object', 'embed', 'img', 'a'].includes(
              name.toLowerCase(),
            ),
          'unsupportedElement',
        );
    }
    let operations = 0;
    for (let i = 0; i < packet.mutations.length; ) {
      check(++operations <= 128, 'pumpOperationBudget');
      const type = packet.mutations[i];
      const length =
        type === 0 || type === 3
          ? 5
          : type === 1
            ? 3
            : type === 2
              ? 6 + packet.mutations[i + 4]! + packet.mutations[i + 5]!
              : type === 4
                ? 4 + packet.mutations[i + 2]! * 2 + packet.mutations[i + 3]! * 6
                : 0;
      check(length > 0 && i + length <= packet.mutations.length, 'unsupportedOrTruncatedMutation');
      if (type === 0 || type === 3) {
        const name = lookup(packet.mutations[i + 2]!);
        check(!!name && !/^on|^(src|href|srcdoc|style)$/i.test(name), 'unsupportedAttribute');
        if (type === 3) check(name === 'value', 'unsupportedProperty');
      }
      i += length;
    }
    stringCount += packet.strings.length;
    stringBytes += bytes;
    mutator.mutate(
      packet.phase,
      new Uint16Array(packet.nodes).buffer,
      packet.strings,
      new Uint16Array(packet.mutations),
    );
    sequence = packet.sequence;
    record({ applied: packet });
    consumed.push(sequence);
  }
  async function pump() {
    if (running || closed) return;
    running = true;
    try {
      while (queue.length && !closed) {
        const item = queue.shift();
        queueBytes -= JSON.stringify(item).length;
        const response = await fetch('/wire', {
          method: 'POST',
          body: JSON.stringify({ ...item, consumed: consumed.splice(0) }),
        });
        const reply = await response.json();
        check(response.ok && !reply.error, reply.error ?? 'transportFailure');
        if (closed) {
          record({ staleReply: reply.id });
          break;
        }
        check(reply.packets.length <= 4, 'packetCredit');
        for (const packet of reply.packets) apply(packet);
        source = reply.state;
        record({ sourceAck: reply });
      }
    } catch (failure) {
      error = String(failure);
    } finally {
      running = false;
    }
  }
  function enqueue(item: any) {
    if (closed || error) return;
    const bytes = JSON.stringify(item).length;
    check(queue.length < 32 && queueBytes + bytes <= 16384, 'inputQueueBudget');
    queueBytes += bytes;
    queue.push(item);
    void pump();
  }
  function capture(event: Event) {
    const input = event.target as HTMLInputElement;
    record({
      native: {
        type: event.type,
        value: input.value,
        data: (event as InputEvent).data,
        inputType: (event as InputEvent).inputType,
        isComposing: (event as InputEvent).isComposing,
        defaultPrevented: event.defaultPrevented,
        trusted: event.isTrusted,
        selection: [input.selectionStart, input.selectionEnd, input.selectionDirection],
        focused: document.activeElement === input,
      },
    });
  }
  for (const type of ['beforeinput', 'input']) document.addEventListener(type, capture, true);
  enqueue({ op: 'start' });
  return {
    readDiagnostics: () => ({
      sequence,
      closed,
      running,
      error,
      queued: queue.length,
      queueBytes,
      source,
      trace,
    }),
    close() {
      closed = true;
      queue.length = 0;
      queueBytes = 0;
      port.disposeEvents();
      for (const type of ['beforeinput', 'input'])
        document.removeEventListener(type, capture, true);
      for (const input of document.querySelectorAll('input')) input.oninput = null;
      nodes.dispose();
      document.body.replaceChildren();
    },
  };
}
