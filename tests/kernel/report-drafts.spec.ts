/// <reference lib="dom" />
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

type Fixture =
  typeof import('../../apps/desktop/src/renderer/src/workbench/reports/report-drafts.js') &
    typeof import('../../apps/desktop/src/renderer/src/workbench/drafts.js');
declare global {
  interface Window {
    reportDraftFixture: Fixture;
  }
}

let script = '';
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import * as reports from './src/renderer/src/workbench/reports/report-drafts';
        import * as drafts from './src/renderer/src/workbench/drafts';
        window.reportDraftFixture={...reports,...drafts};`,
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
  await context.route('https://report-drafts.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<html><body><script>${script}</script></body></html>`,
    }),
  );
  await page.goto('https://report-drafts.test/');
});

const identity = {
  configurationId: 'isolated-profile',
  windowId: 'trusted-window',
  ref: { source: 'project' as const, projectId: 'project', fileId: 'report' },
  basis: 'report-v1',
};
const state = {
  browse: { sort: ['year', 'descending'], expanded: ['paper-b'], filter: '菌株' },
  draft: { comment: 'Keep this comparison', unknown: { values: [null, 3, false] } },
  dirty: true,
};
const message = {
  version: 1,
  viewId: 'ephemeral-view',
  generation: 7,
  basis: identity.basis,
  type: 'state',
  ...state,
};

test('report states survive reload only at their captured configuration window entry and basis', async ({
  page,
  context,
}) => {
  const saved = await page.evaluate(
    ({ identity, message }) => {
      const f = window.reportDraftFixture;
      const original = structuredClone(identity);
      const store = f.createReportDrafts(identity);
      identity.configurationId = 'changed-profile';
      identity.windowId = 'changed-window';
      identity.ref.fileId = 'changed-file';
      identity.basis = 'changed-version';
      const result = store.save({ ...message, type: 'restore' });
      const restored = store.restore({ identity: original, status: 'available' });
      return { result, restored, stored: JSON.parse(f.readDraft(store.key)) };
    },
    { identity, message },
  );
  expect(saved.result).toEqual({ status: 'stored', localStorageWritten: true });
  expect(saved.restored).toEqual({ status: 'restorable', state });
  expect(saved.stored).toEqual(state);
  await page.reload();
  const restored = await page.evaluate((identity) => {
    const store = window.reportDraftFixture.createReportDrafts(identity);
    return store.restore({ identity, status: 'available' });
  }, identity);
  expect(restored).toEqual({ status: 'restorable', state });
  const second = await context.newPage();
  await second.goto('https://report-drafts.test/');
  const otherWindow = await second.evaluate((identity) => {
    const f = window.reportDraftFixture;
    const other = { ...identity, windowId: 'other-window' };
    return {
      isolated: f.createReportDrafts(other).restore({ identity: other, status: 'available' }),
      sharedStorage: f.createReportDrafts(identity).restore({ identity, status: 'available' }),
    };
  }, identity);
  expect(otherWindow.isolated).toEqual({ status: 'missing' });
  expect(otherWindow.sharedStorage).toEqual({ status: 'restorable', state });
  await second.close();
  const isolated = await page.evaluate((identity) => {
    const f = window.reportDraftFixture;
    return [
      { ...identity, configurationId: 'other-profile' },
      { ...identity, windowId: 'other-window' },
      { ...identity, ref: { ...identity.ref, projectId: 'other-project' } },
      { ...identity, ref: { ...identity.ref, fileId: 'other-file' } },
      { ...identity, basis: 'report-v2' },
    ].map((other) => f.createReportDrafts(other).restore({ identity: other, status: 'available' }));
  }, identity);
  expect(isolated).toEqual(Array.from({ length: 5 }, () => ({ status: 'missing' })));
});

