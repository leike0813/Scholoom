import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { useBusinessSession } from '../../../apps/desktop/src/renderer/src/workbench/business-session';
import { useContextContribution } from '../../../apps/desktop/src/renderer/src/workbench/context-contributions';
import {
  readContextDraft,
  workbenchInstanceId,
} from '../../../apps/desktop/src/renderer/src/workbench/context-drafts';
import { readDraft, subscribeDraft } from '../../../apps/desktop/src/renderer/src/workbench/drafts';
import { createReportContext } from '../../../apps/desktop/src/renderer/src/workbench/report-context';
import { createReportClient } from '../../../apps/desktop/src/renderer/src/workbench/reports/report-client';
import {
  createReportDrafts,
  type ReportDraftState,
} from '../../../apps/desktop/src/renderer/src/workbench/reports/report-drafts';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import { createKernelClient } from '../../../packages/client/dist/index.js';
import {
  isReportBridgeMessage,
  type ReportBridgeMessage,
  type ReportSnapshot,
} from '../../../packages/protocol/dist/report-contracts.js';
import type { ConnectedConfiguration, ConnectedObservation } from './types.js';
import '../../../apps/desktop/src/renderer/src/styles.css';
import '../report-lifecycle/style.css';

declare global {
  interface Window {
    reportConnectedAction(action: string): Promise<unknown>;
  }
}
type Client = ReturnType<typeof createKernelClient>;
type Adapter = ReturnType<typeof createReportClient>;
type Consumer = ReturnType<typeof createReportContext>;
type Action = {
  receive: Consumer['receive'];
  message: Extract<ReportBridgeMessage, { type: 'select' }>;
};
const events: ConnectedObservation['events'] = [];
const changes: ConnectedObservation['changes'] = [];
const record = (kind: string, basis?: string) => {
  if (events.length === 24) events.shift();
  events.push({ kind, ...(basis ? { basis } : {}) });
};
let consumers = 0;
let subscriptions = 0;
let settled = 0;
let generation = 0;
const empty: ReportDraftState = { browse: {}, draft: '', dirty: false };
const string = (value: unknown) => (typeof value === 'string' ? value : '');

function PageState({
  snapshot,
  configuration,
  capture,
  reply,
  disposeRef,
}: {
  snapshot: ReportSnapshot;
  configuration: ConnectedConfiguration;
  capture(action: Action): void;
  reply(result: string): void;
  disposeRef: { current: (() => void) | null };
}) {
  const contribution = useContextContribution();
  const basis = snapshot.resource.basis;
  const [envelope] = useState(() => ({
    version: 1 as const,
    viewId: `connected-view-${++generation}`,
    generation,
    basis,
  }));
  const [store] = useState(() =>
    createReportDrafts({
      configurationId: configuration.endpoint.dataDirectory,
      windowId: workbenchInstanceId(),
      ref: snapshot.resource.ref as Extract<typeof snapshot.resource.ref, { source: 'project' }>,
      basis,
    }),
  );
  const [consumer] = useState(() =>
    createReportContext({
      snapshot,
      ...envelope,
      appendContextItems: contribution.appendContextItems,
    }),
  );
  const [applied, setApplied] = useState<ReportDraftState>(empty);
  const stopped = useRef(false);
  const dispose = () => {
    if (!stopped.current) {
      stopped.current = true;
      consumer.dispose();
      consumers--;
      record('contextDisposed', basis);
    }
  };
  useLayoutEffect(() => {
    consumers++;
    disposeRef.current = dispose;
    const candidate = store.restore({
      identity: {
        configurationId: configuration.endpoint.dataDirectory,
        windowId: workbenchInstanceId(),
        ref: configuration.entry.ref as Extract<
          typeof configuration.entry.ref,
          { source: 'project' }
        >,
        basis,
      },
      status: 'available',
    });
    if (candidate.status === 'restorable') {
      const restore = { ...envelope, type: 'restore', ...candidate.state };
      if (isReportBridgeMessage(restore)) {
        setApplied(candidate.state);
        record('trustedPageRestore', basis);
      }
    }
    return () => {
      dispose();
      if (disposeRef.current === dispose) disposeRef.current = null;
    };
  }, []);
  const select = (): Action['message'] => ({
    ...envelope,
    type: 'select',
    objectIds: snapshot.manifest.objects.slice(0, 1).map((value) => value.objectId),
    request: string(applied.draft),
  });
  return (
    <section className="lifecycle-pane" aria-label="真实连接报告页面">
      <h2>{snapshot.resource.name}</h2>
      <p>{snapshot.manifest.objects[0]?.semantics}</p>
      <label>
        报告页面草稿
        <textarea
          aria-label="报告页面草稿"
          value={string(applied.draft)}
          onChange={(event) => {
            const next = { ...applied, draft: event.target.value, dirty: true };
            if (store.save({ ...envelope, type: 'state', ...next }).status === 'stored')
              setApplied(next);
          }}
        />
      </label>
      <button
        className="btn"
        type="button"
        onClick={() => {
          const result = consumer.receive(select());
          reply(result.type === 'queued' ? 'queued' : result.error.code);
        }}
      >
        附加报告对象
      </button>
      <button
        className="btn"
        type="button"
        onClick={() => capture({ receive: consumer.receive, message: select() })}
      >
        保留旧动作
      </button>
    </section>
  );
}

