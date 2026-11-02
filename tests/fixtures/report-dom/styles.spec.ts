import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../../ui/fixture';
import { rendererUrl } from '../../ui/renderer-url';
import { Wire } from './frames';

async function mount(page: Page, host: string) {
  const built = process.env.SCHOOLOOM_REPORT_DOM_BUILD;
  assert(built);
  if (host === 'browser') await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  for (const [name, contentType] of [
    ['surface.js', 'text/javascript'],
    ['surface.css', 'text/css'],
    ['index.html', 'text/html'],
  ] as const) {
    const body = await readFile(join(built, name));
    await page.route(name === 'index.html' ? rendererUrl : `${rendererUrl}${name}`, (route) =>
      route.fulfill({ body, contentType }),
    );
  }
  await page.goto(rendererUrl);
  await page.waitForFunction(() => Boolean(Reflect.get(window, 'reportDOMProbe')));
  await page.evaluate(async () => {
    const probe = Reflect.get(window, 'reportDOMProbe');
    await probe.ready;
    await probe.resetStyles();
  });
}
const apply = (page: Page, frame: unknown) =>
  page.evaluate((value) => Reflect.get(window, 'reportDOMProbe').apply(value), frame);
function baseline() {
  const wire = new Wire(1);
  wire.frame.roots = { html: 30, head: 31 };
  wire.attr(30, 'class', 'report-root');
  wire.element(3, 'style');
  wire.text(4, '.linked{color:rgb(10,20,30);padding:4px}');
  wire.children(3, [4]);
  wire.element(5, 'link');
  wire.attr(5, 'rel', 'stylesheet');
  wire.attr(5, 'href', '../assets/theme.css');
  wire.children(31, [3, 5]);
  wire.element(6, 'p');
  wire.attr(6, 'class', 'linked');
  wire.text(7, 'Styled evidence');
  wire.children(6, [7]);
  wire.element(8, 'input');
  wire.attr(8, 'aria-label', 'Styled draft');
  wire.property(8, 'value', 'draft');
  wire.element(10, 'img');
  wire.attr(10, 'src', '../assets/pixel.png');
  wire.attr(10, 'alt', 'Approved measurement');
  wire.children(2, [6, 8, 10]);
  return wire.frame;
}

test('styles use frozen imports and inert source sheets with incremental cascade updates', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith(rendererUrl) && !request.url().startsWith('blob:'))
      external.push(request.url());
  });
  await mount(page, uiHost);
  const observations: unknown[] = [];
  try {
    const first = baseline();
    await apply(page, first);
    const frame = page.frameLocator('iframe[title="交互报告"]');
    const paragraph = frame.locator('p');
    await expect(frame.getByAltText('Approved measurement')).toBeVisible();
    const read = () =>
      paragraph.evaluate((node) => {
        const document = node.ownerDocument;
        const style = document.defaultView!.getComputedStyle(node);
        return {
          color: style.color,
          padding: style.paddingTop,
          margin: style.marginLeft,
          weight: style.fontWeight,
          root: document.documentElement.className,
          inert:
            document.head.querySelector<HTMLStyleElement>('style[type="text/plain"]')?.sheet ===
            null,
          inertLink: document.head.querySelector('link')?.getAttribute('href') === null,
          active: document.head.querySelectorAll('style:not([type])').length,
        };
      });
    await expect.poll(read).toMatchObject({
      color: 'rgb(90, 100, 110)',
      padding: '4px',
      margin: '7px',
      weight: '700',
      root: 'report-root',
      inert: true,
      inertLink: true,
      active: 2,
    });
    const decoded = await paragraph.evaluate(async (node) => {
      const value = node.ownerDocument.defaultView!.getComputedStyle(node).backgroundImage;
      const address = value.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
      if (!address?.startsWith('blob:')) throw new Error('Missing approved image');
      const image = new Image();
      image.src = address;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    });
    expect(decoded).toEqual([1, 1]);
    observations.push(await read(), { decoded });
    const input = frame.getByLabel('Styled draft');
    await input.click();
    await input.press('End');
    await input.press('!');
    await input.evaluate((node) => Reflect.set(node.ownerDocument, 'originalStyledInput', node));
    const second = new Wire(2, first.strings);
    second.content(4, '.linked{color:rgb(50,60,70);padding:8px}');
    second.attr(3, 'type', 'text/css');
    await apply(page, second.frame);
    await expect
      .poll(read)
      .toMatchObject({ color: 'rgb(90, 100, 110)', padding: '8px', active: 2, inert: true });
    observations.push(await read());
    const third = new Wire(3, [...first.strings, ...second.frame.strings]);
    third.children(31, [3]);
    await apply(page, third.frame);
    await expect.poll(read).toMatchObject({ color: 'rgb(50, 60, 70)', active: 2 });
    observations.push(await read());
    const fourth = new Wire(4, [...first.strings, ...second.frame.strings, ...third.frame.strings]);
    fourth.children(31, [], [3]);
    await apply(page, fourth.frame);
    await expect
      .poll(read)
      .toMatchObject({ color: 'rgb(90, 100, 110)', padding: '0px', active: 1 });
    const native = await input.evaluate((node: HTMLInputElement) => ({
      value: node.value,
      focused: node.ownerDocument.activeElement === node,
      retained: Reflect.get(node.ownerDocument, 'originalStyledInput') === node,
    }));
    expect(native).toEqual({ value: 'draft!', focused: true, retained: true });
    observations.push(await read(), { native });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await writeFile(
      info.outputPath('style-evidence.json'),
      JSON.stringify(
        {
          host: uiHost,
          observations,
          errors,
          external,
          osIsolation: false,
          sourceAndPermissions: 'static public frames and fixed frozen asset substitutes',
        },
        null,
        2,
      ),
    );
    await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').close());
  }
});

