import { execFile, execSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createKernelClient, KernelClientError } from '@scholoom/client';
import {
  type BootstrapResult,
  type ErrorInfo,
  isKernelEndpoint,
  type KernelEndpoint,
  type KernelStatus,
  limits,
  protocolVersion,
} from '@scholoom/protocol';
import { startKernelServer } from './server.js';

export { defaultDataDirectory } from './bootstrap.js';

const cliPath = fileURLToPath(new URL('./cli.js', import.meta.url));
const execute = promisify(execFile);

function errorInfo(error: unknown): ErrorInfo {
  if (error instanceof KernelClientError) return { code: error.code, message: error.message };
  return { code: 'unavailable', message: 'Kernel lifecycle operation failed.' };
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
  try {
    const canonical = await canonicalDirectory(directory);
    if (!canonical) return { state: 'stopped' };
    const endpoint = await readEndpoint(canonical);
    const lock = await lockState(canonical);
    if (lock === 'missing') {
      return endpoint
        ? {
            state: 'unknown',
            error: { code: 'unavailable', message: 'Kernel ownership cannot be verified.' },
          }
        : { state: 'stopped' };
    }
    if (lock === 'free') {
      return endpoint && processIsAlive(endpoint.processId)
        ? {
            state: 'unknown',
            error: {
              code: 'unavailable',
              message: 'Recorded process has not been confirmed to exit.',
            },
          }
        : { state: 'stopped' };
    }
    if (!endpoint) {
      return {
        state: 'unknown',
        error: { code: 'unavailable', message: 'Configuration is occupied; kernel is not ready.' },
      };
    }
    if (!processIsAlive(endpoint.processId)) {
      return {
        state: 'unknown',
        error: {
          code: 'unavailable',
          message: 'Configuration is occupied; waiting for current discovery information.',
        },
      };
    }
    const client = createKernelClient(endpoint);
    try {
      const status = await client.connect();
      return { state: 'running', endpoint: { ...endpoint, ...status } };
    } catch (error) {
      return { state: 'unreachable', error: errorInfo(error) };
    } finally {
      client.dispose();
    }
  } catch (error) {
    return { state: 'unknown', error: errorInfo(error) };
  }
}

async function prepareRuntime(directory: string): Promise<string> {
  const runtime = join(directory, 'runtime');
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const script = [
      '$acl = New-Object System.Security.AccessControl.DirectorySecurity',
      '$acl.SetAccessRuleProtection($true, $false)',
      '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User',
      '$acl.SetOwner($sid)',
      '$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")',
      '$acl.AddAccessRule($rule)',
      'Set-Acl -LiteralPath $env:SCHOOLOOM_RUNTIME_ACL_PATH -AclObject $acl -ErrorAction Stop',
    ].join('; ');
    await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      env: { ...process.env, SCHOOLOOM_RUNTIME_ACL_PATH: runtime },
    });
  } else {
    await chmod(runtime, 0o700);
  }
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
  options: { modelEndpoint?: string; environment?: NodeJS.ProcessEnv; development?: boolean } = {},
): Promise<void> {
  const canonical = await canonicalDirectory(directory, true);
  if (!canonical) throw new Error('Missing data directory');
  const runtime = await prepareRuntime(canonical);
  const filename = join(runtime, 'lifecycle.sqlite');
  const file = await open(filename, 'a', 0o600);
  await file.close();
  const db = new DatabaseSync(filename, { timeout: 0 });
  try {
    try {
      db.exec('PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE');
    } catch (error) {
      if (!sqliteBusy(error)) throw error;
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
    let endpoint: KernelEndpoint;
    const { KernelApplication } = await import('./application.js');
    const application = new KernelApplication(canonical, options);
    await application.initialize();
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
    try {
      await publishEndpoint(runtime, endpoint);
      process.send?.({ state: 'ready' });
      const onSignal = () => {
        void server.stop().catch(() => {
          process.exitCode = 1;
        });
      };
      process.once('SIGTERM', onSignal);
      process.once('SIGINT', onSignal);
      await server.closed;
      process.off('SIGTERM', onSignal);
      process.off('SIGINT', onSignal);
    } finally {
      await server.stop();
    }
  } finally {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close();
  }
}

export async function ensureKernel(
  directory: string,
  options: { development?: boolean } = {},
): Promise<BootstrapResult> {
  let result = await inspectKernel(directory);
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
      const runtime = await prepareRuntime(canonical);
      const log = await open(join(runtime, 'kernel.log'), 'a', 0o600);
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
          detached: process.platform !== 'win32', // Windows 不支持 detached + IPC 组合
          windowsHide: true,
          stdio: ['ignore', log.fd, log.fd, 'ipc'],
        },
      );
      await log.close();
      try {
        await new Promise<void>((resolveReady, reject) => {
          const timer = setTimeout(
            () => reject(new KernelClientError('startupFailed', 'Kernel startup timed out.')),
            Math.max(1, deadline - Date.now()),
          );
          child.once('error', () => {
            clearTimeout(timer);
            reject(new KernelClientError('startupFailed', 'Unable to start independent Node.'));
          });
          child.once('exit', (code) => {
            clearTimeout(timer);
            reject(
              new KernelClientError(
                'startupFailed',
                `Kernel exited before becoming ready (${code}).`,
              ),
            );
          });
          child.once('message', (message: { state?: string }) => {
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
        return { state: 'unknown', error: errorInfo(error) };
      } finally {
        if (child.connected) child.disconnect();
        child.unref();
      }
    }
    result = await inspectKernel(canonical);
    if (result.state === 'running' || result.state === 'unreachable') return result;
    if (result.state === 'unknown' && result.error?.code !== 'unavailable') return result;
    await delay(100);
  }
  return {
    state: 'unknown',
    error: {
      code: 'unavailable',
      message: 'Kernel did not become available; existing ownership was preserved.',
    },
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
