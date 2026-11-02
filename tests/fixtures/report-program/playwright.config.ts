import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { rendererOrigin } from '../../ui/renderer-url';

const root = process.env.SCHOOLOOM_REPORT_PROGRAM_RUN;
const staticUI = process.env.SCHOOLOOM_STATIC_UI;
if (!root || !staticUI) throw new Error('Run tests/fixtures/report-program/run.mjs');
export default defineConfig<{ uiHost: 'browser' | 'electron' }>({
  testDir: '.',
  testMatch: 'program.spec.ts',
  outputDir: join(root, 'results'),
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: [['list'], ['json', { outputFile: join(root, 'results.json') }]],
  use: { baseURL: rendererOrigin, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'program-browser', use: { uiHost: 'browser' } },
    { name: 'program-electron', use: { uiHost: 'electron' } },
  ],
  webServer: {
    command: `node ${JSON.stringify(staticUI)}`,
    cwd: process.cwd(),
    url: rendererOrigin,
    reuseExistingServer: false,
    env: {
      SCHOOLOOM_DATA_DIR: join(root, 'kernel'),
      SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
    },
  },
});
