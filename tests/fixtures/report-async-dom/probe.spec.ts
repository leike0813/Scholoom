import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, openWorkbenchWindow, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';
import { startProbe } from '../report-worker-dom/controller.js';

const built = process.env.SCHOOLOOM_ASYNC_DOM_BUILD;
const inspect = (page: Page) =>
  page.evaluate(() => Reflect.get(window, 'asyncDomProbe').readDiagnostics());
const nativeState = (page: Page) =>
  page
    .frameLocator('iframe[title="Async native view"]')
    .getByLabel('Ordinary input', { exact: true })
    .evaluate((node) => ({
      value: (node as HTMLInputElement).value,
      selection: [
        (node as HTMLInputElement).selectionStart,
        (node as HTMLInputElement).selectionEnd,
      ],
      focused: node.ownerDocument.activeElement === node,
      index: Reflect.get(node, '_index_'),
    }));

async function setup(page: Page, host: string, info: TestInfo, options = '') {
  assert(built);
  const controller = await startProbe(built, info.outputPath());
  const evidence: Record<string, any> = {
    host,
    options,
    osIsolation: false,
    systemIme: 'unverified',
    screenReader: 'unverified',
  };
  const errors: string[] = [];
  const fetched: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().endsWith('/sample.js')) fetched.push(r.url());
  });
  const gates: Array<{
    matches(input: any): boolean;
    ready(reply: any): void;
    released: Promise<void>;
    release(): void;
  }> = [];
  function hold(matches: (input: any) => boolean) {
    let ready!: (reply: any) => void, release!: () => void;
    const received = new Promise<any>((resolve) => {
      ready = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    gates.push({ matches, ready, released, release });
    return { ready: received, release };
  }
  try {
    if (host === 'browser') await page.goto(rendererUrl);
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
    await page.route(`${rendererUrl}wire`, async (route) => {
      const input = route.request().postDataJSON();
      const response = await fetch(`${controller.origin}/wire`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      const reply = await response.json();
      const index = gates.findIndex((g) => g.matches(input));
      if (index >= 0) {
        const gate = gates.splice(index, 1)[0]!;
        gate.ready({ input, reply });
        await gate.released;
      }
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(reply),
      });
    });
    await page.route(
      (url) => url.origin + '/' === rendererUrl && url.pathname === '/',
      async (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: await readFile(join(built!, 'index.html'), 'utf8'),
        }),
    );
    await page.goto(rendererUrl + options);
    await expect(page.getByRole('tab', { name: 'Async DOM probe.html' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const frame = page.frameLocator('iframe[title="Async native view"]');
    const input = frame.getByLabel('Ordinary input', { exact: true });
    await expect(input).toBeVisible();
    await expect.poll(async () => (await inspect(page)).running).toBe(false);
    expect((await inspect(page)).error).toBe('');
    return {
      controller,
      evidence,
      hold,
      frame,
      input,
      async finish(failure?: unknown) {
        for (const gate of gates) gate.release();
        evidence.final = await inspect(page).catch(() => null);
        evidence.native = await nativeState(page).catch(() => null);
        if (evidence.final) await page.evaluate(() => Reflect.get(window, 'asyncDomProbe').close());
        evidence.closed = await inspect(page).catch(() => null);
        evidence.errors = errors;
        evidence.fetchedSource = fetched;
        evidence.source = controller.readDiagnostics();
        if (failure) {
          evidence.firstFailure = String(failure);
          await writeFile(info.outputPath('first-failure.json'), JSON.stringify(evidence, null, 2));
        }
        await writeFile(info.outputPath('evidence.json'), JSON.stringify(evidence, null, 2));
        await controller.close();
        if (!failure) {
          expect(errors).toEqual([]);
          expect(fetched).toEqual([]);
        }
      },
    };
  } catch (error) {
    for (const gate of gates) gate.release();
    evidence.firstFailure = String(error);
    evidence.host = await inspect(page).catch(() => null);
    evidence.errors = errors;
    await writeFile(info.outputPath('first-failure.json'), JSON.stringify(evidence, null, 2));
    if (evidence.host) await page.evaluate(() => Reflect.get(window, 'asyncDomProbe').close());
    await controller.close();
    throw error;
  }
}
const hasEvent = (type: string) => (input: any) =>
  input.messages?.some((m: any) => m.message?.[39]?.[12] === type);
const idle = (page: Page) =>
  expect
    .poll(async () => {
      const d = await inspect(page);
      return !d.running && d.queued === 0;
    })
    .toBe(true);

for (const { reverse, html } of [
  { reverse: false, html: false },
  { reverse: true, html: false },
  { reverse: false, html: true },
])
  test(`baseline native input ${html ? 'HTML ingestion' : `layout ${reverse ? 'reverse' : 'forward'}`}`, async ({
    uiPage: page,
    uiHost,
  }, info) => {
    const f = await setup(page, uiHost, info, html ? '?html' : reverse ? '?reverse' : '');
    let failure: unknown, oracle: Page | undefined;
    try {
      oracle = await openWorkbenchWindow(page);
      await oracle.route(rendererUrl, (route) =>
        route.fulfill({
          contentType: 'text/html',
          body:
            '<!doctype html><html><meta charset="utf-8"><body><script type="module">import {mountSample} from "/sample.js"; window.nativeSample=mountSample(window,' +
            JSON.stringify({ reverse, html }) +
            ');</script></body></html>',
        }),
      );
      await oracle.route(`${rendererUrl}sample.js`, async (route) =>
        route.fulfill({
          contentType: 'text/javascript',
          body: await readFile(join(built!, 'sample.js'), 'utf8'),
        }),
      );
      await oracle.goto(rendererUrl);
      const native = oracle.getByLabel('Ordinary input');
      await f.input.click();
      await f.input.press('a');
      await idle(page);
      await native.click();
      await native.press('a');
      await expect(f.input).toHaveValue('a');
      const source = (await inspect(page)).source;
      const original = await oracle.evaluate(() => Reflect.get(window, 'nativeSample').read());
      expect(source).toEqual(original);
      expect(source.syntheticPrevented).toBe(true);
      f.evidence.normal = { source, original, native: await nativeState(page) };
      expect(f.evidence.normal.native).toMatchObject({ selection: [1, 1], focused: true });
      const shape = await f.frame.locator('math').evaluate((m) => ({
        namespace: m.namespaceURI,
        fraction: m.firstElementChild?.localName,
        numerator: m.querySelector('mi')?.textContent,
        denominator: m.querySelector('mn')?.textContent,
      }));
      expect(shape).toEqual(original.math);
      if (html) {
        await f.frame.locator('math').scrollIntoViewIfNeeded();
        const bounds = await f.frame.locator('math').evaluate((math) =>
          [...math.querySelectorAll('mi, mn')].map((node) => {
            const rect = node.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, width: rect.width };
          }),
        );
        expect(bounds).toHaveLength(2);
        expect(bounds[0]!.width).toBeGreaterThan(0);
        expect(bounds[0]!.bottom).toBeLessThanOrEqual(bounds[1]!.top);
        const cdp = await page.context().newCDPSession(page);
        try {
          const tree = await cdp.send('Page.getFrameTree');
          const child = tree.frameTree.childFrames?.find((f) => f.frame.url === 'about:srcdoc');
          assert(child);
          const ax = await cdp.send('Accessibility.getFullAXTree', { frameId: child.frame.id });
          expect(ax.nodes.some((node) => node.role?.value === 'MathMLFraction')).toBe(true);
          f.evidence.htmlMath = { bounds, nativeFractionRole: true };
        } finally {
          await cdp.detach();
        }
      }
      for (const target of [f.frame, oracle]) {
        await target.getByRole('button', { name: 'Filter', exact: true }).click();
        await target.getByRole('button', { name: 'Expand', exact: true }).click();
      }
      await idle(page);
      await expect(f.frame.locator('#result')).toHaveText('Filtered');
      await expect(f.frame.locator('#detail')).toBeVisible();
      expect((await inspect(page)).source).toEqual(
        await oracle.evaluate(() => Reflect.get(window, 'nativeSample').read()),
      );
      const order = await f.frame
        .locator('article')
        .evaluate((a) => [...a.children].map((n) => n.localName));
      expect(order).toEqual(
        reverse
          ? ['math', 'p', 'button', 'button', 'p', 'input']
          : ['input', 'p', 'button', 'button', 'p', 'math'],
      );
      expect((await inspect(page)).error).toBe('');
      expect(f.controller.readDiagnostics().latest.credit).toBe(4);
      await page.screenshot({ path: info.outputPath('host.png') });
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      if (oracle) await oracle.close();
      await f.finish(failure);
    }
  });

test('unsupported synchronous cancellation latches despite caught exception', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const f = await setup(page, uiHost, info, '?cancel');
  let failure: unknown;
  try {
    await f.input.click();
    await f.input.press('a');
    await idle(page);
    f.evidence.confirmed = await inspect(page);
    await f.input.press('x');
    await expect.poll(async () => (await inspect(page)).error).toBe('unsupportedSynchronousInput');
    await expect(f.input).toHaveValue('ax');
    await expect(f.frame.locator('#result')).toHaveText('a');
    const reply = f.controller.readDiagnostics().latest;
    expect(reply).toMatchObject({
      failure: 'unsupportedSynchronousInput',
      receipts: [],
      packets: [],
      bridgeAccepted: 0,
      state: { caught: true, syntheticPrevented: true },
    });
    expect(reply.processed).toBeUndefined();
    expect(reply.suppressed).toBeGreaterThan(0);
    f.evidence.unsupported = { reply, native: await nativeState(page), host: await inspect(page) };
    const later = await (
      await fetch(`${f.controller.origin}/wire`, {
        method: 'POST',
        body: JSON.stringify({
          op: 'mutate',
          generation: 1,
          consumed: [],
        }),
      })
    ).json();
    expect(later).toMatchObject({
      failure: 'unsupportedSynchronousInput',
      packets: [],
      receipts: [],
      bridgeAccepted: 0,
    });
    expect(later.processed).toBeUndefined();
    f.evidence.afterFailure = later;
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await f.finish(failure);
  }
});

