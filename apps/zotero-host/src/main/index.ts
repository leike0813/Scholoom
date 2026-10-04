import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

let hostWindow: BrowserWindow | undefined;

app
  .whenReady()
  .then(async () => {
    hostWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    hostWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    if (process.env.ELECTRON_RENDERER_URL) {
      await hostWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      await hostWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
  })
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });

app.on('window-all-closed', () => app.quit());
