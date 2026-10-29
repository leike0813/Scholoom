// Fixed trusted R2b experiment. Not a sanitizer, report service or OS isolation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import type { createSurfaceController as OriginalController } from '../report-surface/controller.js';

// Node's native TS entry needs the real extension; type lookup keeps NodeNext contracts.
const { createSurfaceController } = (await import(
  new URL('../report-surface/controller.ts', import.meta.url).href
)) as { createSurfaceController: typeof OriginalController };

export async function createStructureController(built: string) {
  const original = await createSurfaceController(built);
  let generation = 0;
  let closed = false;
  let inFlight: Promise<unknown> | undefined;
  const observations: unknown[] = [];
  async function request(input: { generation: number; action?: string; value?: string }) {
    assert(Number.isSafeInteger(input.generation));
    if (closed) return { code: 'closed' };
    if (input.generation !== generation) return { code: 'obsolete' };
    if (inFlight) return { code: 'busy' };
    if (generation >= 128) return { code: 'limit' };
    assert(!input.action || ['filter', 'order', 'toggle'].includes(input.action));
    assert(!input.value || (typeof input.value === 'string' && input.value.length <= 128));
    const work = async () => {
      const result = await fetch(`${original.origin}/state`, {
        method: 'POST',
        body: JSON.stringify({ action: input.action, value: input.value }),
      });
      assert(result.ok);
      await result.arrayBuffer();
      // Properties that HTML serialization alone misses are copied from this live DOM.
      const document = await original.source.evaluate(() => {
        if (window.document.querySelectorAll('*').length > 256) throw new Error('node limit');
        const state = Reflect.get(window, 'surfaceSource').read();
        const clone = window.document.documentElement.cloneNode(true) as HTMLElement;
        clone.querySelector('script[src="source.js"]')?.remove();
        if (clone.querySelector('script,style,link')) throw new Error('not the fixed fixture');
        for (const input of window.document.querySelectorAll('input')) {
          clone.querySelector<HTMLInputElement>(`#${input.id}`)?.setAttribute('value', input.value);
        }
        for (const select of window.document.querySelectorAll('select')) {
          const copied = clone.querySelector<HTMLSelectElement>(`#${select.id}`)!;
          for (let index = 0; index < select.options.length; index++) {
            copied.options[index]!.toggleAttribute('selected', select.options[index]!.selected);
          }
        }
        const csp = window.document.createElement('meta');
        csp.httpEquiv = 'Content-Security-Policy';
        csp.content =
          "default-src 'none'; script-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'";
        clone.querySelector('head')!.prepend(csp);
        const html = `<!doctype html>${clone.outerHTML}`;
        if (new TextEncoder().encode(html).length > 65536) throw new Error('byte limit');
        return { html, state };
      });
      if (closed) return { code: 'closed' };
      generation++;
      if (observations.length < 40)
        observations.push({ generation, action: input.action ?? 'read', state: document.state });
      return { generation, ...document };
    };
    const operation = work();
    inFlight = operation;
    try {
      return await operation;
    } finally {
      inFlight = undefined;
    }
  }
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET') {
        const path = req.url === '/' ? 'index.html' : req.url?.slice(1);
        if (!path || !['index.html', 'surface.js', 'surface.css'].includes(path)) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': path.endsWith('.js')
            ? 'text/javascript'
            : path.endsWith('.css')
              ? 'text/css'
              : 'text/html',
        });
        res.end(await readFile(join(built, path)));
        return;
      }
      if (req.method !== 'POST' || req.url !== '/__structure/action') {
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
      const output = await request(JSON.parse(body));
      res.writeHead(output && 'code' in output ? 409 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(output));
    })().catch((error) => res.writeHead(400).end(String(error).slice(0, 256)));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert(address && typeof address !== 'string');
    return {
      source: original.source,
      read: original.read,
      observations,
      request,
      origin: `http://127.0.0.1:${address.port}`,
      async close() {
        closed = true;
        await inFlight?.catch(() => {});
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        return { ...(await original.close()), presentationListening: server.listening };
      },
    };
  } catch (error) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await original.close();
    throw error;
  }
}
