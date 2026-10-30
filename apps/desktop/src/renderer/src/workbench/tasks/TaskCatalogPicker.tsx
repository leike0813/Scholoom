import { useEffect, useRef, useState } from 'react';
import type { TaskCatalogCandidate, WorkbenchSession } from '../session';
import { taskErrorMessage } from './TaskList';

const candidateValue = (libraryId: string, source: TaskCatalogCandidate['source']) =>
  JSON.stringify([libraryId, source.id, source.version, source.revision]);

export function TaskCatalogPicker({
  port,
  selected,
  onSelect,
}: {
  port: NonNullable<WorkbenchSession['taskCatalog']>;
  selected: TaskCatalogCandidate | undefined;
  onSelect: (candidate: TaskCatalogCandidate | undefined) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<Awaited<ReturnType<typeof port.list>>>();
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    void port;
    setPage(undefined);
    setBusy(false);
    return () => {
      generation.current++;
    };
  }, [port]);
  const load = async (offset = 0) => {
    const current = ++generation.current;
    setBusy(true);
    setPage(undefined);
    setError('');
    try {
      const result = await port.list({ query, offset, limit: 25 });
      if (current === generation.current) {
        setPage(result);
        setOffset(offset);
      }
    } catch (reason) {
      if (current === generation.current) setError(taskErrorMessage(reason));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <fieldset>
      <legend>文献库题录候选</legend>
      <label>
        查找题录
        <input
          maxLength={200}
          value={query}
          onChange={(event) => {
            generation.current++;
            setBusy(false);
            setPage(undefined);
            setQuery(event.target.value);
          }}
        />
      </label>
      <div className="task-toolbar">
        <button type="button" className="btn" disabled={busy} onClick={() => void load()}>
          读取题录候选
        </button>
        {offset > 0 && page ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void load()}>
            返回题录首页
          </button>
        ) : null}
        {page?.nextOffset !== undefined ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void load(page.nextOffset)}
          >
            下一页题录
          </button>
        ) : null}
      </div>
      {busy ? <p role="status">正在读取题录候选…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {page && !page.sources.length ? <p role="status">没有匹配的题录。</p> : null}
      <label>
        来源题录
        <select
          value={selected ? candidateValue(selected.libraryId, selected.source) : ''}
          onChange={(event) => {
            if (!event.target.value) {
              onSelect(undefined);
              return;
            }
            const source = page?.sources.find(
              (source) => candidateValue(page.libraryId, source) === event.target.value,
            );
            if (page && source)
              onSelect({
                libraryId: page.libraryId,
                source: { id: source.id, version: source.version, revision: source.revision },
              });
          }}
        >
          <option value="">请选择题录</option>
          {selected &&
          !page?.sources.some(
            (source) =>
              candidateValue(page.libraryId, source) ===
              candidateValue(selected.libraryId, selected.source),
          ) ? (
            <option value={candidateValue(selected.libraryId, selected.source)}>
              已选：{selected.source.id} · {selected.source.version} · 修订{' '}
              {selected.source.revision}
            </option>
          ) : null}
          {page?.sources.map((source) => (
            <option key={source.id} value={candidateValue(page.libraryId, source)}>
              {source.metadata.title} · {source.version} · 修订 {source.revision} ·{' '}
              {source.attachmentState === 'unavailable' ? '附件未取得' : '已有附件登记'}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
