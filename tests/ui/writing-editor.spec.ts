import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addProject, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('scientific writing shares visual and source drafts and renders saved content', async ({
  uiPage,
}, info) => {
  test.setTimeout(180000);
  const root = test.info().outputPath('fixture-root');
  await mkdir(root, { recursive: true });
  const project = join(root, 'project');
  const errors: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  await uiPage.goto(rendererUrl);
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await addProject(uiPage, project, { mode: 'create' });
  const original =
    '---\ntitle: Writing evidence\nbibliography: refs.bib\n---\n\n# Findings {#sec-findings}\n\nA stable result with $E=mc^2$ and [@sample2026, pp. 10-12; @second2026, p. 3].\n\n| Method | Value |\n|---|---|\n| A | 42 |\n';
  await writeFile(
    join(project, 'refs.bib'),
    '@article{sample2026,title={Independent Evidence},author={Smith, Jane},year={2026}}\n@book{second2026,title={Second Evidence},author={Jones, Alex},year={2026}}\n',
  );
  await writeFile(
    join(project, 'chart.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  await writeFile(join(project, 'main.qmd'), original);
  await uiPage.getByRole('treeitem', { name: '打开文件 main.qmd', exact: true }).dblclick();
  const source = () => uiPage.getByRole('textbox', { name: '文件内容 main.qmd', exact: true });
  await expect(source()).toContainText('stable result');
  await uiPage.getByRole('button', { name: '查找与替换', exact: true }).click();
  await expect(uiPage.locator('.cm-search')).toBeVisible();
  await uiPage.getByRole('button', { name: '关闭查找', exact: true }).click();
  await uiPage.getByLabel('跳转到行号', { exact: true }).fill('7');
  await uiPage.getByRole('button', { name: '跳转到指定行', exact: true }).click();
  await expect(uiPage.getByRole('status', { name: '编辑器状态' })).toContainText('行 7');
  await uiPage.getByRole('button', { name: '可视编辑', exact: true }).click();
  const visual = uiPage.getByRole('region', { name: '可视编辑器', exact: true });
  const prose = visual.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(prose).toContainText('stable result', { timeout: 45000 });
  await expect(prose.locator('table')).toContainText('42');
  await prose.press('ControlOrMeta+End');
  await prose.press('Enter');
  await uiPage.keyboard.insertText('Recovered after immediate reload.');
  await uiPage.reload();
  await uiPage.getByRole('treeitem', { name: '打开文件 main.qmd', exact: true }).dblclick();
  await uiPage.getByRole('button', { name: '可视编辑', exact: true }).click();
  await expect(prose).toContainText('Recovered after immediate reload.', { timeout: 45000 });
  await prose.click();
  await prose.press('ControlOrMeta+End');
  await prose.press('Enter');
  await uiPage.keyboard.insertText('Visual latest paragraph.');
  await visual.getByRole('button', { name: '插入表格', exact: true }).click();
  let academicDialog = uiPage.getByRole('dialog');
  await academicDialog.getByLabel('行数', { exact: true }).fill('2');
  await academicDialog.getByLabel('列数', { exact: true }).fill('2');
  await academicDialog.getByLabel('标题', { exact: true }).fill('Evidence table');
  await academicDialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(prose.locator('table')).toHaveCount(2);
  await prose.press('ControlOrMeta+End');
  await prose.press('Enter');
  await visual.getByRole('button', { name: '引文', exact: true }).click();
  academicDialog = uiPage.getByRole('dialog');
  await academicDialog
    .getByRole('listitem')
    .filter({ hasText: 'Independent Evidence' })
    .getByRole('button', { name: '+', exact: true })
    .click();
  await academicDialog.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(academicDialog).toBeHidden();
  await prose.press('ControlOrMeta+End');
  await uiPage.keyboard.insertText(' See ');
  await visual.getByRole('button', { name: '交叉引用', exact: true }).click();
  academicDialog = uiPage.getByRole('dialog');
  await expect(academicDialog).toContainText('Findings');
  await academicDialog.getByRole('listitem').filter({ hasText: 'Findings' }).click();
  await academicDialog.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(academicDialog).toBeHidden();
  await prose.press('ControlOrMeta+End');
  await prose.press('Enter');
  await visual.getByRole('button', { name: '图片', exact: true }).click();
  academicDialog = uiPage.getByRole('dialog');
  await academicDialog.getByLabel('项目内相对路径', { exact: true }).fill('chart.png');
  await academicDialog.getByLabel('替代文字', { exact: true }).fill('Fixture chart');
  await academicDialog.getByRole('button', { name: '确定', exact: true }).click();
  // Immediately switch modes: this must wait for the asynchronous Pandoc writeback.
  await uiPage.getByRole('button', { name: '源码', exact: true }).click();
  await expect(source()).toContainText('Visual latest paragraph.');
  await expect(source()).toContainText('sample2026');
  await expect(source()).toContainText('second2026');
  await expect(source()).toContainText('10-12');
  await expect(source()).toContainText('E=mc^2');
  await expect(source()).toContainText('@sec-findings');
  await expect(source()).toContainText('chart.png');
  await expect(source()).toContainText('Fixture chart');
  await uiPage.getByRole('button', { name: '保存文件', exact: true }).first().click();
  await expect
    .poll(() => readFile(join(project, 'main.qmd'), 'utf8'))
    .toContain('Visual latest paragraph.');
  await uiPage.getByRole('button', { name: '并排排版', exact: true }).click();
  const render = uiPage.getByRole('region', { name: '完整排版预览', exact: true });
  await expect(render.getByRole('status', { name: '排版状态' })).toContainText('编译完成', {
    timeout: 60000,
  });
  const preview = uiPage.frameLocator('iframe[title="HTML 排版预览"]');
  await expect(preview.getByText('Visual latest paragraph.', { exact: true })).toBeVisible();
  const bibliography = await readFile(join(project, 'refs.bib'), 'utf8');
  await writeFile(join(project, 'refs.bib'), bibliography.replace('year={2026}', 'year={2027}'));
  await expect(preview.getByText(/Smith 2027/).first()).toBeVisible({ timeout: 60000 });
  await source().press('ControlOrMeta+End');
  await uiPage.keyboard.insertText('\nUnsaved source only.');
  await expect(render.getByRole('status', { name: '排版状态' })).toContainText('有未保存草稿');
  await expect(preview.getByText('Unsaved source only.', { exact: true })).toHaveCount(0);
  await uiPage.screenshot({
    path: info.outputPath('writing-editor-light.png'),
    animations: 'disabled',
  });
  await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
  await uiPage.getByRole('button', { name: '切换主题', exact: true }).click();
  await uiPage.screenshot({
    path: info.outputPath('writing-editor-dark.png'),
    animations: 'disabled',
  });
  await uiPage.getByRole('button', { name: '导出文件', exact: true }).click();
  const exportDialog = uiPage.getByRole('dialog', { name: '导出稿件', exact: true });
  await exportDialog.getByLabel('导出格式', { exact: true }).selectOption('docx');
  await exportDialog.getByLabel('导出项目内路径', { exact: true }).fill('delivered.docx');
  await exportDialog.getByRole('button', { name: '生成并导出', exact: true }).click();
  await expect(exportDialog.getByRole('status')).toContainText('导出完成', { timeout: 60000 });
  expect((await readFile(join(project, 'delivered.docx'))).subarray(0, 2).toString()).toBe('PK');
  await exportDialog.getByRole('button', { name: '关闭导出稿件', exact: true }).click();
  const unsupported = '(@) First example\n\n(@) Second example\n';
  await writeFile(join(project, 'unsupported.qmd'), unsupported);
  await uiPage.getByRole('treeitem', { name: '打开文件 unsupported.qmd', exact: true }).dblclick();
  const writingGroup = uiPage.getByRole('region', { name: '标签组 1', exact: true });
  await writingGroup.getByRole('button', { name: '可视编辑', exact: true }).click();
  await expect(visual.getByRole('alert')).toContainText('无损');
  await expect(visual.locator('.ProseMirror').first()).toHaveAttribute('contenteditable', 'false');
  await writingGroup.getByRole('button', { name: '源码', exact: true }).click();
  await expect(
    uiPage.getByRole('textbox', { name: '文件内容 unsupported.qmd', exact: true }),
  ).toContainText('First example');
  expect(await readFile(join(project, 'unsupported.qmd'), 'utf8')).toBe(unsupported);
  expect(errors).toEqual([]);
});
