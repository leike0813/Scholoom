import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { useBusinessSession } from '../../../apps/desktop/src/renderer/src/workbench/business-session';
import {
  ContextContributionProvider,
  useContextContribution,
} from '../../../apps/desktop/src/renderer/src/workbench/context-contributions';
import {
  readDraft,
  subscribeDraft,
  writeDraft,
} from '../../../apps/desktop/src/renderer/src/workbench/drafts';
import { createReportContext } from '../../../apps/desktop/src/renderer/src/workbench/report-context';
import { InstructionContextItems } from '../../../apps/desktop/src/renderer/src/workbench/shell/InstructionComposer';
import type { KernelClient } from '../../../packages/client/dist/index.js';
import type { ReportBridgeMessage } from '../../../packages/protocol/dist/report-contracts.js';
import { originalItem, snapshotFor, studies } from './sample';
import '../../../apps/desktop/src/renderer/src/styles.css';
import './style.css';

const calls: string[] = [];
// The narrow client is a declared fixture port; it never connects to the product kernel.
const client = {
  getSnapshot: () => ({ phase: 'connected', status: { dataDirectory: 'report-context-fixture' } }),
  subscribe: () => () => {},
  subscribeChanges: () => () => {},
  call: async (method: string, input: { sessionId?: string; projectId: string }) => {
    if (calls.length < 100) calls.push(method);
    if (method !== 'workbench.watch') throw new Error(`No fixture provider for ${method}`);
    return {
      revision: 1,
      provider: { configured: false, model: 'fixture-no-model', models: [] },
      projects: [
        {
          id: 'application',
          name: '合成工作域',
          path: 'fixture',
          trust: 'trusted',
          autoBackup: false,
        },
      ],
      sessions: [],
      messages: [],
      artifacts: [],
      ...(input.sessionId
        ? {
            session: {
              id: input.sessionId,
              projectId: input.projectId,
              title: input.sessionId,
              state: 'completed',
            },
          }
        : {}),
    };
  },
} as unknown as KernelClient;

type Consumer = ReturnType<typeof createReportContext>;
type SavedAction = {
  receive: Consumer['receive'];
  message: Extract<ReportBridgeMessage, { type: 'select' }>;
};

