import type { KernelClient } from '@scholoom/client';
import type { BusinessResult, Session } from '@scholoom/protocol';
import { useEffect, useRef, useState } from 'react';
import { relativeTime } from './relative-time';
import { Dialog } from './shell/dialog';

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '搜索未完成，请核对内核状态。';

function stateLabel(session: Session): string {
  if (['queued', 'running', 'cancelling'].includes(session.state)) return '运行中';
  if (session.state === 'failed') return '失败';
  return '已停止';
}

/** Codex 式全局会话查找：显式查询最近项目，结果只负责导航，不改变归档管理归属。 */
export function SessionSearchDialog({
  client,
  enabled,
  onClose,
  onSelect,
}: {
  client: KernelClient;
  enabled: boolean;
  onClose: () => void;
  onSelect: (projectId: string, sessionId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<BusinessResult<'session.search'>>({
    results: [],
    truncated: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const generation = ++request.current;
    const timer = setTimeout(
      () => {
        void (async () => {
          setLoading(true);
          try {
            const value = await client.call('session.search', {
              query: query.trim(),
              limit: 50,
            });
            if (!active || generation !== request.current) return;
            setResult(value);
            setError('');
          } catch (reason) {
            if (!active || generation !== request.current) return;
            setError(messageOf(reason));
          } finally {
            if (active && generation === request.current) setLoading(false);
          }
        })();
      },
      query ? 150 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, enabled, query]);

  const select = (projectId: string, sessionId: string) => {
    onSelect(projectId, sessionId);
    onClose();
  };

  return (
    <Dialog title="查找会话" onClose={onClose} className="session-search-dialog">
      <input
        type="search"
        aria-label="查找会话标题"
        placeholder="搜索所有最近项目的会话"
        value={query}
        maxLength={200}
        data-dialog-autofocus
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          const first = result.results[0];
          if (event.key === 'Enter' && first) select(first.project.id, first.session.id);
        }}
      />
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && result.results.length === 0 ? (
        <p className="empty-hint">没有匹配的会话</p>
      ) : null}
      <div className="session-search-results" aria-busy={loading || undefined}>
        {result.results.map(({ project, session }) => (
          <button
            type="button"
            key={`${project.id}:${session.id}`}
            className="session-search-result"
            aria-label={`打开会话 ${session.title}`}
            onClick={() => select(project.id, session.id)}
          >
            <span
              className={
                ['queued', 'running', 'cancelling'].includes(session.state)
                  ? 'dot dot--run'
                  : session.state === 'failed'
                    ? 'dot dot--err'
                    : 'dot dot--idle'
              }
              role="img"
              aria-label={stateLabel(session)}
            />
            <span className="session-search-result__main">
              <span className="session-search-result__title" title={session.title}>
                {session.title}
              </span>
              <span className="session-search-result__project">{project.name}</span>
            </span>
            {session.archived ? <span className="pill pill--idle">已归档</span> : null}
            <time className="session__time" dateTime={session.updatedAt}>
              {relativeTime(session.updatedAt)}
            </time>
          </button>
        ))}
      </div>
      {result.truncated ? <p className="empty-hint">仅显示最相关的前 50 个结果</p> : null}
    </Dialog>
  );
}
