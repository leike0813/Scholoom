import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer, MARKDOWN_TEXT } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererOrigin, rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('conversation titles, archive and Markdown reading preserve the active work', async ({
  uiPage,
}, info) => {
  test.setTimeout(90000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const project = test.info().outputPath(`conversation-${basename(test.info().outputDir)}`);
  await mkdir(project, { recursive: true });
  const sessionTitle = `资料阅读 ${info.project.name}`;
  const errors: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  try {
    await writeFile(join(project, 'input.md'), '# 可定位材料\n\n42\n');
    await writeFile(join(project, '材料 笔记.md'), '# 中文材料\n\n结论\n');
    await installRpcGate(uiPage);
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await addProject(uiPage, project);
    await expect(uiPage.getByLabel('执行上下文')).toContainText(basename(project));
    await createSession(uiPage, basename(project));
    await uiPage
      .getByRole('treeitem', { name: '打开文件 input.md', exact: true })
      .click({ button: 'right' });
    await uiPage
      .getByRole('menu', { name: '文件操作菜单', exact: true })
      .getByRole('button', { name: '附加／移除会话材料', exact: true })
      .click();
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
        origin: rendererOrigin,
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
    await uiPage
      .getByRole('treeitem', { name: '打开文件 input.md', exact: true })
      .click({ button: 'right' });
    await uiPage
      .getByRole('menu', { name: '文件操作菜单', exact: true })
      .getByRole('button', { name: /重命名/ })
      .click();
    const rename = uiPage.getByLabel('新名称', { exact: true });
    await rename.fill('renamed.md');
    await rename.press('Enter');
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

    await uiPage
      .getByRole('button', { name: '打开会话 MODEL_MARKDOWN 阅读样本', exact: true })
      .click({ button: 'right' });
    await uiPage
      .getByRole('menu', { name: '管理会话 MODEL_MARKDOWN 阅读样本' })
      .getByRole('button', { name: '重命名', exact: true })
      .click();
    const titleInput = uiPage.getByLabel('会话标题 MODEL_MARKDOWN 阅读样本', { exact: true });
    await expect(titleInput).toBeFocused();
    await titleInput.fill(sessionTitle);
    await titleInput.press('Enter');
    const renamed = uiPage.getByRole('button', { name: `打开会话 ${sessionTitle}`, exact: true });
    await expect(renamed).toBeVisible();
    await uiPage.getByRole('button', { name: '查找会话', exact: true }).click();
    const search = uiPage.getByRole('dialog', { name: '查找会话' });
    const query = search.getByLabel('查找会话标题', { exact: true });
    await query.fill('不匹配');
    await expect(search.getByText('没有匹配的会话')).toBeVisible();
    await armRpcGate(uiPage, 'session.search');
    await query.fill('旧查询');
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await query.fill('资料');
    const found = search.getByRole('button', { name: `打开会话 ${sessionTitle}`, exact: true });
    await expect(found).toBeVisible();
    await releaseRpcGate(uiPage);
    await expect(found).toBeVisible();
    await found.click();
    await expect(search).toHaveCount(0);
    await expect(input).toHaveValue('归档前保留的草稿');
    await expect(uiPage.getByRole('button', { name: '发送指令', exact: true })).toBeEnabled();
    await renamed.focus();
    await renamed.press('Shift+F10');
    const requests = model.requests.length;
    await uiPage
      .getByRole('menu', { name: `管理会话 ${sessionTitle}` })
      .getByRole('button', { name: '归档会话', exact: true })
      .click();
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue('归档前保留的草稿');
    await uiPage.reload();
    const notifications = uiPage.getByLabel('工作台通知', { exact: true });
    await expect(notifications).toContainText('归档');
    await notifications.click();
    const noticeDetails = uiPage.getByRole('region', {
      name: '工作台通知详情',
      exact: true,
    });
    await expect(
      noticeDetails.getByRole('button', { name: '恢复当前会话', exact: true }),
    ).toBeVisible();
    await expect(input).toHaveValue('归档前保留的草稿');
    await uiPage.getByRole('button', { name: '查找会话', exact: true }).click();
    await query.fill('资料');
    await expect(found).toContainText('已归档');
    await query.press('Escape');
    await expect(search).toHaveCount(0);
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(reply.getByRole('table')).toBeVisible();
    await notifications.click();
    await noticeDetails.getByRole('button', { name: '恢复当前会话', exact: true }).click();
    await expect(input).toBeEnabled();
    expect(model.requests.length).toBe(requests);
    await uiPage.screenshot({ path: info.outputPath('conversation-restored.png') });
    await uiPage.getByRole('button', { name: '收起会话', exact: true }).click();
    await uiPage.getByRole('button', { name: '折叠左区', exact: true }).click();
    await uiPage.getByRole('button', { name: '查找会话', exact: true }).click();
    await expect(query).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await stop();
    await model.close();
  }
});

test('streaming Markdown keeps typing and cancellation available and never renders into the next conversation', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  try {
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await createSession(uiPage);
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
    await createSession(uiPage);
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
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    await createSession(uiPage);
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    await input.fill(title);
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await expect(
      uiPage.getByRole('button', { name: `打开会话 ${title}`, exact: true }),
    ).toBeVisible();
    await input.fill('归档失败期间保留的草稿');

    await uiPage
      .getByRole('button', { name: `打开会话 ${title}`, exact: true })
      .click({ button: 'right' });
    const menu = uiPage.getByRole('menu', { name: `管理会话 ${title}` });
    await armRpcGate(uiPage, 'session.archive');
    await menu.getByRole('button', { name: '归档会话', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await releaseRpcGate(uiPage, true);
    await expect(menu.getByRole('alert')).toBeVisible();
    // 归档失败：错误留在菜单内，菜单不静默关闭，可直接重试。
    await expect(menu.getByRole('button', { name: '归档会话', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: '归档会话', exact: true }).click();
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue('归档失败期间保留的草稿');

    // 当前会话恢复失败：错误留在状态栏通知详情内。
    const notifications = uiPage.getByLabel('工作台通知', { exact: true });
    await notifications.click();
    const noticeDetails = uiPage.getByRole('region', {
      name: '工作台通知详情',
      exact: true,
    });
    const restore = noticeDetails.getByRole('button', { name: '恢复当前会话', exact: true });
    await expect(restore).toBeVisible();
    const requests = model.requests.length;
    await armRpcGate(uiPage, 'session.archive');
    await restore.click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await releaseRpcGate(uiPage, true);
    await expect(noticeDetails.getByRole('alert')).toBeVisible();
    await expect(input).toBeDisabled();
    await restore.click();
    await expect(input).toBeEnabled();
    await expect(noticeDetails.getByRole('alert')).toHaveCount(0);
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
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-ui-key');
    await uiPage.getByRole('button', { name: '保存凭据' }).click();
    // 应用默认推理强度经 provider.setDefaults 保存。
    await uiPage.getByLabel('默认推理强度', { exact: true }).selectOption('low');
    await uiPage.getByRole('button', { name: '保存默认设置', exact: true }).click();
    await createSession(uiPage);

    // dock 与 overlay 共用聚合入口：点击后在同一弹层内选择模型与推理强度。
    const picker = uiPage.locator('details.composer-picker');
    const openPicker = async () => {
      if (!(await picker.evaluate((node) => node.hasAttribute('open'))))
        await uiPage.getByLabel(/^模型与推理强度：/).click();
    };
    const option = (group: '模型' | '推理强度', name: string | RegExp) =>
      picker
        .getByRole('group', { name: group })
        .getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name });
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    // 初始跟随应用默认。
    await openPicker();
    await expect(option('模型', /^跟随默认/)).toBeChecked();
    await expect(option('推理强度', /^跟随默认/)).toBeChecked();
    await input.fill('MODEL_CHAT 默认配置');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(1);
    expect(body().model).toBe('MiniMax-M3.1-Flash');
    expect(effortOf()).toBe('low');

    // 会话覆盖推理强度，dock 与 overlay 一致显示；overlay 入口直接显示当前值。
    await openPicker();
    await option('推理强度', 'high').click();
    await expect(option('推理强度', 'high')).toBeChecked();
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(uiPage.getByLabel(/^模型与推理强度：/)).toContainText('MiniMax-M3.1-Flash · high');
    await uiPage.getByRole('button', { name: '收起会话', exact: true }).click();
    await input.fill('MODEL_CHAT 会话覆盖');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(2);
    expect(body().model).toBe('MiniMax-M3.1-Flash');
    expect(effortOf()).toBe('high');

    // 重载后覆盖保留。
    await uiPage.reload();
    await openPicker();
    await expect(option('推理强度', 'high')).toBeChecked();

    // 切到不支持推理强度的模型：选择禁用并说明原因，偏好保留。
    await option('模型', 'MiniMax-M3').click();
    await expect(option('推理强度', 'high')).toBeDisabled();
    await expect(picker).toContainText('该模型不支持推理强度');
    await input.fill('MODEL_CHAT 无强度模型');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(3);
    expect(body().model).toBe('MiniMax-M3');
    expect(effortOf()).toBeNull();
    // 切回跟随默认后原 effort 覆盖继续生效。
    await openPicker();
    await option('模型', /^跟随默认/).click();
    await expect(option('推理强度', 'high')).toBeChecked();
    await expect(option('推理强度', 'high')).toBeEnabled();

    // 覆盖保存失败：不乐观更新，保留快照值并在 composer 上下文内提示可重试。
    await armRpcGate(uiPage, 'session.configure');
    await option('推理强度', 'max').click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await releaseRpcGate(uiPage, true);
    const context = uiPage.getByLabel('执行上下文');
    await expect(context.getByRole('alert')).toBeVisible();
    await expect(option('推理强度', 'high')).toBeChecked();
    await context.getByRole('button', { name: '重试', exact: true }).click();
    await expect(context.getByRole('alert')).toHaveCount(0);
    await openPicker();
    await expect(option('推理强度', 'max')).toBeChecked();

    // 跟随默认清除覆盖，后续请求使用应用默认。
    await option('推理强度', /^跟随默认/).click();
    await input.fill('MODEL_CHAT 回到默认');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(4);
    expect(body().model).toBe('MiniMax-M3.1-Flash');
    expect(effortOf()).toBe('low');
  } finally {
    await stop();
    await model.close();
  }
});

test('session list loads the next page when scrolled to the end', async ({ uiPage }) => {
  test.setTimeout(60000);
  const project = test.info().outputPath(`scroll-${basename(test.info().outputDir)}`);
  await mkdir(project, { recursive: true });
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    const { id: projectId } = await client.call('project.open', { path: project });
    await client.call('session.create', { projectId, title: '最早的会话' });
    for (let index = 1; index < 60; index++)
      await client.call('session.create', { projectId, title: `会话 ${index}` });
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project);
    const tree = uiPage.getByRole('region', { name: '会话管理', exact: true }).getByRole('tree');
    const projectGroup = uiPage.locator(`[data-project-id="${projectId}"]`);
    const oldest = projectGroup.getByRole('button', {
      name: '打开会话 最早的会话',
      exact: true,
    });
    await expect(projectGroup.locator('[data-session-id]')).toHaveCount(50);
    await expect(oldest).toHaveCount(0);
    await tree.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
    await expect(oldest).toBeVisible();
    await expect(projectGroup.locator('[data-session-id]')).toHaveCount(60);
  } finally {
    client.dispose();
  }
});
