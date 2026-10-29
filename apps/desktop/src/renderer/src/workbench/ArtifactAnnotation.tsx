import type { ContextItem } from '@scholoom/protocol';
import { useState } from 'react';
import { ContextItemLocation } from './ContextItemLocation';
import { useContextContribution } from './context-contributions';
import { resourceSourceLabels } from './resource-controller';

export function CommentEditor({ item, label = '材料批注' }: { item: ContextItem; label?: string }) {
  const { updateContextComment } = useContextContribution();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
      批注
      <textarea
        aria-label={label}
        value={item.comment ?? ''}
        onChange={(event) => updateContextComment(item.itemId, event.target.value)}
        style={{
          color: 'var(--text-primary)',
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-sm)',
          font: 'inherit',
          resize: 'vertical',
        }}
      />
    </label>
  );
}

export function ArtifactAnnotation({
  item,
  disabled = false,
}: {
  item: ContextItem | undefined;
  disabled?: boolean;
}) {
  const context = useContextContribution();
  const [itemId, setItemId] = useState<string>();
  const attached = context.items.find((candidate) => candidate.itemId === itemId);
  if (!context.available) return null;
  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={disabled || !item}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (!item || disabled) return;
          const snapshot = { ...item, itemId: crypto.randomUUID() };
          if (context.appendContextItems([snapshot])) setItemId(snapshot.itemId);
        }}
      >
        批注
      </button>
      {attached ? (
        <section
          aria-label="材料批注"
          className="source-editor-tools"
          style={{ flexBasis: '100%', minWidth: 0 }}
        >
          <section
            aria-label="批注目标"
            style={{ flexBasis: '100%', minWidth: 0, overflowWrap: 'anywhere' }}
          >
            <p>
              {resourceSourceLabels[attached.ref.source]} · {attached.basis}
            </p>
            {attached.kind === 'text' ? (
              <blockquote>
                {attached.quote.slice(0, 160)}
                {attached.quote.length > 160 ? '…' : ''}
              </blockquote>
            ) : attached.kind === 'object' ? (
              <p>
                {attached.name} · {attached.semantics.slice(0, 160)}
                {attached.semantics.length > 160 ? '…' : ''}
              </p>
            ) : null}
            <ContextItemLocation item={attached} />
          </section>
          <CommentEditor item={attached} />
          <button type="button" className="btn" onClick={() => setItemId(undefined)}>
            关闭批注
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              context.removeContextItem(attached.itemId);
              setItemId(undefined);
            }}
          >
            移除批注
          </button>
        </section>
      ) : null}
    </>
  );
}
