/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { ResourceDescriptor } from '../../packages/protocol/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

async function selectRenderText(page: Page, pdf: Locator) {
  const sdk = pdf.locator('embedpdf-container');
  await expect
    .poll(() =>
      sdk.evaluate(async (element) => {
        const registry = await Reflect.get(element, 'registry');
        return registry.getPlugin('selection').provides().getState().geometry[0]?.runs.length ?? 0;
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
  await page.mouse.move(
    box.x + (box.width * points.x1) / points.width,
    box.y + (box.height * points.y) / points.height,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + (box.width * points.x2) / points.width,
    box.y + (box.height * points.y) / points.height,
    { steps: 12 },
  );
  await page.mouse.up();
}

test('automatic render adoption rechecks renewed dirty input after authorization, while explicit viewing remains available', async ({
  uiPage,
}, info) => {
  test.setTimeout(120000);
  const root = info.outputPath(`adoption-race-${info.project.name}`);
  await mkdir(root, { recursive: true });
  const saved = 'Saved render adoption evidence 81.\n';
  await writeFile(join(root, 'paper.qmd'), saved);
  let pendingResource: ResourceDescriptor | undefined;
  uiPage.on('websocket', (socket) =>
    socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.result?.ref?.source === 'render' && message.result.format === 'html')
        pendingResource = message.result;
    }),
  );
  const evidence: Record<string, unknown> = {};
  await installRpcGate(uiPage);
  try {
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, root);
    await createSession(uiPage, basename(root));
    await uiPage.getByRole('treeitem', { name: '打开文件 paper.qmd', exact: true }).dblclick();
    await uiPage.getByRole('button', { name: '并排排版', exact: true }).click();
    const render = uiPage.getByRole('region', { name: '完整排版预览', exact: true });
    const status = render.getByRole('status', { name: '排版状态', exact: true });
    await render.getByLabel('预览格式', { exact: true }).selectOption('pdf');
    const pdf = render.getByRole('region', { name: '排版 PDF', exact: true });
    await expect(pdf.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 60000 });
    const originalReader = await pdf.elementHandle();
    const source = uiPage.locator('.cm-content[contenteditable="true"]').first();
    const initialText = await source.innerText();
    await source.press('ControlOrMeta+End');
    await source.press('x');
    await expect(status).toContainText('有未保存草稿');
    await render.getByLabel('预览格式', { exact: true }).selectOption('html');
    const viewNew = render.getByRole('button', { name: '查看新版', exact: true });
    await expect(viewNew).toBeVisible({ timeout: 60000 });
    assert(pendingResource?.ref.source === 'render');
    evidence.pending = pendingResource;
    await armRpcGate(uiPage, 'resources.describe', '', true);
    await source.press('ControlOrMeta+z');
    expect(await source.innerText()).toBe(initialText);
    await expect(status).not.toContainText('有未保存草稿');
    await uiPage.waitForFunction(() => !!Reflect.get(window, '__scholoomRpcGate')?.held);
    const held = await uiPage.evaluate(() =>
      JSON.parse(Reflect.get(window, '__scholoomRpcGate').held.payload),
    );
    expect(held.result.ref).toEqual(pendingResource.ref);
    expect(held.result.basis).toBe(pendingResource.basis);
    evidence.automaticAuthorization = held.result;
    await source.press('r');
    const renewedText = await source.innerText();
    await expect(status).toContainText('有未保存草稿');
    expect(renewedText).not.toBe(initialText);
    expect(await readFile(join(root, 'paper.qmd'), 'utf8')).toBe(saved);
    evidence.beforeReply = { renewedText, status: await status.innerText(), diskUnchanged: true };
    evidence.readerConnectedBeforeReply = await originalReader?.evaluate(
      (node) => node.isConnected,
    );
    expect(evidence.readerConnectedBeforeReply).toBe(true);
    await releaseRpcGate(uiPage);
    await uiPage.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    evidence.readerRetainedAfterReply = await originalReader?.evaluate((node) => node.isConnected);
    evidence.afterReplyText = await source.innerText();
    expect(evidence.readerRetainedAfterReply).toBe(true);
    await expect(pdf).toBeVisible();
    await expect(viewNew).toBeVisible();
    expect(await source.innerText()).toBe(renewedText);
    await viewNew.click();
    await expect(
      uiPage.frameLocator('iframe[title="HTML 排版预览"]').getByText(saved.trim(), { exact: true }),
    ).toBeVisible();
    expect(await source.innerText()).toBe(renewedText);
    await expect(status).toContainText('有未保存草稿');
    expect(await readFile(join(root, 'paper.qmd'), 'utf8')).toBe(saved);
    evidence.explicitViewSucceeded = true;
  } finally {
    await uiPage.evaluate(() => {
      const gate = Reflect.get(window, '__scholoomRpcGate');
      if (gate?.held) gate.release();
    });
    await info.attach('auto-adoption-evidence', {
      body: JSON.stringify(evidence),
      contentType: 'application/json',
    });
  }
});

