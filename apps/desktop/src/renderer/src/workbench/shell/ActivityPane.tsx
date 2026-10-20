import { type ReactNode, useState } from 'react';
import { relativeTime } from '../relative-time';
import type { SessionSummary, WorkbenchConnection } from '../session';
import {
  IconFolder,
  IconFolderOpen,
  IconLibrary,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSidebarLeft,
  IconTheme,
} from './icons';

export type ThemeMode = 'system' | 'light' | 'dark';

const themeLabels: Record<ThemeMode, string> = {
  system: '主题：跟随系统',
  light: '主题：浅色',
  dark: '主题：深色',
};

function StatusMark({ session }: { session: SessionSummary }) {
  if (session.status === 'awaiting') return <span className="pill pill--await">待审批</span>;
  if (session.status === 'running')
    return <span className="dot dot--run" role="img" aria-label="运行中" />;
  if (session.status === 'failed')
    return <span className="dot dot--err" role="img" aria-label="失败" />;
  return <span className="dot dot--idle" />;
}

interface ProjectGroup {
  id: string;
  sessions: SessionSummary[];
}

function groupSessionsByProject(sessions: readonly SessionSummary[]): ProjectGroup[] {
  // 样例注入单一项目；真实项目树由 sessionNavigation 提供。
  return sessions.length > 0 ? [{ id: 'default', sessions: [...sessions] }] : [];
}

