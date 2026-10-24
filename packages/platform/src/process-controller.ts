import { type ChildProcess, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { frameSize } from './processes.js';

let execution: ChildProcess | undefined;
let instanceId: string | undefined;
let stopMs = 500;
let stopping: Promise<void> | undefined;
let pending = 0;
let moduleReady = false;
const startupFrames: object[] = [];

function deliver(value: object) {
  execution?.send(value, (error) => {
    pending--;
    if (error) {
      send({ type: 'failure' });
      void stop();
    }
  });
}

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

function stop(): Promise<void> {
  stopping ??= (async () => {
    const child = execution;
    if (child?.pid) {
      const exited =
        child.exitCode !== null || child.signalCode !== null
          ? Promise.resolve()
          : new Promise<void>((resolve) => child.once('exit', () => resolve()));
      if (child.connected && moduleReady)
        child.send({ jsonrpc: '2.0', method: 'execution.stop', params: {} }, () => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        exited,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, stopMs);
        }),
      ]);
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) {
        const control = child.stdio[4] as Writable;
        control.end('S');
      }
      try {
        await Promise.race([
          exited,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error('Native scope stop is unconfirmed.')), 6000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      if (child.exitCode !== 0 || child.signalCode !== null)
        throw new Error('Native scope did not confirm all descendants stopped.');
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
    if (!message || typeof message !== 'object') throw new Error('Invalid controller frame.');
    if (message.type === 'start' && !execution && !stopping) {
      if (!message.entry || !message.instanceId) throw new Error('Missing execution identity.');
      instanceId = message.instanceId;
      stopMs = Math.min(5000, Math.max(0, message.stopMs ?? 500));
      const binary = new URL(
        process.platform === 'win32' ? './process-scope.exe' : './process-scope',
        import.meta.url,
      );
      const child = spawn(
        fileURLToPath(binary),
        [process.execPath, fileURLToPath(new URL('./process-bootstrap.js', import.meta.url))],
        {
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'ignore', 'ignore', 'ipc', 'pipe', 'pipe'],
          env: message.env ?? {},
          windowsHide: true,
          serialization: 'json',
        },
      );
      execution = child;
      const control = child.stdio[4] as Writable;
      control.on('error', () => {
        void stop();
      });
      let pid: number | undefined;
      let gate: number | undefined;
      let armed = false;
      let loaded = false;
      let status = '';
      const arm = () => {
        if (pid && gate === pid && !armed) {
          armed = true;
          control.write('G');
        }
      };
      (child.stdio.at(5) as Readable).on('data', (part: Buffer) => {
        try {
          status += part.toString('utf8');
          if (status.length > 1024) throw new Error('Invalid native status.');
          for (;;) {
            const end = status.indexOf('\n');
            if (end < 0) break;
            const line = status.slice(0, end);
            status = status.slice(end + 1);
            if (line.startsWith('E ')) {
              send({ type: 'failure', reason: 'nativeScopeUnavailable' });
              void stop();
              return;
            }
            if (line.startsWith('P ') && !pid) {
              pid = Number(line.slice(2));
              if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid execution PID.');
              arm();
            } else if (line === 'R' && armed && !loaded && !stopping) {
              loaded = true;
              child.send({ type: 'load', entry: message.entry }, (error) => {
                if (error) {
                  send({ type: 'failure' });
                  void stop();
                } else send({ type: 'ready', identity: { pid, instanceId } });
              });
            } else throw new Error('Native execution ownership unavailable.');
          }
        } catch {
          send({ type: 'failure' });
          void stop();
        }
      });
      child.on('message', (payload: unknown) => {
        if (
          !loaded &&
          payload &&
          typeof payload === 'object' &&
          'type' in payload &&
          payload.type === 'gate'
        ) {
          gate = 'pid' in payload && typeof payload.pid === 'number' ? payload.pid : undefined;
          arm();
        } else if (
          loaded &&
          !moduleReady &&
          payload &&
          typeof payload === 'object' &&
          'type' in payload &&
          payload.type === 'loaded'
        ) {
          moduleReady = true;
          for (const frame of startupFrames) deliver(frame);
          startupFrames.length = 0;
        } else if (moduleReady) send({ type: 'frame', value: payload });
      });
      child.once('error', () => {
        send({ type: 'failure' });
        void stop();
      });
      child.once('disconnect', () => {
        void stop();
      });
      child.once('exit', () => {
        void stop();
      });
    } else if (message.type === 'stop' && (!instanceId || message.instanceId === instanceId)) {
      void stop();
    } else if (message.type === 'frame' && execution?.connected && !stopping) {
      if (++pending > 64) {
        pending--;
        throw new Error('Execution queue is full.');
      }
      if (moduleReady) deliver(message.value ?? {});
      else startupFrames.push(message.value ?? {});
    } else throw new Error('Invalid controller state.');
  } catch {
    send({ type: 'failure' });
    void stop();
  }
});
