import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
import { rendererOrigin } from '../../ui/renderer-url';

const root = process.env.SCHOOLOOM_REPORT_DOM_RUN;
if (!root) throw new Error('Run with tests/fixtures/report-dom/run.mjs');
export default defineConfig<{ uiHost: 'browser' | 'electron' }>({
  testDir: '.',
  testMatch: ['probe.spec.ts', 'presentation.spec.ts', 'styles.spec.ts'],
  outputDir: join(root, 'results'),
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: join(root, 'results.json') }]],
  use: { baseURL: rendererOrigin, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'ui-browser', use: { uiHost: 'browser' } },
    { name: 'ui-electron', use: { uiHost: 'electron' } },
  ],
  globalTeardown: '../../ui/teardown.ts',
  webServer: {
    command: 'node /home/joshua/.cache/scholoom-round13-acceptance/preserved-tmp/static-ui.mjs',
    cwd: process.cwd(),
    url: rendererOrigin,
    reuseExistingServer: false,
    env: {
      SCHOOLOOM_DATA_DIR: process.env.SCHOOLOOM_UI_DATA_DIR!,
      SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
    },
  },
});
