import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/react';
import type { KernelClient } from '@scholoom/client';
import type {
  BusinessInputs,
  BusinessOutputs,
  BusinessParams,
  CallArguments,
  Effort,
  LibraryAttachment,
  Message,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import { validateBusiness } from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentReader } from './DocumentReader';
import { draftKey, readDraft, writeDraft } from './drafts';
import { fileDocument } from './file-document';
import { FileExplorer } from './file-explorer/Explorer';
import { LibraryTab } from './library/LibraryTab';
import { PdfReader } from './PdfReader';
import { ProjectOnboardingDialog } from './ProjectOnboarding';
import { ProjectTrustDialog } from './ProjectTrustDialog';
import { FileEditor, ProjectControls } from './project-ui';
import { toThreadMessage } from './projection';
import { readerKindForName } from './reader-material';
import { SessionList } from './SessionList';
import { SessionSearchDialog } from './SessionSearch';
import type { FileTarget, KernelPhase, WorkbenchSession } from './session';

export function useBusinessSession(
  client: KernelClient | null,
  phase: KernelPhase,
): Partial<WorkbenchSession> {
  const [received, setReceived] = useState<{
    selection: { projectId: string; sessionId: string };
    value: WorkbenchSnapshot;
  }>();
  const [selection, setSelection] = useState({ projectId: 'application', sessionId: '' });
  const snapshot = received?.selection === selection ? received.value : undefined;
  const [error, setError] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialFileIds, setMaterialFileIds] = useState<Record<string, string>>({});
  const [file, setFile] = useState<FileTarget>();
  const [readerTarget, setReaderTarget] = useState<LibraryAttachment>();
  const [earlier, setEarlier] = useState<Message[]>([]);
  const [earlierComplete, setEarlierComplete] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dismissedTrust, setDismissedTrust] = useState('');
  const [requestedTrust, setRequestedTrust] = useState('');
  const [sessionSearchOpen, setSessionSearchOpen] = useState(false);
  const [projectOnboardingOpen, setProjectOnboardingOpen] = useState(false);
  const [recovered, setRecovered] = useState<BusinessParams<'session.send'>>();
  const [restoreError, setRestoreError] = useState('');
  const [configureError, setConfigureError] = useState('');
  const pendingConfigure = useRef<(() => Promise<void>) | undefined>(undefined);
  /** 不支持推理强度的模型只保存模型覆盖，effort 偏好本机保留，切回支持的模型时恢复。 */
  const retainedEffort = useRef<Record<string, Effort>>({});
  const directoryRef = useRef('');
  const currentDirectory = client?.getSnapshot().status?.dataDirectory;
  if (currentDirectory) directoryRef.current = currentDirectory;
  const directory = directoryRef.current;
  const selectedRef = useRef(selection);
  selectedRef.current = selection;
  const lifecycle = useRef(0);
  const knownProjects = useRef<WorkbenchSnapshot['projects']>([]);
  if (received) knownProjects.current = received.value.projects;
  const navigationKey = JSON.stringify(
    knownProjects.current.filter((item) => item.recent !== false).map((item) => item.id),
  );

  const refresh = useCallback(async () => {
    if (!client || phase !== 'connected') return;
    const selected = selectedRef.current;
    let result: WorkbenchSnapshot;
    try {
      result = await client.call('workbench.watch', {
        projectId: selected.projectId,
        includeSessions: false,
        navigationProjectIds: [
          ...new Set([selected.projectId, ...(JSON.parse(navigationKey) as string[])]),
        ].slice(0, 101),
        ...(selected.sessionId ? { sessionId: selected.sessionId } : {}),
      });
    } catch (reason) {
      if (selected !== selectedRef.current) return;
      if (reason instanceof Error && 'code' in reason && reason.code === 'notFound') {
        const projectId = selected.sessionId ? selected.projectId : 'application';
        writeDraft(draftKey(directoryRef.current, 'project'), projectId);
        writeDraft(draftKey(directoryRef.current, projectId, 'session'), '');
        setSelection({ projectId, sessionId: '' });
        return;
      }
      throw reason;
    }
    if (selected !== selectedRef.current) return;
    setReceived({ selection: selected, value: result });
  }, [client, phase, navigationKey]);

  useEffect(() => {
    if (!client || phase !== 'connected') return;
    const generation = ++lifecycle.current;
    const projectId = readDraft(draftKey(directory, 'project')) || 'application';
    const sessionId = readDraft(draftKey(directory, projectId, 'session'));
    setSelection((current) =>
      current.projectId === projectId && current.sessionId === sessionId
        ? current
        : { projectId, sessionId },
    );
    setConfigured(true);
    return () => {
      if (lifecycle.current === generation) lifecycle.current++;
    };
  }, [client, phase, directory]);

  useEffect(() => {
    if (!client || phase !== 'connected' || !configured || selection !== selectedRef.current)
      return;
    let active = true;
    let running = false;
    let again = false;
    const update = async () => {
      if (!active) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        await refresh();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : '刷新失败，请重试。');
      } finally {
        running = false;
        if (again) {
          again = false;
          void update();
        }
      }
    };
    void update();
    const unsubscribe = client.subscribeChanges((change) => {
      if (change.filePaths) return;
      if (change.sessionProjectIds && !change.projectId && !change.libraryChanged) return;
      void update();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, phase, configured, refresh, selection]);

  useEffect(() => {
    setEarlier([]);
    setEarlierComplete(false);
    setRestoreError('');
    setConfigureError('');
    pendingConfigure.current = undefined;
    const key = draftKey(directory, selection.projectId, selection.sessionId, 'materials');
    try {
      setMaterials(JSON.parse(readDraft(key) || '[]'));
    } catch {
      setMaterials([]);
    }
    try {
      setMaterialFileIds(
        JSON.parse(
          readDraft(
            draftKey(directory, selection.projectId, selection.sessionId, 'material-file-ids'),
          ) || '{}',
        ),
      );
    } catch {
      setMaterialFileIds({});
    }
    try {
      const pending: unknown = JSON.parse(
        readDraft(draftKey(directory, selection.projectId, selection.sessionId, 'pending')),
      );
      setRecovered(
        validateBusiness('session.send', 'params', pending)
          ? (pending as BusinessParams<'session.send'>)
          : undefined,
      );
    } catch {
      setRecovered(undefined);
    }
  }, [directory, selection]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 文件修订变化时重新解析已附加引用。
  useEffect(() => {
    if (!client || phase !== 'connected' || !materials.length) return;
    let active = true;
    const selected = selection;
    void Promise.all(
      materials.map(async (path) => {
        const id = materialFileIds[path];
        if (id)
          return (
            await client.call('files.resolve', { projectId: selected.projectId, fileIds: [id] })
          )[0];
        const entry = await client.call('files.read', { projectId: selected.projectId, path });
        return entry.fileId ? { fileId: entry.fileId, path, state: 'present' } : undefined;
      }),
    )
      .then((locations) => {
        if (!active || selectedRef.current !== selected) return;
        const present = locations.flatMap((item) => (item?.state === 'present' ? [item] : []));
        const paths = present.map((item) => item.path);
        const ids = Object.fromEntries(present.map((item) => [item.path, item.fileId]));
        if (JSON.stringify(paths) !== JSON.stringify(materials)) {
          setMaterials(paths);
          writeDraft(
            draftKey(directory, selected.projectId, selected.sessionId, 'materials'),
            JSON.stringify(paths),
          );
        }
        if (JSON.stringify(ids) !== JSON.stringify(materialFileIds)) {
          setMaterialFileIds(ids);
          writeDraft(
            draftKey(directory, selected.projectId, selected.sessionId, 'material-file-ids'),
            JSON.stringify(ids),
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [client, phase, selection, directory, snapshot?.fileRevision, materialFileIds, materials]);

  useEffect(() => {
    if (recovered && snapshot?.messages.some((message) => message.id === recovered.instructionId)) {
      const key = draftKey(directory, recovered.projectId, recovered.sessionId, 'pending');
      try {
        if (JSON.parse(readDraft(key)).instructionId === recovered.instructionId)
          writeDraft(key, '');
      } catch {}
      setRecovered(undefined);
    }
  }, [directory, recovered, snapshot]);

  const call = useCallback(
    async <A extends CallArguments<BusinessInputs>>(...args: A): Promise<BusinessOutputs[A[0]]> => {
      if (!client || phase !== 'connected') throw new Error('内核未连接。');
      try {
        setError('');
        const result = await client.call<A>(...args);
        await refresh();
        return result;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '操作失败，请核对当前状态。');
        throw reason;
      }
    },
    [client, phase, refresh],
  );

  const select = (projectId: string, sessionId = '') => {
    writeDraft(draftKey(directory, 'project'), projectId);
    writeDraft(draftKey(directory, projectId, 'session'), sessionId);
    const next = { projectId, sessionId };
    selectedRef.current = next;
    setEarlier([]);
    setEarlierComplete(false);
    setRecovered(undefined);
    setFile(undefined);
    setSelection(next);
  };
  const safe = (action: () => Promise<unknown>) => {
    void action().catch(() => {});
  };
  const openSessionSearch = useCallback(() => setSessionSearchOpen(true), []);
  const closeSessionSearch = useCallback(() => setSessionSearchOpen(false), []);
  const openProjectOnboarding = useCallback(() => setProjectOnboardingOpen(true), []);
  const closeProjectOnboarding = useCallback(() => setProjectOnboardingOpen(false), []);
  const project = snapshot?.projects.find((item) => item.id === selection.projectId);
  const session = snapshot?.session;
  const running = snapshot?.run && ['running', 'queued', 'cancelling'].includes(snapshot.run.state);
  const provider = snapshot?.provider;
  const modelOverride = session?.modelConfig;
  const effectiveModel = modelOverride?.model ?? provider?.model;
  const modelOption = provider?.models.find((item) => item.id === effectiveModel);
  const configureDisabled = phase !== 'connected' || !session || !!session.archived;
  /** 会话级执行配置覆盖；失败保留快照中的当前值，在 composer 上下文内提示可重试。 */
  const configureModel = (modelConfig: BusinessParams<'session.configure'>['modelConfig']) => {
    if (!client || phase !== 'connected' || !session) return;
    const attempt = async () => {
      try {
        await client.call('session.configure', {
          projectId: selection.projectId,
          sessionId: session.id,
          modelConfig,
        });
        setConfigureError('');
        pendingConfigure.current = undefined;
      } catch (reason) {
        setConfigureError(reason instanceof Error ? reason.message : '执行配置保存失败。');
        pendingConfigure.current = attempt;
      }
    };
    void attempt();
  };
  const effortKey = `${selection.projectId}:${session?.id ?? ''}`;
  const changeModel = (model: string | null) => {
    const next = { ...(session?.modelConfig ?? {}) };
    if (model === null) delete next.model;
    else next.model = model;
    const target = model ?? provider?.model;
    const supports = provider?.models.find((item) => item.id === target)?.supportsEffort ?? true;
    if (supports) {
      if (!next.effort && retainedEffort.current[effortKey])
        next.effort = retainedEffort.current[effortKey];
    } else if (next.effort) {
      retainedEffort.current[effortKey] = next.effort;
      delete next.effort;
    }
    configureModel(next.model || next.effort ? next : null);
  };
  const changeEffort = (effort: Effort | null) => {
    const next = { ...(session?.modelConfig ?? {}) };
    if (effort === null) {
      delete next.effort;
      delete retainedEffort.current[effortKey];
    } else {
      next.effort = effort;
      retainedEffort.current[effortKey] = effort;
    }
    configureModel(next.model || next.effort ? next : null);
  };
  const messages = [...earlier, ...(snapshot?.messages ?? [])]
    .filter((message, i, all) => all.findIndex((other) => other.id === message.id) === i)
    .map(toThreadMessage);
  const adapter: ExternalStoreAdapter<ThreadMessageLike> = {
    messages,
    convertMessage: (message) => message,
    isRunning: !!running,
    isDisabled: creating || !!session?.archived,
    isSendDisabled:
      phase !== 'connected' ||
      !snapshot?.provider.configured ||
      !session ||
      project?.trust !== 'trusted' ||
      (recovered?.projectId === selection.projectId && recovered.sessionId === selection.sessionId),
    onNew: async (message) => {
      const rawText = message.content
        .filter((part) => part.type === 'text')
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('\n');
      const text = rawText.trim();
      if (!text || !session) return;
      const pendingKey = draftKey(directory, selection.projectId, session.id, 'pending');
      let instructionId = crypto.randomUUID();
      try {
        const previous = JSON.parse(readDraft(pendingKey));
        if (
          typeof previous?.instructionId === 'string' &&
          previous.text === text &&
          JSON.stringify(previous.materials) === JSON.stringify(materials)
        )
          instructionId = previous.instructionId;
      } catch {
        /* First send in this conversation. */
      }
      const input = {
        projectId: selection.projectId,
        sessionId: session.id,
        instructionId,
        text,
        materials,
        ...(materials.length && materials.every((path) => !!materialFileIds[path])
          ? {
              materialFileIds: materials.flatMap((path) =>
                materialFileIds[path] ? [materialFileIds[path]] : [],
              ),
            }
          : {}),
      };
      const serialized = JSON.stringify(input);
      if (validateBusiness('session.send', 'params', input)) {
        writeDraft(pendingKey, serialized);
        setRecovered(input);
      }
      try {
        await call('session.send', input);
        if (readDraft(pendingKey) === serialized) writeDraft(pendingKey, '');
        setRecovered((current) => (current?.instructionId === instructionId ? undefined : current));
      } catch (reason) {
        const key = draftKey(directory, selection.projectId, session.id);
        writeDraft(key, [readDraft(key), rawText].filter(Boolean).join('\n'));
        throw reason;
      }
    },
    onCancel: async () => {
      if (session)
        await call('session.cancel', { projectId: selection.projectId, sessionId: session.id });
    },
  };
  const createSession = (projectId = selectedRef.current.projectId) => {
    if (creating) return;
    setCreating(true);
    const selected = selectedRef.current;
    safe(async () => {
      try {
        const result = await call('session.create', { projectId });
        if (selected === selectedRef.current) {
          select(projectId, result.id);
        }
      } finally {
        setCreating(false);
      }
    });
  };
  return {
    projectId: selection.projectId,
    ...(session ? { activeSessionTitle: session.title } : {}),
    ...(client
      ? {
          sessionNavigation: (
            <SessionList
              key={directory}
              client={client}
              projects={knownProjects.current}
              projectId={selection.projectId}
              activeSessionId={selection.sessionId}
              enabled={phase === 'connected' && configured}
              select={select}
              createSession={creating ? undefined : createSession}
              storageKey={directory}
              selectProject={(id) => select(id, readDraft(draftKey(directory, id, 'session')))}
              forgetProject={(removedId, nextId) => {
                writeDraft(draftKey(directory, removedId, 'session'), '');
                if (selectedRef.current.projectId === removedId) select(nextId, '');
              }}
              onChanged={refresh}
            />
          ),
          openSessionSearch,
          ...(sessionSearchOpen
            ? {
                sessionSearchDialog: (
                  <SessionSearchDialog
                    client={client}
                    enabled={phase === 'connected' && configured}
                    onClose={closeSessionSearch}
                    onSelect={select}
                  />
                ),
              }
            : {}),
          openProjectOnboarding,
          ...(project &&
          project.id !== 'application' &&
          !projectOnboardingOpen &&
          ((project.trust === 'pending' && dismissedTrust !== `${directory}:${project.id}`) ||
            requestedTrust === project.id)
            ? {
                projectTrustDialog: (
                  <ProjectTrustDialog
                    key={project.id}
                    path={project.path}
                    enabled={phase === 'connected'}
                    onChoose={async (trust) => {
                      await call('project.grant', {
                        projectId: project.id,
                        trust,
                        autoBackup: project.autoBackup,
                      });
                      setRequestedTrust('');
                    }}
                    onClose={() => {
                      setDismissedTrust(`${directory}:${project.id}`);
                      setRequestedTrust('');
                    }}
                  />
                ),
              }
            : {}),
          ...(projectOnboardingOpen
            ? {
                projectOnboardingDialog: (
                  <ProjectOnboardingDialog
                    client={client}
                    enabled={phase === 'connected' && configured}
                    onClose={closeProjectOnboarding}
                    openProject={(opened) => select(opened.id, '')}
                  />
                ),
              }
            : {}),
          resolveFiles: (fileIds) =>
            client.call('files.resolve', { projectId: selection.projectId, fileIds }),
        }
      : {}),
    openMessageFile: async (path, fileId) => {
      if (!client || phase !== 'connected') throw new Error('内核未连接。');
      const selected = selectedRef.current;
      let target = { projectId: selected.projectId, path, ...(fileId ? { fileId } : {}) };
      if (fileId) {
        const location = (
          await client.call('files.resolve', { projectId: selected.projectId, fileIds: [fileId] })
        )[0];
        if (location?.state !== 'present') throw new Error('材料已回收或缺失，请先核查当前位置。');
        target = { ...target, path: location.path };
      }
      if (selected === selectedRef.current) setFile(target);
    },
    fileRevision: snapshot?.fileRevision ?? 0,
    adapter,
    executionContext: {
      project: project?.name ?? '正在读取项目',
      model: effectiveModel ?? '模型未就绪',
      permissions: creating
        ? '正在创建会话'
        : phase !== 'connected'
          ? '内核未连接'
          : !project
            ? '正在核对权限'
            : `${project.id === 'application' ? '普通会话' : project.trust === 'trusted' ? '已信任项目' : project.trust === 'pending' ? '项目信任待确认' : '受限项目'}${provider?.configured ? '' : ' · 凭据未配置'}`,
      effort: modelOverride?.effort ?? retainedEffort.current[effortKey] ?? provider?.defaultEffort,
      supportsEffort: modelOption?.supportsEffort ?? true,
      defaultModel: provider?.model,
      defaultEffort: provider?.defaultEffort,
      modelOverridden: !!modelOverride?.model,
      effortOverridden: !!modelOverride?.effort || !!retainedEffort.current[effortKey],
      modelOptions: provider?.models,
      effortOptions: provider?.efforts,
      configureDisabled,
      ...(configureError ? { configureError } : {}),
      retryConfigure: () => void pendingConfigure.current?.(),
      onModelChange: changeModel,
      onEffortChange: changeEffort,
    },
    draftKey: draftKey(directory, selection.projectId, selection.sessionId || 'unsent'),
    ...(file ? { fileTarget: file } : {}),
    isFileDirty: (target) => {
      const document = fileDocument(
        draftKey(directory, target.projectId, target.fileId ?? target.path, 'file'),
        draftKey(directory, target.projectId, target.path, 'file'),
      );
      const value = document.get();
      return (
        !!value.conversionOwner ||
        document.hasDraft() ||
        (value.loaded && value.content !== value.source?.content)
      );
    },
    flushFile: async (target) =>
      fileDocument(
        draftKey(directory, target.projectId, target.fileId ?? target.path, 'file'),
        draftKey(directory, target.projectId, target.path, 'file'),
      ).flush(),
    renderFile: (target, mode, onDirty, viewId) =>
      client ? (
        <FileEditor
          key={`${target.projectId}:${target.fileId ?? target.path}`}
          client={client}
          directory={directory}
          target={target}
          editorViewId={viewId}
          mode={mode ?? 'source'}
          onDirty={onDirty}
          revision={snapshot?.fileRevision ?? 0}
          onOpenFile={setFile}
          onChanged={(stored) => {
            if (!target.fileId && selectedRef.current.projectId === target.projectId)
              setFile(stored);
            void refresh();
          }}
        />
      ) : null,
    library: client ? (
      <LibraryTab
        client={client}
        enabled={phase === 'connected'}
        onOpenReader={(material) => setReaderTarget({ ...material })}
      />
    ) : undefined,
    readerTarget,
    renderReader: (material) => {
      if (!client) return null;
      const kind = readerKindForName(material.name);
      const key = `${material.id}:${material.materialVersionId}`;
      return kind === 'pdf' ? (
        <PdfReader key={key} client={client} material={material} enabled={phase === 'connected'} />
      ) : kind ? (
        <DocumentReader
          key={key}
          client={client}
          material={material}
          enabled={phase === 'connected'}
        />
      ) : null;
    },
    controls: (
      <ProjectControls
        snapshot={snapshot}
        selectedProject={selection.projectId}
        call={call}
        onOpen={(value) => select(value.id)}
        enabled={phase === 'connected' && !!snapshot}
      />
    ),
    notices: (
      <>
        {project && project.id !== 'application' && project.trust !== 'trusted' ? (
          <div className="execution-status" role="status">
            受限项目可人工浏览和编辑，信任后可使用 Agent。
            <button
              type="button"
              disabled={phase !== 'connected'}
              onClick={() => setRequestedTrust(project.id)}
            >
              信任项目…
            </button>
          </div>
        ) : null}
        {session?.archived ? (
          <div className="execution-status" role="status">
            会话已归档，历史和草稿保留。
            <button
              type="button"
              disabled={phase !== 'connected'}
              onClick={() => {
                if (!client || phase !== 'connected') return;
                setRestoreError('');
                void (async () => {
                  try {
                    await client.call('session.archive', {
                      projectId: selection.projectId,
                      sessionId: session.id,
                      archived: false,
                    });
                    await refresh();
                  } catch (reason) {
                    setRestoreError(
                      reason instanceof Error ? reason.message : '恢复会话失败，请重试。',
                    );
                  }
                })();
              }}
            >
              恢复当前会话
            </button>
            {restoreError ? <p role="alert">{restoreError}</p> : null}
          </div>
        ) : null}
        {recovered?.projectId === selection.projectId &&
        recovered.sessionId === selection.sessionId ? (
          <details className="execution-status">
            <summary>待核查指令</summary>
            <pre>{recovered.text}</pre>
            <button
              type="button"
              disabled={!!session?.archived}
              onClick={() =>
                safe(async () => {
                  const receipt = await call('session.send', recovered);
                  const draft = draftKey(directory, recovered.projectId, recovered.sessionId);
                  if (readDraft(draft).trim() === recovered.text) writeDraft(draft, '');
                  const key = draftKey(
                    directory,
                    recovered.projectId,
                    recovered.sessionId,
                    'pending',
                  );
                  try {
                    if (JSON.parse(readDraft(key)).instructionId === receipt.instructionId)
                      writeDraft(key, '');
                  } catch {}
                  setRecovered((current) =>
                    current?.instructionId === receipt.instructionId ? undefined : current,
                  );
                })
              }
            >
              按原身份补交
            </button>
          </details>
        ) : null}
        {error ? (
          <div className="business-error" role="alert">
            {error}{' '}
            <button type="button" onClick={() => safe(refresh)}>
              刷新状态
            </button>
          </div>
        ) : null}
        {snapshot?.run?.error ? (
          <div className="business-error" role="status">
            {snapshot.run.error}
          </div>
        ) : null}
        {session ? (
          <div className="execution-status" role="status" aria-label="执行状态">
            {session.title} ·{' '}
            {snapshot?.run
              ? {
                  queued: '排队中',
                  running: '执行中',
                  cancelling: '取消中',
                  cancelled: '已取消',
                  completed: '执行完成',
                  failed: '执行失败',
                  interrupted: '已中断',
                }[snapshot.run.state]
              : '空闲'}
            {snapshot?.messages.some((message) => message.state === 'accepted')
              ? ' · 有已受理指令等待消费'
              : ''}
          </div>
        ) : null}
      </>
    ),
    artifacts: snapshot?.artifacts.map((artifact) => {
      const name = artifact.path.split('/').pop() ?? artifact.path;
      return (
        <div className="artifact-card" key={`${artifact.runId}:${artifact.path}`}>
          <div className="artifact-card__info">
            <span className="artifact-card__name" title={artifact.path}>
              {name}
            </span>
            <span className="artifact-card__path" title={artifact.path}>
              {artifact.path}
            </span>
          </div>
          <span className="artifact-card__state">
            {artifact.state === 'linked' ? '已保存并登记' : '登记结果待核查'}
          </span>
          <div className="artifact-card__actions">
            <button
              type="button"
              className="btn"
              aria-label={`打开成果 ${artifact.path}`}
              disabled={!!artifact.location && artifact.location.state !== 'present'}
              onClick={() =>
                setFile({
                  projectId: selection.projectId,
                  path: artifact.location?.path ?? artifact.path,
                  ...(artifact.fileId ? { fileId: artifact.fileId } : {}),
                })
              }
            >
              打开成果
            </button>
            {artifact.state !== 'linked' ? (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  safe(() =>
                    call('artifacts.reconcile', {
                      projectId: selection.projectId,
                      sessionId: selection.sessionId,
                      runId: artifact.runId,
                      paths: [artifact.path],
                    }),
                  )
                }
              >
                核查并补齐
              </button>
            ) : null}
          </div>
          {artifact.location?.state === 'trashed' ? (
            <span className="artifact-card__note">已回收，可在回收站恢复</span>
          ) : null}
          {artifact.location?.path && artifact.location.path !== artifact.path ? (
            <span className="artifact-card__note">当前位置：{artifact.location.path}</span>
          ) : null}
        </div>
      );
    }),
    fileNavigator:
      client && project && project.id !== 'application'
        ? (activeFile) => (
            <FileExplorer
              key={project.id}
              client={client}
              project={project}
              revision={snapshot?.fileRevision ?? 0}
              activeFile={activeFile}
              scope={directory}
              open={setFile}
              attach={(path, fileId) => {
                const remove = materials.includes(path);
                setMaterials((current) => {
                  const next = remove
                    ? current.filter((item) => item !== path)
                    : [...new Set([...current, path])];
                  writeDraft(
                    draftKey(directory, selection.projectId, selection.sessionId, 'materials'),
                    JSON.stringify(next),
                  );
                  return next;
                });
                setMaterialFileIds((current) => {
                  const ids = { ...current };
                  if (!remove && fileId) ids[path] = fileId;
                  else delete ids[path];
                  writeDraft(
                    draftKey(
                      directory,
                      selection.projectId,
                      selection.sessionId,
                      'material-file-ids',
                    ),
                    JSON.stringify(ids),
                  );
                  return ids;
                });
              }}
              selected={materials}
            />
          )
        : undefined,
    sessions: (snapshot?.sessions ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      status: ['running', 'queued', 'cancelling'].includes(item.state)
        ? 'running'
        : item.state === 'failed'
          ? 'failed'
          : 'idle',
    })),
    activeSessionId: selection.sessionId,
    selectSession: (id) => select(selection.projectId, id),
    ...(phase === 'connected' && snapshot && !creating
      ? { createSession: () => createSession() }
      : {}),
    cancel:
      running && session
        ? () =>
            safe(() =>
              call('session.cancel', { projectId: selection.projectId, sessionId: session.id }),
            )
        : undefined,
    loadEarlier:
      snapshot?.nextBefore && client && !earlierComplete
        ? () =>
            safe(async () => {
              const selected = selectedRef.current;
              const before = earlier[0]?.id ?? snapshot.nextBefore;
              const page = await call('workbench.snapshot', {
                projectId: selection.projectId,
                sessionId: selection.sessionId,
                includeSessions: false,
                ...(before ? { before } : {}),
                limit: 50,
              });
              if (selected !== selectedRef.current) return;
              setEarlier((current) => [...page.messages, ...current]);
              setEarlierComplete(!page.nextBefore);
            })
        : undefined,
    materials: materials,
    selectedMaterials: materials,
    toggleMaterial: (path) => {
      const next = materials.filter((item) => item !== path);
      setMaterials(next);
      writeDraft(
        draftKey(directory, selection.projectId, selection.sessionId, 'materials'),
        JSON.stringify(next),
      );
    },
  };
}
