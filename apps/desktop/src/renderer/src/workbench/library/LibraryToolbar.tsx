import type { LibraryCollection } from '@scholoom/protocol';

interface LibraryToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  collectionId: string;
  collections: LibraryCollection[];
  onCollectionChange: (value: string) => void;
  tag: string;
  onTagChange: (value: string) => void;
  currentPage: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onNewEntry: () => void;
  readable: boolean;
}

export function LibraryToolbar(props: LibraryToolbarProps) {
  return (
    <div className="library-toolbar">
      <input
        type="search"
        className="library-search"
        placeholder="查找题录"
        aria-label="查找题录"
        maxLength={200}
        value={props.query}
        onChange={(event) => props.onQueryChange(event.target.value)}
      />
      <select
        aria-label="按集合筛选"
        value={props.collectionId}
        onChange={(event) => props.onCollectionChange(event.target.value)}
      >
        <option value="">全部集合</option>
        {props.collectionId && !props.collections.some((item) => item.id === props.collectionId) ? (
          <option value={props.collectionId}>当前集合</option>
        ) : null}
        {props.collections.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <input
        aria-label="按标签筛选"
        placeholder="标签"
        maxLength={100}
        value={props.tag}
        onChange={(event) => props.onTagChange(event.target.value)}
      />
      <div className="library-pagination">
        <button
          type="button"
          className="btn btn-sm"
          disabled={!props.readable || props.currentPage <= 1}
          aria-label="上一页题录"
          onClick={props.onPrevious}
        >
          ◀
        </button>
        <span className="pagination-info">第 {props.currentPage} 页</span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!props.readable || !props.hasNext}
          aria-label="下一页题录"
          onClick={props.onNext}
        >
          ▶
        </button>
      </div>
      <button type="button" className="btn btn-sm" aria-label="新建题录" onClick={props.onNewEntry}>
        + 新建题录
      </button>
    </div>
  );
}
