import type { KernelClient } from '@scholoom/client';
import { OperationError } from '@scholoom/protocol/core';
import { sameResourceRef } from '../resource-controller.js';
import { createReportDrafts, type ReportDraftIdentity } from './report-drafts.js';

/** One exact-version read. The host still owns the active view/window/client generation.
 * Abort rejects late effects only after the issued RPC settles; it does not stop remote work.
 */
export async function restoreReportDraft({
  client,
  identity,
  signal,
}: {
  client: KernelClient;
  identity: ReportDraftIdentity;
  signal?: AbortSignal;
}) {
  const captured = structuredClone(identity);
  const check = () => {
    signal?.throwIfAborted();
    const connection = client.getSnapshot();
    if (connection.phase !== 'connected')
      throw new OperationError('unavailable', '报告恢复连接当前不可用。');
    if (connection.status?.dataDirectory !== captured.configurationId)
      throw new OperationError('instanceMismatch', '报告草稿配置与当前连接不符。');
  };
  check();
  const version = await client.call('resources.reportVersion', {
    ref: captured.ref,
    basis: captured.basis,
  });
  check();
  if (
    version.state === 'available' &&
    (!sameResourceRef(version.snapshot.resource.ref, captured.ref) ||
      version.snapshot.resource.basis !== captured.basis)
  )
    throw new OperationError('contentChanged', '报告恢复结果与原版本不符。');
  const restored = createReportDrafts(captured).restore({
    identity: captured,
    status: version.state,
  });
  return { version, restored };
}
