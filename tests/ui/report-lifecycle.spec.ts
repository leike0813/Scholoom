import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { LifecycleObservation } from '../fixtures/report-lifecycle/types.js';
import { expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

const built = process.env.SCHOOLOOM_REPORT_LIFECYCLE_BUILD;
test.skip(
  !built,
  'Build the fixed report lifecycle module fixture into a dedicated cache directory',
);
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
const state = (page: Page): Promise<LifecycleObservation> =>
  page.evaluate(() => Reflect.get(window, 'reportLifecycleFixture').read());
const delivered = (value: LifecycleObservation) =>
  value.events.filter((event) => event.kind === 'restoreDelivered').length;

async function mount(page: Page, host: string) {
  if (host === 'browser') await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await page.route(`${rendererUrl}__report-lifecycle/fixture.js`, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: script }),
  );
  await page.route(`${rendererUrl}__report-lifecycle/fixture.css`, (route) =>
    route.fulfill({ contentType: 'text/css', body: css }),
  );
  await page.route(rendererUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: html
        .replace('href="fixture.css"', 'href="/__report-lifecycle/fixture.css"')
        .replace('src="fixture.js"', 'src="/__report-lifecycle/fixture.js"'),
    }),
  );
  await page.goto(rendererUrl);
  await page.getByRole('button', { name: '接收会话', exact: true }).click();
  await expect.poll(async () => (await state(page)).items.length).toBe(1);
  await page.getByRole('button', { name: '打开报告夹具', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '报告页面草稿', exact: true })).toBeVisible();
  await expect(page.getByLabel('当前报告版本', { exact: true })).toHaveText('fixture-report-v1');
}
async function close(page: Page) {
  await page.getByRole('button', { name: '关闭 可信报告生命周期.html', exact: true }).click();
  await expect(page.getByRole('region', { name: '报告生命周期', exact: true })).toHaveCount(0);
  await expect
    .poll(async () => {
      const value = await state(page);
      return { subscriptions: value.subscriptions, consumers: value.consumers };
    })
    .toEqual({ subscriptions: 0, consumers: 0 });
}
async function evidence(page: Page, info: TestInfo, name: string, capture = false) {
  const output = info.outputPath(`${name}.json`);
  await writeFile(output, JSON.stringify(await state(page), null, 2));
  await info.attach(name, { path: output, contentType: 'application/json' });
  if (capture) {
    const image = info.outputPath(`${name}.png`);
    await page.screenshot({ path: image, fullPage: true });
    await info.attach(`${name}-view`, { path: image, contentType: 'image/png' });
  }
}

