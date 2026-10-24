import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import type { KernelClient } from '../../packages/client/dist/index.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

type Call = { method: string; params: Record<string, unknown> };

const DRAFT = '摄取本机材料时保留的指令草稿';

/** 记录实际发出的 RPC，核对分段读取只在用户动作后发生。 */
async function recordCalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: { method: string; params: Record<string, unknown> }[] = [];
    Reflect.set(globalThis, '__scholoomRpcCalls', calls);
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (payload) {
      if (typeof payload === 'string') {
        try {
          const message = JSON.parse(payload) as { method?: unknown; params?: unknown };
          if (typeof message.method === 'string')
            calls.push({
              method: message.method,
              params: (message.params ?? {}) as Record<string, unknown>,
            });
        } catch {
          // 非 JSON 负载不属于业务调用。
        }
      }
      return send.call(this, payload);
    };
  });
}

const callsOf = (page: Page): Promise<Call[]> =>
  page.evaluate(() => {
    const recorded = Reflect.get(globalThis, '__scholoomRpcCalls') as Call[] | undefined;
    return recorded ?? [];
  });

const formOf = (scope: Locator, summary: string): Locator =>
  scope.locator('details', { hasText: summary });

async function openLibrary(page: Page, client: KernelClient): Promise<Locator> {
  await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await createSession(page);
  await page.getByRole('textbox', { name: '研究指令' }).fill(DRAFT);
  await page.getByRole('button', { name: '文献库', exact: true }).click();
  const panel = page.getByRole('region', { name: '文献库', exact: true });
  await panel.getByText('文献库授权与备份', { exact: true }).click();
  await panel.getByLabel('读取库', { exact: true }).check();
  await panel.getByLabel('写入库', { exact: true }).check();
  await panel.getByRole('button', { name: '保存库授权', exact: true }).click();
  await expect.poll(async () => (await client.call('library.status', {})).write).toBe(true);
  return panel;
}

async function importMaterials(
  form: Locator,
  submit: string,
  paths: string[],
  purpose: string,
  storage: string,
): Promise<void> {
  await form.getByLabel('本机文件路径', { exact: true }).fill(paths.join('\n'));
  await form.getByLabel('附件用途', { exact: true }).selectOption({ label: purpose });
  await form.getByLabel('托管方式', { exact: true }).selectOption({ label: storage });
  await form.getByRole('button', { name: submit, exact: true }).click();
}

async function selectSource(page: Page, panel: Locator, title: string): Promise<Locator> {
  await panel.getByLabel('查找题录', { exact: true }).fill(title);
  await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
  return page.getByRole('region', { name: '题录详情', exact: true });
}

