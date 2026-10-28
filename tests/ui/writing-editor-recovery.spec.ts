import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addProject, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('visual editor protects external loads and recovers drafts after conversion failure', async ({
  uiPage,
}) => {
  test.setTimeout(180000);
  const root = test.info().outputPath('fixture-root');
  await mkdir(root, { recursive: true });
  const project = join(root, 'project');
  const original = '# Recovery source\n\nOriginal saved paragraph.\n';

  await installRpcGate(uiPage);
  await uiPage.goto(rendererUrl);
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await addProject(uiPage, project, { mode: 'create' });
  await writeFile(join(project, 'draft.md'), original);
  const openDraft = () =>
    uiPage.getByRole('treeitem', { name: '打开文件 draft.md', exact: true }).dblclick();
  await openDraft();
  await uiPage.getByRole('button', { name: '可视编辑', exact: true }).click();
  const visual = uiPage.getByRole('region', { name: '可视编辑器', exact: true });
  const prose = visual.locator('.ProseMirror').first();
  await expect(prose).toContainText('Original saved paragraph.', { timeout: 45000 });
  await expect(prose).toHaveAttribute('contenteditable', 'true');

  await armRpcGate(uiPage, 'editor.convert');
  const external = '# Externally updated\n\nNew content from disk.\n';
  await writeFile(join(project, 'draft.md'), external);
  await uiPage.getByRole('button', { name: '重新读取', exact: true }).click();
  await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
  await expect(prose).toHaveAttribute('contenteditable', 'false');
  await releaseRpcGate(uiPage);
  await expect(prose).toContainText('New content from disk.');
  await expect(prose).toHaveAttribute('contenteditable', 'true');

  await prose.click();
  await prose.press('ControlOrMeta+End');
  await prose.press('Enter');
  await armRpcGate(uiPage, 'editor.convert');
  await uiPage.keyboard.insertText('Latest visual draft survives failure.');
  await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
  await uiPage.reload();
  await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await openDraft();
  await uiPage.getByRole('button', { name: '可视编辑', exact: true }).click();
  const reopened = uiPage.getByRole('region', { name: '可视编辑器', exact: true });
  await expect(reopened.locator('.ProseMirror').first()).toContainText(
    'Latest visual draft survives failure.',
    { timeout: 45000 },
  );
  expect(await readFile(join(project, 'draft.md'), 'utf8')).toBe(external);

  await expect(reopened.locator('.ProseMirror').first()).toHaveAttribute('contenteditable', 'true');
  await reopened.locator('.ProseMirror').first().press('ControlOrMeta+End');
  await reopened.locator('.ProseMirror').first().press('Enter');
  await armRpcGate(uiPage, 'editor.convert');
  await uiPage.keyboard.insertText('Recovered after failed project switch.');
  await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
  await addProject(uiPage, join(root, 'other'), { mode: 'create' });
  await releaseRpcGate(uiPage, true);
  await addProject(uiPage, project);
  await openDraft();
  await uiPage.getByRole('button', { name: '可视编辑', exact: true }).click();
  await expect(prose).toContainText('Recovered after failed project switch.', { timeout: 45000 });
  await expect(prose).toHaveAttribute('contenteditable', 'true');
  expect(await readFile(join(project, 'draft.md'), 'utf8')).toBe(external);
});
