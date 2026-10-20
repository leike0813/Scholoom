import type { Artifact } from '@scholoom/protocol';
import { useState } from 'react';
import { artifactStateLabel } from './projection';

export function ArtifactNotice({
  artifact,
  enabled,
  reconcile,
}: {
  artifact: Artifact;
  enabled: boolean;
  reconcile: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setError('');
    setBusy(true);
    try {
      await reconcile();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '成果登记核查失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="execution-status">
      <span>
        {artifact.path} · {artifactStateLabel(artifact)}
      </span>
      {artifact.state !== 'linked' ? (
        <button type="button" disabled={!enabled || busy} onClick={() => void check()}>
          核查并补齐
        </button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
