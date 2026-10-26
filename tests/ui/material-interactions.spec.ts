/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('a real document annotation reaches the shared composer and changes a project file with inspectable history', async ({
  uiPage,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-ui-'));
  const evidence = 'Material evidence 73.';
  const before = '# Finding\n\nBefore review.\n';
  const after = '# Finding\n\nAfter review.\n';
  await writeFile(join(root, 'paper.html'), `<html><body><p>${evidence}</p></body></html>`);
  await writeFile(join(root, 'note.md'), before);
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (!calls.includes('read_file'))
        return { tool: { name: 'read_file', input: { file_path: '/note.md' } } };
      if (!calls.includes('edit_file'))
        return {
          tool: {
            name: 'edit_file',
            input: {
              file_path: '/note.md',
              old_string: 'Before review.',
              new_string: 'After review.',
            },
          },
        };
      return { text: '已根据所附材料修改，并保留实际文件修改记录。' };
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
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-material-key');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await addProject(uiPage, root);
    await createSession(uiPage, basename(root));
    const project = (await client.call('workbench.snapshot', {})).projects.find(
      (item) => item.path === root,
    );
    assert(project);
    const session = (await client.call('session.list', { projectId: project.id })).sessions[0];
    assert(session);
    const scope = { projectId: project.id, sessionId: session.id };
    await uiPage.getByRole('treeitem', { name: '打开文件 paper.html', exact: true }).dblclick();
    const article = uiPage.getByRole('article', { name: '文档正文', exact: true });
    await expect(article).toContainText(evidence);
    const selectEvidence = () =>
      article
        .locator('[data-document-start]')
        .first()
        .evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        });
    await selectEvidence();
    await expect(uiPage.getByRole('button', { name: '附加选区', exact: true })).toBeEnabled();
    await uiPage.evaluate(() => window.getSelection()?.removeAllRanges());
    await expect(uiPage.getByRole('button', { name: '附加选区', exact: true })).toBeDisabled();
    await selectEvidence();
    await uiPage.getByRole('button', { name: '附加选区', exact: true }).click();
    const dock = uiPage.locator('.agent-dock');
    await dock.getByLabel('查看附加上下文', { exact: true }).click();
    await dock.locator('details.menu details summary').click();
    await expect(dock.getByRole('blockquote')).toContainText(evidence);
    const comment = '据此核查并修改 note.md。';
    await dock.getByLabel('上下文批注 1', { exact: true }).fill(comment);
    await dock.getByLabel('上下文批注 1', { exact: true }).press('Escape');
    model.hold = true;
    const instruction = 'MODEL_CHAT 根据明确附加的阅读材料修改项目结论';
    await uiPage.getByRole('textbox', { name: '研究指令', exact: true }).fill(instruction);
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length, { timeout: 20000 }).toBe(1);
    const sent = (await client.call('workbench.snapshot', scope)).messages.find(
      (message) => message.text === instruction,
    );
    assert(sent?.contextItems?.length === 1);
    expect(sent.contextItems[0]).toMatchObject({
      kind: 'text',
      quote: evidence,
      comment,
      contentState: 'saved',
      ref: { source: 'project', projectId: project.id },
      location: { kind: 'text', normalizationVersion: 1, start: 0, end: evidence.length },
    });
    await uiPage.getByRole('textbox', { name: '研究指令', exact: true }).fill('后续补充保持为草稿');
    model.release();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 20000,
    });
    expect(await readFile(join(root, 'note.md'), 'utf8')).toBe(after);
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(evidence);
    await expect(uiPage.getByRole('textbox', { name: '研究指令', exact: true })).toHaveValue(
      '后续补充保持为草稿',
    );
    await uiPage.getByRole('treeitem', { name: '打开文件 note.md', exact: true }).dblclick();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 note.md', exact: true }),
    ).toContainText('After review.');
    await uiPage.getByRole('button', { name: '修改历史', exact: true }).click();
    const history = uiPage
      .locator('.file-editor > details')
      .filter({ hasText: '已保存修改 · note.md' });
    await expect(history).toHaveCount(1);
    await history.locator('summary').click();
    await expect(history.getByLabel('内容差异', { exact: true })).toContainText('Before review.');
    await expect(history.getByLabel('内容差异', { exact: true })).toContainText('After review.');
    await history.getByRole('button', { name: '撤销此修改', exact: true }).click();
    await expect.poll(() => readFile(join(root, 'note.md'), 'utf8')).toBe(before);
    await info.attach('material-evidence', {
      body: JSON.stringify({ scope, contextItems: sent.contextItems, before, after }),
      contentType: 'application/json',
    });
  } finally {
    model.release();
    client.dispose();
    await stop();
    await model.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('project and library images share real region selection while revoked content stops displaying', async ({
  uiPage,
}) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-image-ui-'));
  const name = `chart-${basename(root)}.png`;
  await writeFile(
    join(root, name),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, root, { trust: 'restricted' });
    await createSession(uiPage, basename(root));
    const project = (await client.call('workbench.snapshot', {})).projects.find(
      (item) => item.path === root,
    );
    assert(project);
    await uiPage.getByRole('treeitem', { name: `打开文件 ${name}`, exact: true }).dblclick();
    const image = uiPage.getByRole('region', { name: `图片 ${name}`, exact: true });
    await expect(image.getByRole('img', { name, exact: true })).toBeVisible();
    await image.getByLabel('区域宽度', { exact: true }).fill('0.5');
    await image.getByRole('button', { name: '应用图片区域', exact: true }).click();
    await image.getByRole('button', { name: '附加图片区域', exact: true }).click();
    const context = uiPage
      .locator('.agent-dock')
      .getByRole('region', { name: '附加上下文', exact: true });
    await expect(context).toContainText('1 个附加项');
    await client.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const batch = await client.call('library.importProjectFiles', {
      batchId: crypto.randomUUID(),
      projectId: project.id,
      projectPaths: [name],
      purpose: '正文',
      version: 'unspecified',
      origin: 'material-image-ui',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await uiPage.getByLabel('查找题录', { exact: true }).fill(name);
    await uiPage.getByRole('option').filter({ hasText: name }).click();
    await uiPage.getByRole('button', { name: `打开 图片 ${name}`, exact: true }).click();
    await expect(image.getByRole('img', { name, exact: true })).toBeVisible();
    await image.getByLabel('区域高度', { exact: true }).fill('0.5');
    await image.getByRole('button', { name: '应用图片区域', exact: true }).click();
    await image.getByRole('button', { name: '附加图片区域', exact: true }).click();
    await expect(context).toContainText('2 个附加项');
    await client.call('library.grant', {
      read: false,
      write: false,
      send: false,
      autoBackup: false,
    });
    await expect(image.getByRole('img')).toHaveCount(0);
    await expect(context).toContainText('2 个附加项');
  } finally {
    client.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test('Markdown selections keep semantic boundaries through the real shared composer', async ({
  uiPage,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-boundaries-'));
  await writeFile(
    join(root, 'dose.md'),
    'Dose 1\n\n2 mg\n\nLine 3  \n4 mg\n\n| Dose | Empty | Amount |\n| --- | --- | --- |\n| 10 | | 20 |\n',
  );
  try {
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, root);
    await createSession(uiPage, basename(root));
    await uiPage.getByRole('treeitem', { name: '打开文件 dose.md', exact: true }).dblclick();
    await uiPage.getByRole('button', { name: '预览', exact: true }).click();
    const body = uiPage.locator('.markdown-preview-body');
    await expect(body.locator('table')).toContainText('20');
    await body.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    await uiPage.getByRole('button', { name: '附加选区', exact: true }).click();
    const context = uiPage
      .locator('.agent-dock')
      .getByRole('region', { name: '附加上下文', exact: true });
    await context.getByLabel('查看附加上下文', { exact: true }).click();
    await context.locator('details.menu details summary').click();
    const quote = await context.getByRole('blockquote').textContent();
    expect(quote).toMatch(/Dose 1\s+2 mg/);
    expect(quote).toMatch(/Line 3\s+4 mg/);
    expect(quote).toMatch(/10\s+20/);
    expect(quote).not.toMatch(/Dose 12|Line 34|1020/);
    expect(quote?.split(/\n+/).map((row) => row.split('\t'))).toContainEqual(['10', '', '20']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('real visual and Markdown selections keep unsaved text and objects in the shared draft across reload', async ({
  uiPage,
}) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-material-visual-ui-'));
  const content =
    '# Selection\n\nHello visual.\n\n| Method | Value |\n| --- | --- |\n| A | 42 |\n\nEnergy $x^2$ done.\n';
  await writeFile(join(root, 'paper.qmd'), content);
  try {
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, root);
    await createSession(uiPage, basename(root));
    await uiPage.getByRole('treeitem', { name: '打开文件 paper.qmd', exact: true }).dblclick();
    await uiPage.getByRole('button', { name: '可视编辑', exact: true }).click();
    const visual = uiPage.getByRole('region', { name: '可视编辑器', exact: true });
    const prose = visual.locator('.ProseMirror[contenteditable="true"]').first();
    await expect(prose).toContainText('Hello visual.', { timeout: 45000 });
    await prose.locator('table').click();
    await visual.getByRole('button', { name: '选择当前表格', exact: true }).click();
    await uiPage.getByRole('button', { name: '附加对象', exact: true }).click();
    const context = uiPage
      .locator('.agent-dock')
      .getByRole('region', { name: '附加上下文', exact: true });
    await expect(context).toContainText('1 个附加项');
    await prose.press('ControlOrMeta+End');
    await prose.press('Enter');
    await uiPage.keyboard.insertText('Unsubmitted selection.');
    await prose.press('Home');
    await prose.press('Shift+End');
    await uiPage.getByRole('button', { name: '附加选区', exact: true }).click();
    await expect(context).toContainText('2 个附加项');
    await context.getByLabel('查看附加上下文', { exact: true }).click();
    await expect(context.locator('details.menu details summary')).toContainText([
      '表格',
      '草稿摘录',
    ]);
    await context.getByLabel('查看附加上下文', { exact: true }).click();
    await uiPage.getByRole('button', { name: '预览', exact: true }).click();
    await expect(uiPage.getByRole('region', { name: 'Markdown 预览', exact: true })).toContainText(
      'Unsubmitted selection.',
    );
    await uiPage.getByRole('button', { name: '选择表格', exact: true }).click();
    await uiPage.getByRole('button', { name: '附加对象', exact: true }).click();
    await expect(context).toContainText('3 个附加项');
    const formula = uiPage.locator('.markdown-preview-body > p').filter({ hasText: 'Energy' });
    await formula.evaluate((element) => {
      const text = document
        .createTreeWalker(element.querySelector('.katex-html') as Element, NodeFilter.SHOW_TEXT)
        .nextNode() as Text;
      const range = document.createRange();
      range.setStart(element.firstChild as Node, 0);
      range.setEnd(text, text.length);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    await expect(uiPage.getByRole('button', { name: '附加选区', exact: true })).toBeDisabled();
    await expect(uiPage.getByRole('alert')).toContainText('完整公式');
    await expect(context).toContainText('3 个附加项');
    await formula.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    await uiPage.getByRole('button', { name: '附加选区', exact: true }).click();
    await expect(context).toContainText('4 个附加项');
    expect(await readFile(join(root, 'paper.qmd'), 'utf8')).toBe(content);
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await expect(context).toContainText('4 个附加项');
    await uiPage.getByRole('treeitem', { name: '打开文件 paper.qmd', exact: true }).dblclick();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 paper.qmd', exact: true }),
    ).toContainText('Unsubmitted selection.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
