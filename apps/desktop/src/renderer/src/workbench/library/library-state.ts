import { readDraft } from '../drafts';
import type { CatalogSelectionState } from './CatalogSelection';

const saving = new Set<string>();
const saveListeners = new Set<() => void>();
export const librarySaves = {
  has: (key: string) => saving.has(key),
  subscribe: (listener: () => void) => {
    saveListeners.add(listener);
    return () => {
      saveListeners.delete(listener);
    };
  },
  set(key: string, active: boolean) {
    if (active) saving.add(key);
    else saving.delete(key);
    for (const listener of saveListeners) listener();
  },
};

export function readLibraryNavigation(key: string) {
  try {
    const value = JSON.parse(readDraft(key));
    if (
      typeof value?.query === 'string' &&
      typeof value.collectionId === 'string' &&
      typeof value.tag === 'string' &&
      Array.isArray(value.offsets) &&
      value.offsets.length &&
      value.offsets.every((offset: unknown) => Number.isSafeInteger(offset) && Number(offset) >= 0)
    )
      return value as { query: string; collectionId: string; tag: string; offsets: number[] };
  } catch {
    /* A damaged preference must not hide the library. */
  }
  return { query: '', collectionId: '', tag: '', offsets: [0] };
}

export function readLibrarySelection(key: string): CatalogSelectionState | undefined {
  try {
    const value = JSON.parse(readDraft(key));
    if (
      Array.isArray(value?.selectedIds) &&
      value.selectedIds.length <= 100 &&
      value.selectedIds.every((id: unknown) => typeof id === 'string') &&
      (value.primaryId === null || value.selectedIds.includes(value.primaryId)) &&
      (value.anchorId === null || typeof value.anchorId === 'string')
    )
      return value;
  } catch {
    /* Selection is restored only from a valid identity snapshot. */
  }
  return undefined;
}
