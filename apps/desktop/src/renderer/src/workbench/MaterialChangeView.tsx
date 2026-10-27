import type { KernelClient } from '@scholoom/client';
import type {
  FileChangesResult,
  FileEdit,
  FileEditOrigin,
  ResourceEvidence,
} from '@scholoom/protocol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lineDiff } from './line-diff';
import { resourceKey, resourceSourceLabels } from './resource-controller';

export function ContentDiff({ before, after }: { before: string; after: string }) {
  const differences = useMemo(() => lineDiff(before, after), [before, after]);
  if (!differences)
    return (
      <>
        <section aria-label="修改前内容">
          <pre>{before}</pre>
        </section>
        <section aria-label="修改后内容">
          <pre>{after}</pre>
        </section>
      </>
    );
  return (
    <section aria-label="内容差异">
      <pre>
        {differences.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 只读差异行允许重复内容。
          <div key={`${index}-${row.kind}`} className={`diff-${row.kind}`}>
            {row.kind === 'add' ? '+ ' : row.kind === 'remove' ? '- ' : '  '}
            {row.text}
          </div>
        ))}
      </pre>
    </section>
  );
}

const originLabel = (origin: FileEditOrigin | undefined) =>
  origin?.kind === 'human'
    ? '人工修改'
    : origin?.kind === 'system'
      ? '系统修改'
      : origin?.kind === 'execution'
        ? 'Agent执行修改'
        : '执行者未知';

function Evidence({ value }: { value: ResourceEvidence | undefined }) {
  return value ? (
    <>
      <span>{resourceSourceLabels[value.ref.source]}</span>{' '}
      <code>{resourceKey({ locator: value.ref, name: '' })}</code> · <code>{value.basis}</code>
    </>
  ) : (
    <>未知或未记录</>
  );
}

export function MaterialChangeView({
  edit,
  onUndo,
  undoDisabled = false,
}: {
  edit: FileEdit;
  onUndo: () => void;
  undoDisabled?: boolean;
}) {
  const origin = edit.origin;
  return (
    <section aria-label="选定修改">
      <p>已保存修改 · {edit.path}</p>
      <dl>
        <dt>修改编号</dt>
        <dd>
          <code>{edit.id}</code> · {edit.createdAt}
        </dd>
        <dt>执行者</dt>
        <dd>
          {originLabel(origin)}
          {origin && origin.kind !== 'unknown' ? (
            <>
              {' '}
              · {origin.principal.id} · {origin.moduleId}
            </>
          ) : null}
        </dd>
        {origin?.kind === 'execution' ? (
          <>
            <dt>会话／运行／执行实例</dt>
            <dd>
              <code>{origin.sessionId}</code> ／ <code>{origin.runId}</code> ／{' '}
              <code>{origin.instanceId}</code>
            </dd>
            <dt>执行指令集合</dt>
            <dd>
              {origin.instructionContext.state === 'observed'
                ? origin.instructionContext.instructionIds.join('、') || '空集合'
                : '未知'}
            </dd>
            <dt>单次修改对应指令</dt>
            <dd>未知</dd>
            <dt>工具关联</dt>
            <dd>未知</dd>
            <dt>委派关联</dt>
            <dd>
              {origin.delegation ? (
                <>
                  <code>{origin.delegation.delegationId}</code> ／{' '}
                  <code>{origin.delegation.parentRunId}</code> ／{' '}
                  <code>{origin.delegation.parentInstanceId}</code>
                </>
              ) : (
                '未知'
              )}
            </dd>
          </>
        ) : null}
        <dt>修改理由</dt>
        <dd>未知（记录未提供）</dd>
        <dt>修改前依据</dt>
        <dd>
          <Evidence value={edit.beforeEvidence} />
        </dd>
        <dt>修改后依据</dt>
        <dd>
          <Evidence value={edit.afterEvidence} />
        </dd>
        {edit.revertsEditId ? (
          <>
            <dt>撤销了修改</dt>
            <dd>
              <code>{edit.revertsEditId}</code>
            </dd>
          </>
        ) : null}
      </dl>
      <ContentDiff before={edit.before} after={edit.after} />
      <button type="button" className="btn" onClick={onUndo} disabled={undoDisabled}>
        撤销此修改
      </button>
    </section>
  );
}

