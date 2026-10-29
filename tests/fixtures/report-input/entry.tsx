import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import { createInputTransaction, type Snapshot } from './transaction';
import '../../../apps/desktop/src/renderer/src/styles.css';
import '../report-structure/style.css';
import './style.css';

const observations = new Map<string, ReturnType<typeof createInputTransaction>>();
function InputView({ view }: { view: 'first' | 'second' }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [initial, setInitial] = useState<Snapshot>();
  const [, redraw] = useState(false);
  const [find, setFind] = useState('');
  const [found, setFound] = useState('');
  const [controlConflict, setControlConflict] = useState(false);
  const displayedOrder = useRef('');
  const doc = () => frame.current?.contentDocument;
  function apply(snapshot: Snapshot) {
    const current = doc();
    if (!current?.querySelector('#filter')) {
      setInitial(snapshot);
      return;
    }
    const parsed = new DOMParser().parseFromString(snapshot.html, 'text/html');
    const table = parsed.querySelector('table');
    const count = parsed.querySelector('#count');
    if (!table || !count) throw new Error('fixed template missing');
    const active = document.activeElement === frame.current ? current.activeElement : null;
    const summary = active?.tagName === 'SUMMARY' ? active.closest('tr')?.dataset.id : undefined;
    current.querySelector('table')!.replaceWith(current.importNode(table, true));
    current.querySelector('#count')!.textContent = count.textContent;
    current.querySelector<HTMLSelectElement>('#order')!.value =
      parsed.querySelector<HTMLSelectElement>('#order')!.value;
    displayedOrder.current = current.querySelector<HTMLSelectElement>('#order')!.value;
    if (summary && document.activeElement === frame.current)
      current.querySelector<HTMLElement>(`tr[data-id="${summary}"] summary`)?.focus();
  }
  const [transaction] = useState(() =>
    createInputTransaction({
      owner: { view, basis: `fixed-${view}`, receiver: `synthetic-${view}` },
      value: () => doc()?.querySelector<HTMLInputElement>('#filter')?.value,
      apply,
      changed: () => redraw((value) => !value),
      send: async (input) => {
        const response = await fetch(`/__input/${view}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const reply = await response.json();
        if (!response.ok) throw new Error(reply.code ?? `http-${response.status}`);
        return reply;
      },
    }),
  );
  observations.set(view, transaction);
  useEffect(() => {
    transaction.start();
    return () => transaction.dispose();
  }, [transaction]);
  function attach() {
    const current = doc();
    if (!current?.querySelector('#filter') || !initial) return;
    const token = {};
    transaction.bind(token);
    displayedOrder.current = current.querySelector<HTMLSelectElement>('#order')!.value;
    current.addEventListener('compositionstart', (event) => {
      if ((event.target as HTMLElement).id === 'filter') transaction.begin(token);
    });
    current.addEventListener('compositionend', (event) => {
      if ((event.target as HTMLElement).id === 'filter') transaction.end(token);
    });
    current.addEventListener('input', (event) => {
      if ((event.target as HTMLElement).id === 'filter') transaction.input(token);
    });
    current.addEventListener('change', (event) => {
      if ((event.target as HTMLElement).id !== 'order') return;
      const select = event.target as HTMLSelectElement;
      const accepted = transaction.control(token, 'order', select.value);
      if (!accepted) select.value = displayedOrder.current;
      setControlConflict(!accepted);
    });
    current.addEventListener('click', (event) => {
      const summary = (event.target as Element).closest('summary');
      if (summary) {
        event.preventDefault();
        setControlConflict(
          !transaction.control(token, 'toggle', summary.closest('tr')!.dataset.id!),
        );
      }
    });
  }
  function search() {
    const current = doc(),
      table = current?.querySelector('table');
    if (!current || !table) return;
    const walker = current.createTreeWalker(table, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(find) ?? -1;
      if (!find || index < 0 || !node.parentElement?.checkVisibility()) continue;
      const range = current.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + find.length);
      const selection = current.defaultView?.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      current.defaultView?.focus();
      setFound('找到');
      return;
    }
    setFound('未找到');
  }
  const state = transaction.inspect();
  return (
    <section className="structure-probe" aria-label="R2c输入事务试验">
      <p>固定可信输入事务；禁脚本原结构，非生产报告。当前：{view}</p>
      <div className="source-editor-tools">
        <label>
          查找可见正文{' '}
          <input
            aria-label="查找可见正文"
            value={find}
            onChange={(event) => setFind(event.target.value)}
          />
        </label>
        <button className="btn" type="button" onClick={search}>
          查找
        </button>
        <output aria-label="查找结果">{found}</output>
      </div>
      {state.error || state.invalid ? <p role="alert">{state.error || 'inputLimit'}</p> : null}
      {controlConflict ? (
        <output aria-label="控件反馈" data-code="controlConflict">
          当前输入尚未确认，此操作未受理。
        </output>
      ) : null}
      <iframe
        ref={frame}
        title="固定文献输入页"
        sandbox="allow-same-origin"
        srcDoc={initial?.html}
        onLoad={attach}
      />
    </section>
  );
}
const target = {
  locator: {
    source: 'project' as const,
    projectId: 'r2c-synthetic',
    fileId: 'comparison',
    path: 'comparison.html',
  },
  name: '可信输入事务.html',
  openMode: 'permanent' as const,
};
function Fixture() {
  const [view, setView] = useState<'first' | 'second'>('first');
  const [open, setOpen] = useState(true);
  Reflect.set(window, 'reportInput', {
    read: () => ({
      view,
      open,
      transactions: Object.fromEntries(
        [...observations].map(([key, transaction]) => [key, transaction.inspect()]),
      ),
    }),
  });
  const session: WorkbenchSession = {
    status: 'sample',
    projectId: 'r2c-synthetic',
    materials: [],
    selectedMaterials: [],
    toggleMaterial: () => {},
    adapter: { messages: [], onNew: async () => {}, convertMessage: (message) => message },
    resourceTarget: target,
    renderResource: () => (
      <section className="input-host">
        <div className="source-editor-tools">
          <button
            type="button"
            className="btn"
            disabled={view === 'second'}
            onClick={() => {
              setView('second');
              setOpen(true);
            }}
          >
            换报告版本及接收者
          </button>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            关闭输入视图
          </button>
        </div>
        {open ? <InputView key={view} view={view} /> : <p>输入视图已关闭</p>}
      </section>
    ),
  };
  return <Workbench session={session} />;
}
createRoot(document.getElementById('fixture')!).render(<Fixture />);
