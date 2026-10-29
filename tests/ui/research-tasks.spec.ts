import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { createKernelClient, KernelClientError } from '../../packages/client/dist/index.js';
import type { ErrorInfo } from '../../packages/protocol/dist/core.js';
import type { ProjectTaskInputs, TaskMetadata } from '../../packages/protocol/dist/projects.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

async function releaseAndRender(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const gate = Reflect.get(globalThis, '__scholoomRpcGate');
        const { socket, id } = gate.held;
        const response = (event: MessageEvent) => {
          if (JSON.parse(event.data).id !== id) return;
          socket.removeEventListener('message', response);
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        };
        socket.addEventListener('message', response);
        gate.release();
      }),
  );
}

test('research tasks share file authority, source navigation and project drafts in both hosts', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-ui-'));
  const path = join(root, 'project');
  await mkdir(path);
  await writeFile(join(path, 'comparison.md'), '# 条件与比较\n方法A不适用小样本。\n');
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  const errors: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  try {
    await installRpcGate(uiPage);
    const project = await client.call('project.open', { path, trust: 'restricted' });
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, path, { trust: 'restricted' });
    await createSession(uiPage, { projectId: project.id });
    const instruction = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
    await instruction.fill('保留本会话未发送要求');
    const session = uiPage.getByRole('button', { name: /^打开会话 /, pressed: true });
    const alphaSessionId = await session.evaluate((button) =>
      button.closest('li')?.getAttribute('data-session-id'),
    );
    assert(alphaSessionId);
    const sessionName = await session.getAttribute('aria-label');
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await uiPage.getByRole('button', { name: '新建任务', exact: true }).click();
    const title = `核对样本-${randomUUID().slice(0, 8)}`;
    await uiPage.getByRole('textbox', { name: '任务名称', exact: true }).fill(title);
    await uiPage
      .getByRole('textbox', { name: '任务正文', exact: true })
      .fill('目标：比较方案。\n障碍：小样本。\n下一步：重读方法依据。');
    await uiPage.getByRole('button', { name: '创建任务', exact: true }).click();
    const detail = uiPage.getByRole('region', { name: '研究任务详情', exact: true });
    await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const discovered = (await client.call('tasks.list', { projectId: project.id })).tasks;
    const found = discovered.find((task) => task.title === title);
    assert(found);
    expect(await readFile(join(path, found.path), 'utf8')).toContain('下一步');
    await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    const association = uiPage.getByRole('form', { name: '关联任务材料' });
    await association.getByRole('textbox', { name: '项目内材料路径' }).fill('comparison.md');
    await association
      .getByRole('textbox', { name: '采用说明' })
      .fill('保留方法A的样本限制与放弃理由。');
    await armRpcGate(uiPage, 'tasks.save');
    await association.getByRole('button', { name: '保存关联', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    await releaseRpcGate(uiPage);
    await expect(association).toHaveCount(0);
    await expect
      .poll(
        async () => (await client.call('tasks.read', { task: found.task })).metadata.links?.length,
      )
      .toBe(1);
    const linked = await client.call('tasks.read', { task: found.task });
    const link = linked.metadata.links?.[0];
    assert(link);
    expect(link.note).toBe('保留方法A的样本限制与放弃理由。');
    await detail.getByRole('button', { name: '附加到指令', exact: true }).click();
    await expect(instruction).toHaveValue('保留本会话未发送要求');
    expect(await session.getAttribute('aria-label')).toBe(sessionName);
    await detail.getByRole('button', { name: '编辑入口', exact: true }).click();
    const editor = uiPage.getByRole('textbox', { name: `文件内容 ${found.path}`, exact: true });
    await expect(editor).toContainText('比较方案');
    const persisted = linked.content;
    await editor.fill(`${persisted}\n本机未保存的入口补充。`);
    await uiPage.getByRole('tab', { name: new RegExp(`^${title} 关闭`) }).click();
    await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    await association.getByRole('textbox', { name: '项目内材料路径' }).fill('comparison.md');
    await association.getByRole('button', { name: '保存关联', exact: true }).click();
    await expect(association.getByRole('alert')).toContainText('未保存');
    expect((await client.call('tasks.read', { task: found.task })).content).toBe(persisted);
    await association.getByRole('button', { name: '取消关联' }).click();
    await detail.getByRole('button', { name: '编辑入口', exact: true }).click();
    await expect(editor).toContainText('本机未保存的入口补充');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).click();
    await expect
      .poll(async () => (await client.call('tasks.read', { task: found.task })).content)
      .toContain('本机未保存的入口补充');
    await uiPage.getByRole('tab', { name: new RegExp(`^${title} 关闭`) }).click();
    await expect(detail.getByRole('region', { name: '任务正文' })).toContainText(
      '本机未保存的入口补充',
    );
    const external =
      '\uFEFF' +
      (await client.call('tasks.read', { task: found.task })).content +
      '\n人工外部更改：下一步复核。\n';
    await writeFile(join(path, found.path), external);
    await expect(detail.getByRole('region', { name: '任务正文' })).toContainText('人工外部更改');
    await expect(detail.getByRole('region', { name: '任务正文' })).not.toContainText(
      'formatVersion',
    );
    const materials = detail.getByRole('region', { name: '任务关联材料', exact: true });
    await armRpcGate(uiPage, 'resources.describe');
    await materials.getByRole('button').click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await uiPage.getByRole('tab', { name: new RegExp(`^${title} 关闭`) }).click();
    await releaseAndRender(uiPage);
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 comparison.md', exact: true }),
    ).toHaveCount(0);
    await materials.getByRole('button').click();
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 comparison.md', exact: true }),
    ).toContainText('方法A不适用');
    await expect(instruction).toHaveValue('保留本会话未发送要求');
    const betaPath = join(root, 'other', 'project');
    await mkdir(betaPath, { recursive: true });
    const beta = await client.call('project.open', { path: betaPath, trust: 'restricted' });
    await addProject(uiPage, betaPath, { trust: 'restricted' });
    await createSession(uiPage, { projectId: beta.id });
    const betaSessionId = await session.evaluate((button) =>
      button.closest('li')?.getAttribute('data-session-id'),
    );
    assert(betaSessionId);
    await instruction.fill('另一个同名项目的草稿');
    await expect(
      uiPage.getByRole('region', { name: '研究任务', exact: true }).getByRole('status'),
    ).toContainText('没有任务');
    await expect(uiPage.getByRole('option', { name: new RegExp(`^${title} `) })).toHaveCount(0);
    await uiPage.getByRole('button', { name: '新建任务', exact: true }).click();
    await uiPage.getByRole('textbox', { name: '任务名称', exact: true }).fill('另一项目待创建任务');
    await uiPage
      .getByRole('textbox', { name: '任务正文', exact: true })
      .fill('另一项目未保存的创建草稿');
    await uiPage
      .locator(`[data-session-id="${alphaSessionId}"]`)
      .getByRole('button', { name: /^打开会话 / })
      .click();
    await expect(instruction).toHaveValue('保留本会话未发送要求');
    await uiPage.getByRole('tab', { name: new RegExp(`^${title} 关闭`) }).click();
    await expect(detail.getByRole('region', { name: '任务正文' })).toContainText('人工外部更改');
    await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    await association.getByRole('textbox', { name: '项目内材料路径' }).fill('comparison.md');
    await association.getByRole('textbox', { name: '采用说明' }).fill('切换和刷新后继续核对的关联');
    await uiPage
      .locator(`[data-session-id="${betaSessionId}"]`)
      .getByRole('button', { name: /^打开会话 / })
      .click();
    await expect(uiPage.getByRole('textbox', { name: '任务名称', exact: true })).toHaveValue(
      '另一项目待创建任务',
    );
    await expect(uiPage.getByRole('textbox', { name: '任务正文', exact: true })).toHaveValue(
      '另一项目未保存的创建草稿',
    );
    await uiPage.reload();
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await expect(uiPage.getByRole('textbox', { name: '任务名称', exact: true })).toHaveValue(
      '另一项目待创建任务',
    );
    await uiPage
      .locator(`[data-session-id="${alphaSessionId}"]`)
      .getByRole('button', { name: /^打开会话 / })
      .click();
    await uiPage.getByRole('option', { name: new RegExp(`^${title} `) }).click();
    await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    await expect(association.getByRole('textbox', { name: '项目内材料路径' })).toHaveValue(
      'comparison.md',
    );
    await expect(association.getByRole('textbox', { name: '采用说明' })).toHaveValue(
      '切换和刷新后继续核对的关联',
    );
    await association.getByRole('button', { name: '取消关联' }).click();
    await uiPage.screenshot({
      path: test.info().outputPath('research-task-detail.png'),
      animations: 'disabled',
    });
    await detail.getByRole('button', { name: '编辑入口', exact: true }).click();
    await editor.fill(`${external}\n刷新后保留的入口草稿。`);
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await expect(uiPage.getByRole('option', { name: new RegExp(`^${title} `) })).toBeVisible();
    const taskList = uiPage.getByRole('listbox', { name: '已发现任务与文件诊断' });
    await taskList.focus();
    await taskList.press('Home');
    await taskList.press('Enter');
    await detail.getByRole('button', { name: '编辑入口', exact: true }).click();
    await expect(editor).toContainText('刷新后保留的入口草稿');
    expect((await client.call('tasks.read', { task: found.task })).content).toBe(external);
    await expect(instruction).toHaveValue('保留本会话未发送要求');
    expect(errors).toEqual([]);
  } finally {
    client.dispose();
  }
});

