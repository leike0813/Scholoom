/**
 * 草稿按数据配置、项目、会话或文件分别保存。localStorage 不可用或配额不足时
 * 退回内存草稿，界面行为不变，仅不再跨刷新保留。
 */
const prefix = 'scholoom.draft.v1:';
const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

export const draftKey = (...parts: readonly (string | undefined)[]): string =>
  parts.map((part) => part ?? '-').join('|');

export function readDraft(key: string): string {
  if (memory.has(key)) return memory.get(key) ?? '';
  try {
    return window.localStorage.getItem(prefix + key) ?? memory.get(key) ?? '';
  } catch {
    return memory.get(key) ?? '';
  }
}

export function writeDraft(key: string, text: string): void {
  const previous = readDraft(key);
  memory.set(key, text);
  try {
    if (text) window.localStorage.setItem(prefix + key, text);
    else window.localStorage.removeItem(prefix + key);
  } catch {
    // 配额不足或存储不可用：内存草稿仍然有效。
  }
  if (previous !== text) for (const listener of listeners.get(key) ?? []) listener();
}

export function subscribeDraft(key: string, listener: () => void): () => void {
  const current = listeners.get(key) ?? new Set<() => void>();
  current.add(listener);
  listeners.set(key, current);
  return () => {
    current.delete(listener);
    if (!current.size) listeners.delete(key);
  };
}
