import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, tmpdir, totalmem } from 'node:os';
import { basename, join } from 'node:path';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, cancelProjectOnboarding, createSession, expect, test } from './fixture.js';

async function openProject(page: Parameters<typeof addProject>[0], project: string) {
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  await page.goto('http://127.0.0.1:5174/');
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await addProject(page, project);
  return { model, stop };
}

test('file tabs replace previews, pin edited files, and tree copy preserves disk contents', async ({
  uiPage,
}, info) => {
  const project = await mkdtemp(join(tmpdir(), 'scholoom-explorer-tabs-'));
  const a = '# A\n';
  const b = '# B\n';
  const c = '# C\n';
  await mkdir(join(project, 'destination'));
  await Promise.all([
    writeFile(join(project, 'A.md'), a),
    writeFile(join(project, 'B.md'), b),
    writeFile(join(project, 'C.md'), c),
  ]);
  const { model, stop } = await openProject(uiPage, project);
  const file = (name: string) =>
    uiPage.getByRole('treeitem', { name: `打开文件 ${name}`, exact: true });
  try {
    if (info.project.name === 'ui-browser')
      await uiPage.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: 'http://127.0.0.1:5174',
      });
    await file('A.md').click();
    await file('B.md').click();
    await expect(uiPage.getByRole('textbox', { name: '文件内容 B.md', exact: true })).toContainText(
      b,
    );
    const editorB = uiPage.getByRole('textbox', { name: '文件内容 B.md', exact: true });
    await editorB.fill(`${b}草稿`);
    await file('C.md').click();
    await expect(uiPage.getByRole('textbox', { name: '文件内容 C.md', exact: true })).toContainText(
      c,
    );
    await file('C.md').dblclick();
    await uiPage.getByRole('tab', { name: /^B\.md/ }).click();
    await expect(editorB).toContainText('草稿');

    const rowA = file('A.md');
    await rowA.focus();
    await rowA.press('c');
    await expect(file('C.md')).toBeFocused();
    await rowA.focus();
    await rowA.press('F2');
    const rename = uiPage.getByLabel('新名称', { exact: true });
    await rename.fill('A-renamed.md');
    await rename.press('Enter');
    await expect.poll(() => readFile(join(project, 'A-renamed.md'), 'utf8')).toBe(a);

    const rowB = file('B.md');
    await rowB.click();
    await file('C.md').click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
    await uiPage.keyboard.press('ControlOrMeta+c');
    const destination = uiPage.getByRole('treeitem', { name: '进入目录 destination', exact: true });
    await destination.click();
    await destination.press('ControlOrMeta+v');
    await expect
      .poll(() => readFile(join(project, 'destination', 'B.md'), 'utf8').catch(() => ''))
      .toBe(b);
    await expect
      .poll(() => readFile(join(project, 'destination', 'C.md'), 'utf8').catch(() => ''))
      .toBe(c);
    await expect(model.requests).toHaveLength(0);
  } finally {
    await stop();
    await model.close();
    await rm(project, { recursive: true });
  }
});

test('file import and folder drag-in write selected bytes and relative paths', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const project = await mkdtemp(join(tmpdir(), 'scholoom-explorer-import-'));
  const importSource = await mkdtemp(join(tmpdir(), 'scholoom-explorer-import-source-'));
  const bytes = Buffer.alloc(2 * 1024 * 1024 + 37, 0xa5);
  bytes.set([0, 255, 4, 0, 128, 42]);
  await mkdir(join(project, 'source'));
  await mkdir(join(project, 'destination'));
  await writeFile(join(project, 'source', 'nested.bin'), bytes);
  await mkdir(join(importSource, 'folder'));
  await writeFile(join(importSource, 'folder', 'nested.bin'), bytes);
  const { model, stop } = await openProject(uiPage, project);
  try {
    await uiPage.getByRole('button', { name: '文件操作', exact: true }).click();
    const fileChooser = uiPage.waitForEvent('filechooser');
    await uiPage
      .getByRole('menu', { name: '文件操作菜单', exact: true })
      .getByRole('button', { name: '导入文件…', exact: true })
      .click();
    await (await fileChooser).setFiles({
      name: 'binary.dat',
      mimeType: 'application/octet-stream',
      buffer: bytes,
    });
    await expect
      .poll(() => readFile(join(project, 'binary.dat')).catch(() => undefined))
      .toEqual(bytes);

    await uiPage.getByRole('button', { name: '文件操作', exact: true }).click();
    const directoryChooser = uiPage.waitForEvent('filechooser');
    await uiPage
      .getByRole('menu', { name: '文件操作菜单', exact: true })
      .getByRole('button', { name: '导入目录…', exact: true })
      .click();
    await (await directoryChooser).setFiles(importSource);
    await expect
      .poll(() =>
        readFile(join(project, basename(importSource), 'folder', 'nested.bin')).catch(
          () => undefined,
        ),
      )
      .toEqual(bytes);

    const destination = uiPage.getByRole('treeitem', {
      name: '进入目录 destination',
      exact: true,
    });
    await destination.click();
    await uiPage
      .getByRole('treeitem', { name: '进入目录 source', exact: true })
      .dragTo(destination);
    await expect
      .poll(() =>
        readFile(join(project, 'destination', 'source', 'nested.bin')).catch(() => undefined),
      )
      .toEqual(bytes);
  } finally {
    await stop();
    await model.close();
    await rm(project, { recursive: true });
    await rm(importSource, { recursive: true });
  }
});

