import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type {
  ReportBridgeMessage,
  ReportProgramCommand,
  ReportProgramPacket,
} from '@scholoom/protocol/reports';
import { test as base, expect } from '../../ui/fixture';
import { rendererUrl } from '../../ui/renderer-url';
import { ids, Wire } from './frames';

const binding = {
  version: 1,
  viewId: 'presentation-fixture',
  generation: 7,
  basis: 'fixed-basis',
} as const;
type InputCommand = Extract<ReportProgramCommand, { type: 'input' }>;
type Snapshot = {
  commands: ReportProgramCommand[];
  messages: ReportBridgeMessage[];
  failures: string[];
};
const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => Reflect.get(window, 'reportDOMProbe').presentation());
const receive = (page: Page, packet: ReportProgramPacket) =>
  page.evaluate((value) => Reflect.get(window, 'reportDOMProbe').receive(value), packet);
const inputs = async (page: Page) =>
  (await snapshot(page)).commands.filter(
    (command): command is InputCommand => command.type === 'input',
  );
const consumed = async (page: Page) =>
  (await snapshot(page)).commands.flatMap((command) =>
    command.type === 'consume' ? command.sequences : [],
  );
const receipt = (revision: number, through: number, value: string): ReportProgramPacket => ({
  ...binding,
  type: 'inputConfirmed',
  nodeId: ids.input,
  revision,
  through,
  value,
  checked: false,
});

function initial(clickSubscriptions = false) {
  const wire = new Wire(1);
  wire.element(ids.article, 'article');
  wire.element(ids.paragraph, 'p');
  wire.text(ids.text, 'Initial evidence');
  wire.element(ids.input, 'input');
  wire.attr(ids.input, 'aria-label', 'Report note');
  wire.attr(ids.input, 'type', 'text');
  wire.property(ids.input, 'value', 'draft');
  wire.children(ids.paragraph, [ids.text]);
  wire.children(ids.article, [ids.paragraph, ids.input]);
  wire.children(2, [ids.article]);
  if (clickSubscriptions) {
    // Source dispatch owns once; native listeners stay until explicit source removal.
    for (const target of [ids.article, ids.paragraph])
      wire.frame.mutations.push(4, target, 0, 1, wire.string('click'), 0, 1, 1, 0, 0);
  }
  return wire.frame;
}

function view(page: Page) {
  const frame = page.frameLocator('iframe[title="交互报告"]');
  const input = frame.getByLabel('Report note', { exact: true });
  return {
    frame,
    input,
    paragraph: frame.locator('p'),
    native: () =>
      input.evaluate((node: HTMLInputElement) => ({
        value: node.value,
        selection: [node.selectionStart, node.selectionEnd],
        focused: node.ownerDocument.activeElement === node,
        retained: Reflect.get(node.ownerDocument, 'savedInput') === node,
      })),
  };
}

