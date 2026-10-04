// Throwaway Electron workbench. Domain calls run in main, never in renderer Node.
const {app, BrowserWindow, ipcMain} = require('electron');
const {join} = require('node:path');
const outputDir = process.argv.find(arg => arg.startsWith('--output-dir=')).slice('--output-dir='.length);
app.setPath('userData', join(outputDir, 'electron-profile'));
let capability, workbench, closing = false;
app.whenReady().then(async () => {
  workbench = new BrowserWindow({width: 1100, height: 850, useContentSize: true,
    webPreferences: {preload: join(__dirname, 'restart-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true}});
  await workbench.loadURL('about:blank');
  const {openLiterature} = await import('./literature-interface.mjs');
  capability = await openLiterature(outputDir, 'electron-main-rpc-results.json');
  const {literature, sourceId, materialId} = capability;
  const operations = {
    read: () => literature.read(sourceId), readNavigation: () => literature.readNavigation(materialId),
    readMaterial: () => literature.readMaterial(materialId),
    renameBookmark: params => literature.renameBookmark(materialId, params.bookmarkId, params.title),
  };
  ipcMain.handle('literature-request', (_event, method, params) => {
    if (!Object.hasOwn(operations, method)) throw Error('Unknown view operation');
    return operations[method](params);
  });
}).catch(error => {console.error(error); app.exit(1);});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (closing || !capability) return;
  event.preventDefault(); closing = true;
  capability.finish({shutdown: false}).finally(() => app.quit());
});
