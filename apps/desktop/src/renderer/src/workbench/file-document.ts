import type { FileContent } from '@scholoom/protocol';
import { useSyncExternalStore } from 'react';
import { readDraft, writeDraft } from './drafts';

export interface FileDocumentState {
  content: string;
  source: FileContent | undefined;
  error: string;
  diskChanged: boolean;
  loaded: boolean;
}
const documents = new Map<
  string,
  { key: string; value: FileDocumentState; listeners: Set<() => void> }
>();

export function fileDocument(key: string, legacyKey: string) {
  let document = documents.get(key);
  if (!document) {
    const stored = readDraft(key) || readDraft(legacyKey);
    let content = '';
    try {
      content = JSON.parse(stored).content ?? '';
    } catch {}
    if (stored && !readDraft(key)) writeDraft(key, stored);
    if (legacyKey !== key) writeDraft(legacyKey, '');
    document = {
      key,
      value: { content, source: undefined, error: '', diskChanged: false, loaded: false },
      listeners: new Set(),
    };
    documents.set(key, document);
  }
  const current = document;
  return {
    get: () => current.value,
    subscribe: (listener: () => void) => {
      current.listeners.add(listener);
      return () => {
        current.listeners.delete(listener);
      };
    },
    update: (patch: Partial<FileDocumentState>, persist = false) => {
      current.value = { ...current.value, ...patch };
      if (persist) writeDraft(current.key, JSON.stringify({ content: current.value.content }));
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
