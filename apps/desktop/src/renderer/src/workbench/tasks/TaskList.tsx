import { validateBusiness } from '@scholoom/protocol';
import type {
  ProjectTaskInputs,
  ProjectTaskOutputs,
  TaskMetadata,
  TaskPort,
  TaskRef,
  TaskStatus,
} from '@scholoom/protocol/projects';
import type { ResourceCreationOutputs } from '@scholoom/protocol/resources';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { readDraft, writeDraft } from '../drafts';
import { useVirtualizedList } from '../useVirtualizedList';
import './tasks.css';

export interface TaskListProps {
  port: TaskPort;
  projectId: string;
  onOpen: (task: TaskRef) => void;
  creation?: (input: {
    projectId: string;
    operationId: string;
  }) => Promise<ResourceCreationOutputs['resources.create']>;
  revision?: number;
  draftKey?: string;
  selectionKey?: string;
}

type Page = ProjectTaskOutputs['tasks.list'];
type CreationResult = ResourceCreationOutputs['resources.create'];
type Row = { task: Page['tasks'][number] } | { issue: Page['issues'][number] };
type Attempt = {
  input: ProjectTaskInputs['tasks.create'];
  taskId: string;
  result?: CreationResult;
};
type TaskCreateDraft = { title: string; body: string; attempt?: Attempt };

export function readTaskCreateDraft(
  key: string | undefined,
  projectId: string,
): TaskCreateDraft & { error?: string } {
  const empty = { title: '', body: '' };
  const stored = key ? readDraft(key) : '';
  if (!stored) return empty;
  try {
    const value = JSON.parse(stored) as TaskCreateDraft;
    if (!value || typeof value.title !== 'string' || typeof value.body !== 'string')
      throw new Error('invalid draft');
    const pending = value.attempt;
    if (pending !== undefined) {
      if (
        !pending ||
        typeof pending !== 'object' ||
        typeof pending.taskId !== 'string' ||
        !pending.taskId ||
        !validateBusiness('tasks.create', 'params', pending.input) ||
        pending.input.projectId !== projectId
      )
        throw new Error('invalid creation request');
      const result = pending.result;
      if (
        result !== undefined &&
        (!validateBusiness('tasks.create', 'result', result) ||
          result.operationId !== pending.input.operationId ||
          ('resource' in result && result.resource && result.resource.ref.projectId !== projectId))
      )
        throw new Error('invalid creation receipt');
    }
    return { title: value.title, body: value.body, ...(pending ? { attempt: pending } : {}) };
  } catch {
    return { ...empty, error: '新建草稿或创建记录无法校验，原记录已保留，请核查后继续。' };
  }
}
const statusLabels: Record<TaskStatus, string> = {
  active: '进行中',
  waiting: '待处理',
  completed: '已完成',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`pill task-status task-status--${status}`}>{statusLabels[status]}</span>;
}

export function taskErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return '操作未完成，请重读并核查。';
}

export function TaskList(props: TaskListProps) {
  return <ProjectTaskList key={JSON.stringify([props.projectId, props.draftKey])} {...props} />;
}

