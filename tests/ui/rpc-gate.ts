import type { Page } from '@playwright/test';

export async function installRpcGate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const send = WebSocket.prototype.send;
    const gate = {
      method: '',
      operation: '',
      held: undefined as { socket: WebSocket; payload: string; id: number | string } | undefined,
      release(fail = false) {
        const held = gate.held;
        gate.held = undefined;
        if (!held) throw new Error('No held RPC');
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
          gate.held = { socket: this, payload, id: message.id };
          return;
        }
      }
      send.call(this, payload);
    };
  });
}

export async function armRpcGate(page: Page, method: string, operation = ''): Promise<void> {
  await page.evaluate(
    ({ method, operation }) => {
      const gate = Reflect.get(globalThis, '__scholoomRpcGate');
      gate.method = method;
      gate.operation = operation;
    },
    { method, operation },
  );
}

export async function releaseRpcGate(page: Page, fail = false): Promise<void> {
  await page.evaluate((fail) => {
    Reflect.get(globalThis, '__scholoomRpcGate').release(fail);
  }, fail);
}
