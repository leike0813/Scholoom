import { expect, test } from '@playwright/test';
import {
  type CatalogSelection,
  catalogSelectionOperations,
  isCatalogSelection,
  isCatalogSelectionInput,
  isVerifiedCatalogSelection,
  type VerifiedCatalogSelection,
} from '../../packages/protocol/src/catalog-selection.js';
import { compileContract } from '../../packages/protocol/src/core.js';
import {
  type ContextItem,
  isContextItems,
  isWorkbenchContextSnapshot,
  type WorkbenchContextSnapshot,
  workbenchContextInternalOperations,
} from '../../packages/protocol/src/workbench-context.js';

function selection(size: number): CatalogSelection {
  return {
    libraryId: 'library',
    range: { query: '', collectionId: null, tag: '', offset: 0, limit: 100 },
    primarySourceId: size ? 'source-0' : null,
    items: Array.from({ length: size }, (_, index) => ({
      sourceId: `source-${index}`,
      observedRevision: index,
    })),
  };
}

function verified(size: number): VerifiedCatalogSelection {
  const catalog = selection(size);
  return {
    libraryId: catalog.libraryId,
    libraryRevision: 1,
    items: catalog.items.map((item) => ({
      ...item,
      currentRevision: item.observedRevision,
      state: 'current' as const,
    })),
  };
}

function snapshot(catalog: CatalogSelection, materials = 0): WorkbenchContextSnapshot {
  const selections: ContextItem[] = Array.from({ length: materials }, (_, index) => ({
    kind: 'resource',
    itemId: `material-${index}`,
    ref: { source: 'project', projectId: 'project', fileId: `file-${index}` },
    basis: 'basis',
    comment: '',
  }));
  return {
    revision: 1,
    receiver: { projectId: 'project', sessionId: 'session' },
    viewId: 'library-view',
    selectedItems: selections.map((item) => item.itemId),
    selections,
    catalogSelection: catalog,
  };
}

test('catalog capacity is independent of explicit material capacity and optional for old snapshots', () => {
  const operation = compileContract(catalogSelectionOperations['library.selection']);
  const read = compileContract(workbenchContextInternalOperations['workbench.context.read']);
  const check = compileContract(catalogSelectionOperations['library.checkSelection']);
  expect(check.params({ libraryId: 'library' })).toBe(true);
  expect(check.result({ ok: true })).toBe(true);
  for (const size of [0, 17, 100]) {
    const catalog = selection(size);
    const input = { libraryId: catalog.libraryId, items: catalog.items };
    const result = verified(size);
    expect(isCatalogSelection(catalog)).toBe(true);
    expect(isCatalogSelectionInput(input)).toBe(true);
    expect(operation.params(input)).toBe(true);
    expect(isVerifiedCatalogSelection(result)).toBe(true);
    expect(operation.result(result)).toBe(true);
    expect(isWorkbenchContextSnapshot(snapshot(catalog, 16))).toBe(true);
    expect(
      read.result({
        state: 'available',
        instructionId: 'instruction',
        snapshot: snapshot(catalog),
        catalog: result,
      }),
    ).toBe(true);
  }
  const { catalogSelection: _catalog, ...oldSnapshot } = snapshot(selection(0), 16);
  expect(isWorkbenchContextSnapshot(oldSnapshot)).toBe(true);
  expect(read.result({ state: 'available', instructionId: 'old', snapshot: oldSnapshot })).toBe(
    true,
  );
  expect(isContextItems(snapshot(selection(0), 17).selections)).toBe(false);
  expect(isWorkbenchContextSnapshot(snapshot(selection(100), 17))).toBe(false);
});

test('catalog identities and the primary stay within the loaded page', () => {
  const catalog = selection(17);
  const duplicate = [...catalog.items, { sourceId: 'source-0', observedRevision: 99 }];
  for (const value of [
    selection(101),
    { ...selection(0), primarySourceId: 'source-0' },
    { ...catalog, primarySourceId: null },
    { ...catalog, primarySourceId: 'absent' },
    { ...catalog, items: duplicate },
    { ...catalog, range: { ...catalog.range, limit: 16 } },
  ]) {
    expect(isCatalogSelection(value)).toBe(false);
    expect(isWorkbenchContextSnapshot(snapshot(value))).toBe(false);
  }
  expect(isCatalogSelectionInput({ libraryId: 'library', items: duplicate })).toBe(false);
  expect(isCatalogSelectionInput({ libraryId: 'library', items: selection(101).items })).toBe(
    false,
  );
  expect(isCatalogSelectionInput(catalog)).toBe(false);
  expect(isCatalogSelectionInput({ libraryId: '', items: [] })).toBe(false);
  const result = verified(17);
  expect(
    isVerifiedCatalogSelection({
      ...result,
      items: [
        ...result.items,
        { sourceId: 'source-0', observedRevision: 99, currentRevision: 99, state: 'current' },
      ],
    }),
  ).toBe(false);
  expect(isVerifiedCatalogSelection(verified(101))).toBe(false);
});

