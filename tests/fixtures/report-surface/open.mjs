// Bounded manual entry for the same fixed prototype. No kernel/model/service install.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, _electron as electron } from '@playwright/test';
import { closeDesktop } from '../../desktop-fixture.ts';
import { createSurfaceController } from './controller.ts';

const [built, output, host] = process.argv.slice(2);
assert(
  built && output && ['browser', 'electron'].includes(host ?? ''),
  'Usage: node tests/fixtures/report-surface/open.mjs <absolute-built> <new-cache-output> browser|electron',
);
assert(resolve(built) === built && resolve(output) === output);
assert(
  process.env.TMPDIR?.startsWith('/home/joshua/.cache/'),
  'Set TMPDIR to your dedicated cache',
);
await mkdir(output, { recursive: true });
execFileSync('xdpyinfo', ['-display', process.env.DISPLAY ?? ':99'], { stdio: 'ignore' });
const controller = await createSurfaceController(built);
let browser;
let app;
try {
  let page;
  if (host === 'browser') {
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
  } else {
    app = await electron.launch({
      args: [resolve('apps/desktop')],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: controller.origin,
        SCHOOLOOM_DATA_DIR: join(output, 'profile'),
        SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
      },
    });
    page = await app.firstWindow();
  }
  if (browser) await page.goto(controller.origin);
  await page.getByRole('tab', { name: /可信呈现试验/ }).waitFor();
  console.log(
    `R2 trusted prototype (${host}); closes after 180s or window close. Source: ${controller.origin}/source.html`,
  );
  await new Promise((done) => {
    const timer = setTimeout(done, 180_000);
    const finish = () => {
      clearTimeout(timer);
      done();
    };
    page.once('close', finish);
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
  });
  await writeFile(
    join(output, 'source-state.json'),
    JSON.stringify(
      await controller.read().catch((error) => ({ unavailableAfterClose: String(error) })),
      null,
      2,
    ),
  );
} finally {
  if (app) await closeDesktop(app);
  if (browser) await browser.close();
  await writeFile(join(output, 'closed.json'), JSON.stringify(await controller.close()));
}
