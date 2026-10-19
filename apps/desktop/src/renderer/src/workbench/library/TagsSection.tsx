/**
 * 标签分区占位
 */
export function TagsSection({ sourceId }: { sourceId: string }) {
  return (
    <div className="catalog-section" data-section="tags" id="section-tags">
      <div className="catalog-section-header">标签</div>
      <div className="section-placeholder">
        <p>标签管理（待实现）</p>
        <p style={{ fontSize: 'var(--font-size-meta)', color: 'var(--text-tertiary)' }}>
          源 ID: {sourceId}
        </p>
      </div>
    </div>
  );
}
