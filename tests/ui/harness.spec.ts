import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('user invokes a declared research capability and opens its checked report', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const project = await mkdtemp(join(tmpdir(), 'scholoom-ui-research-'));
  try {
    await writeFile(join(project, 'input.md'), '# 合成实验\n\n观察结果42，样本数1。\n');
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-research-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
    await addProject(uiPage, project);
    await expect(uiPage.getByLabel('执行上下文')).toContainText(basename(project));
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('项目权限与备份', { exact: true }).click();
    await uiPage.getByRole('checkbox', { name: /^信任项目/ }).check();
    await uiPage.getByRole('button', { name: '保存项目授权' }).click();
    await createSession(uiPage, basename(project));
    await uiPage
      .getByRole('textbox', { name: '研究指令' })
      .fill('MODEL_RESEARCH 用材料分析方法处理 input.md 并保存 analysis.md');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect
      .poll(() => readFile(join(project, 'analysis.md'), 'utf8').catch(() => ''))
      .toContain('42');
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await expect(
      uiPage.getByRole('button', { name: '打开成果 analysis.md', exact: true }),
    ).toHaveCount(0);
    await expect(uiPage.getByLabel('工作台通知', { exact: true })).toContainText('analysis.md');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const tool = uiPage
      .locator('details.tool-call')
      .filter({ hasText: 'invoke_research_capability' });
    await tool.locator('summary').click();
    await expect(tool).toContainText('invocationId');
    await expect(tool).toContainText('usable');
    await expect(tool).toContainText('notAssessed');
    await uiPage
      .getByRole('article', { name: 'Agent 回复' })
      .getByRole('button', { name: '打开成果 analysis.md', exact: true })
      .click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 analysis.md', exact: true }),
    ).toContainText('42');
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await expect(
      uiPage.getByRole('button', { name: '打开成果 analysis.md', exact: true }),
    ).toHaveCount(0);
    await uiPage.getByRole('button', { name: '展开 Agent 会话', exact: true }).click();
    await expect(
      uiPage
        .getByRole('article', { name: 'Agent 回复' })
        .getByRole('button', { name: '打开成果 analysis.md', exact: true }),
    ).toBeVisible();
  } finally {
    await stop();
    await model.close();
    await rm(project, { recursive: true });
  }
});

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
    await addProject(uiPage, project);
    await expect(uiPage.getByLabel('执行上下文')).toContainText(basename(project));
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('项目权限与备份', { exact: true }).click();
    await uiPage.getByRole('checkbox', { name: /^信任项目/ }).check();
    await uiPage.getByRole('button', { name: '保存项目授权' }).click();
    await createSession(uiPage, basename(project));
    await uiPage.getByRole('treeitem', { name: '打开文件 input.md', exact: true }).click();
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
    await uiPage.getByRole('treeitem', { name: '打开文件 input.md', exact: true }).click();
    await expect(editor).toContainText('保存期间的新编辑');
    await uiPage
      .getByRole('treeitem', { name: '打开文件 input.md', exact: true })
      .click({ button: 'right' });
    await uiPage
      .getByRole('menu', { name: '文件操作菜单', exact: true })
      .getByRole('button', { name: '附加／移除会话材料', exact: true })
      .click();
    await uiPage
      .getByRole('textbox', { name: '研究指令' })
      .fill('MODEL_FIXTURE 读取材料并保存结果');
    const failRegistration = new DatabaseSync(join(project, '.scholoom', 'project.sqlite'));
    try {
      failRegistration.exec(
        "CREATE TRIGGER ui_registration_failure BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'synthetic registration failure'); END;",
      );
    } finally {
      failRegistration.close();
    }
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect
      .poll(() => readFile(join(project, 'result.md'), 'utf8').catch(() => ''))
      .toContain('合成样本');
    expect(runtimeErrors).toEqual([]);
    await expect(
      uiPage.getByRole('button', { name: '打开成果 result.md', exact: true }),
    ).toHaveCount(0);
    const notifications = uiPage.getByLabel('工作台通知', { exact: true });
    await expect(notifications).toContainText('result.md');
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill('查看成果时保留的草稿');
    await notifications.click();
    const details = uiPage.getByRole('region', { name: '工作台通知详情', exact: true });
    await expect(details).toContainText('待核查');
    await armRpcGate(uiPage, 'artifacts.reconcile');
    await details.getByRole('button', { name: '核查并补齐', exact: true }).click();
    await releaseRpcGate(uiPage, true);
    await expect(details.getByRole('alert')).toBeVisible();
    await expect(notifications).toContainText('通知 1');
    const allowRegistration = new DatabaseSync(join(project, '.scholoom', 'project.sqlite'));
    try {
      allowRegistration.exec('DROP TRIGGER ui_registration_failure');
    } finally {
      allowRegistration.close();
    }
    await details.getByRole('button', { name: '核查并补齐', exact: true }).click();
    await expect(details).toContainText('已保存并登记');
    await expect(details.getByRole('alert')).toHaveCount(0);
    await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue(
      '查看成果时保留的草稿',
    );
    await uiPage.keyboard.press('Escape');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(
      uiPage
        .getByRole('article', { name: 'Agent 回复' })
        .filter({ hasText: '分析已保存到 result.md' }),
    ).toBeVisible();
    await expect(uiPage.getByLabel('执行上下文')).toContainText('MiniMax-M3.1-Flash-Preview');
    await expect(uiPage.getByLabel('执行上下文')).toContainText('已信任项目');
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
    await uiPage
      .getByRole('article', { name: 'Agent 回复' })
      .filter({ hasText: '分析已保存到 result.md' })
      .getByRole('button', { name: '打开成果 result.md', exact: true })
      .click();
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
    await createSession(uiPage, basename(project));
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
    await expect(notifications).not.toContainText('通知 0');
    await notifications.click();
    await expect(
      uiPage.getByRole('region', { name: '工作台通知详情', exact: true }).getByRole('alert'),
    ).toBeVisible();
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
    await expect(
      uiPage.getByRole('button', { name: '普通会话，已展开', exact: true }),
    ).toBeVisible();
    await createSession(uiPage);
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    await input.fill('会话 A 的未受理指令');
    await armRpcGate(uiPage, 'session.send');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    const sessions = uiPage.locator('.session-list button[aria-pressed]');
    const count = await sessions.count();
    await createSession(uiPage);
    await expect(sessions).toHaveCount(count + 1);
    await expect(sessions.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(input).toHaveValue('');
    await input.fill('会话 B 的草稿');
    await releaseRpcGate(uiPage, true);
    // 旧会话的迟到错误不成为当前会话的通知，原指令仍恢复到原草稿。
    await expect(uiPage.getByLabel('工作台通知', { exact: true })).toContainText('通知 0');
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
    await expect(
      uiPage.getByRole('button', { name: '普通会话，已展开', exact: true }),
    ).toBeVisible();
    await createSession(uiPage);
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
    // 取消后不提供“继续执行”按钮，由用户发送新的明确指令接续。
    await input.fill('MODEL_CHAT 取消后的明确指令');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain('取消后的明确指令');
    const before = model.requests.length;
    await armRpcGate(uiPage, 'session.send');
    await input.fill(`MODEL_CHAT 刷新前未确认的指令\n${'合成长指令正文\n'.repeat(80)}`);
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const notifications = uiPage.getByLabel('工作台通知', { exact: true });
    await expect(notifications).toContainText('待核查');
    await notifications.click();
    const noticeDetails = uiPage.getByRole('region', { name: '工作台通知详情', exact: true });
    await noticeDetails
      .locator('details')
      .filter({ hasText: '待核查指令' })
      .locator('summary')
      .click();
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
