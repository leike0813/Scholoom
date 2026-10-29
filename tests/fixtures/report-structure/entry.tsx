// Fixed trusted structure experiment; does not execute source scripts in the workbench.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import '../../../apps/desktop/src/renderer/src/styles.css';
import './style.css';

interface Snapshot {
  generation: number;
  html: string;
  state: { filter: string; [key: string]: unknown };
}
type Focus = { selector: string; start?: number; end?: number };
function Structure() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [find, setFind] = useState('');
  const [found, setFound] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef<Snapshot>(undefined);
  const busy = useRef(false);
  const live = useRef(true);
  const composing = useRef(false);
  const pending = useRef<{ action?: string; value?: string }>(undefined);
  const restore = useRef<Focus>(undefined);

  async function act(
    action?: string,
    value?: string,
    fromGeneration = current.current?.generation ?? 0,
  ) {
    if (!live.current) return;
    if (fromGeneration !== (current.current?.generation ?? 0)) {
      setError('obsolete');
      return;
    }
    if (
      action === 'filter' &&
      ((busy.current && pending.current?.action === action && pending.current.value === value) ||
        (!busy.current && current.current?.state.filter === value))
    )
      return;
    if (busy.current) {
      setError('busy');
      return;
    }
    busy.current = true;
    pending.current = { ...(action ? { action } : {}), ...(value !== undefined ? { value } : {}) };
    try {
      const result = await fetch('/__structure/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation: fromGeneration, action, value }),
      });
      const next = await result.json();
      if (!live.current) return;
      if (!result.ok) throw new Error(next.code ?? `http-${result.status}`);
      if (
        next.generation !== fromGeneration + 1 ||
        new TextEncoder().encode(next.html).length > 65536
      )
        throw new Error('invalid generation or size');
      const doc = frame.current?.contentDocument;
      const active = document.activeElement === frame.current ? doc?.activeElement : undefined;
      if (active?.id === 'filter') {
        const input = active as HTMLInputElement;
        restore.current = {
          selector: '#filter',
          start: input.selectionStart ?? 0,
          end: input.selectionEnd ?? 0,
        };
      } else if (active?.id === 'order') restore.current = { selector: '#order' };
      else if (active?.tagName === 'SUMMARY')
        restore.current = { selector: `tr[data-id="${active.closest('tr')?.dataset.id}"] summary` };
      else restore.current = undefined;
      current.current = next;
      setSnapshot(next);
      setError('');
    } catch (failure) {
      if (live.current) setError(String(failure));
    } finally {
      busy.current = false;
      pending.current = undefined;
    }
  }
  useEffect(() => {
    void act();
    return () => {
      live.current = false;
    };
  }, []);
  Reflect.set(window, 'reportStructure', {
    read: () => ({ snapshot: current.current, error, busy: busy.current }),
  });

  function attach() {
    const doc = frame.current?.contentDocument;
    if (!doc || !snapshot) return;
    const generation = snapshot.generation;
    doc.addEventListener('compositionstart', () => {
      composing.current = true;
    });
    doc.addEventListener('compositionend', (event) => {
      composing.current = false;
      if ((event.target as HTMLElement).id === 'filter')
        void act('filter', (event.target as HTMLInputElement).value, generation);
    });
    doc.addEventListener('input', (event) => {
      if (!composing.current && (event.target as HTMLElement).id === 'filter')
        void act('filter', (event.target as HTMLInputElement).value, generation);
    });
    doc.addEventListener('change', (event) => {
      if ((event.target as HTMLElement).id === 'order')
        void act('order', (event.target as HTMLSelectElement).value, generation);
    });
    doc.addEventListener('click', (event) => {
      const summary = (event.target as Element).closest('summary');
      if (!summary) return;
      event.preventDefault();
      void act('toggle', summary.closest('tr')!.dataset.id, generation);
    });
    const target = restore.current && doc.querySelector<HTMLElement>(restore.current.selector);
    if (target && document.activeElement === frame.current) {
      target.focus();
      if (target.tagName === 'INPUT' && restore.current?.start !== undefined)
        (target as HTMLInputElement).setSelectionRange(
          restore.current.start,
          restore.current.end ?? restore.current.start,
        );
    }
  }
  function search() {
    const doc = frame.current?.contentDocument;
    const table = doc?.querySelector('table');
    if (!doc || !table) return;
    const walker = doc.createTreeWalker(table, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(find) ?? -1;
      if (!find || index < 0 || !node.parentElement?.checkVisibility()) continue;
      const range = doc.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + find.length);
      const selection = doc.defaultView?.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      node.parentElement.scrollIntoView({ block: 'nearest' });
      doc.defaultView?.focus();
      setFound('找到');
      return;
    }
    setFound('未找到');
  }
  return (
    <section className="structure-probe" aria-label="R2b可信结构试验">
      <p>固定可信结构对照；不运行源脚本，不是生产报告或OS隔离。</p>
      <div className="source-editor-tools">
        <label>
          查找可见正文{' '}
          <input
            aria-label="查找可见正文"
            value={find}
            onChange={(event) => setFind(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') search();
            }}
          />
        </label>
        <button type="button" className="btn" onClick={search}>
          查找
        </button>
        <output aria-label="查找结果">{found}</output>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <iframe
        ref={frame}
        title="固定文献原结构"
        sandbox="allow-same-origin"
        srcDoc={snapshot?.html}
        onLoad={attach}
        data-generation={snapshot?.generation}
      />
    </section>
  );
}
const session: WorkbenchSession = {
  status: 'sample',
  projectId: 'r2b-synthetic',
  materials: [],
  selectedMaterials: [],
  toggleMaterial: () => {},
  adapter: { messages: [], onNew: async () => {}, convertMessage: (message) => message },
  resourceTarget: {
    locator: {
      source: 'project',
      projectId: 'r2b-synthetic',
      fileId: 'comparison',
      path: 'comparison.html',
    },
    name: '可信结构对照.html',
    openMode: 'permanent',
  },
  renderResource: () => <Structure />,
};
createRoot(document.getElementById('fixture')!).render(<Workbench session={session} />);
