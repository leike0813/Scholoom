import type { ExternalStoreAdapter, ThreadMessageLike } from '@assistant-ui/react';
import type { KernelClient } from '@scholoom/client';
import type {
  BusinessMethod,
  BusinessParams,
  BusinessResult,
  Message,
  WorkbenchSnapshot,
} from '@scholoom/protocol';
import { validateBusiness } from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { draftKey, readDraft, writeDraft } from './drafts';
import { FileEditor, ProjectControls, ProjectNavigator } from './project-ui';
import { toThreadMessage } from './projection';
import type { FileTarget, KernelPhase, WorkbenchSession } from './session';

export function useBusinessSession(
  client: KernelClient | null,
  phase: KernelPhase,
): Partial<WorkbenchSession> {
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot>();
  const [selection, setSelection] = useState({ projectId: 'application', sessionId: '' });
  const [error, setError] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [file, setFile] = useState<FileTarget>();
  const [earlier, setEarlier] = useState<Message[]>([]);
  const [earlierComplete, setEarlierComplete] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [recovered, setRecovered] = useState<BusinessParams<'session.send'>>();
  const directoryRef = useRef('');
  const currentDirectory = client?.getSnapshot().status?.dataDirectory;
  if (currentDirectory) directoryRef.current = currentDirectory;
  const directory = directoryRef.current;
  const selectedRef = useRef(selection);
  selectedRef.current = selection;
  const lifecycle = useRef(0);

  const refresh = useCallback(async () => {
    if (!client || phase !== 'connected') return;
    const selected = selectedRef.current;
    let result: WorkbenchSnapshot;
    try {
      result = await client.call('workbench.watch', {
        projectId: selected.projectId,
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
    setSnapshot(result);
  }, [client, phase]);

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
    const unsubscribe = client.subscribeChanges(() => {
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
    const key = draftKey(directory, selection.projectId, selection.sessionId, 'materials');
    try {
      setMaterials(JSON.parse(readDraft(key) || '[]'));
    } catch {
      setMaterials([]);
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
    async <M extends BusinessMethod>(
      method: M,
      params: BusinessParams<M>,
    ): Promise<BusinessResult<M>> => {
      if (!client || phase !== 'connected') throw new Error('内核未连接。');
      try {
        setError('');
        const result = await client.call(method, params);
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
    setSelection(next);
  };
  const safe = (action: () => Promise<unknown>) => {
    void action().catch(() => {});
  };
  const project = snapshot?.projects.find((item) => item.id === selection.projectId);
  const session = snapshot?.sessions.find((item) => item.id === selection.sessionId);
  const running = snapshot?.run && ['running', 'queued', 'cancelling'].includes(snapshot.run.state);
  const messages = [...earlier, ...(snapshot?.messages ?? [])]
    .filter((message, i, all) => all.findIndex((other) => other.id === message.id) === i)
    .map(toThreadMessage);
  const adapter: ExternalStoreAdapter<ThreadMessageLike> = {
    messages,
    convertMessage: (message) => message,
    isRunning: !!running,
    isSendDisabled:
      phase !== 'connected' ||
      !snapshot?.provider.configured ||
      !session ||
      !project?.send ||
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
  const createSession = () =>
    safe(async () => {
      const result = await call('session.create', { projectId: selection.projectId });
      select(selection.projectId, result.id);
    });
  return {
    adapter,
    draftKey: draftKey(directory, selection.projectId, selection.sessionId || 'unsent'),
    ...(file ? { fileTarget: file } : {}),
    renderFile: (target) =>
      client ? (
        <FileEditor
          key={`${target.projectId}:${target.path}`}
          client={client}
          directory={directory}
          target={target}
          onChanged={() => {
            if (target.create) setFile({ projectId: target.projectId, path: target.path });
            void refresh();
          }}
        />
      ) : null,
    controls: (
      <>
        <ProjectControls
          snapshot={snapshot}
          selectedProject={selection.projectId}
          onSelect={(id) => select(id, readDraft(draftKey(directory, id, 'session')))}
          call={call}
          onOpen={(value) => select(value.id)}
          enabled={phase === 'connected' && !!snapshot}
        />
        {recovered?.projectId === selection.projectId &&
        recovered.sessionId === selection.sessionId ? (
          <details className="execution-status">
            <summary>待核查指令</summary>
            <pre>{recovered.text}</pre>
            <button
              type="button"
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
        {snapshot?.artifacts.map((artifact) => (
          <div className="execution-status" key={`${artifact.runId}:${artifact.path}`}>
            成果：{artifact.path} ·{' '}
            {artifact.state === 'linked' ? '已保存并登记' : '登记结果待核查'}
            {artifact.state !== 'linked' ? (
              <button
                type="button"
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
        ))}
      </>
    ),
    fileNavigator:
      client && project && project.id !== 'application' ? (
        <ProjectNavigator
          key={project.id}
          client={client}
          project={project}
          revision={snapshot?.artifacts.length ?? 0}
          open={setFile}
          attach={(path) => {
            const next = materials.includes(path)
              ? materials.filter((item) => item !== path)
              : [...materials, path];
            setMaterials(next);
            writeDraft(
              draftKey(directory, selection.projectId, selection.sessionId, 'materials'),
              JSON.stringify(next),
            );
          }}
          selected={materials}
        />
      ) : undefined,
    sessions: (snapshot?.sessions ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt.slice(11, 16),
      status: ['running', 'queued', 'cancelling'].includes(item.state)
        ? 'running'
        : item.state === 'failed'
          ? 'failed'
          : 'idle',
    })),
    activeSessionId: selection.sessionId,
    selectSession: (id) => select(selection.projectId, id),
    ...(phase === 'connected' && snapshot ? { createSession } : {}),
    cancel:
      running && session
        ? () =>
            safe(() =>
              call('session.cancel', { projectId: selection.projectId, sessionId: session.id }),
            )
        : undefined,
    resume:
      !running && snapshot?.run && session
        ? () =>
            safe(() =>
              call('session.resume', { projectId: selection.projectId, sessionId: session.id }),
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
