// Manual fixed prototype; no model, kernel or service installation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { chromium, _electron as electron } from '@playwright/test';
import { closeDesktop } from '../../desktop-fixture.ts';
import { createInputController } from './controller.ts';

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
const controller = await createInputController(built);
let browser, app;
try {
  let page;
  if (host === 'browser') {
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
    await page.goto(controller.origin);
  } else {
    const profile = join(output, 'electron-profile');
    app = await electron.launch({
      args: [`--user-data-dir=${profile}`, resolve('apps/desktop')],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: controller.origin,
        SCHOOLOOM_DATA_DIR: join(output, 'unused-kernel'),
        SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
      },
    });
    page = await app.firstWindow();
    const paths = await app.evaluate(({ app, session }) => ({
      userData: app.getPath('userData'),
      sessionData: app.getPath('sessionData'),
      storagePath: session.defaultSession.storagePath,
    }));
    for (const path of Object.values(paths)) {
      assert(path);
      assert.equal(relative(profile, path), '');
    }
    await writeFile(join(output, 'electron-profile.json'), JSON.stringify(paths, null, 2));
  }
  await page.frameLocator('iframe').getByRole('status', { name: '显示数量' }).waitFor();
  await page.screenshot({ path: join(output, 'opened.png') });
  await writeFile(
    join(output, 'opened-source.json'),
    JSON.stringify(await (await controller.get('first')).read(), null, 2),
  );
  console.log(`R2c ready (${host}); close window or interrupt; bounded to 180s`);
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
