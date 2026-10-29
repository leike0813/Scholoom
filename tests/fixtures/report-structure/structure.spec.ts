import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';
import { createStructureController } from './controller.js';

const built = process.env.SCHOOLOOM_REPORT_STRUCTURE_BUILD;
test.skip(!built, 'Supply the fixed trusted structure fixture build');
test('R2b fixed original structure, MathML, native text and bounded input in the common tab', async ({
  uiPage: page,
  uiHost,
}, info) => {
  assert(built);
  const controller = await createStructureController(built);
  const evidence: Record<string, unknown> = {
    host: uiHost,
    osIsolation: false,
    systemIme: 'unverified',
    screenReader: 'unverified',
  };
  const errors: string[] = [];
  let blocked: { received(): void; unblock: Promise<void> } | undefined;
  let releaseBlocked: (() => void) | undefined;
  function holdNextResponse() {
    let received!: () => void;
    const ready = new Promise<void>((resolve) => {
      received = resolve;
    });
    let release!: () => void;
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    blocked = { received, unblock };
    releaseBlocked = release;
    return { ready, release };
  }
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    if (uiHost === 'browser') await page.goto(rendererUrl);
    await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    for (const [name, contentType] of [
      ['surface.js', 'text/javascript'],
      ['surface.css', 'text/css'],
    ]) {
      const body = await readFile(join(built, name!), 'utf8');
      await page.route(`${rendererUrl}${name}`, (route) =>
        route.fulfill({ contentType: contentType!, body }),
      );
    }
    await page.route(`${rendererUrl}__structure/action`, async (route) => {
      const result = await fetch(`${controller.origin}/__structure/action`, {
        method: 'POST',
        body: route.request().postData(),
      });
      const gate = blocked;
      if (gate) {
        blocked = undefined;
        gate.received();
        await gate.unblock;
      }
      await route.fulfill({
        status: result.status,
        contentType: 'application/json',
        body: await result.text(),
      });
    });
    await page.route(rendererUrl, async (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: await readFile(join(built, 'index.html'), 'utf8'),
      }),
    );
    await page.goto(rendererUrl);
    await expect(page.getByRole('tab', { name: /可信结构对照/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const frame = page.frameLocator('iframe[title="固定文献原结构"]');
    const filter = frame.getByLabel('筛选文献', { exact: true });
    await expect(frame.getByRole('status', { name: '显示数量' })).toHaveText('3 / 3');
    await filter.fill('随机');
    await expect(frame.getByRole('status', { name: '显示数量' })).toHaveText('2 / 3');
    await frame.getByLabel('排序', { exact: true }).selectOption('descending');
    await expect(frame.locator('tbody tr').first()).toHaveAttribute('data-id', 'trial-b');
    const summary = frame.getByText('详情 赵 2023', { exact: true });
    await summary.focus();
    await summary.press('Enter');
    await expect(frame.locator('tr[data-id="trial-b"] details')).toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    const state = await page.evaluate(() => Reflect.get(window, 'reportStructure').read());
    expect(state.snapshot.state).toEqual(await controller.read());
    evidence.state = state;
    const sourceText = await controller.source.locator('table').innerText();
    const frameText = await frame.locator('table').innerText();
    expect(frameText).toBe(sourceText);
    evidence.text = { source: sourceText, frame: frameText };
    const inspect = (element: HTMLElement) => {
      const math = element.querySelector('math')!;
      const frac = math.querySelector('mfrac')!;
      const numbers = [...frac.querySelectorAll('mn')];
      const bounds = numbers.map((n) => {
        const r = n.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      });
      return {
        mathNamespace: math.namespaceURI,
        fractionNamespace: frac.namespaceURI,
        digits: numbers.map((n) => n.textContent),
        bounds,
        scripts: element.ownerDocument.scripts.length,
        sourceRuntime: Reflect.has(element.ownerDocument.defaultView!, 'surfaceSource'),
      };
    };
    const sourceMath = await controller.source.locator('body').evaluate(inspect);
    const frameMath = await frame.locator('body').evaluate(inspect);
    expect(frameMath.mathNamespace).toBe('http://www.w3.org/1998/Math/MathML');
    expect(frameMath.fractionNamespace).toBe(sourceMath.fractionNamespace);
    expect(frameMath.digits).toEqual(sourceMath.digits);
    for (const layout of [sourceMath, frameMath]) {
      expect(layout.bounds[0]!.bottom).toBeLessThanOrEqual(layout.bounds[1]!.top);
      expect(layout.bounds[0]!.width).toBeGreaterThan(0);
    }
    expect(frameMath.scripts).toBe(0);
    expect(frameMath.sourceRuntime).toBe(false);
    evidence.math = { source: sourceMath, frame: frameMath };
    const cdp = await page.context().newCDPSession(page);
    const tree = await cdp.send('Page.getFrameTree');
    const child = tree.frameTree.childFrames?.find((f) => f.frame.url === 'about:srcdoc');
    assert(child);
    const frameAx = await cdp.send('Accessibility.getFullAXTree', { frameId: child.frame.id });
    const sourceCdp = await controller.source.context().newCDPSession(controller.source);
    const sourceAx = await sourceCdp.send('Accessibility.getFullAXTree');
    const compact = (ax: typeof sourceAx) =>
      ax.nodes
        .filter((n) => !n.ignored)
        .slice(0, 200)
        .map((n) => ({ role: n.role?.value, name: n.name?.value, properties: n.properties }));
    const mathRoles = (ax: typeof sourceAx) =>
      ax.nodes.filter((n) => n.role?.value === 'MathMLFraction').length;
    expect(mathRoles(frameAx)).toBe(mathRoles(sourceAx));
    expect(mathRoles(frameAx)).toBe(2);
    expect(frameAx.nodes.some((n) => n.role?.value === 'table')).toBe(true);
    evidence.accessibility = { source: compact(sourceAx), frame: compact(frameAx) };
    await page.screenshot({ path: info.outputPath('structure.png'), fullPage: true });
    await controller.source.screenshot({ path: info.outputPath('source.png'), fullPage: true });

    const paragraph = frame.locator('tr[data-id="trial-b"] p');
    const rect = await paragraph.boundingBox();
    assert(rect);
    await page.mouse.dblclick(rect.x + 20, rect.y + rect.height / 2);
    const selection = () =>
      frame
        .locator('body')
        .evaluate((e) => e.ownerDocument.defaultView?.getSelection()?.toString());
    const selected = await selection();
    expect(selected?.length).toBeGreaterThan(0);
    if (uiHost === 'browser')
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.keyboard.press('Control+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(selected);
    evidence.copy = { selected, copied };
    await page.getByLabel('查找可见正文', { exact: true }).fill('结论需要核查');
    await page.getByRole('button', { name: '查找', exact: true }).click();
    await expect(page.getByRole('status', { name: '查找结果' })).toHaveText('未找到');
    await page.getByLabel('查找可见正文', { exact: true }).fill('剂量20与30');
    await page.getByRole('button', { name: '查找', exact: true }).click();
    await expect(page.getByRole('status', { name: '查找结果' })).toHaveText('找到');
    expect(await selection()).toBe('剂量20与30');
    evidence.find = { visibleOnly: true, selection: await selection() };
    await filter.focus();
    await page.keyboard.press('Tab');
    await expect(frame.getByLabel('排序', { exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(filter).toBeFocused();
    await filter.fill('');
    await expect(frame.getByRole('status', { name: '显示数量' })).toHaveText('3 / 3');
    await expect(filter).toBeFocused();
    await cdp.send('Input.imeSetComposition', { text: '队列', selectionStart: 2, selectionEnd: 2 });
    await expect(filter).toHaveValue('队列');
    expect((await controller.read()).filter).toBe('');
    await cdp.send('Input.insertText', { text: '队列' });
    await expect(frame.getByRole('status', { name: '显示数量' })).toHaveText('1 / 3');
    await expect(filter).toBeFocused();
    expect(await filter.evaluate((e) => (e as HTMLInputElement).selectionStart)).toBe(2);
    const committed = await page.evaluate(() => Reflect.get(window, 'reportStructure').read());
    expect(committed.snapshot.state).toEqual(await controller.read());
    evidence.composition = { method: 'CDP, not system IME', state: committed };

    // Only delay the real response; source execution and returned DOM stay real.
    const focusGate = holdNextResponse();
    await filter.fill('随机');
    await focusGate.ready;
    const parentFind = page.getByLabel('查找可见正文', { exact: true });
    await parentFind.focus();
    focusGate.release();
    await expect(frame.getByRole('status', { name: '显示数量' })).toHaveText('2 / 3');
    await expect(parentFind).toBeFocused();
    evidence.focusDuringUpdate = { parentFocusRetained: true };

    // Deliberate remaining counterexample: srcdoc replacement destroys an active composition.
    const compositionGate = holdNextResponse();
    await filter.fill('');
    await compositionGate.ready;
    await cdp.send('Input.imeSetComposition', { text: '队列', selectionStart: 2, selectionEnd: 2 });
    await expect(filter).toHaveValue('队列');
    const pendingComposition = await filter.inputValue();
    compositionGate.release();
    await expect(frame.getByRole('status', { name: '显示数量' })).toHaveText('3 / 3');
    await expect(filter).toHaveValue('');
    evidence.compositionDuringUpdate = {
      pending: pendingComposition,
      after: await filter.inputValue(),
      source: await controller.read(),
      verdict: 'active composition lost on document replacement; candidate insufficient',
    };
    const last = await page.evaluate(() => Reflect.get(window, 'reportStructure').read());
    const before = await controller.read();
    expect(
      await controller.request({ generation: 0, action: 'filter', value: 'invalid old action' }),
    ).toEqual({ code: 'obsolete' });
    expect(await controller.read()).toEqual(before);
    const active = controller.request({ generation: last.snapshot.generation });
    expect(await controller.request({ generation: last.snapshot.generation })).toEqual({
      code: 'busy',
    });
    await active;
    evidence.bounds = {
      obsoleteRejected: true,
      oneInFlightRejected: true,
      maxGeneration: 128,
      maxElements: 256,
      maxBytes: 65536,
    };
    expect(errors).toEqual([]);
  } finally {
    releaseBlocked?.();
    evidence.observations = controller.observations;
    evidence.pageErrors = errors;
    await writeFile(info.outputPath('r2b-evidence.json'), JSON.stringify(evidence, null, 2));
    await writeFile(info.outputPath('closed.json'), JSON.stringify(await controller.close()));
  }
});
