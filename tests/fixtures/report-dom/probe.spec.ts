import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { build } from '../../../packages/editor/node_modules/esbuild/lib/main.js';
import { expect, test } from '../../ui/fixture';
import { rendererUrl } from '../../ui/renderer-url';
import {
  attacks,
  baseline,
  frozenDecodeFrame,
  frozenJPEG,
  ids,
  largePage,
  malicious,
  namespaces,
  Wire,
} from './frames';

const inspectInput = (page: Page) =>
  page
    .frameLocator('iframe[title="交互报告"]')
    .getByLabel('Report note', { exact: true })
    .evaluate((node: HTMLInputElement) => ({
      value: node.value,
      selection: [node.selectionStart, node.selectionEnd],
      focused: node.ownerDocument.activeElement === node,
    }));
const apply = (page: Page, frame: unknown) =>
  page.evaluate((value) => Reflect.get(window, 'reportDOMProbe').apply(value), frame);

async function setup(page: Page, host: string, info: TestInfo) {
  const built = process.env.SCHOOLOOM_REPORT_DOM_BUILD;
  assert(built);
  if (host === 'browser') await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  const errors: string[] = [];
  const consoleLog: string[] = [];
  const externalRequests: string[] = [];
  const reportRequests: string[] = [];
  const blobRequests: string[] = [];
  const evidence: Record<string, unknown> = { host, osIsolation: false, reportScripts: false };
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleLog.push(message.text());
  });
  page.on('request', (request) => {
    if (request.url().startsWith('blob:')) {
      blobRequests.push(request.url());
      return;
    }
    if (!request.url().startsWith(rendererUrl)) externalRequests.push(request.url());
    if (request.frame().parentFrame()) reportRequests.push(request.url());
  });
  await page.route('**/*', (route) =>
    route.request().url().startsWith(rendererUrl) || route.request().url().startsWith('blob:')
      ? route.fallback()
      : route.abort('blockedbyclient'),
  );
  for (const [name, contentType] of [
    ['surface.js', 'text/javascript'],
    ['surface.css', 'text/css'],
  ]) {
    const body = await readFile(join(built, name!), 'utf8');
    await page.route(`${rendererUrl}${name}`, (route) =>
      route.fulfill({ contentType: contentType!, body }),
    );
  }
  const html = await readFile(join(built, 'index.html'), 'utf8');
  await page.route(rendererUrl, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  try {
    await page.goto(rendererUrl);
    await expect(page.getByRole('tab', { name: 'Report DOM probe.html' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.waitForFunction(() => Boolean(Reflect.get(window, 'reportDOMProbe')));
    await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').ready);
  } catch (error) {
    await writeFile(
      info.outputPath('first-failure.json'),
      JSON.stringify(
        { host, error: String(error), errors, consoleLog, externalRequests, reportRequests },
        null,
        2,
      ),
    );
    throw error;
  }
  return {
    evidence,
    frame: page.frameLocator('iframe[title="交互报告"]'),
    async finish(failure?: unknown) {
      Object.assign(evidence, {
        errors,
        consoleLog,
        externalRequests,
        reportRequests,
        blobRequests,
      });
      const scriptMarkers = await page
        .evaluate(() => {
          const child = document.querySelector('iframe')?.contentWindow;
          return {
            host: Boolean(Reflect.get(window, '__reportScriptRan')),
            child: Boolean(child && Reflect.get(child, '__reportScriptRan')),
          };
        })
        .catch(() => null);
      evidence.scriptMarkers = scriptMarkers;
      if (failure) {
        evidence.firstFailure = String(failure);
        await writeFile(info.outputPath('first-failure.json'), JSON.stringify(evidence, null, 2));
      }
      await writeFile(info.outputPath('evidence.json'), JSON.stringify(evidence, null, 2));
      await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').close());
      if (!failure) {
        expect(errors).toEqual([]);
        expect(externalRequests).toEqual([]);
        expect(reportRequests).toEqual([]);
        expect(scriptMarkers).toEqual({ host: false, child: false });
        await expect(page.locator('iframe[title="交互报告"]')).toHaveCount(0);
      }
    },
  };
}

test('frozen JPEG and KaTeX font decode through production presentation without network', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const f = await setup(page, uiHost, info);
  let failure: unknown;
  try {
    const require = createRequire(new URL('../../../apps/desktop/package.json', import.meta.url));
    const katex = dirname(require.resolve('katex/package.json'));
    const fontPath = join(katex, 'dist/fonts/KaTeX_Main-Regular.woff2');
    const font = await readFile(fontPath);
    const jpeg = Buffer.from(frozenJPEG, 'base64');
    f.evidence.resources = {
      jpeg: { encoder: 'ImageMagick', bytes: jpeg.length, width: 1, height: 1 },
      font: { path: fontPath, license: join(katex, 'LICENSE'), bytes: font.length },
    };
    f.evidence.resourceAndPermissionPorts = 'explicit fixed frozen-byte substitutes';
    const bundle = await build({
      stdin: {
        contents: `export {createReportStyleAssets} from './packages/editor/src/report-style-assets';
          export {createReportPresentation} from './packages/editor/src/report-presentation';`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      globalName: 'reportFrozenModules',
      sourcemap: 'inline',
    });
    const script = bundle.outputFiles[0]!.text;
    await writeFile(info.outputPath('frozen-assets.js'), script);
    await page.addScriptTag({ content: script });
    const files = [
      {
        url: 'scholoom-report://local/assets/decode.css',
        mediaType: 'text/css',
        bytes: Array.from(
          new TextEncoder().encode(
            '@font-face{font-family:FrozenKaTeX;src:url("KaTeX_Main-Regular.woff2") format("woff2")} .frozen-font{font-family:FrozenKaTeX}',
          ),
        ),
      },
      {
        url: 'scholoom-report://local/assets/pixel.jpg',
        mediaType: 'image/jpeg',
        bytes: Array.from(jpeg),
      },
      {
        url: 'scholoom-report://local/assets/KaTeX_Main-Regular.woff2',
        mediaType: 'font/woff2',
        bytes: Array.from(font),
      },
    ];
    await page.evaluate(async (files) => {
      const parent = document.querySelector('iframe')!.parentElement!;
      Reflect.get(window, 'reportDOMProbe').close();
      const { createReportStyleAssets, createReportPresentation } = Reflect.get(
        window,
        'reportFrozenModules',
      );
      const approved = files.map((file) => ({ ...file, bytes: Uint8Array.from(file.bytes) }));
      const assets = createReportStyleAssets(approved);
      // Source buffers change after approval; only the retained freeze may be presented.
      for (const file of approved) file.bytes.fill(0);
      const commands: unknown[] = [];
      const failures: unknown[] = [];
      const presentation = createReportPresentation({
        document,
        binding: { version: 1, viewId: 'frozen-decode', generation: 1, basis: 'fixed-freeze' },
        styles: { baseURL: 'scholoom-report://local/reports/main.html', resolve: assets.resolve },
        async send(command: unknown) {
          commands.push(command);
        },
        message() {},
        failed(error: unknown) {
          failures.push({
            code: (error as { code?: unknown }).code,
            message: String(error),
          });
        },
      });
      Reflect.set(window, 'frozenDecodeProbe', {
        assets,
        presentation,
        commands,
        failures,
        close() {
          presentation.close();
          assets.close();
        },
      });
      parent.append(presentation.element);
      await presentation.ready;
    }, files);
    f.evidence.presentation = await page.evaluate((frame) => {
      const probe = Reflect.get(window, 'frozenDecodeProbe');
      probe.presentation.receive(frame);
      return { status: probe.presentation.status(), failures: probe.failures };
    }, frozenDecodeFrame());
    expect(f.evidence.presentation).toMatchObject({ status: { failed: false }, failures: [] });
    f.evidence.blobs = await page.evaluate(async (files) => {
      const probe = Reflect.get(window, 'frozenDecodeProbe');
      const results = [];
      for (const file of files.filter((file) => file.mediaType !== 'text/css')) {
        const { url } = probe.assets.resolve(file.url, file.url, 'render');
        const blob = await (await fetch(url)).blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        results.push({
          mediaType: blob.type,
          blobURL: url.startsWith('blob:'),
          size: bytes.length,
          frozenBytes:
            bytes.length === file.bytes.length && bytes.every((b, i) => b === file.bytes[i]),
        });
      }
      return results;
    }, files);
    expect(f.evidence.blobs).toEqual([
      { mediaType: 'image/jpeg', blobURL: true, size: jpeg.length, frozenBytes: true },
      { mediaType: 'font/woff2', blobURL: true, size: font.length, frozenBytes: true },
    ]);
    f.evidence.decoded = await f.frame.locator('body').evaluate(async (body) => {
      const document = body.ownerDocument;
      const image = document.querySelector('img')!;
      await image.decode();
      const faces = await document.fonts.load('16px FrozenKaTeX', 'x');
      const loaded = await Promise.all(faces.map((face) => face.loaded));
      return {
        jpeg: {
          blobURL: image.src.startsWith('blob:'),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          decoded: image.complete,
        },
        font: {
          count: loaded.length,
          loaded: loaded.every((face) => face.status === 'loaded' && document.fonts.has(face)),
          available: document.fonts.check('16px FrozenKaTeX', 'x'),
        },
      };
    });
    expect(f.evidence.decoded).toEqual({
      jpeg: { blobURL: true, naturalWidth: 1, naturalHeight: 1, decoded: true },
      font: { count: 1, loaded: true, available: true },
    });
    const snapshot = await page.evaluate(() => {
      const probe = Reflect.get(window, 'frozenDecodeProbe');
      return { commands: probe.commands, failures: probe.failures };
    });
    f.evidence.consumed = snapshot;
    expect(snapshot).toEqual({ commands: [{ type: 'consume', sequences: [1] }], failures: [] });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await page.evaluate(() => Reflect.get(window, 'frozenDecodeProbe')?.close());
    await f.finish(failure);
  }
});

test('owned DOM methods survive form named properties', async ({ uiPage: page, uiHost }, info) => {
  const f = await setup(page, uiHost, info);
  let failure: unknown;
  try {
    const first = new Wire(1);
    first.element(3, 'form');
    for (const [offset, name] of [
      'insertBefore',
      'removeChild',
      'setAttribute',
      'removeAttribute',
      'addEventListener',
      'removeEventListener',
      'contains',
    ].entries()) {
      first.element(4 + offset, 'input');
      first.attr(4 + offset, 'name', name);
    }
    first.children(3, [4, 5, 6, 7, 8, 9, 10]);
    first.children(2, [3]);
    await apply(page, first.frame);
    f.evidence.namedProperties = await f.frame
      .locator('form')
      .evaluate((form) =>
        [
          'insertBefore',
          'removeChild',
          'setAttribute',
          'removeAttribute',
          'addEventListener',
          'removeEventListener',
          'contains',
        ].map((name) => typeof Reflect.get(form, name)),
      );
    expect(f.evidence.namedProperties).toEqual(Array(7).fill('object'));
    const second = new Wire(2, first.frame.strings);
    second.element(11, 'p');
    second.text(12, 'Updated through trusted DOM methods');
    second.children(11, [12]);
    second.children(3, [11]);
    second.attr(3, 'title', 'Updated');
    second.frame.mutations.push(4, 3, 0, 1, second.string('click'), 0, 0, 0, 0, 0);
    await apply(page, second.frame);
    await expect(f.frame.locator('p')).toHaveText('Updated through trusted DOM methods');
    await expect(f.frame.locator('form')).toHaveAttribute('title', 'Updated');
    await f.frame.locator('p').click();
    const events = await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').events());
    expect(events).toContainEqual({ index: 11, type: 'click', trusted: true });
    const third = new Wire(3, [...first.frame.strings, ...second.frame.strings]);
    third.frame.mutations.push(0, 3, third.string('title'), third.string(''), 0);
    third.children(3, [], [11]);
    third.frame.mutations.push(4, 3, 1, 0, third.string('click'), 0);
    await apply(page, third.frame);
    await expect(f.frame.locator('p')).toHaveCount(0);
    await expect(f.frame.locator('form')).not.toHaveAttribute('title');
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await f.finish(failure);
  }
});

test('native semantics and 100 objects across frames retain existing DOM', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const f = await setup(page, uiHost, info);
  let failure: unknown;
  try {
    const first = baseline();
    f.evidence.first = await apply(page, first);
    await expect(f.frame.getByRole('table', { name: 'Results' })).toBeVisible();
    await expect(f.frame.getByRole('cell', { name: '42', exact: true })).toBeVisible();
    await expect(f.frame.getByRole('img', { name: 'Static measurement' })).toBeVisible();
    const paragraph = f.frame.locator('#evidence');
    await paragraph.dblclick();
    const selected = await paragraph.evaluate((node) => {
      const selection = node.ownerDocument.getSelection();
      return {
        text: selection?.toString(),
        inside: Boolean(selection?.anchorNode && node.contains(selection.anchorNode)),
      };
    });
    expect(selected.inside).toBe(true);
    expect(selected.text?.length).toBeGreaterThan(0);
    f.evidence.nativeSelection = selected;
    const input = f.frame.getByLabel('Report note', { exact: true });
    await input.click();
    await input.press('End');
    await input.press('!');
    await input.press('Shift+ArrowLeft');
    const native = await inspectInput(page);
    expect(native).toEqual({ value: 'draft!', selection: [5, 6], focused: true });
    const events = await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').events());
    expect(events).toContainEqual({
      index: ids.input,
      type: 'input',
      trusted: true,
      value: 'draft!',
    });
    f.evidence.input = { native, events };
    const mathShape = await f.frame.locator('math').evaluate((math) => ({
      namespace: math.namespaceURI,
      fraction: math.firstElementChild?.localName,
      numerator: math.querySelector('mi')?.textContent,
      denominator: math.querySelector('mn')?.textContent,
      bounds: [...math.querySelectorAll('mi, mn')].map((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, width: rect.width };
      }),
    }));
    expect(mathShape).toMatchObject({
      namespace: namespaces.math,
      fraction: 'mfrac',
      numerator: 'x',
      denominator: '2',
    });
    expect(mathShape.bounds[0]!.width).toBeGreaterThan(0);
    expect(mathShape.bounds[0]!.bottom).toBeLessThanOrEqual(mathShape.bounds[1]!.top);
    const svg = await f.frame.locator('svg').evaluate((node) => ({
      namespace: node.namespaceURI,
      circle: node.querySelector('circle')?.namespaceURI,
    }));
    expect(svg).toEqual({ namespace: namespaces.svg, circle: namespaces.svg });
    const cdp = await page.context().newCDPSession(page);
    try {
      const tree = await cdp.send('Page.getFrameTree');
      const child = tree.frameTree.childFrames?.find((item) => item.frame.url === 'about:srcdoc');
      assert(child);
      const ax = await cdp.send('Accessibility.getFullAXTree', { frameId: child.frame.id });
      const roles = ax.nodes.map((node) => node.role?.value);
      f.evidence.math = { ...mathShape, roles };
      expect(roles).toContain('MathMLFraction');
    } finally {
      await cdp.detach();
    }
    await f.frame.locator('body').evaluate((body) => {
      const walk = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_ALL);
      const nodes: Node[] = [];
      while (walk.nextNode()) nodes.push(walk.currentNode);
      Reflect.set(body, 'savedNodes', nodes);
    });
    const second = new Wire(2, first.strings);
    second.content(ids.text, 'Updated report evidence');
    f.evidence.update = await apply(page, second.frame);
    const frames = largePage([...first.strings, ...second.frame.strings]);
    expect(frames.reduce((count, frame) => count + frame.nodes.length / 5, 0)).toBe(1000);
    const acks = [];
    for (const frame of frames) acks.push(await apply(page, frame));
    f.evidence.largePage = { acks, objects: 100, wireNodes: 1000, frames: frames.length };
    await expect(f.frame.locator('article[data-object]')).toHaveCount(100);
    await expect(f.frame.locator('article[data-object="100"] td')).toHaveText('100');
    await expect(paragraph).toHaveText('Updated report evidence');
    await f.frame
      .locator('body')
      .evaluate((body) =>
        Reflect.set(body, 'savedObjects', [...body.querySelectorAll('article[data-object]')]),
      );
    const move = new Wire(13, [
      ...first.strings,
      ...second.frame.strings,
      ...frames.flatMap((frame) => frame.strings),
    ]);
    const moved = Array.from({ length: 20 }, (_, index) => 100 + (80 + index) * 10);
    move.children(2, moved, [], 100);
    f.evidence.batchMove = await apply(page, move.frame);
    const order = await f.frame
      .locator('article[data-object]')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-object'))));
    expect(order).toEqual([
      ...Array.from({ length: 20 }, (_, index) => 81 + index),
      ...Array.from({ length: 80 }, (_, index) => 1 + index),
    ]);
    const identity = await f.frame.locator('body').evaluate((body) => {
      const saved: Node[] = Reflect.get(body, 'savedNodes');
      return {
        count: saved.length,
        retained: saved.every((node) => body.contains(node)),
        movedRetained: (Reflect.get(body, 'savedObjects') as Node[]).every((node) =>
          body.contains(node),
        ),
        input:
          saved.find((node) => node instanceof body.ownerDocument.defaultView!.HTMLInputElement) ===
          body.querySelector('input'),
      };
    });
    expect(identity).toMatchObject({ retained: true, movedRetained: true, input: true });
    expect(await inspectInput(page)).toEqual(native);
    f.evidence.identity = identity;
    await page.screenshot({ path: info.outputPath('host.png') });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await f.finish(failure);
  }
});