test('race ordinary input waits for exact actual ACK', async ({ uiPage: page, uiHost }, info) => {
  const f = await setup(page, uiHost, info);
  let failure: unknown;
  const releases: Array<() => void> = [];
  try {
    await f.input.click();
    const late = f.hold((i) => i.op === 'mutate');
    releases.push(late.release);
    const ack = f.hold(hasEvent('input'));
    releases.push(ack.release);
    await page.evaluate(() => Reflect.get(window, 'asyncDomProbe').request('mutate'));
    f.evidence.actualLate = await late.ready;
    expect(f.evidence.actualLate.reply.state.value).toBe('late-source');
    await f.input.press('a');
    const pending = await nativeState(page);
    expect(pending).toMatchObject({ value: 'a', selection: [1, 1], focused: true });
    late.release();
    f.evidence.actualInputAck = await ack.ready;
    expect(f.evidence.actualInputAck.reply.receipts[0].value).toBe('a');
    await expect.poll(async () => (await inspect(page)).staged).toBe(1);
    expect(await nativeState(page)).toEqual(pending);
    await expect(f.frame.locator('#result')).toHaveText('');
    f.evidence.beforeActualAckDelivery = await inspect(page);
    expect(f.evidence.actualInputAck.reply.credit).toBe(2);
    ack.release();
    await idle(page);
    await expect(f.frame.locator('#result')).toHaveText('a');
    expect(await nativeState(page)).toEqual(pending);
    const host = await inspect(page);
    expect(host.error).toBe('');
    expect(host.staged).toBe(0);
    expect(host.edits[0].ack).toBe(host.edits[0].revision);
    expect(f.controller.readDiagnostics().latest.credit).toBe(4);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    for (const release of releases) release();
    await f.finish(failure);
  }
});

