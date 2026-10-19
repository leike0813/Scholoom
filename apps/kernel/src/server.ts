import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RpcPeer } from '@scholoom/broker/rpc';
import {
  type BusinessParams,
  type ErrorInfo,
  isAuthentication,
  isBusinessCall,
  isDevelopmentAttach,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isShutdown,
  type JsonRpcRequest,
  type KernelStatus,
  limits,
  protocolVersion,
} from '@scholoom/protocol';
import { type WebSocket, WebSocketServer } from 'ws';
import type { KernelApplication } from './application.js';
import { OperationError } from './errors.js';

export async function startKernelServer(
  initialStatus: KernelStatus,
  onStopping: () => Promise<void>,
  application?: Pick<KernelApplication, 'call' | 'subscribe'> &
    Partial<Pick<KernelApplication, 'available'>>,
  development = false,
) {
  let status: KernelStatus = { ...initialStatus, capabilities: application?.available?.() ?? [] };
  const token = randomBytes(32).toString('hex');
  const http = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: limits.frameBytes });
  const authenticated = new Set<WebSocket>();
  const owners = new Set<WebSocket>();
  let ownerDeadline: ReturnType<typeof setTimeout> | undefined;
  let resolveClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  let stopping: Promise<void> | undefined;

  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    clearTimeout(ownerDeadline);
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

  const stopDevelopment = () => {
    void stop().catch(() => {
      console.error(JSON.stringify({ code: 'outcomeUnknown', message: 'Kernel cleanup failed.' }));
      process.exitCode = 1;
    });
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
    let sessionsChanged = false;
    let libraryChanged = false;
    const watches = new Map<string, string>();
    const filePaths = new Set<string>();
    let broadChange = false;
    const peer = new RpcPeer(
      {
        send: (frame) =>
          new Promise<void>((resolve, reject) => {
            if (socket.readyState !== 1 || socket.bufferedAmount > limits.frameBytes) {
              reject(new OperationError('unavailable', '连接积压或已关闭。'));
              return;
            }
            socket.send(frame, (reason) => {
              if (reason) reject(reason);
              else resolve();
            });
          }),
      },
      {
        control: (method) => method.startsWith('kernel.'),
        request: async (method, params) => {
          if (method === 'kernel.status') {
            if (
              params !== undefined &&
              (!params ||
                typeof params !== 'object' ||
                Array.isArray(params) ||
                Object.keys(params).length)
            )
              throw new OperationError('invalidRequest', 'Status takes no parameters.');
            return status;
          }
          if (method === 'kernel.development.attach') {
            if (!isDevelopmentAttach(params))
              throw new OperationError('invalidRequest', 'Invalid attach parameters.');
            if (!development)
              throw new OperationError(
                'permissionDenied',
                'Configuration belongs to an independent kernel.',
              );
            if (status.state !== 'running')
              throw new OperationError('shuttingDown', 'Kernel is stopping.');
            owners.add(socket);
            clearTimeout(ownerDeadline);
            return status;
          }
          if (method === 'kernel.shutdown') {
            if (!isShutdown(params))
              throw new OperationError('invalidRequest', 'Invalid shutdown parameters.');
            if (params.instanceId !== status.instanceId)
              throw new OperationError('instanceMismatch', 'Kernel instance does not match.');
            if (status.state === 'stopping')
              throw new OperationError('shuttingDown', 'Kernel is stopping.');
            status = { ...status, state: 'stopping' };
            setImmediate(stopDevelopment);
            return { instanceId: status.instanceId, state: 'stopping' };
          }
          if (!application) throw new OperationError('invalidRequest', 'Unknown method.');
          if (status.state === 'stopping')
            throw new OperationError('shuttingDown', 'Kernel is stopping.');
          const args: readonly [string, unknown] = [method, params];
          if (!isBusinessCall(args))
            throw new OperationError('invalidRequest', 'Invalid operation parameters.');
          if (args[0] === 'workbench.watch') {
            const next = args[1];
            if (
              scope?.projectId !== next.projectId ||
              (scope?.sessionId !== next.sessionId && !sessionsChanged)
            ) {
              clearTimeout(changeTimer);
              changeTimer = undefined;
              sessionsChanged = false;
              filePaths.clear();
              broadChange = false;
            }
            scope = next;
          }
          const result = await application.call(...args);
          if (args[0] === 'files.watch') {
            const watch = result as { watchId: string };
            if (socket.readyState === 1) watches.set(watch.watchId, args[1].projectId);
            else
              await application.call('files.unwatch', {
                projectId: args[1].projectId,
                watchId: watch.watchId,
              });
          } else if (args[0] === 'files.unwatch') watches.delete(args[1].watchId);
          return result;
        },
        invalid: () => socket.close(1008, 'Invalid RPC'),
      },
    );
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
            ...(sessionsChanged ? { sessionsChanged: true } : {}),
            ...(libraryChanged ? { libraryChanged: true } : {}),
            ...(!broadChange && filePaths.size ? { filePaths: [...filePaths] } : {}),
            ...(scope.projectId ? { projectId: scope.projectId } : {}),
            ...(scope.sessionId ? { sessionId: scope.sessionId } : {}),
          },
        }),
      );
      sessionsChanged = false;
      libraryChanged = false;
      filePaths.clear();
      broadChange = false;
    };
    const unsubscribe = application?.subscribe((change) => {
      if (!scope || !authenticated.has(socket)) return;
      if (scope.projectId && change.projectId && scope.projectId !== change.projectId) return;
      if (
        scope.sessionId &&
        change.sessionId &&
        scope.sessionId !== change.sessionId &&
        !change.sessionsChanged
      )
        return;
      latestRevision = change.revision;
      sessionsChanged ||= change.sessionsChanged === true;
      libraryChanged ||= change.libraryChanged === true;
      if (change.filePaths && !broadChange) {
        for (const path of change.filePaths) filePaths.add(path);
        if (filePaths.size > 100) {
          filePaths.clear();
          broadChange = true;
        }
      } else broadChange = true;
      changeTimer ??= setTimeout(flushChange, 50);
    });
    socket.on('close', () => {
      peer.close();
      clearTimeout(timeout);
      clearTimeout(changeTimer);
      unsubscribe?.();
      for (const [watchId, projectId] of watches)
        void application?.call('files.unwatch', { projectId, watchId }).catch(() => {});
      watches.clear();
      authenticated.delete(socket);
      if (owners.delete(socket) && owners.size === 0) stopDevelopment();
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
      if (authenticated.has(socket)) {
        peer.receive(bytes.toString());
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
      } else {
        peer.receive(bytes.toString());
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
  if (development) ownerDeadline = setTimeout(stopDevelopment, limits.lifecycleMs);
  return { url: `ws://127.0.0.1:${address.port}/`, token, closed, stop };
}
