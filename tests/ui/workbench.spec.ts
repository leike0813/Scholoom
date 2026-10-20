import { randomUUID } from 'node:crypto';
import { mkdir, rmdir, symlink, unlink } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runKernel, runningKernel } from '../kernel-fixture.js';
import { createSession, expect, test } from './fixture.js';

const rendererUrl = 'http://127.0.0.1:5174/';
const sampleUrl = `${rendererUrl}?scenario=ui-foundation`;

function dataDirectory(): string {
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  if (!directory) throw new Error('Missing isolated UI configuration');
  return directory;
}

test('transport reconnect preserves the instruction draft', async ({ uiPage }) => {
  await uiPage.addInitScript(() => {
    const sockets: WebSocket[] = [];
    const original = globalThis.WebSocket;
    globalThis.WebSocket = new Proxy(original, {
      construct(target, args) {
        const socket = Reflect.construct(target, args);
        sockets.push(socket);
        return socket;
      },
    });
    Reflect.set(globalThis, '__scholoomTestSockets', sockets);
  });
  await uiPage.goto(rendererUrl);
  const status = uiPage.getByRole('status', { name: '连接状态' });
  await expect(status).toContainText('已连接');
  const input = uiPage.getByRole('textbox', { name: '研究指令' });
  await input.fill('断线时保留这份草稿');
  const endpoint = await runningKernel(dataDirectory());
  await uiPage.evaluate((url) => {
    const sockets = Reflect.get(globalThis, '__scholoomTestSockets') as WebSocket[];
    for (const socket of sockets) if (socket.url === url) socket.close();
  }, endpoint.url);
  await expect(status).toContainText('重连');
  await expect(status).toContainText('已连接');
  await expect(input).toHaveValue('断线时保留这份草稿');
});

test('CLI shutdown reaches every client and retry preserves draft', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);
  const status = uiPage.getByRole('status', { name: '连接状态' });
  await expect(status).toContainText('已连接');
  const endpoint = await runningKernel(dataDirectory());
  const observer = createKernelClient(endpoint);
  await observer.connect();
  try {
    await createSession(uiPage);
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    await input.fill('停机和重试后仍保留');
    // 工作台不提供停止入口；停机经 CLI 发起，所有客户端收到同一停机通知。
    await runKernel(dataDirectory(), 'stop');
    await expect(status).toContainText('已停止', { timeout: 15_000 });
    expect((await runKernel(dataDirectory(), 'status')).state).toBe('stopped');
    expect(observer.getSnapshot().phase).toBe('stopping');
    await expect(input).toHaveValue('停机和重试后仍保留');
    await uiPage.waitForTimeout(500);
    expect((await runKernel(dataDirectory(), 'status')).state).toBe('stopped');
    await status.hover();
    await uiPage.getByRole('button', { name: '重试连接' }).click();
    await expect(status).toContainText('已连接');
    expect((await runningKernel(dataDirectory())).instanceId).not.toBe(endpoint.instanceId);
    await expect(input).toHaveValue('停机和重试后仍保留');
  } finally {
    observer.dispose();
  }
});

test('kernel crash requires user retry and keeps draft', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);
  const status = uiPage.getByRole('status', { name: '连接状态' });
  await expect(status).toContainText('已连接');
  const endpoint = await runningKernel(dataDirectory());
  const input = uiPage.getByRole('textbox', { name: '研究指令' });
  await input.fill('内核退出后保留');
  process.kill(endpoint.processId, 'SIGKILL');
  await expect.poll(async () => (await runKernel(dataDirectory(), 'status')).state).toBe('stopped');
  const retry = uiPage.getByRole('button', { name: '重试连接' });
  // 底栏只显示单行状态，重试位于 hover/focus 详情层；指针停留期间详情层随状态更新。
  await status.hover();
  await expect(retry).toBeVisible({ timeout: 10_000 });
  expect((await runKernel(dataDirectory(), 'status')).state).toBe('stopped');
  await retry.click();
  await expect(status).toContainText('已连接');
  await expect(input).toHaveValue('内核退出后保留');
});

