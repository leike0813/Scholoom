import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium, _electron as electron } from '@playwright/test';
import { closeDesktop } from '../../desktop-fixture.ts';
import { createStructureController } from './controller.ts';

const [built, output, host] = process.argv.slice(2);
assert(
  built && output && ['browser', 'electron'].includes(host ?? ''),
  'Supply absolute built, new cache output and browser|electron',
);
assert(resolve(built) === built && resolve(output) === output);
assert(
  process.env.TMPDIR?.startsWith('/home/joshua/.cache/'),
  'Set a short dedicated cache TMPDIR',
);
await mkdir(output, { recursive: true });
execFileSync('xdpyinfo', ['-display', process.env.DISPLAY ?? ':99'], { stdio: 'ignore' });
const controller = await createStructureController(built);
let browser, app;
try {
  let page;
  if (host === 'browser') {
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
    await page.goto(controller.origin);
  } else {
    app = await electron.launch({
      args: [resolve('apps/desktop')],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: controller.origin,
        SCHOOLOOM_DATA_DIR: join(output, 'profile'),
        XDG_CONFIG_HOME: join(output, 'xdg-config'),
        SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
      },
    });
    page = await app.firstWindow();
    await writeFile(
      join(output, 'host-profile.json'),
      JSON.stringify(
        await app.evaluate(({ app, session }) => ({
          userData: app.getPath('userData'),
          storagePath: session.defaultSession.storagePath,
        })),
        null,
        2,
      ),
    );
  }
  await page.frameLocator('iframe').getByLabel('筛选文献', { exact: true }).waitFor();
  await page.screenshot({ path: join(output, 'opened.png') });
  await writeFile(
    join(output, 'opened-state.json'),
    JSON.stringify(await controller.read(), null, 2),
  );
  console.log(`R2b ready (${host}); bounded to 180s, close window or interrupt to finish`);
  await new Promise((done) => {
    const timer = setTimeout(done, 180000);
    const finish = () => {
      clearTimeout(timer);
      done();
    };
    page.once('close', finish);
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
  });
} finally {
  if (app) await closeDesktop(app);
  if (browser) await browser.close();
  await writeFile(join(output, 'closed.json'), JSON.stringify(await controller.close()));
}