function ReportSelection({
  generation,
  capture,
  onReply,
}: {
  generation: number;
  capture(action: SavedAction): void;
  onReply(reply: ReturnType<Consumer['receive']>): void;
}) {
  const context = useContextContribution();
  const snapshot = useMemo(() => snapshotFor(generation), [generation]);
  const [consumer] = useState(() =>
    createReportContext({
      snapshot,
      viewId: 'trusted-report-sample',
      generation,
      basis: snapshot.resource.basis,
      appendContextItems: context.appendContextItems,
    }),
  );
  useEffect(() => () => consumer.dispose(), [consumer]);
  const [filter, setFilter] = useState('');
  const [order, setOrder] = useState('ascending');
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const visible = studies
    .filter((study) => `${study.name} ${study.method}`.includes(filter))
    .sort((a, b) => (order === 'ascending' ? a.year - b.year : b.year - a.year));
  const message = (): SavedAction['message'] => ({
    version: 1,
    viewId: 'trusted-report-sample',
    generation,
    basis: snapshot.resource.basis,
    type: 'select',
    objectIds: selected,
    request: comment,
  });
  return (
    <section aria-label="文献对比样本" className="fixture-section">
      <h2>固定文献对比</h2>
      <p>
        报告版本：<code>{snapshot.resource.basis}</code>
      </p>
      <div className="document-reader-toolbar">
        <label>
          筛选文献
          <input
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setSelected([]);
            }}
          />
        </label>
        <label>
          排序
          <select
            aria-label="排序"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          >
            <option value="ascending">年份升序</option>
            <option value="descending">年份降序</option>
          </select>
        </label>
        <button
          className="btn"
          type="button"
          onClick={() => setSelected(visible.map((study) => study.objectId))}
        >
          全选当前结果
        </button>
        <span role="status" aria-label="显示数量">
          {visible.length} / {studies.length}
        </span>
      </div>
      <table aria-label="固定文献对比">
        <thead>
          <tr>
            <th>选择</th>
            <th>文献</th>
            <th>年份</th>
            <th>方法与说明</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((study) => (
            <tr key={study.objectId}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`选择 ${study.name}`}
                  checked={selected.includes(study.objectId)}
                  onChange={(event) =>
                    setSelected((previous) =>
                      event.target.checked
                        ? [...previous, study.objectId]
                        : previous.filter((id) => id !== study.objectId),
                    )
                  }
                />
              </td>
              <td>{study.name}</td>
              <td>{study.year}</td>
              <td>
                <details>
                  <summary>详情 {study.name}</summary>
                  <p>
                    {study.method} · {study.semantics}
                  </p>
                  <ul>
                    {study.sourceIndexes.map((index) => (
                      <li key={index}>
                        来源 {index + 1} · {snapshot.manifest.sources[index]?.basis}
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="fixture-comment">
        所选对象批注
        <textarea
          aria-label="所选对象批注"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      <div className="source-editor-tools">
        <button
          className="btn"
          type="button"
          disabled={!selected.length}
          onClick={() => onReply(consumer.receive(message()))}
        >
          附加所选对象
        </button>
        <button
          className="btn"
          type="button"
          disabled={!selected.length}
          onClick={() => capture({ receive: consumer.receive, message: message() })}
        >
          保留本次附加动作
        </button>
      </div>
    </section>
  );
}

function DraftBody({ storageKey }: { storageKey: string }) {
  const text = useSyncExternalStore(
    (notify) => subscribeDraft(storageKey, notify),
    () => readDraft(storageKey),
  );
  return (
    <label className="fixture-comment">
      共同草稿正文
      <textarea
        aria-label="共同草稿正文"
        value={text}
        onChange={(event) => writeDraft(storageKey, event.target.value)}
      />
    </label>
  );
}

function Fixture() {
  const session = useBusinessSession(client, 'connected');
  const [generation, setGeneration] = useState(1);
  const [saved, setSaved] = useState<SavedAction>();
  const [reply, setReply] = useState<ReturnType<Consumer['receive']>>();
  const seeded = useRef(new Set<string>());
  const commits = useRef(0);
  const key = session.draftKey ?? '';
  useEffect(() => {
    if (session.activeSessionId !== 'first' || !key || seeded.current.has(key)) return;
    seeded.current.add(key);
    if (!readDraft(`${key}|context-items`)) session.appendContextItems?.([originalItem]);
    if (!readDraft(key)) writeDraft(key, '保留用户原正文');
  }, [key, session.activeSessionId, session.appendContextItems]);
  useEffect(
    () =>
      subscribeDraft(`${key}|context-items`, () => {
        commits.current++;
      }),
    [key],
  );
  Reflect.set(window, 'reportContextFixture', {
    read: () => ({
      key,
      sessionId: session.activeSessionId,
      body: readDraft(key),
      serialized: readDraft(`${key}|context-items`),
      items: JSON.parse(readDraft(`${key}|context-items`) || '[]'),
      calls: [...calls],
      commits: commits.current,
      reply,
      generation,
    }),
  });
  useEffect(
    () => () => {
      Reflect.deleteProperty(window, 'reportContextFixture');
    },
    [],
  );
  return (
    <main className="document-reader fixture-root">
      <header className="fixture-section">
        <h1>报告选择 · 可信模块夹具</h1>
        <p>仅固定合成样本；不运行报告脚本、不读取真实来源、不发送指令。</p>
        <div className="source-editor-tools">
          <button
            className="btn"
            type="button"
            aria-pressed={session.activeSessionId === 'first'}
            onClick={() => session.selectSession?.('first')}
          >
            会话一
          </button>
          <button
            className="btn"
            type="button"
            aria-pressed={session.activeSessionId === 'second'}
            onClick={() => session.selectSession?.('second')}
          >
            会话二
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setGeneration((current) => current + 1)}
          >
            替换样本页面
          </button>
          <button
            className="btn"
            type="button"
            disabled={!saved}
            onClick={() => saved && setReply(saved.receive(saved.message))}
          >
            提交保留动作
          </button>
        </div>
        <output aria-label="附加结果">
          {reply?.type === 'queued'
            ? '已附加到共同草稿'
            : reply?.type === 'error'
              ? `未附加：${reply.error.code}`
              : '尚未附加'}
        </output>
      </header>
      <ContextContributionProvider
        items={session.contextItems}
        appendContextItems={session.appendContextItems}
        removeContextItem={session.removeContextItem}
        updateContextComment={session.updateContextComment}
        contextError={session.contextError}
      >
        {session.activeSessionId ? (
          <ReportSelection
            key={`${key}:${generation}`}
            generation={generation}
            capture={setSaved}
            onReply={setReply}
          />
        ) : (
          <p>请选择一个接收会话。</p>
        )}
        <section aria-label="共同草稿" className="fixture-section">
          <h2>共同草稿</h2>
          <DraftBody storageKey={key} />
          <InstructionContextItems />
        </section>
      </ContextContributionProvider>
    </main>
  );
}

const root = document.getElementById('fixture');
if (!root) throw new Error('Missing trusted fixture root');
createRoot(root).render(<Fixture />);
