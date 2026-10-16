import type { KernelClient } from '@scholoom/client';
import type { BusinessParams, Project, Session } from '@scholoom/protocol';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { relativeTime } from './relative-time';
import { IconFolder, IconFolderOpen } from './shell/icons';
import { ConfirmAction, ContextMenu, Menu, MenuFormItem, MenuItem } from './shell/menu';

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
  const [title, setTitle] = useState(item.title);
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setTitle(item.title), [item.title]);
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
          title,
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
  const openKeyboardMenu = () => {
    const rect = row.current?.getBoundingClientRect();
    setMenu({ x: rect ? rect.left + 24 : 24, y: rect ? rect.bottom + 4 : 24 });
  };
  return (
    <li data-session-id={item.id}>
      <div className="session-row">
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
            setMenu({ x: event.clientX, y: event.clientY });
          }}
          onKeyDown={(event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              event.preventDefault();
              openKeyboardMenu();
            }
          }}
        >
          <span
            className={
              running ? 'dot dot--run' : item.state === 'failed' ? 'dot dot--err' : 'dot dot--idle'
            }
            role="img"
            aria-label={running ? '运行中' : item.state === 'failed' ? '失败' : '已停止'}
          />
          <span className="session__title" title={item.title}>
            {item.title}
          </span>
          <time className="session__time" dateTime={item.updatedAt}>
            {relativeTime(item.updatedAt)}
          </time>
        </button>
        {menu ? (
          <ContextMenu
            label={`管理会话 ${item.title}`}
            position={menu}
            onClose={closeMenu}
            returnFocus={row}
          >
            <MenuFormItem
              legend="会话标题"
              onSubmit={() =>
                void update(true).then((done) => {
                  if (done) closeMenu();
                })
              }
            >
              <input
                aria-label={`会话标题 ${item.title}`}
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!enabled || busy}
              />
              <button type="submit" className="btn" disabled={!enabled || busy || !title.trim()}>
                保存标题
              </button>
            </MenuFormItem>
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
    </li>
  );
}

/** 当前项目行：整行折叠/展开会话列表，行尾菜单集中项目操作。 */
function ProjectNode({
  project,
  projects,
  client,
  enabled,
  selectProject,
  forgetProject,
  changed,
  children,
}: {
  project: Project | undefined;
  projects: readonly Project[];
  client: KernelClient;
  enabled: boolean;
  selectProject: (id: string) => void;
  forgetProject: (removedId: string, nextId: string) => void;
  changed: () => Promise<void>;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = project?.id ?? 'application';
  const name = project?.name ?? '正在读取项目';
  const application = id === 'application';
  const recent = projects.filter((item) => item.id !== id && item.recent !== false);
  useEffect(() => setDisplayName(name), [name]);
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
  };

  return (
    <div className="project-node">
      <div className="project-row">
        <button
          type="button"
          className="project-header"
          onClick={() => setExpanded(!expanded)}
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
        <Menu label={`管理项目 ${name}`} className="project-actions">
          {recent.length ? (
            <>
              <p className="menu__hint">切换最近项目</p>
              {recent.map((item) => (
                <MenuItem key={item.id} disabled={!enabled} onSelect={() => selectProject(item.id)}>
                  {item.name}
                </MenuItem>
              ))}
            </>
          ) : null}
          {!application ? (
            <>
              <MenuFormItem
                legend="显示名"
                onSubmit={() =>
                  void run(async () => {
                    const renamed = await client.call('project.rename', {
                      projectId: id,
                      name: displayName.trim(),
                    });
                    setDisplayName(renamed.name);
                  })
                }
              >
                <input
                  aria-label="项目显示名"
                  value={displayName}
                  maxLength={200}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={!enabled || busy}
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={!enabled || busy || !displayName.trim()}
                >
                  保存显示名
                </button>
              </MenuFormItem>
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
                  移出最近列表
                </MenuItem>
              )}
            </>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </Menu>
      </div>
      {expanded ? children : null}
    </div>
  );
}

/** 项目区底部”添加项目”行：已移至 ProjectOnboarding.tsx 作为弹窗形式。 */

export function SessionList({
  client,
  projects,
  projectId,
  activeSessionId,
  enabled,
  select,
  selectProject,
  forgetProject,
  onChanged,
}: {
  client: KernelClient;
  projects: readonly Project[];
  projectId: string;
  activeSessionId: string;
  enabled: boolean;
  select: (id: string) => void;
  selectProject: (id: string) => void;
  forgetProject: (removedId: string, nextId: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nextCursor, setNextCursor] = useState<Cursor>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const treeRef = useRef<HTMLDivElement>(null);

  // 加载会话列表（固定 archived: false）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 固定依赖，revision 只作为刷新信号
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await client.call('session.list', {
          projectId,
          archived: false,
          limit: 50,
        });
        if (active) {
          setSessions(result.sessions);
          setNextCursor(result.nextCursor);
          setError('');
        }
      } catch (reason) {
        if (active) setError(messageOf(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const unsubscribe = client.subscribeChanges((change) => {
      if (change.sessionsChanged && (!change.projectId || change.projectId === projectId)) {
        void load();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, projectId, enabled, revision]);

  // 滚动加载下一页
  const loadMore = useCallback(async () => {
    if (!nextCursor || !enabled || loading) return;
    try {
      const result = await client.call('session.list', {
        projectId,
        archived: false,
        cursor: nextCursor,
        limit: 50,
      });
      setSessions((prev) => {
        // 按 id 去重
        const idSet = new Set(prev.map((s) => s.id));
        const newItems = result.sessions.filter((s) => !idSet.has(s.id));
        return [...prev, ...newItems];
      });
      setNextCursor(result.nextCursor);
    } catch (reason) {
      setError(messageOf(reason));
    }
  }, [client, projectId, nextCursor, enabled, loading]);

  // 监听滚动事件
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = tree;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        void loadMore();
      }
    };
    tree.addEventListener('scroll', handleScroll);
    return () => tree.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  const changed = async () => {
    setRevision((value) => value + 1);
    await onChanged();
  };

  const project = projects.find((item) => item.id === projectId);

  return (
    <section className="session-navigation" aria-label="会话管理">
      {error ? (
        <p role="alert">
          {error}
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            重试列表
          </button>
        </p>
      ) : null}
      <div className="project-tree" role="tree" ref={treeRef}>
        <ProjectNode
          project={project}
          projects={projects}
          client={client}
          enabled={enabled}
          selectProject={selectProject}
          forgetProject={forgetProject}
          changed={changed}
        >
          <ul className="session-list session-list--nested">
            {sessions.map((item) => (
              <SessionRow
                key={item.id}
                item={item}
                selected={item.id === activeSessionId}
                enabled={enabled}
                client={client}
                select={() => select(item.id)}
                changed={changed}
              />
            ))}
          </ul>
        </ProjectNode>
        {!sessions.length && !loading ? <p className="empty-hint">没有活动会话</p> : null}
        {loading ? <p className="empty-hint">正在读取会话…</p> : null}
      </div>
    </section>
  );
}
