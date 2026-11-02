/// <reference lib="dom" />
import { OperationError } from '@scholoom/protocol/core';
import {
  isReportProgramCommand,
  isReportProgramPacket,
  type ReportBridgeMessage,
  type ReportNativeInput,
  type ReportProgramCommand,
  type ReportProgramPacket,
  type ReportRenderFrame,
  reportLimits,
  reportRenderLimits,
} from '@scholoom/protocol/reports';
import { createReportDOM } from './report-dom.js';
import type { ReportStyleResolver } from './report-styles.js';

type Binding = Pick<ReportBridgeMessage, 'version' | 'viewId' | 'generation' | 'basis'>;
type Confirmation = Extract<ReportProgramPacket, { type: 'inputConfirmed' }>;
type Values = Pick<ReportNativeInput, 'value' | 'checked' | 'selectedIndex'>;
type Edit = {
  node: Node;
  revision: number;
  composing: boolean;
  confirmed?: Confirmation;
};
const inputEvents = [
  'beforeinput',
  'input',
  'change',
  'compositionstart',
  'compositionupdate',
  'compositionend',
];
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

/** Native edits and actual source confirmations share this view's finite rendering queue. */
export function createReportPresentation(options: {
  document: Document;
  binding: Binding;
  styles?: { baseURL: string; resolve: ReportStyleResolver };
  send(command: ReportProgramCommand): Promise<void>;
  message(message: ReportBridgeMessage): void;
  failed(error: unknown): void;
}) {
  const binding = { ...options.binding };
  const staged: ReportRenderFrame[] = [];
  const pending = new Map<number, { index: number; edit: Edit; seen: number; values: Values }>();
  const edits = new Map<number, Edit>();
  const forwarded = new WeakSet<Event>();
  let document: Document | undefined;
  let closed = false;
  let failed = false;
  let sourceReady = false;
  let revision = 0;
  let received = 0;
  let applying = 0;
  let stagedBytes = 0;
  let sendingBytes = 0;
  let sendingCount = 0;
  let tail = Promise.resolve();
  const receiver = createReportDOM({
    document: options.document,
    ...(options.styles ? { styles: options.styles } : {}),
    onEvent: capture,
    preserveProperty(index, name) {
      const edit = edits.get(index);
      const receipt = edit?.confirmed;
      if (!edit || !receipt || applying > receipt.through || !Object.hasOwn(receipt, name))
        return false;
      check(receiver.identity(edit.node) === index, 'contentChanged');
      check(Reflect.get(edit.node, name) === Reflect.get(receipt, name), 'unavailable');
      return true;
    },
  });
  receiver.element.hidden = true;
  function check(
    value: unknown,
    code:
      | 'protocolIncompatible'
      | 'resourceLimit'
      | 'contentChanged'
      | 'unavailable' = 'protocolIncompatible',
  ): asserts value {
    if (!value) throw new OperationError(code, '报告输入或呈现状态不可用。');
  }
  function detach() {
    for (const type of inputEvents) document?.removeEventListener(type, captureNative, true);
  }
  function fail(error: unknown) {
    if (closed || failed) return;
    failed = true;
    detach();
    staged.length = 0;
    stagedBytes = 0;
    // Keep the actual document and native unsubmitted values for the owning view's recovery UI.
    options.failed(error);
  }
  function send(command: ReportProgramCommand) {
    const size = bytes(command);
    check(isReportProgramCommand(command));
    check(sendingCount < 32 && sendingBytes + size <= reportLimits.bridgeBytes, 'resourceLimit');
    sendingCount++;
    sendingBytes += size;
    tail = tail
      .then(async () => {
        if (closed || failed) return;
        await options.send(command);
      })
      .catch(fail)
      .finally(() => {
        sendingCount--;
        sendingBytes -= size;
      });
  }
  function captureNative(event: Event) {
    const index = receiver.identity(event.target as Node | null);
    if (index !== undefined) capture(index, event);
  }
  function capture(index: number, event: Event) {
    if (closed || failed || forwarded.has(event)) return;
    forwarded.add(event);
    try {
      check(sourceReady, 'unavailable');
      const node = event.target as Node | null;
      check(node && receiver.identity(node) === index, 'contentChanged');
      // shortcut: multiple selection needs a complete selection-set contract before forwarding.
      check(
        !(
          node.nodeType === 1 &&
          (node as Element).localName === 'select' &&
          Reflect.get(node, 'multiple')
        ),
        'unavailable',
      );
      check(pending.size < 32 && revision < Number.MAX_SAFE_INTEGER, 'resourceLimit');
      let edit = edits.get(index);
      if (!edit) {
        edit = { node, revision: 0, composing: false };
        edits.set(index, edit);
      }
      check(edit.node === node, 'contentChanged');
      if (event.type === 'compositionstart') edit.composing = true;
      if (event.type === 'compositionend') edit.composing = false;
      const values: Values = {};
      if (
        node.nodeType === 1 &&
        ['input', 'textarea', 'select'].includes((node as Element).localName)
      ) {
        values.value = Reflect.get(node, 'value');
        if ((node as Element).localName === 'input') values.checked = Reflect.get(node, 'checked');
        if ((node as Element).localName === 'select')
          values.selectedIndex = Reflect.get(node, 'selectedIndex');
      }
      const input: ReportNativeInput = {
        nodeId: index,
        revision: ++revision,
        eventType: event.type,
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        isTrusted: event.isTrusted,
        ...values,
      };
      for (const key of [
        'data',
        'inputType',
        'isComposing',
        'key',
        'button',
        'buttons',
        'clientX',
        'clientY',
        'altKey',
        'ctrlKey',
        'shiftKey',
        'metaKey',
      ] as const) {
        const value = Reflect.get(event, key);
        if (value !== undefined) Reflect.set(input, key, value);
      }
      edit.revision = revision;
      pending.set(revision, { index, edit, seen: received, values });
      send({ ...binding, type: 'input', input });
    } catch (error) {
      fail(error);
    }
  }
  function flush() {
    if (closed || failed || pending.size || [...edits.values()].some((edit) => edit.composing))
      return;
    while (staged.length) {
      const frame = staged[0]!;
      applying = frame.sequence;
      receiver.apply(frame);
      staged.shift();
      stagedBytes -= bytes(frame);
      send({ type: 'consume', sequences: [frame.sequence] });
    }
  }
  const ready = receiver.ready.then(() => {
    if (closed) return;
    document = receiver.element.contentDocument ?? undefined;
    check(document, 'unavailable');
    for (const type of inputEvents) document.addEventListener(type, captureNative, true);
  });
  void ready.catch(fail);
  return {
    element: receiver.element,
    ready,
    receive(value: unknown) {
      if (closed || failed) return;
      try {
        check(isReportProgramPacket(value));
        const packet = value;
        if ('sequence' in packet) {
          check(packet.sequence === received + 1);
          const size = bytes(packet);
          check(
            staged.length < reportRenderLimits.inFlight &&
              stagedBytes + size <= reportRenderLimits.inFlight * reportRenderLimits.frameBytes,
            'resourceLimit',
          );
          staged.push(packet);
          stagedBytes += size;
          received = packet.sequence;
        } else {
          if (
            packet.version !== binding.version ||
            packet.viewId !== binding.viewId ||
            packet.generation !== binding.generation ||
            packet.basis !== binding.basis
          )
            return;
          if (packet.type === 'inputConfirmed') {
            const item = pending.get(packet.revision);
            check(item && item.index === packet.nodeId && packet.through >= item.seen);
            check(receiver.identity(item.edit.node) === item.index, 'contentChanged');
            for (const name of ['value', 'checked', 'selectedIndex'] as const) {
              check(Object.hasOwn(item.values, name) === Object.hasOwn(packet, name));
              if (
                packet.revision === item.edit.revision &&
                !item.edit.composing &&
                Object.hasOwn(packet, name)
              )
                check(Reflect.get(item.edit.node, name) === packet[name], 'unavailable');
            }
            pending.delete(packet.revision);
            const previous = item.edit.confirmed;
            if (!previous || packet.revision > previous.revision) item.edit.confirmed = packet;
          } else {
            if (packet.type === 'ready') {
              sourceReady = true;
              receiver.element.hidden = false;
            }
            options.message(packet);
            if (packet.type === 'error') {
              fail(new OperationError(packet.error.code, packet.error.message));
              return;
            }
          }
        }
        flush();
      } catch (error) {
        fail(error);
      }
    },
    status: () => ({
      closed,
      failed,
      pending: pending.size,
      staged: staged.length,
      composing: [...edits.values()].some((edit) => edit.composing),
    }),
    invalidate: fail,
    close() {
      if (closed) return;
      closed = true;
      detach();
      staged.length = 0;
      pending.clear();
      edits.clear();
      receiver.close();
    },
  };
}
