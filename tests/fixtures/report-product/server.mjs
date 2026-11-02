import { readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kernelBootstrap } from '../../../apps/desktop/kernel-bootstrap.ts';

// Serve the unchanged product build; bootstrap and lifecycle remain the product's own.
const root = fileURLToPath(new URL('../../../apps/desktop/out/renderer/', import.meta.url));
const middleware = [];
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const server = createServer((request, response) => {
  let index = 0;
  const next = () => {
    const handler = middleware[index++];
    if (handler) {
      Promise.resolve(handler(request, response, next)).catch(() => response.writeHead(500).end());
      return;
    }
    void (async () => {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const path = await realpath(join(root, pathname === '/' ? 'index.html' : pathname));
      const local = relative(root, path);
      if (local === '..' || local.startsWith(`..${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const bytes = await readFile(path);
      response.writeHead(200, {
        'Content-Type': types[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    })().catch(() => response.writeHead(404).end());
  };
  next();
});
await kernelBootstrap({
  development: process.env.SCHOOLOOM_REPORT_PRODUCT_SCENARIO !== 'lifecycle',
}).configureServer({
  httpServer: server,
  config: { root, publicDir: false },
  middlewares: {
    use(handler) {
      middleware.push(handler);
    },
  },
});
server.listen(Number(process.env.SCHOOLOOM_UI_PORT), '127.0.0.1');
process.once('SIGTERM', () => server.close());
process.once('SIGINT', () => server.close());
