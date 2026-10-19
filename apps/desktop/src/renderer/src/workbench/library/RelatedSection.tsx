/**
 * 关联版本分区占位
 */
export function RelatedSection({ sourceId }: { sourceId: string }) {
  return (
    <div className="catalog-section" data-section="related" id="section-related">
      <div className="catalog-section-header">关联版本</div>
      <div className="section-placeholder">
        <p>关联条目（待实现）</p>
        <p style={{ fontSize: 'var(--font-size-meta)', color: 'var(--text-tertiary)' }}>
          源 ID: {sourceId}
        </p>
      </div>
    </div>
  );
}