const test = base.extend<{ presentation: ReturnType<typeof view> }>({
  presentation: async ({ uiPage: page, uiHost }, use, info) => {
    const built = process.env.SCHOOLOOM_REPORT_DOM_BUILD;
    assert(built);
    const errors: string[] = [];
    const externalRequests: string[] = [];
    const evidence: Record<string, unknown> = {
      host: uiHost,
      reportScripts: false,
      osIsolation: false,
      sendPort: 'synthetic resolved Promise; no source processing',
      wire: 'fixed public frames and receipts',
      composition: 'synthetic DOM events, not system IME',
      permissionsAndFiles: 'static Workbench session substitutes',
    };
    let failure: unknown;
    try {
      if (uiHost === 'browser') await page.goto(rendererUrl);
      await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        if (!request.url().startsWith(rendererUrl)) externalRequests.push(request.url());
      });
      await page.route('**/*', (route) =>
        route.request().url().startsWith(rendererUrl)
          ? route.fallback()
          : route.abort('blockedbyclient'),
      );
      for (const [name, contentType] of [
        ['surface.js', 'text/javascript'],
        ['surface.css', 'text/css'],
        ['index.html', 'text/html'],
      ] as const) {
        const body = await readFile(join(built, name), 'utf8');
        await page.route(name === 'index.html' ? rendererUrl : `${rendererUrl}${name}`, (route) =>
          route.fulfill({ contentType, body }),
        );
      }
      await page.goto(rendererUrl);
      await expect(page.getByRole('tab', { name: 'Report DOM probe.html' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.waitForFunction(() => Boolean(Reflect.get(window, 'reportDOMProbe')));
      await page.evaluate(async () => {
        const probe = Reflect.get(window, 'reportDOMProbe');
        await probe.ready;
        await probe.mountPresentation();
      });
      await receive(page, { ...binding, type: 'ready' });
      await use(view(page));
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      evidence.snapshot = await snapshot(page).catch(() => null);
      Object.assign(evidence, { errors, externalRequests });
      const failed = failure || info.status !== info.expectedStatus;
      if (failed) {
        evidence.firstFailure = String(
          failure ?? info.errors.map((error) => error.message).join('\n'),
        );
        await writeFile(info.outputPath('first-failure.json'), JSON.stringify(evidence, null, 2));
      }
      await writeFile(info.outputPath('evidence.json'), JSON.stringify(evidence, null, 2));
      await page.evaluate(() => Reflect.get(window, 'reportDOMProbe')?.close()).catch(() => {});
      if (!failed) {
        expect(errors).toEqual([]);
        expect(externalRequests).toEqual([]);
        await expect(page.locator('iframe[title="交互报告"]')).toHaveCount(0);
      }
    }
  },
});

test('presentation exposes native controls only after the source is ready', async ({
  uiPage: page,
  presentation: f,
}) => {
  await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').mountPresentation());
  await receive(page, initial());
  await expect.poll(() => consumed(page)).toEqual([1]);
  await expect(f.input).toBeHidden();
  await receive(page, { ...binding, type: 'ready' });
  await expect(f.input).toBeVisible();
  await f.input.fill('ready input');
  await expect.poll(async () => (await inputs(page)).length).toBeGreaterThan(0);
  expect((await snapshot(page)).failures).toEqual([]);
});

test('presentation native edits wait for source receipts before DOM and consumer credit', async ({
  uiPage: page,
  presentation: f,
}) => {
  const first = initial(); // No source event subscription: native input must still be forwarded.
  await receive(page, first);
  await expect.poll(() => consumed(page)).toEqual([1]);
  expect((await snapshot(page)).messages).toEqual([{ ...binding, type: 'ready' }]);
  await f.input.evaluate((node) => Reflect.set(node.ownerDocument, 'savedInput', node));
  await f.input.click();
  await f.input.press('End');
  await f.input.press('!');
  await f.input.press('Shift+ArrowLeft');
  await expect.poll(async () => (await inputs(page)).length).toBe(2);
  expect(
    (await inputs(page)).map(({ input }) => ({
      nodeId: input.nodeId,
      revision: input.revision,
      type: input.eventType,
      value: input.value,
      trusted: input.isTrusted,
    })),
  ).toEqual([
    { nodeId: ids.input, revision: 1, type: 'beforeinput', value: 'draft', trusted: true },
    { nodeId: ids.input, revision: 2, type: 'input', value: 'draft!', trusted: true },
  ]);
  const native = { value: 'draft!', selection: [5, 6], focused: true, retained: true };
  expect(await f.native()).toEqual(native);
  const update = new Wire(2, first.strings);
  update.property(ids.input, 'value', 'draft');
  update.content(ids.text, 'Confirmed evidence');
  await receive(page, update.frame);
  await expect(f.paragraph).toHaveText('Initial evidence');
  expect(await f.native()).toEqual(native);
  expect(await consumed(page)).toEqual([1]);
  await receive(page, receipt(1, 2, 'draft'));
  await expect(f.paragraph).toHaveText('Initial evidence');
  expect(await f.native()).toEqual(native);
  expect(await consumed(page)).toEqual([1]);
  await receive(page, receipt(2, 2, 'draft!'));
  await expect(f.paragraph).toHaveText('Confirmed evidence');
  expect(await f.native()).toEqual(native);
  await expect.poll(() => consumed(page)).toEqual([1, 2]);
  expect((await snapshot(page)).failures).toEqual([]);
});

test('presentation latest native revision and synthetic composition gate four waiting frames', async ({
  uiPage: page,
  presentation: f,
}) => {
  const first = initial();
  await receive(page, first);
  await expect.poll(() => consumed(page)).toEqual([1]);
  await f.input.click();
  await f.input.press('End');
  await f.input.press('a');
  await f.input.press('b');
  await expect.poll(async () => (await inputs(page)).length).toBe(4);
  expect(
    (await inputs(page)).map(({ input }) => [
      input.revision,
      input.eventType,
      input.value,
      input.isTrusted,
    ]),
  ).toEqual([
    [1, 'beforeinput', 'draft', true],
    [2, 'input', 'drafta', true],
    [3, 'beforeinput', 'drafta', true],
    [4, 'input', 'draftab', true],
  ]);
  const strings = [...first.strings];
  const update = (sequence: number, text: string) => {
    const wire = new Wire(sequence, strings);
    wire.property(ids.input, 'value', 'draft');
    wire.content(ids.text, text);
    strings.push(...wire.frame.strings);
    return wire.frame;
  };
  await receive(page, update(2, 'Both edits confirmed'));
  await receive(page, receipt(1, 2, 'draft'));
  await receive(page, receipt(2, 2, 'drafta'));
  await expect(f.paragraph).toHaveText('Initial evidence');
  expect(await consumed(page)).toEqual([1]);
  await receive(page, receipt(3, 2, 'drafta'));
  await receive(page, receipt(4, 2, 'draftab'));
  await expect(f.paragraph).toHaveText('Both edits confirmed');
  await expect.poll(() => consumed(page)).toEqual([1, 2]);

  // Synthetic composition exercises the coordinator; this does not claim system IME coverage.
  await f.input.evaluate((node) => {
    for (const type of ['compositionstart', 'compositionupdate'])
      node.dispatchEvent(new CompositionEvent(type, { bubbles: true, data: '文' }));
  });
  await expect.poll(async () => (await inputs(page)).length).toBe(6);
  expect(
    (await inputs(page))
      .slice(4)
      .map(({ input }) => [input.revision, input.eventType, input.isTrusted]),
  ).toEqual([
    [5, 'compositionstart', false],
    [6, 'compositionupdate', false],
  ]);
  await receive(page, update(3, 'Composition ended'));
  await receive(page, receipt(5, 3, 'draftab'));
  await receive(page, receipt(6, 3, 'draftab'));
  await expect(f.paragraph).toHaveText('Both edits confirmed');
  expect(await consumed(page)).toEqual([1, 2]);
  await f.input.evaluate((node) =>
    node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '文' })),
  );
  await expect.poll(async () => (await inputs(page)).length).toBe(7);
  await expect(f.paragraph).toHaveText('Both edits confirmed');
  await receive(page, receipt(7, 3, 'draftab'));
  await expect(f.paragraph).toHaveText('Composition ended');
  await expect.poll(() => consumed(page)).toEqual([1, 2, 3]);
  await f.input.press('!');
  await expect.poll(async () => (await inputs(page)).length).toBe(9);
  const native = await f.native();
  expect(native.value).toBe('draftab!');
  for (let sequence = 4; sequence <= 7; sequence++)
    await receive(page, update(sequence, `Waiting ${sequence}`));
  expect((await snapshot(page)).failures).toEqual([]);
  await expect(f.paragraph).toHaveText('Composition ended');
  expect(await consumed(page)).toEqual([1, 2, 3]);
  await receive(page, update(8, 'Must never render'));
  expect((await snapshot(page)).failures).toEqual(['resourceLimit']);
  await receive(page, receipt(8, 8, 'draftab'));
  await receive(page, receipt(9, 8, 'draftab!'));
  await expect(f.paragraph).toHaveText('Composition ended');
  expect(await f.native()).toEqual(native);
  expect(await consumed(page)).toEqual([1, 2, 3]);
});

