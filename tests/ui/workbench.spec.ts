import { expect, test } from './fixture.js';

const rendererUrl = 'http://127.0.0.1:5174/';
const sampleUrl = `${rendererUrl}?scenario=ui-foundation`;

test('default workbench stays disconnected and cannot send', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);

  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('未连接');
  const instruction = uiPage.getByRole('textbox', { name: '研究指令' });
  await expect(instruction).toBeEditable();
  await instruction.fill('未连接时保留可编辑草稿');
  await expect(uiPage.getByRole('button', { name: '发送指令' })).toBeDisabled();
  await expect(uiPage.getByRole('article')).toHaveCount(0);
});

test('blank sample instruction cannot send', async ({ uiPage }) => {
  await uiPage.goto(sampleUrl);
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('样例');
  const instruction = uiPage.getByRole('textbox', { name: '研究指令' });

  await instruction.fill('   \n  ');
  await expect(uiPage.getByRole('button', { name: '发送指令' })).toBeDisabled();
  await expect(uiPage.getByRole('article')).toHaveCount(0);
});

for (const scenario of [
  { name: 'one selected material', selected: ['研究计划.md'], expected: '研究计划.md' },
  {
    name: 'two selected materials',
    selected: ['研究计划.md', '示例论文.pdf'],
    expected: '研究计划.md、示例论文.pdf',
  },
  { name: 'no selected materials', selected: [], expected: '未附加材料' },
]) {
  test(`sample reply captures ${scenario.name}`, async ({ uiPage }) => {
    await uiPage.goto(sampleUrl);
    for (const material of ['研究计划.md', '示例论文.pdf']) {
      const checkbox = uiPage.getByRole('checkbox', { name: material });
      const shouldBeChecked = scenario.selected.includes(material);
      await checkbox.setChecked(shouldBeChecked);
    }

    const instruction = uiPage.getByRole('textbox', { name: '研究指令' });
    await instruction.fill('  梳理研究问题  ');
    await uiPage.getByRole('button', { name: '发送指令' }).click();

    await expect(uiPage.getByRole('article', { name: /Agent\s*回复/ })).toBeVisible();
    await uiPage.getByRole('checkbox', { name: '研究计划.md' }).click();

    await expect(uiPage.getByRole('article', { name: '用户消息' })).toContainText('梳理研究问题');
    await expect(uiPage.getByRole('article', { name: /Agent\s*回复/ })).toContainText(
      scenario.expected,
    );
    await expect(uiPage.getByText('梳理研究问题', { exact: true })).toBeVisible();
    await expect(instruction).toHaveValue('');
  });
}

test('sample keeps only the latest exchange', async ({ uiPage }) => {
  await uiPage.goto(sampleUrl);
  const instruction = uiPage.getByRole('textbox', { name: '研究指令' });
  const send = uiPage.getByRole('button', { name: '发送指令' });

  await instruction.fill('第一轮');
  await send.click();
  await instruction.fill('第二轮');
  await instruction.press('Control+Enter');

  const userMessage = uiPage.getByRole('article', { name: '用户消息' });
  await expect(userMessage).toHaveCount(1);
  await expect(userMessage).toContainText('第二轮');
  await expect(uiPage.getByRole('article', { name: /Agent\s*回复/ })).toHaveCount(1);
});

test('reset restores the sample and refresh starts from its initial state', async ({ uiPage }) => {
  await uiPage.goto(sampleUrl);
  const plan = uiPage.getByRole('checkbox', { name: '研究计划.md' });
  const paper = uiPage.getByRole('checkbox', { name: '示例论文.pdf' });
  await plan.uncheck();
  await paper.check();
  await uiPage.getByRole('textbox', { name: '研究指令' }).fill('重置前的指令');
  await uiPage.getByRole('button', { name: '发送指令' }).click();
  await uiPage.getByRole('textbox', { name: '研究指令' }).fill('尚未发送的草稿');
  await uiPage.getByRole('button', { name: '重置示例' }).click();

  await expect(plan).toBeChecked();
  await expect(paper).not.toBeChecked();
  await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue('');
  await expect(uiPage.getByRole('article')).toHaveCount(0);

  await paper.check();
  await uiPage.getByRole('textbox', { name: '研究指令' }).fill('刷新前的消息');
  await uiPage.getByRole('button', { name: '发送指令' }).click();
  await uiPage.getByRole('textbox', { name: '研究指令' }).fill('刷新前的草稿');
  await uiPage.reload();

  await expect(plan).toBeChecked();
  await expect(paper).not.toBeChecked();
  await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue('');
  await expect(uiPage.getByRole('article')).toHaveCount(0);
});
