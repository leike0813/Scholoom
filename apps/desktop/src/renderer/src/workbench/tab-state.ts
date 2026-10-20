import type { LibraryAttachment } from '@scholoom/protocol';
import type { FileTarget } from './session.js';

export type TabKind = 'library' | 'reader' | 'editor' | 'preview' | 'settings';
export type FileViewMode = 'source' | 'visual' | 'preview' | 'render';
export interface TabItem {
  id: string;
  title: string;
  kind: TabKind;
  target?: FileTarget;
  material?: LibraryAttachment;
  transient?: boolean;
  editorMode?: FileViewMode;
}
export interface TabGroupState {
  id: string;
  tabs: readonly TabItem[];
  activeId: string | null;
}

export interface WorkbenchTabState {
  groups: readonly TabGroupState[];
  activeGroupId: string | null;
}

export function fileTabId(target: FileTarget, kind: TabItem['kind'] = 'editor'): string {
  const identity = `${target.projectId}:${target.fileId ?? target.path}`;
  return kind === 'preview' ? `${identity}:preview` : identity;
}

function sameFile(tab: TabItem, target: FileTarget): boolean {
  if (!tab.target || tab.target.projectId !== target.projectId) return false;
  if (tab.target.fileId && target.fileId) return tab.target.fileId === target.fileId;
  return tab.target.path === target.path;
}

export function openFileTab(
  state: WorkbenchTabState,
  target: FileTarget,
  isDirty: (target: FileTarget) => boolean = () => false,
): WorkbenchTabState {
  const match = state.groups
    .flatMap((group, groupIndex) => group.tabs.map((tab) => ({ group, groupIndex, tab })))
    .find(({ tab }) => sameFile(tab, target));
  if (match) {
    const id = fileTabId(target, match.tab.kind);
    return {
      ...state,
      activeGroupId: match.group.id,
      groups: state.groups.map((group, groupIndex) =>
        groupIndex === match.groupIndex
          ? {
              ...group,
              activeId: id,
              tabs: group.tabs.map((tab) =>
                tab.id === match.tab.id
                  ? {
                      ...tab,
                      id,
                      target,
                      title: `${target.path.split('/').at(-1) ?? target.path}${tab.kind === 'preview' ? ' · 预览' : ''}`,
                      ...(target.openMode !== 'preview' ? { transient: false } : {}),
                    }
                  : tab,
              ),
            }
          : group,
      ),
    };
  }

  const activeIndex = Math.max(
    0,
    state.groups.findIndex((group) => group.id === state.activeGroupId),
  );
  const current = state.groups[activeIndex];
  const group = current ?? { id: 'a', tabs: [], activeId: null };
  const oldTransient = group.tabs.find((tab) => tab.transient);
  const keepOld = !!oldTransient?.target && isDirty(oldTransient.target);
  const tabs = group.tabs.filter((tab) => tab !== oldTransient);
  if (oldTransient && keepOld) tabs.push({ ...oldTransient, transient: false });
  const id = fileTabId(target);
  const opened: TabItem = {
    id,
    title: target.path.split('/').at(-1) ?? target.path,
    kind: 'editor',
    target,
    transient: target.openMode === 'preview',
  };
  const updated = { ...group, tabs: [...tabs, opened], activeId: id };
  return {
    activeGroupId: group.id,
    groups: current
      ? state.groups.map((item, index) => (index === activeIndex ? updated : item))
      : [updated],
  };
}
