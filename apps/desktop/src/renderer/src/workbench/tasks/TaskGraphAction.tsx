import { KernelClientError } from '@scholoom/client';
import type {
  ErrorInfo,
  TaskGraphInputs,
  TaskGraphOutputs,
  TaskRead,
  TaskRef,
} from '@scholoom/protocol';
import { isErrorInfo, taskGraphInputOperation, validateBusiness } from '@scholoom/protocol';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { readDraft, subscribeDraft, writeDraft } from '../drafts';
import { type ResourceTarget, sameResourceRef } from '../resource-controller';
import type { WorkbenchSession } from '../session';
import { taskErrorMessage } from './TaskList';

type RunInput = TaskGraphInputs['tasks.runGraph'];
type RunResult = TaskGraphOutputs['tasks.runGraph'];
type Attempt = { input: RunInput; result?: RunResult; error?: ErrorInfo };
type GraphDraft = {
  open: boolean;
  graphId: string;
  version: string;
  config: string;
  sourceLinkIds: string[];
  attempt?: Attempt;
};

function matches(result: RunResult, input: RunInput): boolean {
  return (
    result.call.projectId === input.task.projectId &&
    result.call.sessionId === input.sessionId &&
    result.call.invocationId === input.invocationId &&
    result.call.instructionId === input.instructionId &&
    (!result.inputSnapshot ||
      (result.inputSnapshot.operationId === taskGraphInputOperation(input.processOperationId) &&
        result.inputSnapshot.resource.ref.projectId === input.task.projectId)) &&
    result.process.operationId === input.processOperationId &&
    (!('resource' in result.process) ||
      !result.process.resource ||
      result.process.resource.ref.projectId === input.task.projectId)
  );
}

function readGraphDraft(serialized: string, task: TaskRef): GraphDraft & { invalid?: string } {
  const empty = { open: false, graphId: '', version: '', config: '{}', sourceLinkIds: [] };
  if (!serialized) return empty;
  try {
    const value = JSON.parse(serialized) as GraphDraft;
    if (
      !value ||
      typeof value.open !== 'boolean' ||
      typeof value.graphId !== 'string' ||
      typeof value.version !== 'string' ||
      typeof value.config !== 'string' ||
      !Array.isArray(value.sourceLinkIds) ||
      value.sourceLinkIds.length > 100 ||
      value.sourceLinkIds.some((id) => typeof id !== 'string')
    )
      throw new Error('invalid graph draft');
    const attempt = value.attempt;
    if (
      attempt !== undefined &&
      (!attempt ||
        !validateBusiness('tasks.runGraph', 'params', attempt.input) ||
        attempt.input.task.projectId !== task.projectId ||
        attempt.input.task.taskId !== task.taskId ||
        attempt.input.task.fileId !== task.fileId ||
        (attempt.error !== undefined && !isErrorInfo(attempt.error)) ||
        (attempt.result !== undefined &&
          (!validateBusiness('tasks.runGraph', 'result', attempt.result) ||
            !matches(attempt.result, attempt.input))))
    )
      throw new Error('invalid graph request');
    return value;
  } catch {
    return {
      ...empty,
      open: true,
      invalid: '科研图草稿或调用记录无法核对，原记录已保留，请先核查。',
    };
  }
}

function rejected(error?: ErrorInfo): boolean {
  return (
    !!error &&
    [
      'invalidRequest',
      'permissionDenied',
      'notFound',
      'contentChanged',
      'targetAmbiguous',
      'tooLarge',
      'resourceLimit',
      'credentialUnavailable',
    ].includes(error.code)
  );
}

