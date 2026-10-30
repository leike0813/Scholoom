import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { TaskGraphInputs } from '../../packages/protocol/dist/projects.js';
import { runningKernel } from '../kernel-fixture.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

async function openTask(page: Page, root: string) {
  const path = join(root, 'project');
  await mkdir(path, { recursive: true });
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    const project = await client.call('project.open', { path, trust: 'restricted' });
    const taskId = randomUUID();
    const title = `科研图任务-${taskId.slice(0, 8)}`;
    const created = await client.call('tasks.create', {
      projectId: project.id,
      operationId: randomUUID(),
      path: `tasks/${taskId}.task.md`,
      content: `---\n${JSON.stringify({ kind: 'research-task', formatVersion: 1, id: taskId, title, status: 'active' })}\n---\n\n核查已保存的样本条件。\n`,
    });
    assert(created.state === 'complete');
    const read = await client.call('tasks.read', {
      task: { projectId: project.id, taskId, fileId: created.resource.ref.fileId },
    });
    const requests: { method: string; params: Record<string, unknown> }[] = [];
    page.on('websocket', (socket) =>
      socket.on('framesent', ({ payload }) => {
        const message = JSON.parse(typeof payload === 'string' ? payload : payload.toString());
        if (message.method?.startsWith('tasks.')) requests.push(message);
      }),
    );
    await page.goto(rendererUrl);
    await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(page, path, { trust: 'restricted' });
    await createSession(page, { projectId: project.id });
    await page.getByRole('tab', { name: '任务', exact: true }).click();
    await page.getByRole('option', { name: new RegExp(`^${title} `) }).click();
    const detail = page.getByRole('region', { name: '研究任务详情', exact: true });
    await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
    return { client, project, read, title, detail, requests };
  } catch (error) {
    client.dispose();
    throw error;
  }
}

test('the real task graph empty directory preserves form drafts and refuses unsaved entry edits in both hosts', async ({
  uiPage,
}, info) => {
  const f = await openTask(uiPage, info.outputPath('i1'));
  try {
    await f.detail.getByRole('button', { name: '运行科研图', exact: true }).click();
    const form = f.detail.getByRole('form', { name: '运行科研图', exact: true });
    await expect(form.getByRole('status').filter({ hasText: '科研图不可用' })).toBeVisible();
    await expect(form.getByRole('combobox', { name: '科研图及版本' })).toBeDisabled();
    await expect(form.getByRole('button', { name: '提交科研图调用', exact: true })).toBeDisabled();
    const config = JSON.stringify({ goal: '刷新后核对原始配置' });
    await form.getByRole('textbox', { name: 'JSON 配置' }).fill(config);
    await expect
      .poll(() => f.requests.filter((request) => request.method === 'tasks.graphs').length)
      .toBeGreaterThan(0);
    expect(
      f.requests
        .filter((request) => request.method === 'tasks.graphs')
        .every((request) => request.params.limit === 25),
    ).toBe(true);
    await f.detail.getByRole('button', { name: '编辑入口', exact: true }).click();
    const editor = uiPage.getByRole('textbox', { name: `文件内容 ${f.read.path}`, exact: true });
    await editor.fill(`${f.read.content}\n尚未保存的样本条件。`);
    await uiPage.getByRole('tab', { name: new RegExp(`^${f.title} 关闭`) }).click();
    await expect(form.getByRole('alert')).toContainText('未保存');
    await expect(form.getByRole('button', { name: '提交科研图调用', exact: true })).toBeDisabled();
    expect((await f.client.call('tasks.read', { task: f.read.task })).content).toBe(f.read.content);
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await uiPage.getByRole('option', { name: new RegExp(`^${f.title} `) }).click();
    await expect(form.getByRole('textbox', { name: 'JSON 配置' })).toHaveValue(config);
    await expect(form.getByRole('alert')).toContainText('未保存');
    await f.detail.getByRole('button', { name: '编辑入口', exact: true }).click();
    await expect(editor).toContainText('尚未保存的样本条件');
    expect((await f.client.call('tasks.read', { task: f.read.task })).content).toBe(f.read.content);
    expect(f.requests.filter((request) => request.method === 'tasks.runGraph')).toHaveLength(0);
  } finally {
    f.client.dispose();
  }
});

