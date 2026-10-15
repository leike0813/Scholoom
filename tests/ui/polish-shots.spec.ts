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
});
