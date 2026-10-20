import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addProject, expect, test } from './fixture.js';

test('manual PDF previews and exports use saved Quarto and native multi-file TeX', async ({
  uiPage,
}) => {
  test.setTimeout(240000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-writing-pdf-ui-'));
  try {
    const project = join(root, 'project');
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project, { mode: 'create' });
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('项目权限与备份', { exact: true }).click();
    await uiPage.getByLabel('读取项目材料', { exact: true }).check();
    await uiPage
      .getByLabel('新建、修改、重命名和回收／恢复项目文件及目录', { exact: true })
      .check();
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
    await rm(root, { recursive: true, force: true });
  }
});
