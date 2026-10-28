// Host environment only; the fixed original BBT Worker is loaded without rewriting it.
const nativeImportScripts = importScripts.bind(self);
self.dump = (message) => console.error(String(message).slice(0, 512));
const nativeDeleteDatabase = indexedDB.deleteDatabase.bind(indexedDB);
indexedDB.deleteDatabase = (name) => {
  const request = nativeDeleteDatabase(name);
  request.addEventListener('blocked', (event) => {
    console.error('Worker IndexedDB delete blocked');
    // blocked is advisory; await actual deletion within the host startup deadline.
    if (name === 'BetterBibTeXCache') event.stopImmediatePropagation();
  });
  request.addEventListener('error', () =>
    console.error(`Worker IndexedDB delete failed: ${request.error?.name}`),
  );
  return request;
};
self.importScripts = (...urls) =>
  nativeImportScripts(
    ...urls.map((url) => {
      const parsed = new URL(url);
      if (parsed.protocol === 'chrome:' && parsed.hostname === 'zotero-better-bibtex') {
        return `scholoom-zotero://package${parsed.pathname}`;
      }
      throw new Error('Unsupported Worker resource');
    }),
  );
self.IOUtils = new Proxy(
  {},
  {
    get: () => {
      throw new Error('Worker filesystem unavailable');
    },
  },
);
nativeImportScripts('scholoom-zotero://package/content/worker/zotero.js');
