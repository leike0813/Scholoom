import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  type BusinessParams,
  type ErrorInfo,
  isAuthentication,
  isBusinessMethod,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isShutdown,
  type JsonRpcRequest,
  type KernelStatus,
  limits,
  protocolVersion,
  validateBusiness,
} from '@scholoom/protocol';
import { type WebSocket, WebSocketServer } from 'ws';
import type { KernelApplication } from './application.js';
import { failure } from './errors.js';

export async function startKernelServer(
  initialStatus: KernelStatus,
  onStopping: () => Promise<void>,
  application?: KernelApplication,
) {
  let status = initialStatus;
  const token = randomBytes(32).toString('hex');
  const http = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: limits.frameBytes });
  const authenticated = new Set<WebSocket>();
  let resolveClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  let stopping: Promise<void> | undefined;

  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    status = { ...status, state: 'stopping' };
    stopping = (async () => {
      for (const socket of authenticated) {
        socket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'kernel.stopping',
            params: { instanceId: status.instanceId, state: 'stopping' },
          }),
        );
      }
      try {
        await onStopping();
      } finally {
        const deadline = setTimeout(() => {
          for (const socket of sockets.clients) socket.terminate();
        }, 250);
        for (const socket of sockets.clients) socket.close(1000, 'Kernel stopping');
        await Promise.all([
          new Promise<void>((resolve) => sockets.close(() => resolve())),
          new Promise<void>((resolve, reject) =>
            http.close((error) => (error ? reject(error) : resolve())),
          ),
        ]);
        clearTimeout(deadline);
        resolveClosed();
      }
    })();
    return stopping;
  };

  http.on('upgrade', (request, socket, head) => {
    const address = http.address() as AddressInfo;
    const origin = request.headers.origin;
    let validOrigin = !origin || origin === 'null' || origin === 'file://';
    if (origin && !validOrigin) {
      try {
        const url = new URL(origin);
        validOrigin =
          ['http:', 'https:'].includes(url.protocol) &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      } catch {
        validOrigin = false;
      }
    }
    if (
      status.state !== 'running' ||
      !validOrigin ||
      request.headers.host !== `127.0.0.1:${address.port}` ||
      request.url !== '/' ||
      request.socket.remoteAddress !== '127.0.0.1'
    ) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, socket, head, (peer) => sockets.emit('connection', peer));
  });

  sockets.on('connection', (socket) => {
    const timeout = setTimeout(
      () => socket.close(1008, 'Authentication required'),
      limits.authenticationMs,
    );
    const error = (
      id: string | number | null,
      code: number,
      reason: ErrorInfo['code'],
      message: string,
      close = false,
    ) => {
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code, message, data: { code: reason, message } },
        }),
        () => {
          if (close) socket.close(1008, 'Authentication rejected');
        },
      );
    };
    const reply = (request: JsonRpcRequest, result: unknown, callback?: () => void) => {
      socket.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), callback);
    };
    socket.on('error', () => {});
    let scope: BusinessParams<'workbench.watch'> | undefined;
    let changeTimer: ReturnType<typeof setTimeout> | undefined;
    let latestRevision = 0;
    const flushChange = () => {
      changeTimer = undefined;
      if (!scope || socket.readyState !== 1) return;
      if (socket.bufferedAmount > limits.frameBytes) {
        changeTimer = setTimeout(flushChange, 100);
        return;
      }
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'workbench.changed',
          params: {
            revision: latestRevision,
            resync: true,
            ...(scope.projectId ? { projectId: scope.projectId } : {}),
            ...(scope.sessionId ? { sessionId: scope.sessionId } : {}),
          },
        }),
      );
    };
    const unsubscribe = application?.subscribe((change) => {
      if (!scope || !authenticated.has(socket)) return;
      if (scope.projectId && change.projectId && scope.projectId !== change.projectId) return;
      if (scope.sessionId && change.sessionId && scope.sessionId !== change.sessionId) return;
      latestRevision = change.revision;
      changeTimer ??= setTimeout(flushChange, 50);
    });
    socket.on('close', () => {
      clearTimeout(timeout);
      clearTimeout(changeTimer);
      unsubscribe?.();
      authenticated.delete(socket);
    });
    socket.on('message', (bytes, binary) => {
      let message: unknown;
      try {
        if (binary) throw new Error('Binary frame');
        message = JSON.parse(bytes.toString());
      } catch {
        error(null, -32700, 'invalidRequest', 'Invalid JSON message.');
        return;
      }
      if (!isJsonRpcRequest(message)) {
        if (
          authenticated.has(socket) &&
          (isJsonRpcNotification(message) || isJsonRpcResponse(message))
        )
          return;
        error(null, -32600, 'invalidRequest', 'Invalid request.');
        return;
      }
      if (!authenticated.has(socket)) {
        if (message.method !== 'kernel.authenticate' || !isAuthentication(message.params)) {
          error(message.id, -32001, 'authenticationFailed', 'Authentication required.', true);
          return;
        }
        const supplied = Buffer.from(message.params.token);
        const expected = Buffer.from(token);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
          error(message.id, -32001, 'authenticationFailed', 'Authentication failed.', true);
          return;
        }
        if (message.params.protocolVersion !== protocolVersion) {
          error(message.id, -32002, 'protocolIncompatible', 'Protocol is incompatible.', true);
          return;
        }
        if (message.params.instanceId !== status.instanceId) {
          error(message.id, -32003, 'instanceMismatch', 'Kernel instance does not match.', true);
          return;
        }
        clearTimeout(timeout);
        authenticated.add(socket);
        reply(message, status);
      } else if (message.method === 'kernel.status') {
        if (message.params !== undefined && Object.keys(message.params).length !== 0) {
          error(message.id, -32602, 'invalidRequest', 'Status takes no parameters.');
          return;
        }
        reply(message, status);
      } else if (message.method === 'kernel.shutdown') {
        if (!isShutdown(message.params)) {
          error(message.id, -32602, 'invalidRequest', 'Invalid shutdown parameters.');
        } else if (message.params.instanceId !== status.instanceId) {
          error(message.id, -32003, 'instanceMismatch', 'Kernel instance does not match.');
        } else if (status.state === 'stopping') {
          error(message.id, -32004, 'shuttingDown', 'Kernel is stopping.');
        } else {
          status = { ...status, state: 'stopping' };
          reply(message, { instanceId: status.instanceId, state: 'stopping' }, () => {
            void stop().catch(() => {
              console.error(
                JSON.stringify({ code: 'outcomeUnknown', message: 'Kernel cleanup failed.' }),
              );
              process.exitCode = 1;
            });
          });
        }
      } else if (application && isBusinessMethod(message.method)) {
        const method = message.method;
        if (status.state === 'stopping') {
          error(message.id, -32004, 'shuttingDown', 'Kernel is stopping.');
          return;
        }
        if (!validateBusiness(method, 'params', message.params)) {
          error(message.id, -32602, 'invalidRequest', 'Invalid operation parameters.');
          return;
        }
        if (method === 'workbench.watch')
          scope = message.params as BusinessParams<'workbench.watch'>;
        void application
          .call(method, message.params)
          .then((result) => {
            if (!validateBusiness(method, 'result', result)) {
              error(message.id, -32603, 'unavailable', 'Operation result could not be validated.');
              return;
            }
            reply(message, result);
          })
          .catch((reason) => {
            const info = failure(reason);
            error(message.id, -32010, info.code, info.message);
          });
      } else {
        error(message.id, -32601, 'invalidRequest', 'Unknown method.');
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(0, '127.0.0.1', () => {
      http.off('error', reject);
      resolve();
    });
  });
  const address = http.address() as AddressInfo;
  return { url: `ws://127.0.0.1:${address.port}/`, token, closed, stop };
}
