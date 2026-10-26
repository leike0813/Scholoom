import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrowserWindow, protocol, session } from 'electron';
import { within } from './environment';

const scheme = 'scholoom-zotero';
protocol.registerSchemesAsPrivileged([
  { scheme, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

export async function createWorkers(options: {
  packageDirectory: string;
  rendererDirectory: string;
  preload: string;
  diagnostic(message: string): void;
}) {
  const isolated = session.fromPartition(`zotero-${crypto.randomUUID()}`);
  await isolated.protocol.handle(scheme, async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'host' && url.hostname !== 'package')
      return new Response(null, { status: 404 });
    const root = url.hostname === 'package' ? options.packageDirectory : options.rendererDirectory;
    const filename = within(root, join(root, decodeURIComponent(url.pathname)));
    try {
      const bytes = await readFile(filename);
      const type = filename.endsWith('.js')
        ? 'text/javascript'
        : filename.endsWith('.html')
          ? 'text/html'
          : 'application/octet-stream';
      return new Response(bytes, {
        headers: { 'Content-Type': type, 'Access-Control-Allow-Origin': `${scheme}://host` },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  isolated.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !details.url.startsWith(`${scheme}://`) }),
  );
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      session: isolated,
      preload: options.preload,
    },
  });
  const instances = new Map<number, ChromeWorker>();
  let closed = false;
  let rejectFailure: (error: Error) => void = () => {};
  const failure = new Promise<never>((_resolve, reject) => {
    rejectFailure = reject;
  });
  void failure.catch(() => {});
  const fail = (message: string) => {
    options.diagnostic(message);
    rejectFailure(new Error(message));
  };
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('console-message', (details) => {
    if (details.level === 'error') options.diagnostic(details.message);
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!closed) fail(`Chromium exited: ${details.reason}`);
  });
  window.webContents.on('ipc-message', (_event, channel, ...args: unknown[]) => {
    if (channel !== 'zotero:worker' || closed) return;
    const [id, kind, data] = args;
    if (typeof id !== 'number' || !instances.has(id)) return;
    if (kind === 'message') {
      try {
        const frame = JSON.stringify(data);
        if (frame === undefined || Buffer.byteLength(frame) > 2 * 1024 * 1024) {
          fail('Worker result is not a bounded JSON message');
          return;
        }
        for (const listener of instances.get(id)?.listeners ?? []) listener({ data });
      } catch (error) {
        fail(String(error));
      }
    } else if (kind === 'error') fail(String(data));
  });
  const loaded = window.loadURL(`${scheme}://host/worker.html`);
  const evaluate = async (method: string, args: unknown[]) => {
    await loaded;
    if (closed || window.isDestroyed()) throw new Error('Worker host is closed');
    return window.webContents.executeJavaScript(
      `globalThis.workerHost.${method}(...${JSON.stringify(args)})`,
    );
  };
  class ChromeWorker {
    readonly id: number;
    readonly listeners = new Set<(event: { data: unknown }) => void>();
    private readonly created: Promise<unknown>;
    constructor(url: string) {
      if (instances.size >= 8) throw new Error('Worker capacity exceeded');
      this.id = ++next;
      instances.set(this.id, this);
      this.created = evaluate('create', [this.id, new URL(url).search]);
      void this.created.catch((error) => fail(String(error)));
    }
    addEventListener(type: string, listener: (event: { data: unknown }) => void) {
      if (type === 'message') this.listeners.add(listener);
    }
    removeEventListener(_type: string, listener: (event: { data: unknown }) => void) {
      this.listeners.delete(listener);
    }
    postMessage(data: unknown) {
      void this.created
        .then(() => evaluate('post', [this.id, data]))
        .catch((error) => fail(String(error)));
    }
    async terminate() {
      await this.created.catch(() => {});
      await evaluate('terminate', [this.id]);
      instances.delete(this.id);
      this.listeners.clear();
    }
  }
  let next = 0;
  try {
    await loaded;
  } catch (error) {
    window.destroy();
    isolated.protocol.unhandle(scheme);
    throw error;
  }
  return {
    failure,
    ChromeWorker,
    close() {
      closed = true;
      instances.clear();
      // BrowserWindow.destroy does not wait for a blocked renderer or its unload handlers.
      if (!window.isDestroyed()) window.destroy();
      isolated.protocol.unhandle(scheme);
    },
  };
}
