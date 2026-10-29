import type { KernelClient } from '@scholoom/client';
import type { WorkbenchChange } from '@scholoom/protocol';
import { OperationError } from '@scholoom/protocol/core';
import type { ResourceEvidence } from '@scholoom/protocol/resources';
import { sameResourceRef } from '../resource-controller.js';
import { createReportUpdates, type ReportUpdateProtection } from './report-updates.js';

/** The host owns workbench.watch and the client. This adapter never changes their scope.
 * Replace/dispose the binding on configuration/client changes; no page or OS lease is acquired.
 */
export function createReportClient({
  client,
  dataDirectory,
  entry,
  sessionId,
  protection,
}: {
  client: KernelClient;
  dataDirectory: string;
  entry: ResourceEvidence;
  sessionId?: string;
  protection?: ReportUpdateProtection;
}) {
  const identity = structuredClone(entry.ref);
  const listeners = new Set<() => void>();
  let disposed = false;
  let observed: Promise<void> | undefined;
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const ensure = (signal?: AbortSignal) => {
    signal?.throwIfAborted();
    const connection = client.getSnapshot();
    if (disposed || connection.phase !== 'connected')
      throw new OperationError('unavailable', '报告连接当前不可用。');
    if (connection.status?.dataDirectory !== dataDirectory)
      throw new OperationError('instanceMismatch', '报告配置已改变。');
  };
  const follow = (work: Promise<void>): Promise<void> => {
    if (observed !== work) {
      observed = work;
      void work.then(() => {
        if (observed === work) observed = undefined;
        if (!disposed) notify();
      });
    }
    notify();
    return work;
  };
  const updates = createReportUpdates({
    entry,
    ...(protection ? { protection } : {}),
    load: async (evidence, signal) => {
      ensure(signal);
      const descriptor = await client.call('resources.describe', { locator: identity });
      // There is no report RPC cancellation. Await the actual call before checking the signal.
      ensure(signal);
      if (!sameResourceRef(descriptor.ref, identity))
        throw new OperationError('contentChanged', '报告入口身份已失效。');
      if (descriptor.basis !== evidence.basis) {
        follow(updates.offer({ ...evidence, basis: descriptor.basis }));
        throw new OperationError('contentChanged', '已发现新的报告版本。');
      }
      const snapshot = await client.call('resources.report', {
        ref: descriptor.ref,
        basis: descriptor.basis,
      });
      ensure(signal);
      // A dirty old page may retain sources absent from the new complete report.
      // Reuse domain describe for that bounded exclusive Evidence, not a cached permission.
      const current = updates.read().current;
      const verified = [
        snapshot.resource,
        ...snapshot.manifest.resources,
        ...snapshot.manifest.sources,
      ];
      for (const retained of current
        ? [...current.manifest.resources, ...current.manifest.sources]
        : []) {
        if (
          verified.some(
            (value) => value.basis === retained.basis && sameResourceRef(value.ref, retained.ref),
          )
        )
          continue;
        const value = await client.call('resources.describe', { locator: retained.ref });
        ensure(signal);
        if (!value.capabilities.read)
          throw new OperationError('permissionDenied', '原报告材料已不可读。');
        // The old page keeps its frozen basis. A newer readable revision is not revocation.
        if (!sameResourceRef(value.ref, retained.ref))
          throw new OperationError('contentChanged', '原报告材料身份已失效。');
        verified.push(value);
      }
      return snapshot;
    },
  });

  const relevant = (change: WorkbenchChange) => {
    const { current, pending } = updates.read();
    const snapshots = [current, pending].filter((value) => value !== null);
    const projects = new Set(identity.source === 'project' ? [identity.projectId] : []);
    let library = false;
    for (const snapshot of snapshots) {
      for (const { ref } of [...snapshot.manifest.resources, ...snapshot.manifest.sources]) {
        if (ref.source === 'library') library = true;
        else projects.add(ref.projectId);
      }
    }
    if (change.projectId && !projects.has(change.projectId)) return false;
    // resync is coarse and may combine a report save with session/library flags.
    if (change.resync) return true;
    if (
      change.sessionId &&
      change.sessionId !== sessionId &&
      !change.filePaths &&
      !change.libraryChanged
    )
      return false;
    if (change.libraryChanged && library) return true;
    if (change.filePaths && change.projectId) return true;
    if (change.libraryChanged || change.sessionsChanged || change.programsChanged) return false;
    return !!change.projectId || change.resync;
  };
  const unchange = client.subscribeChanges((change) => {
    if (!disposed && relevant(change)) follow(updates.offer());
  });
  let phase = client.getSnapshot().phase;
  const unconnect = client.subscribe(() => {
    if (disposed) return;
    const next = client.getSnapshot();
    if (next.status && next.status.dataDirectory !== dataDirectory) {
      dispose();
      return;
    }
    if (next.phase !== 'connected' && next.phase !== phase) {
      updates.invalidate(next.error ?? { code: 'unavailable', message: '报告连接已断开。' });
      notify();
    } else if (next.phase === 'connected' && phase !== 'connected') {
      // Reconnection does not itself grant permission to recover a failed page.
      follow(updates.offer());
    }
    phase = next.phase;
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    unchange();
    unconnect();
    updates.dispose();
    notify();
    listeners.clear();
  }
  try {
    ensure();
    follow(updates.offer());
  } catch {
    updates.invalidate({ code: 'unavailable', message: '等待有效的报告连接与配置。' });
  }
  return {
    read: updates.read,
    subscribe(listener: () => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    protect(facts: ReportUpdateProtection) {
      updates.protect(facts);
      notify();
    },
    viewPending(): boolean {
      const accepted = updates.viewPending();
      notify();
      return accepted;
    },
    recheck(): Promise<void> {
      try {
        ensure();
      } catch {
        updates.invalidate({ code: 'unavailable', message: '报告连接与配置当前不可用。' });
        notify();
        return observed ?? Promise.resolve();
      }
      return follow(updates.recheck());
    },
    setContext(next: { client: KernelClient; dataDirectory: string }) {
      if (next.client !== client || next.dataDirectory !== dataDirectory) dispose();
    },
    dispose,
  };
}
