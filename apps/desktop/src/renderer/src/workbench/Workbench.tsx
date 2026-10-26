import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ContextContributionProvider } from './context-contributions';
import { readDraft, subscribeDraft, writeDraft } from './drafts';
import { projectTarget, resourceKey } from './resource-controller';
import { StatusBarProvider } from './StatusBarContext';
import type { WorkbenchSession } from './session';
import { ActivityPane, ActivityRail, type ThemeMode } from './shell/ActivityPane';
import { AgentDock } from './shell/AgentDock';
import { AgentOverlay } from './shell/AgentOverlay';
import { AuxiliaryPane, AuxiliaryRail } from './shell/AuxiliaryPane';
import { PaneHandle } from './shell/PaneHandle';
import { StatusBar } from './shell/StatusBar';
import { type TabGroupState, TabGroups, type TabItem } from './shell/TabGroups';
import { normalizeLegacyTab, openResourceTab, resourceTabKind } from './tab-state';
import './library/library.css';

const THEME_ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];
const isGlobalTab = (tab: TabItem) =>
  tab.resource?.locator.source === 'library' || tab.kind === 'library' || tab.kind === 'settings';

function ComposerDraft({
  storageKey,
  runtime,
}: {
  storageKey: string | undefined;
  runtime: ReturnType<typeof useExternalStoreRuntime>;
}) {
  useLayoutEffect(() => {
    if (!storageKey) return;
    void runtime.thread.composer.reset();
    runtime.thread.composer.setText(readDraft(storageKey));
    const unsubscribeStore = subscribeDraft(storageKey, () =>
      runtime.thread.composer.setText(readDraft(storageKey)),
    );
    const unsubscribeComposer = runtime.thread.composer.subscribe(() =>
      writeDraft(storageKey, runtime.thread.composer.getState().text),
    );
    return () => {
      unsubscribeStore();
      unsubscribeComposer();
    };
  }, [runtime, storageKey]);
  return null;
}

export function Workbench({ session }: { session: WorkbenchSession }) {
  return (
    <StatusBarProvider>
      <WorkbenchContent session={session} />
    </StatusBarProvider>
  );
}

