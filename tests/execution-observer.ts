import { channel } from 'node:diagnostics_channel';
import { createRequire } from 'node:module';
import { constants } from 'node:os';
import { join } from 'node:path';
import type { KernelApplication } from '../apps/kernel/dist/application.js';
import type { RunInstance } from '../packages/harness/dist/node.js';
import { errorInfoSchema } from '../packages/protocol/dist/core.js';
import type { DelegationRecord } from '../packages/protocol/dist/harness.js';

const Database = createRequire(new URL('../apps/kernel/package.json', import.meta.url))(
  'better-sqlite3',
);
const phases = new Set([
  'onStart.response',
  'controller.exit',
  'model.output',
  'execution.initialize.sent',
  'execution.initialize.response',
  'execution.initialize.rejected',
  ...['execution.beforeModel', 'execution.consume', 'model.acquire'].flatMap((method) =>
    ['request', 'response', 'rejected'].map((state) => `${method}.${state}`),
  ),
]);
const startupPhases = new Set([
  'schedule.admission.request',
  'schedule.admission.response',
  'schedule.admission.rejected',
  'execution.prepare.request',
  'execution.prepare.rejected',
  'execution.stream.request',
  'remote.prepare.request',
  'worker.start.request',
  'worker.start.response',
  'worker.start.rejected',
  'onStart.request',
  'onStart.rejected',
]);
const errorCodes: ReadonlySet<string> = new Set(errorInfoSchema.properties.code.enum);
const observationCodes: ReadonlySet<string> = new Set([
  ...errorCodes,
  ...Object.keys(constants.errno),
]);

export function observationErrorCode(error: unknown): string | undefined {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && observationCodes.has(code) ? code : undefined;
}

export function createExecutionObserver(
  app: KernelApplication,
  scope: { projectId: string; sessionId: string },
  readModelRequests?: () => number,
) {
  const started = performance.now();
  const startedAt = Date.now();
  const modelRequestsAtStart = readModelRequests?.() ?? null;
  const samples: Record<string, unknown>[] = [];
  const children: Record<string, unknown>[] = [];
  const controls: Record<string, unknown>[] = [];
  const startup: Record<string, unknown>[] = [];
  const stages: { elapsedMs: number; name: string; modelRequests: number | null }[] = [];
  let droppedSamples = 0;
  let droppedChildren = 0;
  let droppedStages = 0;
  let droppedControls = 0;
  let droppedStartup = 0;
  let unverifiedStartup = 0;
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
          modelRequests: readModelRequests?.() ?? null,
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
          samplingError: observationErrorCode(error) ?? 'unavailable',
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
      projectId?: unknown;
      sessionId?: unknown;
      runId?: unknown;
      requestedInstanceId?: unknown;
      instanceId?: unknown;
      phase?: unknown;
      errorCode?: unknown;
      controllerCode?: unknown;
      controllerSignal?: unknown;
    } | null;
    if (typeof value?.phase === 'string' && startupPhases.has(value.phase)) {
      if (value.projectId !== scope.projectId || value.sessionId !== scope.sessionId) return;
      try {
        if (typeof value.runId !== 'string' || value.runId.length > 128) throw new Error();
        const row = database
          ?.prepare('SELECT id FROM runs WHERE id=? AND sessionId=? LIMIT 1')
          .get(value.runId, scope.sessionId);
        if (!row) throw new Error();
        const instructions = database
          .prepare(
            'SELECT id FROM instructions WHERE runId=? AND sessionId=? ORDER BY seq DESC LIMIT 17',
          )
          .all(value.runId, scope.sessionId) as { id: string }[];
        if (startup.length === 32) {
          startup.splice(1, 1);
          droppedStartup++;
        }
        startup.push({
          elapsedMs: Math.round(performance.now() - started),
          phase: value.phase,
          runId: identity(value.runId),
          instructionIds: instructions.slice(0, 16).map((i) => i.id),
          instructionsTruncated: instructions.length > 16,
          ...(typeof value.requestedInstanceId === 'string' &&
          value.requestedInstanceId.length <= 128
            ? { requestedInstanceId: value.requestedInstanceId }
            : {}),
          ...(typeof value.errorCode === 'string' && errorCodes.has(value.errorCode)
            ? { errorCode: value.errorCode }
            : {}),
        });
        void sample();
      } catch {
        unverifiedStartup++;
      }
      return;
    }
    if (typeof value?.instanceId !== 'string' || typeof value.phase !== 'string') return;
    if (!phases.has(value.phase)) {
      droppedControls++;
      return;
    }
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
        ...(typeof value.errorCode === 'string' && errorCodes.has(value.errorCode)
          ? { errorCode: value.errorCode }
          : {}),
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
  const body = (maxBytes = 256 * 1024) => {
    const payload = () =>
      JSON.stringify({
        platform: process.platform,
        startedAt,
        ...scope,
        modelRequestsAtStart,
        samples,
        children,
        controls,
        startup,
        stages,
        droppedSamples,
        droppedChildren,
        droppedStages,
        droppedControls,
        droppedStartup,
        unverifiedStartup,
        failure,
        snapshotTimedOut,
      });
    while (Buffer.byteLength(payload()) > maxBytes && samples.length > 2) {
      samples.splice(1, 1);
      droppedSamples++;
    }
    while (Buffer.byteLength(payload()) > maxBytes && startup.length > 2) {
      startup.splice(1, 1);
      droppedStartup++;
    }
    for (const entry of startup) {
      const ids = entry.instructionIds as string[];
      while (Buffer.byteLength(payload()) > maxBytes && ids.length) {
        ids.pop();
        entry.instructionsTruncated = true;
        entry.omittedInstructionIds = Number(entry.omittedInstructionIds ?? 0) + 1;
      }
    }
    return payload();
  };
  const mark = (name: string) => {
    if (stages.length === 16) {
      droppedStages++;
      return;
    }
    stages.push({
      elapsedMs: Math.round(performance.now() - started),
      name: name.slice(0, 64),
      modelRequests: readModelRequests?.() ?? null,
    });
    void sample();
  };
  return { sample, stop, failure: markFailure, mark, body };
}
