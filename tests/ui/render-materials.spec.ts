/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { ResourceDescriptor } from '../../packages/protocol/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('legacy PDF metadata keeps the last successful preview without enabling attachment', async ({
  uiPage,
}) => {
  test.setTimeout(120000);
  const root = test.info().outputPath(`legacy-${test.info().project.name}`);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'legacy.qmd'), 'Legacy evidence 73.\n');
  // Only the public output metadata is downgraded; PDF generation and byte reads stay real.
  await uiPage.addInitScript(() => {
    const add = WebSocket.prototype.addEventListener;
    WebSocket.prototype.addEventListener = function (
      this: WebSocket,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type !== 'message' || !listener)
        return Reflect.apply(add, this, [type, listener, options]);
      const wrapped = (event: MessageEvent) => {
        const data = JSON.parse(event.data, (_key, value) => {
          if (
            value &&
            typeof value === 'object' &&
            value.jobId &&
            value.byteLength &&
            value.format
          ) {
            Reflect.set(window, '__legacyOutputSeen', true);
            const { basis: _basis, input: _input, ...legacy } = value;
            return legacy;
          }
          return value;
        });
        const projected = new MessageEvent('message', { data: JSON.stringify(data) });
        if (typeof listener === 'function') listener.call(this, projected);
        else listener.handleEvent(projected);
      };
      return Reflect.apply(add, this, [type, wrapped, options]);
    } as typeof WebSocket.prototype.addEventListener;
  });
  await uiPage.goto(rendererUrl);
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await addProject(uiPage, root);
  await createSession(uiPage, basename(root));
  await uiPage.getByRole('treeitem', { name: '打开文件 legacy.qmd', exact: true }).dblclick();
  await uiPage.getByRole('button', { name: '完整排版', exact: true }).click();
  const render = uiPage.getByRole('region', { name: '完整排版预览', exact: true });
  await render.getByLabel('预览格式', { exact: true }).selectOption('pdf');
  const pdf = render.getByRole('region', { name: '排版 PDF', exact: true });
  await expect(pdf.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 60000 });
  expect(await uiPage.evaluate(() => Reflect.get(window, '__legacyOutputSeen'))).toBe(true);
  await expect(render.getByText(/历史产物.*预览.*导出/)).toBeVisible();
  await expect(pdf.getByRole('button', { name: /附加第/ })).toHaveCount(0);
  await writeFile(join(root, 'legacy.qmd'), '---\ntitle: [broken\n---\nFailed input.\n');
  await render.getByRole('button', { name: '重新编译', exact: true }).click();
  await expect(render.getByRole('status', { name: '排版状态' })).toContainText('失败', {
    timeout: 30000,
  });
  await expect(pdf.locator('img[src^="blob:"]').first()).toBeVisible();
  await expect(pdf.getByRole('button', { name: /附加第/ })).toHaveCount(0);
});

