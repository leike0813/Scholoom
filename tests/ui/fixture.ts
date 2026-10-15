import { fileURLToPath } from 'node:url';
import {
  test as base,
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
} from '@playwright/test';
import { closeDesktop } from '../desktop-fixture.js';
import { runningKernel } from '../kernel-fixture.js';

type UiHost = 'browser' | 'electron';

type UiFixtures = {
  uiHost: UiHost;
  uiPage: Page;
  downloadFile: (action: () => Promise<unknown>, destination: string) => Promise<void>;
};
const desktops = new WeakMap<Page, ElectronApplication>();

const desktopPath = fileURLToPath(new URL('../../apps/desktop', import.meta.url));
const rendererUrl = 'http://127.0.0.1:5174/';

export const test = base.extend<UiFixtures>({
  uiHost: ['browser', { option: true }],
  uiPage: async ({ page, uiHost }, use) => {
    const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
    if (!directory) throw new Error('Missing isolated UI configuration');
    await runningKernel(directory);
    if (uiHost === 'browser') {
      await use(page);
      return;
    }

    const app = await electron.launch({
      args: [desktopPath],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: rendererUrl,
        SCHOOLOOM_DATA_DIR: directory,
        SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
      },
    });
    try {
      const window = await app.firstWindow();
      desktops.set(window, app);
      await window.waitForLoadState('domcontentloaded');
      await use(window);
    } finally {
      await closeDesktop(app);
    }
  },
  downloadFile: async ({ uiPage }, use) => {
    await use(async (action, destination) => {
      const desktop = desktops.get(uiPage);
      if (!desktop) {
        const pending = uiPage.waitForEvent('download');
        await action();
        await (await pending).saveAs(destination);
        return;
      }
      await desktop.evaluate(({ session }, target) => {
        Reflect.set(globalThis, '__scholoomDownloadState', 'notStarted');
        session.defaultSession.once('will-download', (_event, item) => {
          Reflect.set(globalThis, '__scholoomDownloadState', 'started');
          item.setSavePath(target);
          item.once('done', (_event, state) =>
            Reflect.set(globalThis, '__scholoomDownloadState', state),
          );
        });
      }, destination);
      await action();
      await expect
        .poll(() => desktop.evaluate(() => Reflect.get(globalThis, '__scholoomDownloadState')), {
          timeout: 10000,
        })
        .toBe('completed');
    });
  },
});

export { expect };
