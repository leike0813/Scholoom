import type { ReactNode } from 'react';
import type { FileTarget } from '../session';
import { IconSplit } from './icons';

export type TabKind = 'library' | 'reader' | 'editor' | 'preview' | 'settings';

export interface TabItem {
  id: string;
  title: string;
  kind: TabKind;
  target?: FileTarget;
}

export interface TabGroupState {
  id: string;
  tabs: readonly TabItem[];
  activeId: string | null;
}

const kindLabels: Record<TabKind, { title: string; description: string }> = {
  settings: { title: '设置', description: '' },
  library: { title: '文献库', description: '文献库界面将在后续变更接入，此页为框架占位。' },
  reader: { title: '阅读器', description: '阅读器界面将在后续变更接入，此页为框架占位。' },
  editor: { title: '编辑器', description: '编辑器界面将在后续变更接入，此页为框架占位。' },
  preview: { title: '交互预览', description: '交互预览界面将在后续变更接入，此页为框架占位。' },
};

function TabPlaceholder({ kind }: { kind: TabKind }) {
  const label = kindLabels[kind];
  return (
    <div className="tab-placeholder">
      <h3>{label.title}</h3>
      <p>{label.description}</p>
    </div>
  );
}

export interface TabGroupsProps {
  groups: readonly TabGroupState[];
  onActivate: (groupIndex: number, tabId: string) => void;
  onClose: (groupIndex: number, tabId: string) => void;
  onSplit: (groupIndex: number) => void;
  onView?: ((groupIndex: number, mode: 'source' | 'preview' | 'split') => void) | undefined;
  renderSettings?: ReactNode;
  renderFile?: ((target: FileTarget, mode?: 'source' | 'preview') => ReactNode) | undefined;
}

export function TabGroups({
  groups,
  onActivate,
  onClose,
  onSplit,
  renderFile,
  onView,
  renderSettings,
}: TabGroupsProps) {
  if (groups.length === 0) {
    return (
      <div className="center-empty">
        <h2>当前没有打开的内容</h2>
        <p>从文献库、文件树或 Agent 会话打开材料后，会在这里以 tab 呈现。</p>
      </div>
    );
  }

  return (
    <div className="tab-groups">
      {groups.map((group, groupIndex) => {
        const active = group.tabs.find((tab) => tab.id === group.activeId) ?? group.tabs[0];
        return (
          <section className="tab-group" key={group.id} aria-label={`标签组 ${groupIndex + 1}`}>
            <header className="tab-bar" role="tablist">
              {group.tabs.map((tab) => (
                <div
                  key={tab.id}
                  role="tab"
                  tabIndex={0}
                  aria-selected={tab.id === active?.id}
                  className={`tab${tab.id === active?.id ? ' tab--active' : ''}`}
                  onClick={() => onActivate(groupIndex, tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onActivate(groupIndex, tab.id);
                    }
                  }}
                >
                  <span className="tab__title">{tab.title}</span>
                  <button
                    type="button"
                    className="tab__close"
                    aria-label={`关闭 ${tab.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose(groupIndex, tab.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="tab-bar__spacer" />
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                onClick={() => onSplit(groupIndex)}
                title="向右拆分"
                aria-label="向右拆分"
              >
                <IconSplit />
              </button>
            </header>
            {active?.target ? (
              <div className="file-view-controls">
                <button type="button" onClick={() => onView?.(groupIndex, 'source')}>
                  源码
                </button>
                <button type="button" onClick={() => onView?.(groupIndex, 'preview')}>
                  预览
                </button>
                <button type="button" onClick={() => onView?.(groupIndex, 'split')}>
                  并排预览
                </button>
              </div>
            ) : null}
            <div className="tab-content">
              {active?.target && renderFile ? (
                renderFile(active.target, active.kind === 'preview' ? 'preview' : 'source')
              ) : active?.kind === 'settings' ? (
                renderSettings
              ) : active ? (
                <TabPlaceholder kind={active.kind} />
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
