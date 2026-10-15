import type { KernelClient } from '@scholoom/client';
import type { BusinessParams, BusinessResult, Session } from '@scholoom/protocol';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { relativeTime } from './relative-time';

type Cursor = NonNullable<BusinessParams<'session.list'>['cursor']>;

/** details 弹层通用关闭：点击外部或 Esc 合上，Esc 不冒泡到外层 overlay。 */
function useDetailsDismiss(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onClick = (event: MouseEvent) => {
      if (node.open && !node.contains(event.target as Node)) node.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && node.open) {
        event.stopPropagation();
        node.open = false;
      }
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [ref]);
}

function SessionRow({
  item,
  selected,
  enabled,
  select,
  client,
  changed,
}: {
  item: Session;
  selected: boolean;
  enabled: boolean;
  select: () => void;
  client: KernelClient;
  changed: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const menu = useRef<HTMLDetailsElement>(null);
  useDetailsDismiss(menu);
  useEffect(() => setTitle(item.title), [item.title]);
  const running = ['queued', 'running', 'cancelling'].includes(item.state);
  const update = async (rename: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (rename)
        await client.call('session.rename', {
          projectId: item.projectId,
          sessionId: item.id,
          title,
        });
      else
        await client.call('session.archive', {
          projectId: item.projectId,
          sessionId: item.id,
          archived: !item.archived,
        });
      await changed();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '会话更新失败。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <li data-session-id={item.id}>
      <div className="session-row">
        <button
          type="button"
          className={`session${selected ? ' session--active' : ''}`}
          aria-label={`打开会话 ${item.title}`}
          aria-pressed={selected}
          onClick={select}
        >
          <span
            className={
              running ? 'dot dot--run' : item.state === 'failed' ? 'dot dot--err' : 'dot dot--idle'
            }
            role="img"
            aria-label={running ? '运行中' : item.state === 'failed' ? '失败' : '已停止'}
          />
          <span className="session__title" title={item.title}>
            {item.title}
          </span>
          <time className="session__time" dateTime={item.updatedAt}>
            {relativeTime(item.updatedAt)}
          </time>
        </button>
        <details className="session-actions" ref={menu}>
          <summary className="session-actions-toggle" aria-label={`管理会话 ${item.title}`}>
            ⋯
          </summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void update(true);
            }}
          >
            <label>
              会话标题
              <input
                aria-label={`会话标题 ${item.title}`}
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!enabled || busy}
              />
            </label>
            <button type="submit" disabled={!enabled || busy || !title.trim()}>
              保存标题
            </button>
            <button
              type="button"
              disabled={!enabled || busy || (running && !item.archived)}
              onClick={() => void update(false)}
            >
              {item.archived ? '恢复会话' : '归档会话'}
            </button>
            {running ? <p className="empty-hint">停止执行后可归档</p> : null}
            {error ? <p role="alert">{error}</p> : null}
          </form>
        </details>
      </div>
    </li>
  );
}

export function SessionList({
  client,
  projectId,
  activeSessionId,
  enabled,
  select,
  onChanged,
}: {
  client: KernelClient;
  projectId: string;
  activeSessionId: string;
  enabled: boolean;
  select: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [page, setPage] = useState<BusinessResult<'session.list'>>({ sessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const cursor = cursors.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 显式重试及写入回执触发同一范围重读。
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    let again = false;
    const update = async () => {
      if (!active) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      setLoading(true);
      try {
        const value = await client.call('session.list', {
          projectId,
          archived,
          query: query.trim(),
          ...(cursor ? { cursor } : {}),
          limit: 50,
        });
        if (active) {
          setPage(value);
          setError('');
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : '会话列表读取失败。');
      } finally {
        running = false;
        if (active) setLoading(false);
        if (again) {
          again = false;
          void update();
        }
      }
    };
    setPage({ sessions: [] });
    const timer = setTimeout(() => void update(), query ? 150 : 0);
    const unsubscribe = client.subscribeChanges((change) => {
      if (change.sessionsChanged && (!change.projectId || change.projectId === projectId))
        void update();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [client, projectId, enabled, query, archived, cursor, revision]);
  const changed = async () => {
    setRevision((value) => value + 1);
    await onChanged();
  };
  return (
    <section className="session-navigation" aria-label="会话管理">
      <input
        id="session-search"
        type="search"
        aria-label="查找会话标题"
        placeholder="查找会话标题"
        value={query}
        maxLength={200}
        onChange={(event) => {
          setQuery(event.target.value);
          setCursors([]);
        }}
      />
      <div className="session-filters">
        <button
          type="button"
          aria-pressed={!archived}
          onClick={() => {
            setArchived(false);
            setCursors([]);
          }}
        >
          活动
        </button>
        <button
          type="button"
          aria-pressed={archived}
          onClick={() => {
            setArchived(true);
            setCursors([]);
          }}
        >
          归档
        </button>
      </div>
      {error ? (
        <p role="alert">
          {error}
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            重试列表
          </button>
        </p>
      ) : null}
      {!page.sessions.length ? (
        <p className="empty-hint">{loading ? '正在读取会话…' : '没有匹配的会话'}</p>
      ) : null}
      <ul className="session-list">
        {page.sessions.map((item) => (
          <SessionRow
            key={item.id}
            item={item}
            selected={item.id === activeSessionId}
            enabled={enabled}
            client={client}
            select={() => select(item.id)}
            changed={changed}
          />
        ))}
      </ul>
      <div className="session-pagination">
        <button
          type="button"
          disabled={!cursors.length || loading || !enabled}
          onClick={() => setCursors((current) => current.slice(0, -1))}
        >
          上一页会话
        </button>
        <button
          type="button"
          disabled={!page.nextCursor || loading || !enabled}
          onClick={() => {
            const next = page.nextCursor;
            if (next) setCursors((current) => [...current, next]);
          }}
        >
          下一页会话
        </button>
      </div>
    </section>
  );
}
