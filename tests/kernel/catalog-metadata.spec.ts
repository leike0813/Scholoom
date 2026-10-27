import { expect, test } from '@playwright/test';
import {
  catalogDateParts,
  editCatalogDatePart,
  editCatalogField,
  moveCatalogCreator,
} from '../../apps/desktop/src/renderer/src/workbench/library/catalog-metadata.js';
import {
  catalogEditorFields,
  catalogEditorRoles,
} from '../../packages/protocol/dist/library-metadata.js';

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

test('remaining native CSL projections from fixed upstream samples are editable in their types', () => {
  // Independent schema44 / utilities 1dd38e2 samples, not derived from the editor declarations.
  const samples = [
    {
      type: 'motion_picture',
      fields: [
        'genre',
        'medium',
        'dimensions',
        'collection-title',
        'title-short',
        'publisher',
        'event-place',
      ],
    },
    { type: 'software', fields: ['genre', 'medium', 'collection-title', 'publisher-place'] },
    { type: 'patent', fields: ['call-number', 'references', 'issue', 'publisher-place'] },
    { type: 'legal_case', fields: ['container-title', 'volume', 'page', 'references'] },
    { type: 'speech', fields: ['event-title', 'event-place'] },
    { type: 'hearing', fields: ['section', 'references'] },
  ];
  for (const sample of samples)
    for (const key of sample.fields) {
      const field = catalogEditorFields.find((field) => field.key === key);
      expect(field, `${sample.type}.${key}`).toBeDefined();
      if (field?.types) expect(field.types).toContain(sample.type);
    }
  const host = catalogEditorRoles.find(([key]) => key === 'host');
  expect(host).toBeDefined();
  expect(host?.[2]).toEqual(expect.arrayContaining(['broadcast', 'motion_picture']));
});

test('simple CSL date edits preserve precision and leave complex dates and unrelated values intact', () => {
  const original = {
    title: '独立日期样本',
    issued: { 'date-parts': [[2024, 2, 29]] },
    accessed: { literal: '2026年秋', extension: { original: true } },
    submitted: {
      'date-parts': [
        [2025, 1],
        [2025, 3],
      ],
      circa: true,
    },
    extension: { retained: ['原值'] },
  };
  expect(catalogDateParts(original.issued)).toEqual([2024, 2, 29]);
  for (const date of [
    original.submitted,
    { 'date-parts': [[2024, 2]], season: 1 },
    { 'date-parts': [[2024, 2]], raw: '春' },
    { 'date-parts': [[2024, 13]] },
    { 'date-parts': [[-44]] },
  ])
    expect(catalogDateParts(date)).toBeUndefined();
  const changed = editCatalogDatePart(original, 'issued', 2, '28');
  expect(changed).toEqual({ ...original, issued: { 'date-parts': [[2024, 2, 28]] } });
  expect(editCatalogDatePart(changed, 'issued', 1, '')).toEqual(changed);
  expect(editCatalogDatePart(changed, 'issued', 1, '13')).toEqual(changed);
  expect(editCatalogDatePart(original, 'submitted', 0, '2026')).toEqual(original);
  const month = editCatalogDatePart(changed, 'issued', 2, '');
  expect(month.issued).toEqual({ 'date-parts': [[2024, 2]] });
  const year = editCatalogDatePart(month, 'issued', 1, '');
  expect(year.issued).toEqual({ 'date-parts': [[2024]] });
  const cleared = editCatalogDatePart(year, 'issued', 0, '');
  expect(cleared).toEqual({
    title: original.title,
    accessed: original.accessed,
    submitted: original.submitted,
    extension: original.extension,
  });
  expect(editCatalogDatePart(cleared, 'issued', 0, '2026').issued).toEqual({
    'date-parts': [[2026]],
  });
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
