import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { expect, test } from './fixture.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('user configures, edits safely and receives a real persisted Agent result', async ({
  uiPage,
}, info) => {
  test.setTimeout(60000);
  const runtimeErrors: string[] = [];
  uiPage.on('pageerror', (error) => runtimeErrors.push(error.message));
  const model = await createModelServer();
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR as string;
  const stop = await startModelKernel(directory, model.url);
  const project = await mkdtemp(join(tmpdir(), 'scholoom-ui-project-'));
  try {
    await writeFile(join(project, 'input.md'), '# 输入\n\n合成材料。\n');
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
    await uiPage.getByText('打开项目', { exact: true }).click();
    await uiPage.getByRole('textbox', { name: '项目目录', exact: true }).fill(project);
    await uiPage.getByRole('button', { name: '打开目录' }).click();
    await expect(uiPage.getByLabel('执行上下文')).toContainText(basename(project));
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('项目权限与备份', { exact: true }).click();
    for (const label of [
      '读取项目材料',
      '新建、修改、重命名和回收／恢复项目文件及目录',
      '将项目材料发送到 MiniMax',
    ])
      await uiPage.getByLabel(label, { exact: true }).check();
    await uiPage.getByRole('button', { name: '保存项目授权' }).click();
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    await uiPage.getByRole('button', { name: '打开文件 input.md', exact: true }).click();
    const editor = uiPage.getByRole('textbox', { name: '文件内容 input.md', exact: true });
    await expect(editor).toContainText('合成材料');
    await editor.fill('# 输入\n\n用户草稿。\n');
    await writeFile(join(project, 'input.md'), '# 输入\n\n外部修改。\n');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).click();
    await expect(uiPage.getByRole('alert').filter({ hasText: '变化' })).toBeVisible();
    await expect(editor).toContainText('用户草稿');
    expect(await readFile(join(project, 'input.md'), 'utf8')).toContain('外部修改');
    await uiPage.getByRole('button', { name: '重新读取', exact: true }).click();
    await expect(uiPage.getByRole('alert')).toHaveCount(0);
    await editor.fill('# 输入\n\n外部修改。用户补充。\n');
    await armRpcGate(uiPage, 'files.save');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).click();
    await editor.fill('# 输入\n\n保存期间的新编辑。\n');
    await releaseRpcGate(uiPage);
    await expect.poll(() => readFile(join(project, 'input.md'), 'utf8')).toContain('用户补充');
    await expect(editor).toContainText('保存期间的新编辑');
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '打开文件 input.md', exact: true }).click();
    await expect(editor).toContainText('保存期间的新编辑');
    await uiPage.getByLabel('附加 input.md', { exact: true }).check();
    await uiPage
      .getByRole('textbox', { name: '研究指令' })
      .fill('MODEL_FIXTURE 读取材料并保存结果');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect
      .poll(() => readFile(join(project, 'result.md'), 'utf8').catch(() => ''))
      .toContain('合成样本');
    expect(runtimeErrors).toEqual([]);
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(
      uiPage
        .getByRole('article', { name: 'Agent 回复' })
        .filter({ hasText: '分析已保存到 result.md' }),
    ).toBeVisible();
    await expect(uiPage.getByLabel('执行上下文')).toContainText('MiniMax-M3.1-Flash-Preview');
    await expect(uiPage.getByLabel('执行上下文')).toContainText('写入已授权');
    const readTool = uiPage.locator('details.tool-call').filter({ hasText: 'read_file' });
    await readTool.locator('summary').click();
    await expect(readTool).toContainText('/input.md');
    await expect(readTool).toContainText('用户补充');
    await uiPage.screenshot({ path: info.outputPath('harness-tools.png') });
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
    await uiPage.screenshot({ path: info.outputPath('harness-tools-dark.png') });
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill('查看成果时保留的草稿');
    await uiPage.getByRole('button', { name: '打开成果 result.md', exact: true }).click();
    await expect(uiPage.getByRole('dialog', { name: 'Agent 会话', exact: true })).toHaveCount(0);
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 result.md', exact: true }),
    ).toContainText('合成样本');
    await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue(
      '查看成果时保留的草稿',
    );
    await uiPage.screenshot({ path: info.outputPath('harness-result.png') });
    await uiPage.reload();
    await expect(uiPage.getByText(/分析已保存到 result.md/)).toBeVisible();
    await armRpcGate(uiPage, 'session.create');
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toBeDisabled();
    await releaseRpcGate(uiPage);
    await uiPage
      .getByRole('textbox', { name: '研究指令' })
      .fill('MODEL_FIXTURE 保留已有 result.md');
    await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue(
      'MODEL_FIXTURE 保留已有 result.md',
    );
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await expect(
      uiPage.locator('.dock-transcript').getByRole('img', { name: '失败', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const failedTool = uiPage.locator('details.tool-call').filter({ hasText: 'write_file' });
    await failedTool.locator('summary').click();
    await expect(failedTool).toContainText('contentChanged');
    expect(await readFile(join(project, 'result.md'), 'utf8')).toContain('合成样本');
    await uiPage.reload();
    await expect(
      uiPage.locator('.dock-transcript').getByRole('img', { name: '失败', exact: true }),
    ).toBeVisible();
    const draft = '未受理草稿'.repeat(7000);
    const composer = uiPage.getByRole('textbox', { name: '研究指令' });
    await composer.fill(draft);
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect(uiPage.getByRole('alert')).toBeVisible();
    await expect(composer).toHaveValue(draft);
    await uiPage.reload();
    await expect(composer).toHaveValue(draft);
  } finally {
    await stop();
    await model.close();
    await rm(project, { recursive: true });
  }
});

