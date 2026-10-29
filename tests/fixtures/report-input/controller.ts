// Two fixed synthetic view owners; no report/resource authority or service authentication.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import type { createStructureController as Original } from '../report-structure/controller.js';

const { createStructureController } = (await import(
  new URL('../report-structure/controller.ts', import.meta.url).href
)) as { createStructureController: typeof Original };
type Controller = Awaited<ReturnType<typeof Original>>;
export async function createInputController(built: string) {
  const owners = new Map<string, Promise<Controller>>();
  let closed = false;
  function get(key: string) {
    assert(!closed && ['first', 'second'].includes(key));
    let controller = owners.get(key);
    if (!controller) {
      controller = createStructureController(built);
      owners.set(key, controller);
    }
    return controller;
  }
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET') {
        const file = req.url === '/' ? 'index.html' : req.url?.slice(1);
        if (!file || !['index.html', 'surface.js', 'surface.css'].includes(file)) {
          res.writeHead(404).end();
          return;
        }
        res
          .writeHead(200, {
            'Content-Type': file.endsWith('.js')
              ? 'text/javascript'
              : file.endsWith('.css')
                ? 'text/css'
                : 'text/html',
          })
          .end(await readFile(join(built, file)));
        return;
      }
      const key = req.url?.match(/^\/__input\/(first|second)$/)?.[1];
      if (req.method !== 'POST' || !key) {
        res.writeHead(404).end();
        return;
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 1024) {
          res.writeHead(413).end();
          return;
        }
      }
      const result = await (await get(key)).request(JSON.parse(body));
      res
        .writeHead('code' in result ? 409 : 200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify(result));
    })().catch((error) => res.writeHead(400).end(String(error).slice(0, 256)));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    get,
    async close() {
      closed = true;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      const receipts = [];
      for (const [key, promise] of owners)
        receipts.push({ key, ...(await (await promise).close()) });
      return { listening: server.listening, receipts };
    },
  };
}
