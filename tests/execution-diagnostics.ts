import { setTimeout } from 'node:timers/promises';
import { expect, type TestInfo, test } from '@playwright/test';
import type { KernelApplication } from '../apps/kernel/dist/application.js';
import { createExecutionObserver } from './execution-observer.js';
import type { ModelServer } from './model-server.js';

const pending = new WeakMap<
  TestInfo,
  Set<{
    flush: (save: boolean) => Promise<void>;
  }>
>();

/** Hooks belong to the importing test file, so install explicitly despite module caching. */
export function installExecutionDiagnostics() {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires fixture destructuring without creating unused fixtures.
  test.afterEach(async ({}, info) => {
    const captures = pending.get(info);
    pending.delete(info);
    if (!captures) return;
    for (const capture of captures)
      await capture.flush(
        info.status !== info.expectedStatus || process.env.SCHOOLOOM_EXECUTION_DIAGNOSTICS === '1',
      );
  });
}

installExecutionDiagnostics();

/** Install before send/first assertion; stop before closing the owning application. */
export function observeExecution(
  app: KernelApplication,
  scope: { projectId: string; sessionId: string },
  model: ModelServer,
) {
  const { body, ...observer } = createExecutionObserver(app, scope, () => model.requests.length);
  const info = test.info();
  const captures = pending.get(info) ?? new Set();
  pending.set(info, captures);
  let flushed: Promise<void> | undefined;
  const capture = {
    flush: async (save: boolean) => {
      flushed ??= (async () => {
        await observer.stop();
        captures.delete(capture);
        if (!captures.size) pending.delete(info);
        if (save)
          await info.attach('execution-stages', { body: body(), contentType: 'application/json' });
      })();
      return flushed;
    },
  };
  captures.add(capture);
  return { ...observer, flush: capture.flush };
}

/** Keep the original completion deadline; the same sampler also supports earlier assertions. */
export async function expectExecutionCompleted(
  app: KernelApplication,
  scope: { projectId: string; sessionId: string },
  model: ModelServer,
): Promise<void> {
  const diagnostics = observeExecution(app, scope, model);
  let failed = false;
  const sample = async () => {
    const state = (await app.snapshot(scope)).run?.state;
    void diagnostics.sample();
    return state;
  };
  try {
    // Cold worker startup and multi-tool execution are not a five-second product SLA.
    await expect.poll(sample, { timeout: 20_000 }).toBe('completed');
  } catch (error) {
    failed = true;
    diagnostics.failure();
    if (process.env.SCHOOLOOM_EXECUTION_DIAGNOSTICS === '1') {
      // Observe progress without changing the original failed verdict or starting another run.
      const deadline = performance.now() + 15_000;
      while (performance.now() < deadline) {
        const state = await diagnostics.sample();
        if (!state || !['queued', 'running', 'cancelling'].includes(state)) break;
        await setTimeout(250);
      }
    }
    throw error;
  } finally {
    await diagnostics.stop();
    if (failed || process.env.SCHOOLOOM_EXECUTION_DIAGNOSTICS === '1')
      await diagnostics.flush(true);
  }
}
