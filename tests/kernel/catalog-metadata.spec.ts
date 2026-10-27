import { expect, test } from '@playwright/test';
import {
  catalogDateCirca,
  catalogDateParts,
  editCatalogDateCirca,
  editCatalogDatePart,
  editCatalogField,
  moveCatalogCreator,
  removeCatalogDateEnd,
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

test('numeric CSL date ranges expose independent endpoint precision without discarding attributes', () => {
  // CSL official date_TextFormFulldateYearRange / date_Uncertain inputs.
  const date = {
    'date-parts': [
      [1987, 8, 3],
      [2003, 10, 23],
    ],
    circa: 1,
    extension: { retained: true },
  };
  expect(catalogDateParts(date)).toEqual([
    [1987, 8, 3],
    [2003, 10, 23],
  ]);
  const mixed = { title: 'Mixed precision', issued: { 'date-parts': [[1987], [2003, 10, 23]] } };
  expect(catalogDateParts(mixed.issued)).toEqual([[1987], [2003, 10, 23]]);
  expect(editCatalogDatePart(mixed, 'issued', 1, '9').issued).toEqual({
    'date-parts': [
      [1987, 9],
      [2003, 10, 23],
    ],
  });
  const original = { title: 'Date range', issued: date, extension: { other: ['保留'] } };
  const changed = editCatalogDatePart(original, 'issued', 2, '24', 1);
  expect(changed).toEqual({
    ...original,
    issued: {
      ...date,
      'date-parts': [
        [1987, 8, 3],
        [2003, 10, 24],
      ],
    },
  });
  expect(original.issued['date-parts']).toEqual([
    [1987, 8, 3],
    [2003, 10, 23],
  ]);
  const month = editCatalogDatePart(changed, 'issued', 2, '', 1);
  const year = editCatalogDatePart(month, 'issued', 1, '', 1);
  expect(year.issued).toEqual({ ...date, 'date-parts': [[1987, 8, 3], [2003]] });
  expect(editCatalogDatePart(year, 'issued', 0, '', 1).issued).toEqual({
    ...date,
    'date-parts': [[1987, 8, 3]],
  });
  expect(removeCatalogDateEnd(original, 'issued').issued).toEqual({
    ...date,
    'date-parts': [[1987, 8, 3]],
  });
  for (const [index, value, endpoint] of [
    [1, '', 1],
    [0, '', 0],
    [1, '13', 1],
    [2, '32', 1],
    [0, '1e', 1],
    [0, '10000', 1],
    [0, '-1', 1],
    [0, '2004', 2],
    [0.5, '1', 0],
    [0, '2004', 0.5],
  ] as const)
    expect(editCatalogDatePart(original, 'issued', index, value, endpoint)).toEqual(original);
  const point = editCatalogDatePart({ title: 'New date' }, 'issued', 0, '1987');
  const years = editCatalogDatePart(point, 'issued', 0, '2003', 1);
  expect(editCatalogDatePart(years, 'issued', 0, '')).toEqual(years);
  expect(editCatalogDatePart(point, 'issued', 0, '2003', 1).issued).toEqual({
    'date-parts': [[1987], [2003]],
  });
  expect(editCatalogDatePart({ title: 'New date' }, 'issued', 0, '2003', 1)).toEqual({
    title: 'New date',
  });
  expect(
    editCatalogDatePart(
      {
        title: 'Retained properties',
        issued: { 'date-parts': [[1987]], circa: 1, extension: true },
      },
      'issued',
      0,
      '',
    ).issued,
  ).toEqual({ circa: 1, extension: true });
});

test('circa is explicitly edited without coercing unknown flags or changing endpoints', () => {
  for (const [before, selected, expected] of [
    [1, 'false', 0],
    [0, 'true', 1],
    [true, 'false', false],
    [false, 'true', true],
    [undefined, 'true', true],
  ] as const) {
    const metadata = {
      title: 'Approximate',
      issued: {
        'date-parts': [[2005, 12, 15]],
        ...(before === undefined ? {} : { circa: before }),
        extension: ['保留'],
      },
    };
    expect(editCatalogDateCirca(metadata, 'issued', selected).issued).toEqual({
      ...metadata.issued,
      circa: expected,
    });
    expect(editCatalogDateCirca(metadata, 'issued', 'unset').issued).toEqual({
      'date-parts': [[2005, 12, 15]],
      extension: ['保留'],
    });
  }
  for (const flag of ['0', '1', 2, { untouched: true }]) {
    const metadata = { title: 'Unknown flag', issued: { 'date-parts': [[2005]], circa: flag } };
    expect(catalogDateCirca(metadata.issued)).toBeUndefined();
    expect(editCatalogDateCirca(metadata, 'issued', 'false')).toEqual(metadata);
    expect(editCatalogDatePart(metadata, 'issued', 0, '2006').issued).toEqual({
      ...metadata.issued,
      'date-parts': [[2006]],
    });
  }
  for (const date of [
    { 'date-parts': [['2000'], ['2001']] },
    { 'date-parts': [[1987], [0]] },
    { 'date-parts': [[1987], []] },
    { 'date-parts': [[1987]], calendar: 'hebrew' },
    { 'date-parts': [[1987]], season: 1 },
    { 'date-parts': [[1987]], raw: '春' },
  ]) {
    expect(catalogDateParts(date)).toBeUndefined();
    const metadata = { title: 'Complex', issued: date };
    expect(editCatalogDatePart(metadata, 'issued', 0, '1988')).toEqual(metadata);
    expect(editCatalogDateCirca(metadata, 'issued', 'true')).toEqual(metadata);
  }
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
  expect(catalogDateParts(original.issued)).toEqual([[2024, 2, 29]]);
  for (const date of [
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
  expect(editCatalogDatePart(original, 'accessed', 0, '2026')).toEqual(original);
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
