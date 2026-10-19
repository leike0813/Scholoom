import { type ChildProcess, execFile, fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { frameSize } from './processes.js';

let execution: ChildProcess | undefined;
let instanceId: string | undefined;
let stopMs = 500;
let stopping: Promise<void> | undefined;
let pending = 0;

function send(value: object) {
  if (!process.connected) return;
  try {
    frameSize(value);
    if (++pending > 64) {
      pending--;
      void stop();
      return;
    }
    process.send?.(value, (error) => {
      pending--;
      if (error) void stop();
    });
  } catch {
    void stop();
  }
}

async function terminateTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    // The live child handle remains owned until the tree operation has completed.
    await new Promise<void>((resolve, reject) => {
      execFile(
        'taskkill',
        ['/PID', String(child.pid), '/T', '/F'],
        { windowsHide: true },
        (error) => {
          if (error && child.exitCode === null && child.signalCode === null) reject(error);
          else resolve();
        },
      );
    });
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  }
}

function stop(): Promise<void> {
  stopping ??= (async () => {
    const child = execution;
    if (child) {
      const exited =
        !child.pid || child.exitCode !== null || child.signalCode !== null
          ? Promise.resolve()
          : new Promise<void>((resolve) => child.once('exit', () => resolve()));
      if (child.connected)
        child.send({ jsonrpc: '2.0', method: 'execution.stop', params: {} }, () => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        exited,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, stopMs);
        }),
      ]);
      clearTimeout(timer);
      // Kill the POSIX group even when its leader exited, so owned descendants cannot linger.
      await terminateTree(child);
      await exited;
    }
    if (process.connected)
      await new Promise<void>((resolve) => {
        process.send?.({ type: 'stopped' }, () => resolve());
      });
    if (process.connected) process.disconnect();
  })().catch(() => {
    send({ type: 'failure' });
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
  return stopping;
}

process.on('disconnect', () => {
  void stop();
});
process.on('message', (value: unknown) => {
  try {
    frameSize(value);
    const message = value as {
      type: string;
      entry?: string;
      instanceId?: string;
      env?: Record<string, string>;
      stopMs?: number;
      value?: object;
    };
    if (!message || typeof message !== 'object') throw new Error('invalid controller frame');
    if (message.type === 'start' && !execution && !stopping) {
      if (!message.entry || !message.instanceId) throw new Error('missing execution identity');
      instanceId = message.instanceId;
      stopMs = Math.min(5000, Math.max(0, message.stopMs ?? 500));
      execution = fork(fileURLToPath(new URL(message.entry)), [], {
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: message.env ?? {},
        execArgv: [],
        serialization: 'json',
        windowsHide: true,
      });
      execution.once('spawn', () =>
        send({ type: 'ready', identity: { pid: execution?.pid, instanceId } }),
      );
      execution.on('message', (payload) => send({ type: 'frame', value: payload }));
      execution.once('error', () => {
        send({ type: 'failure' });
        void stop();
      });
      execution.once('exit', () => {
        void stop();
      });
    } else if (message.type === 'stop' && (!instanceId || message.instanceId === instanceId)) {
      void stop();
    } else if (message.type === 'frame' && execution?.connected && !stopping) {
      if (++pending > 64) {
        pending--;
        throw new Error('execution queue full');
      }
      execution.send(message.value ?? {}, (error) => {
        pending--;
        if (error) {
          send({ type: 'failure' });
          void stop();
        }
      });
    } else throw new Error('invalid controller state');
  } catch {
    send({ type: 'failure' });
    void stop();
  }
});
