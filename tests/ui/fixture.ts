import { fileURLToPath } from 'node:url';
import { test as base, _electron as electron, expect, type Page } from '@playwright/test';

type UiHost = 'browser' | 'electron';

type UiFixtures = {
  uiHost: UiHost;
  uiPage: Page;
};

const desktopPath = fileURLToPath(new URL('../../apps/desktop', import.meta.url));
const rendererUrl = 'http://127.0.0.1:5174/';

export const test = base.extend<UiFixtures>({
  uiHost: ['browser', { option: true }],
  uiPage: async ({ page, uiHost }, use) => {
    if (uiHost === 'browser') {
      await use(page);
      return;
    }

    const app = await electron.launch({
      args: [desktopPath],
      env: { ...process.env, ELECTRON_RENDERER_URL: rendererUrl },
    });
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState('domcontentloaded');
      await use(window);
    } finally {
      await app.close();
    }
  },
});

export { expect };
