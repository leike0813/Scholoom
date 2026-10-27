/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Frame, Page } from '@playwright/test';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import type { ReportSnapshot } from '../../packages/protocol/dist/report-contracts.js';
import type { ResourceOutputs } from '../../packages/protocol/dist/resources.js';
import { reportNetworkTrap } from '../fixtures/report-network-trap.js';
import { reportProbeScript } from '../fixtures/report-probes.js';
import { runningKernel } from '../kernel-fixture.js';
import { expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

let bundle = '';
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../fixtures/report-isolation-entry.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    logLevel: 'silent',
  });
  bundle = result.outputFiles[0]?.text ?? '';
  assert(bundle);
});

type Loaded = { snapshot: ReportSnapshot; files: ResourceOutputs['resources.read'][] };
async function mount(page: Page, input: Loaded, strict = true): Promise<Frame> {
  await page.evaluate(
    async ({ snapshot, files, strict }) => {
      await Reflect.get(window, 'isolationFixture').mount(snapshot, files, strict);
    },
    { ...input, strict },
  );
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'isolationFixture').status().current.ready))
    .toBe(true);
  const frame = page.frames().find((value) => value.name() === 'report-probe');
  assert(frame);
  return frame;
}
const stats = (page: Page) => page.evaluate(() => Reflect.get(window, 'isolationFixture').status());

