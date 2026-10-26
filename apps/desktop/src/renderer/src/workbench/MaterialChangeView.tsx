import type { FileEdit } from '@scholoom/protocol';
import { useMemo } from 'react';
import { lineDiff } from './line-diff';

export function ContentDiff({ before, after }: { before: string; after: string }) {
  const differences = useMemo(() => lineDiff(before, after), [before, after]);
  if (!differences)
    return (
      <>
        <section aria-label="修改前内容">
          <pre>{before}</pre>
        </section>
        <section aria-label="修改后内容">
          <pre>{after}</pre>
        </section>
      </>
    );
  return (
    <section aria-label="内容差异">
      <pre>
        {differences.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 只读差异行允许重复内容。
          <div key={`${index}-${row.kind}`} className={`diff-${row.kind}`}>
            {row.kind === 'add' ? '+ ' : row.kind === 'remove' ? '- ' : '  '}
            {row.text}
          </div>
        ))}
      </pre>
    </section>
  );
}

export function MaterialChangeView({ edit, onUndo }: { edit: FileEdit; onUndo: () => void }) {
  return (
    <details>
      <summary>{edit.createdAt}</summary>
      <p>已保存修改 · {edit.path}</p>
      {edit.basis ? <p>读取依据：{edit.basis}</p> : null}
      <p>此记录未包含执行者或修改说明。</p>
      <ContentDiff before={edit.before} after={edit.after} />
      <button type="button" className="btn" onClick={onUndo}>
        撤销此修改
      </button>
    </details>
  );
}