test('embedded PDF selection keeps its own render identity through composer, actual harness bytes and parsing', async ({
  uiPage,
}, info) => {
  test.setTimeout(180000);
  const root = test.info().outputPath(`render-material-${test.info().project.name}`);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'paper.qmd'), 'Render evidence 73.\n');
  let resource: ResourceDescriptor | undefined;
  uiPage.on('websocket', (socket) =>
    socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.result?.ref?.source === 'render' && message.result.capabilities)
        resource = message.result;
    }),
  );
  const model = await createModelServer({
    respond: ({ calls }) => {
      assert(resource);
      const input = { ref: resource.ref, basis: resource.basis };
      if (!calls.includes('read_context_resource'))
        return {
          tool: {
            name: 'read_context_resource',
            input: { ...input, encoding: 'base64', limit: 262144 },
          },
        };
      if (!calls.includes('read_context_document'))
        return {
          tool: {
            name: 'read_context_document',
            input: { ...input, request: { method: 'readPdfPage', input: { pageIndex: 0 } } },
          },
        };
      return { text: '已读取实际排版PDF字节及原页内容。' };
    },
  });
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR as string;
  const stop = await startModelKernel(directory, model.url);
  const client = createKernelClient(await runningKernel(directory));
  await client.connect();
  try {
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-render-key');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await addProject(uiPage, root);
    await createSession(uiPage, basename(root));
    await uiPage.getByRole('treeitem', { name: '打开文件 paper.qmd', exact: true }).dblclick();
    await uiPage.getByRole('button', { name: '完整排版', exact: true }).click();
    const render = uiPage.getByRole('region', { name: '完整排版预览', exact: true });
    await render.getByLabel('预览格式', { exact: true }).selectOption('pdf');
    const pdf = render.getByRole('region', { name: '排版 PDF', exact: true });
    await expect(pdf.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 60000 });
    await expect.poll(() => resource?.ref.source).toBe('render');
    assert(resource?.ref.source === 'render' && resource.render);
    const original = resource;
    expect(original.render?.input.ref.source).toBe('project');
    expect(original.basis).not.toBe(original.render?.input.basis);
    const sdk = pdf.locator('embedpdf-container');
    await expect
      .poll(() =>
        sdk.evaluate(async (element) => {
          const registry = await Reflect.get(element, 'registry');
          return (
            registry.getPlugin('selection').provides().getState().geometry[0]?.runs.length ?? 0
          );
        }),
      )
      .toBeGreaterThan(0);
    const points = await sdk.evaluate(async (element) => {
      const registry = await Reflect.get(element, 'registry');
      const geometry = registry.getPlugin('selection').provides().getState().geometry[0];
      const run = geometry.runs.find((run: { glyphs: unknown[] }) => run.glyphs.length > 8);
      const first = run.glyphs[0],
        last = run.glyphs.at(-1);
      const size = registry.getPlugin('document-manager').provides().getActiveDocument()
        .pages[0].size;
      return {
        x1: first.x + 0.1,
        x2: last.x + last.width - 0.1,
        y: first.y + first.height / 2,
        width: size.width,
        height: size.height,
      };
    });
    const box = await pdf.locator('img[src^="blob:"]').first().boundingBox();
    assert(box);
    await uiPage.mouse.move(
      box.x + (box.width * points.x1) / points.width,
      box.y + (box.height * points.y) / points.height,
    );
    await uiPage.mouse.down();
    await uiPage.mouse.move(
      box.x + (box.width * points.x2) / points.width,
      box.y + (box.height * points.y) / points.height,
      { steps: 12 },
    );
    await uiPage.mouse.up();
    await pdf.getByRole('button', { name: '附加第 1 页选区', exact: true }).click();
    const dock = uiPage.locator('.agent-dock');
    await dock.getByLabel('查看附加上下文', { exact: true }).click();
    await dock.locator('details.menu details summary').click();
    await expect(dock.getByRole('blockquote')).toContainText('Render evidence 73');
    await dock.getByLabel('上下文批注 1', { exact: true }).fill('核对实际产物，不读取源码替代。');
    await dock.getByLabel('上下文批注 1', { exact: true }).press('Escape');
    const projectId = original.ref.source === 'render' ? original.ref.projectId : '';
    const session = (await client.call('session.list', { projectId })).sessions[0];
    assert(session);
    const scope = { projectId, sessionId: session.id };
    await uiPage
      .getByRole('textbox', { name: '研究指令', exact: true })
      .fill('MODEL_CHAT 核对附加排版产物');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 20000,
    });
    const snapshot = await client.call('workbench.snapshot', scope);
    const sent = snapshot.messages.find(
      (message) => message.role === 'user' && message.text.includes('核对附加排版产物'),
    );
    const item = sent?.contextItems?.[0];
    expect(item).toMatchObject({
      kind: 'text',
      ref: original.ref,
      basis: original.basis,
      location: { pageIndex: 0 },
    });
    const bytes = snapshot.messages.find(
      (message) => message.tool?.name === 'read_context_resource',
    )?.tool?.output;
    expect(
      Buffer.from(JSON.parse(bytes ?? '{}').data, 'base64')
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    const parsed = snapshot.messages.find(
      (message) => message.tool?.name === 'read_context_document',
    )?.tool?.output;
    expect(JSON.parse(parsed ?? '{}').text).toContain('Render evidence 73');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const user = uiPage
      .getByRole('article', { name: '用户消息' })
      .filter({ hasText: '核对附加排版产物' });
    await user.getByText('明确附加上下文（1）', { exact: true }).click();
    await user.getByRole('button', { name: '打开排版产物', exact: true }).click();
    await expect(uiPage.getByRole('tab', { name: /^paper\.pdf / })).toBeVisible();
    await expect(
      uiPage
        .getByRole('region', { name: 'PDF 阅读 paper.pdf', exact: true })
        .locator('img[src^="blob:"]')
        .first(),
    ).toBeVisible();
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    expect(
      (await client.call('workbench.snapshot', scope)).messages.find(
        (message) => message.id === sent?.id,
      )?.contextItems,
    ).toEqual(sent?.contextItems);
    await info.attach('render-material-evidence', {
      body: JSON.stringify({ resource: original, item, parsed: JSON.parse(parsed ?? '{}') }),
      contentType: 'application/json',
    });
  } finally {
    client.dispose();
    await stop();
    await model.close();
  }
});
