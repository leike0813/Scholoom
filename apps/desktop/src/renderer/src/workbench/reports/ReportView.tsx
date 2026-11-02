import type { KernelClient } from '@scholoom/client';
import type { ContextItem, ResourceDescriptor } from '@scholoom/protocol';
import { isErrorInfo } from '@scholoom/protocol/core';
import {
  isReportBridgeMessage,
  type ReportBridgeMessage,
  type ReportSnapshot,
} from '@scholoom/protocol/reports';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useContextContribution } from '../context-contributions';
import { workbenchInstanceId } from '../context-drafts';
import { readDraft, subscribeDraft } from '../drafts';
import { createReportContext } from '../report-context';
import { sameResourceRef } from '../resource-controller';
import { useFileWatch } from '../useFileWatch';
import { createReportClient } from './report-client';
import { restoreReportDraft } from './report-draft-client';
import {
  createReportDrafts,
  type ReportDraftIdentity,
  type ReportDraftRestore,
  reportSavedVersions,
} from './report-drafts';
import { createReportRuntime } from './report-runtime';
import type { ReportUpdateState } from './report-updates';

type State = Extract<ReportBridgeMessage, { type: 'state' | 'restore' }>;
type Active = {
  adapter: ReturnType<typeof createReportClient>;
  runtime?: ReturnType<typeof createReportRuntime> | undefined;
  dirty: boolean;
  snapshot?: ReportSnapshot;
};
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '报告当前不可用，请重新检查。';

function protect(current: Active, facts: { items: readonly ContextItem[]; composer: string }) {
  current.adapter.protect({
    pageDirty: current.dirty,
    composerDraft: !!facts.composer,
    explicitItems: facts.items.some(
      (item) => current.snapshot && sameResourceRef(item.ref, current.snapshot.resource.ref),
    ),
  });
}

