import { OperationError } from '@scholoom/protocol/core';
import type { ProcessReservation } from './admission.js';
import { commandDeadline } from './command-deadline.js';
import { ManagedNode } from './processes.js';

export type CommandRequest = {
  executable: string;
  args: readonly string[];
  cwd: string;
  input?: string;
  timeoutMs: number | null;
  program?: boolean;
};
export type CommandResult = { code: number; stdout: string; stderr: string };
export type CommandEvent =
  | { kind: 'started' }
  | { kind: 'output'; stream: 'stdout' | 'stderr'; text: string }
  | { kind: 'exited'; code?: number; signal?: string; reason?: string }
  | { kind: 'stopped' };

/** Runs one command beneath the existing independent process-tree controller. */
export async function runCommand(
  request: CommandRequest,
  options: {
    signal?: AbortSignal | undefined;
    reservation?: ProcessReservation | undefined;
    authorize?: () => unknown | Promise<unknown>;
    instanceId?: string;
    env?: Readonly<Record<string, string>>;
    observe?: (event: CommandEvent) => Promise<void>;
  } = {},
): Promise<CommandResult> {
  options.signal?.throwIfAborted();
  ManagedNode.requireAvailable();
  const env: Record<string, string> = {};
  for (const name of [
    'HOME',
    'USERPROFILE',
    'XDG_CONFIG_HOME',
    'XDG_CACHE_HOME',
    'TEXMFHOME',
    'MIKTEX_USERCONFIG',
    'MIKTEX_USERDATA',
  ]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  env.openin_any = 'p';
  env.openout_any = 'p';
  const worker = await ManagedNode.start({
    entry: new URL('./command-worker.js', import.meta.url),
    instanceId: options.instanceId ?? crypto.randomUUID(),
    env: { ...env, ...options.env },
    ...(options.reservation ? { reservation: options.reservation } : {}),
  });
  let clearDeadline = () => {};
  let rejectResult: (error: unknown) => void = () => {};
  const abort = () =>
    rejectResult(options.signal?.reason ?? new OperationError('shuttingDown', '命令已取消。'));
  try {
    options.signal?.throwIfAborted();
    await options.authorize?.();
    await options.observe?.({ kind: 'started' });
    options.signal?.throwIfAborted();
    await options.authorize?.();
    const result = new Promise<CommandResult>((resolve, reject) => {
      rejectResult = reject;
      worker.on('message', (value: unknown) => {
        const message = value as
          | {
              result?: CommandResult;
              error?: string;
              output?: { seq: number; stream: 'stdout' | 'stderr'; text: string };
              signal?: string;
            }
          | undefined;
        if (message?.error) reject(new OperationError('unavailable', message.error));
        else if (message?.output) {
          const output = message.output;
          void Promise.resolve(
            options.observe?.({ kind: 'output', stream: output.stream, text: output.text }),
          )
            .then(() => worker.send({ method: 'command.ack', seq: output.seq }))
            .catch(reject);
        } else if (message?.result) {
          void Promise.resolve(
            options.observe?.({
              kind: 'exited',
              code: message.result.code,
              ...(message.signal ? { signal: message.signal } : {}),
            }),
          ).then(() => resolve(message.result as CommandResult), reject);
        }
      });
      worker.once('failure', reject);
      worker.once('exit', () =>
        reject(new OperationError('outcomeUnknown', '命令控制连接退出，结果待核查。')),
      );
      clearDeadline = commandDeadline(request.timeoutMs, () => {
        void Promise.resolve(options.observe?.({ kind: 'exited', reason: 'timeout' })).then(
          () => reject(new OperationError('unavailable', '命令执行超过时限。')),
          reject,
        );
      });
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
    });
    void worker.send(request).catch(rejectResult);
    return await result;
  } finally {
    clearDeadline();
    options.signal?.removeEventListener('abort', abort);
    await worker.stop();
    await options.observe?.({ kind: 'stopped' });
  }
}
