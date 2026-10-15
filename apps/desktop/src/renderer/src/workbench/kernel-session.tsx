import type { ConnectionSnapshot } from '@scholoom/client';
import { createKernelClient, KernelClientError } from '@scholoom/client';
import type { BootstrapResult, ErrorInfo, KernelEndpoint } from '@scholoom/protocol';
import { isBootstrapResult, limits } from '@scholoom/protocol';
import { useEffect, useRef, useState } from 'react';
import type { KernelPhase, WorkbenchConnection, WorkbenchSession } from './session';
import { Workbench } from './Workbench';

type KernelClient = ReturnType<typeof createKernelClient>;
type BootstrapMode = 'ensure' | 'inspect';

interface View {
  phase: KernelPhase;
  instanceId?: string | undefined;
  error?: ErrorInfo | undefined;
}

type Inspection =
  | { kind: 'ended' }
  | { kind: 'running'; endpoint: KernelEndpoint }
  | { kind: 'inconclusive' };

const phaseMessages: Record<KernelPhase, string> = {
  connecting: '正在连接内核…',
  connected: '已连接内核',
  reconnecting: '连接中断，正在重连…',
  disconnected: '内核未连接（不可达）',
  error: '内核连接失败',
  stopping: '正在停止内核…',
  stopped: '内核已停止',
  unknown: '无法确认停机结果',
};

const errorMessages: Record<ErrorInfo['code'], string> = {
  authenticationFailed: '认证失败：内核拒绝了当前凭据',
  protocolIncompatible: '协议不兼容：客户端与内核版本不一致',
  instanceMismatch: '目标实例与发现结果不一致',
  invalidRequest: '内核拒绝了不符合协议的请求',
  unavailable: '内核未连接（不可达）',
  outcomeUnknown: '无法确认停机结果',
  shuttingDown: '内核正在停止',
  permissionDenied: '权限不足，无法连接内核',
  startupFailed: '内核启动失败',
};

const confirmIntervalMs = 400;

/** 真实来源尚无材料与消息：草稿可编辑，发送始终禁用。 */
const realSource: Omit<WorkbenchSession, 'status' | 'connection'> = {
  materials: [],
  selectedMaterials: [],
  toggleMaterial: () => {},
  adapter: {
    messages: [],
    isSendDisabled: true,
    onNew: async () => {
      throw new Error('Kernel is not connected.');
    },
    convertMessage: (message) => message,
  },
};

function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof KernelClientError) return { code: error.code, message: error.message };
  return {
    code: 'unavailable',
    message: error instanceof Error ? error.message : '内核连接失败。',
  };
}

type BootstrapOutcome = { ok: true; result: BootstrapResult } | { ok: false; error: ErrorInfo };

function acceptBootstrap(payload: unknown): BootstrapOutcome {
  if (!isBootstrapResult(payload)) {
    return { ok: false, error: { code: 'protocolIncompatible', message: '引导结果不符合协议。' } };
  }
  return { ok: true, result: payload };
}

async function readBootstrap(mode: BootstrapMode): Promise<BootstrapOutcome> {
  const bridge = window.scholoomDesktop;
  try {
    if (bridge !== undefined) return acceptBootstrap(await bridge.bootstrap(mode));
    const response = await fetch('/__scholoom/kernel/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Scholoom-Bootstrap': '1' },
      body: JSON.stringify({ mode }),
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        ok: false,
        error: { code: 'unavailable', message: `引导端点返回 ${response.status}。` },
      };
    }
    return acceptBootstrap(await response.json());
  } catch (error) {
    return { ok: false, error: toErrorInfo(error) };
  }
}

/** 只有宿主报告目标已停止才算确认退出；其他实例占用配置不证明原实例已退出。 */
async function inspectTarget(target: string | undefined): Promise<Inspection> {
  const outcome = await readBootstrap('inspect');
  if (!outcome.ok) return { kind: 'inconclusive' };
  const result = outcome.result;
  if ('endpoint' in result) {
    return result.endpoint.instanceId === target
      ? { kind: 'running', endpoint: result.endpoint }
      : { kind: 'inconclusive' };
  }
  return result.state === 'stopped' ? { kind: 'ended' } : { kind: 'inconclusive' };
}

