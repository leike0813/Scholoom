/// <reference lib="dom" />
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import type { KernelClient } from '../../packages/client/dist/index.js';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import type {
  ReportBridgeMessage,
  ReportProgramCommand,
  ReportProgramPacket,
  ReportSnapshot,
} from '../../packages/protocol/dist/report-contracts.js';
import { baseline, ids, Wire } from '../fixtures/report-dom/frames.js';

type RuntimeModule =
  typeof import('../../apps/desktop/src/renderer/src/workbench/reports/report-runtime.js');
type Key = { viewId: string; generation: number };
type InitialState = { browse: unknown; draft: unknown; dirty: boolean };
type Request = Key & {
  entry?: { ref: ReportSnapshot['resource']['ref']; basis: string };
  command?: ReportProgramCommand;
  path?: string;
  offset?: number;
  limit?: number;
};
type State = {
  calls: { method: string; input: Request }[];
  confirmations: ReportProgramPacket[];
  messages: ReportBridgeMessage[];
  failures: string[];
  maxConcurrentExchange: number;
  presentations: { event: 'restore' | 'ready'; hidden: boolean; value: string | undefined }[];
};
declare global {
  interface Window {
    reportRuntimeModule: RuntimeModule;
    reportRuntime: ReturnType<RuntimeModule['createReportRuntime']>;
    reportRuntimeState: State;
  }
}

const binding = { version: 1, viewId: 'runtime-view', generation: 7, basis: 'report-v1' } as const;
const key = { viewId: binding.viewId, generation: binding.generation };
const css = '#evidence { color: rgb(12, 34, 56); padding-left: 17px; }';
const cssPath = 'reports/nested/assets/theme.css';
const snapshot: ReportSnapshot = {
  resource: {
    ref: { source: 'project', projectId: 'project', fileId: 'report' },
    basis: binding.basis,
    path: 'reports/nested/main.html',
    name: 'Report',
    format: 'html',
    report: true,
    capabilities: { read: true, write: false, readingRecords: false, render: false },
  },
  manifest: {
    version: 1,
    resources: [
      {
        path: 'assets/theme.css',
        ref: { source: 'project', projectId: 'project', fileId: 'theme' },
        basis: 'css-v1',
        mediaType: 'text/css',
      },
    ],
    sources: [],
    objects: [],
  },
};

