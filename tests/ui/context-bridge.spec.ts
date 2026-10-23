import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { createKernelClient, type KernelClient } from '../../packages/client/dist/index.js';
import type {
  ContextItem,
  ResourceDescriptor,
  WorkbenchContextSnapshot,
} from '../../packages/protocol/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer, type ModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

const EXCERPT = 'Context bridge saved excerpt 73.';

test('a global composer keeps explicit library material while the tool reads the changed selection and a trusted project', async ({
  uiPage,
}, info) => {
  test.setTimeout(150000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-final-context-ui-'));
  const token = randomUUID().slice(0, 8);
  const firstName = `attached-${token}.txt`;
  const secondName = `selected-${token}.txt`;
  let resources: ResourceDescriptor[] = [];
  const publications: WorkbenchContextSnapshot[] = [];
  uiPage.on('websocket', (socket) =>
    socket.on('framesent', ({ payload }) => {
      const frame = JSON.parse(String(payload));
      const request = frame;
      if (request?.method === 'workbench.context.publish' && request.params?.snapshot)
        publications.push(request.params.snapshot);
    }),
  );
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (!calls.includes('read_workbench_context'))
        return { tool: { name: 'read_workbench_context', input: {} } };
      const reads = calls.filter((name) => name === 'read_context_resource').length;
      const resource = resources[reads];
      if (resource)
        return {
          tool: {
            name: 'read_context_resource',
            input: { ref: resource.ref, basis: resource.basis, encoding: 'utf8' },
          },
        };
      return { text: '全局会话已核对变化后的选择及可信项目和库材料。' };
    },
  });
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR as string;
  const stop = await startModelKernel(directory, model.url);
  const client = createKernelClient(await runningKernel(directory));
  await client.connect();
  try {
    const project = await client.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await client.call('files.save', {
      projectId: project.id,
      path: 'source.txt',
      content: 'global_ui_project_evidence_73',
    });
    const target = await client.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'source.txt' },
    });
    await client.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    await writeFile(join(root, firstName), 'global_ui_explicit_library_81');
    await writeFile(join(root, secondName), 'global_ui_changed_library_91');
    const batch = await client.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [join(root, firstName), join(root, secondName)],
      storage: 'managed',
      purpose: '正文',
      version: 'unspecified',
      origin: 'final-ui',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const entries = (await client.call('library.batch', { batchId: batch.id })).entries;
    const library: ResourceDescriptor[] = [];
    for (const entry of entries) {
      assert(entry.attachmentId);
      const attachment = await client.call('library.attachment', {
        attachmentId: entry.attachmentId,
      });
      library.push(
        await client.call('resources.describe', {
          locator: {
            source: 'library',
            attachmentId: attachment.id,
            materialVersionId: attachment.materialVersionId,
          },
        }),
      );
    }
    const selected = library[1];
    assert(selected);
    resources = [target, selected];
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await configureModel(uiPage);
    const before = (await client.call('session.list', { projectId: 'application' })).sessions.map(
      (session) => session.id,
    );
    await createSession(uiPage);
    const session = (await client.call('session.list', { projectId: 'application' })).sessions.find(
      (session) => !before.includes(session.id),
    );
    assert(session);
    const scope = { projectId: 'application', sessionId: session.id };
    const openLibrary = async (name: string) => {
      await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
      await uiPage.getByLabel('查找题录', { exact: true }).fill(name);
      await uiPage.getByRole('option').filter({ hasText: name }).click();
      await uiPage.getByRole('button', { name: `打开 文本 ${name}`, exact: true }).click();
      await expect(uiPage.getByRole('button', { name: '附加资源', exact: true })).toBeEnabled();
    };
    await openLibrary(firstName);
    await uiPage.getByRole('button', { name: '附加资源', exact: true }).click();
    await expect(
      uiPage.locator('.agent-dock').getByText('1 个附加项', { exact: true }),
    ).toBeVisible();
    const instruction = `MODEL_CHAT global_ui_${token}`;
    model.hold = true;
    await uiPage.getByRole('textbox', { name: '研究指令', exact: true }).fill(instruction);
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length, { timeout: 20000 }).toBe(1);
    const accepted = (await client.call('workbench.snapshot', scope)).messages.find(
      (message) => message.text === instruction,
    );
    assert(accepted?.source && accepted.contextItems?.length === 1);
    expect(accepted.contextItems[0]?.ref).toEqual(library[0]?.ref);
    await openLibrary(secondName);
    await expect.poll(() => publications.at(-1)?.selections[0]?.ref).toEqual(selected.ref);
    expect(publications.at(-1)?.receiver).toEqual(scope);
    model.release();
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 20000,
    });
    const completed = await client.call('workbench.snapshot', scope);
    const output = completed.messages.find(
      (message) => message.tool?.name === 'read_workbench_context',
    )?.tool?.output;
    expect(JSON.parse(output ?? '{}')).toMatchObject({
      state: 'available',
      snapshot: { selections: [expect.objectContaining({ ref: selected.ref })] },
    });
    const reads = completed.messages.filter(
      (message) => message.tool?.name === 'read_context_resource',
    );
    expect(reads.map((message) => JSON.parse(message.tool?.output ?? '{}').data)).toEqual([
      'global_ui_project_evidence_73',
      'global_ui_changed_library_91',
    ]);
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(
      'global_ui_project_evidence_73',
    );
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    await expect(uiPage.getByRole('article', { name: 'Agent 回复' }).last()).toContainText(
      '全局会话已核对',
    );
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    const restored = (await client.call('workbench.snapshot', scope)).messages.find(
      (message) => message.id === accepted.id,
    );
    expect(restored?.contextItems).toEqual(accepted.contextItems);
    expect(restored?.source).toEqual(accepted.source);
    const receipt = await client.call('session.send', {
      ...scope,
      instructionId: accepted.id,
      text: instruction,
      materials: [],
      contextItems: accepted.contextItems,
    });
    expect(receipt.runId).toBe(completed.run?.id);
    await info.attach('global-ui-evidence', {
      body: JSON.stringify({
        scope,
        source: accepted.source,
        contextItems: restored?.contextItems,
        selection: publications.at(-1),
        runId: receipt.runId,
      }),
      contentType: 'application/json',
    });
  } finally {
    client.dispose();
    model.release();
    await stop();
    await model.close();
  }
});

