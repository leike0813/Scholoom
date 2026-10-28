import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { expect, test } from '@playwright/test';

test('fixed BBT cache deletion waits for native completion and preserves native errors', async () => {
  const requests: EventTarget[] = [];
  const indexedDB = {
    deleteDatabase(_name: string) {
      const request = new EventTarget();
      requests.push(request);
      return request;
    },
  };
  runInNewContext(
    await readFile(
      new URL('../../apps/zotero-host/src/renderer/public/worker-bridge.js', import.meta.url),
      'utf8',
    ),
    { self: {}, indexedDB, importScripts() {}, console: { error() {} }, URL },
  );
  const request = indexedDB.deleteDatabase('BetterBibTeXCache');
  let state = 'pending';
  let blocked = 0;
  request.addEventListener('blocked', () => blocked++);
  request.addEventListener('success', () => {
    state = 'completed';
  });
  request.dispatchEvent(new Event('blocked'));
  expect(state).toBe('pending');
  expect(blocked).toBe(0);
  expect(requests).toEqual([request]);
  request.dispatchEvent(new Event('success'));
  expect(state).toBe('completed');

  const failed = indexedDB.deleteDatabase('BetterBibTeXCache');
  failed.addEventListener('error', () => {
    state = 'failed';
  });
  failed.dispatchEvent(new Event('error'));
  expect(state).toBe('failed');

  const other = indexedDB.deleteDatabase('OtherDatabase');
  other.addEventListener('blocked', () => blocked++);
  other.dispatchEvent(new Event('blocked'));
  expect(blocked).toBe(1);
});
