import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { createDevelopmentKernel } from '../../apps/kernel/dist/bootstrap.js';
import { createKernelClient, type KernelClient } from '../../packages/client/dist/index.js';
import type {
  ContextItem,
  ResourceDescriptor,
  WorkbenchContextSnapshot,
} from '../../packages/protocol/dist/index.js';
import { delegationOutput } from '../fixtures/delegation-model.js';
import { runKernel, runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { createModelServer, type ModelServer } from '../model-server.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

const EXCERPT = 'Context bridge saved excerpt 73.';

test('catalog product ingestion correction and multiselection reach the original session tools and survive restart', async ({
  uiPage,
}, info) => {
  test.setTimeout(90000);
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR as string;
  const prefix = `catalog-context-${randomUUID().slice(0, 8)}`;
  const publications: WorkbenchContextSnapshot[] = [];
  uiPage.on('websocket', (socket) =>
    socket.on('framesent', ({ payload }) => {
      const request = JSON.parse(String(payload));
      if (request.method === 'workbench.context.publish' && request.params?.snapshot)
        publications.push(request.params.snapshot);
    }),
  );
  let model: ModelServer | undefined;
  let stop: (() => Promise<void>) | undefined;
  const owner = createDevelopmentKernel({ dataDirectory: directory });
  let releaseSecondRead = () => {};
  let client = createKernelClient(await runningKernel(directory));
  await client.connect();
  let stage = 'manual-ingestion';
  let manualRestartVerified = false;
  try {
    await client.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    const before = (await client.call('session.list', { projectId: 'application' })).sessions.map(
      (s) => s.id,
    );
    await createSession(uiPage);
    const session = (await client.call('session.list', { projectId: 'application' })).sessions.find(
      (s) => !before.includes(s.id),
    );
    assert(session);
    const scope = { projectId: 'application', sessionId: session.id };
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    const openDetails = async () => {
      const expand = uiPage.getByRole('button', { name: '展开右区', exact: true });
      if (await expand.isVisible()) await expand.click();
      await uiPage.getByRole('tab', { name: '文献详情', exact: true }).click();
    };
    await openDetails();
    // Numeric endpoints/circa follow CSL date_TextFormFulldateYearRange/date_Uncertain;
    // title and unknown nested extension are synthetic isolation/preservation markers.
    const imported = {
      title: `${prefix}-sample`,
      type: 'book',
      publisher: 'Original publisher',
      issued: {
        'date-parts': [
          [1987, 8, 3],
          [2003, 10, 23],
        ],
        circa: 1,
      },
      author: [{ family: 'Lovelace', given: 'Ada', extension: { order: [2, 1] } }],
      extension: { nested: ['keep', { enabled: false, count: 0, empty: null }] },
    };
    const corrected = {
      ...imported,
      publisher: 'Corrected publisher',
      issued: {
        'date-parts': [
          [1987, 8, 3],
          [2003, 10, 24],
        ],
        circa: 0,
      },
    };
    await panel.getByText('CSL JSON 导入', { exact: true }).click();
    await panel.getByLabel('选择 CSL JSON 文件', { exact: true }).setInputFiles({
      name: 'catalog-integration.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify([
          imported,
          ...Array.from({ length: 29 }, (_, i) => ({
            title: `${prefix}-${i}`,
            type: 'article-journal',
          })),
        ]),
      ),
    });
    await panel.getByRole('button', { name: '导入批次', exact: true }).click();
    await expect(panel.getByRole('status', { name: '批次进度' })).toContainText('已处理 30/30');
    await panel.getByText('CSL JSON 导入', { exact: true }).click();
    await panel.getByLabel('查找题录', { exact: true }).fill(imported.title);
    const source = (await client.call('library.list', { query: imported.title })).sources[0];
    assert(source);
    await panel.getByRole('option', { name: `查看题录 ${imported.title}`, exact: true }).click();
    await detail.getByText('类型化题录', { exact: true }).click();
    await detail.getByLabel('题录出版者', { exact: true }).fill(corrected.publisher);
    await detail.getByLabel('题录发表日期结束日', { exact: true }).fill('24');
    await detail.getByLabel('题录发表日期约略标记', { exact: true }).selectOption('false');
    await expect
      .poll(async () =>
        JSON.parse(await detail.getByLabel('题录 CSL JSON', { exact: true }).inputValue()),
      )
      .toEqual(corrected);
    const collectionName = `${prefix}-collection`;
    await panel.getByText('集合', { exact: true }).first().click();
    await panel.getByLabel('集合名称', { exact: true }).fill(collectionName);
    await panel.getByRole('button', { name: '创建集合', exact: true }).click();
    await detail.getByLabel(`集合 ${collectionName}`, { exact: true }).check();
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.get', { sourceId: source.id })).metadata)
      .toEqual(corrected);
    await panel.getByLabel('查找题录', { exact: true }).fill(prefix);
    const collection = (await client.call('library.collections', { limit: 100 })).collections.find(
      (c) => c.name === collectionName,
    );
    assert(collection);
    await panel.getByText('集合', { exact: true }).first().click();
    const nav = panel.getByRole('navigation', { name: '文献集合导航' });
    await nav.getByRole('button', { name: collectionName, exact: true }).click();
    await expect(panel.getByRole('listbox', { name: '题录列表' }).getByRole('option')).toHaveCount(
      1,
    );
    await nav.getByRole('button', { name: '全部题录', exact: true }).click();
    await panel.getByText('表格列设置', { exact: true }).click();
    await panel.getByLabel('作者列', { exact: true }).uncheck();
    await panel.getByLabel('题名列宽度', { exact: true }).fill('48');
    await panel.getByText('表格列设置', { exact: true }).click();
    const reconnect = async () => {
      const ready = await owner.bootstrap('ensure');
      assert(ready.state === 'running');
      client = createKernelClient(ready.endpoint);
      await client.connect();
      await uiPage.reload();
      await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
      await openDetails();
    };
    const restart = async () => {
      await client.shutdown();
      client.dispose();
      await expect.poll(async () => (await runKernel(directory, 'status')).state).toBe('stopped');
      await reconnect();
    };
    const verifySaved = async () => {
      const saved = await client.call('library.get', { sourceId: source.id });
      expect(saved.metadata).toEqual(corrected);
      expect(saved.collectionIds).toEqual([collection.id]);
      expect(saved.revision).toBe(source.revision + 1);
      await expect(panel.getByLabel('查找题录', { exact: true })).toHaveValue(prefix);
      await panel.getByText('表格列设置', { exact: true }).click();
      await expect(panel.getByLabel('作者列', { exact: true })).not.toBeChecked();
      await expect(panel.getByLabel('题名列宽度', { exact: true })).toHaveValue('48');
      await panel.getByText('表格列设置', { exact: true }).click();
      await panel.getByRole('listbox', { name: '题录列表' }).press('Home');
      await expect
        .poll(() => publications.at(-1)?.catalogSelection?.primarySourceId)
        .toBe(source.id);
      await expect
        .poll(async () =>
          JSON.parse(await detail.getByLabel('题录 CSL JSON', { exact: true }).inputValue()),
        )
        .toEqual(corrected);
    };
    stage = 'manual-restart';
    await restart();
    await verifySaved();
    manualRestartVerified = true;
    await info.attach('manual-restart', {
      body: JSON.stringify({
        sourceId: source.id,
        collectionId: collection.id,
        revision: source.revision + 1,
        verified: true,
      }),
      contentType: 'application/json',
    });
    stage = 'model-start';
    const secondReadReady = new Promise<void>((resolve) => {
      releaseSecondRead = resolve;
    });
    model = await createModelServer({
      respond: async ({ calls }) => {
        if (!calls.includes('read_workbench_context'))
          return { tool: { name: 'read_workbench_context', input: {} } };
        if (calls.filter((name) => name === 'read_workbench_context').length === 1) {
          await secondReadReady;
          return { tool: { name: 'read_workbench_context', input: {} } };
        }
        const request = model?.requests.at(-1);
        assert(request);
        const context = delegationOutput(request, 'read_workbench_context');
        if (!calls.includes('library_get'))
          return {
            tool: {
              name: 'library_get',
              input: { sourceId: context?.snapshot.catalogSelection.primarySourceId },
            },
          };
        return { text: '题录选择及保存内容已核对' };
      },
    });
    client.dispose();
    stop = await startModelKernel(directory, model.url);
    client = createKernelClient(await runningKernel(directory));
    await client.connect();
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await configureModel(uiPage);
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    const listbox = panel.getByRole('listbox', { name: '题录列表' });
    await listbox.getByRole('option').first().click();
    for (let i = 0; i < 16; i++) await listbox.press('Shift+ArrowDown');
    await expect.poll(() => publications.at(-1)?.catalogSelection?.items.length).toBe(17);
    expect(publications.at(-1)?.selections).toEqual([]);
    expect(publications.at(-1)?.receiver).toEqual(scope);
    stage = 'model-first-request';
    model.hold = true;
    await uiPage
      .getByRole('textbox', { name: '研究指令', exact: true })
      .fill('MODEL_CHAT current catalog');
    await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model?.requests.length).toBe(1);
    await panel.getByRole('button', { name: '下一页题录', exact: true }).click();
    const next = (await client.call('library.list', { query: prefix, offset: 25, limit: 25 }))
      .sources[0];
    assert(next);
    await panel
      .getByRole('option', { name: `查看题录 ${next.metadata.title}`, exact: true })
      .click();
    await expect.poll(() => publications.at(-1)?.catalogSelection?.primarySourceId).toBe(next.id);
    expect(publications.at(-1)?.receiver).toEqual(scope);
    model.release();
    await expect
      .poll(async () => {
        const snapshot = await client.call('workbench.snapshot', scope);
        return snapshot.messages.find((m) => m.tool?.name === 'read_workbench_context')?.tool
          ?.output;
      })
      .toBeTruthy();
    const paged = (await client.call('workbench.snapshot', scope)).messages.find(
      (m) => m.tool?.name === 'read_workbench_context',
    )?.tool?.output;
    expect(JSON.parse(paged ?? '{}')).toMatchObject({
      state: 'available',
      catalog: { items: [{ sourceId: next.id, state: 'current' }] },
      snapshot: {
        receiver: scope,
        catalogSelection: { range: { offset: 25 }, primarySourceId: next.id },
      },
    });
    await panel.getByRole('button', { name: '上一页题录', exact: true }).click();
    await listbox.press('Home');
    await expect.poll(() => publications.at(-1)?.catalogSelection?.primarySourceId).toBe(source.id);
    stage = 'real-tools';
    releaseSecondRead();
    await expect
      .poll(async () => (await client.call('workbench.snapshot', scope)).run?.state, {
        timeout: 20000,
      })
      .toBe('completed');
    const completed = await client.call('workbench.snapshot', scope);
    const receipts = completed.messages.filter((m) =>
      ['read_workbench_context', 'library_get'].includes(m.tool?.name ?? ''),
    );
    expect(receipts).toHaveLength(3);
    assert(completed.run);
    for (const receipt of receipts)
      expect(receipt).toMatchObject({
        sessionId: session.id,
        state: 'complete',
        tool: { runId: completed.run.id },
      });
    const output = completed.messages.findLast((m) => m.tool?.name === 'read_workbench_context')
      ?.tool?.output;
    expect(JSON.parse(output ?? '{}')).toMatchObject({
      state: 'available',
      catalog: { items: [{ sourceId: source.id, state: 'current' }] },
      snapshot: {
        receiver: scope,
        catalogSelection: { range: { offset: 0 }, primarySourceId: source.id },
      },
    });
    const finalRequest = model.requests.at(-1);
    assert(finalRequest);
    expect(delegationOutput(finalRequest, 'library_get')).toMatchObject({
      id: source.id,
      metadata: corrected,
    });
    stage = 'final-restart';
    client.dispose();
    const stopModel = stop;
    stop = undefined;
    await stopModel();
    await reconnect();
    await verifySaved();
    expect(
      (await client.call('workbench.snapshot', scope)).messages.filter((m) =>
        ['read_workbench_context', 'library_get'].includes(m.tool?.name ?? ''),
      ),
    ).toEqual(receipts);
    stage = 'completed';
  } finally {
    try {
      await info.attach('integration-stage', {
        body: JSON.stringify({
          stage,
          manualRestartVerified,
          modelRequests: model?.requests.length ?? 0,
        }),
        contentType: 'application/json',
      });
    } finally {
      releaseSecondRead();
      model?.release();
      client.dispose();
      const stopModel = stop;
      stop = undefined;
      try {
        await stopModel?.();
      } finally {
        try {
          await owner.dispose();
        } finally {
          await model?.close();
        }
      }
    }
  }
});

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
      const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
      await panel.getByLabel('查找题录', { exact: true }).fill(name);
      await panel.getByRole('option').filter({ hasText: name }).click();
      const expand = uiPage.getByRole('button', { name: '展开右区', exact: true });
      if (await expand.isVisible()) await expand.click();
      await uiPage.getByRole('tab', { name: '文献详情', exact: true }).click();
      const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
      await detail.getByRole('button', { name: `打开 文本 ${name}`, exact: true }).click();
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
  const project = test.info().outputPath(`context-${test.info().project.name}`);
  await mkdir(project, { recursive: true });
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
  }
});
test('a late send receipt keeps context added or commented after the send', async ({ uiPage }) => {
  test.setTimeout(90000);
  const project = test.info().outputPath(`context-late-${test.info().project.name}`);
  await mkdir(project, { recursive: true });
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
  }
});