test('用户摄取本机材料、添加多用途附件、分页查看并下载原字节', async ({
  uiPage,
  downloadFile,
}, info) => {
  test.setTimeout(180000);
  const profile = process.env.SCHOOLOOM_UI_DATA_DIR as string;
  const client = createKernelClient(await runningKernel(profile));
  const root = await mkdtemp(join(tmpdir(), 'scholoom-attachments-ui-'));
  const suffix = randomUUID().slice(0, 8);
  const articleName = `正文-${suffix}.txt`;
  const articlePath = join(root, articleName);
  const articleBytes = Buffer.from(`合成正文 ${suffix}\n`.repeat(18000), 'utf8');
  const supplementName = `补充-${suffix}.bin`;
  const extras = Array.from({ length: 26 }, (_, index) => `材料-${suffix}-${index}.txt`);
  try {
    await writeFile(articlePath, articleBytes);
    await writeFile(join(root, supplementName), Buffer.from(`合成补充材料 ${suffix}`, 'utf8'));
    await Promise.all(
      extras.map((name, index) =>
        writeFile(join(root, name), Buffer.from(`合成材料 ${suffix} ${index}`, 'utf8')),
      ),
    );

    await client.connect();
    await recordCalls(uiPage);
    const panel = await openLibrary(uiPage, client);
    const composer = uiPage.getByRole('textbox', { name: '研究指令' });

    const manage = formOf(panel, '本地材料摄取');
    await manage.getByText('本地材料摄取', { exact: true }).click();
    await importMaterials(
      manage,
      '导入文件批次',
      [articlePath, join(root, `缺失-${suffix}.pdf`)],
      '正文',
      '托管副本（复制入库）',
    );
    await expect(panel.getByRole('status', { name: '批次进度' })).toContainText('已处理 2/2');
    await expect(panel.getByRole('status', { name: '批次进度' })).toContainText('失败 1');
    await expect(panel.getByText(`第 2 条`, { exact: false })).toContainText(`缺失-${suffix}.pdf`);
    await manage.getByText('本地材料摄取', { exact: true }).click();

    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: articleName })).sources[0]?.metadataOrigin,
        { timeout: 30000 },
      )
      .toBe('filename');
    const source = (await client.call('library.list', { query: articleName })).sources[0];
    if (!source) throw new Error('缺少按文件名建立的题录');
    expect(source.metadata.title).toBe(articleName);
    expect(source.attachmentState).toBe('recorded');
    expect(
      (await client.call('library.attachments', { sourceId: source.id })).attachments.map(
        (item) => [item.purpose, item.storage, item.state, item.byteLength],
      ),
    ).toEqual([['正文', 'managed', 'available', articleBytes.length]]);

    // 托管后移走原文件：登记仍在，材料仍可按引用取回。
    await rm(articlePath);

    await panel.getByLabel('查找题录', { exact: true }).fill(articleName);
    const row = panel.getByRole('option', { name: `查看题录 ${articleName}`, exact: true });
    await expect(row).toContainText('已有附件登记');
    await expect(row).toContainText('待核对');

    const detail = await selectSource(uiPage, panel, articleName);
    await expect(detail.getByRole('status', { name: '附件登记状态' })).toContainText(
      '已有附件登记',
    );
    await expect(detail.getByRole('listitem')).toHaveCount(1);
    await expect(detail.getByRole('listitem')).toContainText('可读');
    await expect(detail.getByRole('listitem')).toContainText('托管副本');

    const json = detail.getByLabel('题录 CSL JSON', { exact: true });
    await json.fill(JSON.stringify({ title: articleName, abstract: `未保存草稿-${suffix}` }));

    // 浏览与分页不加载材料原文；下载只在用户点击后逐段读取。
    expect(
      (await callsOf(uiPage)).filter((call) => call.method === 'library.readAttachment'),
    ).toEqual([]);
    const downloaded = join(root, 'downloaded.txt');
    await downloadFile(
      () => detail.getByRole('button', { name: `下载 ${articleName}`, exact: true }).click(),
      downloaded,
    );
    expect(await readFile(downloaded)).toEqual(articleBytes);
    await expect
      .poll(
        async () =>
          (await callsOf(uiPage)).filter((call) => call.method === 'library.readAttachment').length,
      )
      .toBeGreaterThan(0);

    const add = formOf(detail, '添加本地附件');
    await add.getByText('添加本地附件', { exact: true }).click();
    await importMaterials(
      add,
      '添加附件',
      [join(root, supplementName)],
      '补充材料',
      '托管副本（复制入库）',
    );
    await expect
      .poll(
        async () =>
          (await client.call('library.attachments', { sourceId: source.id })).attachments.length,
        { timeout: 30000 },
      )
      .toBe(2);
    await expect(detail.getByRole('listitem')).toHaveCount(2);

    await importMaterials(
      add,
      '添加附件',
      extras.map((name) => join(root, name)),
      '补充材料',
      '托管副本（复制入库）',
    );
    await expect
      .poll(
        async () =>
          (await client.call('library.attachments', { sourceId: source.id, limit: 100 }))
            .attachments.length,
        { timeout: 60000 },
      )
      .toBe(28);
    await expect(detail.getByRole('listitem')).toHaveCount(25);
    await expect(detail.getByRole('button', { name: '上一页附件', exact: true })).toBeDisabled();
    await detail.getByRole('button', { name: '下一页附件', exact: true }).click();
    await expect(detail.getByRole('listitem')).toHaveCount(3);
    await expect(detail.getByRole('button', { name: '上一页附件', exact: true })).toBeEnabled();
    await detail.getByRole('button', { name: '上一页附件', exact: true }).click();
    await expect(detail.getByRole('listitem')).toHaveCount(25);

    const listed = (await callsOf(uiPage)).filter((call) => call.method === 'library.attachments');
    expect(listed.length).toBeGreaterThan(0);
    expect(
      listed.every(
        (call) => call.params.sourceId === source.id && Number(call.params.limit) <= 100,
      ),
    ).toBe(true);
    await expect(json).toHaveValue(new RegExp(`未保存草稿-${suffix}`));
    await expect(composer).toHaveValue(DRAFT);
    await uiPage.screenshot({ path: info.outputPath('library-attachments.png') });
  } finally {
    client.dispose();
    await rm(root, { recursive: true });
  }
});