async function configureModel(page: Page): Promise<void> {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByText('模型设置', { exact: true }).click();
  await page.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-context-key');
  await page.getByRole('button', { name: '保存凭据', exact: true }).click();
}

async function openProject(page: Page, project: string): Promise<void> {
  await installRpcGate(page);
  await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await configureModel(page);
  await addProject(page, project);
  await createSession(page, basename(project));
}

async function workspaceScope(client: KernelClient, projectPath: string) {
  const snapshot = await client.call('workbench.snapshot', {});
  const project = snapshot.projects.find(
    (item) => item.name === basename(projectPath) || item.path === projectPath,
  );
  assert(project);
  const session = (await client.call('session.list', { projectId: project.id })).sessions[0];
  assert(session);
  return { projectId: project.id, sessionId: session.id };
}

async function attachSavedSelection(page: Page, name: string): Promise<void> {
  const editor = page.getByRole('textbox', { name: `文件内容 ${name}`, exact: true });
  await expect(editor).toContainText(EXCERPT);
  await editor.click();
  await editor.press('ControlOrMeta+a');
  await page.getByRole('button', { name: '附加选区', exact: true }).click();
}

async function contextEntry(dock: Locator, index: number): Promise<Locator> {
  const section = dock.locator('section[aria-label="附加上下文"]');
  const menu = section.locator('details.menu');
  if (!(await menu.evaluate((node) => node.hasAttribute('open'))))
    await section.getByLabel('查看附加上下文', { exact: true }).click();
  const textarea = section.getByLabel(`上下文批注 ${index}`, { exact: true });
  const entry = textarea.locator('xpath=../..');
  if (!(await entry.evaluate((node) => node.hasAttribute('open'))))
    await entry.locator('summary').click();
  return textarea;
}