test('task details select real catalog candidates, reject stale revisions and expose sources without fake attachments in both hosts', async ({
  uiPage,
}, info) => {
  const f = await openTask(uiPage, info.outputPath('catalog'));
  try {
    await f.client.call('library.grant', {
      read: true,
      write: true,
      send: true,
      autoBackup: false,
    });
    const title = `仅题录-${randomUUID()}`;
    const batch = await f.client.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'task-ui-test',
      version: 'catalog-v3',
      json: JSON.stringify([{ title }]),
    });
    await expect
      .poll(async () => (await f.client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const sourceId = (await f.client.call('library.batch', { batchId: batch.id })).entries[0]
      ?.sourceId;
    assert(sourceId);
    const source = await f.client.call('library.get', { sourceId });
    const libraryId = (await f.client.call('library.status', {})).id;
    await f.detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    const form = uiPage.getByRole('form', { name: '关联任务材料' });
    await form
      .getByRole('combobox', { name: '关联对象', exact: true })
      .selectOption('library-source');
    await form.getByRole('textbox', { name: '查找题录', exact: true }).fill(title);
    await form.getByRole('button', { name: '读取题录候选', exact: true }).click();
    await expect(form.getByRole('option', { name: new RegExp(title) })).toBeAttached();
    await form
      .getByRole('combobox', { name: '来源题录', exact: true })
      .selectOption({ label: `${title} · catalog-v3 · 修订 ${source.revision} · 附件未取得` });
    await uiPage.screenshot({ path: info.outputPath('catalog-picker-light.png') });
    const updated = await f.client.call('library.update', {
      sourceId,
      revision: source.revision,
      metadata: { ...source.metadata, title: `${title}-修订` },
      tags: source.tags,
      collectionIds: source.collectionIds,
      relatedIds: source.relatedIds,
    });
    await form.getByRole('button', { name: '保存关联', exact: true }).click();
    await expect(form.getByRole('alert')).toContainText('变化');
    expect(
      (await f.client.call('tasks.read', { task: f.read.task })).metadata.links ?? [],
    ).toHaveLength(0);
    await form.getByRole('button', { name: '读取题录候选', exact: true }).click();
    await expect(form.getByRole('option', { name: new RegExp(`${title}-修订`) })).toBeAttached();
    await form.getByRole('combobox', { name: '来源题录', exact: true }).selectOption({
      label: `${title}-修订 · catalog-v3 · 修订 ${updated.revision} · 附件未取得`,
    });
    await form.getByRole('button', { name: '保存关联', exact: true }).click();
    await expect(form).toHaveCount(0);
    const entry = await f.client.call('tasks.read', { task: f.read.task });
    expect(entry.metadata.links).toEqual([
      expect.objectContaining({
        role: 'source',
        basis: 'catalog-v3',
        target: { kind: 'library-source', libraryId, sourceId },
      }),
    ]);
    await f.detail.getByRole('button', { name: '打开来源题录', exact: true }).click();
    const catalog = f.detail.getByRole('region', { name: '来源题录详情' });
    await expect(catalog).toContainText(`${title}-修订`);
    await expect(catalog).toContainText('附件未取得');
    await uiPage.emulateMedia({ colorScheme: 'dark' });
    await uiPage.screenshot({ path: info.outputPath('catalog-details-dark.png') });
    await f.detail.getByRole('button', { name: '运行科研图', exact: true }).click();
    const graph = f.detail.getByRole('form', { name: '运行科研图', exact: true });
    await graph.getByRole('checkbox', { name: /文献库题录/ }).check();
    await expect(graph.getByRole('checkbox', { name: /文献库题录/ })).toBeChecked();
    await f.client.call('library.grant', {
      read: false,
      write: true,
      send: true,
      autoBackup: false,
    });
    await expect(catalog).toHaveCount(0);
    await f.detail.getByRole('button', { name: '打开来源题录', exact: true }).click();
    await expect(f.detail.getByRole('alert')).toBeVisible();
    expect((await f.client.call('tasks.read', { task: f.read.task })).metadata.links).toEqual(
      entry.metadata.links,
    );
    expect(f.requests.filter((request) => request.method === 'tasks.runGraph')).toHaveLength(0);
  } finally {
    await f.client.call('library.grant', {
      read: true,
      write: true,
      send: false,
      autoBackup: false,
    });
    f.client.dispose();
  }
});

test('a static saved unknown request keeps its original identities across session switch and reload without replaying', async ({
  uiPage,
}, info) => {
  const f = await openTask(uiPage, info.outputPath('i1'));
  try {
    await f.detail.getByRole('button', { name: '运行科研图', exact: true }).click();
    const selected = uiPage.getByRole('button', { name: /^打开会话 /, pressed: true });
    const sessionId = await selected.evaluate((button) =>
      button.closest('li')?.getAttribute('data-session-id'),
    );
    assert(sessionId);
    // Only the saved draft is injected; the real product graph directory remains empty.
    const input: TaskGraphInputs['tasks.runGraph'] = {
      task: f.read.task,
      basis: f.read.entry.basis,
      sessionId,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      processOperationId: randomUUID(),
      graphId: 'previous-call',
      version: '1',
      config: { goal: '核查原请求' },
      sourceLinkIds: [],
    };
    const storageKey = await uiPage.evaluate(
      ({ task, input }) => {
        const key = Object.keys(localStorage).find(
          (key) =>
            key.startsWith('scholoom.draft.v1:') &&
            key.endsWith(`|${task.taskId}|${task.fileId}|graph-call`),
        );
        if (!key) throw new Error('Missing task graph draft');
        const draft = JSON.parse(localStorage.getItem(key) ?? '');
        localStorage.setItem(
          key,
          JSON.stringify({
            ...draft,
            graphId: input.graphId,
            version: input.version,
            config: JSON.stringify(input.config),
            attempt: { input },
          }),
        );
        return key;
      },
      { task: f.read.task, input },
    );
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await uiPage.getByRole('option', { name: new RegExp(`^${f.title} `) }).click();
    const form = f.detail.getByRole('form', { name: '运行科研图', exact: true });
    await expect(form.getByRole('status').filter({ hasText: '调用结果待核查' })).toBeVisible();
    await expect(form.getByRole('button', { name: '提交科研图调用', exact: true })).toBeDisabled();
    await expect(form.getByRole('button', { name: '返回修改', exact: true })).toHaveCount(0);
    await expect(form.getByRole('button', { name: '新建科研图调用', exact: true })).toHaveCount(0);
    await expect(form.getByRole('textbox', { name: 'JSON 配置' })).toBeDisabled();
    await createSession(uiPage, { projectId: f.project.id });
    await expect(form.getByText(/^目标会话：/)).toContainText(sessionId);
    expect(
      await uiPage.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? '').attempt.input,
        storageKey,
      ),
    ).toEqual(input);
    expect(f.requests.filter((request) => request.method === 'tasks.runGraph')).toHaveLength(0);
  } finally {
    f.client.dispose();
  }
});
