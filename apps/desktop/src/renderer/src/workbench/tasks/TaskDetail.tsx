import type { ContextItem } from '@scholoom/protocol';
import type { TaskLink, TaskPort, TaskRead, TaskRef } from '@scholoom/protocol/projects';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContextContribution } from '../context-contributions';
import type { ResourceTarget } from '../resource-controller';
import type { WorkbenchSession } from '../session';
import { TaskStatusBadge, taskErrorMessage } from './TaskList';
import './tasks.css';

export interface TaskDetailProps {
  port: TaskPort;
  catalog?: WorkbenchSession['taskCatalog'];
  task: TaskRef;
  onOpenResource: (target: ResourceTarget) => void;
  onAppendContext?: (item: ContextItem) => void;
  onAssociate?: (entry: TaskRead) => void | Promise<void>;
  renderGraphAction?: (entry: TaskRead, workItemId?: string) => ReactNode;
  revision?: number;
  viewId?: string;
}

const roles: Record<TaskLink['role'], string> = {
  source: '来源',
  plan: '计划',
  process: '过程',
  result: '成果',
};

export function TaskDetail(props: TaskDetailProps) {
  const { projectId, taskId, fileId } = props.task;
  return <ProjectTaskDetail key={JSON.stringify([projectId, taskId, fileId])} {...props} />;
}

