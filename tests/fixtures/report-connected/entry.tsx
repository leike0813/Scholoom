import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { restoreReportDraft } from '../../../apps/desktop/src/renderer/src/workbench/reports/report-draft-client';
import {
  createReportDrafts,
  type ReportDraftIdentity,
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
import type { ConnectedConfiguration, ConnectedObservation, ExactObservation } from './types.js';
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
let pageSave: ConnectedObservation['pageSave'] = null;
const empty: ReportDraftState = { browse: {}, draft: '', dirty: false };
const string = (value: unknown) => (typeof value === 'string' ? value : '');

function PageState({
  snapshot,
  configuration,
  capture,
  reply,
  disposeRef,
  restored,
  onRestore,
}: {
  snapshot: ReportSnapshot;
  configuration: ConnectedConfiguration;
  capture(action: Action): void;
  reply(result: string): void;
  disposeRef: { current: (() => void) | null };
  restored?: ReportDraftState | null;
  onRestore?(message: ReportBridgeMessage): void;
}) {
  const contribution = useContextContribution();
  const basis = snapshot.resource.basis;
  const [envelope] = useState(() => ({
    version: 1 as const,
    viewId: `connected-view-${crypto.randomUUID()}`,
    generation: ++generation,
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
    const candidate =
      restored === undefined
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
    const initial = restored ?? (candidate?.status === 'restorable' ? candidate.state : undefined);
    if (initial) {
      const restore = { ...envelope, type: 'restore', ...initial };
      if (isReportBridgeMessage(restore)) {
        setApplied(initial);
        onRestore?.(restore);
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
  const save = (next: ReportDraftState) => {
    const receipt = store.save({ ...envelope, type: 'state', ...next });
    if (receipt.status === 'stored') {
      pageSave = { key: store.key, localStorageWritten: receipt.localStorageWritten };
      setApplied(next);
    }
  };
  return (
    <section className="lifecycle-pane" aria-label="真实连接报告页面">
      <h2>{snapshot.resource.name}</h2>
      <p>{snapshot.manifest.objects[0]?.semantics}</p>
      <label>
        报告浏览筛选
        <input
          aria-label="报告浏览筛选"
          value={string((applied.browse as { filter?: unknown })?.filter)}
          onChange={(event) =>
            save({ ...applied, browse: { filter: event.target.value }, dirty: true })
          }
        />
      </label>
      <label>
        报告页面草稿
        <textarea
          aria-label="报告页面草稿"
          value={string(applied.draft)}
          onChange={(event) => {
            save({ ...applied, draft: event.target.value, dirty: true });
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

function ExactReport({
  client,
  configuration,
  identity,
  capture,
  reply,
  probe,
}: {
  client: Client;
  configuration: ConnectedConfiguration;
  identity: ReportDraftIdentity;
  capture(action: Action): void;
  reply(result: string): void;
  probe: { current: (() => ExactObservation) | null };
}) {
  const [result, setResult] = useState<ExactObservation['result']>(null);
  const [error, setError] = useState<string | null>(null);
  const envelope = useRef<ReportBridgeMessage | null>(null);
  const disposePage = useRef<(() => void) | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    subscriptions += 2;
    let active = true;
    const invalidate = () => {
      controller.abort();
      if (active) {
        setResult(null);
        envelope.current = null;
        setError('unverified');
      }
    };
    const unchange = client.subscribeChanges((change) => {
      if (
        change.libraryChanged ||
        change.filePaths ||
        (change.projectId === configuration.projectId && change.resync && !change.sessionsChanged)
      )
        invalidate();
    });
    const unconnect = client.subscribe(() => {
      if (client.getSnapshot().phase !== 'connected') invalidate();
    });
    void restoreReportDraft({ client, identity, signal: controller.signal })
      .then((value) => {
        if (!active || controller.signal.aborted || workbenchInstanceId() !== identity.windowId)
          return;
        setResult(value);
      })
      .catch((reason) => {
        if (!active) return;
        setResult(null);
        envelope.current = null;
        setError(
          reason && typeof reason === 'object' && 'code' in reason
            ? String(reason.code)
            : reason instanceof Error
              ? reason.name
              : 'unexpected',
        );
      })
      .finally(() => {
        settled++;
        record('exactRestoreSettled', identity.basis);
      });
    return () => {
      active = false;
      controller.abort();
      unchange();
      unconnect();
      subscriptions -= 2;
      disposePage.current?.();
      probe.current = null;
      record('exactViewDisposed', identity.basis);
    };
  }, [client, identity, configuration]);
  probe.current = () => ({ result, error, envelope: envelope.current });
  return (
    <section className="lifecycle-pane" aria-label="准确原版恢复">
      <output aria-label="准确原版状态">{error ?? result?.restored.status ?? 'loading'}</output>
      {result?.version.state === 'available' ? (
        <PageState
          snapshot={result.version.snapshot}
          configuration={configuration}
          capture={capture}
          reply={reply}
          disposeRef={disposePage}
          restored={result.restored.status === 'restorable' ? result.restored.state : null}
          onRestore={(message) => {
            envelope.current = message;
          }}
        />
      ) : null}
      {result?.restored.status === 'copyOnly' ? (
        <label>
          仅复制原草稿
          <textarea aria-label="仅复制原草稿" readOnly value={string(result.restored.draft)} />
        </label>
      ) : null}
      {error ? <p>原版核查未成功，缓存不展示。</p> : null}
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
  const [control, setControl] = useState('none');
  const act = async (action: string) => {
    setControl('working');
    try {
      await window.reportConnectedAction(action);
      setControl(action);
    } catch (error) {
      setControl(
        error && typeof error === 'object' && 'code' in error ? String(error.code) : 'failed',
      );
    }
  };
  const [exactIdentity, setExactIdentity] = useState<ReportDraftIdentity | null>(null);
  const exactProbe = useRef<(() => ExactObservation) | null>(null);
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
      exact: exactProbe.current?.() ?? null,
      pageSave,
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
            onClick={() => {
              setExactIdentity(null);
              setOpening((value) => value + 1);
            }}
          >
            打开真实报告夹具
          </button>
          {['R1', '未知basis', '当前版'].map((version) => (
            <button
              className="btn"
              type="button"
              disabled={!selected}
              key={version}
              onClick={() => {
                const entry =
                  version === '当前版'
                    ? probe.current?.().metadata.current?.resource
                    : configuration.entry;
                if (entry?.ref.source !== 'project') return;
                setExactIdentity({
                  configurationId: configuration.endpoint.dataDirectory,
                  windowId: workbenchInstanceId(),
                  ref: structuredClone(entry.ref),
                  basis: version === '未知basis' ? 'independent-unknown-basis' : entry.basis,
                });
                setOpening((value) => value + 1);
              }}
            >
              精确重开{version}
            </button>
          ))}
          <button className="btn" type="button" onClick={() => void act('publish-without-source')}>
            发布无来源R2
          </button>
          <button className="btn" type="button" onClick={() => void act('advance-dependency')}>
            推进原依赖内容
          </button>
          <output aria-label="实际控制回执">{control}</output>
          <button
            className="btn"
            type="button"
            onClick={() => void window.reportConnectedAction('save')}
          >
            真实保存下一版
          </button>
          <button className="btn" type="button" onClick={() => void act('revoke')}>
            撤回库来源读取
          </button>
          <button className="btn" type="button" onClick={() => void act('grant')}>
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
    renderResource: () =>
      exactIdentity ? (
        <ExactReport
          key={opening}
          client={client}
          configuration={configuration}
          identity={exactIdentity}
          capture={(next) => {
            action.current = next;
            setReply('captured');
          }}
          reply={setReply}
          probe={exactProbe}
        />
      ) : (
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
