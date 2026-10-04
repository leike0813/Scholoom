import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

test('kernel CLI runs under independent Node', () => {
  const output = execFileSync(process.execPath, ['apps/kernel/dist/cli.js', '--info'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const info = JSON.parse(output) as {
    protocolVersion: number;
    nodeVersion: string;
    processId: number;
  };
  expect(info.protocolVersion).toBeGreaterThan(0);
  expect(info.nodeVersion).toBe(process.versions.node);
  expect(info.processId).toBeGreaterThan(0);
});

test('desktop loads React and its sandbox preload', async () => {
  const app = await electron.launch({
    args: [fileURLToPath(new URL('../../apps/desktop', import.meta.url))],
  });
  try {
    const window = await app.firstWindow();
    await expect(window.getByRole('heading', { level: 1 })).toBeVisible();
    const platform = await window.evaluate(() => Reflect.get(window, 'scholoomDesktop')?.platform);
    expect(platform).toBe(process.platform);
    expect(await window.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');
  } finally {
    await app.close();
  }
});

test('compatibility host loads its own hidden Chromium page', async () => {
  const app = await electron.launch({
    args: [fileURLToPath(new URL('../../apps/zotero-host', import.meta.url))],
  });
  try {
    const window = await app.firstWindow();
    await expect(window.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible()),
    ).toBe(false);
  } finally {
    await app.close();
  }
});
