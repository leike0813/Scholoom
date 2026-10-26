import { isCatalogSelection } from './catalog-selection.js';
import { compileContract } from './core.js';
import type { workbenchContextContracts } from './workbench-context-contracts.js';
import {
  type ContextItem,
  contextItemsSchema,
  contextLimits,
  type WorkbenchContextSnapshot,
  workbenchContextSnapshotSchema,
} from './workbench-context-contracts.js';
import type { Inputs, Outputs } from './workbench-context-types.js';

export * from './workbench-context-contracts.js';
export * from './workbench-source.js';

type Complete<T extends Record<keyof typeof workbenchContextContracts, unknown>> = T;
export type WorkbenchContextInputs = Complete<Inputs>;
export type WorkbenchContextOutputs = Complete<Outputs>;

const itemValidator = compileContract({ params: contextItemsSchema, result: true }).params;
const snapshotValidator = compileContract({
  params: workbenchContextSnapshotSchema,
  result: true,
}).params;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
export function isContextItems(value: unknown): value is ContextItem[] {
  if (!itemValidator(value)) return false;
  const items = value as ContextItem[];
  return (
    bytes(items) <= contextLimits.bodyBytes &&
    new Set(items.map((item) => item.itemId)).size === items.length &&
    items.every(
      (item) =>
        (item.comment?.length ?? 0) <= contextLimits.commentUnits &&
        (item.kind !== 'text' || item.quote.length <= contextLimits.excerptUnits) &&
        (item.kind !== 'text' ||
          !item.location ||
          !('kind' in item.location) ||
          item.location.end > item.location.start) &&
        (item.kind !== 'object' || item.semantics.length <= contextLimits.excerptUnits),
    ) &&
    items.every(
      (item) =>
        item.kind !== 'region' ||
        (item.region.x + item.region.width <= 1 && item.region.y + item.region.height <= 1),
    )
  );
}
export function isWorkbenchContextSnapshot(value: unknown): value is WorkbenchContextSnapshot {
  if (!snapshotValidator(value)) return false;
  const snapshot = value as WorkbenchContextSnapshot;
  return (
    bytes(snapshot) <= contextLimits.bodyBytes &&
    isContextItems(snapshot.selections) &&
    (snapshot.catalogSelection === undefined || isCatalogSelection(snapshot.catalogSelection))
  );
}
