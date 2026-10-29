import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';
import { createSurfaceController } from './controller.js';

const built = process.env.SCHOOLOOM_REPORT_SURFACE_BUILD;
test.skip(!built, 'Supply the separately built trusted surface prototype');
const projected = (page: Page) => page.evaluate(() => Reflect.get(window, 'reportSurface').read());

test('R2 fixed trusted independent page: common tab state, text and bounded input calibration', async ({
  uiPage: page,
  uiHost,
}, info) => {
  assert(built);
  const controller = await createSurfaceController(built);
  const evidence: Record<string, unknown> = {
    host: uiHost,
    osIsolation: false,
    realSystemIme: 'unverified',
    screenReader: 'unverified',
  };
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  try {
    if (uiHost === 'browser') await page.goto(rendererUrl);
    await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    const [html, js, css] = await Promise.all(
      ['index.html', 'surface.js', 'surface.css'].map((name) =>
        readFile(join(built, name), 'utf8'),
      ),
    );
    assert(html && js && css);
    await page.route(`${rendererUrl}surface.js`, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: js }),
    );
    await page.route(`${rendererUrl}surface.css`, (route) =>
      route.fulfill({ contentType: 'text/css', body: css }),
    );
    await page.route(`${rendererUrl}__surface/state`, async (route) => {
      const result = await fetch(`${controller.origin}/state`, {
        method: 'POST',
        body: route.request().postData(),
      });
      await route.fulfill({
        status: result.status,
        contentType: 'application/json',
        body: await result.text(),
      });
    });
    await page.route(rendererUrl, (route) =>
      route.fulfill({ contentType: 'text/html', body: html }),
    );
    await page.goto(rendererUrl);
    await expect(page.getByRole('tab', { name: /可信呈现试验/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('status', { name: '显示数量' })).toHaveText('3 / 3');
    const filter = page.getByLabel('筛选文献', { exact: true });
    await filter.fill('随机');
    await expect(page.getByRole('status', { name: '显示数量' })).toHaveText('2 / 3');
    await page.getByLabel('排序', { exact: true }).selectOption('descending');
    await expect(page.locator('tbody tr').first()).toHaveAttribute('data-object-id', 'trial-b');
    const expand = page.getByRole('button', { name: '详情 赵 2023', exact: true });
    await expand.focus();
    await page.keyboard.press('Enter');
    await expect(expand).toHaveAttribute('aria-expanded', 'true');
    await expect(expand).toBeFocused();
    expect(await projected(page)).toEqual(await controller.read());
    evidence.correspondingState = await projected(page);
    evidence.sourceText = await controller.source.locator('table').innerText();
    evidence.projectedText = await page.locator('article').innerText();

    // Real pointer selection and native Ctrl+C; read actual browser clipboard, no stub.
    const text = page.locator('#detail-trial-b');
    const rect = await text.boundingBox();
    assert(rect);
    await page.mouse.dblclick(rect.x + 20, rect.y + rect.height / 2);
    const selected = await page.evaluate(() => window.getSelection()?.toString());
    expect(selected?.length).toBeGreaterThan(0);
    if (uiHost === 'browser')
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.keyboard.press('Control+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(selected);
    evidence.copy = {
      selected,
      copied,
      method: 'pointer-double-click / Control+C / navigator.clipboard.readText',
    };

    await page.getByLabel('查找可见正文', { exact: true }).fill('剂量20与30');
    await page.getByLabel('查找可见正文', { exact: true }).press('Enter');
    await expect(page.getByRole('status', { name: '查找结果' })).toHaveText('找到');
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('剂量20与30');
    evidence.find = {
      customVisibleTextFind: true,
      hostShortcut: 'not provided by this projection',
    };
    await filter.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('排序', { exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(filter).toBeFocused();

    // Real Chromium composition protocol, not an OS IME/candidate-window claim.
    await filter.fill('');
    await expect(page.getByRole('status', { name: '显示数量' })).toHaveText('3 / 3');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: '队列', selectionStart: 2, selectionEnd: 2 });
    expect((await controller.read()).filter).toBe('');
    await expect(filter).toHaveValue('队列');
    await cdp.send('Input.insertText', { text: '队列' });
    await expect(page.getByRole('status', { name: '显示数量' })).toHaveText('1 / 3');
    await expect(filter).toBeFocused();
    expect(await projected(page)).toEqual(await controller.read());
    evidence.composition = {
      method: 'CDP imeSetComposition + insertText',
      pendingWasNotSent: true,
      committedFilter: (await controller.read()).filter,
    };
    await filter.fill('随机');
    await expect(page.getByRole('status', { name: '显示数量' })).toHaveText('2 / 3');

    const sourceCdp = await controller.source.context().newCDPSession(controller.source);
    const sourceAx = await sourceCdp.send('Accessibility.getFullAXTree');
    const parentAx = await cdp.send('Accessibility.getFullAXTree');
    const compact = (tree: typeof sourceAx) =>
      tree.nodes
        .filter((node) => !node.ignored)
        .slice(0, 200)
        .map((node) => ({
          role: node.role?.value,
          name: node.name?.value,
          properties: node.properties,
        }));
    evidence.sourceAccessibility = compact(sourceAx);
    evidence.projectedAccessibility = compact(parentAx);
    expect(await controller.source.locator('math mfrac').count()).toBe(2);
    expect(await page.locator('math').count()).toBe(0);
    evidence.counterexample = {
      source: 'Native MathML mfrac 1/2',
      projected: await page.locator('tbody tr').first().locator('td').last().innerText(),
      lost: 'fraction structure and math accessibility semantics',
    };
    expect(parentAx.nodes.some((node) => node.role?.value === 'table')).toBe(true);
    expect(parentAx.nodes.some((node) => node.name?.value === '筛选文献')).toBe(true);
    evidence.tabSemantics = await page
      .getByRole('tab', { name: /可信呈现试验/ })
      .getAttribute('aria-selected');
    await page.screenshot({ path: info.outputPath('projection.png'), fullPage: true });
    await controller.source.screenshot({ path: info.outputPath('source.png'), fullPage: true });
    expect(failures).toEqual([]);
  } finally {
    evidence.observations = controller.observations;
    evidence.pageErrors = failures;
    await writeFile(info.outputPath('r2-evidence.json'), JSON.stringify(evidence, null, 2));
    const closed = await controller.close();
    await writeFile(info.outputPath('owned-controller-closed.json'), JSON.stringify(closed));
  }
});
