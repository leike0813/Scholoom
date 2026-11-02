/// <reference lib="dom" />
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import type { KernelClient } from '../../packages/client/dist/index.js';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import type { ContextItem, WorkbenchChange } from '../../packages/protocol/dist/index.js';
import type {
  ReportBridgeMessage,
  ReportProgramCommand,
  ReportProgramPacket,
  ReportSnapshot,
} from '../../packages/protocol/dist/report-contracts.js';
import { baseline, ids, Wire } from '../fixtures/report-dom/frames.js';

type Binding = Pick<ReportBridgeMessage, 'version' | 'viewId' | 'generation' | 'basis'>;
type Request = {
  viewId?: string;
  generation?: number;
  basis?: string;
  entry?: { ref: ReportSnapshot['resource']['ref']; basis: string };
  locator?: ReportSnapshot['resource']['ref'];
  command?: ReportProgramCommand;
  paths?: string[];
  watchId?: string;
};
type State = {
  calls: { method: string; input: Request }[];
  bindings: Binding[];
  batches: (readonly ContextItem[])[];
  stops: Request[];
};

// This narrow browser API avoids importing React TSX into the NodeNext tools project.
declare global {
  interface Window {
    reportViewFixture: {
      mount(client: KernelClient, resource: ReportSnapshot['resource']): void;
      unmount(): void;
      saved(basis: string): unknown;
      state: State;
      publish(): void;
      holdReady(hold: boolean): void;
      pendingPackets(): number;
      setOriginalVersion(state: 'available' | 'unavailable' | 'denied'): void;
      change(change: WorkbenchChange): void;
      setConnection(phase: 'connected' | 'reconnecting'): void;
      inject(message: ReportProgramPacket, bindingIndex?: number): void;
    };
  }
}

const directory = '/isolated-view';
const ref = { source: 'project', projectId: 'project', fileId: 'report' } as const;
const source = {
  ref: { source: 'project', projectId: 'project', fileId: 'source' } as const,
  basis: 'source-v1',
};
const snapshot = (version: number): ReportSnapshot => ({
  resource: {
    ref,
    basis: `report-v${version}`,
    path: 'reports/main.html',
    name: 'Report',
    format: 'html',
    report: true,
    capabilities: { read: true, write: false, readingRecords: false, render: false },
  },
  manifest: {
    version: 1,
    resources: [],
    sources: [{ ...source, basis: `source-v${version}` }],
    objects: [
      {
        objectId: 'comparison',
        name: `Comparison v${version}`,
        semantics: `Measured comparison from version ${version}`,
        sourceIndexes: [0],
      },
    ],
  },
});
const snapshots = [snapshot(1), snapshot(2), snapshot(3)] as const;
const draft = {
  browse: { expanded: ['comparison'], filter: '菌株', sort: ['year', 'descending'] },
  draft: { comment: 'Keep the original comparison', values: [null, 3, false] },
  dirty: true,
};

