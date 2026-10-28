import { execSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createKernelClient, KernelClientError } from '@scholoom/client';
import { privateDirectory } from '@scholoom/platform/node';
import {
  type BootstrapResult,
  type ErrorInfo,
  errorInfoSchema,
  isKernelEndpoint,
  type KernelEndpoint,
  type KernelStatus,
  limits,
  protocolVersion,
} from '@scholoom/protocol';
import { loadHostSettings } from './host-settings.js';
import { startKernelServer } from './server.js';

export { defaultDataDirectory } from './bootstrap.js';

const cliPath = fileURLToPath(new URL('./cli.js', import.meta.url));

type LifecycleObservation = {
  phase: string;
  discovery?: boolean;
  lock?: 'free' | 'held' | 'missing';
  instanceId?: string;
  processId?: number | undefined;
  processAlive?: boolean | undefined;
  handshake?: string;
  exitCode?: number | null;
  exitSignal?: NodeJS.Signals | null;
  systemCode?: string | undefined;
  elapsedMs?: number;
  lastState?: BootstrapResult['state'];
  lastErrorCode?: string | undefined;
  lastPhase?: string;
  preparationMs?: number;
  spawnedAt?: number;
};

function errorInfo(error: unknown, observation?: LifecycleObservation): ErrorInfo {
  const info: ErrorInfo =
    error instanceof KernelClientError
      ? { code: error.code, message: error.message }
      : { code: 'unavailable', message: 'Kernel lifecycle operation failed.' };
  if (!observation) return info;
  const system = error as NodeJS.ErrnoException & { errcode?: number };
  const detail = {
    ...observation,
    systemCode:
      observation.systemCode ??
      (typeof system?.code === 'string' && /^E[A-Z0-9_]+$/.test(system.code)
        ? system.code.slice(0, 64)
        : undefined),
    sqliteCode: Number.isSafeInteger(system?.errcode) ? system.errcode : undefined,
  };
  const limit = errorInfoSchema.properties.message.maxLength;
  let message = `${info.message}\n${JSON.stringify(detail)}`;
  if (message.length > limit) {
    delete detail.instanceId;
    message = `${info.message}\n${JSON.stringify(detail)}`;
  }
  if (message.length > limit)
    message = `Kernel lifecycle operation failed.\n${JSON.stringify(detail)}`;
  return { ...info, message };
}

async function canonicalDirectory(directory: string, create = false): Promise<string | null> {
  const path = resolve(directory);
  if (create) await mkdir(path, { recursive: true, mode: 0o700 });
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !create) return null;
    throw error;
  }
}

