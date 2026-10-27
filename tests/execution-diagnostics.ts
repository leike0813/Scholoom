import { channel } from 'node:diagnostics_channel';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { expect, type TestInfo, test } from '@playwright/test';
import type { KernelApplication } from '../apps/kernel/dist/application.js';
import type { RunInstance } from '../packages/harness/dist/node.js';
import type { DelegationRecord } from '../packages/protocol/dist/harness.js';
import type { ModelServer } from './model-server.js';

const Database = createRequire(new URL('../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);

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
  const started = performance.now();
  const modelRequestsAtStart = model.requests.length;
  const samples: Record<string, unknown>[] = [];
  const children: Record<string, unknown>[] = [];
  const controls: Record<string, unknown>[] = [];
  const stages: { elapsedMs: number; name: string; modelRequests: number }[] = [];
  let droppedSamples = 0;
  let droppedChildren = 0;
  let droppedStages = 0;
  let droppedControls = 0;
  let stopped = false;
  let snapshotTimedOut = false;
  let inFlight: Promise<string | undefined> | undefined;
  let database: InstanceType<typeof Database> | undefined;
  const identity = (value: string | undefined) => value?.slice(0, 128);
  const remember = (sample: Record<string, unknown>) => {
    if (samples.length === 32) {
      samples.splice(1, 1);
      droppedSamples++;
    }
    samples.push(sample);
  };
  try {
    database = new Database(join(app.projects.get(scope.projectId).internal, 'project.sqlite'), {
      readonly: true,
      fileMustExist: true,
      timeout: 0,
    });
  } catch {
    remember({ elapsedMs: 0, samplingError: 'databaseUnavailable' });
  }
  let failure: { elapsedMs: number; sample: Record<string, unknown> | undefined } | undefined;
  const markFailure = () => {
    failure ??= { elapsedMs: Math.round(performance.now() - started), sample: samples.at(-1) };
  };
  const sample = (): Promise<string | undefined> => {
    if (stopped || snapshotTimedOut) return Promise.resolve(undefined);
    if (inFlight) return inFlight;
    inFlight = (async () => {
      let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
      let state: string | undefined;
      try {
        const snapshot = await Promise.race([
          app.snapshot(scope),
          new Promise<undefined>((resolve) => {
            timer = globalThis.setTimeout(() => resolve(undefined), 500);
          }),
        ]);
        if (!snapshot) {
          snapshotTimedOut = true;
          remember({
            elapsedMs: Math.round(performance.now() - started),
            samplingError: 'snapshotTimeout',
          });
          return undefined;
        }
        state = snapshot.run?.state;
        const rows = database
          ? (database
              .prepare(
                'SELECT i.value FROM run_instances i JOIN runs r ON r.id=i.run_id WHERE r.sessionId=? ORDER BY i.rowid DESC LIMIT 100',
              )
              .all(scope.sessionId) as { value: string }[])
          : [];
        const instances = rows.slice(0, 32).map(({ value }) => {
          const item = JSON.parse(value) as RunInstance;
          return {
            instanceId: identity(item.instanceId),
            runId: identity(item.runId),
            parentInstanceId: identity(item.parentInstanceId),
            hostInstanceId: identity(item.hostInstanceId),
            processId: item.processId,
            state: item.state,
          };
        });
        const delegationRows = database
          ? (database
              .prepare(
                'SELECT value FROM delegations WHERE session_id=? ORDER BY seq DESC LIMIT 17',
              )
              .all(scope.sessionId) as { value: string }[])
          : [];
        const delegations = delegationRows.slice(0, 16).map(({ value }) => {
          const item = JSON.parse(value) as DelegationRecord;
          return {
            id: identity(item.id),
            parentRunId: identity(item.parentRunId),
            parentInstanceId: identity(item.parentInstanceId),
            childInstanceId: identity(item.childInstanceId),
            childProcessId: item.childProcessId,
            state: item.state,
            resultState: item.resultState,
          };
        });
        remember({
          elapsedMs: Math.round(performance.now() - started),
          run: snapshot.run ? { id: identity(snapshot.run.id), state: snapshot.run.state } : null,
          modelRequests: model.requests.length,
          instructions: snapshot.messages
            .filter((m) => m.role === 'user')
            .slice(-16)
            .map((m) => ({ id: identity(m.id), state: m.state })),
          tools: snapshot.messages
            .filter((m) => m.role === 'tool')
            .slice(-16)
            .map((m) => ({
              id: identity(m.id),
              name: identity(m.tool?.name),
              delegationId: identity(m.tool?.delegationId),
              state: m.state,
            })),
          instances,
          instancesTruncated: rows.length > 32,
          delegations,
          delegationsTruncated: delegationRows.length > 16,
        });
        return state;
      } catch (error) {
        remember({
          elapsedMs: Math.round(performance.now() - started),
          samplingError:
            error && typeof error === 'object' && 'code' in error
              ? String(error.code).slice(0, 64)
              : 'unavailable',
        });
        return state;
      } finally {
        globalThis.clearTimeout(timer);
      }
    })().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
  const executionTopic = channel('scholoom.harness.execution');
  const observeControl = (message: unknown) => {
    const value = message as {
      instanceId?: unknown;
      phase?: unknown;
      errorCode?: unknown;
      controllerCode?: unknown;
      controllerSignal?: unknown;
    } | null;
    if (typeof value?.instanceId !== 'string' || typeof value.phase !== 'string') return;
    try {
      const row = database
        ?.prepare(
          'SELECT i.run_id, i.value FROM run_instances i JOIN runs r ON r.id=i.run_id WHERE i.id=? AND r.sessionId=? LIMIT 1',
        )
        .get(value.instanceId, scope.sessionId) as { run_id: string; value: string } | undefined;
      if (!row) return;
      const elapsedMs = Math.round(performance.now() - started);
      if (value.phase === 'onStart.response') {
        const instance = JSON.parse(row.value) as RunInstance;
        if (children.length === 32) droppedChildren++;
        else
          children.push({
            instanceId: identity(value.instanceId),
            runId: identity(row.run_id),
            processId: instance.processId,
            onStartMs: elapsedMs,
          });
      } else if (value.phase === 'controller.exit') {
        const child = children.find((item) => item.instanceId === value.instanceId);
        if (child)
          Object.assign(child, {
            controllerExitedMs: elapsedMs,
            controllerCode:
              value.controllerCode === null || Number.isSafeInteger(value.controllerCode)
                ? value.controllerCode
                : undefined,
            controllerSignal:
              value.controllerSignal === null
                ? null
                : typeof value.controllerSignal === 'string'
                  ? value.controllerSignal.slice(0, 64)
                  : undefined,
          });
      }
      if (controls.length === 32) {
        controls.splice(1, 1);
        droppedControls++;
      }
      controls.push({
        elapsedMs,
        instanceId: identity(value.instanceId),
        runId: identity(row.run_id),
        phase: value.phase.slice(0, 64),
        ...(typeof value.errorCode === 'string' ? { errorCode: value.errorCode.slice(0, 64) } : {}),
      });
      void sample();
    } catch {
      droppedControls++;
    }
  };
  executionTopic.subscribe(observeControl);
  const unsubscribe = app.subscribe((change) => {
    if (
      (!change.projectId || change.projectId === scope.projectId) &&
      (!change.sessionId || change.sessionId === scope.sessionId)
    )
      void sample();
  });
  void sample();
  let stopping: Promise<void> | undefined;
  const stop = () =>
    (stopping ??= (async () => {
      unsubscribe();
      executionTopic.unsubscribe(observeControl);
      await inFlight;
      await sample();
      stopped = true;
      try {
        database?.close();
      } catch {
        remember({ samplingError: 'databaseCloseFailed' });
      }
    })());
  const info = test.info();
  const captures = pending.get(info) ?? new Set();
  pending.set(info, captures);
  const body = () => {
    const payload = () =>
      JSON.stringify({
        platform: process.platform,
        ...scope,
        modelRequestsAtStart,
        samples,
        children,
        controls,
        stages,
        droppedSamples,
        droppedChildren,
        droppedStages,
        droppedControls,
        failure,
        snapshotTimedOut,
      });
    while (Buffer.byteLength(payload()) > 256 * 1024 && samples.length > 2) {
      samples.splice(1, 1);
      droppedSamples++;
    }
    return payload();
  };
  let flushed: Promise<void> | undefined;
  const capture = {
    flush: async (save: boolean) => {
      flushed ??= (async () => {
        await stop();
        captures.delete(capture);
        if (!captures.size) pending.delete(info);
        if (save)
          await info.attach('execution-stages', { body: body(), contentType: 'application/json' });
      })();
      return flushed;
    },
  };
  captures.add(capture);
  const mark = (name: string) => {
    if (stages.length === 16) {
      droppedStages++;
      return;
    }
    stages.push({
      elapsedMs: Math.round(performance.now() - started),
      name: name.slice(0, 64),
      modelRequests: model.requests.length,
    });
    void sample();
  };
  return { sample, stop, failure: markFailure, mark, flush: capture.flush };
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