/**
 * 真实内核 session：引导、连接、重试、查询与确认停机闭合在一个组件生命周期内。
 * 状态变化只更新界面，Composer 实例与草稿保持挂载。
 */
export function useKernelSession(): WorkbenchSession {
  const [view, setView] = useState<View>({ phase: 'connecting' });
  const clientRef = useRef<KernelClient | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWaitRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const targetRef = useRef<string | undefined>(undefined);
  const confirmingRef = useRef(false);
  const settledRef = useRef(false);

  const live = (generation: number): boolean => generation === generationRef.current;

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      pendingWaitRef.current = resolve;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        pendingWaitRef.current = null;
        resolve();
      }, ms);
    });

  /** 清掉待触发的轮询等待，并让等待中的轮询立即结束，避免悬挂。 */
  const cancelWait = (): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const finish = pendingWaitRef.current;
    pendingWaitRef.current = null;
    finish?.();
  };

  /** 只断开连接与订阅，不停止内核。 */
  const release = (): void => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    clientRef.current?.dispose();
    clientRef.current = null;
  };

  /** 开始新一代：旧连接、旧轮询与旧确认结果都不再影响界面。 */
  const beginRun = (): number => {
    cancelWait();
    confirmingRef.current = false;
    settledRef.current = false;
    release();
    return ++generationRef.current;
  };

  const confirmExit = async (generation: number): Promise<void> => {
    if (!live(generation) || confirmingRef.current) return;
    confirmingRef.current = true;
    const target = targetRef.current;
    setView({ phase: 'stopping', instanceId: target });
    const deadline = Date.now() + limits.lifecycleMs;
    try {
      while (Date.now() < deadline) {
        const inspection = await inspectTarget(target);
        if (!live(generation)) return;
        if (inspection.kind === 'ended') {
          settledRef.current = true;
          setView({ phase: 'stopped', instanceId: target });
          return;
        }
        await wait(confirmIntervalMs);
        if (!live(generation)) return;
      }
      settledRef.current = true;
      setView({
        phase: 'unknown',
        instanceId: target,
        error: { code: 'outcomeUnknown', message: '未在预期时间内确认内核退出。' },
      });
    } finally {
      if (live(generation)) confirmingRef.current = false;
    }
  };

  const applySnapshot = (generation: number, snapshot: ConnectionSnapshot): void => {
    if (!live(generation) || confirmingRef.current || settledRef.current) return;
    switch (snapshot.phase) {
      case 'connecting':
        setView({ phase: 'connecting' });
        break;
      case 'connected':
        setView({ phase: 'connected', instanceId: snapshot.status?.instanceId });
        break;
      case 'reconnecting':
        setView({ phase: 'reconnecting', instanceId: snapshot.status?.instanceId });
        break;
      case 'stopping':
        void confirmExit(generation);
        break;
      case 'error':
        settledRef.current = true;
        setView({
          phase: snapshot.error?.code === 'outcomeUnknown' ? 'unknown' : 'error',
          instanceId: targetRef.current,
          error: snapshot.error,
        });
        break;
      default:
        if (snapshot.error?.code === 'shuttingDown') void confirmExit(generation);
        else
          setView({ phase: 'disconnected', instanceId: targetRef.current, error: snapshot.error });
    }
  };

  const connectTo = async (generation: number, endpoint: KernelEndpoint): Promise<void> => {
    const client = createKernelClient(endpoint);
    release();
    clientRef.current = client;
    targetRef.current = endpoint.instanceId;
    setView({ phase: 'connecting' });
    unsubscribeRef.current = client.subscribe(() =>
      applySnapshot(generation, client.getSnapshot()),
    );
    try {
      const status = await client.connect();
      if (!live(generation)) return;
      if (client.getSnapshot().phase === 'stopping' || status.state === 'stopping') {
        void confirmExit(generation);
      } else {
        setView({ phase: 'connected', instanceId: status.instanceId });
      }
    } catch (error) {
      if (!live(generation)) return;
      const snapshot = client.getSnapshot();
      if (
        snapshot.phase === 'error' ||
        snapshot.phase === 'disconnected' ||
        snapshot.phase === 'stopping'
      ) {
        applySnapshot(generation, snapshot);
      } else {
        setView({
          phase: 'disconnected',
          instanceId: endpoint.instanceId,
          error: toErrorInfo(error),
        });
      }
    }
  };

  const startFromBootstrap = async (generation: number, mode: BootstrapMode): Promise<void> => {
    setView({ phase: 'connecting' });
    const outcome = await readBootstrap(mode);
    if (!live(generation)) return;
    if (!outcome.ok) {
      setView({
        phase: outcome.error.code === 'protocolIncompatible' ? 'error' : 'disconnected',
        error: outcome.error,
      });
      return;
    }
    const result = outcome.result;
    if ('endpoint' in result) {
      await connectTo(generation, result.endpoint);
      return;
    }
    if (result.state === 'unknown') {
      settledRef.current = true;
      setView({
        phase: 'unknown',
        error: result.error ?? { code: 'unavailable', message: '无法确认内核当前状态。' },
      });
      return;
    }
    setView({ phase: 'disconnected', error: result.error });
  };

  const retryKernel = (): void => {
    void startFromBootstrap(beginRun(), 'ensure');
  };

  const inspectKernel = (): void => {
    const target = targetRef.current;
    const generation = beginRun();
    void (async () => {
      const inspection = await inspectTarget(target);
      if (!live(generation)) return;
      if (inspection.kind === 'ended') {
        settledRef.current = true;
        setView({ phase: 'stopped', instanceId: target });
        return;
      }
      if (inspection.kind === 'running') {
        await connectTo(generation, inspection.endpoint);
        return;
      }
      settledRef.current = true;
      setView({
        phase: 'unknown',
        instanceId: target,
        error: { code: 'outcomeUnknown', message: '无法确认内核当前状态。' },
      });
    })();
  };

  const stopKernel = (): void => {
    const client = clientRef.current;
    const generation = generationRef.current;
    if (client === null || !live(generation)) return;
    const target = targetRef.current;
    setView({ phase: 'stopping', instanceId: target });
    void (async () => {
      try {
        await client.shutdown();
      } catch (error) {
        // 停机已发出但没有确认结果，不报告成功。
        if (!live(generation)) return;
        settledRef.current = true;
        setView({ phase: 'unknown', instanceId: target, error: toErrorInfo(error) });
        return;
      }
      await confirmExit(generation);
    })();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在挂载时引导一次，实现只读写 ref
  useEffect(() => {
    // Electron 首次进入负责发现或启动；浏览器开发入口只查询，不创建实例。
    const generation = beginRun();
    void startFromBootstrap(
      generation,
      window.scholoomDesktop === undefined ? 'inspect' : 'ensure',
    );
    return () => {
      generationRef.current += 1;
      settledRef.current = true;
      cancelWait();
      release();
    };
  }, []);

  const canRetry =
    view.phase === 'disconnected' ||
    view.phase === 'error' ||
    view.phase === 'stopped' ||
    view.phase === 'unknown';
  const connection: WorkbenchConnection = {
    message: view.error === undefined ? phaseMessages[view.phase] : errorMessages[view.error.code],
    instanceId: view.instanceId,
    error: view.error,
    retry: canRetry ? retryKernel : undefined,
    inspect: view.phase === 'unknown' || view.phase === 'stopping' ? inspectKernel : undefined,
    stop: view.phase === 'connected' ? stopKernel : undefined,
  };

  return { ...realSource, status: view.phase, connection };
}

/** 默认来源：真实内核连接状态，替换此前的未连接占位来源。 */
export function KernelWorkbench() {
  return <Workbench session={useKernelSession()} />;
}
