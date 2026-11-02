import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { rendererOrigin } from '../../ui/renderer-url.js';

const root = process.env.SCHOOLOOM_REPORT_PRODUCT_RUN;
const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
const scenario = process.env.SCHOOLOOM_REPORT_PRODUCT_SCENARIO ?? 'product';
if (!['product', 'selection', 'lifecycle'].includes(scenario))
  throw new Error('Unknown report scenario');
if (!root || !directory)
  throw new Error('Run through report-product/run.mjs with a real installation');
export default defineConfig<{ uiHost: 'browser' | 'electron' }>({
  testDir: '.',
  testMatch: `${scenario}.spec.ts`,
  outputDir: join(root, 'results'),
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['list'], ['json', { outputFile: join(root, 'results.json') }]],
  use: { baseURL: rendererOrigin, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'ui-browser', use: { uiHost: 'browser' } },
    { name: 'ui-electron', use: { uiHost: 'electron' } },
  ],
  globalTeardown: './teardown.ts',
  webServer: {
    command: 'node tests/fixtures/report-product/server.mjs',
    cwd: process.cwd(),
    url: rendererOrigin,
    reuseExistingServer: false,
    env: { SCHOOLOOM_DATA_DIR: directory, SCHOOLOOM_NODE_EXECUTABLE: process.execPath },
  },
});
