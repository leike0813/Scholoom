import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isBootstrapRequest } from '@scholoom/protocol';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

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
  if (process.env.ELECTRON_RENDERER_URL) {
    const endpoint = new URL('/__scholoom/kernel/bootstrap', process.env.ELECTRON_RENDERER_URL);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Scholoom-Bootstrap': '1',
          Origin: endpoint.origin,
        },
        body: JSON.stringify({ mode }),
      });
      if (response.ok) return await response.json();
    } catch {
      // 由调试宿主持有内核；桥失败时交由界面重试。
    }
    return {
      state: 'unknown',
      error: { code: 'startupFailed', message: 'Development bootstrap unavailable.' },
    };
  }
  const { bootstrapKernel } = await import('@scholoom/kernel/bootstrap');
  return bootstrapKernel(
    mode as 'ensure' | 'inspect',
    app.isPackaged
      ? { dataDirectory: process.env.SCHOOLOOM_DATA_DIR ?? app.getPath('userData') }
      : {},
  );
});

ipcMain.handle('navigation:external', async (event, url: unknown) => {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    !isWorkbenchUrl(event.senderFrame.url) ||
    typeof url !== 'string'
  )
    throw new Error('Invalid navigation source');
  const target = new URL(url);
  if (!['https:', 'http:', 'mailto:'].includes(target.protocol))
    throw new Error('Unsupported navigation protocol');
  await shell.openExternal(target.href);
});

ipcMain.handle('dialog:open-directory', async (event, options: unknown) => {
  if (event.senderFrame !== event.sender.mainFrame || !isWorkbenchUrl(event.senderFrame.url))
    throw new Error('Invalid dialog source');
  const request =
    options && typeof options === 'object'
      ? (options as { title?: unknown; defaultPath?: unknown })
      : {};
  const openOptions: Electron.OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
  };
  if (typeof request.title === 'string' && request.title.trim())
    openOptions.title = request.title.slice(0, 200);
  if (typeof request.defaultPath === 'string' && request.defaultPath)
    openOptions.defaultPath = request.defaultPath;
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = owner
    ? await dialog.showOpenDialog(owner, openOptions)
    : await dialog.showOpenDialog(openOptions);
  return result.canceled ? null : (result.filePaths[0] ?? null);
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