function WorkbenchContent({ session }: { session: WorkbenchSession }) {
  const runtime = useExternalStoreRuntime(session.adapter);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [agentExpanded, setAgentExpanded] = useState(false);
  // 三区可调尺寸（默认值见 docs/ui-design/README.md 三区骨架一节），不持久化。
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(300);
  const [dockHeight, setDockHeight] = useState(180);
  const leftRef = useRef(leftWidth);
  leftRef.current = leftWidth;
  const rightRef = useRef(rightWidth);
  rightRef.current = rightWidth;
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [groups, setGroups] = useState<readonly TabGroupState[]>(
    session.initialTabs?.length
      ? [
          {
            id: 'a',
            tabs: session.initialTabs.flatMap((tab) => {
              const normalized = normalizeLegacyTab(tab);
              return normalized ? [normalized] : [];
            }),
            activeId: session.initialTabs[0]?.id ?? null,
          },
        ]
      : [],
  );
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    session.initialTabs?.length ? 'a' : null,
  );
  const projectGroups = useRef(new Map<string, readonly TabGroupState[]>());
  const projectActiveGroups = useRef(new Map<string, string | null>());
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const activeGroupRef = useRef(activeGroupId);
  activeGroupRef.current = activeGroupId;
  const isResourceDirtyRef = useRef(session.isResourceDirty);
  isResourceDirtyRef.current = session.isResourceDirty;
  const currentProject = useRef(session.projectId ?? 'sample');
  useLayoutEffect(() => {
    const next = session.projectId ?? 'sample';
    if (next === currentProject.current) return;
    // 共同材料独立于项目会话；只把项目自己的tab存入项目布局。
    projectGroups.current.set(
      currentProject.current,
      groups.flatMap((group) => {
        const tabs = group.tabs.filter((tab) => !isGlobalTab(tab));
        return tabs.length
          ? [
              {
                ...group,
                tabs,
                activeId: tabs.some((tab) => tab.id === group.activeId)
                  ? group.activeId
                  : (tabs[0]?.id ?? null),
              },
            ]
          : [];
      }),
    );
    projectActiveGroups.current.set(currentProject.current, activeGroupId);
    currentProject.current = next;
    const restored = [...(projectGroups.current.get(next) ?? [])];
    for (const group of groups) {
      const tabs = group.tabs.filter(isGlobalTab);
      if (!tabs.length) continue;
      const index = restored.findIndex((target) => target.id === group.id);
      const target = restored[index];
      const activeId =
        target?.activeId ??
        (tabs.some((tab) => tab.id === group.activeId) ? group.activeId : (tabs[0]?.id ?? null));
      const combined = { ...group, tabs: [...(target?.tabs ?? []), ...tabs], activeId };
      if (index >= 0) restored[index] = combined;
      else restored.push(combined);
    }
    setGroups(restored);
    groupsRef.current = restored;
    const restoredActive = projectActiveGroups.current.get(next);
    const nextActiveGroup = restored.some((group) => group.id === restoredActive)
      ? (restoredActive ?? null)
      : (restored[0]?.id ?? null);
    setActiveGroupId(nextActiveGroup);
    activeGroupRef.current = nextActiveGroup;
  }, [session.projectId, groups, activeGroupId]);

  const resolveFiles = useRef(session.resolveFiles);
  resolveFiles.current = session.resolveFiles;
  const fileIds = JSON.stringify([
    ...new Set(
      groups.flatMap((group) =>
        group.tabs.flatMap((tab) =>
          tab.resource?.locator.source === 'project' && tab.resource.locator.fileId
            ? [tab.resource.locator.fileId]
            : [],
        ),
      ),
    ),
  ]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 项目和文件修订触发当前位置查询，解析函数经 ref 保持稳定。
  useEffect(() => {
    const resolve = resolveFiles.current;
    const ids = JSON.parse(fileIds) as string[];
    if (!resolve || !ids.length) return;
    let active = true;
    void (async () => {
      const locations = [];
      for (let offset = 0; offset < ids.length; offset += 100)
        locations.push(...(await resolve(ids.slice(offset, offset + 100))));
      if (!active) return;
      const paths = new Map(
        locations
          .filter((location) => location.state === 'present')
          .map((location) => [location.fileId, location.path]),
      );
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          tabs: group.tabs.map((tab) => {
            const locator = tab.resource?.locator;
            const path =
              locator?.source === 'project' && locator.fileId
                ? paths.get(locator.fileId)
                : undefined;
            return path && tab.resource && locator?.source === 'project' && path !== locator.path
              ? {
                  ...tab,
                  title: `${path.split('/').at(-1)}${tab.kind === 'preview' ? ' · 预览' : ''}`,
                  resource: {
                    ...tab.resource,
                    name: path.split('/').at(-1) ?? path,
                    locator: { ...locator, path },
                  },
                }
              : tab;
          }),
        })),
      );
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [fileIds, session.fileRevision, session.projectId]);

  const overlayRef = useRef<HTMLDivElement>(null);
  const wasExpandedRef = useRef(false);

  const reset = useCallback(() => {
    session.reset?.();
    runtime.thread.composer.setText('');
  }, [session, runtime]);

  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  useEffect(() => {
    if (agentExpanded) {
      overlayRef.current?.querySelector('textarea')?.focus();
    } else if (wasExpandedRef.current) {
      document.getElementById('dock-transcript')?.focus();
    }
    wasExpandedRef.current = agentExpanded;
  }, [agentExpanded]);

  const flushResourceRef = useRef(session.flushResource);
  flushResourceRef.current = session.flushResource;
  const flushGroup = useCallback((groupIndex: number, apply: () => void) => {
    const group = groupsRef.current[groupIndex];
    const target = group?.tabs.find((tab) => tab.id === group.activeId)?.resource;
    if (target && flushResourceRef.current)
      void flushResourceRef.current(target).then(apply, () => {});
    else apply();
  }, []);

  const activateTab = useCallback(
    (groupIndex: number, tabId: string) => {
      flushGroup(groupIndex, () => {
        setActiveGroupId(groups[groupIndex]?.id ?? null);
        setGroups((current) =>
          current.map((group, index) =>
            index === groupIndex ? { ...group, activeId: tabId } : group,
          ),
        );
      });
    },
    [groups, flushGroup],
  );

  const pinTab = useCallback((groupIndex: number, tabId: string) => {
    setGroups((current) =>
      current.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId ? { ...tab, transient: false } : tab,
              ),
            }
          : group,
      ),
    );
  }, []);

  const closeTab = useCallback(
    (groupIndex: number, tabId: string) => {
      flushGroup(groupIndex, () => {
        const group = groups[groupIndex];
        if (group?.activeId === tabId && group.tabs.length === 1) {
          setActiveGroupId(groups.find((item) => item.id !== group.id)?.id ?? null);
        }
        setGroups((current) => {
          const next = current.map((group, index) => {
            if (index !== groupIndex) return group;
            const tabs = group.tabs.filter((tab) => tab.id !== tabId);
            const activeId = group.activeId === tabId ? (tabs[0]?.id ?? null) : group.activeId;
            return { id: group.id, tabs, activeId };
          });
          return next.filter((group) => group.tabs.length > 0);
        });
      });
    },
    [groups, flushGroup],
  );

  const splitGroup = useCallback(
    (groupIndex: number) => {
      flushGroup(groupIndex, () => {
        const candidate = groups[groupIndex];
        if (groups.length < 2 && candidate?.activeId && candidate.tabs.length >= 2) {
          setActiveGroupId(candidate.id === 'a' ? 'b' : 'a');
        }
        setGroups((current) => {
          if (current.length >= 2) return current;
          const group = current[groupIndex];
          if (group === undefined || group.activeId === null || group.tabs.length < 2)
            return current;
          const active = group.tabs.find((tab) => tab.id === group.activeId);
          if (active === undefined) return current;
          const rest = group.tabs.filter((tab) => tab.id !== active.id);
          const next: TabGroupState[] = [];
          if (rest.length > 0)
            next.push({ id: group.id, tabs: rest, activeId: rest[0]?.id ?? null });
          next.push({
            id: group.id === 'a' ? 'b' : 'a',
            tabs: [active.transient ? { ...active, transient: false } : active],
            activeId: active.id,
          });
          return next;
        });
      });
    },
    [groups, flushGroup],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && agentExpanded) {
        setAgentExpanded(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (event.altKey) setRightCollapsed((value) => !value);
        else setLeftCollapsed((value) => !value);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault();
        splitGroup(0);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [agentExpanded, splitGroup]);

  const activeSession = session.sessions?.find((item) => item.id === session.activeSessionId);
  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const activeResource = activeGroup?.tabs.find((tab) => tab.id === activeGroup.activeId)?.resource;
  const activeFile = activeResource ? projectTarget(activeResource) : undefined;
  /** 用现有 tab 逻辑打开内容：收起 overlay，不切换会话。 */
  const openTab = (tab: TabItem) => {
    flushGroup(
      groups.findIndex((group) => group.id === activeGroupId),
      () => {
        setAgentExpanded(false);
        const targetGroupId =
          groups.find((group) => group.id === activeGroupId)?.id ?? groups[0]?.id ?? 'a';
        setGroups((current) =>
          current.length
            ? current.map((group) =>
                group.id === targetGroupId
                  ? {
                      ...group,
                      tabs: [...group.tabs.filter((item) => item.id !== tab.id), tab],
                      activeId: tab.id,
                    }
                  : group,
              )
            : [{ id: 'a', tabs: [tab], activeId: tab.id }],
        );
        setActiveGroupId(targetGroupId);
      },
    );
  };
  const settings = () => openTab({ id: 'settings', title: '设置', kind: 'settings' });
  const openLibrary = session.library
    ? () => openTab({ id: 'library', title: '文献库', kind: 'library' })
    : undefined;
  const view = (
    groupIndex: number,
    mode: import('./tab-state').FileViewMode | 'split' | 'split-render',
  ) =>
    setGroups((current) => {
      const group = current[groupIndex];
      const active = group?.tabs.find((tab) => tab.id === group.activeId);
      if (!active?.resource) return current;
      const key = resourceKey(active.resource);
      if (active.resource.locator.source === 'library') {
        if (mode !== 'source' && mode !== 'preview') return current;
        const preview = mode === 'preview';
        const target: TabItem = {
          ...active,
          id: `${key}${preview ? ':preview' : ''}`,
          kind: preview ? 'preview' : 'editor',
          transient: false,
          title: `${active.resource.name}${preview ? ' · 预览' : ''}`,
          editorMode: mode,
        };
        return current.map((item, index) =>
          index === groupIndex
            ? {
                ...item,
                tabs: [
                  ...item.tabs.filter(
                    (tab) =>
                      !tab.resource ||
                      resourceKey(tab.resource) !== key ||
                      (tab.kind !== 'editor' && tab.kind !== 'preview'),
                  ),
                  target,
                ],
                activeId: target.id,
              }
            : item,
        );
      }
      const projectFile = projectTarget(active.resource);
      if (!projectFile || active.resource.locator.source !== 'project') return current;
      const editor: TabItem = {
        ...active,
        id: key,
        kind: resourceTabKind(active.resource),
        transient: false,
        editorMode: mode === 'visual' ? 'visual' : 'source',
      };
      const preview: TabItem = {
        ...active,
        id: `${key}:preview`,
        kind: 'preview',
        transient: false,
        title: `${active.resource.name} · 预览`,
        editorMode: mode === 'split-render' || mode === 'render' ? 'render' : 'preview',
      };
      if (mode === 'split' || mode === 'split-render') {
        const first = current[0] ?? { id: 'a', tabs: [], activeId: null };
        const second = current[1] ?? { id: 'b', tabs: [], activeId: null };
        return [
          {
            ...first,
            tabs: [
              ...first.tabs.filter((tab) => tab.id !== editor.id && tab.id !== preview.id),
              editor,
            ],
            activeId: editor.id,
          },
          {
            ...second,
            tabs: [
              ...second.tabs.filter((tab) => tab.id !== preview.id && tab.id !== editor.id),
              preview,
            ],
            activeId: preview.id,
          },
        ];
      }
      const target = mode === 'preview' || mode === 'render' ? preview : editor;
      return current.map((item, index) =>
        index === groupIndex
          ? {
              ...item,
              tabs: [
                ...item.tabs.filter((tab) => tab.id !== active.id && tab.id !== target.id),
                target,
              ],
              activeId: target.id,
            }
          : item,
      );
    });

  useEffect(() => {
    const target = session.resourceTarget;
    if (!target) return;
    if (target.locator.source === 'project' && target.locator.projectId !== currentProject.current)
      return;
    setAgentExpanded(false);
    let live = true;
    flushGroup(
      groupsRef.current.findIndex((group) => group.id === activeGroupRef.current),
      () => {
        if (!live) return;
        const next = openResourceTab(
          { groups: groupsRef.current, activeGroupId: activeGroupRef.current },
          target,
          isResourceDirtyRef.current,
        );
        setGroups(next.groups);
        setActiveGroupId(next.activeGroupId);
      },
    );
    return () => {
      live = false;
    };
  }, [session.resourceTarget, flushGroup]);

  const content = (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerDraft storageKey={session.draftKey} runtime={runtime} />
      <main
        className="shell"
        style={
          {
            '--pane-left-w': `${leftWidth}px`,
            '--pane-right-w': `${rightWidth}px`,
            '--dock-h': `${dockHeight}px`,
          } as CSSProperties
        }
      >
        {leftCollapsed ? (
          <ActivityRail
            onExpand={() => setLeftCollapsed(false)}
            openLibrary={openLibrary}
            openSessionSearch={session.openSessionSearch}
            openProjectOnboarding={session.openProjectOnboarding}
          />
        ) : (
          <ActivityPane
            status={session.status}
            connection={session.connection}
            sessions={session.sessions ?? []}
            activeSessionId={session.activeSessionId}
            selectSession={session.selectSession}
            createSession={session.createSession}
            theme={theme}
            onCycleTheme={() =>
              setTheme((current) => {
                const index = THEME_ORDER.indexOf(current);
                return THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? 'system';
              })
            }
            onCollapse={() => setLeftCollapsed(true)}
            sessionNavigation={session.sessionNavigation}
            openSettings={session.controls ? settings : undefined}
            openLibrary={openLibrary}
            openSessionSearch={session.openSessionSearch}
            openProjectOnboarding={session.openProjectOnboarding}
          />
        )}

        {!leftCollapsed && (
          <PaneHandle
            label="调整左区宽度"
            orientation="vertical"
            className="pane-handle--left"
            varName="--pane-left-w"
            value={leftWidth}
            defaultValue={260}
            min={220}
            max={360}
            sign={1}
            reserve={() => rightRef.current + 490}
            onChange={setLeftWidth}
          />
        )}

        <ThreadPrimitive.Root className="center">
          <TabGroups
            groups={groups}
            onActivate={activateTab}
            onClose={closeTab}
            onSplit={splitGroup}
            renderResource={
              session.renderResource
                ? (target, mode, onDirty, viewId) =>
                    session.renderResource?.(target, mode, onDirty, viewId)
                : undefined
            }
            onPin={pinTab}
            renderSettings={session.controls}
            renderLibrary={session.library}
            onView={(groupIndex, mode) => {
              const group = groupsRef.current[groupIndex];
              const target = group?.tabs.find((tab) => tab.id === group.activeId)?.resource;
              void (
                target && session.flushResource ? session.flushResource(target) : Promise.resolve()
              ).then(
                () => view(groupIndex, mode),
                () => {},
              );
            }}
            contextName={session.executionContext?.project}
            onOpenSettings={session.controls ? settings : undefined}
          />
          {agentExpanded ? (
            <AgentOverlay
              ref={overlayRef}
              title={session.activeSessionTitle ?? activeSession?.title ?? 'Agent 会话'}
              messageKey={`${session.projectId ?? 'sample'}:${session.activeSessionId ?? ''}`}
              openFile={session.openMessageFile}
              openResource={session.openMessageResource}
              context={session.executionContext}
              reset={session.reset ? reset : undefined}
              onCollapse={() => setAgentExpanded(false)}
              cancel={session.cancel}
              loadEarlier={session.loadEarlier}
            />
          ) : (
            <>
              <PaneHandle
                label="调整 Agent 面板高度"
                orientation="horizontal"
                varName="--dock-h"
                value={dockHeight}
                defaultValue={180}
                min={120}
                max={320}
                sign={-1}
                onChange={setDockHeight}
              />
              <AgentDock
                messages={session.adapter.messages ?? []}
                context={session.executionContext}
                reset={session.reset ? reset : undefined}
                onExpand={() => setAgentExpanded(true)}
                cancel={session.cancel}
              />
            </>
          )}
        </ThreadPrimitive.Root>

        {!rightCollapsed && (
          <PaneHandle
            label="调整右区宽度"
            orientation="vertical"
            className="pane-handle--right"
            varName="--pane-right-w"
            value={rightWidth}
            defaultValue={300}
            min={260}
            max={420}
            sign={-1}
            reserve={() => leftRef.current + 490}
            onChange={setRightWidth}
          />
        )}

        {rightCollapsed ? (
          <AuxiliaryRail onExpand={() => setRightCollapsed(false)} />
        ) : (
          <AuxiliaryPane
            fileTree={session.fileTree ?? []}
            tasks={session.tasks ?? []}
            materials={session.materials}
            selectedMaterials={session.selectedMaterials}
            toggleMaterial={session.toggleMaterial}
            onCollapse={() => setRightCollapsed(true)}
            fileNavigator={
              typeof session.fileNavigator === 'function'
                ? session.fileNavigator(activeFile)
                : session.fileNavigator
            }
          />
        )}
        <StatusBar
          key={`${session.projectId ?? 'sample'}:${session.activeSessionId ?? ''}`}
          session={session}
        />
        {session.sessionSearchDialog}
        {session.projectOnboardingDialog}
        {session.projectTrustDialog}
      </main>
    </AssistantRuntimeProvider>
  );
  return (
    <ContextContributionProvider
      items={session.contextItems}
      appendContextItem={session.appendContextItem}
      removeContextItem={session.removeContextItem}
      updateContextComment={session.updateContextComment}
      contextError={session.contextError}
      publishContext={session.publishContext}
      activeViewId={activeResource ? activeGroupId : null}
      receiver={
        session.projectId && session.activeSessionId
          ? { projectId: session.projectId, sessionId: session.activeSessionId }
          : null
      }
    >
      {content}
    </ContextContributionProvider>
  );
}
