import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { TaskGraphInputs } from '../../packages/protocol/dist/projects.js';
import { runningKernel } from '../kernel-fixture.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

async function openTask(page: Page) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-graph-ui-'));
  const path = join(root, 'project');
  await mkdir(path);
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
}) => {
  const f = await openTask(uiPage);
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

test('a static saved unknown request keeps its original identities across session switch and reload without replaying', async ({
  uiPage,
}) => {
  const f = await openTask(uiPage);
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
