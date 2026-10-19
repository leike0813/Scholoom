/**
 * 条目行组件
 */
import type { LibrarySource } from '@scholoom/protocol';

interface CatalogItemRowProps {
  entry: LibrarySource;
  index: number;
  isSelected: boolean;
  style: React.CSSProperties;
  onSelect: (index: number, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onDoubleClick: (entry: LibrarySource) => void;
}

export function CatalogItemRow({
  entry,
  index,
  isSelected,
  style,
  onSelect,
  onDoubleClick,
}: CatalogItemRowProps) {
  const handleClick = (e: React.MouseEvent) => {
    onSelect(index, {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
    });
  };

  const handleDoubleClick = () => {
    onDoubleClick(entry);
  };

  const creators =
    entry.metadata?.author && Array.isArray(entry.metadata.author)
      ? entry.metadata.author
          .map((a: any) => a.family || a.literal)
          .filter(Boolean)
          .join(', ')
      : '';

  const issued = entry.metadata?.issued;
  const date =
    issued && typeof issued === 'object' && 'date-parts' in issued
      ? (issued['date-parts'] as any)?.[0]?.[0] ?? ''
      : '';

  const attachmentStatus =
    entry.attachmentState === 'recorded' ? '已有附件' : entry.attachmentState === 'unavailable' ? '附件未取得' : '';

  const candidateNote = entry.metadataOrigin === 'filename' ? ' · 待核对（文件名）' : '';

  return (
    <div
      className={`catalog-item-row ${isSelected ? 'selected' : ''}`}
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="row"
      aria-selected={isSelected}
      aria-label={`${entry.metadata?.title || '(无标题)'} by ${creators || '(无作者)'}`}
    >
      <div className="catalog-cell catalog-cell-title" title={entry.metadata?.title}>
        {entry.metadata?.title || '(无标题)'}
        {candidateNote}
      </div>
      <div className="catalog-cell catalog-cell-creators" title={creators}>
        {creators}
      </div>
      <div className="catalog-cell catalog-cell-date">{date}</div>
      <div className="catalog-cell catalog-cell-version">{entry.version}</div>
      <div className="catalog-cell catalog-cell-attachment">{attachmentStatus}</div>
    </div>
  );
}