test('refresh reflects files added and atomically replaced outside the workbench', async ({
  uiPage,
}) => {
  const project = await mkdtemp(join(tmpdir(), 'scholoom-explorer-refresh-'));
  const target = join(project, 'external.md');
  const replacement = join(project, '.replacement');
  await writeFile(target, 'before');
  const { model, stop } = await openProject(uiPage, project);
  try {
    await expect(
      uiPage.getByRole('treeitem', { name: '打开文件 external.md', exact: true }),
    ).toBeVisible();
    await writeFile(join(project, 'outside.md'), 'new external file');
    await writeFile(replacement, 'atomic replacement');
    await rename(replacement, target);
    await expect(
      uiPage.getByRole('treeitem', { name: '打开文件 outside.md', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('treeitem', { name: '打开文件 external.md', exact: true }).click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 external.md', exact: true }),
    ).toContainText('atomic replacement');
    await writeFile(replacement, 'second replacement');
    await rename(replacement, target);
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 external.md', exact: true }),
    ).toContainText('second replacement');
    await uiPage.getByRole('button', { name: '刷新文件', exact: true }).click();
  } finally {
    await stop();
    await model.close();
    await rm(project, { recursive: true });
  }
});

test('keyboard cut crosses projects and replacement keeps the prior target recoverable', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-explorer-cross-'));
  const source = join(root, 'source');
  const target = join(root, 'target');
  await mkdir(source);
  await mkdir(target);
  await writeFile(join(source, 'note.md'), 'source-body');
  await writeFile(join(target, 'note.md'), 'prior-target');
  const { model, stop } = await openProject(uiPage, source);
  try {
    const row = uiPage.getByRole('treeitem', { name: '打开文件 note.md', exact: true });
    await expect(row).toBeVisible();
    await uiPage.getByRole('button', { name: '文件操作', exact: true }).focus();
    await uiPage.keyboard.press('Tab');
    await expect(row).toBeFocused();
    await row.press('ControlOrMeta+x');
    await addProject(uiPage, target);
    await row.focus();
    await row.press('ControlOrMeta+v');
    const progress = uiPage.getByRole('region', { name: '文件传输', exact: true });
    await expect(progress).toContainText('目标已存在');
    await progress.getByRole('button', { name: '回收原目标并替换', exact: true }).click();
    expect(await readFile(join(target, 'note.md'), 'utf8')).toBe('prior-target');
    await uiPage.getByRole('button', { name: '确认替换', exact: true }).click();
    await expect
      .poll(() => readFile(join(target, 'note.md'), 'utf8').catch(() => undefined))
      .toBe('source-body');
    await expect
      .poll(() => readFile(join(source, 'note.md'), 'utf8').catch((error) => error.code))
      .toBe('ENOENT');
    await uiPage.getByText('回收站', { exact: true }).click();
    await uiPage.getByLabel('恢复位置 note.md', { exact: true }).fill('recovered.md');
    await uiPage.getByRole('button', { name: '恢复 note.md', exact: true }).click();
    await expect
      .poll(() => readFile(join(target, 'recovered.md'), 'utf8').catch(() => undefined))
      .toBe('prior-target');
    expect(model.requests).toHaveLength(0);
  } finally {
    await stop();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('ten thousand loaded rows stay windowed and respond while binary import is active', async ({
  uiPage,
}, info) => {
  test.setTimeout(180000);
  const project = await mkdtemp(join(tmpdir(), 'scholoom-explorer-load-'));
  const importSource = await mkdtemp(join(tmpdir(), 'scholoom-explorer-large-source-'));
  const largeFile = join(importSource, 'load.bin');
  await writeFile(largeFile, Buffer.alloc(32 * 1024 * 1024, 0x5a));
  await mkdir(join(project, 'many'));
  for (let index = 0; index < 10000; index += 100)
    await Promise.all(
      Array.from({ length: 100 }, (_, offset) =>
        writeFile(join(project, 'many', `item-${index + offset}.md`), 'x'),
      ),
    );
  const { model, stop } = await openProject(uiPage, project);
  try {
    const tree = uiPage.getByRole('tree', { name: '项目文件树' });
    await tree.getByRole('treeitem', { name: '进入目录 many', exact: true }).click();
    await expect(
      tree.getByRole('treeitem', { name: '打开文件 many/item-0.md', exact: true }),
    ).toBeVisible();
    for (let page = 1; page < 100; page++) {
      await tree.press('End');
      const more = tree.getByRole('treeitem', { name: '更多文件 many', exact: true });
      await expect(more).toBeFocused();
      await more.click();
      await expect(
        tree.getByRole('treeitem', { name: `打开文件 many/item-${page * 100}.md`, exact: true }),
      ).toBeVisible();
    }
    await tree.press('End');
    await expect(
      tree.getByRole('treeitem', { name: '打开文件 many/item-9999.md', exact: true }),
    ).toBeFocused();
    const dimensions = await tree.evaluate((node) => ({
      height: node.clientHeight,
      row: Number.parseFloat(getComputedStyle(node).getPropertyValue('--file-tree-row-height')),
      count: node.querySelectorAll('[role="treeitem"]').length,
    }));
    expect(dimensions.count).toBeLessThanOrEqual(
      Math.ceil(dimensions.height / dimensions.row) + 12,
    );
    await uiPage.getByRole('button', { name: '刷新文件', exact: true }).click();
    await tree.press('End');
    await expect(
      tree.getByRole('treeitem', { name: '打开文件 many/item-9999.md', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-performance-key');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await createSession(uiPage, basename(project));
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill('MODEL_STREAM');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length).toBe(1);
    await uiPage.getByRole('button', { name: basename(project), exact: true }).click();
    await uiPage.getByLabel('导入文件', { exact: true }).setInputFiles(largeFile);
    await expect(uiPage.getByRole('region', { name: '文件传输' })).toContainText('上传中');
    await tree.press('Home');
    await expect(tree.getByRole('treeitem', { name: '进入目录 many', exact: true })).toBeFocused();
    const sample = await tree.evaluate(async (node) => {
      const durations: number[] = [];
      let active = 0;
      let simultaneous = 0;
      const initial = node.querySelector('[tabindex="0"]')?.getAttribute('data-file-path');
      for (let index = 0; index < 60; index++) {
        if (/上传中|传输中/.test(document.querySelector('.explorer-transfer')?.textContent ?? '')) {
          active++;
          if (
            /执行中/.test(
              document.querySelector('[role="status"][aria-label="执行状态"]')?.textContent ?? '',
            )
          )
            simultaneous++;
        }
        const begin = performance.now();
        const before = document.activeElement?.getAttribute('data-file-path');
        node.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }),
        );
        await new Promise<void>((resolve, reject) => {
          const check = () => {
            if (document.activeElement?.getAttribute('data-file-path') !== before) resolve();
            else if (performance.now() - begin > 1000)
              reject(new Error('Keyboard focus did not advance'));
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
        node.dispatchEvent(
          new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }),
        );
        durations.push(performance.now() - begin);
      }
      durations.sort((a, b) => a - b);
      return {
        durations,
        p95: durations[Math.ceil(durations.length * 0.95) - 1] ?? 0,
        active,
        simultaneous,
        rendered: node.querySelectorAll('[role="treeitem"]').length,
        initial,
        final: node.querySelector('[tabindex="0"]')?.getAttribute('data-file-path'),
      };
    });
    const evidence = info.outputPath('file-tree-performance.json');
    await writeFile(
      evidence,
      JSON.stringify(
        {
          host: info.project.name,
          node: process.version,
          platform: platform(),
          arch: arch(),
          cpu: cpus()[0]?.model,
          memory: totalmem(),
          loadedRows: 10000,
          ...dimensions,
          ...sample,
        },
        null,
        2,
      ),
    );
    await info.attach('file-tree-performance', {
      path: evidence,
      contentType: 'application/json',
    });
    expect(sample.active).toBeGreaterThan(0);
    expect(sample.simultaneous).toBeGreaterThan(0);
    expect(sample.final).not.toBe(sample.initial);
    expect(sample.p95).toBeLessThanOrEqual(100);
    expect(sample.rendered).toBeLessThanOrEqual(Math.ceil(dimensions.height / dimensions.row) + 12);
    await expect
      .poll(
        () =>
          readFile(join(project, 'load.bin'))
            .then((bytes) => bytes.length)
            .catch(() => 0),
        { timeout: 30000 },
      )
      .toBe(32 * 1024 * 1024);
    expect(model.requests).toHaveLength(1);
  } finally {
    await stop();
    await model.close();
    await rm(project, { recursive: true });
    await rm(importSource, { recursive: true });
  }
});

test('cancelling project trust does not create or register a project', async ({ uiPage }) => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-cancel-project-ui-'));
  const project = join(root, 'not-created');
  try {
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await cancelProjectOnboarding(uiPage, project, { mode: 'create' });
    await expect
      .poll(() =>
        access(project).then(
          () => true,
          () => false,
        ),
      )
      .toBe(false);
    await expect(
      uiPage.getByRole('button', { name: 'not-created，已展开', exact: true }),
    ).toHaveCount(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
