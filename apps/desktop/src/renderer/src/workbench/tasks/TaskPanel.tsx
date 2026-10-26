import type { TaskLink, TaskRead, TaskRef } from '@scholoom/protocol';
import { useEffect, useId, useRef, useState } from 'react';
import { readDraft, writeDraft } from '../drafts';
import type { ResourceTarget } from '../resource-controller';
import type { WorkbenchSession } from '../session';
import { TaskDetail } from './TaskDetail';

export function TaskPanel({
  session,
  task,
  viewId,
  onOpenResource,
}: {
  session: WorkbenchSession;
  task: TaskRef;
  viewId: string;
  onOpenResource: (target: ResourceTarget) => Promise<void>;
}) {
  const [entry, setEntry] = useState<TaskRead>();
  const key = `${session.taskDraftKey ?? task.projectId}|${task.fileId}|association`;
  const [draft, setDraft] = useState<{ path: string; role: TaskLink['role']; note: string }>(() => {
    try {
      const stored = JSON.parse(readDraft(key));
      if (
        typeof stored.path === 'string' &&
        typeof stored.note === 'string' &&
        ['source', 'plan', 'process', 'result'].includes(stored.role)
      )
        return stored;
    } catch {}
    return { path: '', role: 'process', note: '' };
  });
  const { path, role, note } = draft;
  const changeDraft = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    writeDraft(key, JSON.stringify(next));
    setDraft(next);
  };
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const id = useId();
  if (!session.taskPort) return <p role="status">连接内核后可读取任务。</p>;
  return (
    <>
      <TaskDetail
        port={session.taskPort}
        task={task}
        viewId={viewId}
        revision={(session.taskRevision ?? 0) + saved}
        onOpenResource={onOpenResource}
        {...(session.appendContextItem ? { onAppendContext: session.appendContextItem } : {})}
        {...(session.associateTask
          ? {
              onAssociate: (current: TaskRead) => {
                if (busy) return;
                generation.current++;
                setEntry(current);
                setError('');
              },
            }
          : {})}
      />
      {entry && session.associateTask ? (
        <form
          className="task-form"
          aria-label="关联任务材料"
          onSubmit={(event) => {
            event.preventDefault();
            const associate = session.associateTask;
            if (!associate || busy) return;
            const current = ++generation.current;
            setBusy(true);
            setError('');
            void associate(entry, path, role, note)
              .then(() => {
                if (current !== generation.current) return;
                setEntry(undefined);
                writeDraft(key, '');
                setDraft({ path: '', role: 'process', note: '' });
                setSaved((value) => value + 1);
              })
              .catch((reason: unknown) => {
                if (current === generation.current)
                  setError(reason instanceof Error ? reason.message : '关联未完成，请重读入口。');
              })
              .finally(() => {
                if (current === generation.current) setBusy(false);
              });
          }}
        >
          <label htmlFor={`${id}-path`}>项目内材料路径</label>
          <input
            id={`${id}-path`}
            required
            value={path}
            disabled={busy}
            onChange={(event) => changeDraft({ path: event.target.value })}
          />
          <label htmlFor={`${id}-role`}>材料用途</label>
          <select
            id={`${id}-role`}
            value={role}
            disabled={busy}
            onChange={(event) => changeDraft({ role: event.target.value as TaskLink['role'] })}
          >
            <option value="source">来源</option>
            <option value="plan">计划</option>
            <option value="process">过程</option>
            <option value="result">成果</option>
          </select>
          <label htmlFor={`${id}-note`}>采用说明</label>
          <textarea
            id={`${id}-note`}
            value={note}
            maxLength={4096}
            disabled={busy}
            onChange={(event) => changeDraft({ note: event.target.value })}
          />
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" className="btn" disabled={busy}>
            保存关联
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setEntry(undefined)}>
            取消关联
          </button>
        </form>
      ) : null}
    </>
  );
}
