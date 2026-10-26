import type { FromSchema } from 'json-schema-to-ts';
import { compileContract } from './core.js';
import { count, id, object, ok, page } from './schema.js';

const safeCount = { ...count, maximum: Number.MAX_SAFE_INTEGER } as const;
const selectionItem = object({ sourceId: id, observedRevision: safeCount }, [
  'sourceId',
  'observedRevision',
]);
const selectionItems = { type: 'array', items: selectionItem, maxItems: 100 } as const;

export const catalogSelectionInputSchema = object({ libraryId: id, items: selectionItems }, [
  'libraryId',
  'items',
]);
export const catalogSelectionSchema = object(
  {
    ...catalogSelectionInputSchema.properties,
    range: object(
      {
        query: { type: 'string', maxLength: 200 },
        collectionId: { anyOf: [id, { type: 'null' }] },
        tag: { type: 'string', maxLength: 100 },
        offset: safeCount,
        limit: page,
      },
      ['query', 'collectionId', 'tag', 'offset', 'limit'],
    ),
    primarySourceId: { anyOf: [id, { type: 'null' }] },
  },
  ['libraryId', 'range', 'primarySourceId', 'items'],
);
export const verifiedCatalogSelectionSchema = object(
  {
    libraryId: id,
    libraryRevision: safeCount,
    items: {
      ...selectionItems,
      items: object(
        {
          ...selectionItem.properties,
          currentRevision: safeCount,
          state: { enum: ['current', 'changed'] },
        },
        ['sourceId', 'observedRevision', 'currentRevision', 'state'],
      ),
    },
  },
  ['libraryId', 'libraryRevision', 'items'],
);

export const catalogSelectionOperations = {
  'library.selection': {
    params: catalogSelectionInputSchema,
    result: verifiedCatalogSelectionSchema,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
  'library.checkSelection': {
    params: object({ libraryId: id }, ['libraryId']),
    result: ok,
    semantics: { effect: 'read', returns: 'result', waitMs: 5000 },
  },
} as const;
export const librarySelectionOperation = catalogSelectionOperations['library.selection'];
export const libraryCheckSelectionOperation = catalogSelectionOperations['library.checkSelection'];

export type CatalogSelectionInput = FromSchema<typeof catalogSelectionInputSchema>;
export type CatalogSelection = FromSchema<typeof catalogSelectionSchema>;
export type VerifiedCatalogSelection = FromSchema<typeof verifiedCatalogSelectionSchema>;

const inputValidator = compileContract(librarySelectionOperation).params;
const selectionValidator = compileContract({
  params: catalogSelectionSchema,
  result: verifiedCatalogSelectionSchema,
});
const uniqueSources = (items: readonly { sourceId: string }[]): boolean =>
  new Set(items.map((item) => item.sourceId)).size === items.length;

export function isCatalogSelectionInput(value: unknown): value is CatalogSelectionInput {
  return inputValidator(value) && uniqueSources((value as CatalogSelectionInput).items);
}

export function isCatalogSelection(value: unknown): value is CatalogSelection {
  if (!selectionValidator.params(value)) return false;
  const selection = value as CatalogSelection;
  return (
    uniqueSources(selection.items) &&
    selection.items.length <= selection.range.limit &&
    (selection.items.length === 0
      ? selection.primarySourceId === null
      : selection.items.some((item) => item.sourceId === selection.primarySourceId))
  );
}

export function isVerifiedCatalogSelection(value: unknown): value is VerifiedCatalogSelection {
  if (!selectionValidator.result(value)) return false;
  const selection = value as VerifiedCatalogSelection;
  return (
    uniqueSources(selection.items) &&
    selection.items.every(
      (item) =>
        item.state === (item.observedRevision === item.currentRevision ? 'current' : 'changed'),
    )
  );
}