test('catalog ranges and revisions reject unsafe or out-of-range values', () => {
  const catalog = selection(1);
  for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const items = [{ sourceId: 'source', observedRevision: invalid }];
    expect(isCatalogSelectionInput({ libraryId: 'library', items })).toBe(false);
    expect(isCatalogSelection({ ...catalog, items, primarySourceId: 'source' })).toBe(false);
    expect(isCatalogSelection({ ...catalog, range: { ...catalog.range, offset: invalid } })).toBe(
      false,
    );
    expect(isVerifiedCatalogSelection({ ...verified(1), libraryRevision: invalid })).toBe(false);
    expect(
      isVerifiedCatalogSelection({
        ...verified(1),
        items: [
          {
            sourceId: 'source',
            observedRevision: invalid,
            currentRevision: invalid,
            state: 'current',
          },
        ],
      }),
    ).toBe(false);
    expect(
      isVerifiedCatalogSelection({
        ...verified(1),
        items: [
          {
            sourceId: 'source',
            observedRevision: 0,
            currentRevision: invalid,
            state: 'changed',
          },
        ],
      }),
    ).toBe(false);
  }
  const items = [{ sourceId: 'source', observedRevision: Number.MAX_SAFE_INTEGER }];
  expect(isCatalogSelectionInput({ libraryId: 'library', items })).toBe(true);
  expect(
    isCatalogSelection({
      ...catalog,
      items,
      primarySourceId: 'source',
      range: {
        query: 'q'.repeat(200),
        collectionId: 'collection',
        tag: 't'.repeat(100),
        offset: Number.MAX_SAFE_INTEGER,
        limit: 1,
      },
    }),
  ).toBe(true);
  for (const range of [
    { ...catalog.range, query: 'q'.repeat(201) },
    { ...catalog.range, tag: 't'.repeat(101) },
    { ...catalog.range, collectionId: '' },
    { ...catalog.range, limit: 0 },
    { ...catalog.range, limit: 101 },
    { ...catalog.range, limit: 1.5 },
  ])
    expect(isCatalogSelection({ ...catalog, range })).toBe(false);
});

test('verified revisions determine current or changed without changing observed revisions', () => {
  const result = { libraryId: 'library', libraryRevision: 2 };
  for (const [observedRevision, currentRevision, state, valid] of [
    [0, 0, 'current', true],
    [1, 2, 'changed', true],
    [2, 1, 'changed', true],
    [1, 1, 'changed', false],
    [1, 2, 'current', false],
  ] as const) {
    expect(
      isVerifiedCatalogSelection({
        ...result,
        items: [{ sourceId: 'source', observedRevision, currentRevision, state }],
      }),
    ).toBe(valid);
  }
});

test('the complete snapshot retains its 64KiB byte budget with both contribution kinds', () => {
  const value = snapshot(selection(100), 16);
  const bytes = () => new TextEncoder().encode(JSON.stringify(value)).byteLength;
  let remaining = 65536 - bytes();
  for (const item of value.selections) {
    const size = Math.min(4096, remaining);
    item.comment = 'a'.repeat(size);
    remaining -= size;
  }
  expect(remaining).toBe(0);
  expect(bytes()).toBe(65536);
  expect(isCatalogSelection(value.catalogSelection)).toBe(true);
  expect(isContextItems(value.selections)).toBe(true);
  expect(isWorkbenchContextSnapshot(value)).toBe(true);
  const item = value.selections.find((entry) => (entry.comment?.length ?? 0) < 4096);
  expect(item).toBeDefined();
  if (!item) throw new Error('Missing space for the byte boundary sample');
  item.comment = `${item.comment ?? ''}中`;
  expect(bytes()).toBe(65539);
  expect(isContextItems(value.selections)).toBe(true);
  expect(isWorkbenchContextSnapshot(value)).toBe(false);
});
