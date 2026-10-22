import {
  type ContextItem,
  contextLimits,
  isContextItems,
  isWorkbenchContextSnapshot,
  type WorkbenchContextSnapshot,
} from '@scholoom/protocol';
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface ContextSelection {
  selectedItems?: readonly string[];
  selections: readonly ContextItem[];
}

export interface ContextContributionProviderProps {
  children: ReactNode;
  items?: readonly ContextItem[] | undefined;
  appendContextItem?: ((item: ContextItem) => void) | undefined;
  removeContextItem?: ((itemId: string) => void) | undefined;
  updateContextComment?: ((itemId: string, comment: string) => void) | undefined;
  contextError?: string | undefined;
  publishContext?: ((snapshot: WorkbenchContextSnapshot | null) => void) | undefined;
  receiver?: { projectId: string; sessionId: string } | null | undefined;
  activeViewId?: string | null | undefined;
}

export interface ContextContribution {
  items: readonly ContextItem[];
  contextError?: string | undefined;
  available: boolean;
  appendContextItem(item: ContextItem): void;
  removeContextItem(itemId: string): void;
  updateContextComment(itemId: string, comment: string): void;
  contributeSelection(viewId: string, selection?: ContextSelection): void;
}

const empty: ContextContribution = {
  items: [],
  available: false,
  appendContextItem: () => {},
  removeContextItem: () => {},
  updateContextComment: () => {},
  contributeSelection: () => {},
};
const ContributionContext = createContext<ContextContribution>(empty);

export function useContextContribution(): ContextContribution {
  return useContext(ContributionContext);
}

function selectedIds(selection: ContextSelection): string[] {
  return [...new Set(selection.selectedItems ?? selection.selections.map((item) => item.itemId))];
}

function sameSelection(left: ContextSelection, right: ContextSelection): boolean {
  return (
    JSON.stringify(selectedIds(left)) === JSON.stringify(selectedIds(right)) &&
    JSON.stringify(left.selections) === JSON.stringify(right.selections)
  );
}

export function ContextContributionProvider({
  children,
  items = empty.items,
  appendContextItem,
  removeContextItem = empty.removeContextItem,
  updateContextComment = empty.updateContextComment,
  contextError,
  publishContext,
  receiver = null,
  activeViewId = null,
}: ContextContributionProviderProps): ReactElement {
  const [selections, setSelections] = useState<ReadonlyMap<string, ContextSelection>>(new Map());
  const [selectionError, setSelectionError] = useState<string>();
  const revision = useRef(0);
  const publish = useRef(publishContext);
  publish.current = publishContext;
  const publisher = useRef(publishContext);
  const receiverRef = useRef(receiver);
  receiverRef.current = receiver;
  const activeView = useRef(activeViewId);
  activeView.current = activeViewId;
  const published = useRef<string | undefined>(undefined);
  const receiverKey = receiver ? JSON.stringify([receiver.projectId, receiver.sessionId]) : '';

  useEffect(() => {
    const send = publishContext;
    if (!send) return;
    const selection = activeViewId ? selections.get(activeViewId) : undefined;
    const ids = selection ? selectedIds(selection) : [];
    const signature =
      activeViewId && selection
        ? JSON.stringify([activeViewId, receiverKey, ids, selection.selections])
        : JSON.stringify([activeViewId, receiverKey]);
    const publisherChanged = publisher.current !== publishContext;
    publisher.current = publishContext;
    if (!publisherChanged && published.current === signature) return;
    published.current = signature;
    if (!activeViewId || !selection || (!ids.length && !selection.selections.length)) {
      send(null);
      return;
    }
    const snapshot: WorkbenchContextSnapshot = {
      revision: revision.current + 1,
      receiver: receiverRef.current,
      viewId: activeViewId,
      selectedItems: ids,
      selections: [...selection.selections],
    };
    if (!isContextItems(snapshot.selections) || !isWorkbenchContextSnapshot(snapshot)) {
      setSelectionError('当前选择超出容量或不符合契约，未发布。');
      send(null);
      return;
    }
    revision.current = snapshot.revision;
    setSelectionError((current) => (current === undefined ? current : undefined));
    send(snapshot);
  }, [activeViewId, receiverKey, selections, publishContext]);

  useEffect(
    () => () => {
      publish.current?.(null);
    },
    [],
  );

  const contributeSelection = useCallback((viewId: string, selection?: ContextSelection) => {
    if (
      selection &&
      (!isContextItems(selection.selections) ||
        selectedIds(selection).length > contextLimits.selectedItems)
    ) {
      setSelectionError('当前选择超出容量或不符合契约，未发布。');
      published.current = undefined;
      setSelections((current) => {
        if (!current.has(viewId)) return current;
        const next = new Map(current);
        next.delete(viewId);
        return next;
      });
      return;
    }
    setSelections((current) => {
      const previous = current.get(viewId);
      if (!selection) {
        if (!previous) return current;
        const next = new Map(current);
        next.delete(viewId);
        return next;
      }
      if (previous && sameSelection(previous, selection)) return current;
      return new Map(current).set(viewId, selection);
    });
    if (!selection || activeView.current === viewId) setSelectionError(undefined);
  }, []);

  const value = useMemo<ContextContribution>(
    () => ({
      items,
      ...(selectionError || contextError ? { contextError: selectionError || contextError } : {}),
      available: appendContextItem !== undefined,
      appendContextItem: appendContextItem ?? empty.appendContextItem,
      removeContextItem,
      updateContextComment,
      contributeSelection,
    }),
    [
      items,
      selectionError,
      contextError,
      appendContextItem,
      removeContextItem,
      updateContextComment,
      contributeSelection,
    ],
  );

  return <ContributionContext.Provider value={value}>{children}</ContributionContext.Provider>;
}
