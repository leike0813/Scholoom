import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer, MARKDOWN_TEXT } from '../model-server.js';
import { expect, test } from './fixture.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('conversation titles, archive and Markdown reading preserve the active work', async ({
  uiPage,
}, info) => {
  test.setTimeout(90000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const project = await mkdtemp(join(tmpdir(), 'scholoom-conversation-ui-'));
  const errors: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  try {
    await writeFile(join(project, 'input.md'), '# 可定位材料\n\n42\n');
    await writeFile(join(project, '材料 笔记.md'), '# 中文材料\n\n结论\n');
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await uiPage.getByLabel('添加项目', { exact: true }).click();
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
    await uiPage.getByLabel('附加 input.md', { exact: true }).check();
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    await input.fill('MODEL_MARKDOWN 阅读样本');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await expect(
      uiPage.getByRole('button', { name: '打开会话 MODEL_MARKDOWN 阅读样本', exact: true }),
    ).toBeVisible();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const reply = uiPage
      .getByRole('article', { name: 'Agent 回复' })
      .filter({ hasText: '消息阅读样本' });
    await expect(reply.getByRole('table')).toBeVisible();
    await expect(reply.locator('.katex')).toBeVisible();
    await expect(reply.locator('pre')).toContainText('const total = 42;');
    await expect(reply.locator('img')).toHaveCount(0);
    expect(
      await uiPage.evaluate(() => Reflect.get(globalThis, 'untrustedMessage')),
    ).toBeUndefined();

    // 原生剪贴板：Chromium 授权仅针对本轮本地测试源，Electron 使用其宿主剪贴板。
    if (info.project.name === 'ui-browser')
      await uiPage.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: 'http://127.0.0.1:5174',
      });
    await reply.getByRole('button', { name: '复制 Agent 正文', exact: true }).click();
    await expect
      .poll(() => uiPage.evaluate<string>('navigator.clipboard.readText()'))
      .toBe(MARKDOWN_TEXT);
    await reply.getByRole('button', { name: '复制代码', exact: true }).click();
    await expect
      .poll(async () => (await uiPage.evaluate<string>('navigator.clipboard.readText()')).trim())
      .toBe('const total = 42;');
    await input.fill('归档前保留的草稿');
    await uiPage.screenshot({ path: info.outputPath('conversation-markdown.png') });
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
    await uiPage.screenshot({ path: info.outputPath('conversation-markdown-dark.png') });
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();

    await reply.getByRole('link', { name: '中文材料', exact: true }).click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 材料 笔记.md', exact: true }),
    ).toContainText('中文材料');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();

    await reply.getByRole('link', { name: '查看材料', exact: true }).click();
    await expect(uiPage.getByRole('dialog', { name: 'Agent 会话', exact: true })).toHaveCount(0);
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 input.md', exact: true }),
    ).toContainText('可定位材料');
    await uiPage.getByRole('button', { name: '打开文件 input.md', exact: true }).click();
    await uiPage.getByRole('textbox', { name: '新名称', exact: true }).fill('renamed.md');
    await uiPage.getByRole('button', { name: '重命名', exact: true }).click();
    await expect
      .poll(() => readFile(join(project, 'renamed.md'), 'utf8').catch(() => ''))
      .toContain('可定位材料');
    await writeFile(join(project, 'input.md'), '同名替代文件不能冒充旧材料');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await reply.getByRole('button', { name: '打开材料 input.md', exact: true }).click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 renamed.md', exact: true }),
    ).toContainText('可定位材料');
    await expect(input).toHaveValue('归档前保留的草稿');

    await uiPage.getByLabel('管理会话 MODEL_MARKDOWN 阅读样本', { exact: true }).click();
    await uiPage.getByLabel('会话标题 MODEL_MARKDOWN 阅读样本', { exact: true }).fill('资料阅读');
    await uiPage.getByRole('button', { name: '保存标题', exact: true }).click();
    await expect(
      uiPage.getByRole('button', { name: '打开会话 资料阅读', exact: true }),
    ).toBeVisible();
    await uiPage.getByLabel('查找会话标题', { exact: true }).fill('不匹配');
    await expect(
      uiPage.getByRole('button', { name: '打开会话 资料阅读', exact: true }),
    ).toHaveCount(0);
    await expect(input).toHaveValue('归档前保留的草稿');
    await expect(uiPage.getByRole('button', { name: '发送指令', exact: true })).toBeEnabled();
    await armRpcGate(uiPage, 'session.list');
    await uiPage.getByLabel('查找会话标题', { exact: true }).fill('旧查询');
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await uiPage.getByLabel('查找会话标题', { exact: true }).fill('资料');
    await expect(
      uiPage.getByRole('button', { name: '打开会话 资料阅读', exact: true }),
    ).toBeVisible();
    await releaseRpcGate(uiPage);
    await expect(
      uiPage.getByRole('button', { name: '打开会话 资料阅读', exact: true }),
    ).toBeVisible();
    await uiPage.getByLabel('管理会话 资料阅读', { exact: true }).click();
    const requests = model.requests.length;
    await uiPage.getByRole('button', { name: '归档会话', exact: true }).click();
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue('归档前保留的草稿');
    await uiPage.reload();
    await expect(uiPage.getByRole('button', { name: '恢复当前会话', exact: true })).toBeVisible();
    await expect(input).toHaveValue('归档前保留的草稿');
    await uiPage.getByRole('button', { name: '归档', exact: true }).click();
    await expect(
      uiPage.getByRole('button', { name: '打开会话 资料阅读', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(reply.getByRole('table')).toBeVisible();
    await uiPage.getByRole('button', { name: '恢复当前会话', exact: true }).click();
    await expect(input).toBeEnabled();
    expect(model.requests.length).toBe(requests);
    await uiPage.screenshot({ path: info.outputPath('conversation-restored.png') });
    await uiPage.getByRole('button', { name: '收起会话', exact: true }).click();
    await uiPage.getByRole('button', { name: '折叠左区', exact: true }).click();
    await uiPage.getByRole('button', { name: '会话', exact: true }).click();
    await expect(uiPage.getByLabel('查找会话标题', { exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await stop();
    await model.close();
    await rm(project, { recursive: true });
  }
});

test('streaming Markdown keeps typing and cancellation available and never renders into the next conversation', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  try {
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill('MODEL_STREAM');
    await uiPage.getByRole('button', { name: '发送指令' }).click();
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(
      uiPage.getByRole('article', { name: 'Agent 回复' }).filter({ hasText: '合成流式输出' }),
    ).toBeVisible();
    const start = Date.now();
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill('输出期间的草稿');
    await uiPage.getByRole('button', { name: '取消执行', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('已取消');
    expect(Date.now() - start).toBeLessThan(5000);
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    await expect(uiPage.getByRole('article', { name: 'Agent 回复' })).toHaveCount(0);
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill('新会话草稿');
    await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue('新会话草稿');
    await expect(uiPage.getByRole('article', { name: 'Agent 回复' })).toHaveCount(0);
  } finally {
    await stop();
    await model.close();
  }
});

test('archive and restore failures stay in place and retry succeeds', async ({ uiPage }, info) => {
  test.setTimeout(60000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  // 双宿主共用同一数据目录，标题按宿主区分，避免两次运行残留会话互相命中。
  const title = `MODEL_CHAT 归档样本 ${info.project.name}`;
  try {
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    await input.fill(title);
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await expect(
      uiPage.getByRole('button', { name: `打开会话 ${title}`, exact: true }),
    ).toBeVisible();
    await input.fill('归档失败期间保留的草稿');

    await uiPage.getByLabel(`管理会话 ${title}`, { exact: true }).click();
    await armRpcGate(uiPage, 'session.archive');
    await uiPage.getByRole('button', { name: '归档会话', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await releaseRpcGate(uiPage, true);
    const menu = uiPage.locator('.session-actions .menu__body');
    await expect(menu.getByRole('alert')).toBeVisible();
    // 归档失败：错误留在菜单内，菜单不静默关闭，可直接重试。
    await expect(menu.getByRole('button', { name: '归档会话', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: '归档会话', exact: true }).click();
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue('归档失败期间保留的草稿');

    // 当前会话恢复失败：错误行留在消息区的归档提示内。
    const callout = uiPage.getByRole('status').filter({ hasText: '会话已归档' });
    await expect(callout).toBeVisible();
    const requests = model.requests.length;
    await armRpcGate(uiPage, 'session.archive');
    await callout.getByRole('button', { name: '恢复当前会话', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await releaseRpcGate(uiPage, true);
    await expect(callout.getByRole('alert')).toBeVisible();
    await expect(input).toBeDisabled();
    await callout.getByRole('button', { name: '恢复当前会话', exact: true }).click();
    await expect(input).toBeEnabled();
    await expect(callout.getByRole('alert')).toHaveCount(0);
    // 恢复不自动发送。
    expect(model.requests.length).toBe(requests);
  } finally {
    await stop();
    await model.close();
  }
});

test('composer model and effort overrides follow defaults, persist and reach real requests', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const body = () => model.requests.at(-1) as Record<string, unknown>;
  const effortOf = () =>
    (body().output_config as Record<string, unknown> | undefined)?.effort ?? null;
  try {
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    // 应用默认推理强度经 provider.setDefaults 保存。
    await uiPage.getByLabel('默认推理强度', { exact: true }).selectOption('low');
    await uiPage.getByRole('button', { name: '保存默认设置', exact: true }).click();
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();

    const modelSelect = uiPage.getByLabel('模型', { exact: true });
    const effortSelect = uiPage.getByLabel('推理强度', { exact: true });
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    // 初始跟随应用默认。
    await expect(modelSelect).toHaveValue('');
    await expect(effortSelect).toHaveValue('');
    await input.fill('MODEL_CHAT 默认配置');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(1);
    expect(body().model).toBe('MiniMax-M3.1-Flash-Preview');
    expect(effortOf()).toBe('low');

    // 会话覆盖推理强度，dock 与 overlay 一致显示。
    await effortSelect.selectOption('high');
    await expect(effortSelect).toHaveValue('high');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(uiPage.getByLabel('推理强度', { exact: true })).toHaveValue('high');
    await uiPage.getByRole('button', { name: '收起会话', exact: true }).click();
    await input.fill('MODEL_CHAT 会话覆盖');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(2);
    expect(body().model).toBe('MiniMax-M3.1-Flash-Preview');
    expect(effortOf()).toBe('high');

    // 重载后覆盖保留。
    await uiPage.reload();
    await expect(uiPage.getByLabel('推理强度', { exact: true })).toHaveValue('high');

    // 切到不支持推理强度的模型：选择禁用并说明原因，偏好保留。
    await uiPage.getByLabel('模型', { exact: true }).selectOption('MiniMax-M3');
    await expect(effortSelect).toBeDisabled();
    await expect(uiPage.getByLabel('执行上下文')).toContainText('该模型不支持推理强度');
    await input.fill('MODEL_CHAT 无强度模型');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(3);
    expect(body().model).toBe('MiniMax-M3');
    expect(effortOf()).toBeNull();
    // 切回跟随默认后原 effort 覆盖继续生效。
    await uiPage.getByLabel('模型', { exact: true }).selectOption('');
    await expect(effortSelect).toHaveValue('high');
    await expect(effortSelect).toBeEnabled();

    // 覆盖保存失败：不乐观更新，保留快照值并在 composer 上下文内提示可重试。
    await armRpcGate(uiPage, 'session.configure');
    await effortSelect.selectOption('max');
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await releaseRpcGate(uiPage, true);
    const context = uiPage.getByLabel('执行上下文');
    await expect(context.getByRole('alert')).toBeVisible();
    await expect(effortSelect).toHaveValue('high');
    await context.getByRole('button', { name: '重试', exact: true }).click();
    await expect(context.getByRole('alert')).toHaveCount(0);
    await expect(effortSelect).toHaveValue('max');

    // 跟随默认清除覆盖，后续请求使用应用默认。
    await effortSelect.selectOption('');
    await input.fill('MODEL_CHAT 回到默认');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(4);
    expect(body().model).toBe('MiniMax-M3.1-Flash-Preview');
    expect(effortOf()).toBe('low');
  } finally {
    await stop();
    await model.close();
  }
});
