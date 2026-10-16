import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createKernelClient, type KernelClient, KernelClientError } from '@scholoom/client';
import {
  type BootstrapRequest,
  type BootstrapResult,
  isBootstrapResult,
  limits,
} from '@scholoom/protocol';

export type { BootstrapRequest, BootstrapResult } from '@scholoom/protocol';

export const defaultDataDirectory = fileURLToPath(
  new URL('../../../.scholoom-dev', import.meta.url),
);
export const defaultDevelopmentDataDirectory = fileURLToPath(
  new URL('../../../.scholoom-dev/debug', import.meta.url),
);

export function bootstrapKernel(
  mode: BootstrapRequest['mode'],
  options: { dataDirectory?: string; nodeExecutable?: string; development?: boolean } = {},
): Promise<BootstrapResult> {
  const args = [
    fileURLToPath(new URL('./cli.js', import.meta.url)),
    mode === 'ensure' ? 'start' : 'status',
    '--connection-info',
  ];
  if (options.dataDirectory) args.push('--data-dir', options.dataDirectory);
  if (options.development) args.push('--development');
  return new Promise((resolve) => {
    execFile(
      options.nodeExecutable ?? process.env.SCHOOLOOM_NODE_EXECUTABLE ?? 'node',
      args,
      {
        timeout: limits.lifecycleMs + limits.requestMs + 2_000,
        maxBuffer: 128 * 1024,
        windowsHide: true,
      },
      (_error, stdout) => {
        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = null;
        }
        resolve(
          isBootstrapResult(result)
            ? result
            : {
                state: 'unknown',
                error: {
                  code: 'startupFailed',
                  message:
                    'Independent Node bootstrap failed. Check Node 24 and runtime/kernel.log.',
                },
              },
        );
      },
    );
  });
}

/** One development host owns one connection; the kernel coordinates all hosts. */
export function createDevelopmentKernel(
  options: { dataDirectory?: string; nodeExecutable?: string } = {},
) {
  const dataDirectory =
    options.dataDirectory ?? process.env.SCHOOLOOM_DATA_DIR ?? defaultDevelopmentDataDirectory;
  let owner: KernelClient | undefined;
  let pending: Promise<BootstrapResult> | undefined;
  let pendingMode: BootstrapRequest['mode'] | undefined;
  let disposed = false;
  const unavailable = (): BootstrapResult => ({
    state: 'unknown',
    error: { code: 'unavailable', message: 'Development host has closed.' },
  });
  const acquire = async (mode: BootstrapRequest['mode']): Promise<BootstrapResult> => {
    const result = await bootstrapKernel(mode, { ...options, dataDirectory, development: true });
    if (!('endpoint' in result)) return result;
    if (disposed) return unavailable();
    if (
      owner?.getSnapshot().phase === 'connected' &&
      owner.getSnapshot().status?.instanceId === result.endpoint.instanceId
    )
      return result;
    owner?.dispose();
    const client = createKernelClient(result.endpoint);
    owner = client;
    try {
      await client.connect();
      await client.attachDevelopment();
      if (disposed) {
        client.dispose();
        return unavailable();
      }
      return result;
    } catch (error) {
      client.dispose();
      if (owner === client) owner = undefined;
      return {
        state: 'unknown',
        error: {
          code: error instanceof KernelClientError ? error.code : 'startupFailed',
          message: error instanceof Error ? error.message : 'Development kernel unavailable.',
        },
      };
    }
  };
  return {
    dataDirectory,
    bootstrap(mode: BootstrapRequest['mode']): Promise<BootstrapResult> {
      if (disposed) return Promise.resolve(unavailable());
      if (pending && mode === 'ensure' && pendingMode === 'inspect')
        return pending.then(() => this.bootstrap(mode));
      if (!pending) {
        pendingMode = mode;
        pending = acquire(mode).finally(() => {
          pending = undefined;
        });
      }
      return pending;
    },
    async dispose(): Promise<void> {
      disposed = true;
      owner?.dispose();
      await pending;
      owner?.dispose();
      owner = undefined;
    },
  };
}