test('report isolation investigation measures real egress, opaque access and bridge lifetime', async ({
  uiPage,
  uiHost,
}, info) => {
  const root = info.outputPath('report-isolation');
  await mkdir(root, { recursive: true });
  const font = await readFile(
    new URL(
      '../../apps/desktop/node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2',
      import.meta.url,
    ),
  );
  const trap = await reportNetworkTrap(font);
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  assert(directory);
  const client = createKernelClient(await runningKernel(directory));
  await client.connect();
  const diagnostics: Record<string, unknown> = {
    host: uiHost,
    production: 'unavailable',
    userAgent: await uiPage.evaluate(() => navigator.userAgent),
  };
  const consoleErrors: string[] = [];
  uiPage.on('pageerror', (error) => {
    if (consoleErrors.length < 16) consoleErrors.push(error.message.slice(0, 512));
  });
  try {
    const project = await client.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    await mkdir(join(project.path, 'assets'));
    await writeFile(join(project.path, 'assets/font.woff2'), font);
    await writeFile(
      join(project.path, 'assets/pixel.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    await client.call('files.save', {
      projectId: project.id,
      path: 'source.md',
      content: 'Fixed dose 10 and 20.',
    });
    const describe = (path: string) =>
      client.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path },
      });
    const [image, face, source] = await Promise.all(
      ['assets/pixel.png', 'assets/font.woff2', 'source.md'].map(describe),
    );
    assert(image && face && source);
    const manifest = {
      version: 1,
      resources: [
        { path: 'assets/pixel.png', ref: image.ref, basis: image.basis, mediaType: 'image/png' },
        { path: 'assets/font.woff2', ref: face.ref, basis: face.basis, mediaType: 'font/woff2' },
      ],
      sources: [{ ref: source.ref, basis: source.basis }],
      objects: [
        { objectId: 'dose', name: 'Dose comparison', semantics: '10 and 20', sourceIndexes: [0] },
      ],
    };
    const html = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<style>@font-face{font-family:Probe;src:url('assets/font.woff2')}p{font-family:Probe}</style><p>Fixed comparison</p><img id="pixel" src="assets/pixel.png"><script>${reportProbeScript()}</script>`;
    await client.call('files.save', { projectId: project.id, path: 'report.html', content: html });
    let entry = await describe('report.html');
    const load = async (): Promise<Loaded> => {
      const snapshot = await client.call('resources.report', {
        ref: entry.ref,
        basis: entry.basis,
      });
      const files = await Promise.all(
        [snapshot.resource, ...snapshot.manifest.resources].map(({ ref, basis }) =>
          client.call('resources.read', { ref, basis, encoding: 'base64' }),
        ),
      );
      expect(await client.call('resources.report', { ref: entry.ref, basis: entry.basis })).toEqual(
        snapshot,
      );
      return { snapshot, files };
    };
    let loaded = await load();
    if (uiHost === 'browser') await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await uiPage.route(`${rendererUrl}__report-isolation.js`, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: bundle }),
    );
    await uiPage.route(rendererUrl, (route) =>
      route.fulfill({
        contentType: 'text/html',
        headers: { 'Content-Security-Policy': 'frame-src blob:' },
        body: '<!doctype html><title>Report isolation investigation</title><main><h1>报告隔离调查夹具</h1><div id="fixture"></div></main><script src="/__report-isolation.js"></script>',
      }),
    );
    await uiPage.goto(rendererUrl);
    await expect
      .poll(() => uiPage.evaluate(() => !!Reflect.get(window, 'isolationFixture')))
      .toBe(true);
    expect((await uiPage.request.get(`${trap.origin}/control`)).ok()).toBe(true);
    expect(trap.httpTotal).toBe(1);

    let frame = await mount(uiPage, loaded, false);
    diagnostics.positive = await frame.evaluate(() =>
      Reflect.get(window, 'reportProbes').positive(),
    );
    expect(diagnostics.positive).toMatchObject({
      image: 1,
      font: true,
      origin: 'null',
      parentDOM: false,
      preload: 'undefined',
      node: 'undefined',
      require: 'undefined',
    });
    const calibration = await frame.evaluate(
      (base) => Reflect.get(window, 'reportProbes').network(base),
      `${trap.origin}/nonce`,
    );
    diagnostics.nonceOnly = {
      result: calibration,
      count: trap.httpTotal,
      samples: [...trap.httpRequests],
      violations: await frame.evaluate(() => Reflect.get(window, 'reportProbes').violations),
      verdict: 'unavailable',
    };
    expect(calibration).toMatchObject({ settled: true, popup: false });
    // Browser Local Network Access can block loopback independently of the candidate CSP.
    if (uiHost === 'electron') {
      expect(calibration.escapedScript).toBe(true);
      expect(trap.httpRequests.some((request) => request.url === '/nonce/script')).toBe(true);
    }
    await uiPage.evaluate(() => Reflect.get(window, 'isolationFixture').close());

    frame = await mount(uiPage, loaded);
    expect(await frame.evaluate(() => Reflect.get(window, 'reportProbes').positive())).toEqual(
      diagnostics.positive,
    );
    const network = await frame.evaluate(
      (base) => Reflect.get(window, 'reportProbes').network(base),
      `${trap.origin}/strict`,
    );
    expect(network).toMatchObject({ escapedScript: false, settled: true, popup: false });
    expect(network.attempted).toHaveLength(16);
    await expect
      .poll(() =>
        frame.evaluate(() => {
          const events = Reflect.get(window, 'reportProbes').violations as Array<{
            directive: string;
            target: string;
          }>;
          return (
            [
              'connect-src',
              'font-src',
              'style-src-elem',
              'worker-src',
              'script-src-elem',
              'img-src',
              'object-src',
            ].every((d) => events.some((v) => v.directive === d)) &&
            events.filter((v) => v.directive === 'frame-src').length >= 2
          );
        }),
      )
      .toBe(true);
    expect(trap.httpRequests.filter((v) => v.url.startsWith('/strict/'))).toEqual([]);
    diagnostics.intersectedHTTP = {
      result: network,
      cumulativeCount: trap.httpTotal,
      violations: await frame.evaluate(() => Reflect.get(window, 'reportProbes').violations),
    };

    const bootstrapURL = `${rendererUrl}__scholoom/kernel/bootstrap`;
    diagnostics.kernelAccess = await frame.evaluate(
      async (url) =>
        fetch(url).then(
          () => ({ reached: true }),
          () => ({ reached: false }),
        ),
      bootstrapURL,
    );
    expect(diagnostics.kernelAccess).toEqual({ reached: false });
    await expect
      .poll(() =>
        frame.evaluate(
          (url) =>
            Reflect.get(window, 'reportProbes').violations.some(
              (v: { directive: string; target: string }) =>
                v.directive === 'connect-src' && v.target === url,
            ),
          bootstrapURL,
        ),
      )
      .toBe(true);

    await frame.evaluate((url) => Reflect.get(window, 'reportProbes').rtc(url), trap.stunURL);
    await expect
      .poll(async () =>
        trap.udpTotal > 0
          ? 'packet'
          : ['complete', 'error', 'refused'].includes(
                await frame.evaluate(() => Reflect.get(window, 'reportProbes').rtcState()),
              )
            ? 'finished'
            : 'pending',
      )
      .not.toBe('pending');
    diagnostics.rtc = {
      packets: trap.udpTotal,
      samples: [...trap.udpPackets],
      state: await frame.evaluate(() => Reflect.get(window, 'reportProbes').rtcState()),
    };
    await frame.evaluate(() => Reflect.get(window, 'reportProbes').closeRTC());

    await uiPage.evaluate(() => {
      const samples = [Date.now()];
      const state = { active: true, samples };
      Reflect.set(window, 'heartbeat', state);
      const tick = () => {
        if (state.active) {
          if (samples.length < 64) samples.push(Date.now());
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
    const busy = await frame.evaluate(() => Reflect.get(window, 'reportProbes').busy());
    diagnostics.cpu = await uiPage.evaluate(async (busy) => {
      await new Promise(requestAnimationFrame);
      const state = Reflect.get(window, 'heartbeat');
      state.active = false;
      return { busy, samples: state.samples, guarantee: 'unproven' };
    }, busy);

    const navigations = [];
    for (const kind of ['http', 'meta', 'data', 'blob', 'document']) {
      frame = await mount(uiPage, loaded);
      const parentCount = (await stats(uiPage)).parentViolations.length;
      await frame.evaluate(
        ({ kind, base }) => Reflect.get(window, 'reportProbes').navigate(kind, base),
        { kind, base: `${trap.origin}/navigation-${kind}` },
      );
      await expect
        .poll(async () => {
          const state = await stats(uiPage);
          return (
            state.current.released ||
            state.parentViolations.length > parentCount ||
            (await frame
              .evaluate(() => Reflect.get(window, 'reportProbes')?.violations.length > 0)
              .catch(() => false))
          );
        })
        .toBe(true);
      const state = await stats(uiPage);
      navigations.push({
        kind,
        cumulativeCount: trap.httpTotal,
        state,
        childViolations: await frame
          .evaluate(() => Reflect.get(window, 'reportProbes')?.violations)
          .catch(() => null),
      });
    }
    diagnostics.navigations = navigations;

    frame = await mount(uiPage, loaded);
    const binding = await frame.evaluate(() => Reflect.get(window, 'reportProbes').binding);
    const accepted = (await stats(uiPage)).current.accepted;
    await frame.evaluate(
      (binding) =>
        parent.postMessage(
          {
            ...binding,
            type: 'select',
            objectIds: ['dose'],
            request: '',
            fixtureWindowProbe: true,
          },
          '*',
        ),
      binding,
    );
    await expect.poll(async () => (await stats(uiPage)).windowMessages).toBe(1);
    expect((await stats(uiPage)).current.accepted).toBe(accepted);
    const rejected = (await stats(uiPage)).current.rejected;
    await frame.evaluate((binding) => {
      const probes = Reflect.get(window, 'reportProbes');
      const message = { ...binding, type: 'state', browse: null, draft: null, dirty: false };
      probes.raw({ ...message, generation: binding.generation + 1 });
      probes.raw({ ...message, basis: 'different-version' });
      probes.raw({ ...message, viewId: 'other-view' });
      probes.raw({ ...message, version: 2 });
      probes.raw({ ...message, browse: 'x'.repeat(65536) });
      probes.send({ type: 'select', objectIds: ['not-declared'], request: '' });
    }, binding);
    await expect.poll(async () => (await stats(uiPage)).current.rejected).toBe(rejected + 6);
    frame = await mount(uiPage, loaded);
    const oldBinding = await frame.evaluate(() => {
      const probes = Reflect.get(window, 'reportProbes');
      probes.retainPort();
      return probes.binding;
    });
    await expect.poll(async () => (await stats(uiPage)).hasRetainedPort).toBe(true);
    const sendRetained = (request: string) =>
      uiPage.evaluate((message) => Reflect.get(window, 'isolationFixture').retainedSend(message), {
        ...oldBinding,
        type: 'select',
        objectIds: ['dose'],
        request,
      });
    await sendRetained('positive port response');
    await expect.poll(async () => (await stats(uiPage)).selections).toBe(1);
    await uiPage.evaluate(() => Reflect.get(window, 'isolationFixture').finish());
    await expect
      .poll(async () =>
        (await stats(uiPage)).portObservation.messages.some(
          (m: { type: string }) => m.type === 'queued',
        ),
      )
      .toBe(true);
    await sendRetained('pending old version');
    await expect.poll(async () => (await stats(uiPage)).selections).toBe(2);
    await sendRetained('second');
    await expect.poll(async () => (await stats(uiPage)).current.rejected).toBe(1);
    entry = await client.call('resources.save', {
      ref: entry.ref,
      basis: entry.basis,
      content: html.replace('Fixed comparison', 'Saved revision'),
    });
    loaded = await load();
    frame = await mount(uiPage, loaded);
    if ((await stats(uiPage)).portObservation.closeEventSupported)
      await expect.poll(async () => (await stats(uiPage)).portObservation.closed).toBe(true);
    const received = (await stats(uiPage)).portObservation.messages.length;
    expect(await frame.evaluate(() => Reflect.get(window, 'reportProbes').binding.basis)).not.toBe(
      binding.basis,
    );
    await uiPage.evaluate(async () => {
      Reflect.get(window, 'isolationFixture').finish();
      await Promise.resolve();
    });
    await sendRetained('closed old port');
    expect((await stats(uiPage)).current.accepted).toBe(1);
    expect((await stats(uiPage)).previous.released).toBe(true);
    const sourceURL = (await stats(uiPage)).sourceURL;
    expect(
      await uiPage.evaluate(
        async (url) =>
          fetch(url).then(
            () => true,
            () => false,
          ),
        sourceURL,
      ),
    ).toBe(true);
    await frame.evaluate(() => {
      for (let n = 0; n < 20; n++)
        Reflect.get(window, 'reportProbes').send({
          type: 'state',
          browse: n,
          draft: null,
          dirty: false,
        });
    });
    await expect.poll(async () => (await stats(uiPage)).current.reason).toBe('resourceLimit');
    await expect.poll(() => uiPage.frames().some((f) => f.name() === 'report-probe')).toBe(false);
    expect(
      await uiPage.evaluate(
        async (url) =>
          fetch(url).then(
            () => true,
            () => false,
          ),
        sourceURL,
      ),
    ).toBe(false);
    diagnostics.bridge = await stats(uiPage);
    expect((await stats(uiPage)).portObservation.messages).toHaveLength(received);
    expect((await stats(uiPage)).selections).toBe(2);
    await trap.close();
    expect(
      trap.httpRequests.filter((v) => v.url !== '/control' && v.url !== '/nonce/script'),
    ).toEqual([]);
  } finally {
    diagnostics.bridge ??= await stats(uiPage).catch(() => null);
    await uiPage.evaluate(() => Reflect.get(window, 'isolationFixture')?.close()).catch(() => {});
    client.dispose();
    await trap.close();
    diagnostics.http = { total: trap.httpTotal, samples: [...trap.httpRequests] };
    diagnostics.errors = consoleErrors;
    await writeFile(
      info.outputPath('isolation-diagnostic.json'),
      JSON.stringify(diagnostics, null, 2),
    );
    await info.attach('report-isolation-investigation', {
      body: JSON.stringify(diagnostics, null, 2),
      contentType: 'application/json',
    });
  }
});
