import type { KernelClient } from '@scholoom/client';
import type { ResourceEvidence } from '@scholoom/protocol';
import type { ProgramRun, ProgramState, ProgramsInputs } from '@scholoom/protocol/programs';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { draftKey, readDraft, subscribeDraft, writeDraft } from '../drafts';
import type { ResourceTarget } from '../resource-controller';

export const programStateLabel: Record<ProgramState, string> = {
  queued: '排队中',
  running: '运行中',
  cancelling: '取消中',
  completed: '执行完成',
  failed: '执行失败',
  cancelled: '已取消',
  interrupted: '已中断',
  unknown: '状态未知',
};

export const canHandoffProgramRun = (
  run: Pick<ProgramRun, 'origin' | 'state' | 'backgroundOwner'> | undefined,
): boolean =>
  !!run?.origin &&
  run.state === 'running' &&
  (!run.backgroundOwner || run.backgroundOwner.state === 'failed');

const initialDraft = {
  entry: '',
  environmentId: '',
  args: '[]',
  cwd: '.',
  outputs: '',
  overwrite: '',
  timeout: '',
  lifetime: 'background',
  registrationKind: 'python',
  interpreterPath: '',
  uvPath: '',
};
export type ProgramDraft = typeof initialDraft;
const messageOf = (reason: unknown) =>
  reason instanceof Error ? reason.message : '操作未完成，请核查运行状态。';

function useStoredText(key: string) {
  const text = useSyncExternalStore(
    (listener) => subscribeDraft(key, listener),
    () => readDraft(key),
  );
  return [text, (value: string) => writeDraft(key, value)] as const;
}

function readJson<T>(text: string, fallback: T): T {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

function useRead<T>(
  client: KernelClient,
  key: string,
  enabled: boolean,
  tick: number,
  load: () => Promise<T>,
) {
  const loader = useRef(load);
  loader.current = load;
  const reader = useRef<() => void>(() => {});
  const requestedTick = useRef(tick);
  const [received, setReceived] = useState<{
    client: KernelClient;
    key: string;
    value?: T;
    error?: string;
  }>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: loader holds the current page; tick requests another read through reader.
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    let again = false;
    const loadPage = loader.current;
    const update = async () => {
      if (!active) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const value = await loadPage();
        if (active) setReceived({ client, key, value });
      } catch (reason) {
        if (active) setReceived({ client, key, error: messageOf(reason) });
      } finally {
        running = false;
        if (active && again) {
          again = false;
          void update();
        }
      }
    };
    reader.current = () => void update();
    requestedTick.current = tick;
    void update();
    return () => {
      active = false;
      reader.current = () => {};
    };
  }, [client, key, enabled]);
  useEffect(() => {
    if (requestedTick.current !== tick) {
      requestedTick.current = tick;
      reader.current();
    }
  }, [tick]);
  return enabled && received?.client === client && received.key === key ? received : undefined;
}

function projectPath(text: string, directory = false): string {
  const path = text.trim();
  if (directory && path === '.') return path;
  if (
    !path ||
    /[\\\0\r\n]/.test(path) ||
    path.startsWith('/') ||
    /^[a-z]:/i.test(path) ||
    path.split('/').some((part) => !part || part === '..' || part === '.')
  )
    throw new Error('请输入项目内的相对路径，不使用 ..、绝对路径或反斜杠。');
  return path;
}

export function parseProgramDraft(draft: ProgramDraft): Omit<
  ProgramsInputs['programs.start'],
  'projectId' | 'operationId' | 'entry'
> & {
  entryPath: string;
} {
  const args: unknown = JSON.parse(draft.args);
  const bytes = new TextEncoder();
  if (
    !Array.isArray(args) ||
    args.length > 128 ||
    args.some((arg) => typeof arg !== 'string' || bytes.encode(arg).length > 4096) ||
    args.reduce((size, arg) => size + bytes.encode(arg).length, 0) > 65536
  )
    throw new Error('参数须为 JSON 字符串数组，最多 128 项、每项 4 KiB、合计 64 KiB。');
  const paths = (text: string) => {
    const result = text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => projectPath(line));
    if (result.length > 100 || new Set(result).size !== result.length)
      throw new Error('每组路径最多 100 项，且不能重复。');
    return result;
  };
  const outputs = paths(draft.outputs);
  const overwrite = paths(draft.overwrite);
  if (overwrite.some((path) => !outputs.includes(path)))
    throw new Error('允许覆盖的路径必须属于声明输出。');
  const timeoutMs = draft.timeout.trim() ? Number(draft.timeout) : null;
  if (timeoutMs !== null && (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1))
    throw new Error('期限须为正整数毫秒，留空表示无总期限。');
  if (!draft.environmentId) throw new Error('请先选择已登记环境。');
  if (draft.lifetime !== 'execution' && draft.lifetime !== 'background')
    throw new Error('请选择执行归属。');
  return {
    entryPath: projectPath(draft.entry),
    environmentId: draft.environmentId,
    cwd: projectPath(draft.cwd, true),
    args: args as string[],
    inputs: [],
    outputs,
    overwrite,
    timeoutMs,
    lifetime: draft.lifetime,
  };
}