test('parameterized hostile frames reject atomically and preserve sequence', async ({
  uiPage: page,
  uiHost,
}, info) => {
  const f = await setup(page, uiHost, info);
  let failure: unknown;
  const cases: Array<Record<string, unknown>> = [];
  f.evidence.cases = cases;
  try {
    const requested = process.env.SCHOOLOOM_REPORT_DOM_ATTACK?.split(',');
    const selected = attacks.filter((attack) => !requested || requested.includes(attack));
    assert(selected.length > 0, 'Unknown static attack parameter');
    for (const attack of selected)
      await test.step(attack, async () => {
        await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').reset());
        const first = baseline(attack === 'work-units' ? 1000 : 0);
        const ack = await apply(page, first);
        const input = f.frame.getByLabel('Report note', { exact: true });
        await input.click();
        await input.press('End');
        await input.press('!');
        await input.press('Shift+ArrowLeft');
        const native = await inspectInput(page);
        const candidate = malicious(attack, first.strings);
        const row: Record<string, unknown> = { attack, before: ack, candidate };
        cases.push(row);
        if (attack === 'utf8-frame-budget') {
          const units =
            candidate.nodes.length +
            candidate.mutations.length +
            candidate.strings.reduce((count, value) => count + value.length, 0);
          const bytes = Buffer.byteLength(JSON.stringify(candidate));
          row.budget = { units, bytes };
          expect(units).toBeLessThan(65536);
          expect(bytes).toBeGreaterThan(65536);
        }
        if (attack === 'work-units') {
          row.budget = {
            flatSiblings: 1000,
            moves: 1024,
            bytes: Buffer.byteLength(JSON.stringify(candidate)),
          };
          expect((row.budget as { bytes: number }).bytes).toBeLessThan(65536);
        }
        const rejection = await page.evaluate((frame) => {
          const api = Reflect.get(window, 'reportDOMProbe');
          const body = document.querySelector('iframe')!.contentDocument!.body;
          const walk = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_ALL);
          const before: Node[] = [];
          while (walk.nextNode()) before.push(walk.currentNode);
          const text = body.textContent;
          const observer = new MutationObserver(() => {});
          observer.observe(body, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true,
          });
          let code: unknown = null;
          let errorName: unknown = null;
          try {
            api.apply(frame);
          } catch (error) {
            code = (error as { code?: unknown }).code;
            errorName = (error as Error).name;
          }
          const changed = observer.takeRecords().length;
          observer.disconnect();
          const after: Node[] = [];
          const next = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_ALL);
          while (next.nextNode()) after.push(next.currentNode);
          return {
            code,
            errorName,
            changed,
            textUnchanged: text === body.textContent,
            sameNodes:
              before.length === after.length &&
              before.every((node, index) => node === after[index]),
          };
        }, candidate);
        row.rejection = rejection;
        row.nativeAfter = await inspectInput(page);
        expect(['protocolIncompatible', 'unavailable', 'resourceLimit']).toContain(rejection.code);
        if (attack === 'work-units') expect(rejection.code).toBe('resourceLimit');
        expect(rejection).toMatchObject({ changed: 0, textUnchanged: true, sameNodes: true });
        expect(row.nativeAfter).toEqual(native);
        const recovery = new Wire(2, first.strings);
        recovery.content(ids.text, `Accepted after ${attack}`);
        const next = await apply(page, recovery.frame);
        row.recovery = next;
        expect(next).toMatchObject({
          sequence: 2,
          nodes: ack.nodes,
          strings: ack.strings + recovery.frame.strings.length,
          stringBytes:
            ack.stringBytes +
            recovery.frame.strings.reduce((count, value) => count + Buffer.byteLength(value), 0),
        });
        await expect(f.frame.locator('#evidence')).toHaveText(`Accepted after ${attack}`);
        expect(await inspectInput(page)).toEqual(native);
      });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await f.finish(failure);
  }
});
