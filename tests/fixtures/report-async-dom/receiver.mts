import { MutatorProcessor } from '../../../packages/editor/vendor/worker-dom/src/main-thread/mutator.js';
import { NodeContext } from '../../../packages/editor/vendor/worker-dom/src/main-thread/nodes.js';
import { ObjectContext } from '../../../packages/editor/vendor/worker-dom/src/main-thread/object-context.js';
import { StringContext } from '../../../packages/editor/vendor/worker-dom/src/main-thread/strings.js';
import type { WorkerContext } from '../../../packages/editor/vendor/worker-dom/src/main-thread/worker.js';
import { TransferrableKeys as K } from '../../../packages/editor/vendor/worker-dom/src/transfer/TransferrableKeys.js';
import { type Frame, frameLimits, preflightFrame } from './frame-budget.mjs';

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
  const nodeIds = new Set([1, 2]);
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
  function stage(packet: Frame) {
    const measured = preflightFrame(packet, {
      received,
      staged: staged.length,
      stagedBytes,
      stringCount,
      stringBytes,
      nodeIds,
      stringAt(index) {
        let applied = stringCount - staged.reduce((n, p) => n + p.strings.length, 0);
        if (index < applied) return strings.get(index);
        for (const pending of staged) {
          if (index < applied + pending.strings.length) return pending.strings[index - applied];
          applied += pending.strings.length;
        }
        return '';
      },
    });
    stringCount += packet.strings.length;
    stringBytes += measured.stringBytes;
    stagedBytes += measured.wireBytes;
    for (let i = 0; i < packet.nodes.length; i += 5) nodeIds.add(packet.nodes[i]);
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
        check(reply.packets.length <= frameLimits.frames, 'packetCredit');
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
      stringCount,
      stringBytes,
      nodeCount: nodeIds.size,
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
      nodeIds.clear();
    },
  };
}