function ProjectTaskList({
  port,
  projectId,
  onOpen,
  creation,
  revision = 0,
  draftKey,
  selectionKey,
}: TaskListProps) {
  const [restored] = useState(() => readTaskCreateDraft(draftKey, projectId));
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState<Page>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(
    !!(restored.title || restored.body || restored.attempt || restored.error),
  );
  const [title, setTitle] = useState(restored.title);
  const [body, setBody] = useState(restored.body);
  const [attempt, setAttempt] = useState<Attempt | undefined>(restored.attempt);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState(restored.error ?? '');
  const [focused, setFocused] = useState(0);
  const listId = useId();
  const generation = useRef(0);
  const currentOffset = useRef(0);
  const lifetime = useRef(0);
  const navigation = useRef(0);
  const selection = useRef(selectionKey);
  if (selection.current !== selectionKey) {
    selection.current = selectionKey;
    navigation.current++;
  }
  const selectTask = (task: TaskRef) => {
    navigation.current++;
    onOpen(task);
  };
  const viewport = useRef<HTMLDivElement>(null);
  const storeDraft = (value: TaskCreateDraft) => {
    if (draftKey && !restored.error)
      writeDraft(draftKey, value.title || value.body || value.attempt ? JSON.stringify(value) : '');
  };
  const { visibleRange, totalHeight, offsetTop, scrollToIndex } = useVirtualizedList(rows.length, {
    rowHeight: 96,
    containerRef: viewport,
  });
  const duplicates = useMemo(() => {
    const files = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!('task' in row)) continue;
      const { taskId, fileId } = row.task.task;
      const found = files.get(taskId) ?? new Set<string>();
      found.add(fileId);
      files.set(taskId, found);
    }
    return new Set([...files].filter(([, ids]) => ids.size > 1).map(([id]) => id));
  }, [rows]);

  const load = useCallback(
    async (offset = 0, version?: string, append = false) => {
      const current = ++generation.current;
      setBusy(true);
      setError('');
      if (!append) {
        setRows([]);
        setPage(undefined);
        setFocused(0);
        if (viewport.current) viewport.current.scrollTop = 0;
      }
      try {
        const result = await port.list({
          projectId,
          offset,
          limit: 25,
          ...(version ? { version } : {}),
        });
        if (generation.current !== current) return;
        const added: Row[] = [
          ...result.tasks.map((task) => ({ task })),
          ...result.issues.map((issue) => ({ issue })),
        ];
        setRows((previous) => (append ? [...previous, ...added] : added));
        setPage(result);
        currentOffset.current = result.offset;
      } catch (reason) {
        if (generation.current === current) setError(taskErrorMessage(reason));
      } finally {
        if (generation.current === current) setBusy(false);
      }
    },
    [port, projectId],
  );

  useEffect(() => {
    lifetime.current++;
    return () => {
      lifetime.current++;
    };
  }, []);
  useEffect(() => {
    void revision;
    void load(currentOffset.current);
    return () => {
      generation.current++;
    };
  }, [load, revision]);

  const acceptCreation = async (
    pending: Attempt,
    result: CreationResult,
    expectedNavigation?: number,
  ) => {
    if (
      !validateBusiness('tasks.create', 'result', result) ||
      result.operationId !== pending.input.operationId
    )
      throw new Error('创建回执操作编号不符，请核查原操作。');
    if ('resource' in result && result.resource && result.resource.ref.projectId !== projectId)
      throw new Error('创建回执项目不符，请核查原操作。');
    storeDraft({ title, body, attempt: { ...pending, result } });
    setAttempt({ ...pending, result });
    if (result.state !== 'complete') {
      setCreationError(result.error?.message ?? '创建尚未确认，请核查原操作。');
      return;
    }
    const task: TaskRef = {
      projectId,
      taskId: pending.taskId,
      fileId: result.resource.ref.fileId,
    };
    const current = lifetime.current;
    const read = await port.read({ task });
    if (current !== lifetime.current) return;
    if (draftKey) writeDraft(draftKey, '');
    setAttempt(undefined);
    setCreationError('');
    setShowForm(false);
    setTitle('');
    setBody('');
    void load();
    if (expectedNavigation === undefined || expectedNavigation === navigation.current)
      onOpen(read.task);
  };

  const submit = async () => {
    if (creating || attempt || restored.error || !title.trim()) return;
    const taskId = crypto.randomUUID();
    const metadata: TaskMetadata = {
      kind: 'research-task',
      formatVersion: 1,
      id: taskId,
      title: title.trim(),
      status: 'active',
    };
    const content = `---\n${JSON.stringify(metadata)}\n---\n\n${body}`;
    if (new TextEncoder().encode(content).byteLength > 262144) {
      setCreationError('入口超过 256 KiB，请将长过程另存为项目材料。');
      return;
    }
    const pending: Attempt = {
      taskId,
      input: {
        projectId,
        operationId: crypto.randomUUID(),
        path: `tasks/${taskId}.task.md`,
        content,
      },
    };
    const current = lifetime.current;
    const expectedNavigation = navigation.current;
    storeDraft({ title, body, attempt: pending });
    setAttempt(pending);
    setCreating(true);
    setCreationError('');
    try {
      const result = await port.create(pending.input);
      if (current === lifetime.current) await acceptCreation(pending, result, expectedNavigation);
    } catch (reason) {
      if (current === lifetime.current) setCreationError(taskErrorMessage(reason));
    } finally {
      if (current === lifetime.current) setCreating(false);
    }
  };

  const checkCreation = async () => {
    if (!attempt || creating) return;
    const current = lifetime.current;
    setCreating(true);
    setCreationError('');
    try {
      const result =
        attempt.result?.state === 'complete'
          ? attempt.result
          : await creation?.({ projectId, operationId: attempt.input.operationId });
      if (result && current === lifetime.current) await acceptCreation(attempt, result);
    } catch (reason) {
      if (current === lifetime.current) setCreationError(taskErrorMessage(reason));
    } finally {
      if (current === lifetime.current) setCreating(false);
    }
  };

  return (
    <section className="task-list" aria-label="研究任务">
      <div className="task-toolbar">
        <button type="button" className="btn" onClick={() => void load()} disabled={busy}>
          重读任务
        </button>
        <button type="button" className="btn" onClick={() => setShowForm(true)}>
          新建任务
        </button>
      </div>
      <p className="task-muted">任务入口：tasks/*.task.md</p>
      {showForm ? (
        <form
          className="task-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            任务名称
            <input
              value={title}
              maxLength={256}
              required
              disabled={!!attempt || !!restored.error}
              onChange={(event) => {
                storeDraft({ title: event.target.value, body });
                setTitle(event.target.value);
              }}
            />
          </label>
          <label>
            任务正文
            <textarea
              value={body}
              rows={6}
              maxLength={262144}
              disabled={!!attempt || !!restored.error}
              onChange={(event) => {
                storeDraft({ title, body: event.target.value });
                setBody(event.target.value);
              }}
              placeholder="目标、完成条件、约束、当前进展与下一步"
            />
          </label>
          {creationError ? (
            <p className="task-error" role="alert">
              {creationError}
            </p>
          ) : null}
          {attempt ? (
            <div className="task-receipt" role="status">
              <p>
                {attempt.result?.state === 'failed' ? '创建失败' : '创建待核查'}，操作编号：
                <code>{attempt.input.operationId}</code>
              </p>
              {attempt.result?.state !== 'failed' &&
              (attempt.result?.state === 'complete' || creation) ? (
                <button
                  type="button"
                  className="btn"
                  disabled={creating}
                  onClick={() => void checkCreation()}
                >
                  {attempt.result?.state === 'complete' ? '重新核对入口' : '查询原创建操作'}
                </button>
              ) : attempt.result?.state !== 'failed' ? (
                <p>请保留操作编号，核查原创建结果后再继续。</p>
              ) : null}
              {attempt.result?.state === 'failed' ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    storeDraft({ title, body });
                    setAttempt(undefined);
                    setCreationError('');
                  }}
                >
                  返回修改
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="task-toolbar">
            <button
              type="submit"
              className="btn"
              disabled={creating || !!attempt || !!restored.error || !title.trim()}
              aria-busy={creating}
            >
              创建任务
            </button>
            <button
              type="button"
              className="btn"
              disabled={!!attempt}
              onClick={() => setShowForm(false)}
            >
              取消
            </button>
          </div>
        </form>
      ) : null}
      {error ? (
        <p className="task-error" role="alert">
          发现失败：{error}
        </p>
      ) : null}
      {duplicates.size ? (
        <p className="task-error" role="status">
          已加载候选中有重复任务身份，请按入口路径核对。
        </p>
      ) : null}
      <div
        ref={viewport}
        className="task-list-viewport"
        tabIndex={0}
        role="listbox"
        aria-label="已发现任务与文件诊断"
        aria-activedescendant={rows.length ? `${listId}-${focused}` : undefined}
        aria-busy={busy}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          let next = focused;
          if (event.key === 'ArrowDown') next = Math.min(focused + 1, rows.length - 1);
          else if (event.key === 'ArrowUp') next = Math.max(focused - 1, 0);
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = rows.length - 1;
          else if (event.key === 'Enter' || event.key === ' ') {
            const row = rows[focused];
            if (row && 'task' in row) selectTask(row.task.task);
          } else return;
          event.preventDefault();
          if (rows.length) {
            setFocused(next);
            scrollToIndex(next);
          }
        }}
      >
        <div className="task-list-space" style={{ height: totalHeight }}>
          {rows.slice(visibleRange[0], visibleRange[1] + 1).map((row, localIndex) => {
            const index = visibleRange[0] + localIndex;
            return (
              <button
                type="button"
                className="task-list-row"
                key={'task' in row ? row.task.task.fileId : `issue:${row.issue.path}`}
                id={`${listId}-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={focused === index}
                aria-posinset={index + 1}
                aria-setsize={rows.length}
                style={{ top: offsetTop(index) }}
                onClick={() => {
                  setFocused(index);
                  viewport.current?.focus();
                  if ('task' in row) selectTask(row.task.task);
                }}
              >
                {'task' in row ? (
                  <span
                    className="task-row-content"
                    title={`${row.task.title}\n${row.task.path}\n${row.task.summary}`}
                  >
                    <span className="task-row-title">
                      <strong>{row.task.title}</strong>
                      <TaskStatusBadge status={row.task.status} />
                    </span>
                    <span className="task-row-summary">{row.task.summary || '暂无正文摘要'}</span>
                    <span
                      className={
                        duplicates.has(row.task.task.taskId)
                          ? 'task-error task-row-path'
                          : 'task-muted task-row-path'
                      }
                    >
                      {duplicates.has(row.task.task.taskId) ? '重复身份 · ' : ''}
                      {row.task.path}
                    </span>
                  </span>
                ) : (
                  <span className="task-row-issue" title={row.issue.error.message}>
                    <strong className="task-row-path">{row.issue.path}</strong>
                    <span className="task-error task-row-summary">
                      {row.issue.error.code}：{row.issue.error.message}
                    </span>
                    {row.issue.fileId ? (
                      <span className="task-muted task-row-path">文件：{row.issue.fileId}</span>
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="task-pagination">
        {busy ? <p role="status">正在读取任务…</p> : null}
        {!busy && !error && !rows.length ? <p role="status">当前已扫描范围没有任务。</p> : null}
        {page?.nextOffset !== undefined ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void load(page.nextOffset, page.version, true)}
          >
            继续加载
          </button>
        ) : null}
      </div>
    </section>
  );
}
