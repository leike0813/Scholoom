import { type ErrorInfo, isErrorInfo, OperationError } from '@scholoom/protocol/core';
import type { ReportSnapshot } from '@scholoom/protocol/reports';
import type { ResourceEvidence } from '@scholoom/protocol/resources';
import { sameResourceRef } from '../resource-controller.js';

export interface ReportUpdateProtection {
  pageDirty: boolean;
  explicitItems: boolean;
  composerDraft: boolean;
}

export interface ReportUpdateState {
  current: ReportSnapshot | null;
  pending: ReportSnapshot | null;
  loading: boolean;
  error: ErrorInfo | null;
  canDisplay: boolean;
  canReplace: boolean;
  closed: boolean;
}

function errorInfo(reason: unknown): ErrorInfo {
  if (isErrorInfo(reason)) return { code: reason.code, message: reason.message };
  if (reason instanceof Error) {
    const error = {
      code: 'code' in reason ? reason.code : 'unavailable',
      message: reason.message.slice(0, 512),
    };
    if (isErrorInfo(error)) return error;
  }
  return { code: 'unavailable', message: '报告候选加载失败。' };
}

/** Metadata only. load must perform the complete resources.report authorization/version check.
 * The host offers only bounded entry/dependency/source notifications, and invalidates immediately
 * on known revocation/identity loss. current is diagnostic metadata when canDisplay is false.
 */
export function createReportUpdates({
  entry,
  load,
  protection = { pageDirty: false, explicitItems: false, composerDraft: false },
}: {
  entry: ResourceEvidence;
  load(evidence: ResourceEvidence, signal: AbortSignal): Promise<ReportSnapshot>;
  protection?: ReportUpdateProtection;
}) {
  if (entry.ref.source !== 'project')
    throw new OperationError('invalidRequest', '报告入口必须属于项目。');
  const identity = structuredClone(entry.ref);
  let latest = structuredClone(entry);
  let facts = { ...protection };
  let current: ReportSnapshot | null = null;
  let pending: ReportSnapshot | null = null;
  let error: ErrorInfo | null = null;
  let allowed = false;
  let blocked = false;
  let closed = false;
  let revision = 0;
  let queued: { evidence: ResourceEvidence; revision: number } | undefined;
  let active: AbortController | undefined;
  let draining: Promise<void> | undefined;
  const protectedWork = () => facts.pageDirty || facts.explicitItems || facts.composerDraft;
  const canReplace = () => !!pending && !active && !queued && !error && !closed;
  const adopt = () => {
    current = pending;
    pending = null;
    allowed = true;
  };
  const invalidate = (reason: ErrorInfo, closing = false) => {
    if (closed) return;
    closed = closing;
    if (closing) current = null;
    revision++;
    queued = undefined;
    pending = null;
    allowed = false;
    blocked = true;
    error = errorInfo(reason);
    active?.abort();
  };

  /** Repeated/resync notifications share one drain and replace its sole queued candidate.
   * Abort is advisory: an old load must settle before another starts. The promise waits for
   * that drain, not for adoption of this particular offer; inspect read() for the result.
   */
  const offer = (evidence: ResourceEvidence = latest): Promise<void> => {
    if (closed) return draining ?? Promise.resolve();
    if (!sameResourceRef(evidence.ref, identity)) {
      invalidate({ code: 'contentChanged', message: '报告入口身份已失效。' });
      return draining ?? Promise.resolve();
    }
    latest = structuredClone(evidence);
    if (blocked) return draining ?? Promise.resolve();
    queued = { evidence: latest, revision: ++revision };
    pending = null;
    error = null;
    active?.abort();
    if (!draining)
      draining = Promise.resolve().then(async () => {
        try {
          while (queued && !closed) {
            const candidate = queued;
            queued = undefined;
            const controller = new AbortController();
            active = controller;
            try {
              const snapshot = await load(structuredClone(candidate.evidence), controller.signal);
              if (closed || candidate.revision !== revision) continue;
              if (
                !sameResourceRef(snapshot.resource.ref, identity) ||
                snapshot.resource.basis !== candidate.evidence.basis
              )
                throw new OperationError('contentChanged', '报告候选与请求版本不一致。');
              pending = structuredClone(snapshot);
              if (!protectedWork()) adopt();
            } catch (reason) {
              if (!closed && candidate.revision === revision) {
                error = errorInfo(reason);
                pending = null;
                allowed = false;
                blocked = true;
              }
            } finally {
              active = undefined;
            }
          }
        } finally {
          draining = undefined;
        }
      });
    return draining;
  };
  return {
    read(): ReportUpdateState {
      return structuredClone({
        current,
        pending,
        loading: !!active || !!queued,
        error,
        canDisplay: !!current && allowed && !closed,
        canReplace: canReplace(),
        closed,
      });
    },
    offer,
    /** Only an explicit host/user recheck resumes loading after failure or invalidation. */
    recheck(): Promise<void> {
      if (closed) return draining ?? Promise.resolve();
      blocked = false;
      return offer();
    },
    protect(next: ReportUpdateProtection) {
      if (closed) return;
      facts = { ...next };
      if (!protectedWork() && canReplace()) adopt();
    },
    viewPending(): boolean {
      if (!canReplace()) return false;
      adopt();
      return true;
    },
    invalidate(reason: ErrorInfo) {
      invalidate(reason);
    },
    dispose() {
      invalidate({ code: 'unavailable', message: '报告更新已关闭。' }, true);
    },
  };
}
