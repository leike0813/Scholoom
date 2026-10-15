import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

export function bootstrapKernel(
  mode: BootstrapRequest['mode'],
  options: { dataDirectory?: string; nodeExecutable?: string } = {},
): Promise<BootstrapResult> {
  const args = [
    fileURLToPath(new URL('./cli.js', import.meta.url)),
    mode === 'ensure' ? 'start' : 'status',
    '--connection-info',
  ];
  if (options.dataDirectory) args.push('--data-dir', options.dataDirectory);
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
