import { createSocket } from 'node:dgram';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

export async function reportNetworkTrap(font: Buffer) {
  const httpRequests: { method: string; url: string }[] = [];
  const udpPackets: number[] = [];
  let httpTotal = 0;
  let udpTotal = 0;
  const sockets = new Set<Socket>();
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
    'base64',
  );
  let origin: string;
  const record = (request: IncomingMessage) => {
    httpTotal += 1;
    let path = '/';
    try {
      path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    } catch {
      // Keep malformed requests observable without retaining raw URLs or credentials.
    }
    if (httpRequests.length < 32)
      httpRequests.push({
        method: (request.method ?? '').slice(0, 2048),
        url: path.slice(0, 2048),
      });
    return path;
  };
  const http = createServer((request, response) => {
    const path = record(request);
    // Discard incoming bodies; the trap observes network attempts, not submitted data.
    request.resume();
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    response.setHeader('Cache-Control', 'no-store');
    let type = 'text/plain; charset=utf-8';
    let body: string | Buffer = 'observed';
    if (path === '/redirect') {
      response.writeHead(302, { Location: `${origin}/navigated` });
      response.end();
      return;
    }
    if (path.startsWith('/worker')) {
      type = 'text/javascript; charset=utf-8';
      body = 'self.postMessage("external worker loaded");';
    } else if (path.endsWith('/script') || /\.(?:m?js)$/.test(path)) {
      type = 'text/javascript; charset=utf-8';
      body = 'window.__externalScriptExecuted = true;';
    } else if (path === '/image' || path.endsWith('.png')) {
      type = 'image/png';
      body = image;
    } else if (path === '/font' || path.endsWith('.woff2')) {
      type = 'font/woff2';
      body = font;
    } else if (['/css', '/style', '/import'].includes(path) || path.endsWith('.css')) {
      type = 'text/css; charset=utf-8';
      body = 'body { --external-network-trap: 1; }';
    } else if (
      ['/navigated', '/frame', '/frames', '/form'].includes(path) ||
      path.endsWith('.html')
    ) {
      type = 'text/html; charset=utf-8';
      body = '<!doctype html><html><body>External network trap</body></html>';
    } else if (path === '/control') {
      body = 'control';
    }
    response.writeHead(200, { 'Content-Type': type });
    response.end(body);
  });
  http.on('connection', (socket) => {
    if (sockets.size >= 16) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  http.on('upgrade', (request, socket) => {
    record(request);
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n', () =>
      socket.destroy(),
    );
  });

  const udp = createSocket('udp4');
  udp.on('message', (message, remote) => {
    udpTotal += 1;
    if (udpPackets.length < 32) udpPackets.push(message.length);
    if (
      message.length < 20 ||
      message.readUInt16BE(0) !== 0x0001 ||
      message.readUInt32BE(4) !== 0x2112a442 ||
      message.readUInt16BE(2) !== message.length - 20 ||
      message.readUInt16BE(2) % 4 !== 0
    )
      return;
    const reply = Buffer.alloc(32);
    reply.writeUInt16BE(0x0101, 0);
    reply.writeUInt16BE(12, 2);
    reply.writeUInt32BE(0x2112a442, 4);
    message.copy(reply, 8, 8, 20);
    reply.writeUInt16BE(0x0020, 20);
    reply.writeUInt16BE(8, 22);
    reply[25] = 1;
    reply.writeUInt16BE(remote.port ^ 0x2112, 26);
    reply.writeUInt32BE((0x7f000001 ^ 0x2112a442) >>> 0, 28);
    // A peer may disappear during shutdown; a failed reply must not escape as an error event.
    udp.send(reply, remote.port, remote.address, () => {});
  });

  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closing ??= (async () => {
      const httpClosed = new Promise<void>((resolve, reject) => {
        http.close((error) => {
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING')
            reject(error);
          else resolve();
        });
        for (const socket of sockets) socket.destroy();
      });
      const udpClosed = new Promise<void>((resolve, reject) => {
        try {
          udp.close(resolve);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ERR_SOCKET_DGRAM_NOT_RUNNING') resolve();
          else reject(error);
        }
      });
      await Promise.all([httpClosed, udpClosed]);
    })();
    return closing;
  };

  try {
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(0, '127.0.0.1', () => {
        http.off('error', reject);
        resolve();
      });
    });
    origin = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    await new Promise<void>((resolve, reject) => {
      udp.once('error', reject);
      udp.bind(0, '127.0.0.1', () => {
        udp.off('error', reject);
        resolve();
      });
    });
    return {
      origin,
      stunURL: `stun:127.0.0.1:${udp.address().port}`,
      httpRequests,
      udpPackets,
      get httpTotal() {
        return httpTotal;
      },
      get udpTotal() {
        return udpTotal;
      },
      reset(): void {
        httpRequests.length = 0;
        udpPackets.length = 0;
        httpTotal = 0;
        udpTotal = 0;
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
