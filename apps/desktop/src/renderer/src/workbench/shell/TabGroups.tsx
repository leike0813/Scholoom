import type { KeyboardEvent, ReactNode } from 'react';
import { readerKindForName } from '../reader-material';
import type { ResourceTarget } from '../resource-controller';
import type { FileViewMode, TabGroupState, TabKind } from '../tab-state';

export type { TabGroupState, TabItem, TabKind } from '../tab-state';

import { IconEdit, IconLibrary, IconPreview, IconReader, IconSettings, IconSplit } from './icons';

const kindLabels: Record<TabKind, { title: string; description: string }> = {
  programs: { title: '项目程序运行', description: '' },
  settings: { title: '设置', description: '' },
  library: { title: '文献库', description: '文献库界面将在后续变更接入，此页为框架占位。' },
  reader: { title: '阅读器', description: '阅读器界面将在后续变更接入，此页为框架占位。' },
  editor: { title: '编辑器', description: '编辑器界面将在后续变更接入，此页为框架占位。' },
  preview: { title: '交互预览', description: '交互预览界面将在后续变更接入，此页为框架占位。' },
};

const kindIcons: Record<TabKind, () => ReactNode> = {
  programs: IconPreview,
  settings: IconSettings,
  library: IconLibrary,
  reader: IconReader,
  editor: IconEdit,
  preview: IconPreview,
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

/** WAI-ARIA tabs：方向键在同组 tab 间循环移动焦点并激活，Home/End 到两端。 */
function tabKeyDown(
  event: KeyboardEvent<HTMLElement>,
  group: TabGroupState,
  groupIndex: number,
  tabId: string,
  onActivate: (groupIndex: number, tabId: string) => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate(groupIndex, tabId);
    return;
  }
  const { tabs } = group;
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return;
  let next = -1;
  if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = tabs.length - 1;
  const target = tabs[next];
  if (next < 0 || target === undefined || target.id === tabId) return;
  event.preventDefault();
  onActivate(groupIndex, target.id);
  event.currentTarget
    .closest('.tab-bar')
    ?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(target.id)}"]`)
    ?.focus();
}

export interface TabGroupsProps {
  groups: readonly TabGroupState[];
  onActivate: (groupIndex: number, tabId: string) => void;
  onClose: (groupIndex: number, tabId: string) => void;
  onSplit: (groupIndex: number) => void;
  onView?:
    | ((groupIndex: number, mode: FileViewMode | 'split' | 'split-render') => void)
    | undefined;
  renderSettings?: ReactNode;
  renderLibrary?: ReactNode | undefined;
  renderPrograms?: ReactNode | undefined;
  onOpenPrograms?: (() => void) | undefined;
  renderResource?:
    | ((
        target: ResourceTarget,
        mode?: FileViewMode,
        onDirty?: () => void,
        viewId?: string,
      ) => ReactNode)
    | undefined;
  onPin?: ((groupIndex: number, tabId: string) => void) | undefined;
  /** 空态带入的当前工作区名；缺省时不显示。 */
  contextName?: string | undefined;
  onOpenSettings?: (() => void) | undefined;
}

export function TabGroups({
  groups,
  onActivate,
  onClose,
  onSplit,
  renderResource,
  onPin,
  onView,
  renderSettings,
  renderLibrary,
  renderPrograms,
  onOpenPrograms,
  contextName,
  onOpenSettings,
}: TabGroupsProps) {
  if (groups.length === 0) {
    return (
      <div className="center-empty">
        <h2>当前没有打开的内容</h2>
        <p>
          {contextName ? `当前工作区：${contextName}。` : ''}
          从文件树或 Agent 会话打开材料后，会在这里以 tab 呈现。
        </p>
        {onOpenPrograms ? (
          <button type="button" className="btn" onClick={onOpenPrograms}>
            项目程序运行
          </button>
        ) : null}
        {onOpenSettings ? (
          <div className="center-empty__actions">
            <button type="button" className="btn" onClick={onOpenSettings}>
              打开设置
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="tab-groups">
      {groups.map((group, groupIndex) => {
        const active = group.tabs.find((tab) => tab.id === group.activeId) ?? group.tabs[0];
        const resource = active?.resource;
        const isLibraryText =
          resource?.locator.source === 'library' &&
          !readerKindForName(resource.name) &&
          /\.(txt|md|markdown|qmd|rst|csv|json|ya?ml|toml|bib|tex)$/i.test(resource.name);
        const projectPath =
          resource?.locator.source === 'project' ? (resource.locator.path ?? '') : '';
        const isProjectText =
          resource?.locator.source === 'project' &&
          /\.(md|markdown|qmd|tex|txt|rst|csv|json|ya?ml|toml|bib)$/i.test(projectPath);
        return (
          <section className="tab-group" key={group.id} aria-label={`标签组 ${groupIndex + 1}`}>
            <header className="tab-bar" role="tablist">
              {group.tabs.map((tab) => {
                const Icon = kindIcons[tab.kind];
                return (
                  <div
                    key={tab.id}
                    role="tab"
                    data-tab-id={tab.id}
                    tabIndex={tab.id === active?.id ? 0 : -1}
                    aria-selected={tab.id === active?.id}
                    className={`tab${tab.id === active?.id ? ' tab--active' : ''}${tab.transient ? ' tab--transient' : ''}`}
                    onClick={() => onActivate(groupIndex, tab.id)}
                    onDoubleClick={() => onPin?.(groupIndex, tab.id)}
                    onKeyDown={(event) => tabKeyDown(event, group, groupIndex, tab.id, onActivate)}
                  >
                    <Icon />
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
                );
              })}
              <div className="tab-bar__spacer" />
              {onOpenPrograms ? (
                <button type="button" className="btn" onClick={onOpenPrograms}>
                  项目程序运行
                </button>
              ) : null}
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
            {isLibraryText || isProjectText ? (
              <div className="file-view-controls">
                <button
                  type="button"
                  className="btn"
                  onClick={() => onView?.(groupIndex, 'source')}
                >
                  源码
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onView?.(groupIndex, 'preview')}
                >
                  预览
                </button>
                {isProjectText ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      disabled={!/\.(md|markdown|qmd)$/i.test(projectPath)}
                      onClick={() => onView?.(groupIndex, 'visual')}
                    >
                      可视编辑
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => onView?.(groupIndex, 'split')}
                    >
                      并排预览
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!/\.(md|markdown|qmd|tex)$/i.test(projectPath)}
                      onClick={() => onView?.(groupIndex, 'render')}
                    >
                      完整排版
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!/\.(md|markdown|qmd|tex)$/i.test(projectPath)}
                      onClick={() => onView?.(groupIndex, 'split-render')}
                    >
                      并排排版
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="tab-content">
              {active?.resource && renderResource ? (
                renderResource(
                  active.resource,
                  active.editorMode ?? (active.kind === 'preview' ? 'preview' : 'source'),
                  active.transient ? () => onPin?.(groupIndex, active.id) : undefined,
                  group.id,
                )
              ) : active?.kind === 'programs' && renderPrograms ? (
                renderPrograms
              ) : active?.kind === 'library' && renderLibrary ? (
                renderLibrary
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
