// Native Chromium Worker/IndexedDB; Node remains the sole literature authority.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function createChromiumWorkers({ runDir, packageDir, trace, blockers, record }) {
  const modulePath = process.env.SCHOLOOM_PLAYWRIGHT_MODULE ?? '/home/joshua/.nvm/versions/node/v24.12.0/lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
  const executablePath = process.env.SCHOLOOM_CHROMIUM_PATH ?? '/home/joshua/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--allow-file-access-from-files'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const instances = new Map();
  await page.exposeFunction('workerOutput', (id, event) => {
    trace({ type: 'worker', id, ...event });
    const instance = instances.get(id);
    if (event.kind === 'message') for (const fn of instance?.listeners ?? []) fn({ data: event.data });
    if (event.kind === 'error') blockers(event, 'chromium-worker');
  });
  await fs.writeFile(path.join(runDir, 'worker-page.html'), '<!doctype html><title>Throwaway BBT Worker host</title>');
  const workerBridge = path.join(runDir, 'worker-bridge.js');
  const packageURL = pathToFileURL(`${packageDir}/`).href;
  await fs.writeFile(workerBridge, `
    const nativeImportScripts = importScripts.bind(self);
    self.dump = (message) => postMessage({ bridgeKind: 'debug', message });
    self.importScripts = (...urls) => nativeImportScripts(...urls.map(url => {
      const parsed = new URL(url);
      if (parsed.protocol === 'chrome:' && parsed.hostname === 'zotero-better-bibtex') return ${JSON.stringify(packageURL)} + parsed.pathname.slice(1);
      throw new Error('Unimplemented worker resource: ' + url);
    }));
    self.IOUtils = new Proxy({}, { get: (_, name) => { throw new Error('Unimplemented Chromium IOUtils.' + String(name)); } });
    nativeImportScripts(${JSON.stringify(packageURL + 'content/worker/zotero.js')});
    postMessage({ bridgeKind: 'evaluated' });
  `);
  await page.goto(pathToFileURL(path.join(runDir, 'worker-page.html')).href);
  await page.evaluate(() => { window.workers = new Map(); });
  class ChromeWorker {
    constructor(url) {
      this.id = instances.size + 1;
      this.listeners = new Set();
      instances.set(this.id, this);
      record('original BBT Worker on headless Chromium with native IndexedDB; no Zotero app');
      this.created = page.evaluate(({ id, url }) => {
        const worker = new Worker(url);
        window.workers.set(id, worker);
        worker.onmessage = ({ data }) => {
          if (data.bridgeKind) window.workerOutput(id, { kind: data.bridgeKind, message: data.message });
          else window.workerOutput(id, { kind: 'message', data });
        };
        worker.onerror = (event) => window.workerOutput(id, { kind: 'error', message: event.message });
      }, { id: this.id, url: pathToFileURL(workerBridge).href + new URL(url).search }).catch((error) => blockers(error, 'chromium-worker-create'));
    }
    addEventListener(type, fn) { if (type === 'message') this.listeners.add(fn); }
    removeEventListener(type, fn) { this.listeners.delete(fn); }
    postMessage(data) {
      trace({ type: 'worker-request', data });
      this.created.then(() => page.evaluate(({ id, data }) => window.workers.get(id).postMessage(data), { id: this.id, data }))
        .catch((error) => blockers(error, 'chromium-worker-post'));
    }
    terminate() { return page.evaluate((id) => window.workers.get(id)?.terminate(), this.id); }
  }
  trace({ type: 'chromium-baseline', version: browser.version(), executablePath });
  return { ChromeWorker, newPage: () => context.newPage(), close: () => browser.close() };
}
