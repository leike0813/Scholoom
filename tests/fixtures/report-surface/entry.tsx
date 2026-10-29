// Throwaway bounded semantic projection, not a report renderer or public protocol.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import '../../../apps/desktop/src/renderer/src/styles.css';
import './surface.css';

interface Snapshot {
  version: number;
  revision: number;
  filter: string;
  order: string;
  count: string;
  rows: {
    id: string;
    name: string;
    year: string;
    method: string;
    summary: string;
    expanded: boolean;
    description: string;
    effect: string;
  }[];
}

function Surface() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const composing = useRef(false);
  const surface = useRef<HTMLElement>(null);
  const [find, setFind] = useState('');
  const [found, setFound] = useState('');
  async function act(action?: string, value?: string) {
    try {
      const response = await fetch('/__surface/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
      if (!response.ok) throw new Error(`Fixture controller ${response.status}`);
      const next: Snapshot = await response.json();
      if (JSON.stringify(next).length > 16384 || next.version !== 1 || next.rows.length > 3)
        throw new Error('Unsupported fixed surface snapshot');
      setSnapshot(next);
    } catch (failure) {
      setError(String(failure));
    }
  }
  useEffect(() => {
    void act();
  }, []);
  Reflect.set(window, 'reportSurface', { read: () => snapshot });
  function findText() {
    const walker = document.createTreeWalker(surface.current!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const start = node.textContent?.indexOf(find) ?? -1;
      if (!find || start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + find.length);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      node.parentElement?.scrollIntoView({ block: 'nearest' });
      setFound('找到');
      return;
    }
    setFound('未找到');
  }
  return (
    <section className="document-reader surface-probe" aria-label="R2可信呈现试验">
      <h1>固定可信文献对比</h1>
      <p>
        调查夹具：检验独立执行页的状态与本页文本、输入和辅助语义能否对应。无OS隔离，不是生产报告。
      </p>
      <div className="source-editor-tools">
        <label>
          筛选文献{' '}
          <input
            aria-label="筛选文献"
            value={filter}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              void act('filter', event.currentTarget.value);
            }}
            onChange={(event) => {
              setFilter(event.target.value);
              if (!composing.current) void act('filter', event.target.value);
            }}
          />
        </label>
        <label>
          排序{' '}
          <select
            aria-label="排序"
            value={snapshot?.order ?? 'ascending'}
            onChange={(event) => {
              void act('order', event.target.value);
            }}
          >
            <option value="ascending">年份升序</option>
            <option value="descending">年份降序</option>
          </select>
        </label>
        <output aria-label="显示数量">{snapshot?.count}</output>
      </div>
      <div className="source-editor-tools">
        <label>
          查找可见正文{' '}
          <input
            aria-label="查找可见正文"
            value={find}
            onChange={(event) => setFind(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') findText();
            }}
          />
        </label>
        <button type="button" className="btn" onClick={findText}>
          查找
        </button>
        <output aria-label="查找结果">{found}</output>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <article ref={surface} aria-label="投影可见正文">
        <table aria-label="固定文献对比">
          <thead>
            <tr>
              <th>研究</th>
              <th>年份</th>
              <th>方法</th>
              <th>详情</th>
              <th>效应</th>
            </tr>
          </thead>
          <tbody>
            {snapshot?.rows.map((row) => (
              <tr key={row.id} data-object-id={row.id}>
                <td>{row.name}</td>
                <td>{row.year}</td>
                <td>{row.method}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    aria-expanded={row.expanded}
                    aria-controls={`detail-${row.id}`}
                    onClick={() => {
                      void act('toggle', row.id);
                    }}
                  >
                    {row.summary}
                  </button>
                  {row.expanded ? <p id={`detail-${row.id}`}>{row.description}</p> : null}
                </td>
                <td>{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

const session: WorkbenchSession = {
  status: 'sample',
  projectId: 'r2-synthetic',
  materials: [],
  selectedMaterials: [],
  toggleMaterial: () => {},
  adapter: { messages: [], onNew: async () => {}, convertMessage: (message) => message },
  resourceTarget: {
    locator: {
      source: 'project',
      projectId: 'r2-synthetic',
      fileId: 'comparison',
      path: 'comparison.html',
    },
    name: '可信呈现试验.html',
    openMode: 'permanent',
  },
  renderResource: () => <Surface />,
};
createRoot(document.getElementById('fixture')!).render(<Workbench session={session} />);
