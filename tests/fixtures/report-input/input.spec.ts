import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';
import { createInputController } from './controller.js';

const built = process.env.SCHOOLOOM_REPORT_INPUT_BUILD;
test.skip(!built, 'Supply the fixed trusted report-input build');
const inspect = (page: Page) => page.evaluate(() => Reflect.get(window, 'reportInput').read());
async function mount(page: Page, host: string) {
  assert(built);
  const controller = await createInputController(built);
  let gate: { key: string; ready(): void; release: Promise<void> } | undefined;
  const releases: (() => void)[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  function hold(key = 'first') {
    assert(!gate);
    let ready!: () => void, release!: () => void;
    const received = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    gate = { key, ready, release: wait };
    releases.push(release);
    return { ready: received, release };
  }
  try {
    if (host === 'browser') await page.goto(rendererUrl);
    await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    for (const [name, type] of [
      ['surface.js', 'text/javascript'],
      ['surface.css', 'text/css'],
    ]) {
      const body = await readFile(join(built, name!), 'utf8');
      await page.route(`${rendererUrl}${name}`, (route) =>
        route.fulfill({ contentType: type!, body }),
      );
    }
    await page.route(`${rendererUrl}__input/*`, async (route) => {
      const key = new URL(route.request().url()).pathname.split('/').at(-1)!;
      const result = await fetch(`${controller.origin}/__input/${key}`, {
        method: 'POST',
        body: route.request().postData(),
      });
      const body = await result.text();
      if (gate?.key === key) {
        const held = gate;
        gate = undefined;
        held.ready();
        await held.release;
      }
      await route.fulfill({ status: result.status, contentType: 'application/json', body });
    });
    await page.route(rendererUrl, async (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: await readFile(join(built, 'index.html'), 'utf8'),
      }),
    );
    await page.goto(rendererUrl);
    await expect(page.getByRole('tab', { name: /可信输入事务/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.frameLocator('iframe').getByRole('status', { name: '显示数量' })).toHaveText(
      '3 / 3',
    );
    return {
      controller,
      hold,
      errors,
      async close(info: TestInfo, evidence: unknown) {
        for (const release of releases) release();
        try {
          await writeFile(
            info.outputPath('input-evidence.json'),
            JSON.stringify(evidence, null, 2),
          );
        } finally {
          await writeFile(info.outputPath('closed.json'), JSON.stringify(await controller.close()));
        }
      },
    };
  } catch (error) {
    for (const release of releases) release();
    await controller.close();
    throw error;
  }
}

test('fixed input transactions retain native preedit and latest intent until real source commit/cancel confirmation', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const fixture = await mount(page, uiHost);
  const evidence: Record<string, unknown> = {
    host: uiHost,
    systemIme: 'unverified',
    screenReader: 'unverified',
    osIsolation: false,
  };
  try {
    const source = await fixture.controller.get('first');
    const frame = page.frameLocator('iframe');
    const input = frame.getByLabel('筛选文献', { exact: true });
    const count = frame.getByRole('status', { name: '显示数量' });
    const cdp = await page.context().newCDPSession(page);
    await input.fill('随机');
    await expect(count).toHaveText('2 / 3');
    await page.evaluate(() => {
      const f = document.querySelector('iframe')!;
      Reflect.set(window, 'inputIdentity', {
        doc: f.contentDocument,
        input: f.contentDocument!.querySelector('#filter'),
      });
    });
    const identity = () =>
      page.evaluate(() => {
        const f = document.querySelector('iframe')!,
          old = Reflect.get(window, 'inputIdentity');
        return {
          document: old.doc === f.contentDocument,
          input: old.input === f.contentDocument?.querySelector('#filter'),
        };
      });

    const old = fixture.hold();
    await input.fill('');
    await old.ready;
    await input.fill('随');
    await input.fill('随机');
    expect((await inspect(page)).transactions.first.pending.value).toBe('随机');
    const order = frame.getByLabel('排序', { exact: true });
    await order.selectOption('descending');
    await expect(order).toHaveValue('ascending');
    await expect(page.getByRole('status', { name: '控件反馈' })).toHaveAttribute(
      'data-code',
      'controlConflict',
    );
    expect((await source.read()).order).toBe('ascending');
    expect((await inspect(page)).transactions.first.pending.value).toBe('随机');
    evidence.controlConflict = {
      displayed: await order.inputValue(),
      source: (await source.read()).order,
    };
    await input.press('Control+a');
    await cdp.send('Input.imeSetComposition', { text: '队列', selectionStart: 2, selectionEnd: 2 });
    await expect(input).toHaveValue('队列');
    const base = (await inspect(page)).transactions.first.confirmed;
    old.release();
    await expect
      .poll(async () => (await inspect(page)).transactions.first.confirmed)
      .toBe(base + 1);
    await expect(input).toHaveValue('队列');
    await expect(input).toBeFocused();
    await expect(count).toHaveText('2 / 3');
    expect(await identity()).toEqual({ document: true, input: true });
    expect(
      await input.evaluate((e) => ({
        readonly: (e as HTMLInputElement).readOnly,
        disabled: (e as HTMLInputElement).disabled,
      })),
    ).toEqual({ readonly: false, disabled: false });
    const protectedState = (await inspect(page)).transactions.first;
    expect(protectedState.composing).toBe(true);
    expect(protectedState.candidate).not.toBeNull();
    evidence.protected = {
      transaction: protectedState,
      source: await source.read(),
      identity: await identity(),
      value: await input.inputValue(),
    };

    const committed = fixture.hold();
    await cdp.send('Input.insertText', { text: '队列' });
    await committed.ready;
    expect((await source.read()).filter).toBe('队列');
    await expect(count).toHaveText('2 / 3');
    evidence.beforeCommitAck = {
      source: await source.read(),
      transaction: (await inspect(page)).transactions.first,
      value: await input.inputValue(),
    };
    committed.release();
    await expect(count).toHaveText('1 / 3');
    await expect(input).toHaveValue('队列');
    await expect(input).toBeFocused();
    expect(await identity()).toEqual({ document: true, input: true });
    expect(await input.evaluate((e) => (e as HTMLInputElement).selectionStart)).toBe(2);

    // One representative of retained source structure/text/AX, not the prior full matrix.
    await frame.locator('summary').click();
    await expect(frame.locator('details')).toHaveAttribute('open', '');
    expect(await frame.locator('table').innerText()).toBe(
      await source.source.locator('table').innerText(),
    );
    const math = await frame.locator('math').evaluate((e) => ({
      namespace: e.namespaceURI,
      fraction: e.firstElementChild?.localName,
      digits: [...e.querySelectorAll('mn')].map((n) => n.textContent),
      positions: [...e.querySelectorAll('mn')].map((n) => n.getBoundingClientRect().top),
    }));
    expect(math.namespace).toBe('http://www.w3.org/1998/Math/MathML');
    expect(math.fraction).toBe('mfrac');
    expect(math.positions[0]).toBeLessThan(math.positions[1]!);
    const tree = await cdp.send('Page.getFrameTree');
    const child = tree.frameTree.childFrames?.find((f) => f.frame.url === 'about:srcdoc');
    assert(child);
    const ax = await cdp.send('Accessibility.getFullAXTree', { frameId: child.frame.id });
    expect(ax.nodes.some((n) => n.role?.value === 'MathMLFraction')).toBe(true);
    const paragraph = await frame.locator('details p').boundingBox();
    assert(paragraph);
    await page.mouse.dblclick(paragraph.x + 20, paragraph.y + paragraph.height / 2);
    const selected = await frame
      .locator('body')
      .evaluate((e) => e.ownerDocument.defaultView?.getSelection()?.toString());
    expect(selected?.length).toBeGreaterThan(0);
    if (uiHost === 'browser')
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.keyboard.press('Control+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(selected);
    await page.getByLabel('查找可见正文', { exact: true }).fill('关联');
    await page.getByRole('button', { name: '查找', exact: true }).click();
    await expect(page.getByRole('status', { name: '查找结果' })).toHaveText('找到');
    evidence.structure = {
      math,
      ax: ax.nodes
        .filter((n) => !n.ignored)
        .slice(0, 120)
        .map((n) => ({ role: n.role?.value, name: n.name?.value })),
      selected,
      copied,
      source: await source.read(),
    };
    await page.screenshot({ path: info.outputPath('input.png') });
    await source.source.screenshot({ path: info.outputPath('source.png') });

    const beforeCancel = fixture.hold();
    await input.fill('随机');
    await beforeCancel.ready;
    await input.press('Control+a');
    await cdp.send('Input.imeSetComposition', { text: '队列', selectionStart: 2, selectionEnd: 2 });
    await expect(input).toHaveValue('队列');
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    const cancelledValue = await input.inputValue();
    const caret = await input.evaluate((e) => (e as HTMLInputElement).selectionStart);
    const cancelAck = fixture.hold();
    beforeCancel.release();
    await cancelAck.ready;
    expect((await source.read()).filter).toBe(cancelledValue);
    expect(await identity()).toEqual({ document: true, input: true });
    evidence.beforeCancelAck = {
      value: cancelledValue,
      caret,
      source: await source.read(),
      transaction: (await inspect(page)).transactions.first,
    };
    cancelAck.release();
    await expect.poll(async () => (await inspect(page)).transactions.first.inFlight).toBe(false);
    await expect(count).toHaveText((await source.read()).count);
    await expect(input).toHaveValue(cancelledValue);
    await expect(input).toBeFocused();
    expect(await input.evaluate((e) => (e as HTMLInputElement).selectionStart)).toBe(caret);
    evidence.final = {
      source: await source.read(),
      ui: await inspect(page),
      identity: await identity(),
      observations: source.observations,
    };
    expect(fixture.errors).toEqual([]);
  } finally {
    evidence.errors = fixture.errors;
    await fixture.close(info, evidence);
  }
});

test('view replacement and close discard old replies and buffered input without rebinding report or receiver', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const fixture = await mount(page, uiHost);
  const evidence: Record<string, unknown> = { host: uiHost };
  try {
    const first = await fixture.controller.get('first');
    const old = fixture.hold();
    await page.frameLocator('iframe').getByLabel('筛选文献', { exact: true }).fill('随机');
    await old.ready;
    await page.frameLocator('iframe').getByLabel('筛选文献', { exact: true }).fill('队列');
    await page.getByRole('button', { name: '换报告版本及接收者', exact: true }).click();
    await expect(page.frameLocator('iframe').getByRole('status', { name: '显示数量' })).toHaveText(
      '3 / 3',
    );
    const second = await fixture.controller.get('second');
    old.release();
    await expect
      .poll(async () => (await inspect(page)).transactions.first.ignored)
      .toBeGreaterThan(0);
    expect((await inspect(page)).transactions.first.closed).toBe(true);
    expect((await inspect(page)).transactions.first.pending).toBeNull();
    expect((await second.read()).filter).toBe('');
    expect((await first.read()).filter).toBe('随机');
    expect(first.observations).toHaveLength(2);
    evidence.replaced = {
      ui: await inspect(page),
      first: await first.read(),
      second: await second.read(),
    };
    const closing = fixture.hold('second');
    await page.frameLocator('iframe').getByLabel('筛选文献', { exact: true }).fill('队列');
    await closing.ready;
    await page.frameLocator('iframe').getByLabel('筛选文献', { exact: true }).fill('随机');
    await page.getByRole('button', { name: '关闭输入视图', exact: true }).click();
    closing.release();
    await expect
      .poll(async () => (await inspect(page)).transactions.second.ignored)
      .toBeGreaterThan(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    const state = await inspect(page);
    expect(state.transactions.second.closed).toBe(true);
    expect(state.transactions.second.pending).toBeNull();
    expect(state.transactions.second.owner).not.toEqual(state.transactions.first.owner);
    expect((await second.read()).filter).toBe('队列');
    expect(second.observations).toHaveLength(2);
    evidence.closed = {
      ui: state,
      second: await second.read(),
      firstObservations: first.observations,
      secondObservations: second.observations,
    };
    expect(fixture.errors).toEqual([]);
  } finally {
    evidence.errors = fixture.errors;
    await fixture.close(info, evidence);
  }
});
