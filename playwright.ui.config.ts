import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';
import { rendererOrigin, uiPort } from './tests/ui/renderer-url.js';

type UiOptions = { uiHost: 'browser' | 'electron' };

const resultsDirectory = fileURLToPath(new URL('./test-results/', import.meta.url));
mkdirSync(resultsDirectory, { recursive: true });
process.env.SCHOOLOOM_UI_PORT ??= String(uiPort);
process.env.SCHOOLOOM_UI_DATA_DIR ??= mkdtempSync(join(resultsDirectory, 'ui-profile-'));

export default defineConfig<UiOptions>({
  ...baseConfig,
  testDir: './tests/ui',
  outputDir: `./test-results/ui-${uiPort}`,
  globalTeardown: './tests/ui/teardown.ts',
  use: { ...(baseConfig.use ?? {}), baseURL: rendererOrigin },
  projects: [
    { name: 'ui-browser', use: { uiHost: 'browser' } },
    { name: 'ui-electron', use: { uiHost: 'electron' } },
  ],
  webServer: {
    command: `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop dev:browser --port ${uiPort} --strictPort`,
    url: rendererOrigin,
    reuseExistingServer: false,
    env: {
      SCHOOLOOM_DATA_DIR: process.env.SCHOOLOOM_UI_DATA_DIR,
      SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
    },
  },
});
