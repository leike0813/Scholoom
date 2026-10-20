import { useState } from 'react';
import { Dialog } from './shell/dialog';

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';

export function ProjectTrustDialog({
  path,
  enabled,
  onChoose,
  onClose,
}: {
  path: string;
  enabled: boolean;
  onChoose: (trust: 'trusted' | 'restricted') => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (trust: 'trusted' | 'restricted') => {
    setBusy(true);
    setError('');
    try {
      await onChoose(trust);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="确认项目访问"
      onClose={() => {
        if (!busy) onClose();
      }}
      className="project-trust-dialog"
    >
      <p>项目目录：</p>
      <code>{path}</code>
      <p>信任项目后，Agent 可读取和修改此目录中的内容，并可能将材料发送给外部服务。</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="dialog-actions">
        <button
          type="button"
          className="btn"
          disabled={!enabled || busy}
          aria-busy={busy || undefined}
          onClick={() => void choose('trusted')}
        >
          信任项目
        </button>
        <button
          type="button"
          className="btn"
          disabled={!enabled || busy}
          aria-busy={busy || undefined}
          onClick={() => void choose('restricted')}
        >
          以受限模式添加
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onClose}>
          取消
        </button>
      </div>
    </Dialog>
  );
}
