import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

type UiOptions = { uiHost: 'browser' | 'electron' };

const resultsDirectory = fileURLToPath(new URL('./test-results/', import.meta.url));
mkdirSync(resultsDirectory, { recursive: true });
process.env.SCHOOLOOM_UI_DATA_DIR ??= mkdtempSync(join(resultsDirectory, 'ui-profile-'));

export default defineConfig<UiOptions>({
  ...baseConfig,
  testDir: './tests/ui',
  outputDir: './test-results/ui',
  globalTeardown: './tests/ui/teardown.ts',
  projects: [
    { name: 'ui-browser', use: { uiHost: 'browser' } },
    { name: 'ui-electron', use: { uiHost: 'electron' } },
  ],
  webServer: {
    command: 'pnpm --filter @scholoom/desktop dev:browser --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    env: {
      SCHOOLOOM_DATA_DIR: process.env.SCHOOLOOM_UI_DATA_DIR,
      SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
    },
  },
});

import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
