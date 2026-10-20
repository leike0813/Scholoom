import { useState, useSyncExternalStore } from 'react';
import { useStatusBar, useStatusBarItem } from '../StatusBarContext';
import type { WorkbenchNotice, WorkbenchSession } from '../session';
import type { StatusBarEntry, StatusBarIcon } from '../statusbar';
import { Menu } from './menu';

const severityOrder = { error: 0, warning: 1, info: 2 };
const noNotices: readonly WorkbenchNotice[] = [];
const paths: Record<StatusBarIcon, string> = {
  info: 'M8 7v5M8 4.5v.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0',
  warning: 'M8 2 1.5 13h13L8 2M8 6v3M8 11v.5',
  error: 'M6 6l4 4M10 6l-4 4M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0',
  activity: 'M1 8h3l2-5 4 10 2-5h3',
  lock: 'M5 7V5a3 3 0 0 1 6 0v2M3 7h10v7H3V7M8 10v2',
  notifications: 'M3 11h10l-1.5-2V6a3.5 3.5 0 0 0-7 0v3L3 11M6.5 13h3',
};

function ItemContent({ item }: { item: StatusBarEntry }) {
  return (
    <>
      {item.icon ? (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d={paths[item.icon]}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {item.announce ? (
        <span
          className="statusbar__text"
          role="status"
          aria-label={item.actionable ? undefined : item.ariaLabel}
        >
          {item.text}
        </span>
      ) : (
        <span className="statusbar__text">{item.text}</span>
      )}
    </>
  );
}

/** 内置贡献与外部条目共用注册表，详情内容只属于工作台自己的通知入口。 */
export function StatusBar({ session }: { session: WorkbenchSession }) {
  const service = useStatusBar();
  const entries = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const [open, setOpen] = useState(false);
  const notices = [...(session.notices ?? noNotices)].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );
  const first = notices[0];
  useStatusBarItem(
    'workbench',
    session.executionStatus
      ? {
          id: 'execution',
          text: session.executionStatus,
          ariaLabel: '执行状态',
          tooltip: session.executionStatus,
          icon: 'activity',
          announce: true,
          priority: 100,
        }
      : undefined,
  );
  useStatusBarItem(
    'workbench',
    {
      id: 'notifications',
      text: `通知 ${notices.length}${first ? ` · ${first.summary}` : ''}`,
      ariaLabel: '工作台通知',
      tooltip: first?.summary ?? '暂无通知',
      alignment: 'right',
      priority: 100,
      icon: first?.severity === 'error' ? 'error' : 'notifications',
      tone:
        first?.severity === 'error'
          ? 'error'
          : first?.severity === 'warning'
            ? 'warning'
            : 'neutral',
      announce: true,
    },
    () => setOpen((value) => !value),
  );
  useStatusBarItem(
    'workbench',
    session.projectTrust
      ? {
          id: 'project-trust',
          text: session.projectTrust.state === 'pending' ? '信任待确认' : '受限模式',
          ariaLabel: '项目访问状态',
          tooltip: '确认项目访问',
          icon: 'lock',
          alignment: 'right',
          priority: 50,
        }
      : undefined,
    session.projectTrust?.request,
  );

  const renderItem = (item: StatusBarEntry) => {
    const className = `statusbar__item statusbar__item--${item.tone ?? 'neutral'}`;
    if (item.owner === 'workbench' && item.id === 'notifications') {
      return (
        <Menu
          key={item.key}
          label={item.ariaLabel ?? item.text}
          title={item.tooltip}
          summary={<ItemContent item={item} />}
          className={`statusbar__notifications menu--up ${className}`}
          open={open}
          onOpenChange={setOpen}
          onActivate={() => service.activate(item.owner, item.id)}
        >
          <section aria-label="工作台通知详情">
            {notices.length ? (
              notices.map((notice) => (
                <div key={notice.id} className="statusbar__notice">
                  {notice.content}
                </div>
              ))
            ) : (
              <p className="empty-hint">暂无通知</p>
            )}
          </section>
        </Menu>
      );
    }
    return item.actionable ? (
      <button
        key={item.key}
        type="button"
        className={className}
        title={item.tooltip}
        aria-label={item.ariaLabel ?? item.text}
        onClick={() => service.activate(item.owner, item.id)}
      >
        <ItemContent item={item} />
      </button>
    ) : (
      // biome-ignore lint/a11y/useSemanticElements: 状态栏条目按图标与文本分组提供可访问名
      <span
        key={item.key}
        className={className}
        title={item.tooltip}
        role="group"
        aria-label={item.announce ? undefined : item.ariaLabel}
      >
        <ItemContent item={item} />
      </span>
    );
  };

  return (
    <section className="statusbar" aria-label="状态栏">
      <div className="statusbar__group statusbar__group--left">
        {entries.filter((item) => item.alignment !== 'right').map(renderItem)}
      </div>
      <div className="statusbar__group statusbar__group--right">
        {entries.filter((item) => item.alignment === 'right').map(renderItem)}
      </div>
    </section>
  );
}