test('sent task context retains its original evidence and receiver after a real task save conflict', async ({
  uiPage,
}, info) => {
  test.setTimeout(90000);
  const root = info.outputPath('task-save-conflict');
  await mkdir(root, { recursive: true });
  const model = await createModelServer({
    respond: () => ({ text: 'The sent task context was received.' }),
  });
  model.hold = true;
  const stop = await startModelKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string, model.url);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    await installRpcGate(uiPage);
    const project = await client.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await client.call('files.save', {
      projectId: project.id,
      path: 'comparison.md',
      content: '# Independent process material\n',
    });
    const metadata: TaskMetadata = {
      kind: 'research-task',
      formatVersion: 1,
      id: randomUUID(),
      title: '已发送任务的条件保存',
      status: 'active',
    };
    const original = `---\n${JSON.stringify(metadata)}\n---\n\n目标：核对测量条件。下一步：等待人工核查。\n`;
    const created = await client.call('tasks.create', {
      projectId: project.id,
      path: 'tasks/send.task.md',
      operationId: randomUUID(),
      content: original,
    });
    assert(created.state === 'complete');
    const task = {
      projectId: project.id,
      taskId: metadata.id,
      fileId: created.resource.ref.fileId,
    };
    const prior = await client.call('tasks.read', { task });
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project.path, { trust: 'trusted' });
    await createSession(uiPage, { projectId: project.id });
    const selected = uiPage.getByRole('button', { name: /^打开会话 /, pressed: true });
    const sessionId = await selected.evaluate((button) =>
      button.closest('li')?.getAttribute('data-session-id'),
    );
    assert(sessionId);
    const scope = { projectId: project.id, sessionId };
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByText('模型设置', { exact: true }).click();
    await uiPage.getByLabel('MiniMax API Key', { exact: true }).fill('synthetic-task-context-key');
    await uiPage.getByRole('button', { name: '保存凭据', exact: true }).click();
    await expect(uiPage.getByLabel('MiniMax API Key', { exact: true })).toHaveValue('');
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await uiPage.getByRole('option', { name: /^已发送任务的条件保存 / }).click();
    const detail = uiPage.getByRole('region', { name: '研究任务详情', exact: true });
    await detail.getByRole('button', { name: '附加到指令', exact: true }).click();
    const instruction = 'TASK_CONTEXT_CAS_CHECK 请核对明确附加的任务入口。';
    await uiPage.getByRole('textbox', { name: '研究指令', exact: true }).fill(instruction);
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length, { timeout: 20000 }).toBe(1);
    const accepted = await client.call('workbench.snapshot', scope);
    const sent = accepted.messages.find(
      (message) => message.role === 'user' && message.text === instruction,
    );
    assert(sent?.contextItems?.length === 1 && accepted.run);
    expect(sent.contextItems[0]).toMatchObject({
      kind: 'resource',
      ref: prior.entry.ref,
      basis: prior.entry.basis,
    });
    expect(sent.state).toBe('consumed');
    const sentItems = sent.contextItems;

    await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
    const association = uiPage.getByRole('form', { name: '关联任务材料', exact: true });
    const candidateNote = '保留这次失败关联的候选说明，待重读后由用户决定。';
    await association.getByRole('textbox', { name: '项目内材料路径' }).fill('comparison.md');
    await association.getByRole('textbox', { name: '采用说明' }).fill(candidateNote);
    await armRpcGate(uiPage, 'tasks.save');
    await association.getByRole('button', { name: '保存关联', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    const candidate = await uiPage.evaluate(
      () =>
        JSON.parse(Reflect.get(globalThis, '__scholoomRpcGate').held.payload)
          .params as ProjectTaskInputs['tasks.save'],
    );
    expect(candidate).toMatchObject({ task, basis: prior.entry.basis });
    expect(candidate.content).toContain(candidateNote);
    const changedOnDisk = `${original}\n人工在发送后补充：后续成果必须保留。\n`;
    await client.call('resources.save', {
      ref: prior.entry.ref,
      basis: prior.entry.basis,
      content: changedOnDisk,
    });
    // Observe the real rejection for this exact held request; do not fabricate an RPC result.
    const error = await uiPage.evaluate(
      () =>
        new Promise<ErrorInfo>((resolve) => {
          const gate = Reflect.get(globalThis, '__scholoomRpcGate');
          const { socket, id } = gate.held;
          const receive = (event: MessageEvent) => {
            const response = JSON.parse(event.data);
            if (response.id !== id) return;
            socket.removeEventListener('message', receive);
            resolve(response.error?.data);
          };
          socket.addEventListener('message', receive);
          gate.release();
        }),
    );
    expect(error).toMatchObject({ code: 'contentChanged' });
    await expect(association.getByRole('alert')).toBeVisible();
    await expect(association.getByRole('textbox', { name: '项目内材料路径' })).toHaveValue(
      'comparison.md',
    );
    await expect(association.getByRole('textbox', { name: '采用说明' })).toHaveValue(candidateNote);
    const persisted = await client.call('tasks.read', { task });
    expect(persisted.content).toBe(changedOnDisk);
    expect(persisted.entry.basis).not.toBe(prior.entry.basis);
    expect(persisted.metadata.links).toBeUndefined();
    expect(await readFile(join(project.path, prior.path), 'utf8')).toBe(changedOnDisk);
    expect(await readFile(join(project.path, 'comparison.md'), 'utf8')).toBe(
      '# Independent process material\n',
    );
    const after = await client.call('workbench.snapshot', scope);
    expect(after.messages.find((message) => message.id === sent.id)?.contextItems).toEqual(
      sentItems,
    );
    expect(after.run?.id).toBe(accepted.run.id);
    expect(
      await selected.evaluate((button) => button.closest('li')?.getAttribute('data-session-id')),
    ).toBe(sessionId);
    await writeFile(
      info.outputPath('sent-task-save-conflict.json'),
      JSON.stringify(
        {
          task,
          scope,
          sent,
          runId: accepted.run.id,
          priorEvidence: prior.entry,
          candidate,
          error,
          persisted,
          afterSent: after.messages.find((message) => message.id === sent.id),
        },
        null,
        2,
      ),
    );
  } finally {
    const held = await uiPage
      .evaluate(() => !!Reflect.get(globalThis, '__scholoomRpcGate')?.held)
      .catch(() => false);
    if (held) await releaseRpcGate(uiPage);
    client.dispose();
    model.release();
    await stop();
    await model.close();
  }
});

