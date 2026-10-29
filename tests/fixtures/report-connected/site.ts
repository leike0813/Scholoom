import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ConnectedConfiguration } from './types.js';

/** Serve the trusted test page over actual loopback HTTP, preserving its local address space. */
export async function connectedSite(
  configuration: ConnectedConfiguration,
  assets: { html: string; script: string; css: string },
) {
  const pages = new Map([
    ['/', { type: 'text/html', body: assets.html }],
    ['/fixture.js', { type: 'text/javascript', body: assets.script }],
    ['/fixture.css', { type: 'text/css', body: assets.css }],
    [
      '/__report-connected/config',
      { type: 'application/json', body: JSON.stringify(configuration) },
    ],
  ]);
  const server = createServer((request, response) => {
    const page = pages.get(request.url ?? '');
    if (request.method !== 'GET' || !page) {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, { 'Content-Type': page.type, 'Cache-Control': 'no-store' })
      .end(page.body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
