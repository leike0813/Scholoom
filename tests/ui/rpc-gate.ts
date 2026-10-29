import { expect, type Page } from '@playwright/test';

export async function installRpcGate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const send = WebSocket.prototype.send;
    const add = WebSocket.prototype.addEventListener;
    const gate = {
      method: '',
      operation: '',
      reply: false,
      waiting: undefined as { socket: WebSocket; id: number | string } | undefined,
      held: undefined as
        | { socket: WebSocket; payload: string; id: number | string; callbacks?: Array<() => void> }
        | undefined,
      release(fail = false) {
        const held = gate.held;
        gate.held = undefined;
        gate.waiting = undefined;
        if (!held) throw new Error('No held RPC');
        if (held.callbacks && !fail) {
          for (const callback of held.callbacks) callback();
          return;
        }
        if (fail)
          held.socket.dispatchEvent(
            new MessageEvent('message', {
              data: JSON.stringify({
                jsonrpc: '2.0',
                id: held.id,
                error: {
                  code: -32602,
                  message: 'Synthetic rejection',
                  data: { code: 'permissionDenied', message: 'Synthetic rejection' },
                },
              }),
            }),
          );
        else send.call(held.socket, held.payload);
      },
    };
    Reflect.set(globalThis, '__scholoomRpcGate', gate);
    WebSocket.prototype.send = function (payload) {
      if (typeof payload === 'string') {
        const message = JSON.parse(payload);
        if (
          gate.method &&
          message.method === gate.method &&
          (!gate.operation || message.params?.request?.method === gate.operation)
        ) {
          gate.method = '';
          if (gate.reply) {
            gate.waiting = { socket: this, id: message.id };
            send.call(this, payload);
            return;
          }
          gate.held = { socket: this, payload, id: message.id };
          return;
        }
      }
      send.call(this, payload);
    };
    WebSocket.prototype.addEventListener = function (
      this: WebSocket,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type !== 'message' || !listener)
        return Reflect.apply(add, this, [type, listener, options]);
      const wrapped = (event: MessageEvent) => {
        const deliver = () =>
          typeof listener === 'function' ? listener.call(this, event) : listener.handleEvent(event);
        const message = JSON.parse(event.data);
        if (gate.waiting?.socket === this && gate.waiting.id === message.id) {
          gate.held ??= { socket: this, payload: event.data, id: message.id, callbacks: [] };
          gate.held.callbacks?.push(deliver);
          return;
        }
        deliver();
      };
      return Reflect.apply(add, this, [type, wrapped, options]);
    } as typeof WebSocket.prototype.addEventListener;
  });
}

export async function armRpcGate(
  page: Page,
  method: string,
  operation = '',
  reply = false,
): Promise<void> {
  await page.evaluate(
    ({ method, operation, reply }) => {
      const gate = Reflect.get(globalThis, '__scholoomRpcGate');
      gate.method = method;
      gate.operation = operation;
      gate.reply = reply;
    },
    { method, operation, reply },
  );
}

export async function releaseRpcGate(page: Page, fail = false): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => !!Reflect.get(globalThis, '__scholoomRpcGate')?.held))
    .toBe(true);
  await page.evaluate((fail) => {
    Reflect.get(globalThis, '__scholoomRpcGate').release(fail);
  }, fail);
}