test('restoration needs fresh matching approval and unavailable versions only expose copyable drafts', async ({
  page,
}) => {
  const result = await page.evaluate(
    ({ identity, message }) => {
      const f = window.reportDraftFixture;
      const store = f.createReportDrafts(identity);
      store.save(message);
      const approval = { identity, status: 'available' as 'available' | 'denied' };
      const candidate = store.restore(approval);
      if (candidate.status !== 'restorable') throw new Error('Candidate missing');
      candidate.state.browse = 'Changed outside the store';
      const original = store.restore(approval);
      approval.status = 'denied';
      return {
        unverified: store.restore(),
        revoked: store.restore(approval),
        original,
        mismatches: [
          { ...identity, configurationId: 'other-profile' },
          { ...identity, windowId: 'other-window' },
          { ...identity, ref: { ...identity.ref, fileId: 'other-entry' } },
          { ...identity, basis: 'report-v2' },
        ].map((other) => store.restore({ identity: other, status: 'available' })),
        copy: store.restore({ identity, status: 'unavailable' }),
        retained: store.restore({ identity, status: 'available' }),
      };
    },
    { identity, message },
  );
  expect(result.unverified).toEqual({ status: 'unverified' });
  expect(result.revoked).toEqual({ status: 'denied' });
  expect(result.mismatches).toEqual(Array.from({ length: 4 }, () => ({ status: 'mismatch' })));
  expect(result.copy).toEqual({ status: 'copyOnly', draft: state.draft, dirty: true });
  expect(result.original).toEqual({ status: 'restorable', state });
  expect(result.retained).toEqual(result.original);
});

test('bridge rejection preserves old state and the exact 64KiB JSON boundary remains restorable', async ({
  page,
}) => {
  const result = await page.evaluate(
    ({ identity, message }) => {
      const f = window.reportDraftFixture;
      const store = f.createReportDrafts(identity);
      store.save(message);
      const previous = f.readDraft(store.key);
      const cycle: { nested?: unknown } = {};
      cycle.nested = cycle;
      const rejected = [
        { ...message, type: 'ready' },
        { ...message, dirty: 'true' },
        { ...message, browse: { invalid: undefined } },
        { ...message, draft: new Date('2000-01-01T00:00:00Z') },
        { ...message, draft: cycle },
        { ...message, draft: '界'.repeat(24_000) },
        { ...message, permission: true },
      ].map((invalid) => store.save(invalid));
      const wrongVersion = store.save({ ...message, basis: 'report-v2' });
      const unchanged = f.readDraft(store.key) === previous;
      const exact = {
        version: 1,
        viewId: 'v',
        generation: 0,
        basis: identity.basis,
        type: 'state',
        browse: {},
        draft: '',
        dirty: false,
      };
      const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
      exact.draft = `界${'x'.repeat(64 * 1024 - size(exact) - 3)}`;
      const accepted = store.save(exact);
      const atCapacity = f.readDraft(store.key);
      const over = store.save({ ...exact, draft: `${exact.draft}x` });
      const restored = store.restore({ identity, status: 'available' });
      return {
        rejected,
        wrongVersion,
        unchanged,
        bytes: size(exact),
        accepted,
        over,
        protectedBoundary: f.readDraft(store.key) === atCapacity,
        restoresBoundary:
          restored.status === 'restorable' &&
          restored.state.draft === exact.draft &&
          restored.state.dirty === false,
      };
    },
    { identity, message },
  );
  expect(result.rejected).toEqual(Array.from({ length: 7 }, () => ({ status: 'rejected' })));
  expect(result.wrongVersion).toEqual({ status: 'mismatch' });
  expect(result.unchanged).toBe(true);
  expect(result.bytes).toBe(65536);
  expect(result.accepted).toEqual({ status: 'stored', localStorageWritten: true });
  expect(result.over).toEqual({ status: 'rejected' });
  expect(result.protectedBoundary && result.restoresBoundary).toBe(true);
});

