import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import type { KernelEndpoint } from '../../packages/protocol/dist/index.js';

// Faults are applied only at the transport boundary; authentication and operations reach the real kernel.
export async function transportProxy(endpoint: KernelEndpoint) {
  const http = createServer();
  const server = new WebSocketServer({ server: http });
  let loseShutdown = false;
  let corruptStatus = false;
  let shutdowns = 0;
  let holdStatus = false;
  let holdShutdown = false;
  const delayedStatus: Array<() => void> = [];
  server.on('connection', (incoming) => {
    const upstream = new WebSocket(endpoint.url);
    const queued: string[] = [];
    let shutdownId: string | number | undefined;
    const statusIds = new Set<string | number>();
    upstream.on('open', () => {
      for (const value of queued) upstream.send(value);
    });
    incoming.on('message', (bytes) => {
      const text = bytes.toString();
      const message = JSON.parse(text);
      if (message.method === 'kernel.shutdown') {
        shutdowns += 1;
        shutdownId = message.id;
      }
      if (message.method === 'kernel.status') statusIds.add(message.id);
      if (upstream.readyState === WebSocket.OPEN) upstream.send(text);
      else queued.push(text);
    });
    upstream.on('message', (bytes) => {
      const text = bytes.toString();
      const message = JSON.parse(text);
      if (holdShutdown && message.id === shutdownId) return;
      if (holdStatus && statusIds.has(message.id)) {
        delayedStatus.push(() => {
          if (incoming.readyState === WebSocket.OPEN) incoming.send(text);
        });
        return;
      }
      if (loseShutdown && (message.id === shutdownId || message.method === 'kernel.stopping')) {
        incoming.terminate();
        upstream.terminate();
        return;
      }
      if (incoming.readyState === WebSocket.OPEN) {
        incoming.send(
          corruptStatus && message.result ? JSON.stringify({ ...message, result: {} }) : text,
        );
      }
    });
    incoming.on('error', () => {});
    upstream.on('error', () => incoming.terminate());
    incoming.on('close', () => upstream.terminate());
    upstream.on('close', () => incoming.close());
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const address = http.address() as AddressInfo;
  return {
    endpoint: { ...endpoint, url: `ws://127.0.0.1:${address.port}/` },
    dropConnections: () => {
      for (const socket of server.clients) socket.terminate();
    },
    loseShutdownResponse: () => {
      loseShutdown = true;
    },
    corruptStatusResponse: () => {
      corruptStatus = true;
    },
    shutdownCount: () => shutdowns,
    holdStatusResponses: () => {
      holdStatus = true;
    },
    heldStatusCount: () => delayedStatus.length,
    releaseStatusResponses: () => {
      holdStatus = false;
      for (const release of delayedStatus.splice(0)) release();
    },
    holdShutdownResponse: () => {
      holdShutdown = true;
    },
    close: async () => {
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