test('styles reject unapproved output atomically and protect owned roots and policy', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(rendererUrl) && !request.url().startsWith('blob:'))
      requests.push(request.url());
  });
  await mount(page, uiHost);
  const results: unknown[] = [];
  try {
    for (const attack of [
      'url',
      'escaped-url',
      'image-set-env',
      'refresh',
      'root-children',
      'duplicate-roots',
    ] as const) {
      await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').resetStyles());
      const first = baseline();
      await apply(page, first);
      const bad = new Wire(2, first.strings);
      bad.content(7, 'Partial output must not appear');
      if (attack === 'url')
        bad.content(4, '.linked{background:url(https://unapproved.invalid/image.png)}');
      if (attack === 'escaped-url')
        bad.attr(6, 'style', String.raw`background:u\72l("https://unapproved.invalid/image.png")`);
      if (attack === 'image-set-env')
        bad.content(
          4,
          '.linked{background:image-set(env(--missing,"https://unapproved.invalid/image.png") 1x)}',
        );
      if (attack === 'refresh') {
        bad.element(9, 'meta');
        bad.attr(9, 'http-equiv', 'refresh');
        bad.attr(9, 'content', '0;url=https://unapproved.invalid/');
        bad.children(31, [9]);
      }
      if (attack === 'root-children') bad.children(30, [6]);
      if (attack === 'duplicate-roots') bad.frame.roots = { html: 32, head: 33 };
      const result = await page.evaluate((candidate) => {
        const probe = Reflect.get(window, 'reportDOMProbe');
        const document = window.document.querySelector('iframe')!.contentDocument!;
        const observer = new MutationObserver(() => {});
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        let code = '';
        try {
          probe.apply(candidate);
        } catch (error) {
          code = (error as { code: string }).code;
        }
        const mutations = observer.takeRecords().length;
        observer.disconnect();
        return {
          code,
          mutations,
          text: document.body.querySelector('p')!.textContent,
          policies: document.head.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
            .length,
        };
      }, bad.frame);
      expect(['unavailable', 'protocolIncompatible']).toContain(result.code);
      expect(result).toMatchObject({ mutations: 0, text: 'Styled evidence', policies: 1 });
      results.push({ attack, ...result });
      const good = new Wire(2, first.strings);
      good.content(7, 'Valid same sequence');
      await apply(page, good.frame);
    }
    expect(requests).toEqual([]);
  } finally {
    await writeFile(
      info.outputPath('style-refusal-evidence.json'),
      JSON.stringify({ host: uiHost, results, requests, osIsolation: false }, null, 2),
    );
    await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').close());
  }
});