test('selected project text reaches the model as an explicit attachment and persists after reload', async ({
  uiPage,
}) => {
  test.setTimeout(120000);
  const project = await mkdtemp(join(tmpdir(), 'scholoom-context-ui-'));
  await writeFile(join(project, 'context.txt'), `${EXCERPT}\n`);
  const comment = '用户批注：只用于核实附加摘录。';
  let reread: { ref: ContextItem['ref']; basis: string } | undefined;
  let model: ModelServer | undefined;
  model = await createModelServer({
    respond: ({ calls }) => {
      if (!calls.includes('read_workbench_context'))
        return { tool: { name: 'read_workbench_context', input: {} } };
      if (!calls.includes('read_context_resource')) {
        if (!reread) return { text: '缺少明确附加资源引用。' };
        return {
          tool: {
            name: 'read_context_resource',
            input: { ...reread, encoding: 'utf8' },
          },
        };
      }
      return { text: '已查询当前选择并重新读取明确附加摘录。' };
    },
  });
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    await openProject(uiPage, project);
    await uiPage.getByRole('treeitem', { name: '打开文件 context.txt', exact: true }).dblclick();
    await attachSavedSelection(uiPage, 'context.txt');
    const dock = uiPage.locator('.agent-dock');
    const annotation = await contextEntry(dock, 1);
    await annotation.fill(comment);
    await annotation.press('Escape');

    const scope = await workspaceScope(client, project);
    model.hold = true;
    const instruction = 'MODEL_CHAT 读取明确附加的项目摘录';
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill(instruction);
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model?.requests.length ?? 0, { timeout: 20000 }).toBe(1);

    const accepted = await client.call('workbench.snapshot', scope);
    const sent = accepted.messages.find(
      (message) => message.role === 'user' && message.text === instruction,
    );
    assert(sent?.contextItems?.length === 1);
    const item = sent.contextItems[0];
    if (item?.kind !== 'text') throw new Error('附加项应为文字摘录');
    expect(item).toMatchObject({
      kind: 'text',
      contentState: 'saved',
      comment,
      ref: { source: 'project', projectId: scope.projectId },
    });
    expect(item.quote).toContain(EXCERPT);
    expect(item.basis).not.toBe('');
    reread = { ref: item.ref, basis: item.basis };
    const persistedItems = sent.contextItems;
    model.release();

    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 20000,
    });
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(EXCERPT);
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(comment);

    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const current = uiPage
      .locator('details.tool-call')
      .filter({ hasText: 'read_workbench_context' });
    await current.locator('summary').click();
    await expect(current).toContainText('"state":"available"');
    await expect(current).toContainText(EXCERPT);
    const resource = uiPage
      .locator('details.tool-call')
      .filter({ hasText: 'read_context_resource' });
    await resource.locator('summary').click();
    await expect(resource).toContainText(EXCERPT);
    const reply = uiPage.getByRole('article', { name: 'Agent 回复' }).last();
    await reply.scrollIntoViewIfNeeded();
    await expect(reply).toContainText('已查询当前选择并重新读取明确附加摘录。');

    const user = uiPage.getByRole('article', { name: '用户消息' }).filter({ hasText: instruction });
    await user.getByText('明确附加上下文（1）', { exact: true }).click();
    await expect(user).toContainText(EXCERPT);
    await expect(user).toContainText(comment);

    const completed = await client.call('workbench.snapshot', scope);
    expect(
      completed.messages.find((message) => message.role === 'user' && message.text === instruction)
        ?.contextItems,
    ).toEqual(persistedItems);

    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '展开 Agent 会话' }).click();
    const reloaded = uiPage
      .getByRole('article', { name: '用户消息' })
      .filter({ hasText: instruction });
    await reloaded.getByText('明确附加上下文（1）', { exact: true }).click();
    await expect(reloaded).toContainText(EXCERPT);
    await expect(reloaded).toContainText(comment);
    const reopened = await client.call('workbench.snapshot', scope);
    expect(
      reopened.messages.find((message) => message.role === 'user' && message.text === instruction)
        ?.contextItems,
    ).toEqual(persistedItems);
  } finally {
    client.dispose();
    model?.release();
    await stop();
    await model?.close();
    await rm(project, { recursive: true, force: true });
  }
});
test('a late send receipt keeps context added or commented after the send', async ({ uiPage }) => {
  test.setTimeout(90000);
  const project = await mkdtemp(join(tmpdir(), 'scholoom-context-late-ui-'));
  await writeFile(join(project, 'late.txt'), `${EXCERPT}\n`);
  const originalComment = '发送时的批注';
  const laterComment = '回执前补充的批注';
  const model = await createModelServer({ respond: () => ({ text: '迟到回执已处理。' }) });
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    await openProject(uiPage, project);
    await uiPage.getByRole('treeitem', { name: '打开文件 late.txt', exact: true }).dblclick();
    await attachSavedSelection(uiPage, 'late.txt');
    const dock = uiPage.locator('.agent-dock');
    const original = await contextEntry(dock, 1);
    await original.fill(originalComment);
    await original.press('Escape');
    const scope = await workspaceScope(client, project);
    const instruction = 'MODEL_CHAT 迟到回执上下文';
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill(instruction);

    await armRpcGate(uiPage, 'session.send');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);

    const annotation = await contextEntry(dock, 1);
    await annotation.fill(laterComment);
    await annotation.press('Escape');
    const editor = uiPage.getByRole('textbox', { name: '文件内容 late.txt', exact: true });
    await editor.click();
    await editor.press('ControlOrMeta+a');
    await uiPage.getByRole('button', { name: '附加选区', exact: true }).click();
    await expect(dock.getByText('2 个附加项', { exact: true })).toBeVisible();

    await releaseRpcGate(uiPage);
    await expect(uiPage.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 20000,
    });
    await expect(dock.getByText('2 个附加项', { exact: true })).toBeVisible();
    const protectedComment = await contextEntry(dock, 1);
    await expect(protectedComment).toHaveValue(laterComment);
    const added = await contextEntry(dock, 2);
    await expect(added).toHaveValue('');
    await added.press('Escape');

    const sent = (await client.call('workbench.snapshot', scope)).messages.find(
      (message) => message.role === 'user' && message.text === instruction,
    );
    assert(sent?.contextItems?.length === 1);
    expect(sent.contextItems[0]?.comment).toBe(originalComment);

    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    const reloaded = uiPage.locator('.agent-dock');
    await expect(reloaded.getByText('2 个附加项', { exact: true })).toBeVisible();
    await expect(await contextEntry(reloaded, 1)).toHaveValue(laterComment);
  } finally {
    client.dispose();
    await stop();
    await model.close();
    await rm(project, { recursive: true, force: true });
  }
});
