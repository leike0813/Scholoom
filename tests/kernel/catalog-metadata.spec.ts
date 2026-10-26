import { expect, test } from '@playwright/test';
import {
  editCatalogField,
  moveCatalogCreator,
} from '../../apps/desktop/src/renderer/src/workbench/library/catalog-metadata.js';

test('typed field edits preserve unknown CSL values and type-specific fields', () => {
  const before = {
    title: '原题名',
    type: 'article-journal',
    volume: 12,
    'container-title': '原刊物',
    issued: { 'date-parts': [[2024, 2]], season: 1 },
    extension: { nested: ['原值'] },
    note: 'Extra原文',
    'citation-key': 'StableKey',
  };
  const changed = editCatalogField(before, 'title', '新题名');
  const book = editCatalogField(changed, 'type', 'book');
  expect(book).toEqual({ ...before, title: '新题名', type: 'book' });
  expect(before.title).toBe('原题名');
  expect(editCatalogField(book, 'DOI', '')).toEqual(book);
});

test('creator role changes move the complete object and preserve order and name particles', () => {
  const first = {
    family: '王',
    given: '小明',
    'non-dropping-particle': 'de',
    extension: { original: true },
  };
  const organization = { literal: '某研究所', extension: 2 };
  const metadata = { title: '题录', author: [first, organization], editor: [{ family: 'Editor' }] };
  const reordered = moveCatalogCreator(metadata, 'author', 1, 'author', 0);
  expect(reordered.author).toEqual([organization, first]);
  const changed = moveCatalogCreator(reordered, 'author', 1, 'translator');
  expect(changed).toEqual({
    title: '题录',
    author: [organization],
    editor: metadata.editor,
    translator: [first],
  });
  expect(metadata.author).toEqual([first, organization]);
});
