import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/react';
import { type KernelClient, KernelClientError } from '@scholoom/client';
import type {
  BusinessInputs,
  BusinessOutputs,
  BusinessParams,
  CallArguments,
  ContextItem,
  Effort,
  Message,
  ResourceDescriptor,
  WorkbenchContextSnapshot,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import { isContextItems, validateBusiness } from '@scholoom/protocol';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArtifactNotice } from './ArtifactNotice';
import {
  confirmContextDraft,
  emptyConversationField,
  legacyConversationDraft,
  readContextDraft,
  workbenchInstanceId,
  writeContextDraft,
} from './context-drafts';
import { readDraft, draftKey as storedDraftKey, subscribeDraft, writeDraft } from './drafts';
import { fileDocument } from './file-document';
import { FileExplorer } from './file-explorer/Explorer';
import { LibraryTab } from './library/LibraryTab';
import { ProjectOnboardingDialog } from './ProjectOnboarding';
import { ProjectTrustDialog } from './ProjectTrustDialog';
import { ProgramRunsTab } from './programs/ProgramRunsTab';
import { ProjectControls } from './project-ui';
import { artifactStateLabel, toThreadMessages } from './projection';
import { ResourceView } from './ResourceView';
import {
  attachmentResource,
  fileResource,
  projectTarget,
  type ResourceTarget,
  resourceKey,
} from './resource-controller';
import { SessionList } from './SessionList';
import { SessionSearchDialog } from './SessionSearch';
import type { FileTarget, KernelPhase, WorkbenchSession } from './session';
import { useTasks } from './tasks/use-tasks';

