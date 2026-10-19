/**
 * 文献库工具栏
 */
import type { KernelClient } from '@scholoom/client';
import { CollectionFilter } from './CollectionFilter';
import { VersionFilterDropdown, type VersionFilter } from './VersionFilter';

interface LibraryToolbarProps {
  client: KernelClient;
  enabled: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCollections: string[];
  onCollectionsChange: (collections: string[]) => void;
  versionFilter: VersionFilter;
  onVersionFilterChange: (filter: VersionFilter) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onNewEntry: () => void;
}

export function LibraryToolbar({
  client,
  enabled,
  searchQuery,
  onSearchChange,
  selectedCollections,
  onCollectionsChange,
  versionFilter,
  onVersionFilterChange,
  currentPage,
  totalPages,
  onPageChange,
  onNewEntry,
}: LibraryToolbarProps) {
  return (
    <div className="library-toolbar">
      <input
        type="text"
        className="library-search"
        placeholder="查找题录"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="查找题录"
      />
      <CollectionFilter
        client={client}
        enabled={enabled}
        selectedCollections={selectedCollections}
        onSelectionChange={onCollectionsChange}
      />
      <VersionFilterDropdown value={versionFilter} onChange={onVersionFilterChange} />
      <div className="library-pagination">
        <button
          className="btn btn-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="上一页"
        >
          ◀
        </button>
        <span className="pagination-info">
          {currentPage} / {totalPages || 1}
        </span>
        <button
          className="btn btn-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="下一页"
        >
          ▶
        </button>
      </div>
      <button className="btn btn-sm" onClick={onNewEntry} aria-label="新建题录">
        + 新建题录
      </button>
    </div>
  );
}