for (const protection of ['dirty', 'annotation'] as const) {
  test(`cross-format PDF to HTML preserves ${protection} through delayed, failed and superseded candidates`, async ({
    uiPage,
  }, info) => {
    test.setTimeout(180000);
    const root = info.outputPath(`cross-format-${protection}-${info.project.name}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'paper.qmd'), 'Cross format original evidence 73.\n');
    const formats = new Map<string, string>();
    const calls: unknown[] = [];
    let armed: 'describe' | 'read' | undefined;
    let gateReady = () => {};
    const arm = (method: 'describe' | 'read') => {
      armed = method;
      return new Promise<void>((resolve) => {
        gateReady = resolve;
      });
    };
    let held: { outputId: string; release(fail?: boolean): void } | undefined;
    await uiPage.routeWebSocket(/\/rpc(?:\?|$)|^ws:\/\//, (route) => {
      const server = route.connectToServer();
      const requests = new Map<
        string,
        { method: string; params: { ref?: { outputId?: string }; locator?: { outputId?: string } } }
      >();
      route.onMessage((raw) => {
        const request = JSON.parse(raw.toString());
        if (request.id !== undefined && request.method) requests.set(String(request.id), request);
        server.send(raw);
      });
      server.onMessage((raw) => {
        const reply = JSON.parse(raw.toString());
        const request = requests.get(String(reply.id));
        requests.delete(String(reply.id));
        if (reply.result?.ref?.source === 'render' && reply.result.format)
          formats.set(reply.result.ref.outputId, reply.result.format);
        const id = request?.params?.ref?.outputId ?? request?.params?.locator?.outputId;
        if (request?.method.startsWith('resources.') && calls.length < 80)
          calls.push({ method: request.method, id, format: id && formats.get(id), armed });
        if (
          id &&
          formats.get(id) === 'html' &&
          request?.method === `resources.${armed}` &&
          reply.result
        ) {
          assert(!held);
          armed = undefined;
          held = {
            outputId: id,
            release(fail = false) {
              held = undefined;
              if (fail)
                route.send(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: reply.id,
                    error: {
                      code: -32603,
                      message: 'Synthetic delivery failure',
                      data: { code: 'unavailable', message: 'Synthetic delivery failure' },
                    },
                  }),
                );
              else route.send(raw);
            },
          };
          gateReady();
        } else route.send(raw);
      });
    });
    const draft = () =>
      uiPage.evaluate(() =>
        Object.entries(localStorage).filter(([key]) => key.endsWith('|context-items')),
      );
    try {
      await uiPage.goto(rendererUrl);
      await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await addProject(uiPage, root);
      await createSession(uiPage, basename(root));
      await uiPage.getByRole('treeitem', { name: '打开文件 paper.qmd', exact: true }).dblclick();
      await uiPage
        .getByRole('button', {
          name: protection === 'dirty' ? '并排排版' : '完整排版',
          exact: true,
        })
        .click();
      const render = uiPage.getByRole('region', { name: '完整排版预览', exact: true });
      await render.getByLabel('预览格式', { exact: true }).selectOption('pdf');
      const pdf = render.getByRole('region', { name: '排版 PDF', exact: true });
      const image = pdf.locator('img[src^="blob:"]').first();
      await expect(image).toBeVisible({ timeout: 60000 });
      const originalImage = await image.elementHandle();
      if (protection === 'annotation') {
        await selectRenderText(uiPage, pdf);
        await pdf.getByRole('button', { name: '批注', exact: true }).click();
        await pdf
          .getByRole('textbox', { name: '材料批注', exact: true })
          .fill('Keep the original PDF evidence.');
      } else {
        await uiPage
          .locator('.cm-content[contenteditable="true"]')
          .first()
          .press('ControlOrMeta+End');
        await uiPage.keyboard.type(' unsaved local draft');
      }
      const originalDraft = await draft();
      const described = arm('describe');
      await render.getByLabel('预览格式', { exact: true }).selectOption('html');
      await described;
      await expect(image).toBeVisible();
      expect(await originalImage?.evaluate((node) => node.isConnected)).toBe(true);
      await expect(render.getByRole('button', { name: '查看新版', exact: true })).toHaveCount(0);
      const bytes = arm('read');
      held?.release();
      await bytes;
      await expect(image).toBeVisible();
      await expect(render.getByRole('button', { name: '查看新版', exact: true })).toHaveCount(0);
      held?.release(true);
      await expect(
        render.getByRole('alert').filter({ hasText: 'Synthetic delivery failure' }),
      ).toBeVisible();
      await expect(image).toBeVisible();
      expect(await draft()).toEqual(originalDraft);
      const superseded = arm('read');
      await render.getByRole('button', { name: '重新编译', exact: true }).click();
      await superseded;
      const older = held;
      assert(older);
      held = undefined;
      await writeFile(join(root, 'paper.qmd'), 'Complete newer candidate C 75.\n');
      await render.getByRole('button', { name: '重新编译', exact: true }).click();
      await expect(render.getByRole('button', { name: '查看新版', exact: true })).toBeVisible({
        timeout: 60000,
      });
      await expect(image).toBeVisible();
      await render.getByRole('button', { name: '查看新版', exact: true }).click();
      const frame = uiPage.frameLocator('iframe[title="HTML 排版预览"]:visible');
      await expect(
        frame.getByText('Complete newer candidate C 75.', { exact: true }),
      ).toBeVisible();
      older.release();
      await uiPage.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(
        frame.getByText('Complete newer candidate C 75.', { exact: true }),
      ).toBeVisible();
      expect(await draft()).toEqual(originalDraft);
      if (protection === 'dirty')
        await expect(uiPage.locator('.cm-content[contenteditable="true"]').first()).toContainText(
          'unsaved local draft',
        );
      await info.attach('cross-format-evidence', {
        body: JSON.stringify({
          protection,
          originalDraft,
          supersededOutput: older.outputId,
          formats: [...formats],
        }),
        contentType: 'application/json',
      });
    } finally {
      held?.release();
      await info.attach('candidate-rpc-deliveries', {
        body: JSON.stringify(calls),
        contentType: 'application/json',
      });
    }
  });
}

test('static HTML annotations preserve render evidence through source changes, shared send and reopening', async ({
  uiPage,
}, info) => {
  test.setTimeout(240000);
  const root = info.outputPath(`html-material-${info.project.name}`);
  await mkdir(root, { recursive: true });
  let hits = 0;
  const trap = createServer((_request, response) => {
    hits++;
    response.end('unexpected');
  });
  await new Promise<void>((resolve) => trap.listen(0, '127.0.0.1', resolve));
  const address = trap.address();
  assert(address && typeof address !== 'string');
  const remote = `http://127.0.0.1:${address.port}/forbidden`;
  const evidence = 'HTML render evidence 73.';
  const revised = 'HTML render evidence revised.';
  const source = `${evidence}\n\n<script>window.__annotationScriptRan=true;fetch('${remote}')</script>\n\n<img src="${remote}" onerror="window.__annotationEventRan=true">\n`;
  await writeFile(join(root, 'paper.qmd'), source);
  let resource: ResourceDescriptor | undefined;
  let original: ResourceDescriptor | undefined;
  let sectionId = '';
  uiPage.on('websocket', (socket) =>
    socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.result?.ref?.source === 'render' && message.result.format === 'html')
        resource = message.result;
    }),
  );
  const model = await createModelServer({
    respond: ({ calls }) => {
      assert(original);
      const access = { ref: original.ref, basis: original.basis };
      if (!calls.includes('read_context_resource'))
        return {
          tool: { name: 'read_context_resource', input: { ...access, encoding: 'base64' } },
        };
      if (!calls.includes('read_context_document'))
        return {
          tool: {
            name: 'read_context_document',
            input: { ...access, request: { method: 'readDocumentSection', input: { sectionId } } },
          },
        };
      if (!calls.includes('read_file'))
        return { tool: { name: 'read_file', input: { file_path: '/paper.qmd' } } };
      if (!calls.includes('edit_file'))
        return {
          tool: {
            name: 'edit_file',
            input: { file_path: '/paper.qmd', old_string: evidence, new_string: revised },
          },
        };
      return { text: '已核对原产物并修改实际源稿。' };
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
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-html-key');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await addProject(uiPage, root);
    await createSession(uiPage, basename(root));
    await uiPage.getByRole('treeitem', { name: '打开文件 paper.qmd', exact: true }).dblclick();
    await uiPage.getByRole('button', { name: '完整排版', exact: true }).click();
    const render = uiPage.getByRole('region', { name: '完整排版预览', exact: true });
    const frame = uiPage.frameLocator('iframe[title="HTML 排版预览"]');
    await expect(frame.getByText(evidence, { exact: true })).toBeVisible({ timeout: 60000 });
    await expect.poll(() => resource?.format).toBe('html');
    original = resource;
    assert(original?.ref.source === 'render' && original.render);
    expect(original.basis).not.toBe(original.render.input.basis);
    const projectId = original.ref.projectId;
    const session = (await client.call('session.list', { projectId })).sessions[0];
    assert(session);
    const scope = { projectId, sessionId: session.id };
    const document = await client.call('resources.document', {
      ref: original.ref,
      basis: original.basis,
      request: { method: 'documentInfo', input: {} },
    });
    assert('sections' in document && document.sections[0]);
    sectionId = document.sections[0].id;
    const text = frame.getByText(evidence, { exact: true });
    const box = await text.boundingBox();
    assert(box);
    // Native input avoids Playwright's scripted drag detector in this scriptless frame.
    const input = await uiPage.context().newCDPSession(uiPage);
    try {
      const y = box.y + box.height / 2;
      await input.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + 1, y });
      await input.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: box.x + 1,
        y,
        button: 'left',
        clickCount: 1,
      });
      await input.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: box.x + box.width - 1,
        y,
        button: 'left',
        buttons: 1,
      });
      await input.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: box.x + box.width - 1,
        y,
        button: 'left',
        clickCount: 1,
      });
    } finally {
      await input.detach();
    }
    await render.getByRole('button', { name: '批注', exact: true }).click();
    const comment = render.getByRole('textbox', { name: '材料批注', exact: true });
    await comment.fill('根据这个旧产物更正 paper.qmd 的证据句。');
    expect(
      await text.evaluate((element) => {
        const window = element.ownerDocument.defaultView;
        if (!window) throw new Error('Missing preview window');
        return {
          script: Reflect.get(window, '__annotationScriptRan'),
          event: Reflect.get(window, '__annotationEventRan'),
        };
      }),
    ).toEqual({ script: undefined, event: undefined });
    expect(hits).toBe(0);
    await writeFile(join(root, 'paper.qmd'), `${source}\nNew independently saved version 74.\n`);
    await render.getByRole('button', { name: '重新编译', exact: true }).click();
    await expect(render.getByRole('button', { name: '查看新版', exact: true })).toBeVisible({
      timeout: 60000,
    });
    await expect(
      frame.getByText('New independently saved version 74.', { exact: true }),
    ).toHaveCount(0);
    await expect(comment).toHaveValue('根据这个旧产物更正 paper.qmd 的证据句。');
    await render.getByRole('button', { name: '查看新版', exact: true }).click();
    await expect(
      frame.getByText('New independently saved version 74.', { exact: true }),
    ).toBeVisible({ timeout: 60000 });
    await expect(comment).toHaveValue('根据这个旧产物更正 paper.qmd 的证据句。');
    await expect(uiPage.getByRole('textbox', { name: '研究指令', exact: true })).toHaveValue('');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 30000,
    });
    await expect.poll(() => readFile(join(root, 'paper.qmd'), 'utf8')).toContain(revised);
    await expect(frame.getByText(revised, { exact: true })).toBeVisible({ timeout: 60000 });
    const snapshot = await client.call('workbench.snapshot', scope);
    const sent = snapshot.messages.find(
      (message) => message.role === 'user' && message.contextItems?.length,
    );
    expect(sent?.contextItems?.[0]).toMatchObject({
      ref: original.ref,
      basis: original.basis,
      kind: 'text',
    });
    expect(sent?.contextItems?.[0]).not.toHaveProperty('location');
    const parsed = snapshot.messages.find(
      (message) => message.tool?.name === 'read_context_document',
    )?.tool?.output;
    expect(JSON.parse(parsed ?? '{}').text).toContain(evidence);
    const file = await client.call('files.read', { projectId, path: 'paper.qmd' });
    assert(file.fileId);
    const changes = await client.call('files.changes', {
      projectId,
      fileId: file.fileId,
      limit: 10,
    });
    const change = changes.changes.find((value) => value.origin?.kind === 'execution');
    assert(change);
    const edit = await client.call('files.edit', {
      projectId,
      fileId: file.fileId,
      editId: change.editId,
    });
    expect(edit.before).toContain(evidence);
    expect(edit.after).toContain(revised);
    await writeFile(join(root, 'paper.qmd'), '---\ntitle: [broken\n---\n');
    await render.getByRole('button', { name: '重新编译', exact: true }).click();
    await expect(render.getByRole('status', { name: '排版状态' })).toContainText('失败', {
      timeout: 60000,
    });
    await expect(frame.getByText(revised, { exact: true })).toBeVisible();
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const user = uiPage
      .getByRole('article', { name: '用户消息' })
      .filter({ hasText: '请处理附加材料中的批注' });
    await user.getByText('明确附加上下文（1）', { exact: true }).click();
    await user.getByRole('button', { name: '打开排版产物', exact: true }).click();
    await expect(frame.getByText(evidence, { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(
      frame.getByText('New independently saved version 74.', { exact: true }),
    ).toHaveCount(0);
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    expect(
      (await client.call('workbench.snapshot', scope)).messages.find(
        (message) => message.id === sent?.id,
      )?.contextItems,
    ).toEqual(sent?.contextItems);
    expect(hits).toBe(0);
  } finally {
    client.dispose();
    await stop();
    await model.close();
    await new Promise<void>((resolve, reject) =>
      trap.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

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
    await selectRenderText(uiPage, pdf);
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