function ProjectNode({
  project,
  sessions,
  activeSessionId,
  selectSession,
  onNewSession,
}: {
  project: ProjectGroup;
  sessions: SessionSummary[];
  activeSessionId: string | undefined;
  selectSession: ((id: string) => void) | undefined;
  onNewSession: (() => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(true);

  // 项目名称（暂时固定为"当前项目"）
  const projectName = project.id === 'default' ? '当前项目' : project.id;

  return (
    <div className="project-node">
      <div className="project-row">
        <button
          type="button"
          className="project-header"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${projectName}，${expanded ? '已展开' : '已折叠'}`}
        >
          <span className="project-header__icon">
            {expanded ? <IconFolderOpen /> : <IconFolder />}
          </span>
          <span className="project-header__name">{projectName}</span>
        </button>
        <button
          type="button"
          className="project-header__new-session"
          onClick={(e) => {
            e.stopPropagation();
            onNewSession?.();
          }}
          title="新建会话"
          aria-label={`在${projectName}中新建会话`}
          disabled={!onNewSession}
        >
          <IconPlus />
        </button>
      </div>

      {expanded && (
        <div className="session-list session-list--nested">
          {sessions.length === 0 ? (
            <p className="empty-hint" style={{ paddingLeft: '2rem' }}>
              暂无会话
            </p>
          ) : (
            <ul>
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className={`session${session.id === activeSessionId ? ' session--active' : ''}`}
                    aria-pressed={session.id === activeSessionId}
                    onClick={() => selectSession?.(session.id)}
                  >
                    <StatusMark session={session} />
                    <span className="session__title" title={session.title}>
                      {session.title}
                    </span>
                    <time className="session__time" dateTime={session.updatedAt}>
                      {relativeTime(session.updatedAt)}
                    </time>
                    {session.unread ? (
                      <span className="dot dot--unread" role="img" aria-label="有未读" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export interface ActivityPaneProps {
  sessionNavigation?: ReactNode;
  openSettings?: (() => void) | undefined;
  openLibrary?: (() => void) | undefined;
  openSessionSearch?: (() => void) | undefined;
  openProjectOnboarding?: (() => void) | undefined;
  status: string;
  connection?: WorkbenchConnection | undefined;
  sessions: readonly SessionSummary[];
  activeSessionId?: string | undefined;
  selectSession?: ((id: string) => void) | undefined;
  createSession?: (() => void) | undefined;
  theme: ThemeMode;
  onCycleTheme: () => void;
  onCollapse: () => void;
}

export function ActivityPane({
  status,
  connection,
  sessions,
  activeSessionId,
  selectSession,
  createSession,
  theme,
  onCycleTheme,
  onCollapse,
  openSettings,
  openLibrary,
  openSessionSearch,
  openProjectOnboarding,
  sessionNavigation,
}: ActivityPaneProps) {
  const kernelMessage =
    connection?.message ?? (status === 'sample' ? '样例场景 · 刷新后重置' : '内核未连接');
  const kernelDot =
    status === 'connected'
      ? 'dot dot--ok'
      : status === 'error' || status === 'stopped'
        ? 'dot dot--err'
        : 'dot dot--idle';
  const projectGroups = groupSessionsByProject(sessions);

  return (
    <aside className="side side--left" aria-label="会话与导航">
      <div className="side__header">
        <h1 className="brand">Scholoom</h1>
        <div className="side__header-actions">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={onCycleTheme}
            title={themeLabels[theme]}
            aria-label="切换主题"
          >
            <IconTheme />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onCollapse}
            title="折叠左区 (Ctrl+B)"
            aria-label="折叠左区"
          >
            <IconSidebarLeft />
          </button>
        </div>
      </div>

      <nav className="side-nav" aria-label="常用操作">
        <button
          type="button"
          className="side-nav__item"
          onClick={openSessionSearch}
          disabled={!openSessionSearch}
        >
          <IconSearch />
          查找会话
        </button>
        <button
          type="button"
          className="side-nav__item"
          onClick={openProjectOnboarding}
          disabled={!openProjectOnboarding}
        >
          <IconFolder />
          添加项目
        </button>
        <button
          type="button"
          className="side-nav__item"
          onClick={openLibrary}
          disabled={!openLibrary}
        >
          <IconLibrary />
          文献库
        </button>
        <button
          type="button"
          className="side-nav__item"
          onClick={openSettings}
          disabled={!openSettings}
        >
          <IconSettings />
          设置
        </button>
      </nav>

      <div className="section-label">
        <span>会话</span>
      </div>
      {sessionNavigation ??
        (projectGroups.length === 0 ? (
          <p className="empty-hint">暂无会话</p>
        ) : (
          <div className="project-tree" role="tree">
            {projectGroups.map((project) => (
              <ProjectNode
                key={project.id}
                project={project}
                sessions={project.sessions}
                activeSessionId={activeSessionId}
                selectSession={selectSession}
                onNewSession={createSession}
              />
            ))}
          </div>
        ))}

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: 状态行需键盘可达，聚焦后经 :focus-within 展开详情层 */}
      <div className="kernel-status" tabIndex={0}>
        <span className={kernelDot} role="img" aria-label="连接指示" />
        <p className="kernel-status__text" role="status" aria-label="连接状态">
          {kernelMessage}
        </p>
        <div className="kernel-status__popover">
          <p>{kernelMessage}</p>
          {connection?.instanceId ? (
            <p className="kernel-status__meta">实例 {connection.instanceId}</p>
          ) : null}
          {connection?.error ? (
            <p className="kernel-status__error">
              {connection.error.code}：{connection.error.message}
            </p>
          ) : null}
          {connection?.retry || connection?.inspect ? (
            <div className="kernel-status__actions">
              {connection.retry ? (
                <button type="button" className="text-btn" onClick={connection.retry}>
                  重试连接
                </button>
              ) : null}
              {connection.inspect ? (
                <button type="button" className="text-btn" onClick={connection.inspect}>
                  查询状态
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export function ActivityRail({
  onExpand,
  openLibrary,
  openSessionSearch,
  openProjectOnboarding,
}: {
  onExpand: () => void;
  openLibrary?: (() => void) | undefined;
  openSessionSearch?: (() => void) | undefined;
  openProjectOnboarding?: (() => void) | undefined;
}) {
  return (
    <aside className="rail rail--left" aria-label="导航（已折叠）">
      <button
        type="button"
        className="icon-btn"
        onClick={onExpand}
        title="展开左区 (Ctrl+B)"
        aria-label="展开左区"
      >
        <IconSidebarLeft />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="查找会话"
        aria-label="查找会话"
        onClick={openSessionSearch}
        disabled={!openSessionSearch}
      >
        <IconSearch />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="添加项目"
        aria-label="添加项目"
        onClick={openProjectOnboarding}
        disabled={!openProjectOnboarding}
      >
        <IconFolder />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="文献库"
        aria-label="文献库"
        onClick={openLibrary}
        disabled={!openLibrary}
      >
        <IconLibrary />
      </button>
    </aside>
  );
}
