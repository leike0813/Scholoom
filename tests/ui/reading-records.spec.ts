import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { syntheticPdf } from '../pdf-fixture.js';
import { expect, test } from './fixture.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('shared reading notes preserve drafts, detect stale edits and retain missing-source excerpts', async ({
  uiPage,
}, info) => {
  test.setTimeout(120000);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  const root = await mkdtemp(join(tmpdir(), 'scholoom-reading-ui-'));
  const name = `reading-${randomUUID()}.pdf`;
  const path = join(root, name);
  const bytes = syntheticPdf();
  const instruction = '阅读笔记时保留的研究指令';
  try {
    await client.connect();
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await writeFile(path, bytes);
    const batch = await client.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [path],
      purpose: '正文',
      storage: 'linked',
      version: 'unspecified',
      origin: 'synthetic-reading-ui',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const receipt = (await client.call('library.batch', { batchId: batch.id })).entries[0];
    assert(receipt?.sourceId && receipt.attachmentId);
    const attachment = (await client.call('library.attachments', { sourceId: receipt.sourceId }))
      .attachments[0];
    assert(attachment);
    const material = {
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    };

    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    await uiPage.getByRole('textbox', { name: '研究指令' }).fill(instruction);
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    const library = uiPage.getByRole('region', { name: '文献库', exact: true });
    const openNotes = async () => {
      await library.getByLabel('查找题录', { exact: true }).fill(name);
      await library.getByRole('row').filter({ hasText: name }).click();
      await uiPage.getByRole('button', { name: `阅读记录 ${name}`, exact: true }).click();
    };
    await openNotes();
    const records = uiPage.getByRole('region', { name: '阅读记录', exact: true });
    const newNote = records.getByRole('textbox', { name: '新文献笔记', exact: true });
    await newNote.fill('刷新后仍保留的笔记草稿');
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openNotes();
    await expect(newNote).toHaveValue('刷新后仍保留的笔记草稿');
    await armRpcGate(uiPage, 'library.saveReadingRecord');
    await records.getByRole('button', { name: '保存文献笔记', exact: true }).click();
    await newNote.fill('保存期间追加的笔记草稿');
    await uiPage.getByRole('button', { name: `阅读记录 ${name}`, exact: true }).click();
    await uiPage.getByRole('button', { name: `阅读记录 ${name}`, exact: true }).click();
    await releaseRpcGate(uiPage);
    await expect
      .poll(async () => (await client.call('library.readingRecords', material)).records.length)
      .toBe(1);
    const note = (await client.call('library.readingRecords', material)).records[0];
    assert(note);
    expect(note).toMatchObject({ body: '刷新后仍保留的笔记草稿', createdBy: { kind: 'user' } });
    await expect(newNote).toHaveValue('保存期间追加的笔记草稿');
    await expect(records.getByRole('button', { name: '保存文献笔记', exact: true })).toBeEnabled();
    await records.getByRole('button', { name: `编辑阅读记录 ${note.id}`, exact: true }).click();
    const editor = records.getByRole('textbox', { name: '阅读记录说明', exact: true });
    await editor.fill('冲突时保留的本地说明');
    await client.call('library.saveReadingRecord', {
      recordId: note.id,
      ...material,
      expectedRevision: note.revision,
      kind: note.kind,
      quote: note.quote,
      body: '另一客户端保存的说明',
    });
    await uiPage.reload();
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openNotes();
    await records.getByRole('button', { name: `编辑阅读记录 ${note.id}`, exact: true }).click();
    await expect(editor).toHaveValue('冲突时保留的本地说明');
    await records.getByRole('button', { name: '保存阅读记录', exact: true }).click();
    await expect(records.getByRole('alert')).toBeVisible();
    await expect(editor).toHaveValue('冲突时保留的本地说明');
    expect((await client.call('library.readingRecord', { recordId: note.id })).body).toBe(
      '另一客户端保存的说明',
    );
    await records.getByRole('button', { name: '重新读取阅读记录', exact: true }).click();
    await expect(editor).toHaveValue('冲突时保留的本地说明');
    await records.getByRole('button', { name: '保存阅读记录', exact: true }).click();
    await expect
      .poll(
        async () => (await client.call('library.readingRecord', { recordId: note.id })).revision,
      )
      .toBe(3);
    await records.getByRole('button', { name: `查看阅读记录历史 ${note.id}`, exact: true }).click();
    const history = records.getByRole('region', { name: '阅读记录历史', exact: true });
    await expect(history).toContainText('另一客户端保存的说明');
    await expect(history).toContainText('刷新后仍保留的笔记草稿');

    await newNote.fill('回执未知时提交的原始笔记');
    await armRpcGate(uiPage, 'library.saveReadingRecord');
    await records.getByRole('button', { name: '保存文献笔记', exact: true }).click();
    await newNote.fill('回执未知期间追加的草稿');
    const verify = records.getByRole('button', { name: '核查笔记保存结果', exact: true });
    await expect(verify).toBeEnabled({ timeout: 15000 });
    await releaseRpcGate(uiPage);
    await expect
      .poll(async () =>
        (await client.call('library.readingRecords', material)).records.some(
          (record) => record.body === '回执未知时提交的原始笔记',
        ),
      )
      .toBe(true);
    await verify.click();
    await expect(newNote).toHaveValue('回执未知期间追加的草稿');
    const recovered = (await client.call('library.readingRecords', material)).records.filter(
      (record) => record.body === '回执未知时提交的原始笔记',
    );
    expect(recovered).toHaveLength(1);

    const quoteNote = await client.call('library.saveReadingRecord', {
      recordId: randomUUID(),
      ...material,
      kind: 'note',
      quote: 'Scholoom PDF evidence 42',
      body: '原文摘录与说明分开保存',
    });
    await expect(records).toContainText(quoteNote.quote);
    await rename(path, join(root, 'moved.pdf'));
    await uiPage.getByRole('button', { name: '重新读取附件', exact: true }).click();
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    await expect(detail).toContainText('缺失');
    await expect(records).toContainText(quoteNote.quote);
    await records
      .getByRole('button', { name: `编辑阅读记录 ${quoteNote.id}`, exact: true })
      .click();
    await editor.fill('原文暂不可达，保留已有依据');
    await records.getByRole('button', { name: '保存阅读记录', exact: true }).click();
    await expect
      .poll(
        async () => (await client.call('library.readingRecord', { recordId: quoteNote.id })).body,
      )
      .toBe('原文暂不可达，保留已有依据');
    await expect(records.getByRole('button', { name: '保存文献笔记', exact: true })).toBeDisabled();
    await records.getByRole('button', { name: `移除阅读记录 ${note.id}`, exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.readingRecord', { recordId: note.id })).deleted)
      .toBe(true);
    expect(
      (await client.call('library.readingRecords', material)).records
        .map((record) => record.id)
        .sort(),
    ).toEqual([quoteNote.id, recovered[0]?.id].sort());
    await expect(uiPage.getByRole('textbox', { name: '研究指令' })).toHaveValue(instruction);
    expect(await readFile(join(root, 'moved.pdf'))).toEqual(bytes);
    await uiPage.screenshot({ path: info.outputPath('reading-records.png'), fullPage: true });
  } finally {
    client.dispose();
    await rm(root, { recursive: true });
  }
});