test('unavailable task library source keeps its reference and existing materials across a fresh session', async ({
  uiPage,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-source-ui-'));
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    const project = await client.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    const sourcePath = join(root, 'source.txt');
    await writeFile(sourcePath, 'unread_source_must_not_be_adopted');
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const batch = await client.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [sourcePath],
      storage: 'linked',
      purpose: '正文',
      version: 'unspecified',
      origin: 'task-source-ui',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const imported = (await client.call('library.batch', { batchId: batch.id })).entries[0];
    assert(imported?.attachmentId);
    const attachment = await client.call('library.attachment', {
      attachmentId: imported.attachmentId,
    });
    const metadata: TaskMetadata = {
      kind: 'research-task',
      formatVersion: 1,
      id: randomUUID(),
      title: '来源待核查',
      status: 'waiting',
      links: [
        {
          id: 'source',
          role: 'source',
          target: {
            kind: 'library-material',
            attachmentId: attachment.id,
            materialVersionId: attachment.materialVersionId,
          },
          basis: attachment.materialVersionId,
        },
      ],
    };
    assert(metadata.links);
    for (const role of ['process', 'result'] as const) {
      await client.call('files.save', {
        projectId: project.id,
        path: `${role}.md`,
        content: `${role}: existing independent material\n`,
      });
      const material = await client.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path: `${role}.md` },
      });
      assert(material.ref.source === 'project');
      metadata.links.push({
        id: role,
        role,
        target: { kind: 'project-file', fileId: material.ref.fileId },
        basis: material.basis,
      });
    }
    const content = `---\n${JSON.stringify(metadata)}\n---\n\n目标：保留已有结果。下一步：等待用户核查来源；删除记录查询不可用，不认定删除或恢复。\n`;
    const created = await client.call('tasks.create', {
      projectId: project.id,
      path: 'tasks/source.task.md',
      operationId: randomUUID(),
      content,
    });
    assert(created.state === 'complete');
    const task = {
      projectId: project.id,
      taskId: metadata.id,
      fileId: created.resource.ref.fileId,
    };
    await unlink(sourcePath);
    const unavailable = await client.call('library.attachment', { attachmentId: attachment.id });
    expect(unavailable).toMatchObject({
      storage: 'linked',
      state: 'missing',
      materialVersionId: attachment.materialVersionId,
      error: { code: 'notFound' },
    });
    assert(unavailable.error);
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, project.path, { trust: 'restricted' });
    await createSession(uiPage, { projectId: project.id });
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await uiPage.getByRole('option', { name: /^来源待核查 / }).click();
    const detail = uiPage.getByRole('region', { name: '研究任务详情', exact: true });
    await detail.getByRole('button', { name: '打开来源材料', exact: true }).click();
    await expect(uiPage.getByRole('alert').filter({ hasText: /不可读取|不存在/ })).toBeVisible();
    expect((await client.call('tasks.read', { task })).content).toBe(content);
    await createSession(uiPage, { projectId: project.id });
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await uiPage.getByRole('option', { name: /^来源待核查 / }).click();
    await expect(detail.getByRole('region', { name: '任务正文' })).toContainText('下一步');
    for (const [role, label] of [
      ['process', '过程'],
      ['result', '成果'],
    ] as const) {
      await detail.getByRole('button', { name: `打开${label}材料`, exact: true }).click();
      await expect(
        uiPage.getByRole('textbox', { name: `文件内容 ${role}.md`, exact: true }),
      ).toContainText(`${role}: existing independent material`);
      await uiPage.getByRole('tab', { name: /^来源待核查 关闭/ }).click();
      expect(await readFile(join(project.path, `${role}.md`), 'utf8')).toBe(
        `${role}: existing independent material\n`,
      );
    }
    const saved = await client.call('tasks.read', { task });
    expect(saved.content).toBe(content);
    expect(saved.metadata.links).toEqual(metadata.links);
    await info.attach('task-source-evidence', {
      body: JSON.stringify({ task, source: unavailable, links: saved.metadata.links }),
      contentType: 'application/json',
    });
  } finally {
    // Registered project and profile stay together until this isolated configuration retires.
    client.dispose();
  }
});

