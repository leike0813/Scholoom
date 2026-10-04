// Execute the original BBT ChromeWorker source in a Node worker, without source rewriting.
import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const resolveChrome = (url) => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'chrome:' || parsed.hostname !== 'zotero-better-bibtex') {
    throw new Error(`Unsupported worker resource: ${url}`);
  }
  return path.join(workerData.packageDir, parsed.pathname);
};
const listeners = new Set();
const context = vm.createContext({
  console, TextEncoder, TextDecoder, URL, URLSearchParams, structuredClone,
  atob, btoa, Blob, crypto, setTimeout, clearTimeout, setInterval, clearInterval,
  location: { search: new URL(workerData.url).search },
  dump: (message) => parentPort.postMessage({ kind: 'debug', message }),
  addEventListener(type, fn) { if (type === 'message') listeners.add(fn); },
  postMessage(data) { parentPort.postMessage({ kind: 'message', data }); },
  IOUtils: {
    async exists(file) { try { await fs.access(file); return true; } catch { return false; } },
    async stat(file) { const stat = await fs.stat(file); return { type: stat.isDirectory() ? 'directory' : 'regular', size: stat.size }; },
    writeUTF8: (file, data) => fs.writeFile(file, data, 'utf8'),
    makeDirectory: (file) => fs.mkdir(file, { recursive: true }),
  },
});
context.self = context;
context.importScripts = (...urls) => {
  for (const url of urls) vm.runInContext(readFileSync(resolveChrome(url), 'utf8'), context, { filename: resolveChrome(url), timeout: 12000 });
};
parentPort.on('message', (data) => {
  for (const fn of listeners) {
    Promise.resolve(fn({ data })).catch((error) => parentPort.postMessage({ kind: 'error', message: error.message, stack: error.stack }));
  }
});
try {
  vm.runInContext(readFileSync(resolveChrome(workerData.url), 'utf8'), context, { filename: resolveChrome(workerData.url), timeout: 12000 });
  parentPort.postMessage({ kind: 'evaluated' });
} catch (error) {
  parentPort.postMessage({ kind: 'error', message: error.message, stack: error.stack });
}