test('presentation unsupported multiple selection preserves the complete native set', async ({
  uiPage: page,
  presentation: f,
}) => {
  const wire = new Wire(1);
  wire.element(3, 'select');
  wire.attr(3, 'multiple', '');
  for (const [offset, value] of ['A', 'B'].entries()) {
    wire.element(4 + offset, 'option');
    wire.attr(4 + offset, 'value', value);
  }
  wire.children(3, [4, 5]);
  wire.children(2, [3]);
  await receive(page, wire.frame);
  await expect.poll(() => consumed(page)).toEqual([1]);
  const select = f.frame.locator('select');
  // Playwright sets the real control selection and dispatches synthetic input/change events.
  await select.selectOption(['A', 'B']);
  expect((await snapshot(page)).failures).toEqual(['unavailable']);
  expect(await inputs(page)).toEqual([]);
  expect(
    await select.evaluate((node: HTMLSelectElement) =>
      [...node.selectedOptions].map((option) => option.value),
    ),
  ).toEqual(['A', 'B']);
});

test('presentation source failure keeps native draft and rejects later receipts', async ({
  uiPage: page,
  presentation: f,
}) => {
  const first = initial();
  await receive(page, first);
  await expect.poll(() => consumed(page)).toEqual([1]);
  await f.input.click();
  await f.input.press('End');
  await f.input.press('!');
  await expect.poll(async () => (await inputs(page)).length).toBe(2);
  const native = await f.native();
  const update = new Wire(2, first.strings);
  update.content(ids.text, 'Must not render after source failure');
  await receive(page, update.frame);
  await receive(page, {
    ...binding,
    type: 'error',
    error: { code: 'unavailable', message: 'unsupported native capability' },
  });
  expect((await snapshot(page)).failures).toEqual(['unavailable']);
  await receive(page, receipt(1, 2, 'draft'));
  await receive(page, receipt(2, 2, 'draft!'));
  await expect(f.paragraph).toHaveText('Initial evidence');
  expect(await f.native()).toEqual(native);
  expect(await consumed(page)).toEqual([1]);
});