test('browser bootstrap and static module routes protect credentials', async ({
  request,
  uiPage,
  uiHost,
}) => {
  test.skip(uiHost !== 'browser', 'Shared Vite boundary is covered once.');
  await uiPage.goto(rendererUrl);
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  const rejected = await request.post(`${rendererUrl}__scholoom/kernel/bootstrap`, {
    headers: { Origin: 'https://untrusted.example', 'X-Scholoom-Bootstrap': '1' },
    data: { mode: 'ensure' },
  });
  expect(rejected.status()).toBe(403);
  expect(await rejected.json()).not.toHaveProperty('endpoint');
  const directory = dataDirectory().split(sep).join('/');
  await symlink(
    join(dataDirectory(), 'runtime'),
    join(dataDirectory(), 'private-link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const paths = ['runtime/endpoint.json', 'private-link/endpoint.json'];
  let fileLinks = true;
  try {
    await symlink(
      join(dataDirectory(), 'runtime', 'endpoint.json'),
      join(dataDirectory(), 'renamed-link.json'),
    );
    paths.push('renamed-link.json');
  } catch (error) {
    if (process.platform !== 'win32' || (error as NodeJS.ErrnoException).code !== 'EPERM')
      throw error;
    fileLinks = false;
    test.info().annotations.push({
      type: 'unverified',
      description: 'File symlink requires Windows privilege; directory junction is still tested.',
    });
  }
  for (const path of paths) {
    for (const suffix of ['', '?raw&import']) {
      const secret = await request.get(`${rendererUrl}@fs/${directory}/${path}${suffix}`);
      expect(secret.ok()).toBe(false);
    }
  }
  if (!fileLinks) return;
  const publicDirectory = fileURLToPath(
    new URL('../../apps/desktop/src/renderer/public/', import.meta.url),
  );
  const createdPublic = await mkdir(publicDirectory, { recursive: true });
  const name = `private-${randomUUID()}.json`;
  const publicLink = join(publicDirectory, name);
  try {
    await symlink(join(dataDirectory(), 'runtime', 'endpoint.json'), publicLink);
    expect((await request.get(`${rendererUrl}${name}`)).status()).toBe(403);
  } finally {
    await unlink(publicLink).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (createdPublic) await rmdir(publicDirectory);
  }
});

test('workbench without a selected session keeps sending unavailable', async ({ uiPage }, info) => {
  await uiPage.addInitScript(() => {
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith('scholoom.draft.v1:') &&
        (key.endsWith('|session') || key.endsWith('|project'))
      )
        localStorage.removeItem(key);
    }
  });
  await uiPage.goto(rendererUrl);

  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  const instruction = uiPage.getByRole('textbox', { name: '研究指令' });
  await expect(instruction).toBeEditable();
  await instruction.fill('未连接时保留可编辑草稿');
  await expect(uiPage.getByRole('button', { name: '发送指令' })).toBeDisabled();
  await expect(uiPage.getByRole('article')).toHaveCount(0);
  await uiPage.screenshot({ path: info.outputPath('connected-workbench.png') });
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
    await uiPage.getByRole('tab', { name: '材料', exact: true }).click();
    for (const material of ['研究计划.md', '示例论文.pdf']) {
      const checkbox = uiPage.getByRole('checkbox', { name: material });
      const shouldBeChecked = scenario.selected.includes(material);
      await checkbox.setChecked(shouldBeChecked);
    }

    const instruction = uiPage.getByRole('textbox', { name: '研究指令' });
    await instruction.fill('  梳理研究问题  ');
    await uiPage.getByRole('button', { name: '发送指令' }).click();

    // 完整消息流在展开态 overlay 中呈现
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
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

  // 完整消息流在展开态 overlay 中呈现
  await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
  const userMessage = uiPage.getByRole('article', { name: '用户消息' });
  await expect(userMessage).toHaveCount(1);
  await expect(userMessage).toContainText('第二轮');
  await expect(uiPage.getByRole('article', { name: /Agent\s*回复/ })).toHaveCount(1);
});

test('reset restores the sample and refresh starts from its initial state', async ({ uiPage }) => {
  await uiPage.goto(sampleUrl);
  await uiPage.getByRole('tab', { name: '材料', exact: true }).click();
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

  await uiPage.getByRole('tab', { name: '材料', exact: true }).click();
  await expect(plan).toBeChecked();
  await expect(paper).not.toBeChecked();
  await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue('');
  await expect(uiPage.getByRole('article')).toHaveCount(0);
});

test('panes collapse to rails and restore', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);

  await uiPage.getByRole('button', { name: '折叠左区' }).click();
  await expect(uiPage.getByLabel('导航（已折叠）')).toBeVisible();
  await uiPage.getByRole('button', { name: '展开左区' }).click();
  await expect(uiPage.getByRole('complementary', { name: '会话与导航' })).toBeVisible();

  await uiPage.getByRole('button', { name: '折叠右区' }).click();
  await expect(uiPage.getByLabel('辅助区（已折叠）')).toBeVisible();
  await uiPage.getByRole('button', { name: '展开右区' }).click();
  await expect(uiPage.getByRole('complementary', { name: '辅助面板' })).toBeVisible();
});

