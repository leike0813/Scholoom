import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { addProject, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('manual PDF previews and exports use saved Quarto and native multi-file TeX', async ({
  uiPage,
}, info) => {
  test.setTimeout(240000);
  const root = test.info().outputPath('fixture-root');
  await mkdir(root, { recursive: true });
  let currentPath = '';
  const requests = new Map<string | number, { path: string; method: string; params: unknown }>();
  const diagnostics: unknown[] = [];
  const phases = new Map<string, unknown>();
  let tools: unknown;
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  const record = (value: unknown) => {
    diagnostics.push(value);
    if (diagnostics.length > 100) diagnostics.shift();
  };
  uiPage.on('websocket', (socket) => {
    socket.on('framesent', ({ payload }) => {
      const frame = JSON.parse(String(payload));
      if (
        [
          'editor.tools',
          'editor.render',
          'editor.job',
          'editor.output',
          'resources.describe',
          'resources.read',
        ].includes(frame.method)
      ) {
        requests.set(frame.id, { path: currentPath, method: frame.method, params: frame.params });
        record({ request: requests.get(frame.id) });
      }
    });
    socket.on('framereceived', ({ payload }) => {
      const frame = JSON.parse(String(payload));
      const request = requests.get(frame.id);
      if (request) {
        const result = frame.result;
        const entry = {
          request,
          result:
            result && typeof result === 'object'
              ? { ...result, base64: undefined, data: undefined }
              : result,
          error: frame.error,
        };
        record(entry);
        phases.set(`${request.path}:${request.method}`, entry);
        requests.delete(frame.id);
      }
    });
  });
  uiPage.on('pageerror', (error) => record({ path: currentPath, rendererError: error.message }));
  try {
    await client.connect();
    tools = await client.call('editor.tools', {});
    const project = join(root, 'project');
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project, { mode: 'create' });
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('项目权限与备份', { exact: true }).click();
    await uiPage.getByRole('checkbox', { name: /^信任项目/ }).check();
    await uiPage.getByRole('button', { name: '保存项目授权', exact: true }).click();
    await mkdir(join(project, 'chapters'));
    await writeFile(
      join(project, 'paper.qmd'),
      '# Manual Quarto\n\nA saved result with $E=mc^2$.\n',
    );
    await writeFile(
      join(project, 'main.tex'),
      '\\documentclass{article}\n\\begin{document}\n\\input{chapters/result}\n\\end{document}\n',
    );
    await writeFile(
      join(project, 'chapters/result.tex'),
      '\\section{Native evidence}\nA multi-file result.\n',
    );
    const render = uiPage.getByRole('region', { name: '完整排版预览', exact: true });
    for (const [path, destination] of [
      ['paper.qmd', 'quarto.pdf'],
      ['main.tex', 'native.pdf'],
    ] as const) {
      currentPath = path;
      await uiPage.getByRole('treeitem', { name: `打开文件 ${path}`, exact: true }).dblclick();
      await uiPage.getByRole('button', { name: '完整排版', exact: true }).click();
      if (path.endsWith('.qmd'))
        await render.getByLabel('预览格式', { exact: true }).selectOption('pdf');
      await expect(render.getByRole('region', { name: '排版 PDF', exact: true })).toBeVisible({
        timeout: 60000,
      });
      await expect(render.getByRole('status', { name: '排版状态' })).toContainText('编译完成');
      await render.getByRole('button', { name: '导出文件', exact: true }).click();
      const dialog = uiPage.getByRole('dialog', { name: '导出稿件', exact: true });
      if (path.endsWith('.qmd'))
        await dialog.getByLabel('导出格式', { exact: true }).selectOption('pdf');
      await dialog.getByLabel('导出项目内路径', { exact: true }).fill(destination);
      await dialog.getByRole('button', { name: '生成并导出', exact: true }).click();
      await expect(dialog.getByRole('status')).toContainText('导出完成', { timeout: 60000 });
      expect((await readFile(join(project, destination))).subarray(0, 5).toString()).toBe('%PDF-');
      await dialog.getByRole('button', { name: '关闭导出稿件', exact: true }).click();
    }
  } finally {
    client.dispose();
    const diagnosticsPath = info.outputPath('pdf-preview-diagnostics.json');
    await writeFile(
      diagnosticsPath,
      JSON.stringify(
        {
          path: currentPath,
          tools,
          phases: [...phases.values()],
          diagnostics,
          pending: [...requests.values()],
        },
        null,
        2,
      ),
    );
    await info.attach('pdf-preview-diagnostics', {
      path: diagnosticsPath,
      contentType: 'application/json',
    });
  }
});
