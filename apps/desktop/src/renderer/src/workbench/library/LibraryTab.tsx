/**
 * 文献库 Tab 主容器
 * 两栏布局：条目列表 + 详情面板
 */
import type { KernelClient } from '@scholoom/client';
import type { LibrarySource } from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CatalogItemList } from './CatalogItemList';
import { CatalogItemPane } from './CatalogItemPane';
import { CatalogSelection } from './CatalogSelection';
import { LibraryToolbar } from './LibraryToolbar';
import type { VersionFilter } from './VersionFilter';

const PAGE_SIZE = 25; // comfortable

interface LibraryTabProps {
  client: KernelClient;
  enabled: boolean;
  onOpenPdf?: ((material: any) => void) | undefined;
}

export function LibraryTab({ client, enabled, onOpenPdf }: LibraryTabProps) {
  const [entries, setEntries] = useState<LibrarySource[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [versionFilter, setVersionFilter] = useState<VersionFilter>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LibrarySource | null>(null);

  const selectionRef = useRef<CatalogSelection | null>(null);
  if (!selectionRef.current) {
    selectionRef.current = new CatalogSelection((selected) => {
      // 选择变化：加载首个选中条目的详情
      const indices = Array.from(selected);
      if (indices.length > 0) {
        const firstIndex = indices[0];
        if (firstIndex !== undefined && entries[firstIndex]) {
          setSelectedEntry(entries[firstIndex]!);
        }
      } else {
        setSelectedEntry(null);
      }
    });
  }
  const selection = selectionRef.current;

  const loadPage = useCallback(
    async (page: number, query: string, collections: string[], version: VersionFilter) => {
      if (!enabled) return;
      setLoading(true);
      setError('');
      try {
        const result = await client.call('library.list', {
          offset: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
          ...(query ? { query } : {}),
          ...(collections.length > 0 ? { collections } : {}),
          ...(version === 'latest' ? { latestOnly: true } : {}),
        });
        setEntries(result.sources);
        // 计算总数：使用 sources.length，实际 API 可能返回 nextOffset
        setTotalCount(result.sources.length + (page - 1) * PAGE_SIZE);
        setCurrentPage(page);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    },
    [client, enabled],
  );

  // 初始加载
  useEffect(() => {
    if (enabled) {
      void loadPage(1, searchQuery, selectedCollections, versionFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 搜索防抖 300ms
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        void loadPage(1, query, selectedCollections, versionFilter);
      }, 300);
    },
    [loadPage, selectedCollections, versionFilter],
  );

  const handleCollectionsChange = useCallback(
    (collections: string[]) => {
      setSelectedCollections(collections);
      void loadPage(1, searchQuery, collections, versionFilter);
    },
    [loadPage, searchQuery, versionFilter],
  );

  const handleVersionFilterChange = useCallback(
    (filter: VersionFilter) => {
      setVersionFilter(filter);
      void loadPage(1, searchQuery, selectedCollections, filter);
    },
    [loadPage, searchQuery, selectedCollections],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      void loadPage(page, searchQuery, selectedCollections, versionFilter);
    },
    [loadPage, searchQuery, selectedCollections, versionFilter],
  );

  const handleDoubleClick = useCallback(
    (entry: LibrarySource) => {
      // 双击打开首个附件（未来实现）
      console.log('Double click:', entry.id);
    },
    [],
  );

  const handleNewEntry = useCallback(() => {
    // 打开新建题录表单（未来实现）
    console.log('New entry');
  }, []);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!enabled) {
    return (
      <div className="library-tab-disabled">
        <p>文献库功能需要权限授权</p>
      </div>
    );
  }

  return (
    <div className="library-tab">
      <LibraryToolbar
        client={client}
        enabled={enabled}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedCollections={selectedCollections}
        onCollectionsChange={handleCollectionsChange}
        versionFilter={versionFilter}
        onVersionFilterChange={handleVersionFilterChange}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onNewEntry={handleNewEntry}
      />
      {error && <div className="library-error" role="alert">{error}</div>}
      {loading && <div className="library-loading">加载中...</div>}
      <div className="library-content">
        <div className="library-list-pane">
          <CatalogItemList entries={entries} selection={selection} onDoubleClick={handleDoubleClick} />
        </div>
        <div className="library-detail-pane">
          <CatalogItemPane entry={selectedEntry} />
        </div>
      </div>
    </div>
  );
}
