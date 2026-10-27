import { execFile } from 'node:child_process';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { BootstrapResult, KernelEndpoint } from '../packages/protocol/dist/index.js';
import { isBootstrapResult, limits } from '../packages/protocol/dist/index.js';

const execute = promisify(execFile);
export const cliPath = fileURLToPath(new URL('../apps/kernel/dist/cli.js', import.meta.url));
const clientConnectionTimeout = 2 * limits.authenticationMs + limits.requestMs;
// Bootstrap subprocess, then WS open/authentication/status; production deadlines are unchanged.
export const kernelConnectionTimeout =
  limits.lifecycleMs + limits.requestMs + 2_000 + clientConnectionTimeout;
// Development additionally connects the host owner and waits for its attach receipt.
export const developmentKernelConnectionTimeout =
  kernelConnectionTimeout + clientConnectionTimeout + limits.requestMs;

/** Test artifacts contain lifecycle facts, never connection URLs, tokens or raw CLI output. */
export function kernelResultSummary(result: BootstrapResult) {
  let diagnostic: Record<string, unknown> | undefined;
  if ('error' in result && result.error) {
    try {
      const value = JSON.parse(result.error.message.split('\n').at(-1) ?? '');
      diagnostic = Object.fromEntries(
        [
          'phase',
          'discovery',
          'lock',
          'instanceId',
          'processId',
          'processAlive',
          'handshake',
          'exitCode',
          'exitSignal',
          'systemCode',
          'sqliteCode',
          'elapsedMs',
          'lastState',
          'lastErrorCode',
          'lastPhase',
          'killed',
          'stdoutBytes',
        ]
          .filter(
            (key) =>
              ['string', 'number', 'boolean'].includes(typeof value?.[key]) ||
              value?.[key] === null,
          )
          .map((key) => [
            key,
            typeof value[key] === 'string' ? value[key].slice(0, 256) : value[key],
          ]),
      );
    } catch {
      // Older diagnostics may have no structured suffix.
    }
  }
  return {
    state: result.state,
    ...('endpoint' in result
      ? { instanceId: result.endpoint.instanceId, processId: result.endpoint.processId }
      : {}),
    ...('error' in result ? { errorCode: result.error?.code, diagnostic } : {}),
  };
}

export async function kernelLifecycleDiagnostics(directory: string) {
  const phases = [
    'loading-application',
    'initializing-application',
    'application-ready',
    'server-listening',
    'endpoint-published',
    'server-closed',
    'lock-released',
  ];
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(join(directory, 'runtime', 'kernel.log'), 'r');
    const size = (await file.stat()).size;
    const buffer = Buffer.alloc(Math.min(size, 65536));
    const { bytesRead } = await file.read(
      buffer,
      0,
      buffer.length,
      Math.max(0, size - buffer.length),
    );
    return buffer
      .subarray(0, bytesRead)
      .toString('utf8')
      .split('\n')
      .flatMap((line) => {
        try {
          const value = JSON.parse(line);
          return phases.includes(value?.phase)
            ? [
                {
                  phase: value.phase,
                  at: typeof value.at === 'number' ? value.at : undefined,
                  instanceId:
                    typeof value.instanceId === 'string'
                      ? value.instanceId.slice(0, 256)
                      : undefined,
                  processId: typeof value.processId === 'number' ? value.processId : undefined,
                },
              ]
            : [];
        } catch {
          return [];
        }
      })
      .slice(-64);
  } catch {
    return [];
  } finally {
    await file?.close().catch(() => {});
  }
}

export async function runKernel(
  directory: string,
  command: 'start' | 'status' | 'stop',
): Promise<BootstrapResult> {
  const started = Date.now();
  let failure: { code?: unknown; signal?: unknown; killed?: boolean } | undefined;
  let stdout: string;
  try {
    ({ stdout } = await execute(
      process.execPath,
      [cliPath, command, '--data-dir', directory, '--connection-info'],
      { timeout: 20_000 },
    ));
  } catch (error) {
    stdout = (error as { stdout?: string }).stdout ?? '';
    failure = error as typeof failure;
  }
  let result: unknown;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw new Error(
      `Kernel CLI did not return JSON.\n${JSON.stringify({ phase: 'cli-result', command, elapsedMs: Date.now() - started, stdoutBytes: Buffer.byteLength(stdout), exitCode: typeof failure?.code === 'number' ? failure.code : undefined, signal: failure?.signal, killed: failure?.killed })}`,
    );
  }
  if (!isBootstrapResult(result)) throw new Error('Invalid kernel command output');
  return result;
}

export async function runningKernel(directory: string): Promise<KernelEndpoint> {
  const result = await runKernel(directory, 'start');
  if (result.state !== 'running') throw new Error(JSON.stringify(result));
  return result.endpoint;
}

export async function isolatedKernel<T>(use: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-test-'));
  try {
    return await use(directory);
  } finally {
    await cleanupKernel(directory);
  }
}

export async function cleanupKernel(directory: string): Promise<void> {
  const result = await runKernel(directory, 'stop');
  if (result.state !== 'stopped') {
    throw new Error(
      `Test-owned kernel could not be confirmed stopped; preserved ${directory}\n${JSON.stringify({ kernel: kernelResultSummary(result), lifecycle: await kernelLifecycleDiagnostics(directory) })}`,
    );
  }
  await rm(directory, { recursive: true });
}
