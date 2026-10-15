import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isBootstrapRequest } from '@scholoom/protocol';
import { app, BrowserWindow, ipcMain } from 'electron';

function isWorkbenchUrl(url: string): boolean {
  const expected = new URL(
    process.env.ELECTRON_RENDERER_URL ??
      pathToFileURL(join(__dirname, '../renderer/index.html')).href,
  );
  const actual = new URL(url);
  return (
    actual.protocol === expected.protocol &&
    actual.host === expected.host &&
    actual.pathname === expected.pathname
  );
}

ipcMain.handle('kernel:bootstrap', async (event, mode: unknown) => {
  if (
    !BrowserWindow.fromWebContents(event.sender) ||
    event.senderFrame !== event.sender.mainFrame ||
    !isWorkbenchUrl(event.senderFrame.url) ||
    !isBootstrapRequest({ mode })
  ) {
    return {
      state: 'unknown',
      error: { code: 'permissionDenied', message: 'Invalid bootstrap source.' },
    };
  }
  const { bootstrapKernel } = await import('@scholoom/kernel/bootstrap');
  return bootstrapKernel(mode as 'ensure' | 'inspect');
});

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    title: 'Scholoom',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isWorkbenchUrl(url)) event.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app
  .whenReady()
  .then(createWindow)
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow().catch((error: unknown) => {
      console.error(error);
      app.exit(1);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