export function MaterialHistory({
  client,
  projectId,
  fileId,
  canUndo,
  onChanged,
  onClose,
  visible = true,
}: {
  client: KernelClient;
  projectId: string;
  fileId: string;
  canUndo: boolean;
  onChanged: () => Promise<void>;
  onClose: () => void;
  visible?: boolean;
}) {
  const [page, setPage] = useState<FileChangesResult>();
  const [edit, setEdit] = useState<FileEdit>();
  const [busy, setBusy] = useState<'page' | 'edit' | 'undo'>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [uncertainEdits, setUncertainEdits] = useState<string[]>([]);
  const request = useRef(0);
  const undoing = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const refreshAfterUndo = useRef(false);
  const fail = useCallback((failure: unknown, action: string) => {
    const code =
      typeof failure === 'object' && failure !== null ? Reflect.get(failure, 'code') : undefined;
    if (code === 'permissionDenied') {
      setPage(undefined);
      setEdit(undefined);
    }
    setError(
      `${action}失败${code ? `（${code}）` : ''}：${failure instanceof Error ? failure.message : String(failure)}`,
    );
  }, []);
  const load = useCallback(
    async (cursor?: FileChangesResult['nextCursor']) => {
      const current = ++request.current;
      setBusy('page');
      setError('');
      setStatus('');
      setEdit(undefined);
      try {
        const result = await client.call('files.changes', {
          projectId,
          fileId,
          limit: 10,
          ...(cursor ? { cursor } : {}),
        });
        if (current === request.current) setPage(result);
      } catch (failure) {
        if (current === request.current) {
          setPage(undefined);
          fail(failure, '读取修改摘要');
        }
      } finally {
        if (current === request.current) setBusy(undefined);
      }
    },
    [client, projectId, fileId, fail],
  );
  useEffect(() => {
    if (!visible) {
      if (!undoing.current) request.current++;
      setPage(undefined);
      setEdit(undefined);
      setError('');
      if (undoing.current) refreshAfterUndo.current = true;
      else setBusy(undefined);
    } else if (!undoing.current) void load();
  }, [load, visible]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 客户端或文件查询范围改变时使旧回调失效。
  useEffect(() => {
    return () => {
      request.current++;
    };
  }, [load]);
  const select = async (editId: string) => {
    const current = ++request.current;
    setBusy('edit');
    setError('');
    setStatus('');
    setEdit(undefined);
    try {
      const result = await client.call('files.edit', { projectId, fileId, editId });
      if (current === request.current) setEdit(result);
    } catch (failure) {
      if (current === request.current) fail(failure, '读取选定修改');
    } finally {
      if (current === request.current) setBusy(undefined);
    }
  };
  const undo = async () => {
    if (!edit || !canUndo || busy || undoing.current || uncertainEdits.includes(edit.id)) return;
    undoing.current = true;
    const current = ++request.current;
    setBusy('undo');
    setError('');
    setStatus('');
    let saved = false;
    try {
      const result = await client.call('files.undo', { projectId, editId: edit.id });
      saved = true;
      if (current !== request.current) return;
      setEdit(result);
      setStatus('撤销已保存，当前显示实际撤销记录。');
      await onChanged();
      const changes = await client.call('files.changes', { projectId, fileId, limit: 10 });
      if (current === request.current) setPage(changes);
    } catch (failure) {
      if (current === request.current) {
        if (
          !saved &&
          typeof failure === 'object' &&
          failure !== null &&
          Reflect.get(failure, 'code') === 'outcomeUnknown'
        )
          setUncertainEdits((previous) =>
            previous.includes(edit.id) ? previous : [...previous, edit.id],
          );
        fail(failure, saved ? '撤销已保存，结果刷新' : '撤销');
      }
    } finally {
      undoing.current = false;
      if (current === request.current) {
        setBusy(undefined);
        if (refreshAfterUndo.current && visibleRef.current) void load();
      }
      refreshAfterUndo.current = false;
    }
  };
  if (!visible) return null;
  return (
    <section
      aria-label="文件修改历史"
      style={{ flexShrink: 0, maxHeight: '50%', overflow: 'auto' }}
    >
      <button type="button" className="btn" disabled={!!busy} onClick={() => void load()}>
        重读修改历史
      </button>
      <button type="button" className="btn" onClick={onClose} disabled={busy === 'undo'}>
        关闭修改历史
      </button>
      {busy ? (
        <p role="status">
          {busy === 'page'
            ? '正在读取修改摘要…'
            : busy === 'edit'
              ? '正在读取选定修改…'
              : '正在撤销并核查结果…'}
        </p>
      ) : null}
      {page ? (
        <>
          <div role="status" aria-label="历史覆盖范围">
            <p>
              查询锚点：
              {page.coverage.anchor === 'matched'
                ? '已匹配'
                : page.coverage.anchor === 'missing'
                  ? '未找到，存在覆盖缺口'
                  : '未指定'}
            </p>
            <p>历史保留：{page.coverage.retention === 'pruned' ? '部分记录已清理' : '范围未知'}</p>
            <p>
              查询时文件：
              {page.coverage.current === 'matchesLatest'
                ? '与最新记录匹配'
                : page.coverage.current === 'changedOrUnrecorded'
                  ? '已变化或存在未记录修改'
                  : '无法核查'}
            </p>
          </div>
          {!page.changes.length ? <p>此查询窗口没有可读记录，不能据此确认没有变化。</p> : null}
          <ul>
            {page.changes.map((change) => (
              <li key={change.editId}>
                <button
                  type="button"
                  className="btn"
                  disabled={!!busy}
                  aria-label={`查看修改 ${change.editId}`}
                  aria-pressed={edit?.id === change.editId}
                  onClick={() => void select(change.editId)}
                >
                  {change.createdAt} · {originLabel(change.origin)}
                </button>
              </li>
            ))}
          </ul>
          {page.nextCursor ? (
            <button
              type="button"
              className="btn"
              disabled={!!busy}
              onClick={() => void load(page.nextCursor)}
            >
              更早修改
            </button>
          ) : null}
        </>
      ) : null}
      {error ? <p role="alert">{error} 当前内容、草稿及可用差异已保留，请核查。</p> : null}
      {status ? <p role="status">{status}</p> : null}
      {uncertainEdits.length ? (
        <p role="status">
          修改 {uncertainEdits.join('、')} 的撤销结果未知，请重读记录核查，不要重复撤销。
        </p>
      ) : null}
      {!canUndo ? <p>有未保存草稿或当前不可写，暂不能撤销。</p> : null}
      {edit ? (
        <MaterialChangeView
          edit={edit}
          onUndo={() => void undo()}
          undoDisabled={!canUndo || !!busy || uncertainEdits.includes(edit.id)}
        />
      ) : null}
    </section>
  );
}