function Report({
  client,
  configuration,
  commonKey,
  capture,
  reply,
  probe,
}: {
  client: Client;
  configuration: ConnectedConfiguration;
  commonKey: string;
  capture(action: Action): void;
  reply(result: string): void;
  probe: {
    current: (() => { metadata: ReturnType<Adapter['read']>; stored: string | null }) | null;
  };
}) {
  const context = useContextContribution();
  const body = useSyncExternalStore(
    (notify) => subscribeDraft(commonKey, notify),
    () => readDraft(commonKey),
  );
  const [adapter] = useState(() =>
    createReportClient({
      client,
      dataDirectory: configuration.endpoint.dataDirectory,
      entry: configuration.entry,
      sessionId: configuration.sessionId,
    }),
  );
  const [, refresh] = useState(0);
  const [pageInstance, setPageInstance] = useState(0);
  const disposePage = useRef<(() => void) | null>(null);
  const state = adapter.read();
  const basis = state.current?.resource.basis ?? configuration.entry.basis;
  const store = useMemo(
    () =>
      createReportDrafts({
        configurationId: configuration.endpoint.dataDirectory,
        windowId: workbenchInstanceId(),
        ref: configuration.entry.ref as Extract<
          typeof configuration.entry.ref,
          { source: 'project' }
        >,
        basis,
      }),
    [basis],
  );
  const saved = state.canDisplay
    ? store.restore({
        identity: {
          configurationId: configuration.endpoint.dataDirectory,
          windowId: workbenchInstanceId(),
          ref: configuration.entry.ref as Extract<
            typeof configuration.entry.ref,
            { source: 'project' }
          >,
          basis,
        },
        status: 'available',
      })
    : null;
  const dirty = saved?.status === 'restorable' && saved.state.dirty;
  const explicit = context.items.some(
    (item) =>
      item.ref.source === 'project' &&
      configuration.entry.ref.source === 'project' &&
      item.ref.fileId === configuration.entry.ref.fileId &&
      item.ref.projectId === configuration.projectId,
  );
  useLayoutEffect(() => {
    subscriptions++;
    const unsubscribe = adapter.subscribe(() => refresh((value) => value + 1));
    return () => {
      unsubscribe();
      subscriptions--;
      disposePage.current?.();
      adapter.dispose();
      probe.current = null;
      record('adapterDisposed', basis);
    };
  }, []);
  useLayoutEffect(() => store.subscribe(() => refresh((value) => value + 1)), [store]);
  useLayoutEffect(() => {
    if (state.canDisplay)
      adapter.protect({
        pageDirty: !!dirty,
        explicitItems: explicit,
        composerDraft: !!body.trim(),
      });
  }, [dirty, explicit, body, state.canDisplay]);
  probe.current = () => ({
    metadata: adapter.read(),
    stored: adapter.read().canDisplay ? readDraft(store.key) : null,
  });
  return (
    <section className="lifecycle-pane" aria-label="真实报告客户端">
      <div className="source-editor-tools">
        <button
          className="btn"
          type="button"
          onClick={async () => {
            try {
              await adapter.recheck();
            } finally {
              settled++;
              record('recheckSettled');
            }
          }}
        >
          显式重新核查
        </button>
        <button
          className="btn"
          type="button"
          disabled={!state.canReplace}
          onClick={() => {
            if (adapter.viewPending()) {
              disposePage.current?.();
              setPageInstance((value) => value + 1);
            }
          }}
        >
          明确查看候选
        </button>
        <output aria-label="当前报告版本">{state.current?.resource.basis ?? 'none'}</output>
        <output aria-label="待看报告版本">{state.pending?.resource.basis ?? 'none'}</output>
        <output aria-label="报告可展示">{String(state.canDisplay)}</output>
        <output aria-label="报告错误">{state.error?.code ?? 'none'}</output>
      </div>
      {state.canDisplay && state.current ? (
        <PageState
          key={`${basis}|${pageInstance}`}
          snapshot={state.current}
          configuration={configuration}
          capture={capture}
          reply={reply}
          disposeRef={disposePage}
        />
      ) : (
        <p>报告待核查，受保护页面不展示。</p>
      )}
    </section>
  );
}