test('agent panel expands to overlay and keeps draft and focus', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);
  await expect(
    uiPage.getByRole('button', { name: '在普通会话中新建会话', exact: true }),
  ).toBeEnabled();

  const draft = '形态切换之间保留这份草稿';
  await uiPage.getByRole('textbox', { name: '研究指令' }).fill(draft);
  await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();

  const dialog = uiPage.getByRole('dialog', { name: 'Agent 会话' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: '研究指令' })).toHaveValue(draft);
  await expect(dialog.getByRole('textbox', { name: '研究指令' })).toBeFocused();

  await uiPage.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(uiPage.getByRole('button', { name: '展开 Agent 会话' })).toBeFocused();
  await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue(draft);

  await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
  await uiPage.getByRole('button', { name: '收起会话' }).click();
  await expect(uiPage.getByRole('dialog', { name: 'Agent 会话' })).toBeHidden();
});

test('tab group splits right and merges back', async ({ uiPage }) => {
  await uiPage.goto(sampleUrl);

  await expect(uiPage.getByRole('tab', { name: /编辑器/ })).toBeVisible();
  const editorTab = uiPage.getByRole('tab', { name: /编辑器/ });
  await editorTab.click();
  await uiPage.getByRole('button', { name: '向右拆分' }).click();

  await expect(uiPage.getByLabel('标签组 2')).toBeVisible();
  await expect(uiPage.getByLabel('标签组 2').getByRole('tab', { name: /编辑器/ })).toBeVisible();

  await uiPage.getByRole('button', { name: '关闭 编辑器' }).click();
  await expect(uiPage.getByLabel('标签组 2')).toBeHidden();
  await expect(uiPage.getByRole('tab', { name: /文献库/ })).toBeVisible();
});

test('collapsed dock previews the latest sample exchange', async ({ uiPage }) => {
  await uiPage.goto(sampleUrl);
  const dock = uiPage.getByRole('button', { name: '展开 Agent 会话' });
  await expect(dock).toContainText('暂无会话进展');

  const instruction = uiPage.getByRole('textbox', { name: '研究指令' });
  await instruction.fill('第一轮');
  await uiPage.getByRole('button', { name: '发送指令' }).click();
  await expect(dock).toContainText('研究计划.md');

  await uiPage.getByRole('tab', { name: '材料', exact: true }).click();
  await uiPage.getByRole('checkbox', { name: '研究计划.md' }).uncheck();
  await uiPage.getByRole('checkbox', { name: '示例论文.pdf' }).uncheck();
  await instruction.fill('第二轮');
  await uiPage.getByRole('button', { name: '发送指令' }).click();
  await expect(dock).toContainText('未附加材料');
});

test('left pane resizes by dragging and resets on double click', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);

  const pane = uiPage.getByRole('complementary', { name: '会话与导航' });
  await expect(pane).toBeVisible();
  const width = async () => (await pane.boundingBox())?.width ?? 0;
  expect(await width()).toBe(260);

  const handle = uiPage.getByRole('separator', { name: '调整左区宽度' });
  const box = await handle.boundingBox();
  if (!box) throw new Error('左区手柄不可见');
  await uiPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await uiPage.mouse.down();
  await uiPage.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
  await uiPage.mouse.up();

  const dragged = await width();
  expect(dragged).toBeGreaterThan(220);
  expect(dragged).toBeLessThan(360);
  expect(dragged).not.toBe(260);

  await handle.dblclick();
  expect(await width()).toBe(260);
});

test('agent dock resizes by dragging and resets on double click', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);

  const dock = uiPage.locator('.agent-dock');
  await expect(dock).toBeVisible();
  const height = async () => (await dock.boundingBox())?.height ?? 0;
  expect(await height()).toBe(180);

  const handle = uiPage.getByRole('separator', { name: '调整 Agent 面板高度' });
  const box = await handle.boundingBox();
  if (!box) throw new Error('dock 手柄不可见');
  await uiPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await uiPage.mouse.down();
  await uiPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 5 });
  await uiPage.mouse.up();

  const dragged = await height();
  expect(dragged).toBeGreaterThan(120);
  expect(dragged).toBeLessThan(320);
  expect(dragged).not.toBe(180);

  await handle.dblclick();
  expect(await height()).toBe(180);
});

test('ctrl+backslash splits the active tab group only when possible', async ({ uiPage }) => {
  await uiPage.goto(rendererUrl);
  await uiPage.keyboard.press('Control+\\');
  await expect(uiPage.getByLabel('标签组 2')).toHaveCount(0);

  await uiPage.goto(sampleUrl);
  await expect(uiPage.getByRole('tab', { name: /文献库/ })).toBeVisible();
  await uiPage.keyboard.press('Control+\\');
  await expect(uiPage.getByLabel('标签组 2')).toBeVisible();
  await expect(uiPage.getByLabel('标签组 2').getByRole('tab', { name: /文献库/ })).toBeVisible();
});
