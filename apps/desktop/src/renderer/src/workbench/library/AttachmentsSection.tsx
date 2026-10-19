/**
 * 附件分区占位
 */
export function AttachmentsSection({ sourceId }: { sourceId: string }) {
  return (
    <div className="catalog-section" data-section="attachments" id="section-attachments">
      <div className="catalog-section-header">附件</div>
      <div className="section-placeholder">
        <p>附件列表（待实现）</p>
        <p style={{ fontSize: 'var(--font-size-meta)', color: 'var(--text-tertiary)' }}>
          源 ID: {sourceId}
        </p>
      </div>
    </div>
  );
}