test('presentation delegated click uses one true target and ignores stale generation and closed packets', async ({
  uiPage: page,
  presentation: f,
}) => {
  const first = initial(true);
  await receive(page, first);
  await expect.poll(() => consumed(page)).toEqual([1]);
  await f.paragraph.click();
  await expect.poll(async () => (await inputs(page)).length).toBe(1);
  expect((await inputs(page))[0]).toMatchObject({
    ...binding,
    type: 'input',
    input: { nodeId: ids.paragraph, revision: 1, eventType: 'click', isTrusted: true },
  });
  const update = new Wire(2, first.strings);
  update.content(ids.text, 'Must wait for the right generation');
  await receive(page, update.frame);
  const confirmed = {
    ...binding,
    type: 'inputConfirmed',
    nodeId: ids.paragraph,
    revision: 1,
    through: 2,
  } as const;
  await receive(page, { ...confirmed, generation: 6 });
  await expect(f.paragraph).toHaveText('Initial evidence');
  expect(await consumed(page)).toEqual([1]);
  expect((await snapshot(page)).failures).toEqual([]);
  await f.paragraph.click();
  await expect.poll(async () => (await inputs(page)).length).toBe(2);
  expect((await inputs(page))[1]).toMatchObject({
    input: { nodeId: ids.paragraph, revision: 2, eventType: 'click', isTrusted: true },
  });
  await receive(page, confirmed);
  await expect(f.paragraph).toHaveText('Initial evidence');
  await receive(page, { ...confirmed, revision: 2 });
  await expect(f.paragraph).toHaveText('Must wait for the right generation');
  await expect.poll(() => consumed(page)).toEqual([1, 2]);
  const removed = new Wire(3, [...first.strings, ...update.frame.strings]);
  for (const target of [ids.article, ids.paragraph])
    removed.frame.mutations.push(4, target, 1, 0, removed.string('click'), 0);
  await receive(page, removed.frame);
  await expect.poll(() => consumed(page)).toEqual([1, 2, 3]);
  await f.paragraph.click();
  expect((await inputs(page)).length).toBe(2);
  await f.input.click();
  await f.input.press('End');
  await f.input.press('!');
  await expect.poll(async () => (await inputs(page)).length).toBe(4);
  const queued = new Wire(4, [...first.strings, ...update.frame.strings, ...removed.frame.strings]);
  queued.content(ids.text, 'Must never release the closed queue');
  await receive(page, queued.frame);
  await expect(f.paragraph).toHaveText('Must wait for the right generation');
  const beforeClose = await snapshot(page);
  await f.paragraph.evaluate((node) =>
    Reflect.set(window.parent, 'closedPresentationBody', node.ownerDocument.body),
  );
  await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').close());
  await receive(page, confirmed);
  await receive(page, receipt(3, 4, 'draft'));
  await receive(page, receipt(4, 4, 'draft!'));
  const late = new Wire(5, [
    ...first.strings,
    ...update.frame.strings,
    ...removed.frame.strings,
    ...queued.frame.strings,
  ]);
  late.content(ids.text, 'Must never render after close');
  await receive(page, late.frame);
  expect(await snapshot(page)).toEqual(beforeClose);
  expect(await page.evaluate(() => Reflect.get(window, 'closedPresentationBody').textContent)).toBe(
    'Must wait for the right generation',
  );
  await expect(page.locator('iframe[title="交互报告"]')).toHaveCount(0);
});
