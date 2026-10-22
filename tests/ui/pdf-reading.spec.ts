import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { syntheticPdf } from '../pdf-fixture.js';
import { createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('local PDF reader shares selected highlights, bookmarks and notes through the kernel', async ({
  uiPage,
}, info) => {
  test.setTimeout(120000);
  uiPage.setDefaultTimeout(15000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-pdf-ui-'));
  const name = `pdf-${randomUUID()}.pdf`;
  const path = join(root, name);
  const bytes = syntheticPdf();
  const external: string[] = [];
  const errors: string[] = [];
  uiPage.on('pageerror', (error) => errors.push(error.message));
  await uiPage.route(/^https?:\/\/(?!127\.0\.0\.1:)/, (route) => route.abort());
  uiPage.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:'))
      external.push(request.url());
  });
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
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
      origin: 'synthetic-pdf-ui',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const receipt = (await client.call('library.batch', { batchId: batch.id })).entries[0];
    assert(receipt?.sourceId);
    const material = (await client.call('library.attachments', { sourceId: receipt.sourceId }))
      .attachments[0];
    assert(material);
    const reference = { attachmentId: material.id, materialVersionId: material.materialVersionId };
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await expect(
      uiPage.getByRole('button', { name: '普通会话，已展开', exact: true }),
    ).toBeVisible();
    await createSession(uiPage);
    const instruction = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
    await instruction.fill('PDF 阅读期间保留的研究指令');
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    const open = async () => {
      await uiPage.getByLabel('查找题录', { exact: true }).fill(name);
      await uiPage.getByRole('row').filter({ hasText: name }).click();
      await uiPage.getByRole('button', { name: `打开 PDF ${name}`, exact: true }).click();
    };
    await open();
    const reader = uiPage.getByRole('region', { name: `PDF 阅读 ${name}`, exact: true });
    await expect(reader.getByRole('button', { name: 'Search', exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(reader.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 10000 });
    const sdk = reader.locator('embedpdf-container');
    await sdk.getByRole('button', { name: 'Search', exact: true }).click();
    await sdk.locator('input[placeholder]').fill('Scholoom PDF evidence 42');
    await expect(sdk.getByText('Scholoom PDF evidence 42', { exact: true }).first()).toBeVisible();
    await uiPage.screenshot({ path: info.outputPath('pdf-reader-search.png') });
    await sdk.click({ position: { x: 8, y: 8 } });
    await expect(sdk.getByRole('textbox', { name: 'Search', exact: true })).not.toBeVisible();
    await uiPage.screenshot({ path: info.outputPath('pdf-reader-loaded.png') });
    const records = reader.getByRole('region', { name: '阅读记录', exact: true });
    const image = reader.locator('img[src^="blob:"]').first();
    const box = await image.boundingBox();
    assert(box);
    await uiPage.mouse.move(box.x + (box.width * 70) / 612, box.y + (box.height * 66) / 792);
    await uiPage.mouse.down();
    await uiPage.mouse.move(box.x + (box.width * 230) / 612, box.y + (box.height * 66) / 792, {
      steps: 12,
    });
    await uiPage.mouse.up();
    await reader.getByRole('button', { name: '保留第 1 页选区', exact: true }).click();
    await records.getByRole('textbox', { name: '新文献笔记', exact: true }).fill('用户高亮说明');
    await records.getByRole('button', { name: '保存高亮', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.readingRecords', reference)).records.length)
      .toBe(1);
    const highlight = (await client.call('library.readingRecords', reference)).records[0];
    expect(highlight).toMatchObject({
      kind: 'highlight',
      quote: 'Scholoom PDF evidence 42',
      createdBy: { kind: 'user' },
      location: { pageIndex: 0 },
    });
    await reader.getByText('共同阅读记录', { exact: true }).click();
    await sdk.getByRole('button', { name: 'Next Page', exact: true }).click();
    await expect(
      reader.getByRole('button', { name: '标记第 2 页书签', exact: true }),
    ).toBeVisible();
    const rotatedImage = sdk.locator('img[src^="blob:"][style*="width: 100%"]');
    await expect(rotatedImage).toHaveCount(2);
    await expect(rotatedImage.nth(1)).toBeVisible();
    await rotatedImage.nth(1).scrollIntoViewIfNeeded();
    const pageImage = await rotatedImage.nth(1).boundingBox();
    assert(pageImage);
    await uiPage.screenshot({ path: info.outputPath('pdf-reader-rotated.png') });
    await uiPage.mouse.move(
      pageImage.x + (pageImage.width * 503) / 600,
      pageImage.y + (pageImage.height * 48) / 400,
    );
    await uiPage.mouse.down();
    await uiPage.mouse.move(
      pageImage.x + (pageImage.width * 503) / 600,
      pageImage.y + (pageImage.height * 235) / 400,
      { steps: 14 },
    );
    await uiPage.mouse.up();
    await reader.getByRole('button', { name: '保留第 2 页选区', exact: true }).click();
    await reader.getByText('共同阅读记录', { exact: true }).click();
    await records.getByRole('button', { name: '保存高亮', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.readingRecords', reference)).records.length)
      .toBe(2);
    const rotated = (await client.call('library.readingRecords', reference)).records.find(
      (record) =>
        record.kind === 'highlight' &&
        record.location &&
        'pageIndex' in record.location &&
        record.location.pageIndex === 1,
    );
    expect(rotated?.quote).toBe('Second page controlled result 73');
    assert(rotated?.location && 'pageIndex' in rotated.location);
    expect(rotated.location.rects?.[0]?.x).toBeGreaterThan(480);
    await expect
      .poll(() =>
        sdk.evaluate(async (el, id) => {
          const registry = await Reflect.get(el, 'registry');
          const annotations = registry.getPlugin('annotation').provides();
          for (const item of annotations.getAnnotations())
            if (item.object.id === `scholoom:${id}`) return item.object.rect.origin.x;
          return undefined;
        }, rotated.id),
      )
      .toBeCloseTo(50, 0);
    await sdk.click({ position: { x: 20, y: 100 } });
    await uiPage.screenshot({ path: info.outputPath('pdf-reader-projected-highlight.png') });
    await reader.getByRole('button', { name: '标记第 2 页书签', exact: true }).click();
    await records.getByRole('button', { name: '保存书签', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.readingRecords', reference)).records.length)
      .toBe(3);
    const note = records.getByRole('textbox', { name: '新文献笔记', exact: true });
    await note.fill('阅读器中的文献笔记');
    const original = (await client.call('session.list', { projectId: 'application', limit: 1 }))
      .sessions[0];
    assert(original);
    const title = `PDF原会话-${randomUUID()}`;
    await client.call('session.rename', {
      projectId: 'application',
      sessionId: original.id,
      title,
    });
    const otherTitle = `PDF另一会话-${randomUUID()}`;
    const otherProject = await client.call('project.open', { path: root, trust: 'restricted' });
    await client.call('session.create', { projectId: otherProject.id, title: otherTitle });
    await uiPage.getByRole('button', { name: `${otherProject.name}，已折叠`, exact: true }).click();
    await uiPage.getByRole('button', { name: `打开会话 ${otherTitle}`, exact: true }).click();
    await expect(note).toHaveValue('阅读器中的文献笔记');
    await expect(
      reader.getByRole('button', { name: '标记第 2 页书签', exact: true }),
    ).toBeVisible();
    await uiPage.getByRole('button', { name: `打开会话 ${title}`, exact: true }).click();
    await expect(instruction).toHaveValue('PDF 阅读期间保留的研究指令');
    await records.getByRole('button', { name: '保存文献笔记', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.readingRecords', reference)).records.length)
      .toBe(4);
    await uiPage.screenshot({ path: info.outputPath('pdf-reader-records.png') });
    expect(external).toEqual([]);
    expect(await readFile(path)).toEqual(bytes);
    await uiPage.getByRole('button', { name: `关闭 ${name}`, exact: true }).click();
    await expect(reader).toHaveCount(0);
    await expect
      .poll(() => uiPage.workers().filter((worker) => worker.url().startsWith('blob:')).length)
      .toBe(0);
    await expect(instruction).toHaveValue('PDF 阅读期间保留的研究指令');
    await uiPage.getByRole('tab', { name: '文献库' }).click();
    await open();
    await expect(reader.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 30000 });
    await expect(records).toContainText('阅读器中的文献笔记');
    expect((await client.call('library.readingRecords', reference)).records).toHaveLength(4);
    await rename(path, `${path}.moved`);
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await expect(reader.getByRole('alert')).toBeVisible();
    await expect(records).toContainText('Scholoom PDF evidence 42');
    for (const button of await records.getByRole('button', { name: /^定位第/ }).all())
      await expect(button).toBeDisabled();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    client.dispose();
    await rm(root, { recursive: true });
  }
});
