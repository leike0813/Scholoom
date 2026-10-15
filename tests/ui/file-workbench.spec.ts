import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { expect, test } from './fixture.js';
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
    await uiPage.getByText('新建项目', { exact: true }).click();
    await uiPage.getByLabel('新建项目目录', { exact: true }).fill(project);
    await uiPage.getByLabel('新建项目显示名', { exact: true }).fill('File workbench');
    await uiPage.getByRole('button', { name: '创建项目', exact: true }).click();
    await expect(uiPage.getByRole('combobox', { name: '当前项目' })).toContainText(
      'File workbench',
    );
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
    await uiPage.getByLabel('新建目录名', { exact: true }).fill('notes');
    await uiPage.getByRole('button', { name: '新建目录', exact: true }).click();
    await uiPage.getByRole('button', { name: '进入目录 notes', exact: true }).click();
    await uiPage.getByLabel('新文件名', { exact: true }).fill('draft.md');
    await uiPage.getByRole('button', { name: '新建文件', exact: true }).click();
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
    await editor.fill(content);
    await uiPage.getByRole('button', { name: '并排预览', exact: true }).click();
    await armRpcGate(uiPage, 'files.read');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).first().click();
    await expect
      .poll(() => readFile(join(project, 'notes', 'draft.md'), 'utf8').catch(() => ''))
      .toBe(content);
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await editor.fill(`${content}\nUnsaved latest paragraph.`);
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
    const cancelStart = Date.now();
    await uiPage.getByRole('button', { name: '取消执行', exact: true }).click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('已取消');
    const cancelLatency = Date.now() - cancelStart;
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
    await uiPage.getByRole('button', { name: '进入目录 notes', exact: true }).click();
    await uiPage.getByLabel('新名称', { exact: true }).fill('renamed');
    await uiPage.getByRole('button', { name: '重命名', exact: true }).click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 renamed/draft.md', exact: true }),
    ).toContainText('Unsaved latest paragraph');
    await expect(preview).toContainText('Unsaved latest paragraph');
    await uiPage.getByRole('button', { name: '进入目录 renamed', exact: true }).click();
    await uiPage.getByRole('button', { name: '回收', exact: true }).click();
    await uiPage.getByRole('button', { name: '确认回收', exact: true }).click();
    await expect(uiPage.getByRole('alert').filter({ hasText: '回收' }).first()).toBeVisible();
    await uiPage.getByText('回收站', { exact: true }).click();
    await uiPage.getByLabel('恢复位置 renamed', { exact: true }).fill('recovered');
    await uiPage.getByRole('button', { name: '恢复', exact: true }).click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 recovered/draft.md', exact: true }),
    ).toContainText('Unsaved latest paragraph');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).first().click();
    await expect
      .poll(() => readFile(join(project, 'recovered', 'draft.md'), 'utf8'))
      .toContain('Unsaved latest paragraph');
    await uiPage.getByText('当前项目设置', { exact: true }).click();
    await uiPage.getByLabel('项目显示名', { exact: true }).fill('Renamed workbench');
    await uiPage.getByRole('button', { name: '保存显示名', exact: true }).click();
    await expect(uiPage.getByRole('combobox', { name: '当前项目' })).toContainText(
      'Renamed workbench',
    );
    await uiPage.getByRole('button', { name: '移出最近列表', exact: true }).click();
    await expect(uiPage.getByRole('combobox', { name: '当前项目' })).not.toContainText(
      'Renamed workbench',
    );
    await uiPage.getByText('打开项目', { exact: true }).click();
    await uiPage.getByLabel('项目目录', { exact: true }).fill(project);
    await uiPage.getByRole('button', { name: '打开目录', exact: true }).click();
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
