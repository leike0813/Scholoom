// Host environment only; the fixed original BBT Worker is loaded without rewriting it.
const nativeImportScripts = importScripts.bind(self);
self.dump = () => {};
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
