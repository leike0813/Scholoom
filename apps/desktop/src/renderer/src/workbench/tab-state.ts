import type { ResourceLocator, TaskRef } from '@scholoom/protocol';
import { readerKindForName } from './reader-material.js';
import { type ResourceTarget, resourceKey } from './resource-controller.js';
import type { FileTarget } from './session.js';

export type TabKind =
  | 'library'
  | 'reader'
  | 'editor'
  | 'preview'
  | 'settings'
  | 'task'
  | 'programs';
export type FileViewMode = 'source' | 'visual' | 'preview' | 'render';
export interface TabItem {
  id: string;
  title: string;
  kind: TabKind;
  resource?: ResourceTarget;
  task?: TaskRef;
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

const titleFor = (target: ResourceTarget, preview = false) =>
  `${target.name}${preview ? ' · 预览' : ''}`;
const tabId = (target: ResourceTarget, preview = false) =>
  `${resourceKey(target)}${preview ? ':preview' : ''}`;

export function resourceTabKind(target: ResourceTarget): TabKind {
  return target.locator.source === 'render' || readerKindForName(target.name) ? 'reader' : 'editor';
}

function sameResource(left: ResourceTarget | undefined, right: ResourceTarget): boolean {
  if (!left) return false;
  const a = left.locator;
  const b = right.locator;
  if (a.source !== b.source) return false;
  if (a.source === 'library' && b.source === 'library')
    return a.attachmentId === b.attachmentId && a.materialVersionId === b.materialVersionId;
  if (a.source === 'render' && b.source === 'render')
    return a.projectId === b.projectId && a.outputId === b.outputId;
  if (a.source === 'project' && b.source === 'project') {
    if (a.projectId !== b.projectId) return false;
    if (a.fileId && b.fileId) return a.fileId === b.fileId;
    return !!a.path && !!b.path && a.path === b.path;
  }
  return false;
}

export function openResourceTab(
  state: WorkbenchTabState,
  target: ResourceTarget,
  isDirty: (target: ResourceTarget) => boolean = () => false,
): WorkbenchTabState {
  const match = state.groups
    .flatMap((group, groupIndex) => group.tabs.map((tab) => ({ group, groupIndex, tab })))
    .find(({ tab }) => sameResource(tab.resource, target));
  if (match) {
    const preview = match.tab.kind === 'preview';
    const id = tabId(target, preview);
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
                      resource: target,
                      title: titleFor(target, preview),
                      ...(target.openMode === 'preview' ? {} : { transient: false }),
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
  const keepOld = !!oldTransient?.resource && isDirty(oldTransient.resource);
  const tabs = group.tabs.filter((tab) => tab !== oldTransient);
  if (oldTransient && keepOld) tabs.push({ ...oldTransient, transient: false });
  const transient = target.openMode === 'preview';
  const id = tabId(target);
  const opened: TabItem = {
    id,
    title: titleFor(target),
    kind: resourceTabKind(target),
    resource: target,
    transient,
    editorMode: 'source',
  };
  const updated = { ...group, tabs: [...tabs, opened], activeId: id };
  return {
    activeGroupId: group.id,
    groups: current
      ? state.groups.map((item, index) => (index === activeIndex ? updated : item))
      : [updated],
  };
}

/** Convert the former target/material tab shape when an older host supplies it. */
export function normalizeLegacyTab(value: unknown): TabItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const tab = value as Record<string, unknown>;
  if (typeof tab.id !== 'string' || typeof tab.title !== 'string') return undefined;
  const rest = { ...tab };
  delete rest.target;
  delete rest.material;
  if (tab.resource && typeof tab.resource === 'object') return rest as unknown as TabItem;

  let resource: ResourceTarget | undefined;
  const target = tab.target as FileTarget | undefined;
  const material = tab.material as
    | { id?: string; name?: string; materialVersionId?: string }
    | undefined;
  if (target?.projectId && target.path) {
    const locator: ResourceLocator = {
      source: 'project',
      projectId: target.projectId,
      ...(target.fileId ? { fileId: target.fileId } : {}),
      path: target.path,
    };
    resource = {
      locator,
      name: tab.title,
      ...(target.openMode ? { openMode: target.openMode } : {}),
      ...(target.create ? { create: true } : {}),
    };
  } else if (material?.id && material.materialVersionId && material.name) {
    resource = {
      locator: {
        source: 'library',
        attachmentId: material.id,
        materialVersionId: material.materialVersionId,
      },
      name: material.name,
    };
  }
  if (resource) return { ...rest, resource } as unknown as TabItem;
  if (['library', 'reader', 'editor', 'preview', 'settings', 'programs'].includes(String(tab.kind)))
    return tab as unknown as TabItem;
  return undefined;
}