function Fixture({
  client,
  configuration,
}: {
  client: Client;
  configuration: ConnectedConfiguration;
}) {
  const connection = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const business = useBusinessSession(client, connection.phase);
  const [opening, setOpening] = useState(0);
  const [reply, setReply] = useState('none');
  const action = useRef<Action | null>(null);
  const probe = useRef<
    (() => { metadata: ReturnType<Adapter['read']>; stored: string | null }) | null
  >(null);
  const key = business.draftKey ?? '';
  const selected =
    business.projectId === configuration.projectId &&
    business.activeSessionId === configuration.sessionId;
  const target = useMemo(
    () =>
      opening
        ? {
            locator: configuration.entry.ref,
            name: configuration.entry.name,
            openMode: 'permanent' as const,
          }
        : undefined,
    [opening],
  );
  Reflect.set(window, 'reportConnectedFixture', {
    read: (): ConnectedObservation => ({
      projectId: business.projectId ?? '',
      sessionId: business.activeSessionId ?? '',
      body: readDraft(key),
      serialized: readDraft(`${key}|context-items`),
      items: readContextDraft(`${key}|context-items`),
      metadata: probe.current?.().metadata ?? null,
      stored: probe.current?.().stored ?? null,
      clientPhase: client.getSnapshot().phase,
      consumers,
      subscriptions,
      reply,
      settled,
      changes: [...changes],
      events: [...events],
    }),
  });
  const session: WorkbenchSession = {
    status: connection.phase,
    materials: [],
    selectedMaterials: [],
    toggleMaterial: () => {},
    adapter: { messages: [], onNew: async () => {}, convertMessage: (message) => message },
    ...business,
    controls: undefined,
    sessionNavigation: (
      <>
        {business.sessionNavigation}
        <section className="lifecycle-pane" aria-label="真实连接夹具控制">
          <h2>真实客户端模块夹具</h2>
          <p>真实隔离项目/库与认证RPC；仅固定可信React页面，不执行报告脚本。</p>
          <button
            className="btn"
            type="button"
            disabled={!selected}
            onClick={() => setOpening((value) => value + 1)}
          >
            打开真实报告夹具
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => void window.reportConnectedAction('save')}
          >
            真实保存下一版
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => void window.reportConnectedAction('revoke')}
          >
            撤回库来源读取
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => void window.reportConnectedAction('grant')}
          >
            恢复库来源读取
          </button>
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
            提交旧动作
          </button>
          <output aria-label="原动作结果">{reply}</output>
          <button className="btn" type="button" onClick={() => client.dispose()}>
            释放测试连接
          </button>
        </section>
      </>
    ),
    ...(target ? { resourceTarget: target } : {}),
    renderResource: () => (
      <Report
        client={client}
        configuration={configuration}
        commonKey={key}
        capture={(next) => {
          action.current = next;
          setReply('captured');
        }}
        reply={setReply}
        probe={probe}
      />
    ),
  };
  return <Workbench session={session} />;
}

const root = document.getElementById('fixture');
if (!root) throw new Error('Missing connected fixture root');
const configuration: ConnectedConfiguration = await (
  await fetch('/__report-connected/config')
).json();
const client = createKernelClient(configuration.endpoint);
await client.connect();
client.subscribeChanges((change) => {
  if (changes.length === 24) changes.shift();
  changes.push({
    ...(change.projectId ? { projectId: change.projectId } : {}),
    ...(change.filePaths ? { filePaths: change.filePaths.slice(0, 4) } : {}),
    ...(change.libraryChanged ? { libraryChanged: true } : {}),
  });
});
window.addEventListener('pagehide', () => client.dispose(), { once: true });
createRoot(root).render(<Fixture client={client} configuration={configuration} />);