test('trusted lifecycle modules preserve original shared drafts through pending updates closure and access checks', async ({
  uiPage: page,
  uiHost,
}, info) => {
  await mount(page, uiHost);
  await page.getByRole('textbox', { name: '研究指令', exact: true }).fill('保留共同正文，不发送');
  await expect.poll(async () => (await state(page)).body).toBe('保留共同正文，不发送');
  await page.getByRole('textbox', { name: '报告页面草稿', exact: true }).fill('第一版页面批注');
  await page.getByRole('button', { name: '保留原版本动作', exact: true }).click();
  await page.getByRole('button', { name: '附加林的对象', exact: true }).click();
  await expect(page.getByLabel('原动作结果', { exact: true })).toHaveText('queued');
  await expect.poll(async () => (await state(page)).items.length).toBe(4);
  const original = (await state(page)).items[0];
  const inspector = page.getByRole('region', { name: '附加上下文', exact: true });
  await page.getByLabel('查看附加上下文', { exact: true }).click();
  await inspector.locator('.menu__body > details > summary').nth(1).click();
  await expect(inspector).toContainText('fixture-report-v1');
  await page.getByLabel('上下文批注 2', { exact: true }).fill('核查旧版本对象的批注');
  await inspector.locator('.menu__body > details > summary').nth(2).click();
  await page.getByRole('button', { name: '移除上下文 3', exact: true }).click();
  await page.getByLabel('查看附加上下文', { exact: true }).click();
  await expect.poll(async () => (await state(page)).items.length).toBe(3);
  const before = await state(page);
  expect(before.items[0]).toEqual(original);
  expect(before.items.find((item) => item.kind === 'object')).toMatchObject({
    basis: 'fixture-report-v1',
    comment: '核查旧版本对象的批注',
  });
  await page.getByRole('button', { name: '加载第二版', exact: true }).click();
  await expect(page.getByLabel('待看报告版本', { exact: true })).toHaveText('fixture-report-v2');
  await expect(page.getByLabel('当前报告版本', { exact: true })).toHaveText('fixture-report-v1');
  const pending = await state(page);
  expect(pending.view?.protection).toEqual({
    pageDirty: true,
    explicitItems: true,
    composerDraft: true,
  });
  expect(pending.serialized).toBe(before.serialized);
  expect(pending.body).toBe(before.body);
  await evidence(page, info, 'pending-keeps-original-adapter-drafts');
  await page.getByRole('button', { name: '明确查看新版', exact: true }).click();
  await expect(page.getByLabel('当前报告版本', { exact: true })).toHaveText('fixture-report-v2');
  await page.getByRole('button', { name: '提交保留的旧动作', exact: true }).click();
  await expect(page.getByLabel('原动作结果', { exact: true })).toHaveText('unavailable');
  expect((await state(page)).serialized).toBe(before.serialized);
  expect((await state(page)).body).toBe(before.body);
  await page.getByRole('textbox', { name: '报告页面草稿', exact: true }).fill('第二版未提交草稿');
  await page.getByRole('button', { name: '保留原版本动作', exact: true }).click();
  const saved = (await state(page)).view?.stored;
  assert(saved);
  expect(JSON.parse(saved)).toMatchObject({ draft: '第二版未提交草稿', dirty: true });
  await close(page);
  await page.getByRole('button', { name: '提交保留的旧动作', exact: true }).click();
  await expect(page.getByLabel('原动作结果', { exact: true })).toHaveText('unavailable');
  await page.getByRole('button', { name: '打开报告夹具', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '报告页面草稿', exact: true })).toHaveValue(
    '第二版未提交草稿',
  );
  await expect(page.getByLabel('页面恢复结果', { exact: true })).toHaveText('restored');
  expect((await state(page)).view?.stored).toBe(saved);
  const restoredCount = delivered(await state(page));
  await evidence(page, info, 'same-basis-restores-after-real-tab-closure');
  await close(page);
  await page.getByLabel('原版本可得性', { exact: true }).selectOption('unavailable');
  await page.getByRole('button', { name: '打开报告夹具', exact: true }).click();
  await expect(page.getByLabel('状态恢复候选', { exact: true })).toHaveText('copyOnly');
  await expect(page.getByLabel('原版可复制草稿', { exact: true })).toHaveText('第二版未提交草稿');
  expect(delivered(await state(page))).toBe(restoredCount);
  expect((await state(page)).consumers).toBe(0);
  await evidence(page, info, 'unavailable-version-copy-without-page-restore');
  await close(page);
  await page.getByLabel('原版本可得性', { exact: true }).selectOption('denied');
  await page.getByRole('button', { name: '打开报告夹具', exact: true }).click();
  await expect(page.getByLabel('状态恢复候选', { exact: true })).toHaveText('denied');
  await expect(page.getByLabel('原版可复制草稿', { exact: true })).toHaveCount(0);
  const denied = await state(page);
  expect(denied.view?.stored).toBeNull();
  expect(denied.view?.wire).toBeNull();
  expect(denied.consumers).toBe(0);
  expect(delivered(denied)).toBe(restoredCount);
  expect(denied.serialized).toBe(before.serialized);
  expect(denied.body).toBe(before.body);
  expect(
    denied.calls.every((method) =>
      ['workbench.watch', 'workbench.context.publish', 'files.resolve'].includes(method),
    ),
  ).toBe(true);
  expect(denied.calls).not.toContain('session.send');
  await evidence(page, info, 'denied-does-not-restore-cached-content', true);
  await close(page);
});

test('a persisted bounded state cannot bypass the new complete restore envelope budget', async ({
  uiPage: page,
  uiHost,
}, info) => {
  await mount(page, uiHost);
  await page.getByRole('textbox', { name: '研究指令', exact: true }).fill('边界拒绝仍保留共同正文');
  await expect.poll(async () => (await state(page)).body).toBe('边界拒绝仍保留共同正文');
  await page.getByRole('button', { name: '保存64KiB旧封套状态', exact: true }).click();
  const before = await state(page);
  const saved = before.view?.stored;
  assert(saved);
  const oldMessage = {
    version: 1,
    viewId: 'v',
    generation: 0,
    basis: 'fixture-report-v1',
    type: 'state',
    ...JSON.parse(saved),
  };
  expect(Buffer.byteLength(JSON.stringify(oldMessage))).toBe(65536);
  expect(before.events.find((event) => event.kind === 'boundarySaved')).toMatchObject({
    bytes: 65536,
    valid: true,
    localStorageWritten: true,
  });
  await evidence(page, info, 'accepted-original-complete-state-envelope');
  await close(page);
  await page.getByRole('button', { name: '打开报告夹具', exact: true }).click();
  await expect(page.getByLabel('页面恢复结果', { exact: true })).toHaveText('tooLarge');
  await expect(page.getByRole('textbox', { name: '报告页面草稿', exact: true })).toHaveCount(0);
  const after = await state(page);
  assert(after.view?.wire);
  expect(after.view.recovery).toBe('restorable');
  expect(after.view.wire.valid).toBe(false);
  expect(after.view.wire.generation).toBeGreaterThan(0);
  expect(after.view.wire.viewId).not.toBe('v');
  expect(Buffer.byteLength(JSON.stringify(after.view.wire.message))).toBe(after.view.wire.bytes);
  expect(after.view.wire.bytes).toBeGreaterThan(65536);
  expect(after.view.stored).toBe(saved);
  expect(after.serialized).toBe(before.serialized);
  expect(after.body).toBe(before.body);
  expect(delivered(after)).toBe(0);
  expect(after.events.filter((event) => event.kind === 'restoreRejected')).toHaveLength(1);
  await evidence(page, info, 'new-complete-envelope-rejected-with-original-state-intact', true);
  await close(page);
});
