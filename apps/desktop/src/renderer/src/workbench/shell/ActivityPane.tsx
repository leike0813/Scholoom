import { type ReactNode, useRef } from 'react';
import type { SessionSummary, WorkbenchConnection } from '../session';
import {
  IconChat,
  IconChevronLeft,
  IconChevronRight,
  IconLibrary,
  IconPlus,
  IconSettings,
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

/** 明确停机入口：说明影响范围，确认与取消都是可键盘操作的常规控件。 */
function StopKernel({ onStop }: { onStop: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (menu.current !== null) menu.current.open = false;
  };

  return (
    <details className="kernel-menu" ref={menu}>
      <summary>停止内核</summary>
      <div className="kernel-menu__body">
        <p>停止后所有已连接的客户端（包括其他窗口与 CLI）都会断开，需要重新启动才能继续。</p>
        <div className="kernel-menu__actions">
          <button
            type="button"
            onClick={() => {
              close();
              onStop();
            }}
          >
            确认停止
          </button>
          <button type="button" onClick={close}>
            取消
          </button>
        </div>
      </div>
    </details>
  );
}

export interface ActivityPaneProps {
  sessionNavigation?: ReactNode;
  projectControls?: ReactNode;
  openSettings?: (() => void) | undefined;
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
  projectControls,
  openSettings,
  sessionNavigation,
}: ActivityPaneProps) {
  const kernelMessage =
    connection?.message ?? (status === 'sample' ? '样例场景 · 刷新后重置' : '内核未连接');

  return (
    <aside className="side side--left" aria-label="会话与导航">
      <div className="side__header">
        <h1 className="brand">Scholoom</h1>
        <button
          type="button"
          className="icon-btn"
          onClick={onCollapse}
          title="折叠左区 (Ctrl+B)"
          aria-label="折叠左区"
        >
          <IconChevronLeft />
        </button>
      </div>

      <nav className="menu" aria-label="常用操作">
        <button
          type="button"
          className="menu__item"
          onClick={createSession}
          disabled={!createSession}
        >
          <IconPlus />
          新建会话
        </button>
        <button type="button" className="menu__item" disabled>
          <IconLibrary />
          文献库
        </button>
        <button
          type="button"
          className="menu__item"
          onClick={openSettings}
          disabled={!openSettings}
        >
          <IconSettings />
          设置
        </button>
      </nav>
      {projectControls}

      <div className="section-label">
        <span>会话</span>
      </div>
      {sessionNavigation ??
        (sessions.length === 0 ? (
          <p className="empty-hint">暂无会话</p>
        ) : (
          <ul className="session-list">
            {sessions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`session${item.id === activeSessionId ? ' session--active' : ''}`}
                  aria-pressed={item.id === activeSessionId}
                  onClick={() => selectSession?.(item.id)}
                >
                  <StatusMark session={item} />
                  <span className="session__title" title={item.title}>
                    {item.title}
                  </span>
                  <span className="session__time">{item.updatedAt}</span>
                  {item.unread ? (
                    <span className="dot dot--unread" role="img" aria-label="有未读" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ))}

      <div className="kernel-status">
        <span
          className={connection?.stop ? 'dot dot--ok' : 'dot dot--idle'}
          role="img"
          aria-label="连接指示"
        />
        <p className="kernel-status__text" role="status" aria-label="连接状态">
          {kernelMessage}
        </p>
        {connection?.instanceId ? (
          <span className="kernel-status__detail">实例 {connection.instanceId}</span>
        ) : null}
        {connection?.retry ? (
          <button type="button" className="text-btn" onClick={connection.retry}>
            重试连接
          </button>
        ) : null}
        {connection?.inspect ? (
          <button type="button" className="text-btn" onClick={connection.inspect}>
            查询状态
          </button>
        ) : null}
        {connection?.stop ? <StopKernel onStop={connection.stop} /> : null}
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={onCycleTheme}
          title={themeLabels[theme]}
          aria-label="切换主题"
        >
          <IconTheme />
        </button>
      </div>
    </aside>
  );
}

export function ActivityRail({
  onExpand,
  createSession,
}: {
  onExpand: () => void;
  createSession?: (() => void) | undefined;
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
        <IconChevronRight />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="新建会话"
        aria-label="新建会话"
        onClick={createSession}
        disabled={!createSession}
      >
        <IconPlus />
      </button>
      <button type="button" className="icon-btn" title="文献库" aria-label="文献库" disabled>
        <IconLibrary />
      </button>
      <button
        type="button"
        className="icon-btn"
        title="会话"
        aria-label="会话"
        onClick={() => {
          onExpand();
          requestAnimationFrame(() => document.getElementById('session-search')?.focus());
        }}
      >
        <IconChat />
      </button>
    </aside>
  );
}
