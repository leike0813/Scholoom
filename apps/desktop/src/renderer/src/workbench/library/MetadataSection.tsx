/**
 * 元数据分区
 * CSL JSON 编辑表单
 */
import type { LibrarySource } from '@scholoom/protocol';
import { useId, useState } from 'react';

interface MetadataSectionProps {
  entry: LibrarySource;
  onUpdate?: (metadata: any) => Promise<void>;
}

export function MetadataSection({ entry, onUpdate }: MetadataSectionProps) {
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [metadata, setMetadata] = useState(entry.metadata);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(metadata);
      setEditing(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const creators =
    metadata?.author && Array.isArray(metadata.author)
      ? metadata.author
          .map((a: any) => {
            if (a.family && a.given) return `${a.family}, ${a.given}`;
            if (a.family) return a.family;
            if (a.literal) return a.literal;
            return '';
          })
          .filter(Boolean)
          .join('; ')
      : '';

  const issued = metadata?.issued;
  const date =
    issued && typeof issued === 'object' && 'date-parts' in issued
      ? ((issued['date-parts'] as any)?.[0]?.join('-') ?? '')
      : '';

  return (
    <div className="catalog-section" data-section="metadata" id="section-metadata">
      <div className="catalog-section-header">
        <span>题录信息</span>
        {!editing && onUpdate && (
          <button type="button" className="btn-link" onClick={() => setEditing(true)}>
            编辑
          </button>
        )}
      </div>
      {editing ? (
        <div className="metadata-edit-form">
          <div className="form-row">
            <label htmlFor={`${fieldId}-title`}>标题</label>
            <input
              id={`${fieldId}-title`}
              type="text"
              value={metadata?.title || ''}
              onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${fieldId}-type`}>类型</label>
            <input
              id={`${fieldId}-type`}
              type="text"
              value={metadata?.type || ''}
              onChange={(e) => setMetadata({ ...metadata, type: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${fieldId}-doi`}>DOI</label>
            <input
              id={`${fieldId}-doi`}
              type="text"
              value={metadata?.DOI || ''}
              onChange={(e) => setMetadata({ ...metadata, DOI: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
              取消
            </button>
            <button type="button" className="btn btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div className="metadata-grid">
          <div className="metadata-label">标题</div>
          <div className="metadata-value">{metadata?.title || '(无)'}</div>

          <div className="metadata-label">作者</div>
          <div className="metadata-value">{creators || '(无)'}</div>

          <div className="metadata-label">日期</div>
          <div className="metadata-value">{date || '(无)'}</div>

          <div className="metadata-label">类型</div>
          <div className="metadata-value">{metadata?.type || '(无)'}</div>

          {metadata?.DOI && (
            <>
              <div className="metadata-label">DOI</div>
              <div className="metadata-value">{metadata.DOI}</div>
            </>
          )}

          {metadata?.URL && (
            <>
              <div className="metadata-label">URL</div>
              <div className="metadata-value">
                <a href={metadata.URL} target="_blank" rel="noopener noreferrer">
                  {metadata.URL}
                </a>
              </div>
            </>
          )}

          <div className="metadata-label">版本</div>
          <div className="metadata-value">{entry.version}</div>

          <div className="metadata-label">ID</div>
          <div className="metadata-value" style={{ fontSize: 'var(--font-size-meta)' }}>
            {entry.id}
          </div>
        </div>
      )}
    </div>
  );
}
