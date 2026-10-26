import { RpcPeer } from '@scholoom/broker/rpc';
import { limits, OperationError } from '@scholoom/protocol/core';
import {
  type HostBootstrap,
  type HostInvocation,
  isHostBootstrap,
  validateHostMessage,
} from '@scholoom/protocol/host';

/** Host main only. Credentials and callback handles never enter a renderer. */
export async function connectHost(
  bootstrap: HostBootstrap,
  options: {
    scope: string;
    initialize(): Promise<void>;
    invoke(
      method: string,
      input: unknown,
      callback: (method: string, input: unknown) => Promise<unknown>,
    ): Promise<unknown>;
    shutdown(): Promise<'closed' | 'unknown'>;
  },
) {
  if (!isHostBootstrap(bootstrap))
    throw new OperationError('invalidRequest', 'Invalid host bootstrap');
  const socket = new WebSocket(bootstrap.url);
  let disconnected!: () => void;
  const closed = new Promise<void>((resolve) => {
    disconnected = resolve;
  });
  const peer = new RpcPeer(
    {
      send(frame) {
        if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > limits.frameBytes)
          throw new OperationError('unavailable', 'Host transport unavailable');
        socket.send(frame);
      },
      close: () => socket.close(),
    },
    {
      control: (method) => method === 'host.shutdown',
      request: async (method, params) => {
        if (method === 'host.shutdown' && validateHostMessage(method, params))
          return { state: await options.shutdown() };
        if (method !== 'host.invoke' || !validateHostMessage(method, params))
          throw new OperationError('invalidRequest', 'Unsupported host request');
        const request = params as HostInvocation;
        return options.invoke(request.method, request.input, (method, input) =>
          peer.request(
            'host.callback',
            { handle: request.handle, method, input },
            { waitMs: 30000, lossCode: 'outcomeUnknown' },
          ),
        );
      },
    },
  );
  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') {
      peer.close();
      return;
    }
    peer.receive(event.data);
  });
  socket.addEventListener('close', () => {
    peer.close();
    disconnected();
  });
  socket.addEventListener('error', () => peer.close());
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new OperationError('unavailable', 'Host connection timeout')),
        5000,
      );
      const finish = (error?: Error) => {
        clearTimeout(timer);
        error ? reject(error) : resolve();
      };
      socket.addEventListener('open', () => finish(), { once: true });
      socket.addEventListener(
        'close',
        () => finish(new OperationError('unavailable', 'Host connection closed')),
        { once: true },
      );
      socket.addEventListener(
        'error',
        () => finish(new OperationError('unavailable', 'Host connection failed')),
        { once: true },
      );
    });
    const { url: _url, ...credentials } = bootstrap;
    await peer.request('host.authenticate', credentials, { waitMs: 5000, control: true });
    await options.initialize();
    await peer.request('host.ready', { scope: options.scope }, { waitMs: 5000, control: true });
    return { closed, close: () => peer.close() };
  } catch (error) {
    peer.close();
    throw error;
  }
}
