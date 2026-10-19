/**
 * 虚拟化列表 hook
 * 参考 Zotero windowed-list.js：固定行可见区与有限overscan。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

interface VirtualizedListOptions {
  rowHeight: number;
  overscanCount?: number;
  containerRef: React.RefObject<HTMLElement | null>;
}

interface VirtualizedListResult {
  visibleRange: [number, number];
  totalHeight: number;
  offsetTop: (index: number) => number;
  scrollToIndex: (index: number) => void;
}

/**
 * 二分查找：返回 offsets[i] <= value 的最大 i
 */
function binarySearch(offsets: number[], value: number): number {
  if (offsets.length === 0) return 0;
  let left = 0;
  let right = offsets.length - 1;
  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    if (offsets[mid]! <= value) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }
  return left;
}

export function useVirtualizedList(
  itemCount: number,
  options: VirtualizedListOptions,
): VirtualizedListResult {
  const { rowHeight, overscanCount = 2, containerRef } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // 行高前缀和：offsets[i] 是第 i 行的起始 y 坐标
  const offsets = useMemo(() => {
    const result: number[] = [0];
    for (let i = 0; i < itemCount; i++) {
      const lastValue = result[i];
      if (lastValue !== undefined) {
        result.push(lastValue + rowHeight);
      }
    }
    return result;
  }, [itemCount, rowHeight]);

  const totalHeight = itemCount > 0 && offsets.length > itemCount ? offsets[itemCount]! : 0;

  // 可见区二分 + overscan
  const visibleRange = useMemo((): [number, number] => {
    if (containerHeight === 0 || itemCount === 0) return [0, 0];
    const startIndex = Math.max(0, binarySearch(offsets, scrollTop) - overscanCount);
    const endIndex = Math.min(
      itemCount - 1,
      binarySearch(offsets, scrollTop + containerHeight) + overscanCount,
    );
    return [startIndex, endIndex];
  }, [scrollTop, containerHeight, offsets, itemCount, overscanCount]);

  const offsetTop = useCallback(
    (index: number) => {
      if (index < 0 || index >= offsets.length) return 0;
      return offsets[index]!;
    },
    [offsets],
  );

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container || index < 0 || index >= offsets.length) return;
      const top = offsets[index]!;
      if (top < container.scrollTop) container.scrollTop = top;
      else if (top + rowHeight > container.scrollTop + container.clientHeight)
        container.scrollTop = top + rowHeight - container.clientHeight;
    },
    [containerRef, offsets, rowHeight],
  );

  // 滚动监听
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setContainerHeight(container.clientHeight);
    };

    handleResize();
    container.addEventListener('scroll', handleScroll, { passive: true });
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [containerRef]);

  return {
    visibleRange,
    totalHeight,
    offsetTop,
    scrollToIndex,
  };
}
