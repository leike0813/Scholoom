import { expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

const sampleUrl = `${rendererUrl}?scenario=ui-foundation`;

test('status bar notifications close with Escape without collapsing the Agent overlay', async ({
  uiPage,
}) => {
  await uiPage.goto(sampleUrl);
  const statusbar = uiPage.getByRole('region', { name: '状态栏', exact: true });
  const notifications = uiPage.getByLabel('工作台通知', { exact: true });
  await expect(statusbar).toBeVisible();

  await notifications.click();
  const details = uiPage.getByRole('region', {
    name: '工作台通知详情',
    exact: true,
  });
  await expect(details).toBeVisible();
  await expect(notifications).toContainText('0');
  await expect(details.locator('p')).toHaveCount(1);
  await notifications.click();
  await expect(details).toBeHidden();

  await uiPage.getByRole('button', { name: '展开 Agent 会话', exact: true }).click();
  const agent = uiPage.getByRole('dialog', { name: 'Agent 会话', exact: true });
  await expect(agent).toBeVisible();
  await notifications.click();
  await expect(details).toBeVisible();
  await uiPage.keyboard.press('Escape');

  await expect(details).toBeHidden();
  await expect(agent).toBeVisible();
  await expect(notifications).toBeFocused();
});

test('status bar remains through pane and overlay changes and matches the kernel edge at 960px', async ({
  uiPage,
}) => {
  await uiPage.goto(rendererUrl);
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await uiPage.setViewportSize({ width: 960, height: 800 });

  const statusbar = uiPage.getByRole('region', { name: '状态栏', exact: true });
  const kernelStatus = uiPage.locator('.kernel-status');
  await expect(statusbar).toBeVisible();
  await expect(kernelStatus).toBeVisible();
  await expect(uiPage.getByLabel('工作台通知', { exact: true })).toBeInViewport({ ratio: 1 });
  const bounds = async () =>
    Promise.all(
      [statusbar, kernelStatus].map((element) =>
        element.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height };
        }),
      ),
    );
  const expectAligned = async () => {
    const [barBounds, kernelBounds] = await bounds();
    if (!barBounds || !kernelBounds) throw new Error('状态栏或内核状态区缺少边界。');
    expect(Math.abs(barBounds.top - kernelBounds.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(barBounds.bottom - kernelBounds.bottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(barBounds.height - kernelBounds.height)).toBeLessThanOrEqual(1);
  };
  await expectAligned();
  await uiPage.screenshot({ path: test.info().outputPath('statusbar-light.png') });

  const themeButton = uiPage.getByRole('button', { name: '切换主题', exact: true });
  await themeButton.click();
  const lightSurface = await statusbar.evaluate((node) => getComputedStyle(node).backgroundColor);
  await themeButton.click();
  const darkSurface = await statusbar.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(darkSurface).not.toBe(lightSurface);
  await expect(statusbar).toBeVisible();
  await expectAligned();
  await uiPage.screenshot({ path: test.info().outputPath('statusbar-dark.png') });

  await uiPage.getByRole('button', { name: '折叠左区', exact: true }).click();
  await expect(statusbar).toBeVisible();
  await uiPage.getByRole('button', { name: '展开左区', exact: true }).click();
  await uiPage.getByRole('button', { name: '折叠右区', exact: true }).click();
  await expect(statusbar).toBeVisible();
  await uiPage.getByRole('button', { name: '展开右区', exact: true }).click();

  await uiPage.getByRole('button', { name: '展开 Agent 会话', exact: true }).click();
  await expect(uiPage.getByRole('dialog', { name: 'Agent 会话', exact: true })).toBeVisible();
  await uiPage.getByRole('button', { name: '收起会话', exact: true }).click();
  await expect(uiPage.getByRole('dialog', { name: 'Agent 会话', exact: true })).toBeHidden();
  await expect(statusbar).toBeVisible();
});
