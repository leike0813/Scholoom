/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { epubFixture, htmlFixture } from '../document-fixture.js';
import { runningKernel } from '../kernel-fixture.js';
import { createSession, expect, test } from './fixture.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

for (const format of ['epub', 'html'] as const) {
  test(`${format} reader shares real selections and resources through the product entry`, async ({
    uiPage,
  }, info) => {
    test.setTimeout(120000);
    uiPage.setDefaultTimeout(15000);
    const root = await mkdtemp(join(tmpdir(), 'scholoom-document-ui-'));
    const name = `${format}-${randomUUID()}.${format}`;
    const path = join(root, name);
    const embedded = /src="(data:[^"]+)"/.exec(htmlFixture)?.[1];
    assert(embedded);
    const bytes =
      format === 'epub'
        ? epubFixture()
        : Buffer.from(
            htmlFixture.replace(
              '</body>',
              `${Array.from({ length: 19 }, (_, i) => `<img src="${embedded}" alt="附图${i}"/>`).join('')}<p>😀${'a'.repeat(16383)}needle_navigation</p></body>`,
            ),
          );
    const errors: string[] = [];
    const external: string[] = [];
    await uiPage.addInitScript(() => {
      const urls = new Set<string>();
      Reflect.set(window, '__documentUrls', urls);
      const create = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (value) => {
        const url = create(value);
        urls.add(url);
        return url;
      };
      URL.revokeObjectURL = (value) => {
        urls.delete(value);
        revoke(value);
      };
    });
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
      await installRpcGate(uiPage);
      await client.connect();
      await client.call('library.grant', {
        read: true,
        write: true,
        send: false,
        autoBackup: false,
      });
      await writeFile(path, bytes);
      const batch = await client.call('library.importFiles', {
        batchId: randomUUID(),
        paths: [path],
        storage: 'linked',
        purpose: '正文',
        version: 'unspecified',
        origin: 'synthetic-document-ui',
      });
      await expect
        .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const receipt = (await client.call('library.batch', { batchId: batch.id })).entries[0];
      assert(receipt?.sourceId);
      const material = (await client.call('library.attachments', { sourceId: receipt.sourceId }))
        .attachments[0];
      assert(material);
      const reference = {
        attachmentId: material.id,
        materialVersionId: material.materialVersionId,
      };
      await uiPage.goto('http://127.0.0.1:5174/');
      await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await createSession(uiPage);
      const composer = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
      await composer.fill('阅读期间保留的指令草稿');
      await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
      await uiPage.getByLabel('查找题录', { exact: true }).fill(name);
      await uiPage.getByRole('row').filter({ hasText: name }).click();
      const open = uiPage.getByRole('button', {
        name: `打开 ${format === 'epub' ? 'EPUB' : '网页'} ${name}`,
        exact: true,
      });
      await open.click();
      const reader = uiPage.getByRole('region', { name: `文档阅读 ${name}`, exact: true });
      const article = reader.getByRole('article', { name: '文档正文', exact: true });
      const quote = format === 'epub' ? 'Scholoom 文献 evidence 42.' : 'Local HTML evidence 91.';
      await expect(article).toContainText(quote);
      const points = await article.evaluate((element, quote) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const entries: { node: Node; start: number; end: number }[] = [];
        let text = '';
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const start = text.length;
          text += node.textContent ?? '';
          entries.push({ node, start, end: text.length });
        }
        const start = text.indexOf(quote);
        if (start < 0) throw new Error('Known quote not rendered');
        const first = entries.find((e) => start >= e.start && start < e.end);
        const last = entries.find(
          (e) => start + quote.length > e.start && start + quote.length <= e.end,
        );
        if (!first || !last) throw new Error('Quote nodes missing');
        const from = document.createRange();
        from.setStart(first.node, start - first.start);
        from.setEnd(first.node, start - first.start + 1);
        const to = document.createRange();
        to.setStart(last.node, start + quote.length - last.start - 1);
        to.setEnd(last.node, start + quote.length - last.start);
        const a = from.getBoundingClientRect(),
          b = to.getBoundingClientRect();
        return { x1: a.x + 0.2, y1: a.y + a.height / 2, x2: b.right - 0.2, y2: b.y + b.height / 2 };
      }, quote);
      await uiPage.mouse.move(points.x1, points.y1);
      await uiPage.mouse.down();
      await uiPage.mouse.move(points.x2, points.y2, { steps: 12 });
      await uiPage.mouse.up();
      await reader.getByRole('button', { name: '保留选区', exact: true }).click();
      const records = reader.getByRole('region', { name: '阅读记录', exact: true });
      const note = records.getByRole('textbox', { name: '新文献笔记', exact: true });
      if (!(await note.isVisible()))
        await reader.getByText('共同阅读记录', { exact: true }).click();
      await note.fill('跨节点摘录的用户说明');
      await records.getByRole('button', { name: '保存高亮', exact: true }).click();
      await expect
        .poll(async () => (await client.call('library.readingRecords', reference)).records.length)
        .toBe(1);
      const highlight = (await client.call('library.readingRecords', reference)).records[0];
      assert(highlight);
      expect(highlight).toMatchObject({
        quote,
        createdBy: { kind: 'user' },
        location: { kind: 'text', normalizationVersion: 1 },
      });
      await expect(article.locator('mark').first()).toBeVisible();
      await reader.getByRole('button', { name: '添加书签', exact: true }).click();
      await records.getByRole('button', { name: '保存书签', exact: true }).click();
      await expect
        .poll(async () => (await client.call('library.readingRecords', reference)).records.length)
        .toBe(2);
      if (format === 'epub') {
        await reader.getByRole('textbox', { name: '搜索文档', exact: true }).fill('result 73');
        await reader.getByRole('button', { name: '搜索文档', exact: true }).click();
        await reader
          .getByRole('region', { name: '文档搜索结果', exact: true })
          .getByRole('button')
          .filter({ hasText: 'result 73' })
          .first()
          .click();
        await expect(article).toContainText('result 73');
        await expect(reader.getByRole('combobox', { name: '文档章节' })).toHaveValue(
          'OPS/ch2.xhtml',
        );
      }
      await expect(reader.locator('img[src^="blob:"]').first()).toBeVisible();
      expect(
        await reader
          .locator('img[src^="blob:"]')
          .first()
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      ).toBe(1);
      if (format === 'html') {
        await reader
          .getByRole('button', { name: /^显示图片/ })
          .last()
          .click();
        await expect(reader.getByRole('img', { name: '附图18', exact: true })).toBeVisible();
        await reader
          .getByRole('textbox', { name: '搜索文档', exact: true })
          .fill('needle_navigation');
        await reader.getByRole('button', { name: '搜索文档', exact: true }).click();
        await reader
          .getByRole('region', { name: '文档搜索结果' })
          .getByRole('button')
          .filter({ hasText: 'needle_navigation' })
          .first()
          .click();
        await expect(article).toContainText('needle_navigation');
        await reader.getByRole('button', { name: '上一段', exact: true }).click();
        await expect(article).toContainText(quote);
      }
      expect(await uiPage.evaluate(() => Reflect.get(window, '__unsafeDocument'))).toBeUndefined();
      await uiPage.screenshot({ path: info.outputPath(`document-${format}-reader.png`) });
      await expect(composer).toHaveValue('阅读期间保留的指令草稿');
      await uiPage.getByRole('button', { name: `关闭 ${name}`, exact: true }).click();
      await expect
        .poll(() =>
          uiPage.evaluate(() => (Reflect.get(window, '__documentUrls') as Set<string>).size),
        )
        .toBe(0);
      await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
      await uiPage.getByLabel('查找题录', { exact: true }).fill(name);
      await uiPage.getByRole('row').filter({ hasText: name }).click();
      await open.click();
      await expect(records).toContainText('跨节点摘录的用户说明');
      await reader.getByRole('textbox', { name: '搜索文档', exact: true }).fill('evidence');
      await armRpcGate(uiPage, 'resources.document', 'searchDocument');
      await reader.getByRole('button', { name: '搜索文档', exact: true }).click();
      await uiPage.evaluate(() => {
        const gate = Reflect.get(globalThis, '__scholoomRpcGate');
        const held = gate.held;
        Reflect.set(globalThis, '__searchReplySeen', false);
        held.socket.addEventListener('message', function receive(event: MessageEvent) {
          const value = JSON.parse(event.data);
          if (value.id === held.id) {
            Reflect.set(globalThis, '__searchReplySeen', true);
            held.socket.removeEventListener('message', receive);
          }
        });
      });
      await client.call('library.grant', {
        read: false,
        write: false,
        send: false,
        autoBackup: false,
      });
      await expect(reader.getByRole('alert')).toContainText('授权');
      await expect(article).toHaveCount(0);
      await expect(records).not.toContainText('跨节点摘录的用户说明');
      await expect(
        records.getByRole('button', { name: '保存文献笔记', exact: true }),
      ).toBeDisabled();
      await expect(reader.getByRole('region', { name: '文档搜索结果' })).toHaveCount(0);
      await client.call('library.grant', {
        read: true,
        write: true,
        send: false,
        autoBackup: false,
      });
      await expect(article).toContainText(quote);
      await releaseRpcGate(uiPage);
      await expect
        .poll(() => uiPage.evaluate(() => Reflect.get(globalThis, '__searchReplySeen')))
        .toBe(true);
      await expect(reader.getByRole('region', { name: '文档搜索结果' })).toHaveCount(0);
      expect(await readFile(path)).toEqual(bytes);
      await rename(path, `${path}.moved`);
      await records.getByRole('button', { name: /^定位/ }).first().click();
      await expect(reader.getByRole('button', { name: '添加书签', exact: true })).toBeDisabled();
      await expect(records.getByRole('button', { name: /^定位/ }).first()).toBeDisabled();
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    } finally {
      client.dispose();
      await rm(root, { recursive: true });
    }
  });
}