let script = '';
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import * as runtime from './src/renderer/src/workbench/reports/report-runtime';
        window.reportRuntimeModule = runtime;`,
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
test.beforeEach(async ({ context, page }) => {
  await context.route('https://report-runtime.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }),
  );
  await page.goto('https://report-runtime.test/');
  await page.addScriptTag({ content: script });
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.reportRuntime?.close());
  expect(await page.pageErrors()).toEqual([]);
});

// KernelClient/C and approved frozen files are substitutes; HTML/JS sources, OS and I5 are absent.
async function mount(
  page: Page,
  fault?: 'outcomeUnknown' | 'badOffset' | 'starting' | 'startupFailed' | 'startRejected',
  stylesheet = false,
  initialState?: InitialState,
) {
  const first = baseline();
  if (stylesheet) {
    const sheet = new Wire(1, first.strings);
    sheet.element(30, 'link');
    sheet.attr(30, 'rel', 'stylesheet');
    sheet.attr(30, 'href', 'assets/theme.css');
    sheet.children(2, [30]);
    first.nodes.push(...sheet.frame.nodes);
    first.strings.push(...sheet.frame.strings);
    first.mutations.push(...sheet.frame.mutations);
  }
  const restored = new Wire(2, first.strings);
  restored.property(ids.input, 'value', '恢复草稿');
  restored.content(ids.text, 'Restored browse');
  return page.evaluate(
    async ({ binding, snapshot, css, cssPath, first, restored, fault, initialState }) => {
      const state: State = {
        calls: [],
        confirmations: [],
        messages: [],
        failures: [],
        maxConcurrentExchange: 0,
        presentations: [],
      };
      window.reportRuntimeState = state;
      let concurrent = 0;
      let restorePending = false;
      let restoredOutput = false;
      const unconsumed = new Set<number>();
      const observe = (event: 'restore' | 'ready') => {
        const frame = document.querySelector('iframe');
        if (!frame) throw new Error('Presentation has not been created');
        state.presentations.push({
          event,
          hidden: frame.hidden === true,
          value: frame.contentDocument?.querySelector('input')?.value,
        });
      };
      let running = fault !== 'starting' && fault !== 'startupFailed';
      const bytes = new TextEncoder().encode(css);
      const status = {
        instanceId: 'isolated-report',
        phase: 'running',
        gateReleased: true,
        stopConfirmed: false,
      };
      const client = {
        getSnapshot: () => ({
          phase: 'connected',
          status: { dataDirectory: '/isolated-profile', instanceId: 'kernel' },
        }),
        async call(method: string, input: Request) {
          state.calls.push({ method, input: structuredClone(input) });
          switch (method) {
            case 'resources.reportOpen':
              if (fault === 'outcomeUnknown')
                throw Object.assign(new Error('Synthetic open failure'), {
                  code: 'outcomeUnknown',
                });
              return {
                snapshot,
                status: running ? status : { ...status, phase: 'starting', gateReleased: false },
                files: [{ path: cssPath, byteLength: bytes.length }],
              };
            case 'resources.reportGet':
              running = fault !== 'startupFailed';
              return running
                ? status
                : {
                    ...status,
                    phase: 'stopped',
                    stopConfirmed: true,
                    failure: { code: 'unavailable', message: 'Synthetic startup failure' },
                  };
            case 'resources.reportRead': {
              if (input.path !== cssPath || input.offset === undefined)
                throw new Error('Read outside approved frozen CSS');
              const offset = input.offset;
              const chunk = bytes.slice(offset, offset + 19);
              const nextOffset = offset + chunk.length;
              return {
                base64: btoa(String.fromCharCode(...chunk)),
                offset: fault === 'badOffset' ? offset + 1 : offset,
                size: bytes.length,
                ...(nextOffset < bytes.length ? { nextOffset } : {}),
              };
            }
            case 'resources.reportExchange': {
              if (!running) throw new Error('Data channel has not started');
              concurrent++;
              state.maxConcurrentExchange = Math.max(state.maxConcurrentExchange, concurrent);
              try {
                // Yield across a task so overlapping exchanges are observable.
                await new Promise((resolve) => setTimeout(resolve, 5));
                const command = input.command;
                if (command?.type === 'start') {
                  if (fault === 'startRejected')
                    throw Object.assign(new Error('Synthetic start rejection'), {
                      code: 'unavailable',
                    });
                  restorePending = command.restorePending === true;
                  unconsumed.add(first.sequence);
                  return {
                    packets: [first, ...(restorePending ? [] : [{ ...binding, type: 'ready' }])],
                  };
                }
                if (command?.type === 'restore') {
                  if (!restorePending) throw new Error('Restore was not announced at start');
                  observe('restore');
                  restoredOutput = true;
                  unconsumed.add(restored.sequence);
                  return { packets: [restored] };
                }
                if (command?.type === 'consume') {
                  for (const sequence of command.sequences) unconsumed.delete(sequence);
                  if (restorePending && restoredOutput && !unconsumed.size) {
                    restorePending = false;
                    return { packets: [{ ...binding, type: 'ready' }] };
                  }
                }
                if (command?.type === 'input') {
                  const { nodeId, revision, value, checked, selectedIndex } = command.input;
                  const receipt: ReportProgramPacket = {
                    ...binding,
                    type: 'inputConfirmed',
                    nodeId,
                    revision,
                    through: 1,
                    ...(value !== undefined ? { value } : {}),
                    ...(checked !== undefined ? { checked } : {}),
                    ...(selectedIndex !== undefined ? { selectedIndex } : {}),
                  };
                  state.confirmations.push(receipt);
                  return { packets: [receipt] };
                }
                return { packets: [] };
              } finally {
                concurrent--;
              }
            }
            case 'resources.reportStop':
              return { ...status, phase: 'stopped', stopConfirmed: true };
            default:
              throw new Error(`Unexpected operation: ${method}`);
          }
        },
      };
      const container = document.createElement('div');
      document.body.append(container);
      try {
        window.reportRuntime = window.reportRuntimeModule.createReportRuntime({
          client: client as unknown as KernelClient,
          directory: '/isolated-profile',
          snapshot,
          binding,
          container,
          ...(initialState ? { initialState } : {}),
          message: (message) => {
            if (message.type === 'ready') observe('ready');
            state.messages.push(message);
          },
          failed: (error) => state.failures.push(String(Reflect.get(Object(error), 'code'))),
        });
        await window.reportRuntime.start();
        return { started: true };
      } catch (error) {
        return { started: false, code: String(Reflect.get(Object(error), 'code')) };
      }
    },
    { binding, snapshot, css, cssPath, first, restored: restored.frame, fault, initialState },
  );
}

const readState = (page: Page) => page.evaluate(() => window.reportRuntimeState);
const commands = async (page: Page) =>
  (await readState(page)).calls.flatMap(({ input }) => (input.command ? [input.command] : []));

for (const large of [false, true]) {
  test(`initial state is restored and consumed before the presentation opens (near-limit=${large})`, async ({
    page,
  }) => {
    const initialState = {
      browse: large ? { label: 'Restored browse', padding: 'x'.repeat(65000) } : 'Restored browse',
      draft: '恢复草稿',
      dirty: true,
    };
    expect(await mount(page, undefined, false, initialState)).toEqual({ started: true });
    await expect(page.frameLocator('iframe').getByLabel('Report note')).toBeVisible();
    await expect(page.frameLocator('iframe').getByLabel('Report note')).toHaveValue('恢复草稿');
    await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('Restored browse');
    const state = await readState(page);
    expect(state.presentations).toEqual([
      { event: 'restore', hidden: true, value: 'draft' },
      { event: 'ready', hidden: false, value: '恢复草稿' },
    ]);
    const sent = await commands(page);
    expect(sent[0]).toEqual(
      expect.objectContaining({ ...binding, type: 'start', restorePending: true }),
    );
    expect(sent.filter((command) => command.type === 'restore')).toEqual([
      { ...binding, type: 'restore', ...initialState },
    ]);
    expect(
      sent.filter((command) => command.type === 'consume').flatMap((command) => command.sequences),
    ).toEqual([1, 2]);
    expect(state.failures).toEqual([]);
    expect(state.maxConcurrentExchange).toBe(1);
  });
}

test('oversized initial state is rejected before opening an OS report', async ({ page }) => {
  const initialState = { browse: {}, draft: '界'.repeat(32768), dirty: true };
  const result = await mount(page, undefined, false, initialState);
  expect(result).toEqual({ started: false, code: 'tooLarge' });
  const state = await readState(page);
  expect(state.calls).toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('rejected start also rejects its queued restore without an unhandled rejection or replay', async ({
  page,
}) => {
  const initialState = { browse: {}, draft: '恢复草稿', dirty: true };
  expect(await mount(page, 'startRejected', false, initialState)).toEqual({
    started: false,
    code: 'unavailable',
  });
  await page.evaluate(async () => {
    await window.reportRuntime.start().catch(() => {});
    window.reportRuntime.close();
  });
  const state = await readState(page);
  expect(state.failures).toEqual(['unavailable']);
  expect(state.calls.filter(({ method }) => method === 'resources.reportOpen')).toHaveLength(1);
  expect(await commands(page)).toEqual([
    expect.objectContaining({ type: 'start', restorePending: true }),
  ]);
  expect(state.calls).toContainEqual({ method: 'resources.reportStop', input: key });
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('native input reaches exchange, receives actual confirmation and returns consumer credit; close stops the bound view', async ({
  page,
}) => {
  expect(await mount(page)).toEqual({ started: true });
  const input = page.frameLocator('iframe').getByLabel('Report note');
  await expect(input).toHaveValue('draft');
  await input.press('End');
  await input.press('!');
  await expect
    .poll(async () => (await commands(page)).filter((command) => command.type === 'input'))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ...binding,
          type: 'input',
          input: expect.objectContaining({
            nodeId: ids.input,
            revision: expect.any(Number),
            eventType: 'input',
            isTrusted: true,
            value: 'draft!',
            checked: false,
          }),
        }),
      ]),
    );
  await expect
    .poll(async () => (await readState(page)).confirmations)
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ...binding,
          type: 'inputConfirmed',
          value: 'draft!',
          through: 1,
        }),
      ]),
    );
  await expect
    .poll(() => commands(page))
    .toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'consume', sequences: [1] })]),
    );
  // A second public start must share the completed start rather than replay open/start.
  await page.evaluate(() => window.reportRuntime.start());
  await expect(input).toHaveValue('draft!');
  await page.evaluate(() => window.reportRuntime.close());
  await expect(page.locator('iframe')).toHaveCount(0);
  const state = await readState(page);
  for (const { input } of state.calls) {
    if (input.command?.type !== 'input') continue;
    const { nodeId, revision, value, checked } = input.command.input;
    expect(state.confirmations).toContainEqual({
      ...binding,
      type: 'inputConfirmed',
      nodeId,
      revision,
      value,
      checked,
      through: 1,
    });
  }
  expect(state.failures).toEqual([]);
  expect(state.messages).toContainEqual({ ...binding, type: 'ready' });
  expect(state.maxConcurrentExchange).toBe(1);
  expect(state.calls.filter(({ method }) => method === 'resources.reportOpen')).toEqual([
    {
      method: 'resources.reportOpen',
      input: { ...key, entry: { ref: snapshot.resource.ref, basis: binding.basis } },
    },
  ]);
  expect(state.calls).toContainEqual({ method: 'resources.reportStop', input: key });
  expect((await commands(page)).filter((command) => command.type === 'start')).toHaveLength(1);
});

test('frozen CSS chunks style the real evidence node relative to its nested report entry', async ({
  page,
}) => {
  expect(await mount(page, undefined, true)).toEqual({ started: true });
  const evidence = page.frameLocator('iframe').locator('#evidence');
  await expect(evidence).toHaveCSS('color', 'rgb(12, 34, 56)');
  await expect(evidence).toHaveCSS('padding-left', '17px');
  const state = await readState(page);
  const reads = state.calls.filter(({ method }) => method === 'resources.reportRead');
  expect(reads.length).toBeGreaterThan(1);
  expect(
    reads.every(
      ({ input }) =>
        input.path === cssPath &&
        input.viewId === key.viewId &&
        input.generation === key.generation,
    ),
  ).toBe(true);
  expect(state.failures).toEqual([]);
  expect(state.maxConcurrentExchange).toBe(1);
});

test('accepted start waits for the running receipt before exchanging report data', async ({
  page,
}) => {
  expect(await mount(page, 'starting')).toEqual({ started: true });
  await expect(page.frameLocator('iframe').getByLabel('Report note')).toHaveValue('draft');
  expect((await readState(page)).failures).toEqual([]);
});

test('startup failure stops the bound report without exchanging data', async ({ page }) => {
  expect(await mount(page, 'startupFailed')).toEqual({ started: false, code: 'unavailable' });
  const state = await readState(page);
  expect(state.calls.some(({ method }) => method === 'resources.reportExchange')).toBe(false);
  expect(state.calls).toContainEqual({ method: 'resources.reportStop', input: key });
});

for (const fault of ['outcomeUnknown', 'badOffset'] as const) {
  test(`${fault} during startup attempts the original stop without replaying open`, async ({
    page,
  }) => {
    const result = await mount(page, fault);
    expect(result).toEqual({
      started: false,
      code: fault === 'badOffset' ? 'contentChanged' : fault,
    });
    await expect
      .poll(async () => (await readState(page)).calls)
      .toEqual(expect.arrayContaining([{ method: 'resources.reportStop', input: key }]));
    await page.evaluate(() => window.reportRuntime.start().catch(() => {}));
    const state = await readState(page);
    expect(state.failures).toEqual([result.code]);
    expect(state.calls.filter(({ method }) => method === 'resources.reportOpen')).toHaveLength(1);
    expect(state.calls.filter(({ method }) => method === 'resources.reportExchange')).toEqual([]);
    await expect(page.locator('iframe')).toHaveCount(0);
  });
}