export function useProgramController({
  client,
  projectId,
  directory,
  enabled,
}: {
  client: KernelClient;
  projectId: string;
  directory: string;
  enabled: boolean;
}) {
  const key = draftKey(directory, projectId, 'programs');
  const [draftText, setDraftText] = useStoredText(key);
  const draft = useMemo(() => {
    const saved = readJson<Partial<ProgramDraft>>(draftText, {});
    return Object.fromEntries(
      Object.entries(initialDraft).map(([field, fallback]) => [
        field,
        typeof saved?.[field as keyof ProgramDraft] === 'string'
          ? saved[field as keyof ProgramDraft]
          : fallback,
      ]),
    ) as ProgramDraft;
  }, [draftText]);
  const edit = (field: keyof ProgramDraft, value: string) =>
    setDraftText(JSON.stringify({ ...draft, [field]: value }));
  const [selectedId, selectRun] = useStoredText(`${key}|selected`);
  const [planId, setPlanId] = useStoredText(`${key}|plan`);
  const [pendingText, setPendingText] = useStoredText(`${key}|pending`);
  const pending = useMemo(
    () => readJson<ProgramsInputs['programs.start'] | null>(pendingText, null),
    [pendingText],
  );
  const [runPages, setRunPages] = useState<(string | undefined)[]>([undefined]);
  const [environmentPages, setEnvironmentPages] = useState<(string | undefined)[]>([undefined]);
  const [logPages, setLogPages] = useState({ runId: selectedId, pages: [0] });
  const currentLogPages = logPages.runId === selectedId ? logPages.pages : [0];
  const after = currentLogPages.at(-1) ?? 0;
  const before = runPages.at(-1);
  const environmentBefore = environmentPages.at(-1);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const working = useRef(false);
  const generation = useRef(0);
  const readable = enabled && projectId !== 'application';
  const refresh = () => setTick((current) => current + 1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: connection changes invalidate in-flight action receipts.
  useEffect(() => {
    generation.current++;
    setBusy('');
    return () => {
      generation.current++;
      working.current = false;
    };
  }, [client, readable]);

  useEffect(() => {
    if (!readable) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = client.subscribeChanges((change) => {
      if (!change.resync && !(change.projectId === projectId && change.programsChanged)) return;
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        setTick((current) => current + 1);
      }, 250);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [client, projectId, readable]);

  const runs = useRead(client, `runs:${before ?? ''}`, readable, tick, () =>
    client.call('programs.runs', { projectId, limit: 25, ...(before ? { before } : {}) }),
  );
  const environments = useRead(
    client,
    `environments:${environmentBefore ?? ''}`,
    readable,
    tick,
    () =>
      client.call('programs.environments', {
        projectId,
        limit: 25,
        ...(environmentBefore ? { before: environmentBefore } : {}),
      }),
  );
  const run = useRead(client, `run:${selectedId}`, readable && !!selectedId, tick, () =>
    client.call('programs.run', { projectId, programRunId: selectedId }),
  );
  const logs = useRead(client, `logs:${selectedId}:${after}`, readable && !!selectedId, tick, () =>
    client.call('programs.logs', { projectId, programRunId: selectedId, after, limitBytes: 65536 }),
  );
  const plan = useRead(client, `plan:${planId}`, readable && !!planId, tick, () =>
    client.call('programs.environmentPlanStatus', { projectId, planId }),
  );
  const preparationIdentity = readJson<{ id: string } | null>(
    readDraft(`${key}|operation:prepare`),
    null,
  );
  const canRetryPreparation =
    run?.value?.kind === 'environmentPreparation' &&
    run.value.operationId === preparationIdentity?.id &&
    run.value.environmentId === plan?.value?.environmentId &&
    run.value.stop === 'confirmed' &&
    ['failed', 'cancelled', 'interrupted'].includes(run.value.state);
  const active =
    runs?.value?.runs.some((item) => ['queued', 'running', 'cancelling'].includes(item.state)) ||
    (run?.value && ['queued', 'running', 'cancelling'].includes(run.value.state)) ||
    environments?.value?.environments.some((item) =>
      ['preparing', 'cancelling'].includes(item.availability),
    ) ||
    plan?.value?.state === 'pending';
  useEffect(() => {
    if (!readable || !active) return;
    const timer = setInterval(() => setTick((current) => current + 1), 2500);
    return () => clearInterval(timer);
  }, [readable, active]);

  const action = async (name: string, work: (current: () => boolean) => Promise<void>) => {
    if (!readable || working.current) return;
    working.current = true;
    const revision = generation.current;
    const current = () => revision === generation.current;
    setBusy(name);
    setError('');
    try {
      await work(current);
      if (current()) refresh();
    } catch (reason) {
      if (current()) setError(`${name}：${messageOf(reason)}`);
    } finally {
      if (current()) {
        working.current = false;
        setBusy('');
      }
    }
  };

  const evidence = async (path: string): Promise<ResourceEvidence> => {
    const resource = await client.call('resources.describe', {
      locator: { source: 'project', projectId, path },
    });
    if (resource.ref.source !== 'project' || resource.ref.projectId !== projectId)
      throw new Error('资源不属于当前项目。');
    if (!resource.capabilities.read || resource.unavailableReason)
      throw new Error(resource.unavailableReason || '资源当前不可读。');
    return { ref: resource.ref, basis: resource.basis };
  };
  const operationId = (kind: string, input: unknown, retry = false) => {
    const operationKey = `${key}|operation:${kind}`;
    const serialized = JSON.stringify(input);
    const stored = readJson<{ input: string; id: string } | null>(readDraft(operationKey), null);
    if (!retry && stored?.input === serialized) return stored.id;
    const id = crypto.randomUUID();
    writeDraft(operationKey, JSON.stringify({ input: serialized, id }));
    return id;
  };
  const clearPending = (request: ProgramsInputs['programs.start']) => {
    const saved = readJson<ProgramsInputs['programs.start'] | null>(
      readDraft(`${key}|pending`),
      null,
    );
    if (saved?.operationId === request.operationId) setPendingText('');
  };
  const submit = async (request: ProgramsInputs['programs.start'], current: () => boolean) => {
    try {
      const result = await client.call('programs.start', request);
      clearPending(request);
      if (current()) {
        selectRun(result.programRunId);
        setRunPages([undefined]);
      }
    } catch (reason) {
      if (
        reason instanceof Error &&
        'code' in reason &&
        [
          'authenticationFailed',
          'invalidRequest',
          'permissionDenied',
          'notFound',
          'contentChanged',
          'targetAmbiguous',
          'tooLarge',
          'resourceLimit',
        ].includes(String(reason.code))
      )
        clearPending(request);
      throw reason;
    }
  };

  return {
    draft,
    edit,
    readable,
    busy,
    error,
    runs,
    run,
    logs,
    environments,
    plan,
    selectedId,
    selectRun,
    pending,
    canHandoff: canHandoffProgramRun(run?.value),
    canRetryPreparation,
    refresh,
    runPage: runPages.length,
    environmentPage: environmentPages.length,
    logPage: currentLogPages.length,
    nextRuns: () => {
      if (runs?.value?.before) setRunPages([...runPages, runs.value.before]);
    },
    previousRuns: () => setRunPages(runPages.slice(0, -1)),
    nextEnvironments: () => {
      if (environments?.value?.before)
        setEnvironmentPages([...environmentPages, environments.value.before]);
    },
    previousEnvironments: () => setEnvironmentPages(environmentPages.slice(0, -1)),
    nextLogs: () => {
      if (logs?.value && logs.value.next > after && logs.value.entries.length)
        setLogPages({ runId: selectedId, pages: [...currentLogPages, logs.value.next] });
    },
    previousLogs: () => setLogPages({ runId: selectedId, pages: currentLogPages.slice(0, -1) }),
    hasNextLogs: !!logs?.value?.entries.length && logs.value.next > after,
    start: () =>
      action('启动程序', async (current) => {
        if (readDraft(`${key}|pending`)) throw new Error('请先查询或补交待核对的原请求。');
        const { entryPath, ...configuration } = parseProgramDraft(draft);
        const entry = await evidence(entryPath);
        if (!current()) return;
        const request = { ...configuration, projectId, operationId: crypto.randomUUID(), entry };
        setPendingText(JSON.stringify(request));
        await submit(request, current);
      }),
    retryStart: () =>
      action('补交原请求', async (current) => {
        if (pending) await submit(pending, current);
      }),
    queryStart: () =>
      action('查询受理结果', async (current) => {
        if (!pending) return;
        const result = await client.call('programs.run', {
          projectId,
          operationId: pending.operationId,
        });
        clearPending(pending);
        if (current()) selectRun(result.programRunId);
      }),
    registerEnvironment: () =>
      action('登记环境', async (current) => {
        const interpreterPath = draft.interpreterPath.trim();
        const uvPath = draft.uvPath.trim();
        if (!interpreterPath || (draft.registrationKind === 'uv' && !uvPath))
          throw new Error('请填写解释器及必要的 uv 本机位置。');
        const kind = draft.registrationKind;
        if (kind !== 'python' && kind !== 'conda' && kind !== 'uv')
          throw new Error('请选择环境种类。');
        const configuration = {
          projectId,
          interpreterPath,
          kind,
          ...(kind === 'uv' ? { uvPath } : {}),
        };
        const result = await client.call('programs.registerEnvironment', {
          ...configuration,
          operationId: operationId('register', configuration),
        } as ProgramsInputs['programs.registerEnvironment']);
        if (current()) {
          if (result.programRunId) selectRun(result.programRunId);
          setEnvironmentPages([undefined]);
        }
      }),
    checkPlan: () =>
      action('检查环境计划', async (current) => {
        if (!draft.environmentId) throw new Error('请先选择环境。');
        const declarations: ResourceEvidence[] = [];
        for (const path of ['pyproject.toml', 'uv.lock']) {
          declarations.push(await evidence(path));
          if (!current()) return;
        }
        const configuration = { projectId, environmentId: draft.environmentId, declarations };
        const result = await client.call('programs.environmentPlan', {
          ...configuration,
          operationId: operationId('plan', configuration, plan?.value?.state === 'failed'),
        });
        if (current()) {
          setPlanId(result.planId);
          selectRun(result.programRunId);
        }
      }),
    authorizePlan: () =>
      action('授权计划', async () => {
        if (
          !planId ||
          plan?.value?.state !== 'ready' ||
          plan.value.environmentId !== draft.environmentId
        )
          throw new Error('请先取得所选环境的完整准备计划。');
        await client.call('programs.authorizeEnvironment', { projectId, planId });
      }),
    prepareEnvironment: (retry = false) =>
      action('准备环境', async (current) => {
        if (
          !plan?.value?.authorizationId ||
          plan.value.state !== 'ready' ||
          plan.value.environmentId !== draft.environmentId
        )
          throw new Error('请先明确授权所选环境的准备计划。');
        if (retry && !canRetryPreparation) throw new Error('原准备运行尚未确认停止，不能重试。');
        const result = await client.call('programs.environmentPrepare', {
          projectId,
          planId,
          operationId: operationId('prepare', { projectId, planId }, retry),
        });
        if (current()) selectRun(result.programRunId);
      }),
    cancel: () =>
      action('取消运行', async () => {
        await client.call('programs.cancel', { projectId, programRunId: selectedId });
      }),
    handoff: () =>
      action('移交后台', async () => {
        if (!canHandoffProgramRun(run?.value)) throw new Error('此运行当前不能移交后台。');
        await client.call('programs.handoff', { projectId, programRunId: selectedId });
      }),
    reconcile: () =>
      action('核查运行和输出', async () => {
        await client.call('programs.reconcile', { projectId, programRunId: selectedId });
      }),
    openOutput: (
      resource: ResourceEvidence,
      name: string,
      open: (target: ResourceTarget) => void | Promise<void>,
    ) =>
      action('打开输出', async (current) => {
        if (resource.ref.source !== 'project' || resource.ref.projectId !== projectId)
          throw new Error('输出不属于当前项目。');
        const latest = await client.call('resources.describe', { locator: resource.ref });
        if (latest.basis !== resource.basis)
          throw new Error('输出内容已变化，请核查运行和输出后重新打开。');
        if (latest.unavailableReason || !latest.capabilities.read)
          throw new Error(latest.unavailableReason || '输出当前不可读。');
        if (current()) await open({ locator: latest.ref, name, openMode: 'permanent' });
      }),
  };
}
