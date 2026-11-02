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
type EntryIdentity = Omit<ReportDraftIdentity, 'basis'>;
const savedVersions = 32;
const versionsKey = (identity: EntryIdentity) =>
  draftKey(
    'report-versions',
    JSON.stringify([
      identity.configurationId,
      identity.windowId,
      identity.ref.projectId,
      identity.ref.fileId,
    ]),
  );

/** Reads only this entry's bounded index; it neither qualifies nor exposes saved page state. */
export function reportSavedVersions(identity: EntryIdentity): string[] {
  const text = readDraft(versionsKey(identity));
  if (!text) return [];
  if (
    text.length > reportLimits.bridgeBytes ||
    new TextEncoder().encode(text).byteLength > reportLimits.bridgeBytes
  )
    throw new TypeError('保存的报告版本索引超过容量。');
  const value: unknown = JSON.parse(text);
  if (
    !Array.isArray(value) ||
    value.length > savedVersions ||
    value.some((basis) => typeof basis !== 'string' || !basis || basis.length > 1024) ||
    new Set(value).size !== value.length
  )
    throw new TypeError('保存的报告版本索引无效。');
  return value;
}

export function hasReportDraft(identity: EntryIdentity): boolean {
  try {
    return reportSavedVersions(identity).some((basis) => {
      const store = createReportDrafts({ ...identity, basis });
      const text = readDraft(store.key);
      if (!text) return false;
      if (text.length > reportLimits.bridgeBytes) return true;
      const value: unknown = JSON.parse(text);
      return !value || typeof value !== 'object' || !('dirty' in value) || value.dirty !== false;
    });
  } catch {
    return true;
  }
}
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
  const captured = { configurationId, windowId, ref: { source, projectId, fileId } };
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
      let versions: string[];
      try {
        versions = reportSavedVersions(captured).filter((value) => value !== basis);
      } catch {
        return { status: 'rejected' };
      }
      if (versions.length >= savedVersions) return { status: 'rejected' };
      versions.push(basis);
      const index = JSON.stringify(versions);
      if (new TextEncoder().encode(index).byteLength > reportLimits.bridgeBytes)
        return { status: 'rejected' };
      const stateWritten = writeDraft(key, text);
      const indexWritten = writeDraft(versionsKey(captured), index);
      return { status: 'stored', localStorageWritten: stateWritten && indexWritten };
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
