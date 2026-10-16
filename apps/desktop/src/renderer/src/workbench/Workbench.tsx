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
import { readDraft, subscribeDraft, writeDraft } from './drafts';
import type { WorkbenchSession } from './session';
import { ActivityPane, ActivityRail, type ThemeMode } from './shell/ActivityPane';
import { AgentDock } from './shell/AgentDock';
import { AgentOverlay } from './shell/AgentOverlay';
import { AuxiliaryPane, AuxiliaryRail } from './shell/AuxiliaryPane';
import { PaneHandle } from './shell/PaneHandle';
import { type TabGroupState, TabGroups, type TabItem } from './shell/TabGroups';

const THEME_ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];

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
      ? [{ id: 'a', tabs: session.initialTabs, activeId: session.initialTabs[0]?.id ?? null }]
      : [],
  );
  const projectGroups = useRef(new Map<string, readonly TabGroupState[]>());
  const currentProject = useRef(session.projectId ?? 'sample');
  useLayoutEffect(() => {
    const next = session.projectId ?? 'sample';
    if (next === currentProject.current) return;
    // 共同材料独立于项目会话；只把项目自己的tab存入项目布局。
    projectGroups.current.set(
      currentProject.current,
      groups.flatMap((group) => {
        const tabs = group.tabs.filter((tab) => !tab.material);
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
    currentProject.current = next;
    const restored = [...(projectGroups.current.get(next) ?? [])];
    for (const group of groups) {
      const tabs = group.tabs.filter((tab) => tab.material);
      if (!tabs.length) continue;
      const index = restored.findIndex((target) => target.id === group.id);
      const target = restored[index];
      const activeId = tabs.some((tab) => tab.id === group.activeId)
        ? group.activeId
        : (target?.activeId ?? tabs[0]?.id ?? null);
      const combined = { ...group, tabs: [...(target?.tabs ?? []), ...tabs], activeId };
      if (index >= 0) restored[index] = combined;
      else restored.push(combined);
    }
    setGroups(restored);
  }, [session.projectId, groups]);

  const resolveFiles = useRef(session.resolveFiles);
  resolveFiles.current = session.resolveFiles;
  const fileIds = JSON.stringify([
    ...new Set(
      groups.flatMap((group) =>
        group.tabs.flatMap((tab) => (tab.target?.fileId ? [tab.target.fileId] : [])),
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
            const path = tab.target?.fileId ? paths.get(tab.target.fileId) : undefined;
            return path && tab.target && path !== tab.target.path
              ? {
                  ...tab,
                  title: `${path.split('/').at(-1)}${tab.kind === 'preview' ? ' · 预览' : ''}`,
                  target: { ...tab.target, path },
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

  const activateTab = useCallback((groupIndex: number, tabId: string) => {
    setGroups((current) =>
      current.map((group, index) => (index === groupIndex ? { ...group, activeId: tabId } : group)),
    );
  }, []);

  const closeTab = useCallback((groupIndex: number, tabId: string) => {
    setGroups((current) => {
      const next = current.map((group, index) => {
        if (index !== groupIndex) return group;
        const tabs = group.tabs.filter((tab) => tab.id !== tabId);
        const activeId = group.activeId === tabId ? (tabs[0]?.id ?? null) : group.activeId;
        return { id: group.id, tabs, activeId };
      });
      return next.filter((group) => group.tabs.length > 0);
    });
  }, []);

  const splitGroup = useCallback((groupIndex: number) => {
    setGroups((current) => {
      if (current.length >= 2) return current;
      const group = current[groupIndex];
      if (group === undefined || group.activeId === null || group.tabs.length < 2) return current;
      const active = group.tabs.find((tab) => tab.id === group.activeId);
      if (active === undefined) return current;
      const rest = group.tabs.filter((tab) => tab.id !== active.id);
      const next: TabGroupState[] = [];
      if (rest.length > 0) next.push({ id: group.id, tabs: rest, activeId: rest[0]?.id ?? null });
      next.push({ id: group.id === 'a' ? 'b' : 'a', tabs: [active], activeId: active.id });
      return next;
    });
  }, []);

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
  /** 用现有 tab 逻辑打开内容：收起 overlay，不切换会话。 */
  const openTab = (tab: TabItem) => {
    setAgentExpanded(false);
    setGroups((current) =>
      current.length
        ? current.map((group, index) =>
            index === 0
              ? {
                  ...group,
                  tabs: [...group.tabs.filter((item) => item.id !== tab.id), tab],
                  activeId: tab.id,
                }
              : group,
          )
        : [{ id: 'a', tabs: [tab], activeId: tab.id }],
    );
  };
  const settings = () => openTab({ id: 'settings', title: '设置', kind: 'settings' });
  const openLibrary = session.library
    ? () => openTab({ id: 'library', title: '文献库', kind: 'library' })
    : undefined;
  const view = (groupIndex: number, mode: 'source' | 'preview' | 'split') =>
    setGroups((current) => {
      const group = current[groupIndex];
      const active = group?.tabs.find((tab) => tab.id === group.activeId);
      if (!active?.target) return current;
      const key = `${active.target.projectId}:${active.target.fileId ?? active.target.path}`;
      const editor: TabItem = { ...active, id: key, kind: 'editor' };
      const preview: TabItem = {
        ...active,
        id: `${key}:preview`,
        kind: 'preview',
        title: `${active.target.path.split('/').at(-1)} · 预览`,
      };
      if (mode === 'split') {
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
      const target = mode === 'preview' ? preview : editor;
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
    const target = session.fileTarget;
    if (!target || target.projectId !== session.projectId) return;
    // 成果经文件 tab 打开，收起 overlay 才能看到实际内容。
    setAgentExpanded(false);
    const tab = {
      id: `${target.projectId}:${target.fileId ?? target.path}`,
      title: target.path.split('/').at(-1) ?? target.path,
      kind: 'editor' as const,
      target,
    };
    setGroups((previous) => {
      const current = target.fileId
        ? previous.map((group) => {
            let activeId = group.activeId;
            const tabs = group.tabs.map((item) => {
              if (
                item.target?.projectId !== target.projectId ||
                item.target.path !== target.path ||
                item.target.fileId
              )
                return item;
              const id = `${tab.id}${item.kind === 'preview' ? ':preview' : ''}`;
              if (activeId === item.id) activeId = id;
              return { ...item, id, target };
            });
            return { ...group, tabs, activeId };
          })
        : previous;
      const existing = current.findIndex((group) =>
        group.tabs.some(
          (item) =>
            item.id === tab.id ||
            (item.kind === 'editor' &&
              item.target?.projectId === target.projectId &&
              item.target.path === target.path &&
              !item.target.fileId),
        ),
      );
      if (existing >= 0)
        return current.map((group, index) =>
          index === existing
            ? {
                ...group,
                activeId: tab.id,
                tabs: group.tabs.map((item) =>
                  item.id === tab.id ||
                  (item.kind === 'editor' &&
                    item.target?.path === target.path &&
                    !item.target.fileId)
                    ? tab
                    : item,
                ),
              }
            : group,
        );
      if (!current.length) return [{ id: 'a', tabs: [tab], activeId: tab.id }];
      return current.map((group, index) =>
        index === 0 ? { ...group, tabs: [...group.tabs, tab], activeId: tab.id } : group,
      );
    });
  }, [session.fileTarget, session.projectId]);

  useEffect(() => {
    const material = session.pdfTarget;
    if (!material) return;
    setAgentExpanded(false);
    const tab = {
      id: `pdf:${material.id}:${material.materialVersionId}`,
      title: material.name,
      kind: 'reader' as const,
      material,
    };
    setGroups((current) => {
      const existing = current.findIndex((group) => group.tabs.some((item) => item.id === tab.id));
      if (existing >= 0)
        return current.map((group, index) =>
          index === existing ? { ...group, activeId: tab.id } : group,
        );
      if (!current.length) return [{ id: 'a', tabs: [tab], activeId: tab.id }];
      return current.map((group, index) =>
        index === 0 ? { ...group, tabs: [...group.tabs, tab], activeId: tab.id } : group,
      );
    });
  }, [session.pdfTarget]);

  return (
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
            createSession={session.createSession}
            openLibrary={openLibrary}
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
            projectControls={session.projectControls}
            sessionNavigation={session.sessionNavigation}
            openSettings={session.controls ? settings : undefined}
            openLibrary={openLibrary}
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
          {!agentExpanded ? session.notices : null}
          {!agentExpanded ? session.artifacts : null}
          <TabGroups
            groups={groups}
            onActivate={activateTab}
            onClose={closeTab}
            onSplit={splitGroup}
            renderFile={session.renderFile}
            renderSettings={session.controls}
            renderLibrary={session.library}
            renderPdf={session.renderPdf}
            onView={view}
            contextName={session.executionContext?.project}
            onCreateSession={session.createSession}
            onOpenSettings={session.controls ? settings : undefined}
          />
          {agentExpanded ? (
            <AgentOverlay
              ref={overlayRef}
              title={session.activeSessionTitle ?? activeSession?.title ?? 'Agent 会话'}
              messageKey={`${session.projectId ?? 'sample'}:${session.activeSessionId ?? ''}`}
              openFile={session.openMessageFile}
              context={session.executionContext}
              artifacts={session.artifacts}
              notices={session.notices}
              reset={session.reset ? reset : undefined}
              onCollapse={() => setAgentExpanded(false)}
              cancel={session.cancel}
              resume={session.resume}
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
                resume={session.resume}
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
            fileNavigator={session.fileNavigator}
          />
        )}
      </main>
    </AssistantRuntimeProvider>
  );
}
