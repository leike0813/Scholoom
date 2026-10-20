import type { KernelClient } from '@scholoom/client';
import type { BusinessParams, Project, Session } from '@scholoom/protocol';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { draftKey, readDraft, writeDraft } from './drafts';
import { relativeTime } from './relative-time';
import { IconClose, IconFolder, IconFolderOpen, IconMore, IconPlus } from './shell/icons';
import { ConfirmAction, ContextMenu, MenuItem } from './shell/menu';

type Cursor = NonNullable<BusinessParams<'session.list'>['cursor']>;

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';

function SessionRow({
  item,
  selected,
  enabled,
  select,
  client,
  changed,
}: {
  item: Session;
  selected: boolean;
  enabled: boolean;
  select: () => void;
  client: KernelClient;
  changed: () => Promise<void>;
}) {
  const row = useRef<HTMLButtonElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(item.title);
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => {
    if (!editing) return;
    titleInput.current?.focus();
    titleInput.current?.select();
  }, [editing]);
  const running = ['queued', 'running', 'cancelling'].includes(item.state);
  const closeMenu = useCallback(() => setMenu(undefined), []);
  const update = async (rename: boolean): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      if (rename)
        await client.call('session.rename', {
          projectId: item.projectId,
          sessionId: item.id,
          title: title.trim(),
        });
      else
        await client.call('session.archive', {
          projectId: item.projectId,
          sessionId: item.id,
          archived: !item.archived,
        });
      await changed();
      return true;
    } catch (reason) {
      setError(messageOf(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const stopEditing = () => {
    setEditing(false);
    setTitle(item.title);
    setError('');
    requestAnimationFrame(() => row.current?.focus());
  };
  const openKeyboardMenu = () => {
    const rect = row.current?.getBoundingClientRect();
    setMenu({ x: rect ? rect.left + 24 : 24, y: rect ? rect.bottom + 4 : 24 });
  };
  const dot = running ? 'dot dot--run' : item.state === 'failed' ? 'dot dot--err' : 'dot dot--idle';
  const stateLabel = running ? '运行中' : item.state === 'failed' ? '失败' : '已停止';
  return (
    <li data-session-id={item.id}>
      <div className="session-row">
        {editing ? (
          <form
            className="session session--editing"
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim() === item.title) return stopEditing();
              void update(true).then((done) =>
                done ? stopEditing() : titleInput.current?.focus(),
              );
            }}
          >
            <span className={dot} role="img" aria-label={stateLabel} />
            <input
              ref={titleInput}
              aria-label={`会话标题 ${item.title}`}
              value={title}
              maxLength={200}
              required
              disabled={!enabled || busy}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                if (!busy) stopEditing();
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                stopEditing();
              }}
            />
          </form>
        ) : (
          <button
            ref={row}
            type="button"
            className={`session${selected ? ' session--active' : ''}`}
            aria-label={`打开会话 ${item.title}`}
            aria-pressed={selected}
            aria-haspopup="menu"
            aria-expanded={menu !== undefined}
            onClick={select}
            onContextMenu={(event) => {
              event.preventDefault();
              setError('');
              setMenu({ x: event.clientX, y: event.clientY });
            }}
            onKeyDown={(event) => {
              if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault();
                setError('');
                openKeyboardMenu();
              }
            }}
          >
            <span className={dot} role="img" aria-label={stateLabel} />
            <span className="session__title" title={item.title}>
              {item.title}
            </span>
            <time className="session__time" dateTime={item.updatedAt}>
              {relativeTime(item.updatedAt)}
            </time>
          </button>
        )}
        {menu ? (
          <ContextMenu
            label={`管理会话 ${item.title}`}
            position={menu}
            onClose={closeMenu}
            returnFocus={row}
          >
            <MenuItem disabled={!enabled || busy} onSelect={() => setEditing(true)}>
              重命名
            </MenuItem>
            <MenuItem
              disabled={!enabled || busy || (running && !item.archived)}
              reason={running && !item.archived ? '停止执行后可归档' : undefined}
              onSelect={() => update(false)}
            >
              {item.archived ? '恢复会话' : '归档会话'}
            </MenuItem>
            {error ? <p role="alert">{error}</p> : null}
          </ContextMenu>
        ) : null}
      </div>
      {editing && error ? (
        <p className="session-row__error" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** 项目行保留明确的新建接收者，菜单只承载项目操作。 */
function ProjectNode({
  project,
  projects,
  client,
  enabled,
  selectProject,
  createSession,
  forgetProject,
  changed,
  expanded,
  onExpandedChange,
  children,
}: {
  project: Project;
  projects: readonly Project[];
  client: KernelClient;
  enabled: boolean;
  selectProject: (id: string) => void;
  createSession: ((id: string) => void) | undefined;
  forgetProject: (removedId: string, nextId: string) => void;
  changed: () => Promise<void>;
  expanded: boolean;
  onExpandedChange: () => void;
  children: ReactNode;
}) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { id, name } = project;
  const application = id === 'application';
  const closeMenu = useCallback(() => setMenu(undefined), []);
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      await action();
      await changed();
      return true;
    } catch (reason) {
      setError(messageOf(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const forget = async () => {
    const next =
      projects.find((item) => item.id !== id && item.id !== 'application' && item.recent !== false)
        ?.id ?? 'application';
    const done = await run(() => client.call('project.forget', { projectId: id }));
    if (done) forgetProject(id, next);
    return done;
  };

  return (
    <div className="project-node" data-project-id={id}>
      <div className="project-row">
        <button
          type="button"
          className="project-header"
          onClick={onExpandedChange}
          aria-expanded={expanded}
          aria-label={`${name}，${expanded ? '已展开' : '已折叠'}`}
        >
          <span className="project-header__icon">
            {expanded ? <IconFolderOpen /> : <IconFolder />}
          </span>
          <span className="project-header__name" title={name}>
            {name}
          </span>
        </button>
        <button
          ref={menuButton}
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label={`管理项目 ${name}`}
          aria-haspopup="menu"
          aria-expanded={menu !== undefined}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu((current) => (current ? undefined : { x: rect.right, y: rect.bottom }));
            setConfirming(false);
            setError('');
          }}
        >
          <IconMore />
        </button>
        <button
          type="button"
          className="project-header__new-session"
          aria-label={`在${name}中新建会话`}
          title="新建会话"
          disabled={!enabled || !createSession}
          onClick={() => createSession?.(id)}
        >
          <IconPlus />
        </button>
      </div>
      {menu ? (
        <ContextMenu
          label={`管理项目 ${name}`}
          position={menu}
          onClose={closeMenu}
          trigger={menuButton}
        >
          <div className="project-menu__heading">
            <strong>{name}</strong>
            {!application ? <span>{project.path}</span> : null}
          </div>
          <MenuItem disabled={!enabled || busy} onSelect={() => selectProject(id)}>
            <IconFolderOpen />
            {application ? '打开普通会话' : '打开项目'}
          </MenuItem>
          {!application ? (
            <>
              <hr className="menu__separator" />
              {confirming ? (
                <ConfirmAction
                  description="移出最近列表只改变列表记录，不删除目录内容，也不停止执行。"
                  confirmLabel="确认移出"
                  busy={busy}
                  onConfirm={forget}
                  onCancel={() => setConfirming(false)}
                />
              ) : (
                <MenuItem
                  disabled={!enabled || busy}
                  onSelect={() => {
                    setConfirming(true);
                    return false;
                  }}
                >
                  <IconClose />
                  从侧栏移除
                </MenuItem>
              )}
            </>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </ContextMenu>
      ) : null}
      {expanded ? children : null}
    </div>
  );
}

function ProjectSessions({
  project,
  projects,
  client,
  enabled,
  selectedProjectId,
  activeSessionId,
  select,
  selectProject,
  createSession,
  forgetProject,
  onChanged,
  storageKey,
  treeRef,
}: {
  project: Project;
  projects: readonly Project[];
  client: KernelClient;
  enabled: boolean;
  selectedProjectId: string;
  activeSessionId: string;
  select: (projectId: string, sessionId: string) => void;
  selectProject: (id: string) => void;
  createSession: ((id: string) => void) | undefined;
  forgetProject: (removedId: string, nextId: string) => void;
  onChanged: () => Promise<void>;
  storageKey: string;
  treeRef: RefObject<HTMLDivElement | null>;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const expandedKey = draftKey(storageKey, project.id, 'session-list-expanded');
  const [expanded, setExpanded] = useState(() => {
    const saved = readDraft(expandedKey);
    return saved ? saved !== 'false' : project.id === selectedProjectId;
  });
  const cursorRef = useRef<Cursor | undefined>(undefined);
  const refreshingRef = useRef(false);
  const loadedCount = useRef(0);
  const requestVersion = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const selectedSession = project.id === selectedProjectId ? activeSessionId : undefined;

  useEffect(() => {
    if (selectedSession !== undefined) {
      setExpanded(true);
      writeDraft(expandedKey, 'true');
    }
  }, [selectedSession, expandedKey]);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    refreshingRef.current = true;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    const wantedCount = loadedCount.current;
    let cursor: Cursor | undefined;
    let next: Cursor | undefined;
    let loaded: Session[] = [];
    setLoading(true);
    try {
      do {
        const result = await client.call('session.list', {
          projectId: project.id,
          archived: false,
          ...(cursor ? { cursor } : {}),
          limit: 50,
        });
        if (version !== requestVersion.current) return;
        const ids = new Set(loaded.map((item) => item.id));
        loaded = [...loaded, ...result.sessions.filter((item) => !ids.has(item.id))];
        next = result.nextCursor;
        cursor = result.nextCursor;
      } while (next && loaded.length < wantedCount);
      setSessions(loaded);
      loadedCount.current = loaded.length;
      cursorRef.current = next;
      setNextCursor(next);
      setError('');
    } catch (reason) {
      if (version === requestVersion.current) setError(messageOf(reason));
    } finally {
      if (version === requestVersion.current) {
        refreshingRef.current = false;
        setLoading(false);
      }
    }
  }, [client, project.id]);

  useEffect(() => {
    if (enabled && expanded) void refresh();
    else {
      requestVersion.current++;
      refreshingRef.current = false;
      setLoading(false);
    }
    return () => {
      requestVersion.current++;
      refreshingRef.current = false;
    };
  }, [enabled, expanded, refresh]);

  useEffect(() => {
    if (!enabled) return;
    return client.subscribeChanges((change) => {
      const activeScopeChanged =
        project.id === selectedProjectId &&
        change.sessionsChanged &&
        (!change.projectId || change.projectId === project.id);
      if (expanded && (activeScopeChanged || change.sessionProjectIds?.includes(project.id)))
        void refresh();
    });
  }, [client, enabled, expanded, project.id, refresh, selectedProjectId]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!enabled || !expanded || !cursor || refreshingRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const version = requestVersion.current;
    try {
      const result = await client.call('session.list', {
        projectId: project.id,
        archived: false,
        cursor,
        limit: 50,
      });
      if (version !== requestVersion.current) return;
      setSessions((current) => {
        const ids = new Set(current.map((item) => item.id));
        const additions = result.sessions.filter((item) => !ids.has(item.id));
        loadedCount.current += additions.length;
        return [...current, ...additions];
      });
      cursorRef.current = result.nextCursor;
      setNextCursor(result.nextCursor);
      setError('');
    } catch (reason) {
      if (version === requestVersion.current) setError(messageOf(reason));
    } finally {
      if (version === requestVersion.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [client, enabled, expanded, project.id]);

  useEffect(() => {
    const root = treeRef.current;
    const target = sentinelRef.current;
    if (!expanded || !nextCursor || !root || !target || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root, rootMargin: '100px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [expanded, loadMore, nextCursor, treeRef]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    writeDraft(expandedKey, String(next));
  };
  const changed = async () => {
    await onChanged();
    await refresh();
  };
  return (
    <ProjectNode
      project={project}
      projects={projects}
      client={client}
      enabled={enabled}
      selectProject={selectProject}
      createSession={createSession}
      forgetProject={forgetProject}
      changed={changed}
      expanded={expanded}
      onExpandedChange={toggleExpanded}
    >
      <ul className="session-list session-list--nested">
        {sessions.map((item) => (
          <SessionRow
            key={item.id}
            item={item}
            selected={project.id === selectedProjectId && item.id === activeSessionId}
            enabled={enabled}
            client={client}
            select={() => select(project.id, item.id)}
            changed={changed}
          />
        ))}
      </ul>
      {error ? (
        <p role="alert">
          {error}
          <button type="button" onClick={() => void refresh()}>
            重试列表
          </button>
        </p>
      ) : null}
      {!sessions.length && !loading ? <p className="empty-hint">没有活动会话</p> : null}
      {loading ? <p className="empty-hint">正在读取会话…</p> : null}
      {loadingMore ? <p className="empty-hint">正在读取更多会话…</p> : null}
      <div ref={sentinelRef} aria-hidden="true" />
    </ProjectNode>
  );
}

export function SessionList({
  client,
  projects,
  projectId,
  activeSessionId,
  enabled,
  select,
  createSession,
  storageKey,
  selectProject,
  forgetProject,
  onChanged,
}: {
  client: KernelClient;
  projects: readonly Project[];
  projectId: string;
  activeSessionId: string;
  enabled: boolean;
  select: (projectId: string, id: string) => void;
  createSession: ((projectId: string) => void) | undefined;
  storageKey: string;
  selectProject: (id: string) => void;
  forgetProject: (removedId: string, nextId: string) => void;
  onChanged: () => Promise<void>;
}) {
  const treeRef = useRef<HTMLDivElement>(null);
  const changed = async () => onChanged();
  const visibleProjects = projects.filter((item) => item.recent !== false);
  const projectItems = [...visibleProjects];
  return (
    <section className="session-navigation" aria-label="会话管理">
      <div className="project-tree" role="tree" ref={treeRef}>
        {projectItems.map((project) => (
          <ProjectSessions
            key={project.id}
            project={project}
            projects={projects}
            client={client}
            enabled={enabled}
            selectedProjectId={projectId}
            activeSessionId={activeSessionId}
            select={select}
            selectProject={selectProject}
            createSession={createSession}
            forgetProject={forgetProject}
            onChanged={changed}
            storageKey={storageKey}
            treeRef={treeRef}
          />
        ))}
      </div>
    </section>
  );
}
