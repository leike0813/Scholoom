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
          'preparationMs',
          'spawnedAt',
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

const lifecyclePhases = [
  'preparing-runtime',
  'runtime-prepared',
  'lock-busy',
  'loading-application',
  'initializing-application',
  'initializing-library',
  'library-initialized',
  'initializing-projects',
  'projects-initialized',
  'initializing-program-records',
  'program-records-initialized',
  'initializing-program-environments',
  'program-environments-initialized',
  'initializing-harness',
  'harness-initialized',
  'initializing-research',
  'research-initialized',
  'application-ready',
  'server-listening',
  'endpoint-published',
  'server-closed',
  'lock-released',
];

function lifecycleRecord(line: Buffer) {
  try {
    const value = JSON.parse(line.toString('utf8'));
    if (!lifecyclePhases.includes(value?.phase)) return;
    return {
      phase: value.phase as string,
      at: Number.isFinite(value.at) ? (value.at as number) : undefined,
      instanceId: typeof value.instanceId === 'string' ? value.instanceId.slice(0, 256) : undefined,
      processId: Number.isSafeInteger(value.processId) ? (value.processId as number) : undefined,
    };
  } catch {
    // Raw stderr, incomplete JSON and private payloads are never retained.
  }
}

/** One bounded projection for file tails and live stderr; input is always drained. */
export function createKernelLifecycleDiagnostics() {
  const records: { value: NonNullable<ReturnType<typeof lifecycleRecord>>; bytes: number }[] = [];
  let retainedBytes = 0;
  let pending = Buffer.alloc(0);
  let discarding = false;
  let discardedLines = 0;
  let discardedRecords = 0;
  const consume = () => {
    const value = lifecycleRecord(pending);
    if (!value) {
      discardedLines++;
      return;
    }
    const bytes = Buffer.byteLength(JSON.stringify(value)) + 1;
    while (records.length >= 64 || retainedBytes + bytes > 32768 - 2) {
      const removed = records.shift();
      if (!removed) break;
      retainedBytes -= removed.bytes;
      discardedRecords++;
    }
    records.push({ value, bytes });
    retainedBytes += bytes;
  };
  return {
    write(chunk: Buffer) {
      let offset = 0;
      while (offset < chunk.length) {
        const newline = chunk.indexOf(10, offset);
        const end = newline === -1 ? chunk.length : newline;
        if (!discarding) {
          if (pending.length + end - offset > 4096) {
            pending = Buffer.alloc(0);
            discarding = true;
            discardedLines++;
          } else {
            pending = Buffer.concat([pending, chunk.subarray(offset, end)]);
          }
        }
        if (newline === -1) break;
        if (!discarding) consume();
        pending = Buffer.alloc(0);
        discarding = false;
        offset = newline + 1;
      }
    },
    end() {
      if (!discarding && pending.length) consume();
      pending = Buffer.alloc(0);
      discarding = false;
    },
    snapshot() {
      return {
        records: records.map(({ value }) => ({ ...value })),
        discardedLines,
        discardedRecords,
      };
    },
  };
}

export async function kernelLifecycleDiagnostics(directory: string) {
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
    const diagnostics = createKernelLifecycleDiagnostics();
    diagnostics.write(buffer.subarray(0, bytesRead));
    diagnostics.end();
    return diagnostics.snapshot().records;
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
