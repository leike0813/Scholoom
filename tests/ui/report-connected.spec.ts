import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { isReportBridgeMessage } from '../../packages/protocol/dist/report-contracts.js';
import { connectedDomain } from '../fixtures/report-connected/domain.js';
import { connectedSite } from '../fixtures/report-connected/site.js';
import type { ConnectedObservation } from '../fixtures/report-connected/types.js';
import { expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

const built = process.env.SCHOOLOOM_REPORT_CONNECTED_BUILD;
test.skip(!built, 'Build the connected report fixture into a dedicated cache directory');
let html = '',
  script = '',
  css = '';
test.beforeAll(async () => {
  assert(built);
  [html, script, css] = await Promise.all([
    readFile(join(built, 'index.html'), 'utf8'),
    readFile(join(built, 'fixture.js'), 'utf8'),
    readFile(join(built, 'fixture.css'), 'utf8'),
  ]);
});
const state = (page: Page): Promise<ConnectedObservation> =>
  page.evaluate(() => Reflect.get(window, 'reportConnectedFixture').read());
type Domain = Awaited<ReturnType<typeof connectedDomain>>;
async function mount(page: Page, host: string, domain: Domain, url: string) {
  if (host === 'browser') await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  await installRpcGate(page);
  await page.exposeBinding('reportConnectedAction', (_, action) => domain.act(action));
  await page.goto(url);
  await selectSession(page, domain);
  await page.getByRole('button', { name: '打开真实报告夹具', exact: true }).click();
  await expect(page.getByLabel('报告可展示', { exact: true })).toHaveText('true');
  await expect(page.getByRole('textbox', { name: '报告页面草稿', exact: true })).toBeVisible();
}
async function selectSession(page: Page, domain: Domain) {
  const project = page.locator(
    `[data-project-id=${JSON.stringify(domain.configuration.projectId)}] .project-header`,
  );
  await expect(project).toBeVisible();
  if ((await project.getAttribute('aria-expanded')) === 'false') await project.click();
  await page
    .getByRole('button', { name: '打开会话 Connected report session', exact: true })
    .click();
  await expect
    .poll(async () => ({
      project: (await state(page)).projectId,
      session: (await state(page)).sessionId,
    }))
    .toEqual({ project: domain.configuration.projectId, session: domain.configuration.sessionId });
}
async function protect(page: Page) {
  await page.getByRole('textbox', { name: '研究指令', exact: true }).fill('保留真实共同正文');
  await expect.poll(async () => (await state(page)).body).toBe('保留真实共同正文');
  await page.getByRole('textbox', { name: '报告页面草稿', exact: true }).fill('尚未提交的报告批注');
  await page.getByRole('button', { name: '附加报告对象', exact: true }).click();
  await expect(page.getByLabel('原动作结果', { exact: true })).toHaveText('queued');
  await expect.poll(async () => (await state(page)).items.length).toBe(2);
  await page.getByLabel('查看附加上下文', { exact: true }).click();
  const inspector = page.getByRole('region', { name: '附加上下文', exact: true });
  await inspector.locator('.menu__body > details > summary').first().click();
  await page.getByLabel('上下文批注 1', { exact: true }).fill('检查原版本对象');
  await page.getByLabel('查看附加上下文', { exact: true }).click();
  return state(page);
}
async function closeTab(page: Page) {
  await page.getByRole('button', { name: '关闭 report.html', exact: true }).click();
  await expect(page.getByRole('region', { name: '真实报告客户端', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '准确原版恢复', exact: true })).toHaveCount(0);
  await expect
    .poll(async () => {
      const s = await state(page);
      return [s.consumers, s.subscriptions];
    })
    .toEqual([0, 0]);
}
async function evidence(page: Page, info: TestInfo, domain: Domain, name: string, image = false) {
  const file = info.outputPath(`${name}.json`);
  await writeFile(
    file,
    JSON.stringify({ renderer: await state(page), domain: await domain.facts() }, null, 2),
  );
  await info.attach(name, { path: file, contentType: 'application/json' });
  if (image) {
    const file = info.outputPath(`${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    await info.attach(`${name}-view`, { path: file, contentType: 'image/png' });
  }
}
async function cleanup(page: Page, domain: Domain) {
  try {
    if (!page.isClosed()) {
      const held = await page
        .evaluate(() => !!Reflect.get(globalThis, '__scholoomRpcGate')?.held)
        .catch(() => false);
      if (held) await releaseRpcGate(page);
      const button = page.getByRole('button', { name: '释放测试连接', exact: true });
      if (await button.count()) await button.click();
    }
  } finally {
    await domain.close();
  }
}

async function savedVersion(page: Page) {
  const shared = await protect(page);
  await page.getByRole('textbox', { name: '报告浏览筛选', exact: true }).fill('original-filter');
  const original = await state(page);
  assert(original.pageSave?.localStorageWritten && original.stored);
  expect(JSON.parse(original.stored)).toEqual({
    browse: { filter: 'original-filter' },
    draft: '尚未提交的报告批注',
    dirty: true,
  });
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(`scholoom.draft.v1:${key}`),
      original.pageSave.key,
    ),
  ).toBe(original.stored);
  return { shared, stored: original.stored, key: original.pageSave.key };
}

async function preserved(page: Page, original: Awaited<ReturnType<typeof savedVersion>>) {
  expect(
    await page.evaluate(
      ({ key, text }) => localStorage.getItem(`scholoom.draft.v1:${key}`) === text,
      { key: original.key, text: original.stored },
    ),
  ).toBe(true);
  const current = await state(page);
  expect(current.body).toBe(original.shared.body);
  expect(current.serialized).toBe(original.shared.serialized);
}

test('exact version R1 reopens from browser storage after R2 and only its own source authorizes recovery', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const domain = await connectedDomain(info.outputPath('domain'));
  let site: Awaited<ReturnType<typeof connectedSite>> | undefined;
  try {
    site = await connectedSite(domain.configuration, { html, script, css });
    await mount(page, uiHost, domain, site.url);
    const original = await savedVersion(page);
    await closeTab(page);
    await page.getByRole('button', { name: '发布无来源R2', exact: true }).click();
    await expect(page.getByLabel('实际控制回执', { exact: true })).toHaveText(
      'publish-without-source',
    );
    const facts = await domain.facts();
    expect(facts.latest.basis).not.toBe(domain.configuration.entry.basis);
    expect(facts.html).toBe(facts.expectedHtml);
    // Reload the actual document: the module memory map is gone; the window identity stays.
    await page.reload();
    await selectSession(page, domain);
    await page.getByRole('button', { name: '精确重开R1', exact: true }).click();
    await expect(page.getByLabel('准确原版状态', { exact: true })).toHaveText('restorable');
    await expect(page.getByRole('textbox', { name: '报告页面草稿', exact: true })).toHaveValue(
      '尚未提交的报告批注',
    );
    await expect(page.getByRole('textbox', { name: '报告浏览筛选', exact: true })).toHaveValue(
      'original-filter',
    );
    const recovered = await state(page);
    assert(recovered.exact?.result?.version.state === 'available');
    expect(recovered.exact.result.version.snapshot.resource).toMatchObject({
      ref: domain.configuration.entry.ref,
      basis: domain.configuration.entry.basis,
    });
    expect(recovered.exact.result.version.snapshot.manifest).toEqual(domain.domain.manifest);
    expect(recovered.exact.result.restored).toEqual({
      status: 'restorable',
      state: JSON.parse(original.stored),
    });
    expect(isReportBridgeMessage(recovered.exact.envelope)).toBe(true);
    expect(recovered.exact.envelope).toMatchObject({
      type: 'restore',
      basis: domain.configuration.entry.basis,
      ...JSON.parse(original.stored),
    });
    await preserved(page, original);
    await evidence(
      page,
      info,
      domain,
      'exact-r1-reloaded-storage-and-original-full-snapshot',
      true,
    );
    await closeTab(page);
    await page.getByRole('button', { name: '打开真实报告夹具', exact: true }).click();
    await expect(page.getByLabel('当前报告版本', { exact: true })).toHaveText(facts.latest.basis);
    await expect(page.getByRole('textbox', { name: '报告页面草稿', exact: true })).toHaveValue('');
    expect((await state(page)).stored).toBe('');
    await page.getByRole('button', { name: '精确重开当前版', exact: true }).click();
    await expect(page.getByLabel('准确原版状态', { exact: true })).toHaveText('missing');
    expect((await state(page)).exact?.result?.version.state).toBe('available');
    await closeTab(page);
    await page.getByRole('button', { name: '撤回库来源读取', exact: true }).click();
    await expect(page.getByLabel('实际控制回执', { exact: true })).toHaveText('revoke');
    await page.getByRole('button', { name: '打开真实报告夹具', exact: true }).click();
    await expect(page.getByLabel('报告可展示', { exact: true })).toHaveText('true');
    expect((await state(page)).metadata?.current?.manifest.sources).toEqual([]);
    await closeTab(page);
    await page.getByRole('button', { name: '精确重开R1', exact: true }).click();
    await expect(page.getByLabel('准确原版状态', { exact: true })).toHaveText('permissionDenied');
    expect((await state(page)).exact?.result).toBeNull();
    await expect(page.getByRole('region', { name: '真实连接报告页面', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole('textbox', { name: '仅复制原草稿', exact: true })).toHaveCount(0);
    await preserved(page, original);
    await evidence(
      page,
      info,
      domain,
      'r2-readable-r1-source-denied-without-cache-disclosure',
      true,
    );
    await closeTab(page);
  } finally {
    try {
      await cleanup(page, domain);
    } finally {
      await site?.close();
    }
  }
});

test('exact version changed dependency is copyOnly while failed or late restores never adopt the draft', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const domain = await connectedDomain(info.outputPath('domain'));
  let site: Awaited<ReturnType<typeof connectedSite>> | undefined;
  try {
    site = await connectedSite(domain.configuration, { html, script, css });
    await mount(page, uiHost, domain, site.url);
    const original = await savedVersion(page);
    await closeTab(page);
    await page.getByRole('button', { name: '推进原依赖内容', exact: true }).click();
    await expect(page.getByLabel('实际控制回执', { exact: true })).toHaveText('advance-dependency');
    await page.getByRole('button', { name: '精确重开R1', exact: true }).click();
    await expect(page.getByLabel('准确原版状态', { exact: true })).toHaveText('copyOnly');
    const copied = await state(page);
    expect(copied.exact?.result).toEqual({
      version: { state: 'unavailable', reason: 'contentChanged' },
      restored: { status: 'copyOnly', draft: '尚未提交的报告批注', dirty: true },
    });
    expect(copied.exact?.envelope).toBeNull();
    expect(copied.consumers).toBe(0);
    await expect(page.getByRole('region', { name: '真实连接报告页面', exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole('textbox', { name: '仅复制原草稿', exact: true })).toHaveValue(
      '尚未提交的报告批注',
    );
    await preserved(page, original);
    await evidence(
      page,
      info,
      domain,
      'dependency-advanced-copy-only-no-browse-snapshot-consumer',
      true,
    );
    await closeTab(page);
    const settled = (await state(page)).settled;
    await armRpcGate(page, 'resources.reportVersion', '', true);
    await page.getByRole('button', { name: '精确重开R1', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => !!Reflect.get(globalThis, '__scholoomRpcGate')?.held))
      .toBe(true);
    const held = await page.evaluate(
      () => JSON.parse(Reflect.get(globalThis, '__scholoomRpcGate').held.payload).result,
    );
    expect(held).toEqual({ state: 'unavailable', reason: 'contentChanged' });
    await closeTab(page);
    expect((await state(page)).settled).toBe(settled);
    await releaseRpcGate(page);
    await expect.poll(async () => (await state(page)).settled).toBe(settled + 1);
    expect((await state(page)).exact).toBeNull();
    await expect(page.getByRole('textbox', { name: '仅复制原草稿', exact: true })).toHaveCount(0);
    await preserved(page, original);
    await evidence(page, info, domain, 'closed-view-aborts-adoption-after-original-rpc-settles');
    await page.getByRole('button', { name: '精确重开未知basis', exact: true }).click();
    await expect(page.getByLabel('准确原版状态', { exact: true })).toHaveText('unavailable');
    expect((await state(page)).exact?.result).toBeNull();
    await expect(page.getByRole('textbox', { name: '仅复制原草稿', exact: true })).toHaveCount(0);
    await preserved(page, original);
    await evidence(page, info, domain, 'unknown-basis-rpc-failure-does-not-authorize-copy');
    await closeTab(page);
    await armRpcGate(page, 'resources.reportVersion', '', true);
    await page.getByRole('button', { name: '精确重开R1', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => !!Reflect.get(globalThis, '__scholoomRpcGate')?.held))
      .toBe(true);
    await page.getByRole('button', { name: '释放测试连接', exact: true }).click();
    await expect.poll(async () => (await state(page)).clientPhase).toBe('disconnected');
    await expect(page.getByLabel('准确原版状态', { exact: true })).toHaveText('unavailable');
    expect((await state(page)).exact?.result).toBeNull();
    await releaseRpcGate(page);
    await expect(page.getByRole('textbox', { name: '仅复制原草稿', exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '真实连接报告页面', exact: true })).toHaveCount(
      0,
    );
    await preserved(page, original);
    await evidence(page, info, domain, 'cached-r1-real-client-disconnect-does-not-authorize-copy');
    await closeTab(page);
  } finally {
    try {
      await cleanup(page, domain);
    } finally {
      await site?.close();
    }
  }
});

test('authenticated report notifications preserve shared drafts and close seals a late real report receipt', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const domain = await connectedDomain(info.outputPath('domain'));
  let site: Awaited<ReturnType<typeof connectedSite>> | undefined;
  try {
    site = await connectedSite(domain.configuration, { html, script, css });
    await mount(page, uiHost, domain, site.url);
    const original = await protect(page);
    assert(original.metadata?.current);
    const basis = original.metadata.current.resource.basis;
    expect(original.items[0]).toMatchObject({ kind: 'object', basis, comment: '检查原版本对象' });
    await page.getByRole('button', { name: '保留旧动作', exact: true }).click();
    await page.getByRole('button', { name: '真实保存下一版', exact: true }).click();
    await expect.poll(async () => !!(await state(page)).metadata?.pending).toBe(true);
    const pending = await state(page);
    assert(pending.metadata?.pending);
    expect(pending.metadata.current?.resource.basis).toBe(basis);
    expect(pending.body).toBe(original.body);
    expect(pending.serialized).toBe(original.serialized);
    expect(pending.stored).toBe(original.stored);
    expect(
      pending.changes.some((change) => change.projectId === domain.configuration.projectId),
    ).toBe(true);
    const facts = await domain.facts();
    expect(facts.html).toBe(facts.expectedHtml);
    expect(pending.metadata.pending.resource.basis).toBe(facts.latest.basis);
    await evidence(page, info, domain, 'real-save-pending-keeps-original-adapter-drafts');
    await page.getByRole('button', { name: '明确查看候选', exact: true }).click();
    await expect(page.getByLabel('当前报告版本', { exact: true })).toHaveText(facts.latest.basis);
    await page.getByRole('button', { name: '提交旧动作', exact: true }).click();
    await expect(page.getByLabel('原动作结果', { exact: true })).toHaveText('unavailable');
    expect((await state(page)).serialized).toBe(original.serialized);
    expect((await state(page)).body).toBe(original.body);
    const checked = (await state(page)).settled;
    await page.getByRole('button', { name: '显式重新核查', exact: true }).click();
    await expect.poll(async () => (await state(page)).settled).toBe(checked + 1);
    await expect(page.getByLabel('待看报告版本', { exact: true })).toHaveText(facts.latest.basis);
    await page.getByRole('button', { name: '明确查看候选', exact: true }).click();
    await page.getByRole('button', { name: '附加报告对象', exact: true }).click();
    await expect(page.getByLabel('原动作结果', { exact: true })).toHaveText('queued');
    const shared = await state(page);
    expect(shared.items.find((item) => item.itemId === original.items[0]?.itemId)).toEqual(
      original.items[0],
    );
    expect(shared.body).toBe(original.body);
    await page.getByRole('button', { name: '保留旧动作', exact: true }).click();
    const settled = (await state(page)).settled;
    await armRpcGate(page, 'resources.report', '', true);
    await page.getByRole('button', { name: '显式重新核查', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => !!Reflect.get(globalThis, '__scholoomRpcGate')?.held))
      .toBe(true);
    const heldBasis = await page.evaluate(
      () =>
        JSON.parse(Reflect.get(globalThis, '__scholoomRpcGate').held.payload).result.resource.basis,
    );
    expect(heldBasis).toBe(facts.latest.basis);
    const reports = () =>
      domain.domain
        .facts()
        .requests.filter(
          (request) => request.connection > 2 && request.method === 'resources.report',
        ).length;
    const count = reports();
    await closeTab(page);
    await releaseRpcGate(page);
    await expect.poll(async () => (await state(page)).settled).toBe(settled + 1);
    expect(reports()).toBe(count);
    const closed = await state(page);
    expect(closed.metadata).toBeNull();
    expect(closed.body).toBe(original.body);
    expect(closed.serialized).toBe(shared.serialized);
    await page.getByRole('button', { name: '提交旧动作', exact: true }).click();
    await expect(page.getByLabel('原动作结果', { exact: true })).toHaveText('unavailable');
    await evidence(page, info, domain, 'closed-real-client-receipt-settles-without-revival', true);
  } finally {
    try {
      await cleanup(page, domain);
    } finally {
      await site?.close();
    }
  }
});

test('real library read revocation hides the dirty report and recovery requires explicit domain recheck', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const domain = await connectedDomain(info.outputPath('domain'));
  let site: Awaited<ReturnType<typeof connectedSite>> | undefined;
  try {
    site = await connectedSite(domain.configuration, { html, script, css });
    await mount(page, uiHost, domain, site.url);
    const original = await protect(page);
    await page.getByRole('button', { name: '撤回库来源读取', exact: true }).click();
    await expect(page.getByLabel('报告错误', { exact: true })).toHaveText('permissionDenied');
    await expect(page.getByLabel('报告可展示', { exact: true })).toHaveText('false');
    await expect(page.getByRole('region', { name: '真实连接报告页面', exact: true })).toHaveCount(
      0,
    );
    const denied = await state(page);
    expect(denied.stored).toBeNull();
    expect(denied.body).toBe(original.body);
    expect(denied.serialized).toBe(original.serialized);
    expect((await domain.facts()).reportError).toBe('permissionDenied');
    await evidence(page, info, domain, 'real-library-revocation-seals-dirty-page');
    const notices = denied.changes.filter((value) => value.libraryChanged).length;
    await page.getByRole('button', { name: '恢复库来源读取', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).changes.filter((value) => value.libraryChanged).length)
      .toBeGreaterThan(notices);
    expect((await domain.facts()).reportError).toBeNull();
    expect((await state(page)).metadata?.canDisplay).toBe(false);
    const settled = (await state(page)).settled;
    await page.getByRole('button', { name: '显式重新核查', exact: true }).click();
    await expect.poll(async () => (await state(page)).settled).toBe(settled + 1);
    await expect(page.getByRole('button', { name: '明确查看候选', exact: true })).toBeEnabled();
    expect((await state(page)).metadata?.canDisplay).toBe(false);
    await page.getByRole('button', { name: '明确查看候选', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '报告页面草稿', exact: true })).toHaveValue(
      '尚未提交的报告批注',
    );
    const recovered = await state(page);
    expect(recovered.metadata?.canDisplay).toBe(true);
    expect(recovered.serialized).toBe(original.serialized);
    expect(recovered.body).toBe(original.body);
    expect(recovered.stored).toBe(original.stored);
    expect(domain.domain.facts().requests.some((value) => value.method === 'session.send')).toBe(
      false,
    );
    await evidence(page, info, domain, 'explicit-real-check-recovers-original-typed-draft', true);
    await closeTab(page);
  } finally {
    try {
      await cleanup(page, domain);
    } finally {
      await site?.close();
    }
  }
});
