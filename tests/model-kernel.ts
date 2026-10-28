import { type ChildProcess, fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, open, realpath, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { type TestInfo, test } from '@playwright/test';
import { inspectKernel } from '../apps/kernel/dist/lifecycle.js';
import { createKernelClient, type KernelClient } from '../packages/client/dist/index.js';
import { type KernelEndpoint, limits } from '../packages/protocol/dist/index.js';
import { observationErrorCode } from './execution-observer.js';
import { developmentKernelConnectionTimeout } from './kernel-fixture.js';

/** Uses serveKernel and preserves the legacy callable asynchronous stop. */
export async function startModelKernel(
  directory: string,
  endpoint: string,
): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true });
  const canonical = await realpath(directory);
  let info: TestInfo | undefined;
  try {
    info = test.info();
  } catch {
    /* Isolated scripts have no Playwright context. */
  }
  const filename = `model-kernel-${randomUUID()}.json`;
  const artifact = info?.outputPath(filename) ?? join(canonical, filename);
  await mkdir(dirname(artifact), { recursive: true });
  const childArtifact = `${artifact}.child`;
  let child: ChildProcess | undefined;
  let owner: KernelClient | undefined;
  let identity: KernelEndpoint | undefined;
  let ready = false;
  let ended = false;
  let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  let exited: Promise<NonNullable<typeof exit>> | undefined;
  let phase = 'inspect-initial';
  let saved = false;
  let errorCode: string | undefined;
  const persist = async () => {
    if (saved) return;
    saved = true;
    try {
      let execution: unknown;
      let file: Awaited<ReturnType<typeof open>> | undefined;
      try {
        file = await open(childArtifact, 'r');
        const buffer = Buffer.alloc(240 * 1024 + 1);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
        if (bytesRead <= 240 * 1024) {
          const value = JSON.parse(buffer.subarray(0, bytesRead).toString());
          if (value.version === 1 && value.kernelProcessId === child?.pid) execution = value;
        }
      } catch {
        /* Missing observations remain unknown. */
      } finally {
        await file?.close();
      }
      await writeFile(
        artifact,
        JSON.stringify({
          version: 1,
          phase,
          kernelProcessId: child?.pid,
          kernelInstanceId: identity?.instanceId,
          childClosed: ended,
          childExit: exit,
          execution,
          observationUnavailable: execution === undefined,
          errorCode,
        }),
        { mode: 0o600 },
      );
      await info?.attach('model-kernel-execution', {
        path: artifact,
        contentType: 'application/json',
      });
    } catch {
      info?.annotations.push({
        type: 'execution-diagnostic-unavailable',
        description: 'writeFailed',
      });
    }
  };
  const waitForClose = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        exited,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Owned child close is unknown')),
            limits.lifecycleMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const initial = await inspectKernel(canonical);
    if (initial.state === 'running') {
      // Existing isolated UI callers deliberately replace their fixture kernel.
      phase = 'shutdown-previous-instance';
      const previous = createKernelClient(initial.endpoint);
      try {
        await previous.connect();
        await previous.shutdown();
      } finally {
        previous.dispose();
      }
      phase = 'previous-stop-check';
      const deadline = Date.now() + limits.lifecycleMs;
      for (;;) {
        const current = await inspectKernel(canonical);
        if (current.state === 'stopped') break;
        if (
          (current.state === 'running' &&
            current.endpoint.instanceId !== initial.endpoint.instanceId) ||
          Date.now() >= deadline
        )
          throw new Error('Previous isolated kernel stop is unknown');
        await delay(50);
      }
    } else if (initial.state !== 'stopped') throw new Error('Isolated configuration is occupied');
    phase = 'ready-ipc';
    const owned = fork(new URL('./fixtures/model-kernel-process.mjs', import.meta.url), [], {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    child = owned;
    owned.on('error', () => {});
    exited = new Promise((resolve) =>
      owned.once('close', (code, signal) => {
        ended = true;
        exit = { code, signal };
        resolve(exit);
      }),
    );
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = (error?: Error) => {
        clearTimeout(timer);
        owned.off('message', message);
        owned.off('error', failed);
        if (error) reject(error);
        else resolve();
      };
      const message = (value: unknown) => {
        if (!value || typeof value !== 'object' || !('state' in value)) return;
        if (value.state === 'ready') {
          ready = true;
          done();
        } else done(new Error('Owned kernel did not acquire its configuration'));
      };
      const failed = () => done(new Error('Owned kernel process failed'));
      owned.on('message', message);
      owned.on('error', failed);
      void exited?.then(() => done(new Error('Owned kernel closed before ready')));
      timer = setTimeout(
        () => done(new Error('Owned kernel readiness timed out')),
        developmentKernelConnectionTimeout,
      );
      try {
        owned.send(
          {
            directory: canonical,
            endpoint,
            artifact: childArtifact,
            observationMs: Math.min(info?.timeout || 60_000, 120_000),
          },
          (error) => {
            if (error) failed();
          },
        );
      } catch {
        failed();
      }
    });
    phase = 'inspect-owned-endpoint';
    const status = await inspectKernel(canonical);
    if (status.state !== 'running' || status.endpoint.processId !== owned.pid || ended)
      throw new Error('Ready endpoint is not the owned child');
    identity = status.endpoint;
    owner = createKernelClient(identity);
    phase = 'attach-owner';
    await owner.connect();
    const attached = await owner.attachDevelopment();
    if (attached.processId !== owned.pid || attached.instanceId !== identity.instanceId || ended)
      throw new Error('Development owner identity changed');
    let stopping: Promise<void> | undefined;
    const stop = async () => {
      try {
        phase = 'stop-owned-identity';
        const current = await inspectKernel(canonical);
        if (
          !(
            (current.state === 'running' &&
              current.endpoint.instanceId === identity?.instanceId &&
              current.endpoint.processId === owned.pid) ||
            (current.state === 'stopped' && ended)
          )
        )
          throw new Error('Owned kernel cannot be verified');
        phase = 'shutdown-owned-instance';
        if (!ended) await owner?.shutdown();
        phase = 'owned-child-close';
        const closed = await waitForClose();
        if (closed?.code !== 0 || closed.signal !== null)
          throw new Error('Owned serveKernel did not close normally');
        phase = 'configuration-stopped';
        if ((await inspectKernel(canonical)).state !== 'stopped')
          throw new Error('Configuration has a successor');
        phase = 'stopped';
      } catch (error) {
        errorCode = observationErrorCode(error);
        owned.channel?.unref();
        owned.unref();
        throw new Error(`Test-owned kernel stop is unknown at ${phase}`);
      } finally {
        owner?.dispose();
        await persist();
      }
    };
    return () => (stopping ??= stop());
  } catch (error) {
    errorCode = observationErrorCode(error);
    if (child && !ended && !identity) {
      const current = await inspectKernel(canonical).catch(() => undefined);
      if (current?.state === 'running' && current.endpoint.processId === child.pid) {
        identity = current.endpoint;
        owner = createKernelClient(identity);
        await owner.connect().catch(() => {});
      }
    }
    if (identity && owner) {
      try {
        await owner.shutdown();
        await waitForClose();
      } catch {
        /* Keep an unconfirmed accepted execution protected. */
      }
    }
    owner?.dispose();
    if (child && !ready) await waitForClose().catch(() => {});
    child?.channel?.unref();
    child?.unref();
    await persist();
    throw new Error(
      'Test-owned kernel startup failed at ' +
        phase +
        '; child ' +
        (!child ? 'not started' : ended ? 'closed' : 'close unknown'),
    );
  }
}