export function TaskGraphAction({
  session,
  entry,
  workItemId,
  onOpenResource,
}: {
  session: WorkbenchSession;
  entry: TaskRead;
  workItemId?: string;
  onOpenResource: (target: ResourceTarget) => Promise<void>;
}) {
  const key = `${session.taskDraftKey ?? entry.task.projectId}|${entry.task.taskId}|${entry.task.fileId}|graph-call`;
  const serialized = useSyncExternalStore(
    useCallback((notify) => subscribeDraft(key, notify), [key]),
    () => readDraft(key),
  );
  const draft = readGraphDraft(serialized, entry.task);
  const [page, setPage] = useState<TaskGraphOutputs['tasks.graphs']>();
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [inputContent, setInputContent] = useState<string>();
  const [inputBusy, setInputBusy] = useState(false);
  const inputRead = useRef(0);
  useEffect(
    () => () => {
      inputRead.current++;
    },
    [],
  );
  const generation = useRef(0);
  const flight = useRef(false);
  const id = useId();
  const port = session.taskGraphs;
  const store = (next: GraphDraft) => writeDraft(key, JSON.stringify(next));
  const load = useCallback(
    async (offset = 0) => {
      if (!port) {
        setPage(undefined);
        setLoading(false);
        return;
      }
      const current = ++generation.current;
      setLoading(true);
      setListError('');
      setPage(undefined);
      try {
        const result = await port.list({ projectId: entry.task.projectId, offset, limit: 25 });
        if (current !== generation.current) return;
        if (result.graphs.length > 25) throw new Error('科研图目录超出当前页范围，请重读目录。');
        setPage(result);
        setOffset(offset);
      } catch (reason) {
        if (current === generation.current) setListError(taskErrorMessage(reason));
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [port, entry.task.projectId],
  );
  useEffect(() => {
    if (draft.open) void load();
    return () => {
      generation.current++;
    };
  }, [draft.open, load]);

  const entryTarget: ResourceTarget = {
    locator: entry.entry.ref,
    name: entry.path,
    openMode: 'permanent',
  };
  const dirty = session.isResourceDirty?.(entryTarget) ?? false;
  const busySession =
    !!session.adapter.isRunning ||
    !!session.adapter.isDisabled ||
    session.sessions?.some(
      (item) => item.id === session.activeSessionId && item.status === 'running',
    );
  const attempt = draft.attempt;
  const sourceScope = attempt ? attempt.input.workItemId : workItemId;
  const targetSessionId = attempt?.input.sessionId ?? session.activeSessionId;
  const sources = (entry.metadata.links ?? []).filter(
    (link) =>
      link.role === 'source' &&
      (link.workItemId === undefined || link.workItemId === sourceScope) &&
      !(link.target.kind === 'project-file' && link.target.fileId === entry.task.fileId),
  );
  const selected = JSON.stringify([draft.graphId, draft.version]);
  const listed = page?.graphs.some(
    ({ definition }) =>
      definition.graphId === draft.graphId && definition.version === draft.version,
  );
  const change = (patch: Partial<GraphDraft>) => {
    if (!draft.invalid) store({ ...draft, ...patch });
  };

  const submit = async () => {
    if (flight.current || readGraphDraft(readDraft(key), entry.task).attempt || draft.invalid)
      return;
    setError('');
    if (session.isResourceDirty?.(entryTarget)) {
      setError('入口有未保存修改，请先在编辑器保存或核对草稿。');
      return;
    }
    if (
      !port ||
      !session.activeSessionId ||
      busySession ||
      !page?.graphs.length ||
      page.unavailableReason ||
      !draft.graphId ||
      !draft.version
    )
      return;
    let config: RunInput['config'];
    try {
      const value: unknown = JSON.parse(draft.config);
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('not an object');
      config = value as RunInput['config'];
    } catch {
      setError('科研图配置需要有效的 JSON 对象。');
      return;
    }
    const input: RunInput = {
      task: entry.task,
      basis: entry.entry.basis,
      sessionId: session.activeSessionId,
      invocationId: crypto.randomUUID(),
      instructionId: crypto.randomUUID(),
      processOperationId: crypto.randomUUID(),
      graphId: draft.graphId,
      version: draft.version,
      config,
      sourceLinkIds: draft.sourceLinkIds.filter((id) => sources.some((link) => link.id === id)),
      ...(workItemId === undefined ? {} : { workItemId }),
    };
    const settle = (next: Attempt) => {
      flight.current = false;
      const current = readGraphDraft(readDraft(key), input.task);
      if (!current.invalid && current.attempt?.input.invocationId === input.invocationId)
        store({ ...current, attempt: next });
    };
    flight.current = true;
    store({ ...draft, attempt: { input } });
    try {
      const result = await port.run(input);
      if (!validateBusiness('tasks.runGraph', 'result', result) || !matches(result, input))
        throw new Error('科研图调用回执与原请求不符，请核查原调用。');
      settle({ input, result });
    } catch (reason) {
      settle({
        input,
        error: {
          code: reason instanceof KernelClientError ? reason.code : 'outcomeUnknown',
          message: taskErrorMessage(reason).slice(0, 512),
        },
      });
    }
  };

  return (
    <section className="task-section" aria-label="任务科研图">
      <button
        type="button"
        className="btn"
        aria-expanded={draft.open}
        aria-controls={`${id}-form`}
        disabled={!!draft.invalid}
        onClick={() => change({ open: !draft.open })}
      >
        运行科研图
      </button>
      {draft.open ? (
        <form
          id={`${id}-form`}
          className="task-form"
          aria-label="运行科研图"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="task-muted">
            目标会话：
            {targetSessionId
              ? `${targetSessionId === session.activeSessionId ? (session.activeSessionTitle ?? targetSessionId) : targetSessionId} · ${targetSessionId}`
              : '请先选择当前项目的会话。'}
          </p>
          {busySession ? <p role="status">当前会话忙碌或不可发送，请选择空闲会话。</p> : null}
          {dirty ? (
            <p className="task-error" role="alert">
              入口有未保存修改，请先在编辑器保存或核对草稿。
            </p>
          ) : null}
          {!port ? <p role="status">当前连接未提供科研图目录。</p> : null}
          {loading ? <p role="status">正在读取科研图目录…</p> : null}
          {listError ? (
            <p className="task-error" role="alert">
              科研图目录读取失败：{listError}
            </p>
          ) : null}
          {page?.unavailableReason || (page && !page.graphs.length) ? (
            <p role="status">
              科研图不可用：{page.unavailableReason ?? '当前没有可运行的科研图。'}
            </p>
          ) : null}
          <label>
            科研图及版本
            <select
              value={selected}
              disabled={
                !!attempt ||
                loading ||
                !!draft.invalid ||
                !page?.graphs.length ||
                !!page.unavailableReason
              }
              onChange={(event) => {
                const graph = page?.graphs.find(
                  ({ definition }) =>
                    JSON.stringify([definition.graphId, definition.version]) === event.target.value,
                );
                if (graph)
                  change({ graphId: graph.definition.graphId, version: graph.definition.version });
              }}
            >
              <option value={JSON.stringify(['', ''])}>请选择科研图</option>
              {draft.graphId && !listed ? (
                <option value={selected}>
                  已选：{draft.graphId} · {draft.version}
                </option>
              ) : null}
              {page?.graphs.map(({ definition, name }) => (
                <option
                  key={JSON.stringify([definition.graphId, definition.version])}
                  value={JSON.stringify([definition.graphId, definition.version])}
                >
                  {name} · {definition.version}
                </option>
              ))}
            </select>
          </label>
          {port ? (
            <div className="task-toolbar">
              <button type="button" className="btn" disabled={loading} onClick={() => void load()}>
                重读科研图目录
              </button>
              {offset > 0 ? (
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => void load()}
                >
                  返回科研图首页
                </button>
              ) : null}
              {page?.nextOffset !== undefined ? (
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => void load(page.nextOffset)}
                >
                  下一页科研图
                </button>
              ) : null}
            </div>
          ) : null}
          <label>
            JSON 配置
            <textarea
              rows={5}
              maxLength={262144}
              value={draft.config}
              disabled={!!attempt || !!draft.invalid}
              onChange={(event) => change({ config: event.target.value })}
            />
          </label>
          <fieldset disabled={!!attempt || !!draft.invalid}>
            <legend>
              来源材料
              {sourceScope
                ? ` · ${entry.metadata.workItems?.find((item) => item.id === sourceScope)?.title ?? sourceScope}`
                : ''}
            </legend>
            {sources.map((link) => (
              <label key={link.id} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={draft.sourceLinkIds.includes(link.id)}
                  onChange={(event) =>
                    change({
                      sourceLinkIds: event.target.checked
                        ? [...draft.sourceLinkIds, link.id]
                        : draft.sourceLinkIds.filter((id) => id !== link.id),
                    })
                  }
                />
                {link.note || link.id} ·{' '}
                {link.target.kind === 'project-file'
                  ? '项目材料'
                  : link.target.kind === 'library-source'
                    ? '文献库题录'
                    : '文献库材料'}
              </label>
            ))}
            {!sources.length ? (
              <p className="task-muted">当前范围没有来源链接，将包含本次入口快照。</p>
            ) : null}
          </fieldset>
          {draft.invalid || error ? (
            <p className="task-error" role="alert">
              {draft.invalid || error}
            </p>
          ) : null}
          {attempt ? (
            <div className="task-receipt">
              {!attempt.result ? (
                <>
                  <p role="status">
                    {rejected(attempt.error)
                      ? '调用已被拒绝，可修改后重新提交。'
                      : flight.current
                        ? '正在提交科研图调用…'
                        : '调用结果待核查。请保留原请求，按原会话与调用编号核查后再继续。'}
                  </p>
                  {attempt.error ? (
                    <p className="task-error" role="alert">
                      {attempt.error.code}：{attempt.error.message}
                    </p>
                  ) : null}
                </>
              ) : (
                <section aria-label="科研图调用结果">
                  <p role="status">科研调用已确认。</p>
                  <p className="task-reference">调用引用：{JSON.stringify(attempt.result.call)}</p>
                  {attempt.result.inputSnapshot ? (
                    <>
                      <p>调用输入：已保存为历史快照</p>
                      <button
                        type="button"
                        className="btn"
                        disabled={inputBusy || !port}
                        onClick={async () => {
                          const snapshot = attempt.result?.inputSnapshot;
                          if (!snapshot || !port) return;
                          const current = ++inputRead.current;
                          setInputContent(undefined);
                          setError('');
                          setInputBusy(true);
                          try {
                            const value = await port.readInput(snapshot.resource);
                            if (
                              value.basis !== snapshot.resource.basis ||
                              !sameResourceRef(value.ref, snapshot.resource.ref) ||
                              value.nextOffset !== undefined
                            )
                              throw new Error('历史输入身份、版本或完整性无法核对。');
                            if (current === inputRead.current) setInputContent(value.data);
                          } catch (reason) {
                            if (current === inputRead.current) setError(taskErrorMessage(reason));
                          } finally {
                            if (current === inputRead.current) setInputBusy(false);
                          }
                        }}
                      >
                        打开调用输入
                      </button>
                      {inputContent !== undefined ? (
                        <section aria-label="本次调用输入">
                          <pre className="task-body task-reference">{inputContent}</pre>
                        </section>
                      ) : null}
                    </>
                  ) : null}
                  <p>
                    过程文件：
                    {
                      (
                        {
                          complete: '已保存',
                          prepared: '待确认',
                          unknown: '结果未知',
                          failed: '保存失败',
                        } as const
                      )[attempt.result.process.state]
                    }
                  </p>
                  {'error' in attempt.result.process && attempt.result.process.error ? (
                    <p className="task-error" role="alert">
                      {attempt.result.process.error.code}：{attempt.result.process.error.message}
                    </p>
                  ) : null}
                  <p>
                    任务关联：
                    {
                      (
                        {
                          confirmed: '已关联',
                          pending: '等待过程文件确认',
                          failed: '关联失败',
                          unknown: '结果未知',
                        } as const
                      )[attempt.result.taskAssociation.state]
                    }
                  </p>
                  {attempt.result.taskAssociation.error ? (
                    <p className="task-error" role="alert">
                      {attempt.result.taskAssociation.error.code}：
                      {attempt.result.taskAssociation.error.message}
                    </p>
                  ) : null}
                  {'resource' in attempt.result.process && attempt.result.process.resource ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        const result = attempt.result;
                        if (!result || !('resource' in result.process) || !result.process.resource)
                          return;
                        void onOpenResource({
                          locator: result.process.resource.ref,
                          name: result.process.resource.path ?? result.process.resource.name,
                          openMode: 'permanent',
                        }).catch((reason: unknown) => setError(taskErrorMessage(reason)));
                      }}
                    >
                      打开调用记录
                    </button>
                  ) : null}
                </section>
              )}
              <details>
                <summary>原始调用请求</summary>
                <div className="task-body task-reference">
                  {JSON.stringify(attempt.input, null, 2)}
                </div>
              </details>
              {(!attempt.result && rejected(attempt.error)) ||
              (attempt.result?.process.state === 'complete' &&
                attempt.result.taskAssociation.state === 'confirmed') ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const { attempt: _attempt, ...editable } = draft;
                    inputRead.current++;
                    setInputContent(undefined);
                    setInputBusy(false);
                    store(editable);
                    setError('');
                  }}
                >
                  {attempt.result ? '新建科研图调用' : '返回修改'}
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="submit"
            className="btn"
            disabled={
              !!attempt ||
              !!draft.invalid ||
              dirty ||
              busySession ||
              !port ||
              !session.activeSessionId ||
              !page?.graphs.length ||
              !!page.unavailableReason ||
              !draft.graphId ||
              !draft.version
            }
          >
            提交科研图调用
          </button>
        </form>
      ) : null}
    </section>
  );
}
