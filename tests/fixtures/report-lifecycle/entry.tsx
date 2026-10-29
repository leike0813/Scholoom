// Fixed trusted module composition. No report HTML or domain authorization runs here.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useBusinessSession } from '../../../apps/desktop/src/renderer/src/workbench/business-session';
import { useContextContribution } from '../../../apps/desktop/src/renderer/src/workbench/context-contributions';
import {
  readContextDraft,
  workbenchInstanceId,
} from '../../../apps/desktop/src/renderer/src/workbench/context-drafts';
import { readDraft } from '../../../apps/desktop/src/renderer/src/workbench/drafts';
import { createReportContext } from '../../../apps/desktop/src/renderer/src/workbench/report-context';
import {
  createReportDrafts,
  type ReportDraftState,
} from '../../../apps/desktop/src/renderer/src/workbench/reports/report-drafts';
import { createReportUpdates } from '../../../apps/desktop/src/renderer/src/workbench/reports/report-updates';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import type { KernelClient } from '../../../packages/client/dist/index.js';
import { isWorkbenchContextSnapshot } from '../../../packages/protocol/dist/index.js';
import {
  isReportBridgeMessage,
  type ReportBridgeMessage,
  type ReportSnapshot,
} from '../../../packages/protocol/dist/report-contracts.js';
import { originalItem, snapshotFor, studies } from '../report-context/sample';
import type { LifecycleObservation } from './types.js';
import '../../../apps/desktop/src/renderer/src/styles.css';
import './style.css';

const configurationId = 'trusted-lifecycle-fixture';
const projectId = 'application';
const ref = { source: 'project' as const, projectId, fileId: 'comparison' };
// Reuse the fixed study contents in this synthetic session's project namespace.
const snapshot = (version: number) => {
  const value = snapshotFor(version);
  value.resource.ref = ref;
  value.manifest.sources = value.manifest.sources.map((source) => ({
    ...source,
    ref: source.ref.source === 'project' ? { ...source.ref, projectId } : source.ref,
  }));
  return value;
};
const calls: string[] = [];
const events: LifecycleObservation['events'] = [];
const record = (event: LifecycleObservation['events'][number]) => {
  if (events.length === 32) events.shift();
  events.push(event);
};
let subscriptions = 0;
let consumers = 0;
let nextView = 0;
const client = {
  getSnapshot: () => ({ phase: 'connected', status: { dataDirectory: configurationId } }),
  subscribe: () => () => {},
  subscribeChanges: () => () => {},
  call: async (
    method: string,
    input: { sessionId?: string; projectId: string; snapshot?: unknown; fileIds?: string[] },
  ) => {
    if (calls.length < 32) calls.push(method);
    if (method === 'workbench.context.publish') {
      if (input.snapshot !== null && !isWorkbenchContextSnapshot(input.snapshot))
        throw new Error('Invalid controlled workbench publication');
      return { ok: true };
    }
    if (method === 'files.resolve') {
      if (
        input.projectId !== projectId ||
        input.fileIds?.length !== 1 ||
        input.fileIds[0] !== ref.fileId
      )
        throw new Error('Only the fixed report entry may be resolved');
      return [
        { fileId: ref.fileId, path: '可信报告生命周期.html', kind: 'file', state: 'present' },
      ];
    }
    if (method !== 'workbench.watch') throw new Error(`No fixture provider for ${method}`);
    return {
      revision: 1,
      provider: { configured: false, model: 'fixture-no-model', models: [] },
      projects: [
        { id: projectId, name: '合成工作域', path: 'fixture', trust: 'trusted', autoBackup: false },
      ],
      sessions: [],
      messages: [],
      artifacts: [],
      ...(input.sessionId
        ? {
            session: { id: input.sessionId, projectId, title: input.sessionId, state: 'completed' },
          }
        : {}),
    };
  },
} as unknown as KernelClient;
type Consumer = ReturnType<typeof createReportContext>;
type Action = {
  receive: Consumer['receive'];
  message: Extract<ReportBridgeMessage, { type: 'select' }>;
};
type Access = 'available' | 'unavailable' | 'denied';
type DraftStore = ReturnType<typeof createReportDrafts>;
type Probe = () => NonNullable<LifecycleObservation['view']>;
const empty: ReportDraftState = { browse: { filter: '' }, draft: '', dirty: false };
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

