import { type ContextItem, isContextItems } from '@scholoom/protocol';
import { draftKey, readDraft, writeDraft } from './drafts.js';

const windowPrefix = 'scholoom.workbench:';
let instanceId: string | undefined;
export function workbenchInstanceId(): string {
  if (instanceId) return instanceId;
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const restoring = navigation?.type === 'reload' || navigation?.type === 'back_forward';
  instanceId =
    restoring && window.name.startsWith(windowPrefix)
      ? window.name
      : windowPrefix + crypto.randomUUID();
  window.name = instanceId;
  return instanceId;
}

export function readContextDraft(key: string): ContextItem[] {
  const stored = readDraft(key);
  if (!stored) return [];
  const value: unknown = JSON.parse(stored);
  if (!isContextItems(value)) throw new Error('保存的附加上下文不符合契约，请核查原草稿。');
  return value;
}

export function writeContextDraft(key: string, items: readonly ContextItem[]): void {
  if (!isContextItems(items)) throw new Error('附加上下文超出容量或不符合契约。');
  writeDraft(key, items.length ? JSON.stringify(items) : '');
}

export function confirmContextDraft(key: string, sent: readonly ContextItem[]): void {
  const accepted = new Map(sent.map((item) => [item.itemId, JSON.stringify(item)]));
  writeContextDraft(
    key,
    readContextDraft(key).filter((item) => accepted.get(item.itemId) !== JSON.stringify(item)),
  );
}

const suffixes = ['', 'materials', 'material-file-ids', 'context-items', 'pending'] as const;
export function emptyConversationField(suffix: string, value: string): boolean {
  if (!value) return true;
  try {
    const parsed: unknown = JSON.parse(value);
    if (suffix === 'materials' || suffix === 'context-items')
      return Array.isArray(parsed) && !parsed.length;
    if (suffix === 'material-file-ids')
      return (
        !!parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        !Object.keys(parsed).length
      );
  } catch {}
  return false;
}
export function legacyConversationDraft(directory: string, projectId: string, sessionId: string) {
  return suffixes.map((suffix) => {
    const key = draftKey(directory, projectId, sessionId, ...(suffix ? [suffix] : []));
    return { suffix, key, value: readDraft(key) };
  });
}