test('missing damaged and oversized records stay distinguishable without reading other keys', async ({
  page,
}) => {
  const result = await page.evaluate(
    ({ identity, message }) => {
      const f = window.reportDraftFixture;
      const store = f.createReportDrafts(identity);
      const approval = { identity, status: 'available' as const };
      const missing = store.restore(approval);
      f.writeDraft(store.key, '{');
      const corrupt = store.restore(approval);
      f.writeDraft(
        store.key,
        JSON.stringify({ browse: {}, draft: 'old', dirty: true, viewId: 'old' }),
      );
      const ephemeralRecord = store.restore(approval);
      f.writeDraft(store.key, '界'.repeat(24_000));
      const tooLarge = store.restore(approval);
      const first = { ...identity, configurationId: 'config|window', windowId: 'one' };
      const other = { ...identity, configurationId: 'config', windowId: 'window|one' };
      f.createReportDrafts(first).save(message);
      const get = Storage.prototype.getItem;
      const reads: string[] = [];
      // A newly bound, absent key must still use the real adapter's getItem without enumeration.
      Storage.prototype.getItem = function (key) {
        reads.push(key);
        return get.call(this, key);
      };
      const enumerate = Storage.prototype.key;
      Storage.prototype.key = () => {
        throw new Error('Storage enumeration is outside report draft scope');
      };
      try {
        const collision = f.createReportDrafts(other);
        return {
          missing,
          corrupt,
          ephemeralRecord,
          tooLarge,
          isolated: collision.restore({ identity: other, status: 'available' }),
          reads,
          exactKey: reads.every((key) => key.endsWith(collision.key)),
        };
      } finally {
        Storage.prototype.getItem = get;
        Storage.prototype.key = enumerate;
      }
    },
    { identity, message },
  );
  expect(result.missing).toEqual({ status: 'missing' });
  expect(result.corrupt).toEqual({ status: 'corrupt' });
  expect(result.ephemeralRecord).toEqual({ status: 'corrupt' });
  expect(result.tooLarge).toEqual({ status: 'tooLarge' });
  expect(result.isolated).toEqual({ status: 'missing' });
  expect(result.reads.length).toBeGreaterThan(0);
  expect(result.exactKey).toBe(true);
});

test('storage write failure keeps memory and notifications without claiming durable recovery', async ({
  page,
}) => {
  const result = await page.evaluate(
    ({ identity, message }) => {
      const f = window.reportDraftFixture;
      const store = f.createReportDrafts(identity);
      store.save(message);
      let notified = 0;
      let attempts = 0;
      const errors: string[] = [];
      const onError = (event: ErrorEvent) => {
        errors.push(event.message);
        event.preventDefault();
      };
      window.addEventListener('error', onError);
      const unsubscribeFailure = store.subscribe(() => {
        throw new Error('Fixture subscription failure');
      });
      const unsubscribe = store.subscribe(() => {
        notified++;
      });
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        attempts++;
        throw new DOMException('Fixture storage is full', 'QuotaExceededError');
      };
      try {
        const saved = store.save({ ...message, draft: 'Unpersisted edit' });
        return {
          saved,
          restored: store.restore({ identity, status: 'available' }),
          notified,
          attempts,
          errors,
        };
      } finally {
        Storage.prototype.setItem = set;
        unsubscribeFailure();
        unsubscribe();
        window.removeEventListener('error', onError);
      }
    },
    { identity, message },
  );
  expect(result.saved).toEqual({ status: 'stored', localStorageWritten: false });
  expect(result.restored).toEqual({
    status: 'restorable',
    state: { ...state, draft: 'Unpersisted edit' },
  });
  expect(result.attempts).toBe(1);
  expect(result.notified).toBe(1);
  expect(result.errors).toHaveLength(1);
  await page.reload();
  const fromStorage = await page.evaluate((identity) => {
    return window.reportDraftFixture.createReportDrafts(identity).restore({
      identity,
      status: 'available',
    });
  }, identity);
  expect(fromStorage).toEqual({ status: 'restorable', state });
  const failedRemoval = await page.evaluate((identity) => {
    const f = window.reportDraftFixture;
    const store = f.createReportDrafts(identity);
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = () => {
      throw new DOMException('Fixture storage is unavailable', 'SecurityError');
    };
    try {
      return {
        localStorageWritten: f.writeDraft(store.key, ''),
        memory: store.restore({ identity, status: 'available' }),
      };
    } finally {
      Storage.prototype.removeItem = remove;
    }
  }, identity);
  expect(failedRemoval).toEqual({ localStorageWritten: false, memory: { status: 'missing' } });
  await page.reload();
  const cleared = await page.evaluate((identity) => {
    const f = window.reportDraftFixture;
    const store = f.createReportDrafts(identity);
    const before = store.restore({ identity, status: 'available' });
    return { before, localStorageWritten: f.writeDraft(store.key, '') };
  }, identity);
  expect(cleared).toEqual({ before: { status: 'restorable', state }, localStorageWritten: true });
  await page.reload();
  expect(
    await page.evaluate((identity) => {
      return window.reportDraftFixture.createReportDrafts(identity).restore({
        identity,
        status: 'available',
      });
    }, identity),
  ).toEqual({ status: 'missing' });
});
