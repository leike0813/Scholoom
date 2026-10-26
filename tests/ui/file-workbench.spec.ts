import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('project files share draft preview and survive directory rename, trash and recovery', async ({
  uiPage,
}, info) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-ui-'));
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  const project = join(root, 'project');
  const errors: string[] = [];
  const external: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  uiPage.on('request', (request) => {
    if (request.url().includes('untrusted.example')) external.push(request.url());
  });
  try {
    await installRpcGate(uiPage);
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project, { mode: 'create' });
    const { id: projectId } = await client.call('project.open', { path: project });
    const projectGroup = uiPage.locator(`[data-project-id="${projectId}"]`);
    await mkdir(join(project, 'recovered'));
    await expect(
      projectGroup.getByRole('button', { name: 'project，已展开', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-preview-key');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
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
    await expect(editor).toHaveAttribute('contenteditable', 'true');
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
    await armRpcGate(uiPage, 'resources.read');
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
    await createSession(uiPage, { projectId });
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
    await projectGroup.getByLabel('管理项目 project', { exact: true }).click();
    const projectMenu = uiPage.getByRole('menu', { name: '管理项目 project', exact: true });
    await expect(projectMenu.getByRole('textbox')).toHaveCount(0);
    await uiPage.getByRole('button', { name: '从侧栏移除', exact: true }).click();
    await armRpcGate(uiPage, 'project.forget');
    await uiPage.getByRole('button', { name: '确认移出', exact: true }).click();
    await expect(uiPage.getByRole('button', { name: '确认移出', exact: true })).toBeDisabled();
    await releaseRpcGate(uiPage, true);
    await expect(projectMenu).toBeVisible();
    await expect(projectMenu.getByRole('alert')).toBeVisible();
    await uiPage.getByRole('button', { name: '确认移出', exact: true }).click();
    await expect(
      uiPage.getByRole('button', { name: '普通会话，已展开', exact: true }),
    ).toBeVisible();
    await addProject(uiPage, project);
    await expect(
      projectGroup.getByRole('button', { name: 'project，已展开', exact: true }),
    ).toBeVisible();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 recovered/draft.md', exact: true }),
    ).toContainText('Unsaved latest paragraph');
    await expect(preview).toContainText('Unsaved latest paragraph');
    expect(errors).toEqual([]);
  } finally {
    client.dispose();
    await stop();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('resident project sessions switch files and preserve each project draft', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-multi-project-ui-'));
  const alpha = join(root, 'first', 'alpha');
  const beta = join(root, 'second', 'alpha');
  await mkdir(alpha, { recursive: true });
  await mkdir(beta, { recursive: true });
  await writeFile(join(alpha, 'alpha.md'), 'Alpha saved content');
  await writeFile(join(beta, 'beta.md'), 'Beta saved content');
  const model = await createModelServer();
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    const first = await client.call('project.open', { path: alpha, trust: 'trusted' });
    const second = await client.call('project.open', { path: beta, trust: 'trusted' });
    await client.call('session.create', { projectId: first.id, title: 'Alpha session' });
    await client.call('session.create', { projectId: second.id, title: 'Beta session' });

    await installRpcGate(uiPage);
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, alpha);
    await addProject(uiPage, beta);
    const alphaGroup = uiPage.locator(`[data-project-id="${first.id}"]`);
    const betaGroup = uiPage.locator(`[data-project-id="${second.id}"]`);
    const alphaSession = alphaGroup.getByRole('button', {
      name: '打开会话 Alpha session',
      exact: true,
    });
    const betaSession = betaGroup.getByRole('button', {
      name: '打开会话 Beta session',
      exact: true,
    });
    await expect(alphaSession).toBeVisible();
    await expect(betaSession).toBeVisible();
    await expect(uiPage.getByRole('button', { name: '新建会话', exact: true })).toHaveCount(0);
    await expect(uiPage.getByRole('button', { name: '开始新会话', exact: true })).toHaveCount(0);
    const alphaCreate = alphaGroup.getByRole('button', {
      name: '在alpha中新建会话',
      exact: true,
    });
    await armRpcGate(uiPage, 'session.create');
    await alphaCreate.click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await expect(alphaCreate).toBeDisabled();
    await betaSession.click();
    await expect(betaSession).toHaveAttribute('aria-pressed', 'true');
    await releaseRpcGate(uiPage);
    await expect
      .poll(
        async () => (await client.call('session.list', { projectId: first.id })).sessions.length,
      )
      .toBe(2);
    await expect(betaSession).toHaveAttribute('aria-pressed', 'true');
    expect((await client.call('session.list', { projectId: second.id })).sessions).toHaveLength(1);
    await expect(alphaCreate).toBeEnabled();
    await createSession(uiPage, { projectId: first.id });
    await expect(uiPage.getByLabel('执行上下文')).toContainText('项目：alpha');
    await expect
      .poll(
        async () => (await client.call('session.list', { projectId: first.id })).sessions.length,
      )
      .toBe(3);
    expect((await client.call('session.list', { projectId: second.id })).sessions).toHaveLength(1);
    const alphaProject = alphaGroup.getByRole('button', { name: /^alpha，/ });
    await alphaProject.click();
    await expect(alphaProject).toHaveAttribute('aria-expanded', 'false');
    await alphaProject.click();
    const menuButton = alphaGroup.getByRole('button', { name: '管理项目 alpha', exact: true });
    await menuButton.click();
    const menu = uiPage.getByRole('menu', { name: '管理项目 alpha', exact: true });
    await expect(menu).toContainText(alpha);
    await expect(menu.getByRole('button')).toHaveCount(2);
    await expect(menu.getByRole('textbox')).toHaveCount(0);
    await expect(menu.getByRole('button', { name: '打开项目', exact: true })).toBeFocused();
    await uiPage.keyboard.press('ArrowDown');
    await expect(menu.getByRole('button', { name: '从侧栏移除', exact: true })).toBeFocused();
    await uiPage.screenshot({
      path: test.info().outputPath('project-menu-light.png'),
      animations: 'disabled',
    });
    await uiPage.emulateMedia({ colorScheme: 'dark' });
    await uiPage.screenshot({
      path: test.info().outputPath('project-menu-dark.png'),
      animations: 'disabled',
    });
    await uiPage.emulateMedia({ colorScheme: 'light' });
    await uiPage.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    await expect(menu).toBeVisible();
    await menuButton.click();
    await expect(menu).toHaveCount(0);

    const viewport = await uiPage.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    await uiPage.setViewportSize({ width: viewport.width, height: 500 });
    await menuButton.click();
    await menu.getByRole('button', { name: '从侧栏移除', exact: true }).click();
    await expect(menu.getByRole('button', { name: '确认移出', exact: true })).toBeInViewport({
      ratio: 1,
    });
    await uiPage.screenshot({
      path: test.info().outputPath('project-menu-confirm-small-window.png'),
      animations: 'disabled',
    });
    await menu.getByRole('button', { name: '取消', exact: true }).click();
    await uiPage.keyboard.press('Escape');
    await uiPage.setViewportSize(viewport);

    await alphaSession.click();
    await expect(
      uiPage.getByRole('treeitem', { name: '打开文件 alpha.md', exact: true }),
    ).toBeVisible();
    await expect(
      uiPage.getByRole('treeitem', { name: '打开文件 beta.md', exact: true }),
    ).toHaveCount(0);
    await uiPage.getByRole('treeitem', { name: '打开文件 alpha.md', exact: true }).dblclick();
    const alphaEditor = uiPage.getByRole('textbox', { name: '文件内容 alpha.md', exact: true });
    await expect(alphaEditor).toContainText('Alpha saved content');
    await expect(uiPage.getByRole('tab', { name: /alpha\.md/ })).toBeVisible();
    await alphaEditor.fill('Alpha saved content\nAlpha draft');

    await betaSession.click();
    await expect(
      uiPage.getByRole('treeitem', { name: '打开文件 beta.md', exact: true }),
    ).toBeVisible();
    await expect(
      uiPage.getByRole('treeitem', { name: '打开文件 alpha.md', exact: true }),
    ).toHaveCount(0);
    await uiPage.getByRole('treeitem', { name: '打开文件 beta.md', exact: true }).dblclick();
    const betaEditor = uiPage.getByRole('textbox', { name: '文件内容 beta.md', exact: true });
    await expect(betaEditor).toContainText('Beta saved content');
    await expect(uiPage.getByRole('tab', { name: /beta\.md/ })).toBeVisible();
    await betaEditor.fill('Beta saved content\nBeta draft');

    await alphaSession.click();
    await expect(alphaEditor).toContainText('Alpha draft');
    await betaSession.click();
    await expect(betaEditor).toContainText('Beta draft');
    await uiPage.screenshot({ path: test.info().outputPath('multi-project.png') });

    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-multi-project');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
    model.hold = true;
    const alphaMessage = 'MODEL_CHAT Alpha background';
    const betaMessage = 'MODEL_CHAT Beta background';
    const input = uiPage.getByRole('textbox', { name: '研究指令' });
    const send = uiPage.getByRole('button', { name: '发送指令', exact: true });
    await alphaSession.click();
    await input.fill(alphaMessage);
    await send.click();
    await expect.poll(() => model.requests.length).toBe(1);
    await uiPage.getByRole('button', { name: '展开 Agent 会话', exact: true }).click();
    await expect(uiPage.getByText(alphaMessage, { exact: true })).toBeVisible();

    await betaSession.click();
    await expect(uiPage.getByText(alphaMessage, { exact: true })).toHaveCount(0);
    await input.fill(betaMessage);
    await send.click();
    const navigation = uiPage.getByRole('region', { name: '会话管理', exact: true });
    for (const projectId of [first.id, second.id])
      await expect(
        navigation
          .locator(`[data-project-id="${projectId}"]`)
          .getByRole('img', { name: '运行中', exact: true }),
      ).toBeVisible();

    await alphaSession.click();
    await expect(uiPage.getByText(alphaMessage, { exact: true })).toBeVisible();
    await expect(uiPage.getByText(betaMessage, { exact: true })).toHaveCount(0);
    model.release();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await betaSession.click();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成');
    await expect(uiPage.getByText(betaMessage, { exact: true })).toBeVisible();
    await expect(uiPage.getByText(alphaMessage, { exact: true })).toHaveCount(0);
    expect(model.requests).toHaveLength(2);
  } finally {
    model.release();
    client.dispose();
    await stop();
    await model.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('pending project asks on entry and keeps an explicit restricted decision after reload', async ({
  uiPage,
}) => {
  test.setTimeout(60000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-pending-project-ui-'));
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    const project = await client.call('project.create', { path: join(root, 'pending-project') });
    expect(project.trust).toBe('pending');
    await installRpcGate(uiPage);
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByLabel('管理项目 pending-project', { exact: true }).click();
    await uiPage.getByRole('button', { name: '打开项目', exact: true }).click();
    const dialog = uiPage.getByRole('dialog', { name: '确认项目访问', exact: true });
    await expect(dialog).toContainText(project.path);
    await uiPage.screenshot({
      path: test.info().outputPath('project-trust-light.png'),
      animations: 'disabled',
    });
    await uiPage.emulateMedia({ colorScheme: 'dark' });
    await uiPage.screenshot({
      path: test.info().outputPath('project-trust-dark.png'),
      animations: 'disabled',
    });
    await uiPage.emulateMedia({ colorScheme: 'light' });
    await dialog.getByRole('button', { name: '以受限模式添加', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await uiPage.reload();
    await expect(uiPage.getByLabel('执行上下文')).toContainText('受限项目');
    await expect(dialog).toHaveCount(0);
    const access = uiPage.getByRole('button', { name: '项目访问状态', exact: true });
    await expect(access).toContainText('受限模式');
    await access.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(access).toBeFocused();
    await access.click();
    await armRpcGate(uiPage, 'project.grant');
    await dialog.getByRole('button', { name: '信任项目', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await releaseRpcGate(uiPage, true);
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(access).toContainText('受限模式');
    await expect(uiPage.getByLabel('工作台通知', { exact: true })).toContainText('通知 0');
    await dialog.getByRole('button', { name: '信任项目', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(access).toHaveCount(0);
    await expect(uiPage.getByLabel('执行上下文')).toContainText('已信任项目');
  } finally {
    client.dispose();
    await rm(root, { recursive: true });
  }
});

test('restricted project allows manual file editing and disables instruction sending', async ({
  uiPage,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-restricted-project-ui-'));
  const project = join(root, 'restricted');
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  await mkdir(project);
  await writeFile(join(project, 'notes.md'), 'Manual content');
  try {
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project, { trust: 'restricted' });
    const { id: projectId } = await client.call('project.open', { path: project });
    await uiPage.getByRole('treeitem', { name: '打开文件 notes.md', exact: true }).dblclick();
    const editor = uiPage.getByRole('textbox', { name: '文件内容 notes.md', exact: true });
    await expect(editor).toContainText('Manual content');
    await editor.fill('Manual edit remains available');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).first().click();
    await expect
      .poll(() => readFile(join(project, 'notes.md'), 'utf8'))
      .toBe('Manual edit remains available');
    await createSession(uiPage, { projectId });
    await expect(uiPage.getByRole('button', { name: '发送指令', exact: true })).toBeDisabled();
  } finally {
    client.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