/** Product composition of the verified resource, isolated runtime and the existing composer. */
export function ReportView({
  client,
  directory,
  resource,
  enabled,
  composerKey,
  onDirty,
}: {
  client: KernelClient;
  directory: string;
  resource: ResourceDescriptor;
  enabled: boolean;
  composerKey?: string | undefined;
  onDirty?: (() => void) | undefined;
}) {
  const context = useContextContribution();
  const append = context.appendContextItems;
  const container = useRef<HTMLDivElement>(null);
  const active = useRef<Active | undefined>(undefined);
  const guards = useRef({ items: context.items, composer: '' });
  const composer = useSyncExternalStore(
    (listener) => (composerKey ? subscribeDraft(composerKey, listener) : () => {}),
    () => (composerKey ? readDraft(composerKey) : ''),
  );
  guards.current = { items: context.items, composer };
  const dirtyCallback = useRef(onDirty);
  dirtyCallback.current = onDirty;
  const [updates, setUpdates] = useState<ReportUpdateState>();
  const [phase, setPhase] = useState('正在核查报告…');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<ReportDraftRestore>();
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [watchPaths, setWatchPaths] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const ref = resource.ref;
  const identity =
    ref.source === 'project'
      ? {
          configurationId: directory,
          windowId: workbenchInstanceId(),
          ref,
        }
      : undefined;
  const entryKey = JSON.stringify([resource.ref, resource.basis]);
  useEffect(() => {
    if (active.current) protect(active.current, { items: context.items, composer });
  }, [context.items, composer]);
  const watchError = useFileWatch(
    enabled ? client : null,
    ref.source === 'project' ? ref.projectId : '',
    watchPaths.length ? watchPaths : resource.path ? [resource.path] : [],
    () => {},
    () => {
      if (active.current) void active.current.adapter.recheck();
    },
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: the stable entry and receiver incarnation own this lifetime; protection reads current facts separately.
  useEffect(() => {
    const element = container.current;
    setRecovery(undefined);
    if (!enabled || !identity || !element) return;
    const captured = structuredClone(identity);
    const controller = new AbortController();
    let adapter: ReturnType<typeof createReportClient> | undefined;
    let unobserve: (() => void) | undefined;
    let runtime: ReturnType<typeof createReportRuntime> | undefined;
    let contribution: ReturnType<typeof createReportContext> | undefined;
    let current: Active | undefined;
    let lastBasis = '';
    let restore: State | undefined;
    let pendingState: State | undefined;
    let currentBrowse: State['browse'] | undefined;
    let store: ReturnType<typeof createReportDrafts> | undefined;
    let frameGeneration = 0;
    const valid = () => !controller.signal.aborted;
    let copyIdentity: ReportDraftIdentity | undefined;
    let recoveryRevision = 0;
    let copyRunning = false;
    let copyQueued = false;
    const refreshCopy = () => {
      if (!valid() || !copyIdentity) return;
      setRecovery(undefined);
      recoveryRevision++;
      copyQueued = true;
      if (copyRunning) return;
      copyRunning = true;
      void (async () => {
        try {
          while (valid() && copyQueued && copyIdentity) {
            copyQueued = false;
            const revision = recoveryRevision;
            try {
              const result = await restoreReportDraft({
                client,
                identity: copyIdentity,
                signal: controller.signal,
              });
              if (valid() && revision === recoveryRevision) setRecovery(result.restored);
            } catch (reason) {
              if (valid() && revision === recoveryRevision) setError(errorMessage(reason));
            }
          }
        } finally {
          copyRunning = false;
        }
      })();
    };
    // An unavailable original has no current snapshot from which to infer its old source scope.
    const uncopyChanges = client.subscribeChanges((change) => {
      if (
        change.libraryChanged ||
        change.resync ||
        change.filePaths ||
        (change.projectId && !change.sessionId)
      ) {
        recoveryRevision++;
        setRecovery(undefined);
        refreshCopy();
      }
    });
    const uncopyConnection = client.subscribe(() => {
      recoveryRevision++;
      setRecovery(undefined);
      if (client.getSnapshot().phase === 'connected') refreshCopy();
    });
    const save = () => {
      const message = pendingState;
      pendingState = undefined;
      if (!message || !store) return;
      const result = store.save(message);
      if (!valid()) return;
      if (result.status !== 'stored') setError('报告草稿未能保存，请保留当前页面并复制所需内容。');
      else {
        setVersions(reportSavedVersions(captured));
        if (!result.localStorageWritten) setError('报告草稿仅在当前窗口保留，请及时复制所需内容。');
      }
    };
    const stopPage = () => {
      save();
      contribution?.dispose();
      contribution = undefined;
      runtime?.close();
      runtime = undefined;
      if (current) current.runtime = undefined;
      lastBasis = '';
      currentBrowse = undefined;
    };
    const draw = (state: ReportUpdateState) => {
      if (!valid() || !current) return;
      setUpdates(state);
      if (state.candidateError) setError(state.candidateError.message);
      if (!state.canDisplay || !state.current) {
        setRecovery(undefined);
        refreshCopy();
        stopPage();
        if (state.error) setError(state.error.message);
        return;
      }
      if (lastBasis === state.current.resource.basis) return;
      const previousBrowse = lastBasis && !current.dirty ? currentBrowse : undefined;
      stopPage();
      const snapshot = state.current;
      const owner = current;
      setWatchPaths(snapshot.resource.path ? [snapshot.resource.path] : []);
      lastBasis = snapshot.resource.basis;
      current.snapshot = snapshot;
      const binding = {
        version: 1,
        viewId: crypto.randomUUID(),
        generation: ++frameGeneration,
        basis: snapshot.resource.basis,
      } as const;
      store = createReportDrafts({ ...captured, basis: binding.basis });
      if (!restore || restore.basis !== binding.basis) {
        const saved = store.restore({
          identity: { ...captured, basis: binding.basis },
          status: 'available',
        });
        if (saved.status === 'restorable')
          restore = { ...binding, type: 'restore', ...saved.state };
        else if (previousBrowse !== undefined)
          restore = {
            ...binding,
            type: 'restore',
            browse: previousBrowse,
            draft: {},
            dirty: false,
          };
      }
      currentBrowse = restore?.basis === binding.basis ? restore.browse : undefined;
      current.dirty = restore?.basis === snapshot.resource.basis && restore.dirty;
      contribution = createReportContext({ snapshot, ...binding, appendContextItems: append });
      const ownContribution = contribution;
      const ownStore = store;
      const initialState =
        restore?.basis === binding.basis
          ? { browse: restore.browse, draft: restore.draft, dirty: restore.dirty }
          : undefined;
      restore = undefined;
      let pageReady = false;
      setPhase('正在打开交互报告…');
      setError(state.candidateError?.message ?? '');
      runtime = createReportRuntime({
        client,
        directory,
        snapshot,
        binding,
        initialState,
        container: element,
        message: (message) => {
          if (
            !valid() ||
            !runtime ||
            lastBasis !== binding.basis ||
            !isReportBridgeMessage(message)
          )
            return;
          if (message.type === 'ready') {
            pageReady = true;
            setPhase('报告已就绪');
          } else if (message.type === 'state') {
            if (initialState && !pageReady) return;
            if (store !== ownStore) return;
            currentBrowse = message.browse;
            pendingState = message;
            queueMicrotask(save);
            owner.dirty = message.dirty;
            if (message.dirty) dirtyCallback.current?.();
            protect(owner, guards.current);
          } else if (message.type === 'select') {
            const reply = ownContribution.receive(message);
            if (reply.type === 'error') setError(reply.error.message);
            void runtime.send(reply).catch((error) => {
              if (valid()) setError(errorMessage(error));
            });
          }
        },
        failed: (reason) => {
          if (!valid() || lastBasis !== binding.basis) return;
          const detail = {
            code:
              reason && typeof reason === 'object' && 'code' in reason
                ? reason.code
                : 'unavailable',
            message: errorMessage(reason),
          };
          if (
            isErrorInfo(detail) &&
            ['permissionDenied', 'instanceMismatch', 'notFound'].includes(detail.code)
          )
            owner.adapter.invalidate(detail);
          setError(detail.message);
          setPhase('报告交互已暂停');
        },
      });
      current.runtime = runtime;
      protect(current, guards.current);
      void runtime
        .start()
        .then((opened) => {
          if (valid() && lastBasis === binding.basis)
            setWatchPaths(opened.files.map((file) => file.path));
        })
        .catch((reason) => {
          if (valid() && lastBasis === binding.basis) setError(errorMessage(reason));
        });
    };
    setError('');
    setRecovery(undefined);
    setUpdates(undefined);
    setPhase('正在核查报告…');
    void (async () => {
      const saved = reportSavedVersions(captured);
      if (!valid()) return;
      setVersions(saved);
      const basis = selectedVersion || saved.at(-1) || resource.basis;
      const identity: ReportDraftIdentity = { ...captured, basis };
      const revision = recoveryRevision;
      const recovered = await restoreReportDraft({ client, identity, signal: controller.signal });
      if (!valid()) return;
      const initial =
        recovered.version.state === 'available' ? recovered.version.snapshot : undefined;
      if (recovered.restored.status === 'restorable' && recovered.version.state === 'available') {
        restore = {
          version: 1,
          viewId: '-',
          generation: 0,
          basis,
          type: 'restore',
          ...recovered.restored.state,
        };
      } else if (recovered.restored.status !== 'missing') {
        if (recovered.restored.status === 'copyOnly') {
          copyIdentity = identity;
          if (revision === recoveryRevision) setRecovery(recovered.restored);
          else refreshCopy();
          setError('原报告材料已不可得，原草稿可复制。');
        } else setRecovery(recovered.restored);
      }
      adapter = createReportClient({
        client,
        dataDirectory: directory,
        entry: initial?.resource ?? resource,
        ...(initial ? { initialSnapshot: initial } : {}),
        protection: {
          pageDirty: !!restore?.dirty,
          composerDraft: !!guards.current.composer,
          explicitItems: guards.current.items.some((item) =>
            sameResourceRef(item.ref, resource.ref),
          ),
        },
      });
      current = { adapter, dirty: !!restore?.dirty, ...(initial ? { snapshot: initial } : {}) };
      active.current = current;
      const observed = adapter;
      unobserve = observed.subscribe(() => draw(observed.read()));
      draw(adapter.read());
    })().catch((reason) => {
      if (valid()) {
        setError(errorMessage(reason));
        setPhase('报告不可用');
      }
    });
    return () => {
      controller.abort();
      setRecovery(undefined);
      uncopyChanges();
      uncopyConnection();
      stopPage();
      unobserve?.();
      adapter?.dispose();
      if (active.current === current) active.current = undefined;
    };
  }, [client, directory, entryKey, enabled, append, composerKey, attempt, selectedVersion]);
  return (
    <section className="render-pane" aria-label={`交互报告 ${resource.name}`}>
      <div className="file-toolbar">
        <span role="status">{enabled ? phase : '需连接内核。'}</span>
        <button
          type="button"
          className="btn"
          disabled={!enabled}
          onClick={() => setAttempt((value) => value + 1)}
        >
          重新检查
        </button>
        {versions.length ? (
          <label>
            保存的报告版本{' '}
            <select
              value={selectedVersion}
              onChange={(event) => setSelectedVersion(event.target.value)}
            >
              <option value="">最近保留的版本</option>
              <option value={resource.basis}>当前保存的版本</option>
              {versions.map((basis, index) => (
                <option key={basis} value={basis}>
                  版本 {index + 1}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {updates?.pending &&
      (updates.pending.resource.basis !== updates.current?.resource.basis ||
        !updates.canDisplay) ? (
        <p role="status">
          报告版本已就绪，当前草稿已保留。{' '}
          <button
            type="button"
            className="btn"
            disabled={!updates.canReplace}
            onClick={() => active.current?.adapter.viewPending()}
          >
            查看新版
          </button>
        </p>
      ) : null}
      {error || watchError ? <p role="alert">{error || watchError}</p> : null}
      {enabled && recovery?.status === 'copyOnly' ? (
        <label>
          原报告草稿{' '}
          <textarea
            readOnly
            value={
              typeof recovery.draft === 'string'
                ? recovery.draft
                : JSON.stringify(recovery.draft, null, 2)
            }
          />
        </label>
      ) : null}
      <div className="render-pane" ref={container} />
    </section>
  );
}
