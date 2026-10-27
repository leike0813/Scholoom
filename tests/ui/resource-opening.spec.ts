import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { epubFixture, htmlFixture } from '../document-fixture.js';
import { runningKernel } from '../kernel-fixture.js';
import { syntheticPdf } from '../pdf-fixture.js';
import { addProject, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('project documents and library text share opening while project sessions and drafts stay independent', async ({
  uiPage,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-ui-'));
  const token = randomUUID().slice(0, 8);
  const alpha = join(root, `alpha-${token}`);
  const beta = join(root, `beta-${token}`);
  await mkdir(alpha);
  await mkdir(beta);
  await writeFile(join(alpha, 'note.md'), '# Project saved\n');
  await writeFile(join(alpha, 'linker.md'), '[Open linked file](linked.md)\n');
  await writeFile(join(alpha, 'linked.md'), 'Original linked content\n');
  await writeFile(join(alpha, 'paper.pdf'), syntheticPdf());
  await writeFile(join(alpha, 'paper.epub'), epubFixture(3));
  await writeFile(join(alpha, 'paper.html'), htmlFixture);
  const libraryName = `library-${token}.md`;
  const libraryPath = join(root, libraryName);
  await writeFile(libraryPath, '# Library readonly\n');
  const errors: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  await client.connect();
  try {
    const first = await client.call('project.open', { path: alpha, trust: 'restricted' });
    const second = await client.call('project.open', { path: beta, trust: 'restricted' });
    await client.call('session.create', { projectId: first.id, title: `Resource Alpha ${token}` });
    await client.call('session.create', { projectId: second.id, title: `Resource Beta ${token}` });
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const batch = await client.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [libraryPath],
      storage: 'managed',
      purpose: '正文',
      version: 'unspecified',
      origin: 'resource-ui',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const entry = (await client.call('library.batch', { batchId: batch.id })).entries[0];
    assert(entry?.attachmentId && entry.sourceId);
    const sourceId = entry.sourceId;
    await installRpcGate(uiPage);
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await addProject(uiPage, alpha, { trust: 'restricted' });
    await addProject(uiPage, beta, { trust: 'restricted' });
    const alphaSession = uiPage.getByRole('button', {
      name: `打开会话 Resource Alpha ${token}`,
      exact: true,
    });
    const betaSession = uiPage.getByRole('button', {
      name: `打开会话 Resource Beta ${token}`,
      exact: true,
    });
    await alphaSession.click();
    const instruction = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
    await instruction.fill('Keep project instruction');
    await uiPage.getByRole('treeitem', { name: '打开文件 note.md', exact: true }).dblclick();
    const source = uiPage.getByRole('textbox', { name: '文件内容 note.md', exact: true });
    await expect(source).toContainText('Project saved');
    await source.fill('# Project unsaved draft\n');
    for (const name of ['paper.pdf', 'paper.epub', 'paper.html']) {
      await uiPage.getByRole('treeitem', { name: `打开文件 ${name}`, exact: true }).dblclick();
      const reader = uiPage.getByRole('region', {
        name: name.endsWith('.pdf') ? `PDF 阅读 ${name}` : `文档阅读 ${name}`,
        exact: true,
      });
      if (name.endsWith('.pdf'))
        await expect(reader.getByRole('button', { name: 'Search', exact: true })).toBeVisible({
          timeout: 30000,
        });
      else
        await expect(reader.getByRole('article', { name: '文档正文', exact: true })).toContainText(
          'evidence',
        );
      await expect(reader.getByRole('region', { name: '阅读记录', exact: true })).toHaveCount(0);
      await expect(alphaSession).toHaveAttribute('aria-pressed', 'true');
      await expect(instruction).toHaveValue('Keep project instruction');
    }
    await uiPage.getByRole('treeitem', { name: '打开文件 linker.md', exact: true }).dblclick();
    await uiPage.getByRole('button', { name: '预览', exact: true }).click();
    await uiPage.getByRole('link', { name: 'Open linked file', exact: true }).click();
    const linked = uiPage.getByRole('textbox', { name: '文件内容 linked.md', exact: true });
    await expect(linked).toContainText('Original linked content');
    await linked.fill('Draft belongs to original identity\n');
    const original = await client.call('files.read', { projectId: first.id, path: 'linked.md' });
    assert(original.fileId);
    await client.call('files.rename', {
      projectId: first.id,
      path: 'linked.md',
      name: 'moved-linked.md',
      expectedFileId: original.fileId,
      operationId: randomUUID(),
    });
    await client.call('files.save', {
      projectId: first.id,
      path: 'linked.md',
      content: 'Replacement must remain intact\n',
    });
    await expect(
      uiPage.getByRole('textbox', { name: '文件内容 moved-linked.md', exact: true }),
    ).toContainText('Draft belongs to original identity');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).click();
    await expect
      .poll(() => readFile(join(alpha, 'moved-linked.md'), 'utf8'))
      .toBe('Draft belongs to original identity\n');
    expect(await readFile(join(alpha, 'linked.md'), 'utf8')).toBe(
      'Replacement must remain intact\n',
    );
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    await panel.getByLabel('查找题录', { exact: true }).fill(libraryName);
    await panel.getByRole('option').filter({ hasText: libraryName }).click();
    const expand = uiPage.getByRole('button', { name: '展开右区', exact: true });
    if (await expand.isVisible()) await expand.click();
    const detailsTab = uiPage.getByRole('tab', { name: '文献详情', exact: true });
    await detailsTab.click();
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    const json = detail.getByLabel('题录 CSL JSON', { exact: true });
    const libraryRecord = await client.call('library.get', { sourceId });
    const metadataDraft = {
      ...libraryRecord.metadata,
      extension: { nested: ['Preserved across auxiliary and project switches'] },
    };
    await expect
      .poll(async () => JSON.parse(await json.inputValue()))
      .toEqual(libraryRecord.metadata);
    await json.fill(JSON.stringify(metadataDraft));
    await uiPage.getByRole('button', { name: '折叠右区', exact: true }).click();
    await expect(uiPage.getByRole('complementary', { name: '辅助区（已折叠）' })).toBeVisible();
    await expand.click();
    await expect(detailsTab).toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(metadataDraft);
    const auxiliary = uiPage.getByRole('complementary', { name: '辅助面板', exact: true });
    await auxiliary.getByRole('tab', { name: '任务', exact: true }).click();
    await expect(auxiliary.getByRole('region', { name: '任务', exact: true })).toBeVisible();
    await auxiliary.getByRole('tab', { name: '文件', exact: true }).click();
    await expect(auxiliary.getByRole('region', { name: '文件', exact: true })).toBeVisible();
    await detailsTab.click();
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(metadataDraft);
    await uiPage.getByRole('button', { name: '项目程序运行', exact: true }).first().click();
    await expect(uiPage.getByRole('region', { name: '项目程序运行', exact: true })).toBeVisible();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(metadataDraft);
    expect((await client.call('library.get', { sourceId })).metadata).toEqual(
      libraryRecord.metadata,
    );
    await detail.getByRole('button', { name: `打开 文本 ${libraryName}`, exact: true }).click();
    const librarySource = uiPage.getByRole('textbox', {
      name: `文件内容 ${libraryName}`,
      exact: true,
    });
    await expect(librarySource).toContainText('Library readonly');
    await expect(librarySource).toHaveAttribute('contenteditable', 'false');
    await expect(uiPage.getByRole('button', { name: '保存文件', exact: true })).toHaveCount(0);
    await uiPage.getByText('共同阅读记录', { exact: true }).click();
    const records = uiPage.getByRole('region', { name: '阅读记录', exact: true });
    await records
      .getByRole('textbox', { name: '新文献笔记', exact: true })
      .fill('Library text note');
    await records.getByRole('button', { name: '保存文献笔记', exact: true }).click();
    await expect(records).toContainText('Library text note');
    const attachment = await client.call('library.attachment', {
      attachmentId: entry.attachmentId,
    });
    await expect
      .poll(async () =>
        (
          await client.call('library.readingRecords', {
            attachmentId: attachment.id,
            materialVersionId: attachment.materialVersionId,
          })
        ).records.map((record) => record.body),
      )
      .toContain('Library text note');
    expect(await readFile(libraryPath, 'utf8')).toBe('# Library readonly\n');
    await client.call('library.grant', {
      read: false,
      write: false,
      send: false,
      autoBackup: false,
    });
    await expect(librarySource).toHaveCount(0);
    await expect(records).not.toContainText('Library text note');
    await uiPage.getByRole('tab', { name: /note\.md/ }).click();
    await armRpcGate(uiPage, 'resources.describe');
    await uiPage.getByRole('tab', { name: new RegExp(libraryName.replace('.', '\\.')) }).click();
    await uiPage.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await expect(librarySource).toHaveCount(0);
    await releaseRpcGate(uiPage);
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await expect(librarySource).toContainText('Library readonly');
    await uiPage.getByText('共同阅读记录', { exact: true }).click();
    await expect(records).toContainText('Library text note');
    await expect(alphaSession).toHaveAttribute('aria-pressed', 'true');
    await expect(instruction).toHaveValue('Keep project instruction');
    await betaSession.click();
    await expect(
      uiPage.getByRole('tab', { name: new RegExp(libraryName.replace('.', '\\.')) }),
    ).toBeVisible();
    await uiPage.getByRole('tab', { name: new RegExp(libraryName.replace('.', '\\.')) }).click();
    await expect(librarySource).toContainText('Library readonly');
    await expect(betaSession).toHaveAttribute('aria-pressed', 'true');
    await alphaSession.click();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    if (await expand.isVisible()) await expand.click();
    await detailsTab.click();
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(metadataDraft);
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.get', { sourceId })).metadata)
      .toEqual(metadataDraft);
    await expect(alphaSession).toHaveAttribute('aria-pressed', 'true');
    await uiPage.getByRole('tab', { name: /note\.md/ }).click();
    await expect(source).toContainText('Project unsaved draft');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).click();
    await expect
      .poll(() => readFile(join(alpha, 'note.md'), 'utf8'))
      .toBe('# Project unsaved draft\n');
    await expect(instruction).toHaveValue('Keep project instruction');
    await uiPage.screenshot({ path: info.outputPath('shared-resources.png') });
    expect(errors).toEqual([]);
  } finally {
    client.dispose();
  }
});
