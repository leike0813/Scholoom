import { expect, test } from './fixture.js';

const rendererUrl = 'http://127.0.0.1:5174/';
const sampleUrl = `${rendererUrl}?scenario=ui-foundation`;

test.use({ viewport: { height: 900, width: 1440 } });

test('polish visual states', async ({ uiPage }, info) => {
  test.skip(info.project.name !== 'ui-browser', 'screenshots only from the browser host');
  await uiPage.goto(sampleUrl);
  const input = uiPage.getByRole('textbox', { name: '研究指令' });
  await expect(input).toBeVisible();
  await input.fill('梳理这份研究计划');
  await uiPage.getByRole('button', { name: '发送指令' }).click();
  await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
  await expect(uiPage.getByRole('article', { name: /Agent\s*回复/ })).toBeVisible();
  await uiPage.getByRole('button', { name: '收起会话' }).click();

  await uiPage.emulateMedia({ colorScheme: 'light' });
  await uiPage.screenshot({ path: info.outputPath('polish-01-light-default.png') });

  await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
  await expect(uiPage.getByRole('dialog', { name: 'Agent 会话' })).toBeVisible();
  await uiPage.screenshot({ path: info.outputPath('polish-02-light-overlay.png') });

  await uiPage.emulateMedia({ colorScheme: 'dark' });
  await uiPage.screenshot({ path: info.outputPath('polish-03-dark-overlay.png') });

  await uiPage.setViewportSize({ height: 700, width: 960 });
  await uiPage.screenshot({ path: info.outputPath('polish-04-narrow-dark.png') });

  await uiPage.setViewportSize({ height: 900, width: 1440 });
  await uiPage.getByRole('button', { name: '收起会话' }).click();
  await uiPage.getByRole('button', { name: '折叠左区' }).click();
  await uiPage.getByRole('button', { name: '折叠右区' }).click();
  await uiPage.emulateMedia({ colorScheme: 'light' });
  await uiPage.screenshot({ path: info.outputPath('polish-05-collapsed-both.png') });

  await uiPage.goto(rendererUrl);
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await uiPage.screenshot({ path: info.outputPath('polish-06-empty-light.png') });
  await uiPage.emulateMedia({ colorScheme: 'dark' });
  await uiPage.screenshot({ path: info.outputPath('polish-07-empty-dark.png') });

  // 左区底栏详情层、会话右键菜单与行内改名、两个居中弹窗及 overlay composer。
  await uiPage.emulateMedia({ colorScheme: 'light' });
  await uiPage.getByRole('status', { name: '连接状态' }).hover();
  await uiPage.screenshot({ path: info.outputPath('polish-08-kernel-detail.png') });
  await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
  const row = uiPage
    .getByRole('tree')
    .getByRole('button', { name: /^打开会话 / })
    .first();
  await row.click({ button: 'right' });
  const menu = uiPage.getByRole('menu', { name: /^管理会话 / });
  await expect(menu).toBeVisible();
  await uiPage.screenshot({ path: info.outputPath('polish-09-session-menu.png') });
  await menu.getByRole('button', { name: '重命名', exact: true }).click();
  await expect(uiPage.getByLabel(/^会话标题 /)).toBeFocused();
  await uiPage.screenshot({ path: info.outputPath('polish-10-inline-rename.png') });
  await uiPage.keyboard.press('Escape');
  await uiPage.getByRole('button', { name: '查找会话', exact: true }).click();
  await expect(uiPage.getByRole('dialog', { name: '查找会话' })).toBeVisible();
  await uiPage.screenshot({ path: info.outputPath('polish-11-search-dialog.png') });
  await uiPage.keyboard.press('Escape');
  await uiPage.getByRole('button', { name: '添加项目', exact: true }).click();
  const onboarding = uiPage.getByRole('dialog', { name: '添加项目' });
  await uiPage.screenshot({ path: info.outputPath('polish-12-add-project.png') });
  await onboarding.getByRole('button', { name: '选择目录', exact: true }).click();
  await expect(onboarding.getByRole('region', { name: '选择目录' })).toBeVisible();
  await uiPage.screenshot({ path: info.outputPath('polish-13-directory-picker.png') });
  await uiPage.emulateMedia({ colorScheme: 'dark' });
  await uiPage.screenshot({ path: info.outputPath('polish-14-directory-picker-dark.png') });
  await uiPage.keyboard.press('Escape');
  await uiPage.getByLabel(/^模型与推理强度：/).click();
  await uiPage.screenshot({ path: info.outputPath('polish-15-dock-picker-dark.png') });
  await uiPage.keyboard.press('Escape');
  await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
  await uiPage.screenshot({ path: info.outputPath('polish-16-overlay-composer-dark.png') });
  await uiPage.emulateMedia({ colorScheme: 'light' });
  await uiPage.getByLabel(/^模型与推理强度：/).click();
  await uiPage.screenshot({ path: info.outputPath('polish-17-overlay-picker-light.png') });
});
