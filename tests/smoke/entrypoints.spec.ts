import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';
import { limits } from '../../packages/protocol/dist/index.js';
import { closeDesktop } from '../desktop-fixture.js';
import { isolatedKernel, runKernel } from '../kernel-fixture.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const connectionTimeout = limits.lifecycleMs + limits.authenticationMs;
const desktopLaunch = process.env.SCHOOLOOM_PACKAGED_DESKTOP
  ? { executablePath: process.env.SCHOOLOOM_PACKAGED_DESKTOP, args: [] }
  : { args: [fileURLToPath(new URL('../../apps/desktop', import.meta.url))] };

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
  expect(info.protocolVersion).toBe(4);
  expect(info.nodeVersion).toBe(process.versions.node);
  expect(info.processId).toBeGreaterThan(0);
});

test('desktop loads React and its sandbox preload', async () => {
  await isolatedKernel(async (directory) => {
    const app = await electron.launch({
      ...desktopLaunch,
      env: {
        ...process.env,
        SCHOOLOOM_DATA_DIR: directory,
        SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
      },
    });
    try {
      const window = await app.firstWindow();
      await expect(window.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(window.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
        timeout: connectionTimeout,
      });
      await expect(window.getByRole('button', { name: '发送指令' })).toBeDisabled();
      const platform = await window.evaluate(
        () => Reflect.get(window, 'scholoomDesktop')?.platform,
      );
      expect(platform).toBe(process.platform);
      expect(await window.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');

      const scenario = new URL(window.url());
      scenario.searchParams.set('scenario', 'ui-foundation');
      await window.goto(scenario.href);
      await expect(window.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
        timeout: connectionTimeout,
      });
      await expect(window.getByRole('checkbox')).toHaveCount(0);
    } finally {
      await closeDesktop(app);
    }
    expect((await runKernel(directory, 'status')).state).toBe('running');
  });
});

test('desktop closes without stopping kernel and a new window reconnects', async () => {
  await isolatedKernel(async (directory) => {
    let instanceId: string | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const app = await electron.launch({
        ...desktopLaunch,
        env: {
          ...process.env,
          SCHOOLOOM_DATA_DIR: directory,
          SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
        },
      });
      try {
        const page = await app.firstWindow();
        await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
          timeout: connectionTimeout,
        });
        const current = await runKernel(directory, 'status');
        expect(current.state).toBe('running');
        if (current.state === 'running') {
          if (instanceId) expect(current.endpoint.instanceId).toBe(instanceId);
          instanceId = current.endpoint.instanceId;
          await page.getByRole('status', { name: '连接状态' }).hover();
          await expect(page.getByText(`实例 ${instanceId}`, { exact: true })).toBeVisible();
        }
      } finally {
        await closeDesktop(app);
      }
      expect((await runKernel(directory, 'status')).state).toBe('running');
    }
  });
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
