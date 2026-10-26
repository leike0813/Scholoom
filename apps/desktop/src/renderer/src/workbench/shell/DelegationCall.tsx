import type { DelegationRecord } from '@scholoom/protocol';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { WorkbenchSession } from '../session';

export const DelegationContext = createContext<WorkbenchSession['delegations']>(undefined);

const states: Record<DelegationRecord['state'], string> = {
  accepted: '已受理，等待启动',
  running: '运行中',
  cancelling: '停止核查中',
  completed: '已完成',
  failed: '执行失败',
  cancelled: '已取消',
  interrupted: '已中断',
};
const results: Record<DelegationRecord['resultState'], string> = {
  available: '成果可用',
  partial: '部分成果',
  missing: '无成果',
  unknown: '成果待核查',
};
const messageOf = (reason: unknown) =>
  reason instanceof Error ? reason.message : '委派操作失败。';

/** 只在所属工具行展开时挂载；读取合并通知，关闭不改变后台执行。 */
export function DelegationCall({ delegationId }: { delegationId: string }) {
  const access = useContext(DelegationContext);
  const [loaded, setLoaded] = useState<{
    get: NonNullable<typeof access>['get'];
    id: string;
    record: DelegationRecord;
  }>();
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const refresh = useRef<() => void>(() => {});
  const cancel = useRef<() => void>(() => {});
  const get = access?.get;
  const cancelRequest = access?.cancel;
  const revision = access?.revision;

  useEffect(() => {
    if (!get || !cancelRequest) return;
    let active = true;
    let running = false;
    let pending = false;
    let stopping = false;
    let sequence = 0;
    setError('');
    setCancelling(false);
    const accept = (record: DelegationRecord) => {
      if (record.id !== delegationId) throw new Error('委派身份不匹配，请重新读取。');
      setLoaded({ get, id: delegationId, record });
    };
    const read = async () => {
      pending = true;
      if (running || stopping) return;
      running = true;
      while (active && pending && !stopping) {
        pending = false;
        const request = ++sequence;
        try {
          const record = await get(delegationId);
          if (active && request === sequence) {
            accept(record);
            setError('');
          }
        } catch (reason) {
          if (active && request === sequence) setError(`详情刷新失败：${messageOf(reason)}`);
        }
      }
      running = false;
    };
    refresh.current = () => void read();
    cancel.current = () => {
      if (stopping || !active) return;
      stopping = true;
      ++sequence;
      setCancelling(true);
      setError('');
      void (async () => {
        try {
          const record = await cancelRequest(delegationId);
          if (active) accept(record);
        } catch (reason) {
          if (active) setError(`取消回执未确认：${messageOf(reason)}`);
        } finally {
          stopping = false;
          if (active) {
            setCancelling(false);
            if (pending) void read();
          }
        }
      })();
    };
    return () => {
      active = false;
      refresh.current = () => {};
      cancel.current = () => {};
    };
  }, [get, cancelRequest, delegationId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 修订和所属读取端口变化均须触发一次有界刷新。
  useEffect(() => refresh.current(), [get, cancelRequest, delegationId, revision]);

  if (!access) return <p role="status">委派详情暂不可用。</p>;
  const record =
    loaded && loaded.get === get && loaded.id === delegationId ? loaded.record : undefined;
  const cancellable = record && ['accepted', 'running'].includes(record.state);
  return (
    <section aria-label="委派详情">
      {!record && !error ? <p role="status">正在读取委派详情…</p> : null}
      {record ? (
        <>
          <p>
            角色：{record.role.id} · {record.role.version}
          </p>
          <p>
            实际模型：{record.modelConfig.model}
            {record.modelConfig.effort ? ` · ${record.modelConfig.effort}` : ''}
          </p>
          <p role="status">
            {states[record.state]} · {results[record.resultState]}
          </p>
          {record.error ? (
            <p role="alert">
              {record.error.code}：{record.error.message}
            </p>
          ) : null}
          {record.report?.blockers ? (
            <>
              <div className="tool-call__label">障碍</div>
              <pre>{record.report.blockers}</pre>
            </>
          ) : null}
          {record.report ? (
            <details>
              <summary>发现与未完成项（候选报告）</summary>
              <div className="tool-call__label">发现</div>
              <pre>{record.report.findings || '未报告'}</pre>
              <div className="tool-call__label">未完成项</div>
              <pre>{record.report.unfinished || '未报告未完成项'}</pre>
            </details>
          ) : (
            <p className="tool-call__hint">尚无候选报告，交付完整性待核查。</p>
          )}
          {record.artifacts.map(({ resource, association }) => (
            <div key={JSON.stringify([resource.ref, resource.basis])}>
              <button
                type="button"
                className="btn"
                aria-label={`打开委派成果 ${resource.name}`}
                onClick={() => access.open(resource)}
              >
                {resource.name}
              </button>
              <span>
                {association?.state === 'confirmed' ? '已保存并登记' : '已保存，登记待核查'}
              </span>
            </div>
          ))}
          {cancellable || record.state === 'cancelling' ? (
            <button
              type="button"
              className="btn"
              disabled={cancelling || !cancellable}
              onClick={() => cancel.current()}
            >
              {cancelling
                ? '正在提交取消…'
                : record.state === 'cancelling'
                  ? '停止核查中'
                  : '取消委派'}
            </button>
          ) : null}
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" className="btn" onClick={() => refresh.current()}>
        刷新委派详情
      </button>
    </section>
  );
}