test('late send failure restores its original conversation and storage failures keep the newest draft', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  try {
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
    await uiPage
      .getByRole('combobox', { name: '当前项目', exact: true })
      .selectOption('application');
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    await input.fill('会话 A 的未受理指令');
    await armRpcGate(uiPage, 'session.send');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    const sessions = uiPage.locator('.session-list button[aria-pressed]');
    const count = await sessions.count();
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    await expect(sessions).toHaveCount(count + 1);
    await expect(sessions.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toHaveValue('');
    await input.fill('会话 B 的草稿');
    await releaseRpcGate(uiPage, true);
    await expect(uiPage.getByRole('alert')).toBeVisible();
    await expect(input).toHaveValue('会话 B 的草稿');
    await armRpcGate(uiPage, 'workbench.watch');
    await sessions.nth(1).click();
    await expect(uiPage.getByLabel('执行上下文')).toContainText('正在核对权限');
    await expect(uiPage.getByRole('button', { name: '发送指令', exact: true })).toBeDisabled();
    await releaseRpcGate(uiPage);
    await expect(input).toHaveValue('会话 A 的未受理指令');
    await uiPage.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('Synthetic quota', 'QuotaExceededError');
      };
    });
    await input.fill('会话 A 的新草稿');
    await sessions.first().click();
    await expect(input).toHaveValue('会话 B 的草稿');
    await sessions.nth(1).click();
    await expect(input).toHaveValue('会话 A 的新草稿');
    await input.fill('');
    await sessions.first().click();
    await sessions.nth(1).click();
    await expect(input).toHaveValue('');
    expect(model.requests).toHaveLength(0);
  } finally {
    await stop();
    await model.close();
  }
});

test('busy conversation accepts additions, cancellation survives reload and continuation is explicit', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  try {
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
    await uiPage
      .getByRole('combobox', { name: '当前项目', exact: true })
      .selectOption('application');
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toBeVisible();
    model.hold = true;
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    await input.fill('MODEL_CHAT MODEL_HOLD');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect.poll(() => model.requests.length).toBe(1);
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行中');
    expect(model.requests).toHaveLength(1);
    await input.fill('MODEL_CHAT 追加要求');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('已受理');
    await uiPage.getByRole('button', { name: '取消执行', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('已取消');
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('已取消');
    expect(model.requests).toHaveLength(1);
    model.release();
    await uiPage.getByRole('button', { name: '继续执行', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('追加要求');
    const before = model.requests.length;
    await armRpcGate(uiPage, 'session.send');
    await input.fill(`MODEL_CHAT 刷新前未确认的指令\n${'合成长指令正文\n'.repeat(80)}`);
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await uiPage.getByText('待核查指令', { exact: true }).click();
    await expect(uiPage.locator('details.execution-status pre')).toContainText(
      '刷新前未确认的指令',
    );
    await expect(input).toBeInViewport();
    await input.fill('补交期间保留的新草稿');
    await expect(uiPage.getByRole('button', { name: '发送指令' })).toBeDisabled();
    await uiPage.getByRole('button', { name: '按原身份补交', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(before + 1);
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await expect(input).toHaveValue('补交期间保留的新草稿');
  } finally {
    await stop();
    await model.close();
  }
});
