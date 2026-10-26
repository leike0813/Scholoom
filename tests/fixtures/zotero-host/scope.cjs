// A fixed, isolated Electron/Chromium process tree for the existing platform command seam.
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const directory = process.argv.at(-1);
app.setPath('userData', join(directory, 'profile'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  await window.loadURL('data:text/html,<title>Owned process fixture</title>');
  await window.webContents.executeJavaScript(`new Promise(resolve => {
    const worker = new Worker(URL.createObjectURL(new Blob(['postMessage("ready"); while(true) {}'], {type:'text/javascript'})));
    worker.onmessage = () => resolve();
  })`);
  writeFileSync(
    join(directory, 'ready.json'),
    JSON.stringify(app.getAppMetrics().map((entry) => ({ pid: entry.pid, type: entry.type }))),
  );
});