test('late task creation keeps its original operation across project switch and reload', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-late-ui-'));
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  const creationState = async (projectId: string, operationId: string) => {
    try {
      return (await client.call('resources.creation', { projectId, operationId })).state;
    } catch (error) {
      if (error instanceof KernelClientError && error.code === 'notFound') return 'notFound';
      throw error;
    }
  };
  try {
    await installRpcGate(uiPage);
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    const sessions: string[] = [];
    const projects: string[] = [];
    for (const name of ['alpha', 'beta']) {
      const path = join(root, name);
      await mkdir(path);
      if (name === 'alpha') {
        await mkdir(join(path, 'tasks'));
        await Promise.all(
          Array.from({ length: 25 }, (_, i) =>
            writeFile(join(path, 'tasks', `${String(i).padStart(2, '0')}.md`), '普通材料'),
          ),
        );
        await writeFile(
          join(path, 'tasks', 'zz.task.md'),
          `---\n${JSON.stringify({ kind: 'research-task', formatVersion: 1, id: 'paged-task', title: '后页任务', status: 'active' })}\n---\n\n后页目标。`,
        );
      }
      const project = await client.call('project.open', { path, trust: 'restricted' });
      projects.push(project.id);
      await addProject(uiPage, path, { trust: 'restricted' });
      await createSession(uiPage, { projectId: project.id });
      const id = await uiPage
        .getByRole('button', { name: /^打开会话 /, pressed: true })
        .evaluate((button) => button.closest('li')?.getAttribute('data-session-id'));
      assert(id);
      sessions.push(id);
    }
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await uiPage.getByRole('button', { name: '新建任务', exact: true }).click();
    const title = `待核查-${randomUUID()}`;
    await uiPage.getByRole('textbox', { name: '任务名称', exact: true }).fill(title);
    await uiPage.getByRole('textbox', { name: '任务正文', exact: true }).fill('保留原创建操作身份');
    await armRpcGate(uiPage, 'tasks.create');
    await uiPage.getByRole('button', { name: '创建任务', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    const operationId = await uiPage.evaluate(
      () =>
        JSON.parse(Reflect.get(globalThis, '__scholoomRpcGate').held.payload).params
          .operationId as string,
    );
    await uiPage
      .locator(`[data-session-id="${sessions[0]}"]`)
      .getByRole('button', { name: /^打开会话 / })
      .click();
    const instruction = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
    await instruction.fill('当前项目未发送指令');
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await expect(uiPage.getByRole('option', { name: /^后页任务 / })).toHaveCount(0);
    await uiPage.getByRole('button', { name: '继续加载', exact: true }).click();
    await expect(uiPage.getByRole('option', { name: /^后页任务 / })).toBeVisible();
    await releaseRpcGate(uiPage);
    await expect.poll(() => creationState(projects[1] as string, operationId)).toBe('complete');
    expect(
      (await client.call('tasks.list', { projectId: projects[1] as string })).tasks,
    ).toHaveLength(1);
    await expect(uiPage.getByRole('region', { name: '研究任务详情', exact: true })).toHaveCount(0);
    await expect(instruction).toHaveValue('当前项目未发送指令');
    await uiPage.getByRole('button', { name: '新建任务', exact: true }).click();
    await uiPage.getByRole('textbox', { name: '任务名称', exact: true }).fill('同项目迟到创建');
    await uiPage
      .getByRole('textbox', { name: '任务正文', exact: true })
      .fill('用户已选择其他任务时保留当前详情');
    await armRpcGate(uiPage, 'tasks.create');
    await uiPage.getByRole('button', { name: '创建任务', exact: true }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    const alphaOperationId = await uiPage.evaluate(
      () =>
        JSON.parse(Reflect.get(globalThis, '__scholoomRpcGate').held.payload).params
          .operationId as string,
    );
    await uiPage.getByRole('option', { name: /^后页任务 / }).click();
    const detail = uiPage.getByRole('region', { name: '研究任务详情', exact: true });
    await expect(detail.getByRole('heading', { name: '后页任务', exact: true })).toBeVisible();
    await releaseRpcGate(uiPage);
    await expect
      .poll(() => creationState(projects[0] as string, alphaOperationId))
      .toBe('complete');
    await expect(uiPage.getByRole('textbox', { name: '任务名称', exact: true })).toHaveCount(0);
    await expect(detail.getByRole('heading', { name: '后页任务', exact: true })).toBeVisible();
    await uiPage.getByRole('button', { name: '继续加载', exact: true }).click();
    await expect(uiPage.getByRole('option', { name: /^同项目迟到创建 / })).toBeVisible();
    await armRpcGate(uiPage, 'tasks.read');
    await uiPage.getByRole('option', { name: /^同项目迟到创建 / }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await uiPage.getByRole('tab', { name: /^后页任务 关闭/ }).click();
    await releaseAndRender(uiPage);
    await expect(detail.getByRole('heading', { name: '后页任务', exact: true })).toBeVisible();
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage
      .locator(`[data-session-id="${sessions[1]}"]`)
      .getByRole('button', { name: /^打开会话 / })
      .click();
    await uiPage.getByRole('tab', { name: '任务', exact: true }).click();
    await expect(uiPage.getByRole('textbox', { name: '任务名称', exact: true })).toHaveValue(title);
    await expect(
      uiPage
        .getByRole('region', { name: '研究任务', exact: true })
        .getByRole('status')
        .filter({ hasText: operationId }),
    ).toBeVisible();
    await expect(uiPage.getByRole('button', { name: '创建任务', exact: true })).toBeDisabled();
    await uiPage.getByRole('button', { name: '查询原创建操作', exact: true }).click();
    await expect(
      uiPage
        .getByRole('region', { name: '研究任务详情', exact: true })
        .getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    expect(
      (await client.call('tasks.list', { projectId: projects[1] as string })).tasks,
    ).toHaveLength(1);
    const receipt = await client.call('resources.creation', {
      projectId: projects[1] as string,
      operationId,
    });
    expect(receipt.state).toBe('complete');
  } finally {
    client.dispose();
  }
});