function PageState({
  snapshot: loaded,
  store,
  capture,
  reply,
  onDispose,
  wire,
}: {
  snapshot: ReportSnapshot;
  store: DraftStore;
  capture(action: Action): void;
  reply(result: string): void;
  onDispose: { current: (() => void) | null };
  wire: { current: NonNullable<LifecycleObservation['view']>['wire'] };
}) {
  const basis = loaded.resource.basis;
  const context = useContextContribution();
  const [envelope] = useState(() => {
    const generation = nextView++;
    return {
      version: 1 as const,
      viewId: generation ? `reopened-lifecycle-view-${generation}` : 'v',
      generation,
      basis,
    };
  });
  const [consumer] = useState(() =>
    createReportContext({
      snapshot: loaded,
      ...envelope,
      appendContextItems: context.appendContextItems,
    }),
  );
  const [applied, apply] = useState<ReportDraftState | null>(null);
  const [restoreStatus, setRestoreStatus] = useState('loading');
  const stopped = useRef(false);
  const identity = { configurationId, windowId: workbenchInstanceId(), ref, basis };
  const restore = () => {
    const candidate = store.restore({ identity, status: 'available' });
    if (candidate.status === 'missing') {
      wire.current = null;
      apply(empty);
      setRestoreStatus('missing');
      return;
    }
    if (candidate.status !== 'restorable') {
      setRestoreStatus(candidate.status);
      return;
    }
    const message = { ...envelope, type: 'restore', ...candidate.state };
    const valid = isReportBridgeMessage(message);
    wire.current = {
      message,
      bytes: bytes(message),
      valid,
      viewId: envelope.viewId,
      generation: envelope.generation,
    };
    record({
      kind: valid ? 'restoreDelivered' : 'restoreRejected',
      basis,
      bytes: bytes(message),
      valid,
      generation: envelope.generation,
    });
    if (valid) apply(candidate.state);
    setRestoreStatus(valid ? 'restored' : 'tooLarge');
  };
  const dispose = () => {
    if (stopped.current) return;
    stopped.current = true;
    consumer.dispose();
    consumers--;
    record({ kind: 'contextDisposed', basis, generation: envelope.generation });
  };
  useLayoutEffect(() => {
    consumers++;
    onDispose.current = dispose;
    restore();
    return () => {
      dispose();
      if (onDispose.current === dispose) onDispose.current = null;
    };
  }, []);
  const save = (state: ReportDraftState) => {
    const message = { ...envelope, type: 'state', ...state };
    const result = store.save(message);
    if (result.status === 'stored') {
      // This is the trusted sample page's applied view, not a second persistent draft.
      const candidate = store.restore({ identity, status: 'available' });
      if (candidate.status === 'restorable') apply(candidate.state);
    }
    return result;
  };
  const select = (): Action['message'] => ({
    ...envelope,
    type: 'select',
    objectIds: ['trial-a'],
    request: text(applied?.draft),
  });
  return (
    <section className="lifecycle-pane" aria-label="可信文献对比">
      <h1>固定文献对比 · {basis}</h1>
      <output aria-label="页面恢复结果">{restoreStatus}</output>
      {applied ? (
        <>
          <table aria-label="固定文献对比">
            <thead>
              <tr>
                <th>研究</th>
                <th>年份</th>
                <th>方法</th>
              </tr>
            </thead>
            <tbody>
              {studies.slice(0, 3).map((study) => (
                <tr key={study.objectId}>
                  <td>{study.name}</td>
                  <td>{study.year}</td>
                  <td>{study.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <label>
            报告页面草稿
            <textarea
              aria-label="报告页面草稿"
              value={text(applied.draft)}
              onChange={(event) => save({ ...applied, draft: event.target.value, dirty: true })}
            />
          </label>
          <div className="source-editor-tools">
            <button
              className="btn"
              type="button"
              onClick={() => {
                const result = consumer.receive(select());
                reply(result.type === 'queued' ? 'queued' : result.error.code);
              }}
            >
              附加林的对象
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => capture({ receive: consumer.receive, message: select() })}
            >
              保留原版本动作
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                const message = { ...envelope, type: 'state', browse: {}, draft: '', dirty: true };
                message.draft = 'x'.repeat(65536 - bytes(message));
                const valid = isReportBridgeMessage(message);
                const result = store.save(message);
                record({
                  kind: result.status === 'stored' ? 'boundarySaved' : 'boundaryRejected',
                  basis,
                  bytes: bytes(message),
                  valid,
                  generation: envelope.generation,
                  ...(result.status === 'stored'
                    ? { localStorageWritten: result.localStorageWritten }
                    : {}),
                });
                if (result.status === 'stored')
                  apply({ browse: message.browse, draft: message.draft, dirty: true });
              }}
            >
              保存64KiB旧封套状态
            </button>
          </div>
        </>
      ) : (
        <p>完整恢复封套被拒绝，原状态仍保留，未调用页面恢复。</p>
      )}
    </section>
  );
}

function Lifecycle({
  basis,
  access,
  commonKey,
  capture,
  reply,
  onBasis,
  probe,
}: {
  basis: string;
  access: Access;
  commonKey: string;
  capture(action: Action): void;
  reply(result: string): void;
  onBasis(basis: string): void;
  probe: { current: Probe | null };
}) {
  const [updates] = useState(() =>
    createReportUpdates({
      entry: { ref, basis },
      load: async (evidence) => {
        record({ kind: 'controlledLoad', basis: evidence.basis });
        return snapshot(Number(evidence.basis.split('-v')[1]));
      },
    }),
  );
  const [, refresh] = useState(0);
  const activeDispose = useRef<(() => void) | null>(null);
  const wire = useRef<NonNullable<LifecycleObservation['view']>['wire']>(null);
  const state = updates.read();
  const currentBasis = state.current?.resource.basis ?? basis;
  const store = useMemo(
    () =>
      createReportDrafts({
        configurationId,
        windowId: workbenchInstanceId(),
        ref,
        basis: currentBasis,
      }),
    [currentBasis],
  );
  const approval = {
    identity: { configurationId, windowId: workbenchInstanceId(), ref, basis: currentBasis },
    status: access,
  };
  const candidate = store.restore(approval);
  const protection = () => {
    const saved = store.restore(approval);
    return {
      pageDirty: saved.status === 'restorable' && saved.state.dirty,
      explicitItems: readContextDraft(`${commonKey}|context-items`).some(
        (item) =>
          item.ref.source === 'project' &&
          item.ref.fileId === ref.fileId &&
          item.ref.projectId === projectId,
      ),
      composerDraft: !!readDraft(commonKey).trim(),
    };
  };
  useLayoutEffect(() => {
    subscriptions++;
    const unsubscribe = store.subscribe(() => {
      updates.protect(protection());
      refresh((value) => value + 1);
    });
    return () => {
      unsubscribe();
      subscriptions--;
    };
  }, [store, access, commonKey]);
  useEffect(() => {
    if (access === 'available') void updates.offer().then(() => refresh((value) => value + 1));
    else {
      updates.invalidate({
        code: access === 'denied' ? 'permissionDenied' : 'unavailable',
        message: 'Controlled fixture access',
      });
      refresh((value) => value + 1);
    }
  }, [access]);
  useLayoutEffect(
    () => () => {
      activeDispose.current?.();
      updates.dispose();
      probe.current = null;
    },
    [],
  );
  useEffect(() => {
    if (state.current) onBasis(state.current.resource.basis);
  }, [state.current?.resource.basis]);
  probe.current = () => ({
    updates: updates.read(),
    recovery: candidate.status,
    wire: access === 'available' ? wire.current : null,
    stored: access === 'denied' ? null : readDraft(store.key),
    protection: protection(),
  });
  return (
    <section className="lifecycle-pane" aria-label="报告生命周期">
      <div className="source-editor-tools">
        <button
          className="btn"
          type="button"
          disabled={access !== 'available' || state.loading}
          onClick={async () => {
            updates.protect(protection());
            await updates.offer({ ref, basis: 'fixture-report-v2' });
            refresh((value) => value + 1);
          }}
        >
          加载第二版
        </button>
        <button
          className="btn"
          type="button"
          disabled={!state.canReplace || access !== 'available'}
          onClick={() => {
            if (updates.viewPending()) {
              activeDispose.current?.();
              refresh((value) => value + 1);
            }
          }}
        >
          明确查看新版
        </button>
        <output aria-label="当前报告版本">{state.current?.resource.basis ?? 'none'}</output>
        <output aria-label="待看报告版本">{state.pending?.resource.basis ?? 'none'}</output>
      </div>
      {access === 'available' && state.canDisplay && state.current ? (
        <PageState
          key={currentBasis}
          snapshot={state.current}
          store={store}
          capture={capture}
          reply={reply}
          onDispose={activeDispose}
          wire={wire}
        />
      ) : (
        <>
          <output aria-label="状态恢复候选">{candidate.status}</output>
          {candidate.status === 'copyOnly' ? (
            <section aria-label="原版可复制草稿">
              <pre>{text(candidate.draft)}</pre>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

function Fixture() {
  const business = useBusinessSession(client, 'connected');
  const [open, setOpen] = useState(0);
  const [basis, setBasis] = useState('fixture-report-v1');
  const [access, setAccess] = useState<Access>('available');
  const [reply, setReply] = useState('none');
  const action = useRef<Action | null>(null);
  const probe = useRef<Probe | null>(null);
  const seeded = useRef(new Set<string>());
  const key = business.draftKey ?? '';
  useEffect(() => {
    if (business.activeSessionId !== 'first' || !key || seeded.current.has(key)) return;
    seeded.current.add(key);
    if (!readContextDraft(`${key}|context-items`).length)
      business.appendContextItems?.([
        { ...originalItem, ref: { source: 'project', projectId, fileId: 'notes' } },
      ]);
  }, [key, business.activeSessionId, business.appendContextItems]);
  const target = useMemo(
    () =>
      open
        ? { locator: ref, name: '可信报告生命周期.html', openMode: 'permanent' as const }
        : undefined,
    [open],
  );
  Reflect.set(window, 'reportLifecycleFixture', {
    read: (): LifecycleObservation => ({
      key,
      body: readDraft(key),
      serialized: readDraft(`${key}|context-items`),
      items: readContextDraft(`${key}|context-items`),
      calls: [...calls],
      view: probe.current?.() ?? null,
      reply,
      subscriptions,
      consumers,
      events: [...events],
    }),
  });
  useEffect(
    () => () => {
      Reflect.deleteProperty(window, 'reportLifecycleFixture');
    },
    [],
  );
  const session: WorkbenchSession = {
    status: 'sample',
    materials: [],
    selectedMaterials: [],
    toggleMaterial: () => {},
    adapter: { messages: [], onNew: async () => {}, convertMessage: (message) => message },
    ...business,
    controls: undefined,
    projectOnboardingDialog: undefined,
    projectTrustDialog: undefined,
    sessionNavigation: (
      <section className="lifecycle-pane" aria-label="夹具控制">
        <h2>可信生命周期夹具</h2>
        <p>固定合成样本；加载与授权为替身，不执行报告脚本，不发送指令。</p>
        <button className="btn" type="button" onClick={() => business.selectSession?.('first')}>
          接收会话
        </button>
        <button
          className="btn"
          type="button"
          disabled={!business.activeSessionId}
          onClick={() => setOpen((value) => value + 1)}
        >
          打开报告夹具
        </button>
        <label>
          原版本可得性
          <select
            aria-label="原版本可得性"
            value={access}
            onChange={(event) => setAccess(event.target.value as Access)}
          >
            <option value="available">可得且核准</option>
            <option value="unavailable">缺版但可保留草稿</option>
            <option value="denied">撤回读取资格</option>
          </select>
        </label>
        <button
          className="btn"
          type="button"
          disabled={!action.current}
          onClick={() => {
            if (action.current) {
              const result = action.current.receive(action.current.message);
              setReply(result.type === 'queued' ? 'queued' : result.error.code);
            }
          }}
        >
          提交保留的旧动作
        </button>
        <output aria-label="原动作结果">{reply}</output>
      </section>
    ),
    ...(target ? { resourceTarget: target } : {}),
    renderResource: () => (
      <Lifecycle
        basis={basis}
        access={access}
        commonKey={key}
        capture={(next) => {
          action.current = next;
          setReply('captured');
        }}
        reply={setReply}
        onBasis={setBasis}
        probe={probe}
      />
    ),
  };
  return <Workbench session={session} />;
}

const root = document.getElementById('fixture');
if (!root) throw new Error('Missing lifecycle fixture root');
createRoot(root).render(<Fixture />);
