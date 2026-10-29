import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { ContextItem } from '../../packages/protocol/dist/index.js';
import { expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

// Opt-in module fixture: not a production report or isolation acceptance gate.
const built = process.env.SCHOOLOOM_REPORT_CONTEXT_BUILD;
test.skip(!built, 'Build the fixed trusted report-context fixture and supply its cache directory');
let html = '';
let script = '';
let css = '';
test.beforeAll(async () => {
  assert(built);
  [html, script, css] = await Promise.all([
    readFile(join(built, 'index.html'), 'utf8'),
    readFile(join(built, 'fixture.js'), 'utf8'),
    readFile(join(built, 'fixture.css'), 'utf8'),
  ]);
});

interface State {
  key: string;
  sessionId: string;
  body: string;
  serialized: string;
  items: ContextItem[];
  commits: number;
  calls: string[];
  generation: number;
}
const state = (page: Page): Promise<State> =>
  page.evaluate(() => Reflect.get(window, 'reportContextFixture').read());

async function mount(page: Page, host: string) {
  if (host === 'browser') await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await page.route(`${rendererUrl}__report-context/fixture.js`, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: script }),
  );
  await page.route(`${rendererUrl}__report-context/fixture.css`, (route) =>
    route.fulfill({ contentType: 'text/css', body: css }),
  );
  await page.route(rendererUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: html
        .replace('href="fixture.css"', 'href="/__report-context/fixture.css"')
        .replace('src="fixture.js"', 'src="/__report-context/fixture.js"'),
    }),
  );
  await page.goto(rendererUrl);
  await page.getByRole('button', { name: '会话一', exact: true }).click();
  await expect(page.getByRole('button', { name: '会话一', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(async () => (await state(page)).items.length).toBe(1);
}

async function evidence(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
  const data = info.outputPath(`${name}.json`);
  await writeFile(data, JSON.stringify(await state(page), null, 2));
  await info.attach(`${name}-state`, { path: data, contentType: 'application/json' });
}

test('trusted comparison controls append, inspect, edit and remove through the original shared draft', async ({
  uiPage: page,
  uiHost,
}, info) => {
  await mount(page, uiHost);
  await page.getByLabel('共同草稿正文', { exact: true }).fill('用户补充的正文仍需保留');
  await page.getByLabel('筛选文献', { exact: true }).fill('随机');
  await expect(page.getByRole('status', { name: '显示数量' })).toHaveText('2 / 17');
  await page.getByLabel('排序', { exact: true }).selectOption('descending');
  const rows = page.getByRole('table', { name: '固定文献对比' }).locator('tbody tr');
  await expect(rows.first()).toContainText('赵 2023');
  await page.getByText('详情 赵 2023', { exact: true }).click();
  await expect(rows.first()).toContainText('比较剂量20与30');
  await page.getByRole('checkbox', { name: '选择 赵 2023', exact: true }).check();
  await page.getByLabel('筛选文献', { exact: true }).fill('林');
  await expect(page.getByRole('button', { name: '附加所选对象', exact: true })).toBeDisabled();
  await page.getByLabel('筛选文献', { exact: true }).fill('随机');
  await page.getByRole('checkbox', { name: '选择 林 2021', exact: true }).check();
  await page.getByRole('checkbox', { name: '选择 赵 2023', exact: true }).check();
  await page.getByLabel('所选对象批注', { exact: true }).fill('核查剂量差异及原来源');
  const before = await state(page);
  await page.getByRole('button', { name: '附加所选对象', exact: true }).click();
  await expect(page.getByRole('status', { name: '附加结果' })).toContainText('已附加');
  const added = await state(page);
  expect(added.items).toHaveLength(6);
  expect(added.items[0]).toEqual(before.items[0]);
  expect(added.body).toBe(before.body);
  expect(added.commits).toBe(before.commits + 1);
  expect(added.items.filter((item) => item.kind === 'object')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        objectId: 'trial-a',
        name: '林 2021',
        ref: { source: 'project', projectId: 'sample-project', fileId: 'comparison' },
        basis: 'fixture-report-v1',
        comment: '核查剂量差异及原来源',
      }),
      expect.objectContaining({
        objectId: 'trial-b',
        basis: 'fixture-report-v1',
        comment: '核查剂量差异及原来源',
      }),
    ]),
  );
  expect(added.items.filter((item) => item.kind === 'resource')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ref: { source: 'library', attachmentId: 'sample-paper', materialVersionId: 'paper-v1' },
        basis: 'paper-v1',
      }),
      expect.objectContaining({
        ref: { source: 'library', attachmentId: 'sample-paper', materialVersionId: 'paper-v2' },
        basis: 'paper-v2',
      }),
      expect.objectContaining({
        ref: { source: 'project', projectId: 'sample-project', fileId: 'notes' },
        basis: 'notes-v1',
      }),
    ]),
  );
  const inspector = page.getByRole('region', { name: '附加上下文', exact: true });
  await page.getByLabel('查看附加上下文', { exact: true }).click();
  await inspector.locator('.menu__body > details > summary').nth(1).click();
  await expect(inspector).toContainText('fixture-report-v1');
  await page.getByLabel('上下文批注 2', { exact: true }).fill('只更正林的批注');
  await expect
    .poll(
      async () =>
        (await state(page)).items.find(
          (item) => item.kind === 'object' && item.objectId === 'trial-a',
        )?.comment,
    )
    .toBe('只更正林的批注');
  await evidence(page, info, 'trusted-comparison-inspector');
  await page.getByRole('button', { name: '移除上下文 2', exact: true }).click();
  const removed = await state(page);
  expect(removed.items).toHaveLength(5);
  expect(removed.items.some((item) => item.kind === 'object' && item.objectId === 'trial-a')).toBe(
    false,
  );
  expect(removed.items[0]).toEqual(before.items[0]);
  expect(removed.body).toBe(before.body);
  expect(removed.calls).not.toContain('session.send');
  expect(removed.calls.every((method) => method === 'workbench.watch')).toBe(true);
});