test('外链移动后显示缺失，人工重定位核对内容并保留材料版本', async ({ uiPage }, info) => {
  test.setTimeout(120000);
  const profile = process.env.SCHOOLOOM_UI_DATA_DIR as string;
  const client = createKernelClient(await runningKernel(profile));
  const root = await mkdtemp(join(tmpdir(), 'scholoom-relocate-ui-'));
  const suffix = randomUUID().slice(0, 8);
  const linkedName = `外链-${suffix}.txt`;
  const linkedPath = join(root, linkedName);
  const linkedBytes = Buffer.from(`合成外链 ${suffix}\n`.repeat(48), 'utf8');
  const movedPath = join(root, `已移动-${suffix}.txt`);
  const decoyPath = join(root, 'elsewhere', linkedName);
  try {
    await writeFile(linkedPath, linkedBytes);
    await mkdir(join(root, 'elsewhere'));
    await writeFile(decoyPath, Buffer.from(`同名不同内容 ${suffix}`, 'utf8'));

    await client.connect();
    const panel = await openLibrary(uiPage, client);
    const manage = formOf(panel, '本地材料摄取');
    await manage.getByText('本地材料摄取', { exact: true }).click();
    await importMaterials(manage, '导入文件批次', [linkedPath], '正文', '外链原件（只登记位置）');
    await manage.getByText('本地材料摄取', { exact: true }).click();

    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: linkedName })).sources[0]?.metadataOrigin,
        { timeout: 30000 },
      )
      .toBe('filename');
    const source = (await client.call('library.list', { query: linkedName })).sources[0];
    if (!source) throw new Error('缺少按文件名建立的题录');
    const linked = (await client.call('library.attachments', { sourceId: source.id }))
      .attachments[0];
    if (!linked) throw new Error('缺少外链附件');
    expect([linked.storage, linked.state]).toEqual(['linked', 'available']);
    expect(await readFile(linkedPath)).toEqual(linkedBytes);

    const detail = await selectSource(uiPage, panel, linkedName);
    const newPath = detail.getByLabel(`新路径 ${linkedName}`, { exact: true });
    const relocate = detail.getByRole('button', { name: `重新定位 ${linkedName}`, exact: true });

    await rename(linkedPath, movedPath);
    await detail.getByRole('button', { name: '重新读取附件', exact: true }).click();
    await expect(detail.getByRole('listitem')).toContainText('缺失');
    await expect(detail.getByRole('status', { name: '附件登记状态' })).toContainText(
      '已有附件登记',
    );
    expect(
      (await client.call('library.attachments', { sourceId: source.id })).attachments[0]?.state,
    ).toBe('missing');

    await newPath.fill(decoyPath);
    await relocate.click();
    await expect(detail.getByRole('alert')).toContainText(/不是原材料版本|内容/);
    const kept = (await client.call('library.attachments', { sourceId: source.id })).attachments[0];
    expect([kept?.id, kept?.state, kept?.materialVersionId]).toEqual([
      linked.id,
      'missing',
      linked.materialVersionId,
    ]);

    await newPath.fill(movedPath);
    await relocate.click();
    await expect(detail.getByRole('listitem')).toContainText('可读');
    const restored = (await client.call('library.attachments', { sourceId: source.id }))
      .attachments[0];
    expect([restored?.id, restored?.state, restored?.materialVersionId]).toEqual([
      linked.id,
      'available',
      linked.materialVersionId,
    ]);
    await uiPage.screenshot({ path: info.outputPath('library-relocate.png') });
  } finally {
    client.dispose();
    await rm(root, { recursive: true });
  }
});
