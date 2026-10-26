/**
 * 条目行组件
 */
import type { LibrarySource } from '@scholoom/protocol';
import type { CatalogColumn } from './CatalogColumns';

interface CatalogItemRowProps {
  entry: LibrarySource;
  index: number;
  isSelected: boolean;
  style: React.CSSProperties;
  onSelect: (index: number, modifiers: { shift: boolean; ctrl: boolean }) => void;
  columns: CatalogColumn[];
}

export function CatalogItemRow({
  entry,
  index,
  isSelected,
  style,
  onSelect,
  columns,
}: CatalogItemRowProps) {
  const handleClick = (e: React.MouseEvent) => {
    onSelect(index, {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
    });
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
      ? ((issued['date-parts'] as any)?.[0]?.[0] ?? '')
      : '';

  const attachmentStatus =
    entry.attachmentState === 'recorded'
      ? '已有附件登记'
      : entry.attachmentState === 'unavailable'
        ? '附件未取得'
        : '';

  const candidateNote = entry.metadataOrigin === 'filename' ? ' · 待核对（文件名）' : '';

  const values = {
    title: `${entry.metadata.title}${candidateNote}`,
    creators,
    date: String(date),
    version: entry.version,
    attachment: attachmentStatus,
  };

  return (
    <div
      className={`catalog-item-row ${isSelected ? 'selected' : ''}`}
      style={style}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(index, { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey });
      }}
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`查看题录 ${entry.metadata?.title || '(无标题)'}`}
    >
      {columns
        .filter((column) => column.visible)
        .map((column) => (
          <div
            key={column.id}
            className={`catalog-cell catalog-cell-${column.id}`}
            title={values[column.id]}
            style={{ flex: `0 0 calc(var(--space-unit) * ${column.width})` }}
          >
            {values[column.id]}
          </div>
        ))}
    </div>
  );
}
