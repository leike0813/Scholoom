import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, openWorkbenchWindow, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';
import { startProbe } from './controller.js';

const built = process.env.SCHOOLOOM_WORKER_DOM_BUILD;
const inspect = (page: import('@playwright/test').Page) =>
  page.evaluate(() => Reflect.get(window, 'workerDomProbe').readDiagnostics());
test('native beforeinput cancellation versus asynchronous source ACK', async ({
  uiPage: page,
  uiHost,
}, info) => {
  assert(built);
  const controller = await startProbe(built, info.outputPath());
  const evidence: Record<string, any> = {
    host: uiHost,
    systemIme: 'unverified',
    screenReader: 'unverified',
    osIsolation: false,
  };
  const errors: string[] = [];
  const hostRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => hostRequests.push(request.url()));
  let oracle: import('@playwright/test').Page | undefined;
  let release = () => {};
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
    await page.route(`${rendererUrl}wire`, async (route) => {
      const reply = await fetch(`${controller.origin}/wire`, {
        method: 'POST',
        body: route.request().postData(),
      });
      await route.fulfill({
        status: reply.status,
        contentType: 'application/json',
        body: await reply.text(),
      });
    });
    await page.route(rendererUrl, async (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: await readFile(join(built, 'index.html'), 'utf8'),
      }),
    );
    await page.goto(rendererUrl);
    await expect(page.getByRole('tab', { name: 'WorkerDOM probe.html' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const frame = page.frameLocator('iframe[title="WorkerDOM native view"]');
    const input = frame.getByLabel('Ordinary input', { exact: true });
    await expect(input).toBeVisible();
    await expect.poll(async () => (await inspect(page)).running).toBe(false);
    evidence.initial = { source: controller.readDiagnostics(), host: await inspect(page) };

    oracle = await openWorkbenchWindow(page);
    const oracleHtml = await (await fetch(`${controller.origin}/oracle`)).text();
    await oracle.route(rendererUrl, (route) =>
      route.fulfill({ contentType: 'text/html', body: oracleHtml }),
    );
    await oracle.route(`${rendererUrl}sample.js`, async (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: await readFile(join(built, 'sample.js'), 'utf8'),
      }),
    );
    await oracle.goto(rendererUrl);
    const native = oracle.getByLabel('Ordinary input', { exact: true });
    await expect(native).toBeVisible();
    const nativeRead = () => oracle!.evaluate(() => Reflect.get(window, 'nativeSample').read());

    await input.click();
    await input.press('a');
    await expect(input).toHaveValue('A');
    await expect.poll(async () => (await inspect(page)).running).toBe(false);
    await native.click();
    await native.press('a');
    await expect(native).toHaveValue('A');
    const before = await inspect(page),
      nativeBefore = await nativeRead();
    expect(before.error).toBe('');
    expect(before.source).toEqual(nativeBefore);
    const math = await frame.locator('math').evaluate((m) => ({
      namespace: m.namespaceURI,
      fraction: m.firstElementChild?.localName,
      numerator: m.querySelector('mi')?.textContent,
      denominator: m.querySelector('mn')?.textContent,
    }));
    expect(math).toEqual(nativeBefore.math);
    const doc = await frame.locator('input').evaluate((node) => ({
      owner: node.ownerDocument === node.closest('html')?.ownerDocument,
      selection: [
        (node as HTMLInputElement).selectionStart,
        (node as HTMLInputElement).selectionEnd,
      ],
      focused: node.ownerDocument.activeElement === node,
    }));
    evidence.normal = { host: before, oracle: nativeBefore, math, doc };

    const held = controller.holdCancellation();
    release = held.release;
    await input.click();
    await input.press('x');
    const realCanceledReply: any = await held.ready;
    expect(realCanceledReply.state.events.at(-1)).toMatchObject({
      type: 'beforeinput',
      data: 'x',
      defaultPrevented: true,
    });
    expect(realCanceledReply.state.value).toBe('A');
    const during = await input.evaluate((node) => ({
      value: (node as HTMLInputElement).value,
      selection: [
        (node as HTMLInputElement).selectionStart,
        (node as HTMLInputElement).selectionEnd,
      ],
      focused: node.ownerDocument.activeElement === node,
    }));
    await native.click();
    await native.press('x');
    const nativeAfter = await nativeRead();
    evidence.firstFailure = {
      criterion: 'synchronous-beforeinput-default-action',
      sourceAckHeld: realCanceledReply,
      hostBeforeAck: during,
      oracle: nativeAfter,
      host: await inspect(page),
      source: controller.readDiagnostics(),
    };
    await writeFile(
      info.outputPath('first-failure.json'),
      JSON.stringify(evidence.firstFailure, null, 2),
    );
    release();
    await expect
      .poll(async () => {
        const s = await inspect(page);
        return !s.running && s.queued === 0;
      })
      .toBe(true);
    evidence.afterRelease = {
      host: await inspect(page),
      value: await input.inputValue(),
      oracle: await nativeRead(),
    };
    evidence.errors = errors;
    evidence.hostFetchedSource = hostRequests.filter((url) => url.endsWith('/sample.js'));
    await page.screenshot({ path: info.outputPath('host.png') });
    await oracle.screenshot({ path: info.outputPath('oracle.png') });
    expect(errors).toEqual([]);
    expect(evidence.hostFetchedSource).toEqual([]);
    expect(nativeAfter.value).toBe('A');
    // This is the product equivalence criterion: an actual extra native input is a red result.
    expect(
      during.value,
      'source preventDefault must cancel the same native default action as the oracle',
    ).toBe(nativeAfter.value);
  } finally {
    release();
    if (oracle) await oracle.close();
    evidence.final = await inspect(page).catch(() => null);
    if (evidence.final) await page.evaluate(() => Reflect.get(window, 'workerDomProbe').close());
    evidence.hostClosed = await inspect(page).catch(() => null);
    await writeFile(info.outputPath('evidence.json'), JSON.stringify(evidence, null, 2));
    await controller.close();
  }
});
