import type { ReactNode } from 'react';
import type { FileNode, TaskSummary } from '../session';
import { IconChevronLeft, IconChevronRight, IconFolder, IconTasks } from './icons';

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  return (
    <>
      <li
        className={`tree__item ${node.kind === 'dir' ? 'tree__dir' : ''}${node.open ? ' tree__open' : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
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

function TaskStatusPill({ status }: { status: TaskSummary['status'] }) {
  switch (status) {
    case 'running':
      return <span className="pill pill--run">进行中</span>;
    case 'awaiting':
      return <span className="pill pill--await">待审批</span>;
    case 'done':
      return <span className="pill pill--done">已完成</span>;
    default:
      return <span className="pill pill--idle">未开始</span>;
  }
}

export interface AuxiliaryPaneProps {
  fileTree: readonly FileNode[];
  tasks: readonly TaskSummary[];
  materials: readonly string[];
  selectedMaterials: readonly string[];
  toggleMaterial: (name: string) => void;
  onCollapse: () => void;
  fileNavigator?: ReactNode;
}

export function AuxiliaryPane({
  fileTree,
  tasks,
  materials,
  selectedMaterials,
  toggleMaterial,
  onCollapse,
  fileNavigator,
}: AuxiliaryPaneProps) {
  return (
    <aside className="side side--right" aria-label="文件与任务">
      <section className="pane" aria-label="文件">
        <div className="pane__header">
          <span>文件</span>
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

      <section className="pane" aria-label="材料">
        <div className="pane__header">
          <span>材料</span>
        </div>
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

      <section className="pane" aria-label="任务">
        <div className="pane__header">
          <span>任务</span>
        </div>
        <div className="pane__body">
          {tasks.length === 0 ? (
            <p className="empty-hint">暂无任务</p>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id} className="task">
                  <TaskStatusPill status={task.status} />
                  <span className="task__title" title={task.title}>
                    {task.title}
                  </span>
                  <span className="task__time">{task.updatedAt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
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