async function readEndpoint(directory: string): Promise<KernelEndpoint | null> {
  let content: string;
  try {
    content = await readFile(join(directory, 'runtime', 'endpoint.json'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  let record: unknown;
  try {
    record = JSON.parse(content);
  } catch {
    throw new KernelClientError('invalidRequest', 'Kernel discovery record is invalid.');
  }
  if (!isKernelEndpoint(record) || record.dataDirectory !== directory) {
    throw new KernelClientError(
      'instanceMismatch',
      'Kernel discovery record does not match this configuration.',
    );
  }
  return record;
}

function sqliteBusy(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errcode' in error &&
    (error.errcode === 5 || error.errcode === 6)
  );
}

async function lockState(directory: string): Promise<'free' | 'held' | 'missing'> {
  const filename = join(directory, 'runtime', 'lifecycle.sqlite');
  try {
    await stat(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(filename, { timeout: 0, readOnly: true });
    db.prepare('SELECT name FROM sqlite_master LIMIT 1').get();
    return 'free';
  } catch (error) {
    if (sqliteBusy(error)) return 'held';
    throw error;
  } finally {
    db?.close();
  }
}

export function processIsAlive(pid: number): boolean {
  if (process.platform === 'win32') {
    // Windows: 使用 tasklist 命令检测进程存在性
    try {
      const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return output.includes(`${pid}`);
    } catch {
      return false;
    }
  }

  // Unix/macOS: 使用信号 0 测试
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export async function inspectKernel(directory: string): Promise<BootstrapResult> {
  return inspect(directory, { phase: 'directory' });
}

async function inspect(
  directory: string,
  observation: LifecycleObservation,
): Promise<BootstrapResult> {
  try {
    const canonical = await canonicalDirectory(directory);
    if (!canonical) return { state: 'stopped' };
    observation.phase = 'discovery';
    const endpoint = await readEndpoint(canonical);
    observation.discovery = endpoint !== null;
    if (endpoint) {
      observation.instanceId = endpoint.instanceId.slice(0, 256);
      observation.processId = endpoint.processId;
    }
    observation.phase = 'lock';
    const lock = await lockState(canonical);
    observation.lock = lock;
    if (lock === 'missing') {
      return endpoint
        ? {
            state: 'unknown',
            error: errorInfo(
              new KernelClientError('unavailable', 'Kernel ownership cannot be verified.'),
              observation,
            ),
          }
        : { state: 'stopped' };
    }
    if (lock === 'free') {
      observation.phase = 'process';
      observation.processAlive = endpoint ? processIsAlive(endpoint.processId) : undefined;
      return endpoint && observation.processAlive
        ? {
            state: 'unknown',
            error: errorInfo(
              new KernelClientError(
                'unavailable',
                'Recorded process has not been confirmed to exit.',
              ),
              observation,
            ),
          }
        : { state: 'stopped' };
    }
    if (!endpoint) {
      return {
        state: 'unknown',
        error: errorInfo(
          new KernelClientError('unavailable', 'Configuration is occupied; kernel is not ready.'),
          observation,
        ),
      };
    }
    observation.phase = 'process';
    observation.processAlive = processIsAlive(endpoint.processId);
    if (!observation.processAlive) {
      return {
        state: 'unknown',
        error: errorInfo(
          new KernelClientError(
            'unavailable',
            'Configuration is occupied; waiting for current discovery information.',
          ),
          observation,
        ),
      };
    }
    const client = createKernelClient(endpoint);
    observation.phase = 'connect';
    try {
      const status = await client.connect();
      return { state: 'running', endpoint: { ...endpoint, ...status } };
    } catch (error) {
      return { state: 'unreachable', error: errorInfo(error, observation) };
    } finally {
      client.dispose();
    }
  } catch (error) {
    return { state: 'unknown', error: errorInfo(error, observation) };
  }
}

async function prepareRuntime(directory: string): Promise<string> {
  const runtime = join(directory, 'runtime');
  await privateDirectory(runtime);
  return runtime;
}

async function publishEndpoint(runtime: string, endpoint: KernelEndpoint): Promise<void> {
  const temporary = join(runtime, `endpoint-${randomUUID()}.tmp`);
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(endpoint), 'utf8');
    await file.close();
    await rename(temporary, join(runtime, 'endpoint.json'));
  } finally {
    await file.close();
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function serveKernel(
  directory: string,
  options: {
    modelEndpoint?: string;
    environment?: NodeJS.ProcessEnv;
    development?: boolean;
    isolatedZotero?: import('./zotero.js').IsolatedZotero;
  } = {},
): Promise<void> {
  let instanceId: string | undefined;
  const report = (phase: string) => {
    try {
      console.error(JSON.stringify({ phase, at: Date.now(), instanceId, processId: process.pid }));
    } catch {
      // Diagnostics cannot change ownership or lifecycle results.
    }
  };
  report('preparing-runtime');
  const canonical = await canonicalDirectory(directory, true);
  if (!canonical) throw new Error('Missing data directory');
  const runtime = await prepareRuntime(canonical);
  report('runtime-prepared');
  const filename = join(runtime, 'lifecycle.sqlite');
  const file = await open(filename, 'a', 0o600);
  await file.close();
  const db = new DatabaseSync(filename, { timeout: 0 });
  try {
    try {
      db.exec('PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE');
    } catch (error) {
      if (!sqliteBusy(error)) throw error;
      report('lock-busy');
      process.send?.({ state: 'busy' });
      return;
    }
    const status: KernelStatus = {
      protocolVersion,
      nodeVersion: process.versions.node,
      processId: process.pid,
      instanceId: randomUUID(),
      dataDirectory: canonical,
      startedAt: new Date().toISOString(),
      state: 'running',
    };
    instanceId = status.instanceId;
    report('loading-application');
    let endpoint: KernelEndpoint;
    const { KernelApplication } = await import('./application.js');
    const application = new KernelApplication(canonical, {
      ...options,
      zoteroRuntime: {
        kernelInstanceId: status.instanceId,
        settings: await loadHostSettings(canonical),
      },
    });
    report('initializing-application');
    await application.initialize(report);
    report('application-ready');
    const server = await startKernelServer(
      status,
      async () => {
        await publishEndpoint(runtime, { ...endpoint, state: 'stopping' });
        await application.close();
      },
      application,
      options.development,
    );
    endpoint = { ...status, url: server.url, token: server.token };
    report('server-listening');
    try {
      await publishEndpoint(runtime, endpoint);
      report('endpoint-published');
      process.send?.({ state: 'ready' });
      const onSignal = () => {
        void server.stop().catch(() => {
          process.exitCode = 1;
        });
      };
      process.once('SIGTERM', onSignal);
      process.once('SIGINT', onSignal);
      await server.closed;
      report('server-closed');
      process.off('SIGTERM', onSignal);
      process.off('SIGINT', onSignal);
    } finally {
      await server.stop();
    }
  } finally {
    const owned = db.isTransaction;
    if (owned) db.exec('ROLLBACK');
    db.close();
    if (owned) report('lock-released');
  }
}

export async function ensureKernel(
  directory: string,
  options: { development?: boolean } = {},
): Promise<BootstrapResult> {
  const started = Date.now();
  let inspection: LifecycleObservation = { phase: 'directory' };
  let result = await inspect(directory, inspection);
  if (result.state === 'running' || result.state === 'unreachable') return result;
  if (result.state === 'unknown' && result.error?.code !== 'unavailable') return result;
  const canonical = await canonicalDirectory(directory, true);
  if (!canonical)
    return {
      state: 'unknown',
      error: { code: 'startupFailed', message: 'Missing data directory.' },
    };
  const deadline = Date.now() + limits.lifecycleMs;
  while (Date.now() < deadline) {
    if (result.state === 'stopped') {
      const preparationStarted = Date.now();
      const runtime = await prepareRuntime(canonical);
      const preparationMs = Date.now() - preparationStarted;
      const log = await open(join(runtime, 'kernel.log'), 'a', 0o600);
      const spawnedAt = Date.now();
      const child = spawn(
        process.execPath,
        [
          cliPath,
          'serve',
          '--data-dir',
          canonical,
          ...(options.development ? ['--development'] : []),
        ],
        {
          detached: true,
          windowsHide: true,
          stdio: ['ignore', log.fd, log.fd, 'ipc'],
        },
      );
      await log.close();
      const launch: LifecycleObservation = {
        phase: 'ready',
        processId: child.pid,
        handshake: 'none',
        preparationMs,
        spawnedAt,
      };
      try {
        await new Promise<void>((resolveReady, reject) => {
          const timer = setTimeout(
            () => {
              launch.phase = 'ready-timeout';
              reject(new KernelClientError('startupFailed', 'Kernel startup timed out.'));
            },
            Math.max(1, deadline - Date.now()),
          );
          child.once('error', (error: NodeJS.ErrnoException) => {
            launch.phase = 'spawn';
            launch.systemCode =
              typeof error.code === 'string' && /^E[A-Z0-9_]+$/.test(error.code)
                ? error.code
                : undefined;
            clearTimeout(timer);
            reject(new KernelClientError('startupFailed', 'Unable to start independent Node.'));
          });
          child.once('exit', (code, signal) => {
            launch.phase = 'ready-exit';
            launch.exitCode = code;
            launch.exitSignal = signal;
            clearTimeout(timer);
            reject(
              new KernelClientError(
                'startupFailed',
                `Kernel exited before becoming ready (${code}).`,
              ),
            );
          });
          child.once('message', (message: { state?: string }) => {
            launch.handshake =
              message.state === 'ready' || message.state === 'busy' ? message.state : 'other';
            clearTimeout(timer);
            if (message.state === 'ready' || message.state === 'busy') resolveReady();
            else
              reject(
                new KernelClientError(
                  'startupFailed',
                  'Kernel initialization failed; inspect runtime/kernel.log.',
                ),
              );
          });
        });
      } catch (error) {
        return {
          state: 'unknown',
          error: errorInfo(error, { ...launch, elapsedMs: Date.now() - started }),
        };
      } finally {
        if (child.connected) child.disconnect();
        child.unref();
      }
    }
    inspection = { phase: 'directory' };
    result = await inspect(canonical, inspection);
    if (result.state === 'running' || result.state === 'unreachable') return result;
    if (result.state === 'unknown' && result.error?.code !== 'unavailable') return result;
    await delay(100);
  }
  return {
    state: 'unknown',
    error: errorInfo(
      new KernelClientError(
        'unavailable',
        'Kernel did not become available; existing ownership was preserved.',
      ),
      {
        ...inspection,
        phase: 'availability',
        lastPhase: inspection.phase,
        elapsedMs: Date.now() - started,
        lastState: result.state,
        lastErrorCode: 'error' in result ? result.error?.code : undefined,
      },
    ),
  };
}

export async function stopKernel(directory: string): Promise<BootstrapResult> {
  const initial = await inspectKernel(directory);
  if (initial.state !== 'running') return initial;
  const client = createKernelClient(initial.endpoint);
  try {
    await client.connect();
    await client.shutdown();
  } catch {
    return {
      state: 'unknown',
      error: { code: 'outcomeUnknown', message: 'Shutdown could not be confirmed; query status.' },
    };
  } finally {
    client.dispose();
  }
  const deadline = Date.now() + limits.lifecycleMs;
  while (Date.now() < deadline) {
    const result = await inspectKernel(directory);
    if (result.state === 'stopped' && !processIsAlive(initial.endpoint.processId)) return result;
    if (
      result.state === 'running' &&
      result.endpoint.instanceId !== initial.endpoint.instanceId &&
      !processIsAlive(initial.endpoint.processId)
    ) {
      return { state: 'stopped' };
    }
    await delay(100);
  }
  return {
    state: 'unknown',
    error: { code: 'outcomeUnknown', message: 'Shutdown timed out; query status.' },
  };
}
