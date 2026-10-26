import { expect, test } from '@playwright/test';
import { CatalogSelection } from '../../apps/desktop/src/renderer/src/workbench/library/CatalogSelection.js';

test('catalog selection keeps identities through reordering and removes absent rows', () => {
  const selection = new CatalogSelection();
  const rows = ['source-a', 'source-b', 'source-c'];
  selection.select('source-b', {}, rows);
  selection.select('source-c', { toggle: true }, rows);
  expect(selection.getSnapshot()).toMatchObject({
    primaryId: 'source-c',
    selectedIds: ['source-b', 'source-c'],
  });
  selection.reconcile(['source-c', 'source-b', 'source-a']);
  expect(selection.getSnapshot().primaryId).toBe('source-c');
  selection.select('source-c', { toggle: true }, ['source-c', 'source-b', 'source-a']);
  expect(selection.getSnapshot().primaryId).toBe('source-b');
  selection.reconcile(['another-page']);
  expect(selection.getSnapshot()).toMatchObject({ selectedIds: [], primaryId: null });
});

test('range selection is limited to loaded identities and every change is observable', () => {
  const selection = new CatalogSelection();
  let changes = 0;
  const unsubscribe = selection.subscribe(() => changes++);
  const rows = ['a', 'b', 'c', 'd'];
  selection.select('b', {}, rows);
  selection.select('d', { range: true }, rows);
  expect(selection.getSnapshot().selectedIds).toEqual(['b', 'c', 'd']);
  expect(changes).toBe(2);
  selection.reconcile(['c', 'd']);
  selection.select('c', { range: true }, ['c', 'd']);
  expect(selection.getSnapshot()).toMatchObject({ primaryId: 'c', selectedIds: ['c'] });
  selection.selectAll(['c', 'd']);
  expect(selection.getSnapshot().selectedIds).toEqual(['c', 'd']);
  unsubscribe();
});
