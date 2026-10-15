import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { expect, test } from './fixture.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('user imports, edits and groups real library metadata without losing the conversation draft', async ({
  uiPage,
}, info) => {
  test.setTimeout(90000);
  const profile = process.env.SCHOOLOOM_UI_DATA_DIR as string;
  const client = createKernelClient(await runningKernel(profile));
  const restoreRoot = await mkdtemp(join(tmpdir(), 'scholoom-library-ui-'));
  const suffix = randomUUID().slice(0, 8),
    title = `界面研究-${suffix}`,
    collection = `集合-${suffix}`;
  try {
    await client.connect();
    await installRpcGate(uiPage);
    await uiPage.goto('http://127.0.0.1:5174/');
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.getByRole('button', { name: '新建会话', exact: true }).click();
    const composer = uiPage.getByRole('textbox', { name: '研究指令' });
    await composer.fill('浏览题录时保留的指令草稿');
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    await panel.getByText('文献库授权与备份', { exact: true }).click();
    await panel.getByLabel('读取库', { exact: true }).check();
    await panel.getByLabel('写入库', { exact: true }).check();
    await panel.getByRole('button', { name: '保存库授权', exact: true }).click();
    await expect.poll(async () => (await client.call('library.status', {})).write).toBe(true);
    await panel.getByText('手动建项', { exact: true }).click();
    await panel.getByLabel('题名', { exact: true }).fill(title);
    await panel.getByLabel('DOI', { exact: true }).fill(`10.1234/${suffix}`);
    await panel.getByRole('button', { name: '创建题录', exact: true }).click();
    await expect(
      panel.getByRole('button', { name: `查看题录 ${title}`, exact: true }),
    ).toBeVisible();
    await panel.getByText('集合', { exact: true }).first().click();
    await panel.getByLabel('集合名称', { exact: true }).fill(collection);
    await panel.getByRole('button', { name: '创建集合', exact: true }).click();
    await expect
      .poll(async () =>
        (await client.call('library.collections', {})).collections.some(
          (c) => c.name === collection,
        ),
      )
      .toBe(true);
    await panel.getByRole('button', { name: `查看题录 ${title}`, exact: true }).click();
    await panel.getByLabel('题录标签', { exact: true }).fill('synthetic');
    await panel.getByLabel(`集合 ${collection}`, { exact: true }).check();
    await panel.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.list', { query: title })).sources[0]?.tags)
      .toEqual(['synthetic']);
    await panel.getByText('CSL JSON 导入', { exact: true }).click();
    await panel.getByLabel('选择 CSL JSON 文件', { exact: true }).setInputFiles({
      name: 'synthetic.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify([
          { title: `文件研究-${suffix}`, DOI: `10.1234/file-${suffix}` },
          { title: '' },
        ]),
      ),
    });
    await panel.getByRole('button', { name: '导入批次', exact: true }).click();
    await expect(panel.getByRole('status', { name: '批次进度' })).toContainText('已处理 2/2');
    await expect(panel.getByRole('status', { name: '批次进度' })).toContainText('失败 1');
    expect(
      (await client.call('library.list', { query: `文件研究-${suffix}` })).sources,
    ).toHaveLength(1);
    await expect(composer).toHaveValue('浏览题录时保留的指令草稿');
    const json = panel.getByLabel('题录 CSL JSON', { exact: true });
    await json.fill(JSON.stringify({ title, DOI: `10.1234/${suffix}`, abstract: '首次保存' }));
    await armRpcGate(uiPage, 'library.update');
    await panel.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(panel.getByRole('button', { name: '重新读取题录', exact: true })).toBeDisabled();
    await json.fill(
      JSON.stringify({ title, DOI: `10.1234/${suffix}`, abstract: '保存期间的新编辑' }),
    );
    await releaseRpcGate(uiPage);
    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: title })).sources[0]?.metadata.abstract,
      )
      .toBe('首次保存');
    await expect(json).toHaveValue(/保存期间的新编辑/);
    await panel.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: title })).sources[0]?.metadata.abstract,
      )
      .toBe('保存期间的新编辑');
    await expect(panel.getByRole('button', { name: '保存题录更正', exact: true })).toBeEnabled();
    await json.fill(JSON.stringify({ title, DOI: `10.1234/${suffix}`, abstract: '切换前提交' }));
    await armRpcGate(uiPage, 'library.update');
    await panel.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await json.fill(JSON.stringify({ title, DOI: `10.1234/${suffix}`, abstract: '离屏后续编辑' }));
    await panel.getByRole('button', { name: `查看题录 文件研究-${suffix}`, exact: true }).click();
    await json.fill(JSON.stringify({ title: `另一条目草稿-${suffix}` }));
    await releaseRpcGate(uiPage);
    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: title })).sources[0]?.metadata.abstract,
      )
      .toBe('切换前提交');
    await expect(json).toHaveValue(new RegExp(`另一条目草稿-${suffix}`));
    await panel.getByRole('button', { name: `查看题录 ${title}`, exact: true }).click();
    await expect(json).toHaveValue(/离屏后续编辑/);
    await panel.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: title })).sources[0]?.metadata.abstract,
      )
      .toBe('离屏后续编辑');
    await expect(panel.getByRole('button', { name: '保存题录更正', exact: true })).toBeEnabled();
    await json.fill(JSON.stringify({ title: `未保存草稿-${suffix}`, DOI: `10.1234/${suffix}` }));
    const current = (await client.call('library.list', { query: title })).sources[0];
    if (!current) throw new Error('Created source missing');
    await client.call('library.update', {
      sourceId: current.id,
      revision: current.revision,
      metadata: { ...current.metadata, title: `外部更正-${suffix}` },
      tags: current.tags,
      collectionIds: current.collectionIds,
      relatedIds: current.relatedIds,
    });
    await expect(json).toHaveValue(new RegExp(`未保存草稿-${suffix}`));
    await panel.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('变化');
    expect((await client.call('library.get', { sourceId: current.id })).metadata.title).toBe(
      `外部更正-${suffix}`,
    );
    await panel.getByRole('button', { name: '立即备份', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.backups', {})).length)
      .toBeGreaterThan(0);
    await panel.getByLabel('独立恢复目录', { exact: true }).fill(join(restoreRoot, 'copy'));
    await panel
      .getByRole('button', { name: /^恢复备份 / })
      .first()
      .click();
    await expect(panel.getByRole('status', { name: '恢复结果' })).toContainText(
      join(restoreRoot, 'copy'),
    );
    await uiPage.screenshot({ path: info.outputPath('library-catalog.png') });
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await panel.getByLabel('查找题录', { exact: true }).fill(`外部更正-${suffix}`);
    await expect(
      panel.getByRole('button', { name: `查看题录 外部更正-${suffix}`, exact: true }),
    ).toBeVisible();
    await expect(composer).toHaveValue('浏览题录时保留的指令草稿');
    await panel.getByRole('button', { name: `查看题录 外部更正-${suffix}`, exact: true }).click();
    await expect(panel.getByLabel('题录 CSL JSON', { exact: true })).toHaveValue(
      new RegExp(`未保存草稿-${suffix}`),
    );
    await panel.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('变化');
  } finally {
    client.dispose();
    await rm(restoreRoot, { recursive: true });
  }
});