function ProjectTaskDetail({
  port,
  catalog,
  task,
  onOpenResource,
  onAppendContext,
  onAssociate,
  renderGraphAction,
  revision = 0,
  viewId,
}: TaskDetailProps) {
  const { projectId, taskId, fileId } = task;
  const [read, setRead] = useState<TaskRead>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [catalogs, setCatalogs] = useState<
    Record<string, Awaited<ReturnType<NonNullable<typeof catalog>['read']>>>
  >({});
  const [workItemId, setWorkItemId] = useState<string>();
  const generation = useRef(0);
  const catalogGeneration = useRef(0);
  const { contributeSelection } = useContextContribution();
  useEffect(() => {
    void catalog;
    setCatalogs({});
    return () => {
      catalogGeneration.current++;
    };
  }, [catalog]);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setBusy(true);
    setRead(undefined);
    setError('');
    setNotice('');
    setCatalogs({});
    setLinkErrors({});
    try {
      const result = await port.read({ task: { projectId, taskId, fileId } });
      if (current === generation.current) setRead(result);
    } catch (reason) {
      if (current === generation.current) setError(taskErrorMessage(reason));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, [port, projectId, taskId, fileId]);
  useEffect(() => {
    void revision;
    void load();
    return () => {
      generation.current++;
    };
  }, [load, revision]);

  const workItems = read?.metadata.workItems;
  const names = useMemo(
    () => new Map(workItems?.map((item) => [item.id, item.title])),
    [workItems],
  );
  const selection = useMemo<ContextItem | undefined>(() => {
    if (!read) return undefined;
    const base = { itemId: crypto.randomUUID(), ref: read.entry.ref, basis: read.entry.basis };
    const item = workItems?.find((candidate) => candidate.id === workItemId);
    return item
      ? {
          ...base,
          kind: 'object',
          providerId: 'research-task',
          objectId: item.id,
          name: item.title,
          semantics: `任务 ${read.metadata.title} 的工作项：${item.title}`,
        }
      : { ...base, kind: 'resource' };
  }, [read, workItems, workItemId]);
  useEffect(() => {
    if (!viewId) return;
    contributeSelection(viewId, selection ? { selections: [selection] } : undefined);
    return () => contributeSelection(viewId);
  }, [viewId, selection, contributeSelection]);
  const entry: ResourceTarget = {
    locator: { source: 'project', projectId, fileId },
    name: read?.path ?? `${taskId}.task.md`,
    openMode: 'permanent',
  };
  const open = async (target: ResourceTarget, linkId?: string) => {
    const current = generation.current;
    setActionError('');
    if (linkId) setLinkErrors((previous) => ({ ...previous, [linkId]: '' }));
    try {
      await onOpenResource(target);
    } catch (reason) {
      if (current !== generation.current) return;
      if (linkId)
        setLinkErrors((previous) => ({ ...previous, [linkId]: taskErrorMessage(reason) }));
      else setActionError(taskErrorMessage(reason));
    }
  };
  const openLink = (link: TaskLink) => {
    const target = link.target;
    if (target.kind === 'library-source') {
      const current = generation.current;
      const catalogCurrent = ++catalogGeneration.current;
      setLinkErrors((previous) => ({ ...previous, [link.id]: '' }));
      setCatalogs((previous) => {
        const next = { ...previous };
        delete next[link.id];
        return next;
      });
      void (async () => {
        if (!catalog) throw new Error('题录读取提供者未接入。');
        const source = await catalog.read(target);
        if (link.basis !== undefined && link.basis !== source.version)
          throw new Error('题录版本已变化，请核查原引用。');
        if (current === generation.current && catalogCurrent === catalogGeneration.current)
          setCatalogs((previous) => ({ ...previous, [link.id]: source }));
      })().catch((reason: unknown) => {
        if (current === generation.current && catalogCurrent === catalogGeneration.current)
          setLinkErrors((previous) => ({ ...previous, [link.id]: taskErrorMessage(reason) }));
      });
      return;
    }
    void open(
      {
        locator:
          target.kind === 'project-file'
            ? { source: 'project', projectId, fileId: target.fileId }
            : {
                source: 'library',
                attachmentId: target.attachmentId,
                materialVersionId: target.materialVersionId,
              },
        name: link.id,
        openMode: 'permanent',
      },
      link.id,
    );
  };
  const append = async () => {
    if (!read || !onAppendContext) return;
    const current = generation.current;
    setActionError('');
    try {
      await onAppendContext({
        kind: 'resource',
        itemId: crypto.randomUUID(),
        ref: read.entry.ref,
        basis: read.entry.basis,
      });
      if (current === generation.current) setNotice('已附加任务入口到当前指令。');
    } catch (reason) {
      if (current === generation.current) setActionError(taskErrorMessage(reason));
    }
  };
  const associate = async () => {
    if (!read || !onAssociate) return;
    const current = generation.current;
    setActionError('');
    try {
      await onAssociate(read);
    } catch (reason) {
      if (current === generation.current) setActionError(taskErrorMessage(reason));
    }
  };

  return (
    <section className="task-detail" aria-label="研究任务详情" aria-busy={busy}>
      <div className="task-toolbar">
        <button type="button" className="btn" disabled={busy} onClick={() => void load()}>
          重读入口
        </button>
        <button type="button" className="btn" onClick={() => void open(entry)}>
          编辑入口
        </button>
        {onAssociate ? (
          <button type="button" className="btn" disabled={!read} onClick={() => void associate()}>
            关联现有材料
          </button>
        ) : null}
        {onAppendContext ? (
          <button type="button" className="btn" disabled={!read} onClick={() => void append()}>
            附加到指令
          </button>
        ) : null}
      </div>
      {read ? renderGraphAction?.(read, workItemId) : null}
      {busy ? <p role="status">正在读取任务入口…</p> : null}
      {error ? (
        <p className="task-error" role="alert">
          入口读取失败：{error}
        </p>
      ) : null}
      {actionError ? (
        <p className="task-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {read ? (
        <>
          <header className="task-heading">
            <h2>{read.metadata.title}</h2>
            <TaskStatusBadge status={read.metadata.status} />
            <p className="task-muted">{read.path}</p>
          </header>
          <section aria-label="任务正文">
            <h3>当前概览</h3>
            <div className="task-body">
              {read.content.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim() ||
                '暂无正文。'}
            </div>
          </section>
          {workItems?.length ? (
            <nav className="task-section" aria-label="工作项导航">
              <h3>工作项</h3>
              <ul className="task-items">
                {workItems.map((item) => {
                  const plan = read.metadata.links?.find((link) => link.id === item.planLinkId);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="btn"
                        aria-pressed={workItemId === item.id}
                        onClick={() => setWorkItemId(item.id)}
                      >
                        {item.title}
                      </button>
                      {plan ? (
                        <button type="button" className="btn" onClick={() => openLink(plan)}>
                          打开计划
                        </button>
                      ) : null}
                      {item.dependsOn?.length ? (
                        <p className="task-muted">
                          依赖：{item.dependsOn.map((id) => names.get(id) ?? id).join('、')}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}
          <section className="task-section" aria-label="任务关联材料">
            <h3>关联材料{workItemId ? ` · ${names.get(workItemId) ?? workItemId}` : ''}</h3>
            {workItemId ? (
              <button type="button" className="btn" onClick={() => setWorkItemId(undefined)}>
                显示全部材料
              </button>
            ) : null}
            {!onAssociate ? <p className="task-muted">可在入口文件中维护关联材料。</p> : null}
            <ul className="task-items">
              {(read.metadata.links ?? [])
                .filter(
                  (link) =>
                    !workItemId ||
                    link.workItemId === workItemId ||
                    link.id === workItems?.find((item) => item.id === workItemId)?.planLinkId,
                )
                .map((link) => (
                  <li key={link.id}>
                    <div className="task-toolbar">
                      <span className="task-muted">{roles[link.role]}</span>
                      <button type="button" className="btn" onClick={() => openLink(link)}>
                        打开{roles[link.role]}
                        {link.target.kind === 'library-source' ? '题录' : '材料'}
                      </button>
                    </div>
                    <p className="task-muted task-reference">
                      {link.target.kind === 'project-file'
                        ? '项目材料'
                        : link.target.kind === 'library-source'
                          ? '文献库题录'
                          : '文献库材料'}
                    </p>
                    {catalogs[link.id] ? (
                      <section aria-label="来源题录详情">
                        <p>{catalogs[link.id]?.metadata.title}</p>
                        <p className="task-muted task-reference">
                          {catalogs[link.id]?.id} · {catalogs[link.id]?.version} · 修订{' '}
                          {catalogs[link.id]?.revision}
                        </p>
                        <p>
                          {catalogs[link.id]?.attachmentState === 'unavailable'
                            ? '附件未取得'
                            : '已有附件登记'}
                        </p>
                      </section>
                    ) : null}
                    {link.note ? <p className="task-reference">{link.note}</p> : null}
                    {linkErrors[link.id] ? (
                      <p className="task-error" role="alert">
                        来源打开失败：{linkErrors[link.id]}；原引用已保留。
                      </p>
                    ) : null}
                  </li>
                ))}
            </ul>
            {!read.metadata.links?.length ? <p className="task-muted">尚未关联材料。</p> : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
