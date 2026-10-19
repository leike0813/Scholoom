import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, expect, test } from './fixture.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('project files share draft preview and survive directory rename, trash and recovery', async ({
  uiPage,
}, info) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-ui-'));
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const project = join(root, 'project');
  const errors: string[] = [];
  const external: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  uiPage.on('request', (request) => {
    if (request.url().includes('untrusted.example')) external.push(request.url());
  });
  try {
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project, { mode: 'create' });
    await mkdir(join(project, 'recovered'));
    await expect(
      uiPage.getByRole('button', { name: 'project，已展开', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-preview-key');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
    await uiPage.getByText('项目权限与备份', { exact: true }).click();
    await uiPage.getByLabel('读取项目材料', { exact: true }).check();
    await uiPage.getByLabel('将项目材料发送到 MiniMax', { exact: true }).check();
    await uiPage
      .getByLabel('新建、修改、重命名和回收／恢复项目文件及目录', { exact: true })
      .check();
    await uiPage.getByRole('button', { name: '保存项目授权', exact: true }).click();
    await uiPage.getByRole('button', { name: '新建目录', exact: true }).click();
    const newDirectory = uiPage.getByLabel('新建目录名', { exact: true });
    await newDirectory.fill('notes');
    await newDirectory.press('Enter');
    const notes = uiPage.getByRole('treeitem', { name: '进入目录 notes', exact: true });
    await notes.click();
    await uiPage.getByRole('button', { name: '新建文件', exact: true }).click();
    const newFile = uiPage.getByLabel('新文件名', { exact: true });
    await newFile.fill('draft.md');
    await newFile.press('Enter');
    const editor = uiPage.getByRole('textbox', { name: '文件内容 notes/draft.md', exact: true });
    const content =
      '# Draft title\n\n| Method | Score |\n| --- | --- |\n| A | 42 |\n\n$E=mc^2$\n\n![sample](../image.png)\n\n![remote](https://untrusted.example/image.png)\n\n<script>globalThis.unsafePreview=true</script>\n\n[unsafe](javascript:alert(1))\n';
    await writeFile(
      join(project, 'image.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    await editor.press('ControlOrMeta+a');
    await uiPage.keyboard.insertText(content);
    await expect(editor).toContainText('Method');
    await uiPage.getByRole('button', { name: '并排预览', exact: true }).click();
    await armRpcGate(uiPage, 'files.read');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).first().click();
    await expect
      .poll(() => readFile(join(project, 'notes', 'draft.md'), 'utf8').catch(() => ''))
      .toBe(content);
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await editor.press('ControlOrMeta+a');
    await uiPage.keyboard.insertText(`${content}\nUnsaved latest paragraph.`);
    await uiPage.getByRole('button', { name: '并排预览', exact: true }).first().click();
    await releaseRpcGate(uiPage);
    await expect(
      uiPage.getByRole('button', { name: '保存文件', exact: true }).first(),
    ).toBeEnabled();
    const preview = uiPage.getByRole('region', { name: 'Markdown 预览', exact: true });
    await expect(preview.getByRole('heading', { name: 'Draft title' })).toBeVisible();
    await expect(preview.getByRole('cell', { name: '42', exact: true })).toBeVisible();
    await expect(preview.locator('.katex')).toHaveCount(1);
    await preview.locator('.markdown-image').first().scrollIntoViewIfNeeded();
    await expect(preview.getByRole('img', { name: 'sample', exact: true })).toBeVisible();
    await expect
      .poll(() =>
        preview.getByRole('img', { name: 'sample', exact: true }).evaluate((image) => {
          const element = image as unknown as { complete: boolean; naturalWidth: number };
          return element.complete && element.naturalWidth > 0;
        }),
      )
      .toBe(true);
    await expect(editor).toContainText('Unsaved latest paragraph');
    await expect(preview).toContainText('Unsaved latest paragraph');
    await expect(preview).toContainText('远端图片未加载');
    expect(await uiPage.evaluate(() => Reflect.get(globalThis, 'unsafePreview'))).toBeUndefined();
    expect(external).toEqual([]);
    await uiPage.screenshot({ path: info.outputPath('file-preview-light.png') });
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
    await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
    await uiPage.screenshot({ path: info.outputPath('file-preview-dark.png') });
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    model.hold = true;
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill('MODEL_CHAT MODEL_HOLD');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(1);
    const large = `# Large preview\n\n${'A useful sentence. '.repeat(13750)}`;
    expect(Buffer.byteLength(large)).toBeLessThanOrEqual(262144);
    expect(Buffer.byteLength(large)).toBeGreaterThan(260000);
    await editor.press('ControlOrMeta+a');
    await uiPage.keyboard.insertText(large);
    await editor.press('ControlOrMeta+End');
    await editor.evaluate((element) => {
      element.addEventListener(
        'input',
        () => {
          const start = performance.now();
          const nextFrame = Reflect.get(globalThis, 'requestAnimationFrame') as (
            callback: () => void,
          ) => void;
          nextFrame(() =>
            Reflect.set(globalThis, 'previewInputLatency', performance.now() - start),
          );
        },
        { once: true, capture: true },
      );
    });
    await editor.press('x');
    await expect
      .poll(() => uiPage.evaluate(() => Reflect.get(globalThis, 'previewInputLatency')))
      .toBeGreaterThanOrEqual(0);
    const inputLatency = await uiPage.evaluate(
      () => Reflect.get(globalThis, 'previewInputLatency') as number,
    );
    const executionStatus = uiPage.getByRole('status', { name: '执行状态' });
    await executionStatus.evaluate((element) => {
      const started = performance.now();
      const Observer = Reflect.get(globalThis, 'MutationObserver');
      const observer = new Observer(() => {
        if (!element.textContent?.includes('已取消')) return;
        Reflect.set(globalThis, 'previewCancelLatency', performance.now() - started);
        observer.disconnect();
      });
      observer.observe(element, { childList: true, characterData: true, subtree: true });
    });
    await uiPage.getByRole('button', { name: '取消执行', exact: true }).click();
    await expect(executionStatus).toContainText('已取消');
    const cancelLatency = await uiPage.evaluate(
      () => Reflect.get(globalThis, 'previewCancelLatency') as number,
    );
    expect(inputLatency).toBeLessThan(1000);
    expect(cancelLatency).toBeLessThan(1000);
    const latencyPath = info.outputPath('preview-latency.json');
    await writeFile(
      latencyPath,
      JSON.stringify({ bytes: Buffer.byteLength(large), inputLatency, cancelLatency }),
    );
    await info.attach('preview-latency.json', {
      path: latencyPath,
      contentType: 'application/json',
    });
    await editor.press('ControlOrMeta+a');
    await uiPage.keyboard.insertText(`${content}\nUnsaved latest paragraph.`);
    await expect(preview.getByRole('heading', { name: 'Draft title' })).toBeVisible();
    await expect(preview.getByRole('heading', { name: 'Large preview' })).toHaveCount(0);
    await notes.click({ button: 'right' });
    await uiPage
      .getByRole('menu', { name: '文件操作菜单', exact: true })
      .getByRole('button', { name: /重命名/ })
      .click();
    const rename = uiPage.getByLabel('新名称', { exact: true });
    await rename.fill('renamed');
    await rename.press('Enter');
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 renamed/draft.md', exact: true }),
    ).toContainText('Unsaved latest paragraph');
    await expect(preview).toContainText('Unsaved latest paragraph');
    const renamedDirectory = uiPage.getByRole('treeitem', {
      name: '进入目录 renamed',
      exact: true,
    });
    if ((await renamedDirectory.getAttribute('aria-expanded')) !== 'true')
      await renamedDirectory.click();
    await uiPage
      .getByRole('treeitem', { name: '打开文件 renamed/draft.md', exact: true })
      .click({ button: 'right' });
    await uiPage
      .getByRole('menu', { name: '文件操作菜单', exact: true })
      .getByRole('button', { name: '回收', exact: true })
      .click();
    await uiPage.getByRole('button', { name: '确认回收', exact: true }).click();
    await expect(uiPage.getByRole('alert').filter({ hasText: '回收' }).first()).toBeVisible();
    await uiPage.getByText('回收站', { exact: true }).click();
    await uiPage
      .getByLabel('恢复位置 renamed/draft.md', { exact: true })
      .fill('recovered/draft.md');
    await uiPage.getByRole('button', { name: '恢复 renamed/draft.md', exact: true }).click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 recovered/draft.md', exact: true }),
    ).toContainText('Unsaved latest paragraph');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).first().click();
    await expect
      .poll(() => readFile(join(project, 'recovered', 'draft.md'), 'utf8'))
      .toContain('Unsaved latest paragraph');
    await uiPage.getByLabel('管理项目 project', { exact: true }).click();
    await uiPage.getByLabel('项目显示名', { exact: true }).fill('Renamed workbench');
    await uiPage.getByRole('button', { name: '保存显示名', exact: true }).click();
    await expect(
      uiPage.getByRole('button', { name: 'Renamed workbench，已展开', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('button', { name: '移出最近列表', exact: true }).click();
    await uiPage.getByRole('button', { name: '确认移出', exact: true }).click();
    await expect(
      uiPage.getByRole('button', { name: '普通会话，已展开', exact: true }),
    ).toBeVisible();
    await addProject(uiPage, project);
    await expect(
      uiPage.getByRole('button', { name: 'Renamed workbench，已展开', exact: true }),
    ).toBeVisible();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 recovered/draft.md', exact: true }),
    ).toContainText('Unsaved latest paragraph');
    await expect(preview).toContainText('Unsaved latest paragraph');
    expect(errors).toEqual([]);
  } finally {
    await stop();
    await model.close();
    await rm(root, { recursive: true });
  }
});
