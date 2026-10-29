import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process';
import { lstat, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { limits, OperationError } from '@scholoom/protocol/core';
import { isolationGate } from './isolated-report-assets.js';
import type { IsolationReceipt, IsolationScope } from './isolated-report-records.js';

export type IsolationPolicy = {
  id: string;
  version: string;
  profile: 'linux-x64-static-v1';
  cpuPercent: number;
  memoryBytes: number;
  swapBytes: number;
  tasks: number;
  /** Hard file-size ceiling for each of the two private output sinks. */
  outputBytes: number;
  runtimeMs: number;
  stopGraceMs: number;
};
export const isolationNative = fileURLToPath(new URL('./isolated-report-scope', import.meta.url));
const execute = promisify(execFile);
const environment = () => ({
  PATH: '/usr/bin:/bin',
  LANG: 'C',
  XDG_RUNTIME_DIR: `/run/user/${process.getuid?.()}`,
});
const unknown = () => new OperationError('outcomeUnknown', '隔离执行完整范围或持久身份尚未确认。');
export async function isolatedCommand(file: string, args: string[]): Promise<string> {
  const result = await execute(file, args, {
    env: environment(),
    timeout: limits.requestMs,
    maxBuffer: 16384,
  });
  return result.stdout;
}
export async function isolationSupport(): Promise<void> {
  if (process.platform !== 'linux' || process.arch !== 'x64')
    throw new OperationError('unavailable', '隔离策略仅校准 Linux x86_64。');
  for (const path of [
    '/usr/bin/systemd-run',
    '/usr/bin/systemctl',
    '/usr/bin/bwrap',
    isolationNative,
    isolationGate,
  ]) {
    const info = await lstat(path);
    if (!info.isFile() || !(info.mode & 0o111) || info.mode & 0o022)
      throw new OperationError('unavailable', '可信隔离工具不可用或可被其他身份修改。');
  }
  await isolatedCommand('/usr/bin/systemctl', ['--user', 'show', '--property=ControlGroup']);
}
export async function isolationLock(
  path: string,
): Promise<{ close(): Promise<void>; alive(): boolean }> {
  const child = spawn(isolationNative, ['--lock', path], {
    env: environment(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let alive = true;
  const closed = new Promise<void>((resolve) =>
    child.once('close', () => {
      alive = false;
      resolve();
    }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new OperationError('unavailable', '私有执行记录锁尚未确认。')),
        limits.requestMs,
      );
      child.once('error', reject);
      child.once('close', () => {
        clearTimeout(timer);
        reject(new OperationError('unavailable', '私有执行记录已占用或锁不可用。'));
      });
      child.stdout.once('data', (data) => {
        clearTimeout(timer);
        if (data.toString() === 'locked\n') resolve();
        else reject(unknown());
      });
      child.stderr.resume();
    });
  } catch (error) {
    child.stdin.end();
    await closed;
    throw error;
  }
  return {
    alive: () => alive,
    close: async () => {
      child.stdin.end();
      await closed;
    },
  };
}
async function unitInfo(unit: string): Promise<Record<string, string>> {
  // show returns an explicit not-found LoadState for collected scopes.
  try {
    return Object.fromEntries(
      (
        await isolatedCommand('/usr/bin/systemctl', [
          '--user',
          'show',
          unit,
          '--property=InvocationID,ControlGroup,LoadState,ActiveState',
        ])
      )
        .trim()
        .split('\n')
        .map((l) => {
          const at = l.indexOf('=');
          return [l.slice(0, at), l.slice(at + 1)];
        }),
    );
  } catch {
    throw unknown();
  }
}
async function optionalStat(path: string) {
  try {
    return await stat(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
export async function scopeIdentity(
  receipt: IsolationReceipt,
  pid: number,
  policy: IsolationPolicy,
): Promise<IsolationScope> {
  const info = await unitInfo(receipt.unit);
  const group = (await readFile(`/proc/${pid}/cgroup`, 'utf8')).trim();
  if (
    !group.startsWith('0::/user.slice/') ||
    group.slice(3) !== info.ControlGroup ||
    !group.endsWith(`/${receipt.unit}`) ||
    !/^[a-f0-9]{32}$/.test(info.InvocationID ?? '')
  )
    throw unknown();
  const path = join('/sys/fs/cgroup', group.slice(3));
  const expected = [
    ['cpu.max', `${policy.cpuPercent * 1000} 100000`],
    ['memory.max', `${policy.memoryBytes}`],
    ['memory.swap.max', `${policy.swapBytes}`],
    ['pids.max', `${policy.tasks}`],
  ];
  for (const [name, value] of expected)
    if ((await readFile(join(path, name as string), 'utf8')).trim() !== value)
      throw new OperationError('unavailable', '实际隔离资源限制未兑现。');
  const s = await stat(path, { bigint: true });
  const proc = await readFile(`/proc/${pid}/stat`, 'utf8');
  const birth = proc.slice(proc.lastIndexOf(')') + 2).split(' ')[19];
  if (!birth || !/^\d+$/.test(birth)) throw unknown();
  return {
    bootId: (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim(),
    invocationId: info.InvocationID as string,
    cgroup: group.slice(3),
    dev: String(s.dev),
    ino: String(s.ino),
    controllerPid: pid,
    controllerBirth: birth,
  };
}

/** Range emptiness is useful only with this receipt's pre-exec no-migration policy proof. */
export async function inspectIsolationScope(receipt: IsolationReceipt): Promise<'empty' | 'live'> {
  const boot = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
  if (receipt.scope && receipt.scope.bootId !== boot) return 'empty';
  const unit = await unitInfo(receipt.unit);
  if (!receipt.scope) {
    if (
      !receipt.launchIntent &&
      (unit.LoadState === 'not-found' || unit.ActiveState === 'inactive') &&
      !unit.ControlGroup
    )
      return 'empty';
    throw unknown();
  }
  const s = receipt.scope,
    path = join('/sys/fs/cgroup', s.cgroup);
  const actual = await optionalStat(path);
  if (actual && (String(actual.dev) !== s.dev || String(actual.ino) !== s.ino)) throw unknown();
  if (unit.LoadState !== 'not-found' && unit.InvocationID && unit.InvocationID !== s.invocationId)
    throw unknown();
  if (unit.ControlGroup && unit.ControlGroup !== s.cgroup) throw unknown();
  if (!actual) {
    if (
      unit.LoadState !== 'not-found' &&
      unit.ActiveState !== 'inactive' &&
      unit.ActiveState !== 'failed'
    )
      throw unknown();
    return 'empty';
  }
  const events = await readFile(join(path, 'cgroup.events'), 'utf8');
  return /^populated 0$/m.test(events) ? 'empty' : 'live';
}
export async function stopRecoveredIsolation(receipt: IsolationReceipt): Promise<void> {
  if ((await inspectIsolationScope(receipt)) === 'empty') return;
  if (!receipt.scope) throw unknown();
  // The observed cgroup object must still match before asking the manager to stop it.
  const unit = await unitInfo(receipt.unit);
  if (
    unit.InvocationID !== receipt.scope.invocationId ||
    unit.ControlGroup !== receipt.scope.cgroup
  )
    throw unknown();
  // Native openat pins the original cgroup before writing cgroup.kill: no name-to-unit kill race.
  const result = await execute(
    isolationNative,
    [
      '--settle',
      join('/sys/fs/cgroup', receipt.scope.cgroup),
      receipt.scope.dev,
      receipt.scope.ino,
      String(limits.lifecycleMs),
      'native-v1',
    ],
    { env: environment(), timeout: limits.lifecycleMs, maxBuffer: 4096 },
  );
  if (result.stdout !== 'stopped\n') throw unknown();
  if ((await inspectIsolationScope(receipt)) !== 'empty') throw unknown();
}

export class IsolationController {
  private child?: ChildProcessWithoutNullStreams;
  private stopRequested = false;
  private confirmed = false;
  private exited = false;
  private done: Promise<void> = Promise.resolve();
  constructor(
    private readonly options: {
      receipt: IsolationReceipt;
      path: string;
      policy: IsolationPolicy;
      args: readonly string[];
      persist(): Promise<void>;
      authorize(): Promise<void>;
      running(): Promise<void>;
      stopped(failed: boolean): Promise<void>;
      uncertain(error: unknown): Promise<void>;
    },
  ) {}
  async start(): Promise<void> {
    const o = this.options,
      r = o.receipt,
      p = o.policy;
    const dir = await lstat(o.path, { bigint: true });
    if (!dir.isDirectory() || dir.uid !== BigInt(process.getuid?.() ?? -1) || dir.mode & 0o077n)
      throw unknown();
    const args = [
      o.path,
      String(dir.dev),
      String(dir.ino),
      r.unit,
      String(p.cpuPercent * 1000),
      String(p.memoryBytes),
      String(p.swapBytes),
      String(p.tasks),
      String(p.outputBytes),
      String(p.stopGraceMs),
      String(r.stage.assets.length),
      String(o.args.length),
      r.stage.entryPath,
      r.sealed?.program ?? '',
      r.sealed?.gate ?? '',
    ];
    for (const [i, asset] of r.stage.assets.entries()) args.push(asset.path, r.stamps[i] ?? '');
    args.push(...o.args);
    r.scopeIntent = true;
    await o.persist();
    const child = spawn(
      '/usr/bin/systemd-run',
      [
        '--user',
        '--scope',
        '--collect',
        `--unit=${r.unit}`,
        '--property=CPUQuotaPeriodSec=100ms',
        `--property=CPUQuota=${p.cpuPercent}%`,
        `--property=MemoryMax=${p.memoryBytes}`,
        `--property=MemorySwapMax=${p.swapBytes}`,
        `--property=TasksMax=${p.tasks}`,
        `--property=RuntimeMaxSec=${p.runtimeMs}ms`,
        isolationNative,
        ...args,
      ],
      { env: environment(), stdio: ['pipe', 'pipe', 'pipe'] },
    );
    this.child = child;
    let chain = Promise.resolve(),
      buffer = '',
      bytes = 0,
      stderr = 0,
      diagnostic = '',
      armed = false,
      ready = false,
      running = false,
      stopped = false,
      failed = false;
    const reject = (error: unknown) => {
      this.stopRequested = true;
      child.stdin.end();
      chain = chain.then(() => o.uncertain(error));
    };
    const deadline = setTimeout(() => {
      reject(new OperationError('outcomeUnknown', '隔离启动门未在期限内确认。'));
    }, limits.lifecycleMs);
    child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 4096) {
        reject(unknown());
        return;
      }
      buffer += chunk.toString('utf8');
      while (buffer.includes('\n')) {
        const at = buffer.indexOf('\n'),
          line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        chain = chain
          .then(async () => {
            const event = JSON.parse(line) as {
              event: string;
              pid?: number;
              failed?: boolean;
              gateReleased?: boolean;
            };
            if (
              event.event === 'armed' &&
              !armed &&
              Number.isSafeInteger(event.pid) &&
              (event.pid ?? 0) > 1
            ) {
              r.scope = await scopeIdentity(r, event.pid as number, p);
              await o.persist();
              armed = true;
              if (!this.stopRequested) child.stdin.write('P');
              else child.stdin.end();
            } else if (event.event === 'ready' && armed && !ready) {
              ready = true;
              if (this.stopRequested) {
                child.stdin.end();
                return;
              }
              await o.authorize();
              r.launchIntent = true;
              await o.persist();
              await o.authorize();
              if (!this.stopRequested) child.stdin.write('G');
              else child.stdin.end();
            } else if (event.event === 'running' && ready && !running && r.launchIntent) {
              running = true;
              clearTimeout(deadline);
              r.status.gateReleased = true;
              await o.running();
            } else if (
              event.event === 'stopped' &&
              !stopped &&
              typeof event.failed === 'boolean' &&
              event.gateReleased === running
            ) {
              stopped = true;
              failed = event.failed;
            } else throw unknown();
          })
          .catch(async (error) => {
            this.stopRequested = true;
            child.stdin.end();
            await o.uncertain(error);
          });
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.length;
      if (stderr > 8192) reject(unknown());
      else diagnostic += chunk.toString('utf8');
    });
    this.done = new Promise<void>((resolve) => {
      child.once('error', (error) => {
        chain = chain.then(() => o.uncertain(error));
      });
      child.once('close', (code, signal) => {
        this.exited = true;
        clearTimeout(deadline);
        void chain
          .then(async () => {
            if (!stopped || code !== 0 || signal || buffer) {
              let stage = 'controller-exit',
                errno: number | undefined;
              for (const line of diagnostic.split('\n'))
                try {
                  const value = JSON.parse(line) as { stage?: string; errno?: number };
                  if (
                    typeof value.stage === 'string' &&
                    /^[a-z-]{1,40}$/.test(value.stage) &&
                    Number.isSafeInteger(value.errno)
                  ) {
                    stage = value.stage;
                    errno = value.errno;
                    break;
                  }
                } catch {
                  /* systemd diagnostics are not public output. */
                }
              throw new OperationError(
                r.launchIntent ? 'outcomeUnknown' : 'unavailable',
                `隔离执行待核查：stage=${stage}, errno=${errno ?? 'unknown'}, exit=${code ?? 'unknown'}, signal=${signal ?? 'none'}。`,
              );
            }
            if ((await inspectIsolationScope(r)) !== 'empty') throw unknown();
            await o.stopped(failed);
            this.confirmed = true;
          })
          .catch((error) => o.uncertain(error))
          .finally(resolve);
      });
    });
  }
  async stop(): Promise<boolean> {
    this.stopRequested = true;
    this.child?.stdin.end('S');
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      this.done,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, limits.lifecycleMs);
      }),
    ]);
    clearTimeout(timer);
    return this.confirmed;
  }
  get hasExited(): boolean {
    return this.exited;
  }
}
