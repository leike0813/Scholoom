import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

type UiOptions = { uiHost: 'browser' | 'electron' };

export default defineConfig<UiOptions>({
  ...baseConfig,
  testDir: './tests/ui',
  projects: [
    { name: 'ui-browser', use: { uiHost: 'browser' } },
    { name: 'ui-electron', use: { uiHost: 'electron' } },
  ],
  webServer: {
    command: 'pnpm --filter @scholoom/desktop dev:browser --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
});