export function useBusinessSession(
  client: KernelClient | null,
  phase: KernelPhase,
): Partial<WorkbenchSession> {
  const [instanceId] = useState(workbenchInstanceId);
  const draftKey = useCallback(
    (...parts: (string | undefined)[]) => storedDraftKey(instanceId, ...parts),
    [instanceId],
  );
  const [received, setReceived] = useState<{
    selection: { projectId: string; sessionId: string };
    value: WorkbenchSnapshot;
  }>();
  const [selection, setSelection] = useState({ projectId: 'application', sessionId: '' });
  const snapshot = received?.selection === selection ? received.value : undefined;
  const taskState = useTasks(client, phase, selection.projectId, snapshot?.fileRevision ?? 0);
  const taskGraphs = useMemo<WorkbenchSession['taskGraphs']>(() => {
    if (!client || phase !== 'connected') return undefined;
    return {
      list: (input) => client.call('tasks.graphs', input),
      run: (input) => client.call('tasks.runGraph', input),
    };
  }, [client, phase]);
  const [error, setError] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialFileIds, setMaterialFileIds] = useState<Record<string, string>>({});
  const [resourceTarget, setResourceTarget] = useState<ResourceTarget>();
  const setFile = useCallback(
    (target: FileTarget | undefined) =>
      setResourceTarget(target ? fileResource(target) : undefined),
    [],
  );
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
  const managedExecution = client?.getSnapshot().status?.managedExecution;
  const executionUnavailable = managedExecution?.available === false;
  if (currentDirectory) directoryRef.current = currentDirectory;
  const directory = directoryRef.current;
  const contextKey = draftKey(directory, selection.projectId, selection.sessionId, 'context-items');
  const contextSerialized = useSyncExternalStore(
    useCallback((notify) => subscribeDraft(contextKey, notify), [contextKey]),
    () => readDraft(contextKey),
  );
  const [contextError, setContextError] = useState('');
  let contextItems: ContextItem[] = [];
  let contextReadError = '';
  try {
    contextItems = readContextDraft(contextKey);
  } catch (reason) {
    contextReadError = reason instanceof Error ? reason.message : '附加上下文无法恢复。';
  }
  const updateContext = (change: (items: ContextItem[]) => ContextItem[]) => {
    try {
      writeContextDraft(contextKey, change(readContextDraft(contextKey)));
      setContextError('');
    } catch (reason) {
      setContextError(reason instanceof Error ? reason.message : '附加上下文无法保存。');
    }
  };
  const contextRevision = useRef(0);
  const publishContext = useCallback(
    (snapshot: WorkbenchContextSnapshot | null) => {
      if (!client || phase !== 'connected') return;
      void client
        .call('workbench.context.publish', {
          snapshot: snapshot ? { ...snapshot, revision: ++contextRevision.current } : null,
        })
        .catch((reason: unknown) => {
          setContextError(reason instanceof Error ? reason.message : '当前选择发布失败。');
        });
    },
    [client, phase],
  );
  const selectedRef = useRef(selection);
  selectedRef.current = selection;
  const lifecycle = useRef(0);
  const delegationConnection = useRef({ client, phase, epoch: 0 });
  if (
    delegationConnection.current.client !== client ||
    delegationConnection.current.phase !== phase
  )
    delegationConnection.current = { client, phase, epoch: delegationConnection.current.epoch + 1 };
  const [delegationRevision, setDelegationRevision] = useState(0);
  useEffect(() => {
    if (!client || phase !== 'connected') return;
    return client.subscribeChanges((change) => {
      if (
        change.resync ||
        (change.projectId === selection.projectId && change.sessionId === selection.sessionId)
      )
        setDelegationRevision((value) => value + 1);
    });
  }, [client, phase, selection]);
  const delegationAccess = useMemo(() => {
    if (!client || phase !== 'connected' || !selection.sessionId) return undefined;
    const selected = selection;
    const generation = delegationConnection.current.epoch;
    const ensureCurrent = () => {
      if (selectedRef.current !== selected || delegationConnection.current.epoch !== generation)
        throw new Error('当前会话已改变，请重新读取委派。');
    };
    const request = async (
      method: 'delegation.get' | 'delegation.cancel',
      delegationId: string,
    ) => {
      ensureCurrent();
      const record = await client.call(method, { ...selected, delegationId });
      ensureCurrent();
      if (
        record.projectId !== selected.projectId ||
        record.sessionId !== selected.sessionId ||
        record.id !== delegationId
      )
        throw new Error('委派归属不匹配，请重新读取。');
      return record;
    };
    return {
      get: (id: string) => request('delegation.get', id),
      cancel: (id: string) => request('delegation.cancel', id),
      open: (resource: ResourceDescriptor) => {
        if (selectedRef.current !== selected || delegationConnection.current.epoch !== generation)
          return;
        setResourceTarget({ locator: resource.ref, name: resource.name });
      },
    };
  }, [client, phase, selection]);
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
  }, [client, phase, navigationKey, draftKey]);

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
  }, [client, phase, directory, draftKey]);

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
        validateBusiness('session.send', 'params', pending) &&
          isContextItems((pending as BusinessParams<'session.send'>).contextItems ?? []) &&
          (pending as BusinessParams<'session.send'>).projectId === selection.projectId &&
          (pending as BusinessParams<'session.send'>).sessionId === selection.sessionId
          ? (pending as BusinessParams<'session.send'>)
          : undefined,
      );
    } catch {
      setRecovered(undefined);
    }
  }, [directory, selection, draftKey]);

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
  }, [
    client,
    phase,
    selection,
    directory,
    snapshot?.fileRevision,
    materialFileIds,
    materials,
    draftKey,
  ]);

  useEffect(() => {
    if (recovered && snapshot?.messages.some((message) => message.id === recovered.instructionId)) {
      try {
        confirmContextDraft(
          draftKey(directory, recovered.projectId, recovered.sessionId, 'context-items'),
          recovered.contextItems ?? [],
        );
      } catch (reason) {
        setContextError(reason instanceof Error ? reason.message : '附加上下文无法恢复。');
      }
      const key = draftKey(directory, recovered.projectId, recovered.sessionId, 'pending');
      try {
        if (JSON.parse(readDraft(key)).instructionId === recovered.instructionId)
          writeDraft(key, '');
      } catch {}
      setRecovered((current) =>
        current?.instructionId === recovered.instructionId ? undefined : current,
      );
    }
  }, [directory, recovered, snapshot, draftKey]);

  const call = useCallback(
    async <A extends CallArguments<BusinessInputs>>(...args: A): Promise<BusinessOutputs[A[0]]> => {
      if (!client || phase !== 'connected') throw new Error('内核未连接。');
      const selected = selectedRef.current;
      try {
        setError('');
        const result = await client.call<A>(...args);
        await refresh();
        return result;
      } catch (reason) {
        if (selected === selectedRef.current)
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
    setError('');
    setRestoreError('');
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
  const messages = toThreadMessages(
    [
      ...new Map(
        [...earlier, ...(snapshot?.messages ?? [])].map((message) => [message.id, message]),
      ).values(),
    ],
    snapshot?.artifacts ?? [],
  );
  const adapter: ExternalStoreAdapter<ThreadMessageLike> = {
    messages,
    convertMessage: (message) => message,
    isRunning: !!running,
    isDisabled: creating || !!session?.archived,
    isSendDisabled:
      phase !== 'connected' ||
      executionUnavailable ||
      !!contextReadError ||
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
      if (!text || !session || !client || phase !== 'connected' || executionUnavailable) return;
      const pendingKey = draftKey(directory, selection.projectId, session.id, 'pending');
      const input: BusinessParams<'session.send'> = {
        projectId: selection.projectId,
        sessionId: session.id,
        instructionId: crypto.randomUUID(),
        text,
        materials,
        ...(contextItems.length ? { contextItems } : {}),
        ...(materials.length && materials.every((path) => !!materialFileIds[path])
          ? { materialFileIds: materials.map((path) => materialFileIds[path] as string) }
          : {}),
      };
      try {
        const previous = JSON.parse(readDraft(pendingKey));
        if (
          validateBusiness('session.send', 'params', previous) &&
          JSON.stringify({ ...previous, instructionId: '' }) ===
            JSON.stringify({ ...input, instructionId: '' })
        )
          input.instructionId = previous.instructionId;
      } catch {
        /* First send in this conversation. */
      }
      const instructionId = input.instructionId;
      const serialized = JSON.stringify(input);
      if (validateBusiness('session.send', 'params', input)) {
        writeDraft(pendingKey, serialized);
        setRecovered(input);
      }
      try {
        await client.call('session.send', input);
        confirmContextDraft(contextKey, input.contextItems ?? []);
        if (readDraft(pendingKey) === serialized) writeDraft(pendingKey, '');
        setRecovered((current) => (current?.instructionId === instructionId ? undefined : current));
        void refresh().catch(() => {});
      } catch (reason) {
        if (
          reason instanceof KernelClientError &&
          [
            'invalidRequest',
            'permissionDenied',
            'credentialUnavailable',
            'tooLarge',
            'resourceLimit',
            'contentChanged',
            'notFound',
            'unavailable',
          ].includes(reason.code)
        ) {
          if (readDraft(pendingKey) === serialized) writeDraft(pendingKey, '');
          setRecovered((current) =>
            current?.instructionId === instructionId ? undefined : current,
          );
        }
        if (selectedRef.current === selection)
          setError(reason instanceof Error ? reason.message : '发送失败，请核查指令状态。');
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
    ...(delegationAccess
      ? { delegations: { ...delegationAccess, revision: delegationRevision } }
      : {}),
    contextItems,
    publishContext,
    contextError: contextReadError || contextError,
    appendContextItem: (item) => updateContext((items) => [...items, item]),
    removeContextItem: (itemId) =>
      updateContext((items) => items.filter((item) => item.itemId !== itemId)),
    updateContextComment: (itemId, comment) =>
      updateContext((items) =>
        items.map((item) => (item.itemId === itemId ? { ...item, comment } : item)),
      ),
    projectId: selection.projectId,
    ...(client && project && project.id !== 'application'
      ? {
          programs: (
            <ProgramRunsTab
              client={client}
              projectId={project.id}
              directory={directory}
              enabled={phase === 'connected'}
              canExecute={!executionUnavailable}
              onOpenResource={(target) => {
                setResourceTarget(target);
              }}
            />
          ),
        }
      : {}),
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
              storageKey={storedDraftKey(instanceId, directory)}
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
                      if (!client || phase !== 'connected') throw new Error('内核未连接。');
                      // 信任失败由确认弹窗处理，不重复投影为全局通知。
                      await client.call('project.grant', {
                        projectId: project.id,
                        trust,
                        autoBackup: project.autoBackup,
                      });
                      await refresh();
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
    openMessageResource: async (ref) => {
      if (!client || phase !== 'connected') throw new Error('需连接内核。');
      const selected = selectedRef.current;
      const resource = await client.call('resources.describe', { locator: ref });
      if (selected === selectedRef.current)
        setResourceTarget({ locator: resource.ref, name: resource.name, openMode: 'permanent' });
    },
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
    ...(taskState.port
      ? {
          taskPort: taskState.port,
          ...(taskGraphs ? { taskGraphs } : {}),
          taskRevision: taskState.revision,
          taskWatchError: taskState.error,
          taskDraftKey: storedDraftKey(directory, selection.projectId, 'task-create'),
          taskCreation: (operationId: string) => {
            if (!client) return Promise.reject(new Error('内核未连接。'));
            return client.call('resources.creation', {
              projectId: selection.projectId,
              operationId,
            });
          },
          associateTask: async (entry, path, role, note) => {
            if (!client) throw new Error('内核未连接。');
            const document = fileDocument(
              storedDraftKey(directory, entry.task.projectId, entry.task.fileId, 'file'),
              storedDraftKey(directory, entry.task.projectId, entry.path, 'file'),
            );
            await document.flush();
            if (document.hasDraft())
              throw new Error('入口有未保存修改，请先在编辑器中保存或核对草稿。');
            const resource = await client.call('resources.describe', {
              locator: { source: 'project', projectId: entry.task.projectId, path },
            });
            if (resource.ref.source !== 'project') throw new Error('请选择当前项目材料。');
            const metadata = {
              ...entry.metadata,
              links: [
                ...(entry.metadata.links ?? []),
                {
                  id: crypto.randomUUID(),
                  role,
                  target: { kind: 'project-file' as const, fileId: resource.ref.fileId },
                  ...(note ? { note } : {}),
                },
              ],
            };
            const content = entry.content.replace(
              /^(\uFEFF?)---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,
              (_match, bom: string) => `${bom}---\n${JSON.stringify(metadata)}\n---\n`,
            );
            return client.call('tasks.save', {
              task: entry.task,
              basis: entry.entry.basis,
              content,
            });
          },
        }
      : {}),
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
    ...(resourceTarget ? { resourceTarget } : {}),
    resolveResource: async (target) => {
      if (!client || phase !== 'connected') throw new Error('内核未连接。');
      const resource = await client.call('resources.describe', { locator: target.locator });
      if (resource.unavailableReason) throw new Error(resource.unavailableReason);
      return { ...target, locator: resource.ref, name: resource.name };
    },
    isResourceDirty: (resource) => {
      const target = projectTarget(resource);
      if (!target) return false;
      const document = fileDocument(
        storedDraftKey(directory, target.projectId, target.fileId ?? target.path, 'file'),
        storedDraftKey(directory, target.projectId, target.path, 'file'),
      );
      const value = document.get();
      return (
        !!value.conversionOwner ||
        document.hasDraft() ||
        (value.loaded && value.content !== value.source?.content)
      );
    },
    flushResource: async (resource) => {
      const target = projectTarget(resource);
      if (!target) return;
      await fileDocument(
        storedDraftKey(directory, target.projectId, target.fileId ?? target.path, 'file'),
        storedDraftKey(directory, target.projectId, target.path, 'file'),
      ).flush();
    },
    renderResource: (target, mode, onDirty, viewId) =>
      client ? (
        <ResourceView
          key={resourceKey(target)}
          client={client}
          directory={directory}
          target={target}
          enabled={phase === 'connected'}
          viewId={viewId}
          mode={mode ?? 'source'}
          onDirty={onDirty}
          revision={snapshot?.fileRevision ?? 0}
          onOpenFile={setFile}
          onChanged={(stored) => {
            if (
              target.locator.source === 'project' &&
              !target.locator.fileId &&
              selectedRef.current.projectId === target.locator.projectId
            )
              setFile(stored);
            void refresh();
          }}
        />
      ) : null,
    library: client ? (
      <LibraryTab
        client={client}
        enabled={phase === 'connected'}
        onOpenResource={(material) => setResourceTarget(attachmentResource(material))}
      />
    ) : undefined,
    controls: (
      <ProjectControls
        snapshot={snapshot}
        selectedProject={selection.projectId}
        call={call}
        onOpen={(value) => select(value.id)}
        enabled={phase === 'connected' && !!snapshot}
      />
    ),
    ...(project && project.id !== 'application' && project.trust !== 'trusted'
      ? {
          projectTrust: {
            state: project.trust,
            request: () => setRequestedTrust(project.id),
          },
        }
      : {}),
    ...(session
      ? {
          executionStatus: `${session.title} · ${
            snapshot?.run
              ? {
                  queued: '排队中',
                  running: '执行中',
                  waiting: '等待输入',
                  cancelling: '取消中',
                  cancelled: '已取消',
                  completed: '执行完成',
                  failed: '执行失败',
                  interrupted: '已中断',
                }[snapshot.run.state]
              : '空闲'
          }${snapshot?.messages.some((message) => message.state === 'accepted') ? ' · 有已受理指令等待消费' : ''}`,
        }
      : {}),
    notices: [
      ...(managedExecution?.available === false
        ? [
            {
              id: 'managed-execution-unavailable',
              severity: 'info' as const,
              summary: managedExecution.reason,
              content: <p>{managedExecution.reason}</p>,
            },
          ]
        : []),
      ...(legacyConversationDraft(directory, selection.projectId, selection.sessionId).some(
        (entry) => entry.value,
      )
        ? [
            {
              id: 'legacy-draft',
              severity: 'info' as const,
              summary: '有旧窗口草稿可恢复',
              content: (
                <button
                  type="button"
                  disabled={
                    !!contextSerialized ||
                    !!readDraft(draftKey(directory, selection.projectId, selection.sessionId)) ||
                    !!recovered ||
                    !!materials.length
                  }
                  onClick={() => {
                    const entries = legacyConversationDraft(
                      directory,
                      selection.projectId,
                      selection.sessionId,
                    );
                    for (const entry of entries) {
                      const target = draftKey(
                        directory,
                        selection.projectId,
                        selection.sessionId,
                        ...(entry.suffix ? [entry.suffix] : []),
                      );
                      if (!emptyConversationField(entry.suffix, readDraft(target))) return;
                    }
                    for (const entry of entries) {
                      if (entry.value)
                        writeDraft(
                          draftKey(
                            directory,
                            selection.projectId,
                            selection.sessionId,
                            ...(entry.suffix ? [entry.suffix] : []),
                          ),
                          entry.value,
                        );
                    }
                    setSelection({ ...selection });
                  }}
                >
                  恢复旧草稿
                </button>
              ),
            },
          ]
        : []),
      ...(session?.archived
        ? [
            {
              id: 'archived',
              severity: 'warning' as const,
              summary: '会话已归档',
              content: (
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
                          if (selectedRef.current === selection)
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
              ),
            },
          ]
        : []),
      ...(recovered?.projectId === selection.projectId &&
      recovered.sessionId === selection.sessionId
        ? [
            {
              id: 'pending-instruction',
              severity: 'warning' as const,
              summary: '待核查指令',
              content: (
                <details className="execution-status">
                  <summary>待核查指令</summary>
                  <pre>{recovered.text}</pre>
                  <button
                    type="button"
                    disabled={!!session?.archived}
                    onClick={() =>
                      safe(async () => {
                        const receipt = await call('session.send', recovered);
                        confirmContextDraft(
                          draftKey(
                            directory,
                            recovered.projectId,
                            recovered.sessionId,
                            'context-items',
                          ),
                          recovered.contextItems ?? [],
                        );
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
              ),
            },
          ]
        : []),
      ...(error
        ? [
            {
              id: 'business-error',
              severity: 'error' as const,
              summary: error,
              content: (
                <div className="business-error" role="alert">
                  {error}{' '}
                  <button type="button" onClick={() => safe(refresh)}>
                    刷新状态
                  </button>
                </div>
              ),
            },
          ]
        : []),
      ...(snapshot?.run?.error
        ? [
            {
              id: 'run-error',
              severity: 'error' as const,
              summary: snapshot.run.error,
              content: (
                <div className="business-error" role="status">
                  {snapshot.run.error}
                </div>
              ),
            },
          ]
        : []),
      ...(snapshot?.artifacts ?? []).map((artifact) => {
        const state = artifactStateLabel(artifact);
        return {
          id: `artifact:${artifact.runId}:${artifact.path}`,
          severity: artifact.state === 'linked' ? ('info' as const) : ('warning' as const),
          summary: `${artifact.path.split('/').pop() ?? artifact.path} · ${state}`,
          content: (
            <ArtifactNotice
              artifact={artifact}
              enabled={!!client && phase === 'connected'}
              reconcile={async () => {
                if (!client || phase !== 'connected') throw new Error('内核未连接。');
                await client.call('artifacts.reconcile', {
                  projectId: selection.projectId,
                  sessionId: selection.sessionId,
                  runId: artifact.runId,
                  paths: [artifact.path],
                });
                if (selection === selectedRef.current) await refresh();
              }}
            />
          ),
        };
      }),
    ],
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
    activeSessionId: session?.id ?? '',
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
