// Modified by Scholoom on 2026-10-30 for this fixed probe; see vendor/MODIFICATIONS.md.
/**
 * @fileoverview
 * WorkerDOM's `Event` class. `CustomEvent` is available natively in web worker.
 */

import { Node } from './dom/Node.js';
import { TransferrableKeys } from '../transfer/TransferrableKeys.js';
import { EventToWorker, MessageType } from '../transfer/Messages.js';
import { TransferrableEvent, TransferrableTouchList } from '../transfer/TransferrableEvent.js';
import { get } from './nodes.js';
import { Document } from './dom/Document.js';
import { TransferredNode } from '../transfer/TransferrableNodes.js';
import { WorkerDOMGlobalScope } from './WorkerDOMGlobalScope.js';

interface EventOptions {
  bubbles?: boolean;
  cancelable?: boolean;
}

export type EventHandler = (event: Event) => any;

export interface AddEventListenerOptions {
  capture?: boolean;
  once?: boolean;
  passive?: boolean;
  workerDOMPreventDefault?: boolean;
}

export const eventDispatching = Symbol('dispatching');
export const eventPassive = Symbol('passive');
const nativeEvents = new WeakSet<Event>();

/** The adapter marks only a fresh event received from the rendering host. */
export function markNativeEvent(event: Event): Event {
  if (event.isTrusted) nativeEvents.add(event);
  return event;
}

export function takeNativeEvent(event: Event): boolean {
  return nativeEvents.delete(event);
}

interface Touch {
  readonly identifier: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pageX: number;
  readonly pageY: number;
  readonly target: Node | null;
}
interface TouchList {
  [key: number]: Touch;
  length: number;
  item: (index: number) => Touch | null;
}

export class Event {
  public bubbles: boolean;
  public cancelable: boolean;
  public currentTarget: Node | null = null;
  public defaultPrevented: boolean = false;
  public eventPhase: number = 0;
  public isTrusted: boolean = false;
  // public srcElement: Element | null;
  // TODO(KB): Restore srcElement.
  public target: Node | null = null;
  public timeStamp: number = Date.now();
  public type: string;
  public scoped: boolean;
  public [TransferrableKeys.stop]: boolean = false;
  public [TransferrableKeys.end]: boolean = false;
  public [eventDispatching]: boolean = false;
  public [eventPassive]: boolean = false;
  public pageX?: number;
  public pageY?: number;
  public offsetX?: number;
  public offsetY?: number;
  public touches?: TouchList;
  public changedTouches?: TouchList;

  constructor(type: string, opts: EventOptions = {}) {
    this.type = String(type);
    this.bubbles = !!opts.bubbles;
    this.cancelable = !!opts.cancelable;
  }
  public stopPropagation(): void {
    this[TransferrableKeys.stop] = true;
  }
  public stopImmediatePropagation(): void {
    this[TransferrableKeys.end] = this[TransferrableKeys.stop] = true;
  }
  public preventDefault(): void {
    if (this.cancelable && !this[eventPassive]) this.defaultPrevented = true;
  }
  get cancelBubble(): boolean {
    return this[TransferrableKeys.stop];
  }
  set cancelBubble(value: boolean) {
    if (value) this.stopPropagation();
  }
  get returnValue(): boolean {
    return !this.defaultPrevented;
  }
  set returnValue(value: boolean) {
    if (!value) this.preventDefault();
  }
  /** Event.initEvent() is deprecated but supported here for legacy usage.  */
  public initEvent(type: string, bubbles: boolean, cancelable: boolean) {
    if (this[eventDispatching]) return;
    this.type = type;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
    this.defaultPrevented = this.isTrusted = false;
    this[TransferrableKeys.stop] = this[TransferrableKeys.end] = false;
  }
}

/**
 * Determine the target for a TransferrableEvent.
 * @param document Event intended within the scope of this document.
 * @param event
 */
const targetFromTransfer = (document: Document, event: TransferrableEvent): Node | null => {
  if (event[TransferrableKeys.target] !== null) {
    const index = (event[TransferrableKeys.target] as TransferredNode)[0];
    // If the target was sent as index 0, use the current document.
    return get(index !== 0 ? index : document[TransferrableKeys.index]);
  }
  return null;
};

/**
 *
 * @param document
 * @param event
 */
const touchListFromTransfer = (
  document: Document,
  event: TransferrableEvent,
  key: TransferrableKeys.touches | TransferrableKeys.changedTouches,
): TouchList | undefined => {
  if (event[key] !== undefined) {
    const touchListKeys = Object.keys(event[key] as TransferrableTouchList);
    const list: TouchList = {
      length: touchListKeys.length,
      item(index: number) {
        return this[index] || null;
      },
    };

    touchListKeys.forEach((touchListKey) => {
      const numericKey = Number(touchListKey);
      const transferredTouch = (event[key] as TransferrableTouchList)[numericKey];
      list[numericKey] = {
        identifier: transferredTouch[0],
        screenX: transferredTouch[1],
        screenY: transferredTouch[2],
        clientX: transferredTouch[3],
        clientY: transferredTouch[4],
        pageX: transferredTouch[5],
        pageY: transferredTouch[6],
        target: get(transferredTouch[7] !== 0 ? transferredTouch[7] : document[TransferrableKeys.index]),
      };
    });

    return list;
  }
  return undefined;
};

/**
 * When an event is dispatched from the main thread, it needs to be propagated in the worker thread.
 * Propagate adds an event listener to the worker global scope and uses the WorkerDOM Node.dispatchEvent
 * method to dispatch the transfered event in the worker thread.
 */
export function propagate(global: WorkerDOMGlobalScope): void {
  const document = global.document;
  if (!document.addGlobalEventListener) {
    return;
  }
  document.addGlobalEventListener('message', ({ data }: { data: EventToWorker }) => {
    if (data[TransferrableKeys.type] !== MessageType.EVENT) {
      return;
    }
    const event = data[TransferrableKeys.event] as TransferrableEvent;
    const node = targetFromTransfer(document, event) ?? get(event[TransferrableKeys.index]);
    if (node !== null) {
      node.dispatchEvent(markNativeEvent(
        Object.assign(
          new Event(event[TransferrableKeys.type], {
            bubbles: event[TransferrableKeys.bubbles],
            cancelable: event[TransferrableKeys.cancelable],
          }),
          {
            cancelBubble: event[TransferrableKeys.cancelBubble] ?? false,
            defaultPrevented: event[TransferrableKeys.defaultPrevented] ?? false,
            eventPhase: event[TransferrableKeys.eventPhase],
            isTrusted: event[TransferrableKeys.isTrusted],
            returnValue: event[TransferrableKeys.returnValue] ?? true,
            target: targetFromTransfer(global.document, event),
            timeStamp: event[TransferrableKeys.timeStamp],
            scoped: event[TransferrableKeys.scoped],
            keyCode: event[TransferrableKeys.keyCode],
            data: (event as any)[TransferrableKeys.data],
            inputType: (event as any)[TransferrableKeys.inputType],
            isComposing: (event as any)[TransferrableKeys.isComposing],
            pageX: event[TransferrableKeys.pageX],
            pageY: event[TransferrableKeys.pageY],
            offsetX: event[TransferrableKeys.offsetX],
            offsetY: event[TransferrableKeys.offsetY],
            touches: touchListFromTransfer(global.document, event, TransferrableKeys.touches),
            changedTouches: touchListFromTransfer(global.document, event, TransferrableKeys.changedTouches),
          },
        ),
      ));
    }
  });
}
