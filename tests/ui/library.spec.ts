import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { createSession, expect, openWorkbenchWindow, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

test('native CSL fields and ordered host names preserve raw authority across type changes', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  const suffix = randomUUID().slice(0, 8),
    title = `CSL映射-${suffix}`;
  try {
    await client.connect();
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await createSession(uiPage);
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    await panel.getByRole('button', { name: '新建题录', exact: true }).click();
    await panel.getByLabel('题名', { exact: true }).fill(title);
    await panel.getByLabel('类型', { exact: true }).selectOption('motion_picture');
    await panel.getByLabel('体裁／类别说明', { exact: true }).fill('Documentary');
    await panel.getByLabel('载体／系统', { exact: true }).fill('DVD');
    await panel.getByLabel('尺寸／时长', { exact: true }).fill('01:23:45');
    await panel.getByLabel('短题名', { exact: true }).fill('Source short');
    await panel.getByText('创建者', { exact: true }).first().click();
    await panel.getByRole('button', { name: '添加机构主持人', exact: true }).click();
    await panel.getByLabel('主持人1literal', { exact: true }).fill('科学影像中心');
    await panel.getByRole('button', { name: '添加主持人', exact: true }).click();
    await panel.getByLabel('主持人2family', { exact: true }).fill('单名');
    await panel.getByRole('button', { name: '创建题录', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.list', { query: title })).sources.length)
      .toBe(1);
    const created = (await client.call('library.list', { query: title })).sources[0];
    if (!created) throw new Error('Missing native CSL sample');
    const organization = { literal: '科学影像中心', extension: { retained: true } };
    const single = { family: '单名', given: '' };
    expect(created.metadata).toMatchObject({
      type: 'motion_picture',
      genre: 'Documentary',
      medium: 'DVD',
      dimensions: '01:23:45',
      'title-short': 'Source short',
      host: [{ literal: '科学影像中心' }, single],
    });
    const libraryId = (await client.call('library.status', {})).id;
    const instance = await client.call('library.createSourceInstance', {
      libraryId,
      requestId: randomUUID(),
      label: 'Fixed film sample',
    });
    const original = {
      identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: `FILM${suffix}` },
      schemaVersion: '44',
      itemType: 'film',
      fields: {
        genre: 'Documentary',
        videoRecordingFormat: 'DVD',
        runningTime: '01:23:45',
        shortTitle: 'Source short',
        date: '2024春至夏',
        extra: 'Unparsed Extra',
      },
      creators: [
        { creatorType: 'host', lastName: '科学影像中心', fieldMode: 1, orderIndex: 0 },
        { creatorType: 'host', lastName: '单名', firstName: '', orderIndex: 1 },
      ],
      relations: {},
    };
    const metadata = {
      ...created.metadata,
      host: [organization, single],
      shortTitle: 'Legacy short',
      issued: {
        'date-parts': [
          [2024, 3],
          [2024, 5],
        ],
        circa: true,
      },
      'original-date': { raw: '约春季', season: 'spring' },
      extension: { nested: ['保留'] },
    };
    expect(
      await client.call('library.commitRecords', {
        libraryId,
        requestId: randomUUID(),
        changes: [
          {
            sourceId: created.id,
            revision: created.revision,
            metadata,
            original,
            key: { value: `FixedFilm${suffix}`, pinned: true, intent: 'explicit' },
          },
        ],
      }),
    ).toMatchObject({ state: 'committed' });
    await panel.getByLabel('查找题录', { exact: true }).fill(title);
    await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
    await detail.getByText('类型化题录', { exact: true }).click();
    await detail.getByText('创建者', { exact: true }).click();
    await detail.getByRole('button', { name: '题录主持人2上移', exact: true }).click();
    await expect(detail.getByLabel('题录发表日期年', { exact: true })).toHaveValue('2024');
    await expect(detail.getByLabel('题录原始发表日期年', { exact: true })).toHaveCount(0);
    await detail.getByLabel('题录类型', { exact: true }).selectOption('speech');
    await detail.getByLabel('题录活动／会议名称', { exact: true }).fill('Recorded event');
    await detail.getByLabel('题录类型', { exact: true }).selectOption('hearing');
    await detail.getByLabel('题录分节／委员会', { exact: true }).fill('Research committee');
    await detail.getByLabel('题录沿革／参考说明', { exact: true }).fill('Prior application');
    await detail.getByLabel('题录类型', { exact: true }).selectOption('patent');
    await detail.getByLabel('题录索引编号', { exact: true }).fill('US12/123456');
    await detail.getByLabel('题录期', { exact: true }).fill('P-42');
    await detail.getByLabel('题录类型', { exact: true }).selectOption('software');
    await detail.getByLabel('题录体裁／类别说明', { exact: true }).fill('TypeScript');
    await detail.getByLabel('题录载体／系统', { exact: true }).fill('Linux');
    await detail.getByLabel('题录丛书／系列名称', { exact: true }).fill('Analysis tools');
    await detail.getByLabel('题录短题名', { exact: true }).fill('Changed short');
    const expected = {
      ...metadata,
      type: 'software',
      genre: 'TypeScript',
      medium: 'Linux',
      'event-title': 'Recorded event',
      section: 'Research committee',
      references: 'Prior application',
      'call-number': 'US12/123456',
      issue: 'P-42',
      'collection-title': 'Analysis tools',
      'title-short': 'Changed short',
      host: [single, organization],
    };
    const json = detail.getByLabel('题录 CSL JSON', { exact: true });
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(expected);
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.get', { sourceId: created.id })).metadata)
      .toEqual(expected);
    const authority = await client.call('library.record', { libraryId, sourceId: created.id });
    expect(authority).toMatchObject({
      originals: [original],
      citationKey: { value: `FixedFilm${suffix}`, pinned: true },
    });
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(expected);
    expect(await client.call('library.record', { libraryId, sourceId: created.id })).toEqual(
      authority,
    );
    await detail.getByText('原值与导出', { exact: true }).click();
    await detail.getByRole('button', { name: '核对所选原值', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('unavailable');
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(expected);
  } finally {
    client.dispose();
  }
});

test('manual typed fields, creators and calendar parts preserve library originals and conflict drafts', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  const suffix = randomUUID().slice(0, 8),
    title = `剩余题录-${suffix}`;
  try {
    await client.connect();
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await createSession(uiPage);
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    await panel.getByRole('button', { name: '新建题录', exact: true }).click();
    await panel.getByLabel('题名', { exact: true }).fill(title);
    await panel.getByLabel('类型', { exact: true }).selectOption('book');
    await panel.getByLabel('原出版者', { exact: true }).fill('原版出版社');
    await panel.getByLabel('总页数', { exact: true }).fill('320');
    await panel.getByLabel('发表日期表达', { exact: true }).selectOption('parts');
    await panel.getByLabel('发表日期年', { exact: true }).fill('2026');
    await panel.getByLabel('发表日期月', { exact: true }).fill('7');
    await panel.getByLabel('发表日期日', { exact: true }).fill('23');
    await panel
      .getByRole('group', { name: '发表日期', exact: true })
      .getByText('结束日期', { exact: true })
      .click();
    await panel.getByLabel('发表日期结束年', { exact: true }).fill('2027');
    await panel.getByLabel('发表日期结束月', { exact: true }).fill('8');
    await panel.getByLabel('发表日期结束日', { exact: true }).fill('24');
    await panel.getByLabel('发表日期约略标记', { exact: true }).selectOption('true');
    await panel.getByText('创建者', { exact: true }).first().click();
    await panel.getByRole('button', { name: '添加丛书编辑', exact: true }).click();
    await panel.getByLabel('丛书编辑1family', { exact: true }).fill('王');
    await panel.getByLabel('丛书编辑1given', { exact: true }).fill('小明');
    await panel.getByRole('button', { name: '创建题录', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.list', { query: title })).sources.length)
      .toBe(1);
    const created = (await client.call('library.list', { query: title })).sources[0];
    if (!created) throw new Error('Missing manual record');
    expect(created.metadata).toMatchObject({
      type: 'book',
      'original-publisher': '原版出版社',
      'number-of-pages': '320',
      issued: {
        'date-parts': [
          [2026, 7, 23],
          [2027, 8, 24],
        ],
        circa: true,
      },
      'collection-editor': [{ family: '王', given: '小明' }],
    });
    const libraryId = (await client.call('library.status', {})).id;
    const instance = await client.call('library.createSourceInstance', {
      libraryId,
      requestId: randomUUID(),
      label: '独立上游样本',
    });
    const original = {
      identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: `BOOK${suffix}` },
      schemaVersion: '44',
      itemType: 'book',
      fields: { originalPublisher: '原版出版社', date: '2026年夏', extra: '未解释原行' },
      creators: [{ creatorType: 'seriesEditor', firstName: '小明', lastName: '王', orderIndex: 0 }],
      relations: {},
    };
    const creator = {
      family: '王',
      given: '小明',
      'non-dropping-particle': 'de',
      extension: { retained: true },
    };
    const metadata = {
      ...created.metadata,
      'collection-editor': [creator],
      issued: {
        'date-parts': [
          [2026, 7, 23],
          [2027, 8, 24],
        ],
        circa: 1,
        extension: { nested: ['日期原属性'] },
      },
      accessed: { 'date-parts': [[2005, 12, 15]], circa: '0' },
      extension: { nested: ['未知值'] },
      'original-date': { 'date-parts': [[1900], [1905]], circa: true },
    };
    expect(
      await client.call('library.commitRecords', {
        libraryId,
        requestId: randomUUID(),
        changes: [
          {
            sourceId: created.id,
            revision: created.revision,
            metadata,
            original,
            key: { value: `Pinned${suffix}`, pinned: true, intent: 'explicit' },
          },
        ],
      }),
    ).toMatchObject({ state: 'committed' });
    await panel.getByLabel('查找题录', { exact: true }).fill(title);
    await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
    await detail.getByText('类型化题录', { exact: true }).click();
    const json = detail.getByLabel('题录 CSL JSON', { exact: true });
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(metadata);
    await detail.getByLabel('题录发表日期结束月', { exact: true }).fill('13');
    await expect(detail.getByRole('alert')).toContainText('保留');
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(metadata);
    const yearInput = detail.getByLabel('题录发表日期年', { exact: true });
    await yearInput.evaluate((element) => {
      const input = element as HTMLInputElement;
      const observed: boolean[] = [];
      Reflect.set(input, '__dateBadInput', observed);
      input.addEventListener('input', () => observed.push(input.validity.badInput), {
        capture: true,
      });
    });
    await yearInput.press('e');
    expect(await yearInput.evaluate((element) => Reflect.get(element, '__dateBadInput'))).toContain(
      true,
    );
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(metadata);
    await detail.getByRole('button', { name: '题录移除发表日期结束日期', exact: true }).click();
    await expect
      .poll(async () => JSON.parse(await json.inputValue()))
      .toEqual({ ...metadata, issued: { ...metadata.issued, 'date-parts': [[2026, 7, 23]] } });
    await detail
      .getByRole('group', { name: '发表日期', exact: true })
      .getByText('结束日期', { exact: true })
      .click();
    await detail.getByLabel('题录发表日期结束年', { exact: true }).fill('2028');
    await expect(detail.getByLabel('题录发表日期结束日', { exact: true })).toBeDisabled();
    await detail.getByLabel('题录发表日期约略标记', { exact: true }).selectOption('false');
    await expect(detail.getByLabel('题录访问日期约略标记', { exact: true })).toHaveCount(0);
    await detail.getByLabel('题录原出版者', { exact: true }).fill('更正出版者');
    await detail.getByLabel('题录总页数', { exact: true }).fill('321');
    await detail.getByLabel('题录发表日期日', { exact: true }).fill('24');
    await detail.getByText('创建者', { exact: true }).click();
    await detail.getByLabel('题录丛书编辑1角色', { exact: true }).selectOption('editor');
    await detail.getByLabel('题录类型', { exact: true }).selectOption('article-journal');
    await detail.getByLabel('题录PubMed编号（PMID）', { exact: true }).fill('12345678');
    const expected = {
      ...metadata,
      type: 'article-journal',
      'original-publisher': '更正出版者',
      'number-of-pages': '321',
      issued: { ...metadata.issued, 'date-parts': [[2026, 7, 24], [2028]], circa: 0 },
      PMID: '12345678',
      'collection-editor': [],
      editor: [creator],
    };
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(expected);
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.get', { sourceId: created.id })).metadata)
      .toEqual(expected);
    await expect
      .poll(
        async () =>
          (await client.call('library.record', { libraryId, sourceId: created.id })).originals,
      )
      .toEqual([original]);
    expect(
      (await client.call('library.record', { libraryId, sourceId: created.id })).citationKey,
    ).toEqual({ value: `Pinned${suffix}`, pinned: true });
    await detail.getByLabel('题录题名', { exact: true }).fill(`${title}-未保存`);
    const current = await client.call('library.get', { sourceId: created.id });
    await client.call('library.update', {
      sourceId: current.id,
      revision: current.revision,
      tags: current.tags,
      collectionIds: current.collectionIds,
      relatedIds: current.relatedIds,
      metadata: { ...current.metadata, abstract: '外部更正' },
    });
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('变化');
    await expect(json).toHaveValue(/未保存/);
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
    await expect(json).toHaveValue(/未保存/);
    expect((await client.call('library.get', { sourceId: created.id })).metadata).toEqual({
      ...expected,
      abstract: '外部更正',
    });
  } finally {
    client.dispose();
  }
});

test('typed CSL edits preserve unsupported values through save and reload', async ({ uiPage }) => {
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  const title = `类型编辑-${randomUUID().slice(0, 8)}`;
  const original = {
    title,
    type: 'article-journal',
    volume: 12,
    'container-title': '保留刊名',
    issued: { 'date-parts': [[2024, 2]], season: 1 },
    note: '原Extra：保留',
    'citation-key': 'ExistingKey',
    extension: { nested: ['保留'] },
    author: [
      { family: '王', given: '小明', 'non-dropping-particle': 'de', extension: true },
      { literal: '研究所', extension: { id: 2 } },
    ],
    editor: [{ family: 'Editor' }],
    'container-author': '需保留的未支持原值',
  };
  try {
    await client.connect();
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const batch = await client.call('library.ingest', {
      batchId: randomUUID(),
      version: 'published',
      origin: 'synthetic',
      json: JSON.stringify([original]),
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const source = (await client.call('library.list', { query: title })).sources[0];
    if (!source) throw new Error('Missing typed sample');
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await createSession(uiPage);
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    await panel.getByLabel('查找题录', { exact: true }).fill(title);
    await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
    await detail.getByText('类型化题录', { exact: true }).click();
    await detail.getByLabel('题录题名', { exact: true }).fill(`${title}-更正`);
    await detail.getByLabel('题录类型', { exact: true }).selectOption('book');
    await detail.getByLabel('题录访问日期原文', { exact: true }).fill('2026年秋');
    await detail.getByText('创建者', { exact: true }).click();
    await detail.getByLabel('题录作者1given', { exact: true }).fill('晓明');
    await expect(
      detail
        .getByLabel('题录作者1角色', { exact: true })
        .getByRole('option', { name: '书籍作者', exact: true }),
    ).toHaveJSProperty('disabled', true);
    await detail.getByRole('button', { name: '题录作者2上移', exact: true }).click();
    await detail.getByLabel('题录作者2角色', { exact: true }).selectOption('translator');
    const expected = {
      ...original,
      title: `${title}-更正`,
      type: 'book',
      accessed: { literal: '2026年秋' },
      author: [original.author[1]],
      translator: [{ ...original.author[0], given: '晓明' }],
    };
    await expect
      .poll(async () =>
        JSON.parse(await detail.getByLabel('题录 CSL JSON', { exact: true }).inputValue()),
      )
      .toEqual(expected);
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(async () => (await client.call('library.get', { sourceId: source.id })).metadata)
      .toEqual(expected);
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    await panel.getByRole('option', { name: `查看题录 ${title}-更正`, exact: true }).click();
    await expect
      .poll(async () =>
        JSON.parse(await detail.getByLabel('题录 CSL JSON', { exact: true }).inputValue()),
      )
      .toEqual(expected);
  } finally {
    client.dispose();
  }
});

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
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await createSession(uiPage);
    const composer = uiPage.getByRole('textbox', { name: '研究指令' });
    await composer.fill('浏览题录时保留的指令草稿');
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    await panel.getByText('文献库授权与备份', { exact: true }).click();
    await panel.getByLabel('读取库', { exact: true }).check();
    await panel.getByLabel('写入库', { exact: true }).check();
    await panel.getByRole('button', { name: '保存库授权', exact: true }).click();
    await expect.poll(async () => (await client.call('library.status', {})).write).toBe(true);
    await panel.getByRole('button', { name: '新建题录', exact: true }).click();
    await expect(panel.getByLabel('题名', { exact: true })).toBeFocused();
    await panel.getByLabel('题名', { exact: true }).fill(title);
    await panel.getByLabel('DOI', { exact: true }).fill(`10.1234/${suffix}`);
    await panel.getByRole('button', { name: '创建题录', exact: true }).click();
    await expect(
      panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }),
    ).toBeVisible();
    await panel.getByText('集合', { exact: true }).first().click();
    await panel.getByLabel('集合名称', { exact: true }).fill(collection);
    await panel.getByRole('button', { name: '创建集合', exact: true }).click();
    await expect
      .poll(async () =>
        (await client.call('library.collections', { limit: 100 })).collections.some(
          (c) => c.name === collection,
        ),
      )
      .toBe(true);
    await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
    await detail.getByLabel('题录标签', { exact: true }).fill('synthetic');
    await detail.getByLabel(`集合 ${collection}`, { exact: true }).check();
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
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
    const json = detail.getByLabel('题录 CSL JSON', { exact: true });
    await json.fill(JSON.stringify({ title, DOI: `10.1234/${suffix}`, abstract: '首次保存' }));
    await armRpcGate(uiPage, 'library.update');
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(detail.getByRole('button', { name: '重新读取题录', exact: true })).toBeDisabled();
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
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: title })).sources[0]?.metadata.abstract,
      )
      .toBe('保存期间的新编辑');
    await expect(detail.getByRole('button', { name: '保存题录更正', exact: true })).toBeEnabled();
    await json.fill(JSON.stringify({ title, DOI: `10.1234/${suffix}`, abstract: '切换前提交' }));
    await armRpcGate(uiPage, 'library.update');
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await json.fill(JSON.stringify({ title, DOI: `10.1234/${suffix}`, abstract: '离屏后续编辑' }));
    await panel.getByRole('option', { name: `查看题录 文件研究-${suffix}`, exact: true }).click();
    await json.fill(JSON.stringify({ title: `另一条目草稿-${suffix}` }));
    await releaseRpcGate(uiPage);
    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: title })).sources[0]?.metadata.abstract,
      )
      .toBe('切换前提交');
    await expect(json).toHaveValue(new RegExp(`另一条目草稿-${suffix}`));
    await panel.getByRole('option', { name: `查看题录 ${title}`, exact: true }).click();
    await expect(json).toHaveValue(/离屏后续编辑/);
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await client.call('library.list', { query: title })).sources[0]?.metadata.abstract,
      )
      .toBe('离屏后续编辑');
    await expect(detail.getByRole('button', { name: '保存题录更正', exact: true })).toBeEnabled();
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
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('变化');
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
    await openLibraryDetails(uiPage);
    await panel.getByLabel('查找题录', { exact: true }).fill(`外部更正-${suffix}`);
    await expect(
      panel.getByRole('option', { name: `查看题录 外部更正-${suffix}`, exact: true }),
    ).toBeVisible();
    await expect(composer).toHaveValue('浏览题录时保留的指令草稿');
    await panel.getByRole('option', { name: `查看题录 外部更正-${suffix}`, exact: true }).click();
    await expect(detail.getByLabel('题录 CSL JSON', { exact: true })).toHaveValue(
      new RegExp(`未保存草稿-${suffix}`),
    );
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('变化');
  } finally {
    client.dispose();
    await rm(restoreRoot, { recursive: true });
  }
});

