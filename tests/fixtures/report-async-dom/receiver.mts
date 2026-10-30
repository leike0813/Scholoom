import { MutatorProcessor } from '../report-worker-dom/vendor/src/main-thread/mutator.js';
import { NodeContext } from '../report-worker-dom/vendor/src/main-thread/nodes.js';
import { ObjectContext } from '../report-worker-dom/vendor/src/main-thread/object-context.js';
import { StringContext } from '../report-worker-dom/vendor/src/main-thread/strings.js';
import type { WorkerContext } from '../report-worker-dom/vendor/src/main-thread/worker.js';
import { TransferrableKeys as K } from '../report-worker-dom/vendor/src/transfer/TransferrableKeys.js';

function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
export function startReceiver(document: Document, options: object) {
  const strings = new StringContext(),
    nodes = new NodeContext(strings, document.body);
  const trace: unknown[] = [],
    queue: any[] = [],
    staged: any[] = [],
    consumed: number[] = [];
  const edits = new Map<
    number,
    {
      node: HTMLInputElement;
      revision: number;
      ack: number;
      composing: boolean;
      confirmedValue?: string;
      confirmedSequence?: number;
    }
  >();
  let applyingSequence = 0;
  let generation = 1,
    sequence = 0,
    received = 0,
    running = false,
    closed = false,
    error = '';
  let queueBytes = 0,
    activeBytes = 0,
    stagedBytes = 0,
    stringCount = 0,
    stringBytes = 0,
    source: unknown;
  function record(value: unknown) {
    check(trace.length < 256, 'hostTraceBudget');
    trace.push(value);
  }
  const port = {
    messageToWorker(message: any) {
      const index = message[K.sync]?.[K.index] ?? message[K.event]?.[K.index];
      enqueue({
        op: 'messages',
        messages: [{ message, revision: edits.get(index)?.revision ?? 0 }],
      });
    },
    disposeEvents: () => {},
  };
  const mutator = new MutatorProcessor(
    strings,
    nodes,
    port as unknown as WorkerContext,
    {
      authorURL: '',
      domURL: '',
      executorsAllowed: [0, 1, 2, 3, 4],
      mutationPump: (flush) => flush(),
      sanitizer: {
        sanitize: () => true,
        setAttribute(node: Element, name: string, value: string | null) {
          if (value === null) node.removeAttribute(name);
          else node.setAttribute(name, value);
          return true;
        },
        setProperty(node: any, name: string, value: string) {
          const edit = edits.get(node._index_);
          if (edit) {
            check(
              edit.node === node && edit.ack === edit.revision && !edit.composing,
              'unconfirmedInputMutation',
            );
            const confirmed =
              applyingSequence <= (edit.confirmedSequence ?? 0) ? edit.confirmedValue : value;
            check(name === 'value' && confirmed === node.value, 'incompatibleConfirmedInput');
            return false; // Identical source value must not reset native selection.
          }
          node[name] = value;
          return true;
        },
      } as any,
    },
    new ObjectContext(),
  );
  function stage(packet: any) {
    check(packet.sequence === received + 1, 'mutationSequence');
    check(packet.nodes.length % 5 === 0, 'nodeTuple');
    check(
      packet.nodes.length * 2 + packet.mutations.length * 2 + bytes(packet.strings) <= 65536,
      'compactMutationBudget',
    );
    const size = bytes(packet);
    check(size <= 65536 && staged.length < 4 && stagedBytes + size <= 262144, 'mutationBudget');
    for (const array of [packet.nodes, packet.mutations])
      for (const n of array) check(Number.isInteger(n) && n >= 0 && n <= 65535, 'invalidU16');
    check(
      packet.strings.every((s: unknown) => typeof s === 'string'),
      'invalidStrings',
    );
    check(stringCount + packet.strings.length <= 1024, 'stringCount');
    const sizeStrings = packet.strings.reduce(
      (n: number, s: string) => n + new TextEncoder().encode(s).length,
      0,
    );
    check(stringBytes + sizeStrings <= 65536, 'stringBytes');
    const prior = [...staged.flatMap((p) => p.strings), ...packet.strings];
    const appliedCount = stringCount - staged.reduce((n, p) => n + p.strings.length, 0);
    const lookup = (i: number) => (i < appliedCount ? strings.get(i) : prior[i - appliedCount]);
    for (let i = 0; i < packet.nodes.length; i += 5) {
      check(packet.nodes[i] > 0 && packet.nodes[i] <= 512, 'nodeBudget');
      const type = packet.nodes[i + 1],
        name = lookup(packet.nodes[i + 2]);
      check([1, 3, 8, 11].includes(type), 'unsupportedNode');
      if (type === 1)
        check(
          name && !/^(script|iframe|link|style|object|embed|img|a)$/i.test(name),
          'unsupportedElement',
        );
    }
    let count = 0;
    for (let i = 0; i < packet.mutations.length; ) {
      check(++count <= 128, 'operationBudget');
      const m = packet.mutations,
        type = m[i];
      const length =
        type === 0 || type === 3
          ? 5
          : type === 1
            ? 3
            : type === 2
              ? 6 + m[i + 4] + m[i + 5]
              : type === 4
                ? 4 + m[i + 2] * 2 + m[i + 3] * 6
                : 0;
      check(length > 0 && i + length <= m.length, 'unsupportedMutation');
      if (type === 0 || type === 3) {
        const name = lookup(m[i + 2]);
        check(name && !/^on|^(src|href|srcdoc|style)$/i.test(name), 'unsupportedAttribute');
        if (type === 3) check(name === 'value', 'unsupportedProperty');
      }
      i += length;
    }
    stringCount += packet.strings.length;
    stringBytes += sizeStrings;
    stagedBytes += size;
    received = packet.sequence;
    staged.push(packet);
  }
  function flush() {
    if ([...edits.values()].some((e) => e.composing || e.ack < e.revision)) return;
    for (const packet of staged.splice(0)) {
      applyingSequence = packet.sequence;
      mutator.mutate(
        packet.phase,
        new Uint16Array(packet.nodes).buffer,
        packet.strings,
        new Uint16Array(packet.mutations),
      );
      sequence = packet.sequence;
      consumed.push(sequence);
      record({ applied: sequence });
    }
    stagedBytes = 0;
  }
  async function pump() {
    if (running || closed || error) return;
    running = true;
    try {
      while ((queue.length || consumed.length) && !closed && !error) {
        const item = queue.shift() ?? { op: 'messages', messages: [] };
        if (item.op !== 'messages' || item.messages.length) queueBytes -= bytes(item);
        activeBytes = bytes(item);
        const sentGeneration = generation;
        const body = JSON.stringify({
          ...item,
          generation: sentGeneration,
          consumed: consumed.splice(0),
        });
        check(new TextEncoder().encode(body).length <= 16384, 'eventFrameBudget');
        const response = await fetch('/wire', { method: 'POST', body });
        const reply = await response.json();
        activeBytes = 0;
        check(response.ok && !reply.error, reply.error ?? 'transportFailure');
        if (closed || generation !== sentGeneration) {
          record({ staleReply: reply.id });
          break;
        }
        check(reply.generation === generation, 'staleGeneration');
        record({ sourceReply: reply });
        if (reply.failure) {
          error = reply.failure;
          queue.length = 0;
          queueBytes = 0;
          break;
        }
        check(reply.processed === reply.id, 'missingActualAck');
        check(reply.packets.length <= 4, 'packetCredit');
        for (const receipt of reply.receipts) {
          const edit = edits.get(receipt.index);
          if (!edit) continue;
          check(
            receipt.generation === generation &&
              nodes.getNode(receipt.index) === edit.node &&
              edit.node.isConnected,
            'staleInputIdentity',
          );
          check(receipt.revision <= edit.revision, 'futureInputAck');
          check(
            typeof receipt.value === 'string' && receipt.value.length <= 1024,
            'confirmedInputBudget',
          );
          if (receipt.revision >= edit.ack) {
            edit.ack = receipt.revision;
            edit.confirmedValue = receipt.value;
            edit.confirmedSequence = reply.sequence;
          }
        }
        for (const packet of reply.packets) stage(packet);
        source = reply.state;
        flush();
      }
    } catch (failure) {
      error = String(failure);
      queue.length = 0;
      queueBytes = 0;
    } finally {
      running = false;
      activeBytes = 0;
    }
  }
  function enqueue(item: any) {
    if (closed || error) return;
    const size = bytes(item);
    check(
      queue.length + (running ? 1 : 0) < 32 && queueBytes + activeBytes + size <= 16384,
      'eventQueueBudget',
    );
    queueBytes += size;
    queue.push(item);
    void pump();
  }
  const types = ['beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend'];
  function capture(event: Event) {
    if (closed || error) return;
    const node = event.target as HTMLInputElement;
    const index = (node as any)._index_;
    if (!index || !('value' in node)) return;
    let edit = edits.get(index);
    if (!edit) {
      edit = { node, revision: 0, ack: 0, composing: false };
      edits.set(index, edit);
    }
    check(edit.node === node, 'nativeIdentityChanged');
    if (event.type === 'input' || event.type.startsWith('composition')) edit.revision++;
    if (event.type === 'compositionstart') edit.composing = true;
    if (event.type === 'compositionend') edit.composing = false;
    record({
      native: {
        type: event.type,
        trusted: event.isTrusted,
        data: (event as InputEvent).data,
        composing: (event as InputEvent).isComposing,
        value: node.value,
        revision: edit.revision,
        index,
        selection: [node.selectionStart, node.selectionEnd],
        focused: document.activeElement === node,
      },
    });
  }
  for (const type of types) document.addEventListener(type, capture, true);
  enqueue({ op: 'start', options });
  return {
    request: (op: 'mutate' | 'replace') => enqueue({ op }),
    readDiagnostics: () => ({
      generation,
      sequence,
      received,
      closed,
      running,
      error,
      queued: queue.length,
      queueBytes,
      activeBytes,
      staged: staged.length,
      stagedBytes,
      source,
      trace,
      edits: [...edits].map(([index, e]) => ({
        index,
        revision: e.revision,
        ack: e.ack,
        composing: e.composing,
        connected: e.node.isConnected,
      })),
    }),
    close() {
      if (closed) return;
      closed = true;
      generation++;
      queue.length = 0;
      queueBytes = 0;
      port.disposeEvents();
      for (const type of types) document.removeEventListener(type, capture, true);
      for (const input of document.querySelectorAll('input')) input.oninput = null;
      nodes.dispose();
    },
  };
}
