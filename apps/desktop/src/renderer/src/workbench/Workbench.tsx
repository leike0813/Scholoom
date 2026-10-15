import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readDraft, subscribeDraft, writeDraft } from './drafts';
import type { WorkbenchSession } from './session';
import { ActivityPane, ActivityRail, type ThemeMode } from './shell/ActivityPane';
import { AgentDock } from './shell/AgentDock';
import { AgentOverlay } from './shell/AgentOverlay';
import { AuxiliaryPane, AuxiliaryRail } from './shell/AuxiliaryPane';
import { type TabGroupState, TabGroups, type TabItem } from './shell/TabGroups';

const DEFAULT_TABS: readonly TabItem[] = [
  { id: 'library', title: '文献库', kind: 'library' },
  { id: 'reader', title: '阅读器', kind: 'reader' },
  { id: 'editor', title: '编辑器', kind: 'editor' },
];

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
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [groups, setGroups] = useState<readonly TabGroupState[]>([
    { id: 'a', tabs: DEFAULT_TABS, activeId: DEFAULT_TABS[0]?.id ?? null },
  ]);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && agentExpanded) {
        setAgentExpanded(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (event.altKey) setRightCollapsed((value) => !value);
        else setLeftCollapsed((value) => !value);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [agentExpanded]);

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

  const activeSession = session.sessions?.find((item) => item.id === session.activeSessionId);

  useEffect(() => {
    const target = session.fileTarget;
    if (!target) return;
    const tab = {
      id: `${target.projectId}:${target.path}`,
      title: target.path.split('/').at(-1) ?? target.path,
      kind: 'editor' as const,
      target,
    };
    setGroups((current) => {
      const existing = current.findIndex((group) => group.tabs.some((item) => item.id === tab.id));
      if (existing >= 0)
        return current.map((group, index) =>
          index === existing
            ? {
                ...group,
                activeId: tab.id,
                tabs: group.tabs.map((item) => (item.id === tab.id ? tab : item)),
              }
            : group,
        );
      if (!current.length) return [{ id: 'a', tabs: [tab], activeId: tab.id }];
      return current.map((group, index) =>
        index === 0 ? { ...group, tabs: [...group.tabs, tab], activeId: tab.id } : group,
      );
    });
  }, [session.fileTarget]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerDraft storageKey={session.draftKey} runtime={runtime} />
      <main className="shell">
        {leftCollapsed ? (
          <ActivityRail onExpand={() => setLeftCollapsed(false)} />
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
          />
        )}

        <ThreadPrimitive.Root className="center">
          {session.controls}
          <TabGroups
            groups={groups}
            onActivate={activateTab}
            onClose={closeTab}
            onSplit={splitGroup}
            renderFile={session.renderFile}
          />
          {agentExpanded ? (
            <AgentOverlay
              ref={overlayRef}
              title={activeSession?.title ?? 'Agent 会话'}
              reset={session.reset ? reset : undefined}
              onCollapse={() => setAgentExpanded(false)}
              cancel={session.cancel}
              resume={session.resume}
              loadEarlier={session.loadEarlier}
            />
          ) : (
            <AgentDock
              messages={session.adapter.messages ?? []}
              reset={session.reset ? reset : undefined}
              onExpand={() => setAgentExpanded(true)}
              cancel={session.cancel}
              resume={session.resume}
            />
          )}
        </ThreadPrimitive.Root>

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
