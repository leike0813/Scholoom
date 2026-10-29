import type { ResourceRef } from '@scholoom/protocol';
import {
  isReportBridgeMessage,
  type ReportBridgeMessage,
  reportLimits,
} from '@scholoom/protocol/reports';
import { draftKey, readDraft, subscribeDraft, writeDraft } from '../drafts.js';

export type ReportDraftIdentity = Readonly<{
  configurationId: string;
  windowId: string;
  ref: Readonly<Extract<ResourceRef, { source: 'project' }>>;
  basis: string;
}>;
type StateMessage = Extract<ReportBridgeMessage, { type: 'state' | 'restore' }>;
export type ReportDraftState = Pick<StateMessage, 'browse' | 'draft' | 'dirty'>;
export type ReportDraftApproval = {
  identity: ReportDraftIdentity;
  status: 'available' | 'unavailable' | 'denied';
};
export type ReportDraftRestore =
  | { status: 'restorable'; state: ReportDraftState }
  | { status: 'copyOnly'; draft: ReportDraftState['draft']; dirty: boolean }
  | { status: 'unverified' | 'denied' | 'mismatch' | 'missing' | 'corrupt' | 'tooLarge' };

/** Binds one report version, not a page lifetime or an authorization grant.
 * The trusted caller validates the active bridge before save and supplies fresh approval
 * for each restore; only it may turn a candidate into a new view's restore message,
 * rechecking that complete envelope with isReportBridgeMessage.
 */
export function createReportDrafts(identity: ReportDraftIdentity) {
  const { configurationId, windowId, basis } = identity;
  const { source, projectId, fileId } = identity.ref;
  if (
    source !== 'project' ||
    [configurationId, windowId, projectId, fileId, basis].some(
      (value) => typeof value !== 'string' || !value,
    )
  )
    throw new TypeError('Report drafts require a complete trusted project identity.');
  const key = draftKey(
    'report-state',
    JSON.stringify([configurationId, windowId, projectId, fileId, basis]),
  );
  const sameIdentity = (current?: ReportDraftIdentity) =>
    current?.configurationId === configurationId &&
    current.windowId === windowId &&
    current.ref?.source === source &&
    current.ref.projectId === projectId &&
    current.ref.fileId === fileId &&
    current.basis === basis;
  const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

  return {
    key,
    save(
      message: unknown,
    ): { status: 'stored'; localStorageWritten: boolean } | { status: 'rejected' | 'mismatch' } {
      let text: string;
      try {
        if (
          !isReportBridgeMessage(message) ||
          (message.type !== 'state' && message.type !== 'restore')
        )
          return { status: 'rejected' };
        if (message.basis !== basis) return { status: 'mismatch' };
        text = JSON.stringify({
          browse: message.browse,
          draft: message.draft,
          dirty: message.dirty,
        });
      } catch {
        return { status: 'rejected' };
      }
      return { status: 'stored', localStorageWritten: writeDraft(key, text) };
    },
    restore(approval?: ReportDraftApproval): ReportDraftRestore {
      if (!approval) return { status: 'unverified' };
      if (approval.status === 'denied') return { status: 'denied' };
      if (approval.status !== 'available' && approval.status !== 'unavailable')
        return { status: 'unverified' };
      if (!sameIdentity(approval.identity)) return { status: 'mismatch' };
      const text = readDraft(key);
      if (!text) return { status: 'missing' };
      if (byteLength(text) > reportLimits.bridgeBytes) return { status: 'tooLarge' };
      try {
        const state: unknown = JSON.parse(text);
        if (
          !state ||
          typeof state !== 'object' ||
          Array.isArray(state) ||
          Object.keys(state).some((field) => !['browse', 'draft', 'dirty'].includes(field))
        )
          return { status: 'corrupt' };
        // Minimal envelope checks the original wire budget without persisting page identity.
        const message = {
          ...state,
          version: 1,
          viewId: '-',
          generation: 0,
          basis,
          type: 'state',
        };
        if (byteLength(JSON.stringify(message)) > reportLimits.bridgeBytes)
          return { status: 'tooLarge' };
        if (!isReportBridgeMessage(message) || message.type !== 'state')
          return { status: 'corrupt' };
        return approval.status === 'unavailable'
          ? { status: 'copyOnly', draft: message.draft, dirty: message.dirty }
          : {
              status: 'restorable',
              state: { browse: message.browse, draft: message.draft, dirty: message.dirty },
            };
      } catch {
        return { status: 'corrupt' };
      }
    },
    subscribe(listener: () => void) {
      return subscribeDraft(key, listener);
    },
  };
}
