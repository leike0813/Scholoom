/**
 * 虚拟化条目列表
 */
import type { LibrarySource } from '@scholoom/protocol';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { draftKey, readDraft, writeDraft } from '../drafts';
import { useVirtualizedList } from '../useVirtualizedList';
import { CatalogColumns, readCatalogColumns } from './CatalogColumns';
import { CatalogItemRow } from './CatalogItemRow';
import type { CatalogSelection } from './CatalogSelection';

const ROW_HEIGHT = 28;

interface CatalogItemListProps {
  entries: LibrarySource[];
  selection: CatalogSelection;
  scope: string;
  rangeKey: string;
}

export function CatalogItemList({ entries, selection, scope, rangeKey }: CatalogItemListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = useSyncExternalStore(selection.subscribe, selection.getSnapshot);
  const [columns, setColumns] = useState(() => readCatalogColumns(draftKey(scope, 'columns')));
  const visibleIds = entries.map((entry) => entry.id);
  const restoredRange = useRef<string | null>(null);
  const scrollRange = entries.length ? rangeKey : null;
  useEffect(() => {
    restoredRange.current = null;
    if (!scrollRange) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = Number(readDraft(draftKey(scrollRange, 'scroll'))) || 0;
    const frame = requestAnimationFrame(() => {
      restoredRange.current = scrollRange;
    });
    return () => {
      cancelAnimationFrame(frame);
      restoredRange.current = null;
    };
  }, [scrollRange]);

  const { visibleRange, offsetTop, scrollToIndex } = useVirtualizedList(entries.length, {
    rowHeight: ROW_HEIGHT,
    overscanCount: 2,
    containerRef,
  });

  const [startIndex, endIndex] = visibleRange;

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (entries.length === 0) return;
      const focused = entries.findIndex((entry) => entry.id === selected.primaryId);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selection.selectAll(visibleIds);
        return;
      }
      let index: number;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        index = Math.min(focused + 1, entries.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        index = Math.max(focused - 1, 0);
      } else if (e.key === 'Home') {
        e.preventDefault();
        index = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        index = entries.length - 1;
      } else return;
      const entry = entries[index];
      if (entry) selection.select(entry.id, { range: e.shiftKey }, visibleIds);
      scrollToIndex(index);
    },
    [entries, selected.primaryId, selection, scrollToIndex, visibleIds],
  );

  const handleSelect = (index: number, modifiers: { shift: boolean; ctrl: boolean }) => {
    const entry = entries[index];
    if (entry)
      selection.select(entry.id, { range: modifiers.shift, toggle: modifiers.ctrl }, visibleIds);
  };

  const totalHeight = entries.length * ROW_HEIGHT;
  const visibleEntries = entries.slice(startIndex, endIndex + 1);

  return (
    <div className="catalog-item-list-container">
      <CatalogColumns
        columns={columns}
        onChange={(next) => {
          setColumns(next);
          writeDraft(draftKey(scope, 'columns'), JSON.stringify(next));
        }}
      />
      <p role="status" aria-label="题录选择" className="catalog-selection-summary">
        已选 {selected.selectedIds.filter((id) => visibleIds.includes(id)).length} 项
        {selected.primaryId && visibleIds.includes(selected.primaryId)
          ? ` · 主选 ${entries.find((entry) => entry.id === selected.primaryId)?.metadata.title}`
          : ''}
      </p>
      <div
        className="catalog-table-scroll"
        style={
          {
            '--catalog-width': `calc(var(--space-unit) * ${columns.filter((column) => column.visible).reduce((sum, column) => sum + column.width, 6)})`,
          } as CSSProperties
        }
      >
        <div className="catalog-item-list-header">
          {columns
            .filter((column) => column.visible)
            .map((column) => (
              <div
                key={column.id}
                className={`catalog-cell catalog-cell-${column.id}`}
                style={{ flex: `0 0 calc(var(--space-unit) * ${column.width})` }}
              >
                {column.label}
              </div>
            ))}
        </div>
        <div
          ref={containerRef}
          className="catalog-item-list-body"
          role="listbox"
          tabIndex={0}
          aria-label="题录列表"
          aria-multiselectable="true"
          onScroll={(event) => {
            if (entries.length && restoredRange.current === rangeKey)
              writeDraft(draftKey(rangeKey, 'scroll'), String(event.currentTarget.scrollTop));
          }}
          onKeyDown={handleKeyDown}
        >
          <div style={{ position: 'relative', height: `${totalHeight}px` }}>
            {visibleEntries.map((entry, i) => {
              const index = startIndex + i;
              const top = offsetTop(index);
              return (
                <CatalogItemRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  isSelected={selected.selectedIds.includes(entry.id)}
                  columns={columns}
                  style={{
                    position: 'absolute',
                    top: `${top}px`,
                    left: 0,
                    right: 0,
                    height: `${ROW_HEIGHT}px`,
                  }}
                  onSelect={handleSelect}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