test('race CDP composition keeps native transaction until end ACK', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const f = await setup(page, uiHost, info);
  let failure: unknown;
  const releases: Array<() => void> = [];
  const cdp = await page.context().newCDPSession(page);
  try {
    await f.input.click();
    const late = f.hold((i) => i.op === 'mutate');
    releases.push(late.release);
    await page.evaluate(() => Reflect.get(window, 'asyncDomProbe').request('mutate'));
    f.evidence.actualLate = await late.ready;
    await cdp.send('Input.imeSetComposition', { text: '你', selectionStart: 1, selectionEnd: 1 });
    await expect(f.input).toHaveValue('你');
    const pending = await nativeState(page);
    late.release();
    await idle(page);
    const active = await inspect(page);
    expect(active.error).toBe('');
    expect(active.staged).toBeGreaterThan(0);
    expect(active.edits[0]).toMatchObject({ composing: true });
    expect(await nativeState(page)).toEqual(pending);
    f.evidence.activeComposition = {
      host: active,
      native: pending,
      source: f.controller.readDiagnostics(),
    };
    const end = f.hold(hasEvent('compositionend'));
    releases.push(end.release);
    await cdp.send('Input.insertText', { text: '你' });
    f.evidence.endAck = await end.ready;
    expect(await nativeState(page)).toEqual(pending);
    end.release();
    await idle(page);
    expect(await nativeState(page)).toEqual(pending);
    const final = await inspect(page);
    expect(final.error).toBe('');
    expect(final.staged).toBe(0);
    expect(final.edits[0].ack).toBe(final.edits[0].revision);
    expect(final.edits[0].composing).toBe(false);
    expect(f.controller.readDiagnostics().latest.credit).toBe(4);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    for (const release of releases) release();
    await cdp.detach();
    await f.finish(failure);
  }
});