test('trusted comparison controls preserve both drafts on capacity and obsolete page or receiver actions', async ({
  uiPage: page,
  uiHost,
}, info) => {
  await mount(page, uiHost);
  const original = await state(page);
  await page.getByRole('button', { name: '全选当前结果', exact: true }).click();
  await page.getByLabel('所选对象批注', { exact: true }).fill('整组检查');
  await page.getByRole('button', { name: '附加所选对象', exact: true }).click();
  await expect(page.getByRole('status', { name: '附加结果' })).toContainText('tooLarge');
  expect((await state(page)).serialized).toBe(original.serialized);
  expect((await state(page)).commits).toBe(original.commits);
  await page.getByLabel('筛选文献', { exact: true }).fill('队列');
  await page.getByRole('checkbox', { name: '选择 周 2020', exact: true }).check();
  await page.getByLabel('所选对象批注', { exact: true }).fill('保留等待提交的选择');
  await page.getByRole('button', { name: '保留本次附加动作', exact: true }).click();
  await page.getByRole('button', { name: '替换样本页面', exact: true }).click();
  await expect(page.getByRole('region', { name: '文献对比样本' })).toContainText(
    'fixture-report-v2',
  );
  await page.getByRole('button', { name: '提交保留动作', exact: true }).click();
  await expect(page.getByRole('status', { name: '附加结果' })).toContainText('unavailable');
  expect((await state(page)).serialized).toBe(original.serialized);
  await page.getByLabel('筛选文献', { exact: true }).fill('队列');
  await page.getByRole('checkbox', { name: '选择 周 2020', exact: true }).check();
  await page.getByRole('button', { name: '保留本次附加动作', exact: true }).click();
  await page.getByRole('button', { name: '会话二', exact: true }).click();
  await expect(page.getByRole('button', { name: '会话二', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('共同草稿正文', { exact: true })).toHaveValue('');
  const second = await state(page);
  await page.getByRole('button', { name: '提交保留动作', exact: true }).click();
  await expect(page.getByRole('status', { name: '附加结果' })).toContainText('unavailable');
  expect((await state(page)).serialized).toBe(second.serialized);
  await page.getByRole('button', { name: '会话一', exact: true }).click();
  await expect(page.getByRole('button', { name: '会话一', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '提交保留动作', exact: true }).click();
  await expect(page.getByRole('status', { name: '附加结果' })).toContainText('unavailable');
  const restored = await state(page);
  expect(restored.serialized).toBe(original.serialized);
  expect(restored.body).toBe(original.body);
  await evidence(page, info, 'obsolete-action-rejected');
  await page.getByLabel('筛选文献', { exact: true }).fill('随机');
  await page.getByRole('checkbox', { name: '选择 林 2021', exact: true }).check();
  await page.getByLabel('所选对象批注', { exact: true }).fill('当前有效选择');
  await page.getByRole('button', { name: '附加所选对象', exact: true }).click();
  await expect(page.getByRole('status', { name: '附加结果' })).toContainText('已附加');
  const current = await state(page);
  expect(current.items).toHaveLength(4);
  expect(current.items.find((item) => item.kind === 'object')).toMatchObject({
    objectId: 'trial-a',
    basis: 'fixture-report-v2',
    comment: '当前有效选择',
  });
  expect(current.items[0]).toEqual(original.items[0]);
  expect(current.calls).not.toContain('session.send');
});
