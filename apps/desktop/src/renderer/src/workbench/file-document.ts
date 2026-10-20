import type { FileContent } from '@scholoom/protocol';
import { useSyncExternalStore } from 'react';
import { readDraft, writeDraft } from './drafts';

export interface FileDocumentState {
  content: string;
  source: FileContent | undefined;
  error: string;
  diskChanged: boolean;
  loaded: boolean;
  conversionOwner?: string | undefined;
  visualRecovery?: unknown;
}
const documents = new Map<
  string,
  {
    identity: string;
    key: string;
    value: FileDocumentState;
    listeners: Set<() => void>;
    flushers: Set<() => Promise<void>>;
  }
>();

export function fileDocument(key: string, legacyKey: string) {
  let document = documents.get(key);
  if (!document) {
    const stored = readDraft(key) || readDraft(legacyKey);
    let content = '';
    let visualRecovery: unknown;
    try {
      const draft = JSON.parse(stored);
      content = draft.content ?? '';
      visualRecovery = draft.visualRecovery;
    } catch {}
    if (stored && !readDraft(key)) writeDraft(key, stored);
    if (legacyKey !== key) writeDraft(legacyKey, '');
    document = {
      identity: crypto.randomUUID(),
      key,
      value: {
        content,
        visualRecovery,
        source: undefined,
        error: '',
        diskChanged: false,
        loaded: false,
      },
      listeners: new Set(),
      flushers: new Set(),
    };
    documents.set(key, document);
  }
  const current = document;
  return {
    identity: current.identity,
    registerFlusher: (flush: () => Promise<void>) => {
      current.flushers.add(flush);
      return () => {
        current.flushers.delete(flush);
      };
    },
    flush: async () => {
      for (const flush of current.flushers) await flush();
    },
    get: () => current.value,
    subscribe: (listener: () => void) => {
      current.listeners.add(listener);
      return () => {
        current.listeners.delete(listener);
      };
    },
    update: (patch: Partial<FileDocumentState>, persist = false) => {
      current.value = { ...current.value, ...patch };
      if (persist)
        writeDraft(
          current.key,
          JSON.stringify({
            content: current.value.content,
            visualRecovery: current.value.visualRecovery,
          }),
        );
      for (const listener of current.listeners) listener();
    },
    hasDraft: () => !!readDraft(current.key),
    clearDraft: () => writeDraft(current.key, ''),
    moveTo: (next: string) => {
      if (next === current.key) return;
      const existing = documents.get(next);
      if (existing && existing !== current) return;
      const stored = readDraft(current.key);
      if (stored) writeDraft(next, stored);
      writeDraft(current.key, '');
      documents.delete(current.key);
      documents.set(next, current);
      current.key = next;
    },
  };
}
export const useFileDocument = (document: ReturnType<typeof fileDocument>) =>
  useSyncExternalStore(document.subscribe, document.get);
