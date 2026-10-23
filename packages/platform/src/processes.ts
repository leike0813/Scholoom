import { type ChildProcess, fork } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { limits, OperationError } from '@scholoom/protocol/core';
import type { ProcessReservation } from './admission.js';

export type ProcessIdentity = Readonly<{ pid: number; instanceId: string }>;
export function processMayBeAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}
export type ManagedNodeOptions = {
  entry: URL;
  instanceId: string;
  env?: Readonly<Record<string, string>>;
  stopMs?: number;
  reservation?: ProcessReservation;
};

// Identity is valid only while this live child handle owns the process; stored PIDs grant no authority.
export function sameProcess(expected: ProcessIdentity, actual: ProcessIdentity): boolean {
  return expected.pid === actual.pid && expected.instanceId === actual.instanceId;
}
export function processIdentity(child: ChildProcess, instanceId: string): ProcessIdentity {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    throw new OperationError('unavailable', '执行进程已退出。');
  return Object.freeze({ pid: child.pid, instanceId });
}

export function frameSize(value: unknown): number {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new OperationError('invalidRequest', 'IPC消息不可序列化。');
  const bytes = Buffer.byteLength(serialized);
  if (bytes > limits.frameBytes) throw new OperationError('tooLarge', 'IPC消息超出容量。');
  return bytes;
}

export function nodeEnvironment(
  extra: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of [
    'PATH',
    'PATHEXT',
    'COMSPEC',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
  ]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  return { ...env, ...extra };
}

/** The controller remains responsive when the owned execution loop is blocked. */
export class ManagedNode extends EventEmitter {
  readonly exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  readonly stopped: Promise<void>;
  private readonly controller: ChildProcess;
  private stopping: Promise<void> | undefined;
  private pending = 0;
  private finished = false;
  identity: ProcessIdentity | undefined;

  private constructor(private readonly options: ManagedNodeOptions) {
    super();
    this.controller = fork(new URL('./process-controller.js', import.meta.url), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: nodeEnvironment(),
      execArgv: [],
      serialization: 'json',
    });
    let confirmed = false;
    let confirm!: () => void;
    let uncertain!: (error: Error) => void;
    this.stopped = new Promise<void>((resolve, reject) => {
      confirm = resolve;
      uncertain = reject;
    });
    void this.stopped.catch(() => {});
    options.reservation?.retainUntil(this.stopped);
    this.exited = new Promise((resolve) => {
      this.controller.once('exit', (code, signal) => {
        this.finished = true;
        if (!confirmed)
          uncertain(new OperationError('outcomeUnknown', '控制进程已退出，执行停止尚未确认。'));
        resolve({ code, signal });
        this.emit('exit', code, signal);
      });
    });
    this.controller.on('error', () =>
      this.emit('failure', new OperationError('unavailable', '执行控制进程失败。')),
    );
    this.controller.on('message', (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const message = value as { type?: string; identity?: ProcessIdentity; value?: unknown };
      if (message.type === 'ready' && message.identity?.instanceId === options.instanceId) {
        this.identity = Object.freeze(message.identity);
        this.emit('ready');
      } else if (message.type === 'stopped') {
        confirmed = true;
        confirm();
      } else if (message.type === 'frame') this.emit('message', message.value);
      else if (message.type === 'failure')
        this.emit('failure', new OperationError('unavailable', '执行进程通信失败。'));
    });
  }

  static async start(options: ManagedNodeOptions): Promise<ManagedNode> {
    if (options.entry.protocol !== 'file:' || !options.instanceId)
      throw new OperationError('invalidRequest', '执行入口或身份无效。');
    const owned = new ManagedNode(options);
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => done(new OperationError('unavailable', '执行进程启动超时。')),
        5000,
      );
      const success = () => done();
      const failure = (error?: Error) =>
        done(error ?? new OperationError('unavailable', '执行进程未就绪。'));
      function done(error?: Error) {
        clearTimeout(timer);
        owned.off('ready', success);
        owned.off('failure', failure);
        owned.off('exit', failure);
        if (error) reject(error);
        else resolve();
      }
      owned.once('ready', success);
      owned.once('failure', failure);
      owned.once('exit', failure);
    });
    try {
      await owned.write({
        type: 'start',
        entry: options.entry.href,
        instanceId: options.instanceId,
        env: nodeEnvironment(options.env),
        stopMs: options.stopMs ?? 500,
      });
      await ready;
      return owned;
    } catch (error) {
      await owned.stop();
      await ready.catch(() => undefined);
      throw error;
    }
  }

  private write(value: unknown): Promise<void> {
    frameSize(value);
    if (this.finished || !this.controller.connected)
      return Promise.reject(new OperationError('unavailable', '执行控制连接已断开。'));
    // Include controller frames and reserve one slot for stop.
    if (this.pending >= 65)
      return Promise.reject(new OperationError('resourceLimit', '执行发送队列已满。'));
    this.pending++;
    return new Promise((resolve, reject) => {
      this.controller.send(value as object, (error) => {
        this.pending--;
        if (error) reject(new OperationError('unavailable', '执行消息发送失败。'));
        else resolve();
      });
    });
  }

  async send(value: unknown): Promise<void> {
    if (this.stopping) return Promise.reject(new OperationError('shuttingDown', '执行正在停止。'));
    if (this.pending >= 64)
      return Promise.reject(new OperationError('resourceLimit', '执行发送队列已满。'));
    return this.write({ type: 'frame', value });
  }

  stop(expected: ProcessIdentity | undefined = this.identity): Promise<void> {
    if (expected && this.identity && !sameProcess(expected, this.identity))
      return Promise.reject(new OperationError('instanceMismatch', '执行身份不匹配。'));
    this.stopping ??= (async () => {
      if (!this.finished) {
        try {
          await this.write({ type: 'stop', instanceId: this.options.instanceId });
        } catch {
          if (this.controller.connected) this.controller.disconnect();
        }
        await this.exited;
      }
      await this.stopped;
    })();
    return this.stopping;
  }
}
