/**
 * 虚拟化条目列表
 */
import type { LibrarySource } from '@scholoom/protocol';
import { useCallback, useEffect, useRef } from 'react';
import { useVirtualizedList } from '../useVirtualizedList';
import { CatalogItemRow } from './CatalogItemRow';
import type { CatalogSelection } from './CatalogSelection';

const ROW_HEIGHT = 28;

interface CatalogItemListProps {
  entries: LibrarySource[];
  selection: CatalogSelection;
  onDoubleClick: (entry: LibrarySource) => void;
}

export function CatalogItemList({ entries, selection, onDoubleClick }: CatalogItemListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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
      const focused = Array.from(selection.selectedIndices)[0] ?? -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(focused + 1, entries.length - 1);
        selection.clear();
        selection.toggle(nextIndex);
        scrollToIndex(nextIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(focused - 1, 0);
        selection.clear();
        selection.toggle(prevIndex);
        scrollToIndex(prevIndex);
      } else if (e.key === 'Home') {
        e.preventDefault();
        selection.clear();
        selection.toggle(0);
        scrollToIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        const lastIndex = entries.length - 1;
        selection.clear();
        selection.toggle(lastIndex);
        scrollToIndex(lastIndex);
      }
    },
    [entries.length, selection, scrollToIndex],
  );

  // 首次加载聚焦
  useEffect(() => {
    if (entries.length > 0 && containerRef.current) {
      containerRef.current.focus();
    }
  }, [entries.length]);

  const handleSelect = (index: number, modifiers: { shift: boolean; ctrl: boolean }) => {
    if (modifiers.shift) {
      selection.shiftSelect(index);
    } else if (modifiers.ctrl) {
      selection.toggle(index);
    } else {
      selection.clear();
      selection.toggle(index);
    }
  };

  const totalHeight = entries.length * ROW_HEIGHT;
  const visibleEntries = entries.slice(startIndex, endIndex + 1);

  return (
    <div className="catalog-item-list-container">
      <div className="catalog-item-list-header">
        <div className="catalog-cell catalog-cell-title">题名</div>
        <div className="catalog-cell catalog-cell-creators">作者</div>
        <div className="catalog-cell catalog-cell-date">年份</div>
        <div className="catalog-cell catalog-cell-version">版本</div>
        <div className="catalog-cell catalog-cell-attachment">附件</div>
      </div>
      <div
        ref={containerRef}
        className="catalog-item-list-body"
        role="listbox"
        tabIndex={0}
        aria-label="题录列表"
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
                isSelected={selection.isSelected(index)}
                style={{
                  position: 'absolute',
                  top: `${top}px`,
                  left: 0,
                  right: 0,
                  height: `${ROW_HEIGHT}px`,
                }}
                onSelect={handleSelect}
                onDoubleClick={onDoubleClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
