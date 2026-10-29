// Trusted test controller only. No service authentication or report authority.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

export async function createSurfaceController(built: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const source = await context.newPage();
  const observations: unknown[] = [];
  let actions = Promise.resolve();
  const read = () => source.evaluate(() => Reflect.get(window, 'surfaceSource').read());
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method === 'GET') {
        const name = request.url === '/' ? 'index.html' : request.url?.slice(1);
        if (
          !name ||
          !['index.html', 'surface.js', 'surface.css', 'source.html', 'source.js'].includes(name)
        ) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          'Content-Type': name.endsWith('.js')
            ? 'text/javascript'
            : name.endsWith('.css')
              ? 'text/css'
              : 'text/html',
        });
        response.end(await readFile(join(built, name)));
        return;
      }
      if (
        request.method !== 'POST' ||
        !['/state', '/__surface/state'].includes(request.url ?? '')
      ) {
        response.writeHead(404).end();
        return;
      }
      let input = '';
      for await (const chunk of request) {
        input += chunk.toString();
        if (input.length > 1024) {
          response.writeHead(413).end();
          return;
        }
      }
      const { action, value } = JSON.parse(input);
      assert(!action || ['filter', 'order', 'toggle'].includes(action));
      assert(!value || (typeof value === 'string' && value.length <= 128));
      // Serialize actual page actions; no second reducer or expected-state synthesis.
      const work = actions.then(async () => {
        if (action === 'filter') await source.getByLabel('筛选文献', { exact: true }).fill(value);
        if (action === 'order')
          await source.getByLabel('排序', { exact: true }).selectOption(value);
        if (action === 'toggle') {
          assert(['trial-a', 'trial-b', 'cohort-c'].includes(value));
          await source.locator(`tr[data-id="${value}"] summary`).click();
        }
        const snapshot = await read();
        if (observations.length < 40)
          observations.push({ action: action ?? 'read', value, snapshot });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(snapshot));
      });
      actions = work.catch(() => {});
      await work;
    })().catch((error) => {
      response.writeHead(400).end(String(error).slice(0, 512));
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    await source.goto(`${origin}/source.html`);
    await source.waitForFunction(() => Reflect.has(window, 'surfaceSource'));
    return {
      source,
      origin,
      read,
      observations,
      async close() {
        await browser.close();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        return { browserConnected: browser.isConnected(), serverListening: server.listening };
      },
    };
  } catch (error) {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  }
}
