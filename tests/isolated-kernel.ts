import { type ChildProcess, fork } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { inspectKernel } from '../apps/kernel/dist/lifecycle.js';
import type { IsolatedZotero } from '../apps/kernel/dist/zotero.js';
import { createKernelClient, type KernelClient } from '../packages/client/dist/index.js';
import { type KernelEndpoint, limits } from '../packages/protocol/dist/index.js';
import {
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
): Promise<IsolatedKernel> {
  const canonical = await realpath(directory);
  const initial = await inspectKernel(canonical);
  if (initial.state !== 'stopped') {
    throw new Error(
      `Isolated kernel directory is occupied: ${JSON.stringify(kernelResultSummary(initial))}`,
    );
  }
  const child = fork(new URL('./fixtures/isolated-kernel-process.mjs', import.meta.url), [], {
    execArgv: [],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: {},
  });
  // No pipes to fill, raw stderr to disclose credentials, or unhandled process errors.
  child.on('error', () => {});
  let ended = false;
  const exited = new Promise<ChildExit>((resolve) => {
    child.once('close', (code, signal) => {
      ended = true;
      resolve({ code, signal });
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
  try {
    await new Promise<void>((resolve, reject) => {
      onMessage = (message) => {
        if (typeof message !== 'object' || message === null || !('state' in message)) return;
        if (message.state === 'ready') resolve();
        else reject(new Error('Isolated kernel did not acquire its directory'));
      };
      onError = () => reject(new Error('Isolated kernel process or IPC failed'));
      child.on('message', onMessage);
      child.on('error', onError);
      void exited.then(() => reject(new Error('Isolated kernel exited before ready')));
      startupTimer = setTimeout(
        () => reject(new Error('Isolated kernel readiness timed out')),
        developmentKernelConnectionTimeout,
      );
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
        child.channel?.unref();
        child.unref();
        throw new Error(
          `Isolated kernel stop is unknown at ${phase}; preserved ${canonical} (child ${child.pid})`,
        );
      } finally {
        owner.dispose();
      }
    };
    return { endpoint, client: owner, child, exited, stop: () => (stopping ??= stop()) };
  } catch {
    client?.dispose();
    // Startup failure has no accepted work: terminate only the child we forked, never a discovered PID.
    if (!ended && child.pid !== undefined) child.kill('SIGKILL');
    try {
      await waitForExit();
    } catch {
      if (child.connected) child.disconnect();
      child.unref();
      throw new Error(
        `Isolated kernel startup failed at ${phase}; child exit unknown; preserved ${canonical}`,
      );
    }
    throw new Error(
      `Isolated kernel startup failed at ${phase}; owned child closed; preserved ${canonical}`,
    );
  } finally {
    clearTimeout(startupTimer);
    child.off('message', onMessage);
    child.off('error', onError);
  }
}
