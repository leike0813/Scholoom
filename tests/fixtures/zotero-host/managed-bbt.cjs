// Explicit synthetic catalog: no production or user library connection.
const { app, BrowserWindow } = require('electron');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { mkdirSync, writeFileSync } = require('node:fs');
const { createCatalog } = require('./catalog.cjs');
const root = join(__dirname, '../../..');
const { ZoteroHost } = require(join(root, 'apps/zotero-host/out/main/host.cjs'));
const directory = process.argv.at(-3);
const mode = process.argv.at(-2);
const profile = join(directory, 'profile');
mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
(async () => {
  let input = '';
  for await (const bytes of process.stdin) {
    input += bytes;
    if (Buffer.byteLength(input) > 8192) throw new Error('bootstrap too large');
  }
  const { connectHost } = await import(
    pathToFileURL(join(root, 'packages/client/dist/host.js')).href
  );
  await app.whenReady();
  const catalog = createCatalog(profile);
  const host = new ZoteroHost({
    packageDirectory: process.argv.at(-1),
    profileDirectory: profile,
    dateFormats: join(root, 'apps/zotero-host/resources/dateFormats.json'),
    catalog,
    rendererDirectory: join(root, 'apps/zotero-host/out/renderer'),
    preload: join(root, 'apps/zotero-host/out/preload/index.cjs'),
  });
  if (mode === 'startup-interrupt')
    catalog.zotero.DB.queryAsync = async () => {
      // Pause the synthetic DB boundary after the original package has entered startup.
      writeFileSync(
        join(directory, 'interruption.json'),
        JSON.stringify({
          status: host.status(),
          metrics: app.getAppMetrics().map(({ pid, type }) => ({ pid, type })),
        }),
      );
      await new Promise(() => {});
    };
  const session = await connectHost(JSON.parse(input), {
    scope: 'injected-adapter',
    async initialize() {
      const result = await host.start();
      if (result.state !== 'ready') throw new Error(JSON.stringify(result));
    },
    async invoke(method, input, callback) {
      if (method === 'status')
        return { ...host.status(), caller: await callback('sample.authority', {}) };
      if (method === 'fillKeys') return host.fillKeys(input.sources);
      if (method === 'export') {
        if (mode === 'worker-loss') {
          const contents = BrowserWindow.getAllWindows()[0]?.webContents;
          if (!contents) throw new Error('Worker window is unavailable');
          contents.debugger.attach();
          await contents.debugger.sendCommand('Debugger.enable');
          await contents.debugger.sendCommand('Debugger.pause');
          const exporting = host.export(input.sources, input.format);
          void exporting.catch(() => {});
          await Promise.resolve();
          writeFileSync(
            join(directory, 'interruption.json'),
            JSON.stringify({
              status: host.status(),
              metrics: app.getAppMetrics().map(({ pid, type }) => ({ pid, type })),
            }),
          );
          contents.forcefullyCrashRenderer();
          return exporting;
        }
        return host.export(input.sources, input.format);
      }
      throw new Error('outside sample operations');
    },
    async shutdown() {
      if (mode === 'shutdown-error')
        catalog.zotero.Notifier.unregisterObserver = () => {
          throw new Error('fixed release failure');
        };
      const result = await host.close();
      catalog.close();
      return result.state === 'closed' ? 'closed' : 'unknown';
    },
  });
  await session.closed;
  app.quit();
})().catch((error) => {
  console.error(error);
  app.exit(1);
});