test('native click cancellation latches despite caught exception', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const f = await setup(page, uiHost, info, '?cancelClick');
  let failure: unknown;
  try {
    await f.input.click();
    await f.input.press('a');
    await idle(page);
    f.evidence.confirmed = await inspect(page);
    await f.frame.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect.poll(async () => (await inspect(page)).error).toBe('unsupportedSynchronousInput');
    await idle(page);
    const source = f.controller.readDiagnostics();
    const reply = source.latest;
    const click = source.trace
      .flatMap((row: any) => row.request?.messages ?? [])
      .map((item: any) => item.message?.[39])
      .find((event: any) => event?.[12] === 'click');
    expect(click).toMatchObject({ 12: 'click', 26: true, 31: true });
    expect(reply).toMatchObject({
      failure: 'unsupportedSynchronousInput',
      packets: [],
      receipts: [],
      bridgeAccepted: 0,
      state: { caught: true, syntheticPrevented: true, filtered: false },
    });
    expect(reply.processed).toBeUndefined();
    expect(reply.suppressed).toBeGreaterThan(0);
    expect(reply.state.events.at(-1)).toMatchObject({ type: 'click', prevented: false });
    await expect(f.frame.locator('#result')).toHaveText('a');
    await expect(f.input).toHaveValue('a');
    f.evidence.cancelClick = {
      click,
      reply,
      host: await inspect(page),
      native: await nativeState(page),
    };
    const later = await (
      await fetch(`${f.controller.origin}/wire`, {
        method: 'POST',
        body: JSON.stringify({
          op: 'mutate',
          generation: 1,
          consumed: [],
        }),
      })
    ).json();
    expect(later).toMatchObject({
      failure: 'unsupportedSynchronousInput',
      packets: [],
      receipts: [],
      bridgeAccepted: 0,
    });
    expect(later.processed).toBeUndefined();
    f.evidence.afterFailure = later;
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await f.finish(failure);
  }
});

for (const op of ['replace', 'close'] as const)
  test(`race ${op} rejects old package`, async ({ uiPage: page, uiHost }, info) => {
    const f = await setup(page, uiHost, info);
    let failure: unknown,
      release = () => {};
    try {
      await f.input.click();
      const gate = f.hold((i) => i.op === (op === 'replace' ? 'replace' : 'mutate'));
      release = gate.release;
      await page.evaluate(
        (action) => Reflect.get(window, 'asyncDomProbe').request(action),
        op === 'replace' ? 'replace' : 'mutate',
      );
      f.evidence.actualHeld = await gate.ready;
      await f.input.press('a');
      const pending = await nativeState(page);
      if (op === 'close') await page.evaluate(() => Reflect.get(window, 'asyncDomProbe').close());
      release();
      await idle(page);
      expect(await nativeState(page)).toEqual(pending);
      const host = await inspect(page);
      if (op === 'replace') {
        expect(host.error).toContain('staleInputNode');
        expect(host.staged).toBe(1);
        expect(host.edits[0].ack).toBeLessThan(host.edits[0].revision);
      } else {
        expect(host.closed).toBe(true);
        expect(host.generation).toBe(2);
        expect(host.trace.some((row: any) => row.staleReply)).toBe(true);
      }
      f.evidence.rejected = { host, native: await nativeState(page) };
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      release();
      await f.finish(failure);
    }
  });
