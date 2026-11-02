/// <reference lib="dom" />
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import { reportRenderLimits } from '../../packages/protocol/dist/report-contracts.js';
import { Wire } from '../fixtures/report-dom/frames.js';

let script = '';
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import {createReportDOM} from '@scholoom/editor';
        const receiver=createReportDOM({document});receiver.element.style.display='none';
        document.body.append(receiver.element);window.reportBudget={receiver,ready:receiver.ready};`,
      resolveDir: fileURLToPath(new URL('../../apps/desktop/', import.meta.url)),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
  });
  script = bundle.outputFiles[0]?.text ?? '';
  expect(script).toBeTruthy();
});
test.beforeEach(async ({ page }) => {
  await page.route('https://report-budget.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }),
  );
  await page.goto('https://report-budget.test/');
  await page.addScriptTag({ content: script });
  await page.evaluate(() => Reflect.get(window, 'reportBudget').ready);
});

for (const kind of ['text', 'attribute', 'value'] as const) {
  test(`reused ${kind} strings pay for every write before any DOM mutation`, async ({ page }) => {
    const wire = new Wire(1);
    const payload = 'x'.repeat(10000);
    const nodes = [];
    for (let index = 0; index < 32; index++) {
      const id = 3 + index;
      nodes.push(id);
      if (kind === 'text') wire.text(id, payload);
      else {
        wire.element(id, kind === 'value' ? 'input' : 'div');
        if (kind === 'value') wire.property(id, 'value', payload);
        else wire.attr(id, 'data-evidence', payload);
      }
    }
    wire.children(2, nodes);
    const result = await page.evaluate((frame) => {
      const { receiver } = Reflect.get(window, 'reportBudget');
      let code: unknown;
      try {
        receiver.apply(frame);
      } catch (error) {
        code = Reflect.get(error as object, 'code');
      }
      return { code, children: receiver.element.contentDocument.body.childNodes.length };
    }, wire.frame);
    expect(result).toEqual({ code: 'resourceLimit', children: 0 });
  });
}

test('aggregate control values cannot bypass the view budget across frames, and shrinking a value frees its own capacity', async ({
  page,
}) => {
  const strings: string[] = [];
  const value = 'v'.repeat(8192);
  const batch = 8;
  const accepted = reportRenderLimits.contentUnits / (value.length * batch);
  expect(Number.isInteger(accepted)).toBe(true);
  let id = 3;
  for (let sequence = 1; sequence <= accepted; sequence++) {
    const wire = new Wire(sequence, strings);
    const added = [];
    for (let index = 0; index < batch; index++) {
      added.push(id);
      wire.element(id, 'input');
      wire.property(id++, 'value', value);
    }
    wire.children(2, added);
    strings.push(...wire.frame.strings);
    await page.evaluate(
      (frame) => Reflect.get(window, 'reportBudget').receiver.apply(frame),
      wire.frame,
    );
  }
  const rejected = new Wire(accepted + 1, strings);
  rejected.element(id, 'input');
  rejected.property(id, 'value', value);
  rejected.children(2, [id]);
  expect(
    await page.evaluate((frame) => {
      const { receiver } = Reflect.get(window, 'reportBudget');
      try {
        receiver.apply(frame);
        return 'accepted';
      } catch (error) {
        return Reflect.get(error as object, 'code');
      }
    }, rejected.frame),
  ).toBe('resourceLimit');
  const replacement = new Wire(accepted + 1, strings);
  replacement.property(3, 'value', '');
  replacement.element(id, 'input');
  replacement.property(id, 'value', value);
  replacement.children(2, [id]);
  await page.evaluate(
    (frame) => Reflect.get(window, 'reportBudget').receiver.apply(frame),
    replacement.frame,
  );
  expect(
    await page.evaluate(() => {
      const { receiver } = Reflect.get(window, 'reportBudget');
      return Array.from(
        receiver.element.contentDocument.body.querySelectorAll(
          'input',
        ) as NodeListOf<HTMLInputElement>,
      ).reduce((total, input) => total + input.value.length, 0);
    }),
  ).toBe(reportRenderLimits.contentUnits);
});

test('native input type reflection cannot hide retained value attributes from the view budget', async ({
  page,
}) => {
  const strings: string[] = [];
  const value = 'v'.repeat(8192);
  let id = 3;
  let rejected: unknown;
  // Hidden owned DOM, at most about 2 Mi units; no oversized pressure probe or report script.
  for (let sequence = 1; sequence <= 65; sequence++) {
    const wire = new Wire(sequence, strings);
    const added = [];
    for (let index = 0; index < 4; index++) {
      added.push(id);
      wire.element(id, 'input');
      wire.property(id, 'value', value);
      wire.attr(id, 'type', 'checkbox');
      wire.attr(id, 'type', 'text');
      wire.property(id++, 'value', '');
    }
    wire.children(2, added);
    const result = await page.evaluate((frame) => {
      try {
        Reflect.get(window, 'reportBudget').receiver.apply(frame);
      } catch (error) {
        return Reflect.get(error as object, 'code');
      }
    }, wire.frame);
    if (result) {
      rejected = result;
      break;
    }
    strings.push(...wire.frame.strings);
  }
  expect(rejected).toBe('resourceLimit');
  expect(
    await page.evaluate(() => {
      const { receiver } = Reflect.get(window, 'reportBudget');
      return Array.from(
        receiver.element.contentDocument.body.querySelectorAll(
          'input',
        ) as NodeListOf<HTMLInputElement>,
      ).reduce(
        (total, input) => total + input.value.length + (input.getAttribute('value')?.length ?? 0),
        0,
      );
    }),
  ).toBeLessThanOrEqual(reportRenderLimits.contentUnits);
});
