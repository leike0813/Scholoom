import { OperationError } from '@scholoom/protocol/core';
import type { ProcessReservation } from './admission.js';
import { ManagedNode } from './processes.js';

export type CommandRequest = {
  executable: string;
  args: readonly string[];
  cwd: string;
  input?: string;
  timeoutMs: number;
};
export type CommandResult = { code: number; stdout: string; stderr: string };

/** Runs one command beneath the existing independent process-tree controller. */
export async function runCommand(
  request: CommandRequest,
  options: { signal?: AbortSignal | undefined; reservation?: ProcessReservation | undefined } = {},
): Promise<CommandResult> {
  options.signal?.throwIfAborted();
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
    instanceId: crypto.randomUUID(),
    env,
    ...(options.reservation ? { reservation: options.reservation } : {}),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectResult: (error: unknown) => void = () => {};
  const abort = () =>
    rejectResult(options.signal?.reason ?? new OperationError('shuttingDown', '命令已取消。'));
  try {
    options.signal?.throwIfAborted();
    const result = new Promise<CommandResult>((resolve, reject) => {
      rejectResult = reject;
      worker.on('message', (value: unknown) => {
        const message = value as { result?: CommandResult; error?: string } | undefined;
        if (message?.error) reject(new OperationError('unavailable', message.error));
        else if (message?.result) resolve(message.result);
      });
      worker.once('failure', reject);
      worker.once('exit', () =>
        reject(new OperationError('outcomeUnknown', '命令控制连接退出，结果待核查。')),
      );
      timer = setTimeout(
        () => reject(new OperationError('unavailable', '命令执行超过时限。')),
        request.timeoutMs,
      );
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
    });
    void worker.send(request).catch(rejectResult);
    return await result;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    await worker.stop();
  }
}
