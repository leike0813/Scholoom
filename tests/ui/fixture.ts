import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  test as base,
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
} from '@playwright/test';
import { createDevelopmentKernel } from '../../apps/kernel/dist/bootstrap.js';
import { closeDesktop } from '../desktop-fixture.js';

type UiHost = 'browser' | 'electron';

type UiFixtures = {
  uiHost: UiHost;
  uiPage: Page;
  downloadFile: (action: () => Promise<unknown>, destination: string) => Promise<void>;
};
const desktops = new WeakMap<Page, ElectronApplication>();

const desktopPath = fileURLToPath(new URL('../../apps/desktop', import.meta.url));
const rendererUrl = 'http://127.0.0.1:5174/';

export const test = base.extend<UiFixtures>({
  uiHost: ['browser', { option: true }],
  uiPage: async ({ page, uiHost }, use) => {
    const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
    if (!directory) throw new Error('Missing isolated UI configuration');
    const owner = createDevelopmentKernel({ dataDirectory: directory });
    const ready = await owner.bootstrap('ensure');
    if (ready.state !== 'running') throw new Error('Development UI kernel unavailable');
    try {
      if (uiHost === 'browser') {
        await use(page);
        return;
      }

      const app = await electron.launch({
        args: [desktopPath],
        env: {
          ...process.env,
          ELECTRON_RENDERER_URL: rendererUrl,
          SCHOOLOOM_DATA_DIR: directory,
          SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
        },
      });
      try {
        const window = await app.firstWindow();
        desktops.set(window, app);
        await window.waitForLoadState('domcontentloaded');
        await expect(window.getByRole('status', { name: '连接状态' })).toContainText('已连接');
        await expect(
          window.getByRole('button', { name: '在普通会话中新建会话', exact: true }),
        ).toBeEnabled();
        await use(window);
      } finally {
        await closeDesktop(app);
      }
    } finally {
      await owner.dispose();
    }
  },
  downloadFile: async ({ uiPage }, use) => {
    await use(async (action, destination) => {
      const desktop = desktops.get(uiPage);
      if (!desktop) {
        const pending = uiPage.waitForEvent('download');
        await action();
        await (await pending).saveAs(destination);
        return;
      }
      await desktop.evaluate(({ session }, target) => {
        Reflect.set(globalThis, '__scholoomDownloadState', 'notStarted');
        session.defaultSession.once('will-download', (_event, item) => {
          Reflect.set(globalThis, '__scholoomDownloadState', 'started');
          item.setSavePath(target);
          item.once('done', (_event, state) =>
            Reflect.set(globalThis, '__scholoomDownloadState', state),
          );
        });
      }, destination);
      await action();
      await expect
        .poll(() => desktop.evaluate(() => Reflect.get(globalThis, '__scholoomDownloadState')), {
          timeout: 10000,
        })
        .toBe('completed');
    });
  },
});

export { expect };

export async function createSession(page: Page, projectName = '普通会话'): Promise<void> {
  await page.getByRole('button', { name: `在${projectName}中新建会话`, exact: true }).click();
}

async function chooseProjectDirectory(page: Page, path: string, mode: 'open' | 'create') {
  const selected = mode === 'open' ? path : dirname(path);
  const desktop = desktops.get(page);
  if (desktop)
    await desktop.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    }, selected);
  else
    await page.evaluate(
      (directory) => localStorage.setItem('scholoom.project-picker.directory', directory),
      selected,
    );
  await page.getByRole('button', { name: '添加项目', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加项目' });
  if (mode === 'create') await dialog.getByRole('tab', { name: '新建项目' }).click();
  await dialog.getByRole('button', { name: mode === 'open' ? '选择目录' : '选择父目录' }).click();
  if (!desktop) {
    await expect(dialog.getByRole('region', { name: '选择目录' }).locator('code')).toContainText(
      basename(selected),
    );
    await dialog.getByRole('button', { name: '选择此目录' }).click();
  }
  if (mode === 'create') await dialog.getByLabel('新文件夹名称').fill(basename(path));
  await expect(dialog.getByText(`项目名将使用目录名：${basename(path)}`)).toBeVisible();
  await dialog.getByRole('button', { name: mode === 'open' ? '打开项目' : '创建项目' }).click();
  const trustDialog = page.getByRole('dialog', { name: '确认项目访问', exact: true });
  await expect(trustDialog).toBeVisible();
  return trustDialog;
}

export async function cancelProjectOnboarding(
  page: Page,
  path: string,
  { mode = 'open' }: { mode?: 'open' | 'create' } = {},
): Promise<void> {
  const trustDialog = await chooseProjectDirectory(page, path, mode);
  await trustDialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(trustDialog).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '添加项目', exact: true })).toBeVisible();
}

/**
 * 经“添加项目”弹窗打开或新建项目。Electron 在主进程替换系统目录选择器；浏览器宿主把弹窗内
 * 目录浏览器的起点预置为待选目录，再经真实 UI 选择。新建模式下 path 为新项目目录，选择其父目录。
 */
export async function addProject(
  page: Page,
  path: string,
  {
    mode = 'open',
    trust = 'trusted',
  }: { mode?: 'open' | 'create'; trust?: 'trusted' | 'restricted' } = {},
): Promise<void> {
  const trustDialog = await chooseProjectDirectory(page, path, mode);
  await trustDialog
    .getByRole('button', {
      name: trust === 'trusted' ? '信任项目' : '以受限模式添加',
      exact: true,
    })
    .click();
  await expect(trustDialog).toHaveCount(0);
}