test('library selection, collection navigation and columns survive bounded view changes', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  const suffix = randomUUID().slice(0, 8);
  const prefix = `稳定选择-${suffix}`;
  try {
    await client.connect();
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const parent = await client.call('library.saveCollection', { name: `导航根-${suffix}` });
    for (let index = 0; index < 27; index++)
      await client.call('library.saveCollection', {
        name: `导航子-${suffix}-${index}`,
        parentId: parent.id,
      });
    const children = await client.call('library.collections', { parentId: parent.id, limit: 25 });
    const child = children.collections[0];
    if (!child) throw new Error('Missing navigation child');
    const grandchild = await client.call('library.saveCollection', {
      name: `导航孙-${suffix}`,
      parentId: child.id,
    });
    const batch = await client.call('library.ingest', {
      batchId: randomUUID(),
      version: 'published',
      origin: 'synthetic',
      collectionIds: [grandchild.id],
      json: JSON.stringify(
        Array.from({ length: 30 }, (_, index) => ({ title: `${prefix}-${index}` })),
      ),
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const page = await client.call('library.list', { query: prefix, limit: 25 });
    const first = page.sources[0],
      second = page.sources[1];
    if (!first || !second) throw new Error('Missing selection sample');
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await createSession(uiPage);
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    await panel.getByLabel('查找题录', { exact: true }).fill(prefix);
    await panel
      .getByRole('option', { name: `查看题录 ${first.metadata.title}`, exact: true })
      .click();
    await panel
      .getByRole('option', { name: `查看题录 ${second.metadata.title}`, exact: true })
      .click({ modifiers: ['ControlOrMeta'] });
    await expect(panel.getByRole('status', { name: '题录选择' })).toContainText('已选 2 项');
    const summary = uiPage
      .getByRole('complementary', { name: '辅助面板', exact: true })
      .getByRole('status', { name: '文献选择概况', exact: true });
    await expect(summary).toContainText(/已选\s*2\s*项/);
    await expect(summary).toContainText(`${second.metadata.title}`);
    const json = uiPage
      .getByRole('region', { name: '题录详情', exact: true })
      .getByLabel('题录 CSL JSON', { exact: true });
    const splitDraft = { ...second.metadata, abstract: '跨组唯一草稿' };
    await json.fill(JSON.stringify(splitDraft));
    await uiPage.getByRole('button', { name: '设置', exact: true }).click();
    await uiPage.getByRole('button', { name: '向右拆分', exact: true }).click();
    await uiPage.getByRole('tab', { name: /设置/ }).click();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await expect(uiPage.getByRole('region', { name: '文献库', exact: true })).toHaveCount(1);
    await expect.poll(async () => JSON.parse(await json.inputValue())).toEqual(splitDraft);
    await expect(summary).toContainText(/已选\s*2\s*项/);
    await uiPage.getByRole('button', { name: '关闭 设置', exact: true }).click();
    const secondRow = panel.getByRole('option', {
      name: `查看题录 ${second.metadata.title}`,
      exact: true,
    });
    await secondRow.press('ControlOrMeta+Enter');
    await expect(panel.getByRole('status', { name: '题录选择' })).toContainText('已选 1 项');
    await secondRow.press('ControlOrMeta+Enter');
    await expect(panel.getByRole('status', { name: '题录选择' })).toContainText('已选 2 项');
    await client.call('library.update', {
      sourceId: second.id,
      revision: second.revision,
      metadata: { ...second.metadata, abstract: '排序后仍为同一对象' },
      tags: second.tags,
      collectionIds: second.collectionIds,
      relatedIds: second.relatedIds,
    });
    await expect(
      panel.getByRole('listbox', { name: '题录列表' }).getByRole('option', { selected: true }),
    ).toHaveCount(2);
    await expect(panel.getByRole('status', { name: '题录选择' })).toContainText(
      `主选 ${second.metadata.title}`,
    );
    await panel.getByRole('button', { name: '下一页题录', exact: true }).click();
    await expect(panel.getByRole('status', { name: '题录选择' })).toContainText('已选 0 项');
    await panel.getByRole('button', { name: '上一页题录', exact: true }).click();
    await expect(
      panel.getByRole('listbox', { name: '题录列表' }).getByRole('option', { selected: true }),
    ).toHaveCount(2);
    const listbox = panel.getByRole('listbox', { name: '题录列表' });
    const firstVisibleRow = await listbox.getByRole('option').first().getAttribute('aria-label');
    await listbox.evaluate((element) => {
      element.scrollTop = 200;
    });
    await expect(listbox.getByRole('option').first()).not.toHaveAttribute(
      'aria-label',
      firstVisibleRow as string,
    );
    await expect.poll(() => listbox.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const scroll = await listbox.evaluate((element) => element.scrollTop);
    await panel.getByRole('button', { name: '下一页题录', exact: true }).click();
    await expect(panel.getByRole('status', { name: '题录选择' })).toContainText('已选 0 项');
    await panel.getByRole('button', { name: '上一页题录', exact: true }).click();
    await expect.poll(() => listbox.evaluate((element) => element.scrollTop)).toBe(scroll);
    await panel.getByText('表格列设置', { exact: true }).click();
    await panel.getByLabel('作者列', { exact: true }).uncheck();
    await panel.getByLabel('题名列宽度', { exact: true }).fill('48');
    await panel.getByRole('button', { name: '前移版本列', exact: true }).click();
    const nav = panel.getByRole('navigation', { name: '文献集合导航' });
    await nav.getByRole('button', { name: `展开集合 ${parent.name}`, exact: true }).click();
    await nav.getByRole('button', { name: `展开集合 ${child.name}`, exact: true }).click();
    await nav.getByRole('button', { name: grandchild.name, exact: true }).click();
    await expect(
      panel.getByRole('listbox', { name: '题录列表' }).getByRole('option').first(),
    ).toBeVisible();
    await expect(panel.getByRole('status', { name: '题录选择' })).toContainText('已选 0 项');
    await nav.getByRole('button', { name: '下一页导航集合', exact: true }).click();
    await expect(nav.getByRole('button', { name: '上一页导航集合', exact: true })).toBeVisible();
    await uiPage.reload();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    await expect(panel.getByLabel('查找题录', { exact: true })).toHaveValue(prefix);
    await panel.getByText('表格列设置', { exact: true }).click();
    await expect(panel.getByLabel('作者列', { exact: true })).not.toBeChecked();
    await expect(panel.getByLabel('题名列宽度', { exact: true })).toHaveValue('48');
    await expect(
      panel
        .getByRole('navigation', { name: '文献集合导航' })
        .getByRole('button', { name: '上一页导航集合', exact: true }),
    ).toBeVisible();
  } finally {
    client.dispose();
  }
});

test('library object drafts stay isolated across windows and late failures', async ({ uiPage }) => {
  test.setTimeout(90000);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  const suffix = randomUUID().slice(0, 8);
  const prefix = `窗口草稿-${suffix}`;
  let other: import('@playwright/test').Page | undefined;
  try {
    await client.connect();
    await client.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const batch = await client.call('library.ingest', {
      batchId: randomUUID(),
      version: 'published',
      origin: 'synthetic',
      json: JSON.stringify([{ title: `${prefix}-甲` }, { title: `${prefix}-乙` }]),
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const source = (await client.call('library.list', { query: `${prefix}-甲` })).sources[0];
    if (!source) throw new Error('Missing draft sample');
    await installRpcGate(uiPage);
    await uiPage.goto(rendererUrl);
    const legacyImport = `scholoom.draft.v1:${process.env.SCHOOLOOM_UI_DATA_DIR}|library|import`;
    await uiPage.evaluate(
      ({ key, title }) => localStorage.setItem(key, JSON.stringify([{ title }])),
      { key: legacyImport, title: `旧导入-${suffix}` },
    );
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    const panel = uiPage.getByRole('region', { name: '文献库', exact: true });
    const detail = uiPage.getByRole('region', { name: '题录详情', exact: true });
    await panel.getByText('CSL JSON 导入', { exact: true }).click();
    await panel.getByRole('button', { name: '恢复旧导入草稿', exact: true }).click();
    await expect(panel.getByLabel('CSL JSON 文本', { exact: true })).toHaveValue(
      new RegExp(`旧导入-${suffix}`),
    );
    expect(await uiPage.evaluate((key) => localStorage.getItem(key), legacyImport)).toContain(
      `旧导入-${suffix}`,
    );
    await panel.getByLabel('查找题录', { exact: true }).fill(prefix);
    await panel.getByRole('option', { name: `查看题录 ${prefix}-甲`, exact: true }).click();
    const json = detail.getByLabel('题录 CSL JSON', { exact: true });
    await json.fill(JSON.stringify({ title: `${prefix}-甲`, abstract: '跨卸载提交' }));
    await armRpcGate(uiPage, 'library.update');
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await uiPage.getByRole('button', { name: '关闭 文献库', exact: true }).click();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    await expect(detail.getByRole('button', { name: '保存题录更正', exact: true })).toBeDisabled();
    await json.fill(JSON.stringify({ title: `${prefix}-甲`, abstract: '原窗口草稿' }));
    await releaseRpcGate(uiPage);
    await expect
      .poll(
        async () => (await client.call('library.get', { sourceId: source.id })).metadata.abstract,
      )
      .toBe('跨卸载提交');
    await uiPage.getByRole('button', { name: '关闭 文献库', exact: true }).click();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    await expect(json).toHaveValue(/原窗口草稿/);
    other = await openWorkbenchWindow(uiPage);
    await other.goto(rendererUrl);
    await other.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(other);
    const otherPanel = other.getByRole('region', { name: '文献库', exact: true });
    const otherDetail = other.getByRole('region', { name: '题录详情', exact: true });
    await otherPanel.getByLabel('查找题录', { exact: true }).fill(prefix);
    await otherPanel.getByRole('option', { name: `查看题录 ${prefix}-甲`, exact: true }).click();
    await expect(otherDetail.getByLabel('题录 CSL JSON', { exact: true })).not.toHaveValue(
      /原窗口草稿/,
    );
    const latest = await client.call('library.get', { sourceId: source.id });
    await client.call('library.update', {
      sourceId: source.id,
      revision: latest.revision,
      metadata: { ...source.metadata, abstract: '外部修订' },
      tags: source.tags,
      collectionIds: source.collectionIds,
      relatedIds: source.relatedIds,
    });
    await armRpcGate(uiPage, 'library.update');
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await panel.getByRole('option', { name: `查看题录 ${prefix}-乙`, exact: true }).click();
    await json.fill(JSON.stringify({ title: `${prefix}-乙`, abstract: '另一个对象草稿' }));
    await releaseRpcGate(uiPage);
    await expect(detail.getByRole('button', { name: '保存题录更正', exact: true })).toBeEnabled();
    await expect(json).toHaveValue(/另一个对象草稿/);
    await expect(detail.getByRole('alert')).toHaveCount(0);
    await panel.getByRole('option', { name: `查看题录 ${prefix}-甲`, exact: true }).click();
    await expect(json).toHaveValue(/原窗口草稿/);
    await expect(detail.getByRole('alert')).toContainText('变化');
    await uiPage.getByRole('button', { name: '关闭 文献库', exact: true }).click();
    await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
    await openLibraryDetails(uiPage);
    await expect(json).toHaveValue(/原窗口草稿/);
    await detail.getByRole('button', { name: '重新读取题录', exact: true }).click();
    const confirm = detail.getByRole('alertdialog', { name: '确认丢弃题录草稿' });
    await confirm.getByRole('button', { name: '保留草稿', exact: true }).click();
    await expect(json).toHaveValue(/原窗口草稿/);
  } finally {
    await other?.close();
    client.dispose();
  }
});

async function openLibraryDetails(page: Page): Promise<void> {
  const expand = page.getByRole('button', { name: '展开右区', exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole('tab', { name: '文献详情', exact: true }).click();
}
