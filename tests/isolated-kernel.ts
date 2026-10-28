import { type ChildProcess, fork } from 'node:child_process';
import { realpath, writeFile } from 'node:fs/promises';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { inspectKernel } from '../apps/kernel/dist/lifecycle.js';
import type { IsolatedZotero } from '../apps/kernel/dist/zotero.js';
import { createKernelClient, type KernelClient } from '../packages/client/dist/index.js';
import { type KernelEndpoint, limits } from '../packages/protocol/dist/index.js';
import {
  createKernelLifecycleDiagnostics,
  developmentKernelConnectionTimeout,
  kernelResultSummary,
  runKernel,
} from './kernel-fixture.js';

type ChildExit = { code: number | null; signal: NodeJS.Signals | null };

export type IsolatedKernel = {
  endpoint: KernelEndpoint;
  client: KernelClient;
  child: ChildProcess;
  exited: Promise<ChildExit>;
  stop(): Promise<void>;
};

/** The caller prepares the library and supplies its trusted configuration on every start. */
export async function startIsolatedKernel(
  directory: string,
  configuration: IsolatedZotero,
  entry = new URL('./fixtures/isolated-kernel-process.mjs', import.meta.url),
): Promise<IsolatedKernel> {
  const canonical = await realpath(directory);
  const initial = await inspectKernel(canonical);
  if (initial.state !== 'stopped') {
    throw new Error(
      `Isolated kernel directory is occupied: ${JSON.stringify(kernelResultSummary(initial))}`,
    );
  }
  const child = fork(entry, [], {
    execArgv: [],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    env: {},
  });
  const lifecycle = createKernelLifecycleDiagnostics();
  let stderrFailed = false;
  child.stderr?.on('data', (chunk: Buffer) => lifecycle.write(chunk));
  child.stderr?.once('end', () => lifecycle.end());
  child.stderr?.on('error', () => {
    stderrFailed = true;
  });
  child.on('error', () => {});
  let ended = false;
  let exit: ChildExit | undefined;
  let processExit: ChildExit | undefined;
  child.once('exit', (code, signal) => {
    processExit = { code, signal };
  });
  let readyReceived = false;
  const exitFacts = () => ({
    exitReceived: processExit !== undefined,
    exitCode: processExit?.code ?? null,
    exitSignal: processExit?.signal ?? null,
    closeReceived: ended,
    closeCode: exit?.code ?? null,
    closeSignal: exit?.signal ?? null,
  });
  const unref = () => {
    child.channel?.unref();
    child.unref();
    if (child.stderr instanceof Socket) child.stderr.unref();
  };
  const persist = async (diagnostic: object) => {
    try {
      await writeFile(
        join(canonical, 'isolated-kernel-diagnostics.json'),
        JSON.stringify(diagnostic),
      );
      return true;
    } catch {
      return false;
    }
  };
  const exited = new Promise<ChildExit>((resolve) => {
    child.once('close', (code, signal) => {
      ended = true;
      exit = { code, signal };
      resolve(exit);
    });
  });
  const waitForExit = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        exited,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Owned child exit is unknown')),
            limits.lifecycleMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  let client: KernelClient | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let onMessage: (message: unknown) => void = () => {};
  let onError: () => void = () => {};
  let phase = 'ready-ipc';
  let reason: string | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (failure: string) => {
        if (settled) return;
        settled = true;
        reason = failure;
        reject(new Error('Isolated kernel was not ready'));
      };
      onMessage = (message) => {
        if (typeof message !== 'object' || message === null || !('state' in message)) return;
        if (message.state === 'ready') {
          readyReceived = true;
          if (!settled) {
            settled = true;
            resolve();
          }
        } else fail('notReady');
      };
      onError = () => fail('processOrIpcError');
      child.on('message', onMessage);
      child.on('error', onError);
      void exited.then(() => fail('closedBeforeReady'));
      startupTimer = setTimeout(() => fail('readyTimeout'), developmentKernelConnectionTimeout);
      child.send({ directory: canonical, configuration }, (error) => {
        if (error) onError();
      });
    });
    clearTimeout(startupTimer);
    phase = 'inspect-owned-endpoint';
    const result = await inspectKernel(canonical);
    if (result.state !== 'running' || result.endpoint.processId !== child.pid || ended) {
      throw new Error('Ready endpoint does not identify the owned child');
    }
    const endpoint = result.endpoint;
    client = createKernelClient(endpoint);
    phase = 'connect-owner';
    await client.connect();
    phase = 'attach-owner';
    const attached = await client.attachDevelopment();
    if (attached.processId !== child.pid || ended) {
      throw new Error('Development owner does not identify the owned child');
    }
    const owner = client;
    let stopping: Promise<void> | undefined;
    const stop = async () => {
      let phase = 'inspect-owned-endpoint';
      try {
        const current = await inspectKernel(canonical);
        if (
          !(
            (current.state === 'running' &&
              current.endpoint.instanceId === endpoint.instanceId &&
              current.endpoint.processId === child.pid) ||
            (current.state === 'stopped' && ended)
          )
        ) {
          throw new Error('Owned kernel cannot be verified');
        }
        phase = 'shutdown-owned-instance';
        if (!ended) await owner.shutdown();
        phase = 'child-exit';
        await waitForExit();
        phase = 'cli-status';
        const result = await runKernel(canonical, 'status');
        if (result.state !== 'stopped') {
          throw new Error(
            `Configuration is no longer stopped: ${JSON.stringify(kernelResultSummary(result))}`,
          );
        }
      } catch {
        // Preserve diagnostics without targeting a newly discovered instance or blocking the runner.
        unref();
        const diagnostic = {
          kind: 'stop',
          phase,
          reason: 'stopUnconfirmed',
          processId: child.pid ?? null,
          instanceId: endpoint.instanceId,
          readyReceived,
          killRequested: false,
          ...exitFacts(),
          stderrFailed,
          lifecycle: lifecycle.snapshot(),
        };
        const diagnosticsPersisted = await persist(diagnostic);
        throw new Error(`Isolated kernel stop is unknown at ${phase}; owned profile preserved.`, {
          cause: { ...diagnostic, diagnosticsPersisted },
        });
      } finally {
        owner.dispose();
      }
    };
    return { endpoint, client: owner, child, exited, stop: () => (stopping ??= stop()) };
  } catch {
    client?.dispose();
    const beforeCleanup = {
      at: Date.now(),
      readyReceived,
      ...exitFacts(),
      lastPhase: lifecycle.snapshot().records.at(-1)?.phase ?? null,
    };
    const originalReason =
      reason ??
      ({
        'inspect-owned-endpoint': 'ownerMismatch',
        'connect-owner': 'connectFailed',
        'attach-owner': 'attachFailed',
      }[phase] ||
        'startupUnknown');
    const base = { kind: 'startup', phase, reason: originalReason, processId: child.pid ?? null };
    const beforeCleanupPersisted = await persist({
      ...base,
      beforeCleanup,
      killRequested: false,
      afterCleanup: exitFacts(),
      stderrFailed,
      lifecycle: lifecycle.snapshot(),
    });
    let killRequested = false;
    // Startup failure has no accepted work: terminate only the child we forked, never a discovered PID.
    if (!ended && child.pid !== undefined) {
      killRequested = true;
      child.kill('SIGKILL');
    }
    try {
      await waitForExit();
    } catch {
      if (child.connected) child.disconnect();
      unref();
    }
    const diagnostic = {
      ...base,
      beforeCleanup,
      beforeCleanupPersisted,
      killRequested,
      afterCleanup: exitFacts(),
      stderrFailed,
      lifecycle: lifecycle.snapshot(),
    };
    const diagnosticsPersisted = await persist(diagnostic);
    throw new Error(
      `Isolated kernel startup failed at ${phase}; child exit ${ended ? 'confirmed' : 'unknown'}; owned profile preserved.`,
      { cause: { ...diagnostic, diagnosticsPersisted } },
    );
  } finally {
    clearTimeout(startupTimer);
    child.off('message', onMessage);
    child.off('error', onError);
  }
}