let script = '';
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { ReportView } from './src/renderer/src/workbench/reports/ReportView';
        import { ContextContributionProvider } from './src/renderer/src/workbench/context-contributions';
        import { workbenchInstanceId } from './src/renderer/src/workbench/context-drafts';
        import { draftKey, readDraft } from './src/renderer/src/workbench/drafts';
        import { createReportDrafts } from './src/renderer/src/workbench/reports/report-drafts';
        let root, resource;
        const host = document.getElementById('root');
        const appendContextItems = (items) => {
          // Preserve the actual atomic batch produced by production createReportContext.
          window.reportViewFixture.state.batches.push(items);
          return true;
        };
        window.reportViewFixture = {
          mount(client, entry) {
            resource = entry;
            root = createRoot(host);
            root.render(
              <ContextContributionProvider
                receiver={{projectId: 'project', sessionId: 'receiver'}}
                appendContextItems={appendContextItems}>
                <ReportView client={client} directory='/isolated-view' resource={entry}
                  enabled={true} composerKey={draftKey('/isolated-view', 'project', 'receiver')} />
              </ContextContributionProvider>
            );
          },
          unmount() { root?.unmount(); root = undefined; },
          saved(basis) {
            const store = createReportDrafts({ configurationId: '/isolated-view',
              windowId: workbenchInstanceId(), ref: resource.ref, basis });
            const text = readDraft(store.key);
            return text ? JSON.parse(text) : null;
          }
        };`,
      resolveDir: fileURLToPath(new URL('../../apps/desktop/', import.meta.url)),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"test"' },
  });
  script = bundle.outputFiles[0]?.text ?? '';
  expect(script).toBeTruthy();
});

test.beforeEach(async ({ page }) => {
  await page.route('https://report-view.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body><div id="root"></div></body></html>',
    }),
  );
  await page.goto('https://report-view.test/');
  await page.addScriptTag({ content: script });
  const frames = snapshots.map((snapshot) => {
    const first = baseline();
    const label = new Wire(1, first.strings);
    label.content(ids.text, snapshot.resource.basis);
    first.strings.push(...label.frame.strings);
    first.mutations.push(...label.frame.mutations);
    return first;
  });
  await page.evaluate(
    ({ snapshots, frames, directory }) => {
      const f = window.reportViewFixture;
      const state: State = { calls: [], bindings: [], batches: [], stops: [] };
      f.state = state;
      const connections = new Set<() => void>();
      const changes = new Set<(change: WorkbenchChange) => void>();
      const outputs = new Map<string, ReportProgramPacket[]>();
      const pendingRestores = new Set<string>();
      const consumed = new Set<string>();
      const pendingReady = new Map<string, Binding>();
      const watches = new Set<string>();
      let watchSequence = 0;
      let latest: 0 | 1 | 2 = 0;
      let holdReady = false;
      let originalVersion: 'available' | 'unavailable' | 'denied' = 'available';
      let connectionPhase: 'connected' | 'reconnecting' = 'connected';
      const version = (basis: string | undefined) => {
        if (basis === snapshots[0].resource.basis) return 0;
        if (basis === snapshots[1].resource.basis) return 1;
        if (basis === snapshots[2].resource.basis) return 2;
        throw new Error(`Unexpected report version: ${basis}`);
      };
      const status = {
        instanceId: 'synthetic-report',
        phase: 'running',
        gateReleased: true,
        stopConfirmed: false,
      };
      // KernelClient, authorization snapshots and program output are fixed substitutes.
      // No report JS source, OS isolation, model, server or sudo is exercised here.
      const client = {
        getSnapshot: () => ({
          phase: connectionPhase,
          status: { dataDirectory: directory, instanceId: 'kernel' },
        }),
        subscribe(callback: () => void) {
          connections.add(callback);
          return () => connections.delete(callback);
        },
        subscribeChanges(callback: (change: WorkbenchChange) => void) {
          changes.add(callback);
          return () => changes.delete(callback);
        },
        async call(method: string, input: Request) {
          // Poll/consume are deliberately not counted or retained.
          if (
            method !== 'resources.reportExchange' ||
            (input.command && input.command.type !== 'consume')
          )
            state.calls.push({ method, input: structuredClone(input) });
          switch (method) {
            case 'resources.describe':
              if (input.locator?.source === 'project' && input.locator.fileId === 'source')
                return {
                  ...snapshots[latest].resource,
                  ref: input.locator,
                  basis: `source-v${latest + 1}`,
                };
              return snapshots[latest].resource;
            case 'resources.report':
              return snapshots[version(input.basis)];
            case 'resources.reportVersion':
              if (version(input.basis) === 0) {
                if (originalVersion === 'denied')
                  throw Object.assign(new Error('Synthetic original version permission denied'), {
                    code: 'permissionDenied',
                  });
                if (originalVersion === 'unavailable')
                  return { state: 'unavailable', reason: 'contentChanged' };
              }
              return { state: 'available', snapshot: snapshots[version(input.basis)] };
            case 'resources.reportOpen':
              return { snapshot: snapshots[version(input.entry?.basis)], files: [], status };
            case 'resources.reportExchange': {
              const command = input.command;
              if (command?.type === 'start') {
                if (input.viewId !== command.viewId || input.generation !== command.generation)
                  throw new Error('Start binding differs from the opened view');
                const { version: protocol, viewId, generation, basis } = command;
                const binding = { version: protocol, viewId, generation, basis };
                state.bindings.push(binding);
                outputs.set(viewId, []);
                if (command.restorePending) pendingRestores.add(viewId);
                return {
                  packets: [
                    frames[version(basis)],
                    ...(holdReady || command.restorePending ? [] : [{ ...binding, type: 'ready' }]),
                  ],
                };
              }
              if (command?.type === 'restore') {
                if (!pendingRestores.delete(command.viewId))
                  throw new Error('Restore was not announced at start');
                const { version, viewId, generation, basis } = command;
                const binding = { version, viewId, generation, basis };
                if (!holdReady && consumed.has(viewId))
                  return { packets: [{ ...binding, type: 'ready' }] };
                pendingReady.set(viewId, binding);
                return { packets: [] };
              }
              if (command?.type === 'consume') {
                const viewId = input.viewId ?? '';
                if (command.sequences.includes(1)) consumed.add(viewId);
                const binding = pendingReady.get(viewId);
                if (!holdReady && consumed.has(viewId) && binding) {
                  pendingReady.delete(viewId);
                  return { packets: [{ ...binding, type: 'ready' }] };
                }
                return { packets: [] };
              }
              return { packets: outputs.get(input.viewId ?? '')?.splice(0) ?? [] };
            }
            case 'resources.reportStop':
              state.stops.push(structuredClone(input));
              return { ...status, phase: 'stopped', stopConfirmed: true };
            case 'files.watch': {
              if (!input.paths || input.paths.length > 100 || watches.size >= 8)
                throw new Error('Watch scope exceeded');
              const watchId = `view-watch-${++watchSequence}`;
              watches.add(watchId);
              return { watchId };
            }
            case 'files.unwatch':
              watches.delete(input.watchId ?? '');
              return {};
            default:
              throw new Error(`Unexpected operation: ${method}`);
          }
        },
      };
      // These APIs control only the substitute's approval results and client notifications.
      f.setOriginalVersion = (state) => {
        originalVersion = state;
      };
      f.change = (change) => {
        for (const callback of changes) callback(change);
      };
      f.setConnection = (phase) => {
        connectionPhase = phase;
        for (const callback of connections) callback();
      };
      f.publish = () => {
        latest = latest === 0 ? 1 : 2;
        f.change({ projectId: 'project', filePaths: ['reports/main.html'] } as WorkbenchChange);
      };
      f.holdReady = (hold) => {
        holdReady = hold;
      };
      f.pendingPackets = () =>
        [...outputs.values()].reduce((count, packets) => count + packets.length, 0);
      f.inject = (message, bindingIndex = state.bindings.length - 1) => {
        const binding = state.bindings[bindingIndex];
        if (!binding) throw new Error('View has not started');
        const queue = outputs.get(binding.viewId);
        if (!queue || queue.length >= 8) throw new Error('No bounded output queue for view');
        queue.push(structuredClone(message));
      };
      f.mount(client as unknown as KernelClient, snapshots[0].resource);
      // Reopening changes the entry descriptor to current v2, while saved v1 owns recovery.
      const reopen = document.createElement('button');
      reopen.textContent = 'Reopen report';
      reopen.onclick = () => {
        holdReady = true;
        f.mount(client as unknown as KernelClient, snapshots[latest].resource);
      };
      const close = document.createElement('button');
      close.textContent = 'Close report';
      close.onclick = () => f.unmount();
      document.body.append(close, reopen);
    },
    { snapshots, frames, directory },
  );
  await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('report-v1');
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.reportViewFixture.unmount());
  expect(await page.pageErrors()).toEqual([]);
});

const readState = (page: Page) => page.evaluate(() => window.reportViewFixture.state);
const saved = (page: Page) => page.evaluate(() => window.reportViewFixture.saved('report-v1'));
async function lastBinding(page: Page) {
  const binding = (await readState(page)).bindings.at(-1);
  if (!binding) throw new Error('View has not started');
  return binding;
}
const restores = async (page: Page) =>
  (await readState(page)).calls.flatMap(({ input }) =>
    input.command?.type === 'restore' ? [input.command] : [],
  );

async function saveDirtyState(page: Page) {
  await page.evaluate(
    ({ draft, binding }) => {
      const f = window.reportViewFixture;
      f.inject({ ...binding, type: 'state', ...draft });
    },
    { draft, binding: await lastBinding(page) },
  );
  await expect.poll(() => saved(page)).toEqual(draft);
}

for (const intermediateReady of [true, false]) {
  test(`consecutive clean publications preserve browse with intermediate ready=${intermediateReady} and no state echo`, async ({
    page,
  }) => {
    const clean = { browse: draft.browse, draft: {}, dirty: false };
    const first = await lastBinding(page);
    await page.evaluate(
      ({ state, binding }) => {
        window.reportViewFixture.inject({ ...binding, type: 'state', ...state });
      },
      { state: clean, binding: await lastBinding(page) },
    );
    await expect.poll(() => saved(page)).toEqual(clean);
    if (!intermediateReady) await page.evaluate(() => window.reportViewFixture.holdReady(true));
    await page.evaluate(() => window.reportViewFixture.publish());
    await expect.poll(async () => (await lastBinding(page)).basis).toBe('report-v2');
    const binding = await lastBinding(page);
    await expect.poll(() => restores(page)).toEqual([{ ...binding, type: 'restore', ...clean }]);
    if (intermediateReady)
      await expect(page.frameLocator('iframe').locator('#evidence')).toBeVisible();
    else {
      await expect(page.locator('iframe')).toBeHidden();
      await page.evaluate((binding) => {
        const f = window.reportViewFixture;
        f.inject({ ...binding, type: 'ready' });
        f.inject({ ...binding, type: 'state', browse: 'stale', draft: 'stale', dirty: true });
      }, first);
      await expect
        .poll(() => page.evaluate(() => window.reportViewFixture.pendingPackets()))
        .toBe(0);
      await expect(page.locator('iframe')).toBeHidden();
    }
    await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('report-v2');
    expect(await saved(page)).toEqual(clean);
    expect(await page.evaluate(() => window.reportViewFixture.saved('report-v2'))).toBeNull();
    expect(binding.basis).toBe('report-v2');
    await page.evaluate(() => window.reportViewFixture.publish());
    await expect.poll(async () => (await lastBinding(page)).basis).toBe('report-v3');
    const third = await lastBinding(page);
    await expect
      .poll(() => restores(page))
      .toEqual([
        { ...binding, type: 'restore', ...clean },
        { ...third, type: 'restore', ...clean },
      ]);
    if (!intermediateReady) {
      await expect(page.locator('iframe')).toBeHidden();
      await page.evaluate((binding) => {
        window.reportViewFixture.inject({ ...binding, type: 'ready' });
      }, third);
    }
    await expect(page.frameLocator('iframe').locator('#evidence')).toBeVisible();
    await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('report-v3');
    expect(await restores(page)).toEqual([
      { ...binding, type: 'restore', ...clean },
      { ...third, type: 'restore', ...clean },
    ]);
    expect(third.basis).toBe('report-v3');
    expect(await saved(page)).toEqual(clean);
    expect(await page.evaluate(() => window.reportViewFixture.saved('report-v2'))).toBeNull();
    expect(await page.evaluate(() => window.reportViewFixture.saved('report-v3'))).toBeNull();
  });
}

test('dirty v1 survives publication; selecting its object appends original semantics and source atomically', async ({
  page,
}) => {
  await saveDirtyState(page);
  await page.evaluate(() => window.reportViewFixture.publish());
  const newer = page.getByRole('button', { name: '查看新版' });
  await expect(newer).toBeEnabled();
  await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('report-v1');
  await page.evaluate(
    (binding) => {
      const f = window.reportViewFixture;
      f.inject({
        ...binding,
        type: 'select',
        objectIds: ['comparison'],
        request: 'Explain this original comparison',
      });
    },
    await lastBinding(page),
  );
  await expect
    .poll(async () => (await readState(page)).batches)
    .toEqual([
      [
        {
          kind: 'object',
          itemId: expect.any(String),
          ref,
          basis: 'report-v1',
          providerId: 'report',
          objectId: 'comparison',
          name: 'Comparison v1',
          semantics: 'Measured comparison from version 1',
          comment: 'Explain this original comparison',
        },
        { kind: 'resource', itemId: expect.any(String), ...source },
      ],
    ]);
  const original = (await readState(page)).batches;
  const first = await lastBinding(page);
  await newer.click();
  await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('report-v2');
  expect(await restores(page)).toEqual([]);
  expect((await readState(page)).batches).toEqual(original);
  expect(await saved(page)).toEqual(draft);
  await expect
    .poll(async () => (await readState(page)).stops)
    .toContainEqual({
      viewId: first.viewId,
      generation: first.generation,
    });
});

test('reopening the same entry restores freshly approved v1 before its new binding is ready', async ({
  page,
}) => {
  await saveDirtyState(page);
  const first = await lastBinding(page);
  await page.evaluate(() => window.reportViewFixture.publish());
  await expect(page.getByRole('button', { name: '查看新版' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close report', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect
    .poll(async () => (await readState(page)).stops)
    .toContainEqual({
      viewId: first.viewId,
      generation: first.generation,
    });
  const beforeReopen = (await readState(page)).calls.length;
  await page.getByRole('button', { name: 'Reopen report', exact: true }).click();
  await expect.poll(async () => (await readState(page)).bindings.length).toBe(2);
  const reopened = await lastBinding(page);
  await expect.poll(() => restores(page)).toEqual([{ ...reopened, type: 'restore', ...draft }]);
  await expect(page.locator('iframe')).toBeHidden();
  expect(await saved(page)).toEqual(draft);
  await page.evaluate((binding) => {
    window.reportViewFixture.inject({
      ...binding,
      type: 'state',
      browse: {},
      draft: {},
      dirty: false,
    });
    window.reportViewFixture.inject({ ...binding, type: 'ready' });
  }, reopened);
  await expect(page.frameLocator('iframe').locator('#evidence')).toBeVisible();
  await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('report-v1');
  const state = await readState(page);
  expect(reopened.viewId).not.toBe(first.viewId);
  expect(reopened.basis).toBe('report-v1');
  const calls = state.calls.slice(beforeReopen);
  expect(calls).toContainEqual({
    method: 'resources.reportVersion',
    input: { ref, basis: 'report-v1' },
  });
  expect(calls).toContainEqual({
    method: 'resources.reportOpen',
    input: {
      viewId: reopened.viewId,
      generation: reopened.generation,
      entry: { ref, basis: 'report-v1' },
    },
  });
  expect(
    calls.flatMap(({ input }) => (input.command?.type === 'restore' ? [input.command] : [])),
  ).toEqual([{ ...reopened, type: 'restore', ...draft }]);
  expect(await saved(page)).toEqual(draft);
  await expect(page.getByRole('button', { name: '查看新版' })).toBeEnabled();
});

test('copy-only v1 draft hides after original permission revocation and disconnection without changing storage', async ({
  page,
}) => {
  await saveDirtyState(page);
  await page.evaluate(() => window.reportViewFixture.publish());
  await expect(page.getByRole('button', { name: '查看新版' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close report', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.evaluate(() => window.reportViewFixture.setOriginalVersion('unavailable'));
  await page.getByRole('button', { name: 'Reopen report', exact: true }).click();
  await expect.poll(async () => (await lastBinding(page)).basis).toBe('report-v2');
  await expect(page.locator('iframe')).toBeHidden();
  await page.evaluate(
    (binding) => {
      window.reportViewFixture.inject({ ...binding, type: 'ready' });
    },
    await lastBinding(page),
  );
  await expect(page.frameLocator('iframe').locator('#evidence')).toBeVisible();
  await expect(page.frameLocator('iframe').locator('#evidence')).toHaveText('report-v2');
  const copy = page.getByRole('textbox', { name: '原报告草稿' });
  await expect(copy).toBeVisible();
  expect(JSON.parse(await copy.inputValue())).toEqual(draft.draft);
  expect(await saved(page)).toEqual(draft);

  // v2 has only project sources: its adapter does not watch library changes for old v1.
  const beforeRevocation = (await readState(page)).calls.length;
  await page.evaluate(() => {
    const f = window.reportViewFixture;
    f.setOriginalVersion('denied');
    f.change({ libraryChanged: true } as WorkbenchChange);
  });
  await expect(copy).toHaveCount(0);
  expect((await readState(page)).calls.slice(beforeRevocation)).toContainEqual({
    method: 'resources.reportVersion',
    input: { ref, basis: 'report-v1' },
  });
  expect(await saved(page)).toEqual(draft);

  await page.evaluate(() => {
    const f = window.reportViewFixture;
    f.setOriginalVersion('unavailable');
    f.change({ libraryChanged: true } as WorkbenchChange);
  });
  await expect(copy).toBeVisible();
  expect(JSON.parse(await copy.inputValue())).toEqual(draft.draft);
  await page.evaluate(() => window.reportViewFixture.setConnection('reconnecting'));
  await expect(copy).toHaveCount(0);
  expect(await saved(page)).toEqual(draft);
});
