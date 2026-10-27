import type { CSSProperties, ReactNode } from 'react';
import type { FileNode, TaskSummary } from '../session';
import { TaskStatusBadge } from '../tasks/TaskList';
import {
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconLibrary,
  IconPaperclip,
  IconTasks,
} from './icons';

export type AuxiliaryTabId = 'files' | 'materials' | 'tasks' | 'library';

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  return (
    <>
      <li
        className={`tree__item ${node.kind === 'dir' ? 'tree__dir' : ''}${node.open ? ' tree__open' : ''}`}
        style={{ '--depth': depth } as CSSProperties}
      >
        {node.kind === 'dir' ? '▾ ' : ''}
        {node.name}
      </li>
      {node.children?.map((child) => (
        <TreeNode key={child.name} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export interface AuxiliaryPaneProps {
  fileTree: readonly FileNode[];
  tasks: readonly TaskSummary[];
  materials: readonly string[];
  selectedMaterials: readonly string[];
  toggleMaterial: (name: string) => void;
  onCollapse: () => void;
  fileNavigator?: ReactNode;
  taskNavigator?: ReactNode;
  libraryDetails?: ReactNode;
  activeTab: AuxiliaryTabId;
  onTabChange: (tab: AuxiliaryTabId) => void;
}

export function AuxiliaryPane({
  fileTree,
  tasks,
  materials,
  selectedMaterials,
  toggleMaterial,
  onCollapse,
  fileNavigator,
  taskNavigator,
  libraryDetails,
  activeTab,
  onTabChange: setActiveTab,
}: AuxiliaryPaneProps) {
  return (
    <aside className="side side--right" aria-label="辅助面板">
      <div
        className={`auxiliary-tabs${libraryDetails ? ' auxiliary-tabs--library' : ''}`}
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'files'}
          aria-controls="tab-files"
          className="auxiliary-tab"
          onClick={() => setActiveTab('files')}
        >
          <IconFolder />
          <span>文件</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'materials'}
          aria-controls="tab-materials"
          className="auxiliary-tab"
          onClick={() => setActiveTab('materials')}
        >
          <IconPaperclip />
          <span>材料</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tasks'}
          aria-controls="tab-tasks"
          className="auxiliary-tab"
          onClick={() => setActiveTab('tasks')}
        >
          <IconTasks />
          <span>任务</span>
        </button>
        {libraryDetails && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'library'}
            aria-controls="tab-library-details"
            className="auxiliary-tab"
            onClick={() => setActiveTab('library')}
          >
            <IconLibrary />
            <span>文献详情</span>
          </button>
        )}
        <div className="auxiliary-tabs__spacer" />
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={onCollapse}
          title="折叠右区 (Ctrl+Alt+B)"
          aria-label="折叠右区"
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="auxiliary-content" role="tabpanel">
        {activeTab === 'library' && libraryDetails && (
          <section className="pane" aria-label="文献详情" id="tab-library-details">
            {libraryDetails}
          </section>
        )}
        {activeTab === 'files' && (
          <section className="pane" aria-label="文件" id="tab-files">
            <div className="pane__body">
              {fileNavigator ??
                (fileTree.length === 0 ? (
                  <p className="empty-hint">暂无文件</p>
                ) : (
                  <ul className="tree">
                    {fileTree.map((node) => (
                      <TreeNode key={node.name} node={node} depth={0} />
                    ))}
                  </ul>
                ))}
            </div>
          </section>
        )}

        {activeTab === 'materials' && (
          <section className="pane" aria-label="材料" id="tab-materials">
            <div className="pane__body">
              {materials.length === 0 ? (
                <p className="empty-hint">暂无材料</p>
              ) : (
                materials.map((name) => (
                  <label key={name} className="material-item">
                    <input
                      type="checkbox"
                      checked={selectedMaterials.includes(name)}
                      onChange={() => toggleMaterial(name)}
                    />
                    <span>{name}</span>
                  </label>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'tasks' && (
          <section className="pane" aria-label="任务" id="tab-tasks">
            <div className="pane__body">
              {taskNavigator ??
                (tasks.length === 0 ? (
                  <p className="empty-hint">暂无任务</p>
                ) : (
                  <ul className="task-list">
                    {tasks.map((task) => (
                      <li key={task.task.fileId} className="task">
                        <TaskStatusBadge status={task.status} />
                        <span className="task__title" title={task.title}>
                          {task.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

export function AuxiliaryRail({ onExpand }: { onExpand: () => void }) {
  return (
    <aside className="rail rail--right" aria-label="辅助区（已折叠）">
      <button
        type="button"
        className="icon-btn"
        onClick={onExpand}
        title="展开右区 (Ctrl+Alt+B)"
        aria-label="展开右区"
      >
        <IconChevronLeft />
      </button>
      <button type="button" className="icon-btn" title="文件树" aria-label="文件树">
        <IconFolder />
      </button>
      <button type="button" className="icon-btn" title="任务列表" aria-label="任务列表">
        <IconTasks />
      </button>
    </aside>
  );
}
