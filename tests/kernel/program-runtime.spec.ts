import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';
import { type ProgramPorts, ProgramRuns } from '../../packages/programs/dist/node.js';
import type { StoredProgramRun } from '../../packages/programs/src/records.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import { OperationError } from '../../packages/protocol/dist/core.js';

const context: CallContext = {
  moduleId: 'product',
  role: 'product',
  principal: { kind: 'human', id: 'local' },
};
const input = {
  projectId: 'project',
  operationId: 'operation',
  environmentId: 'node',
  entry: {
    ref: { source: 'project' as const, projectId: 'project', fileId: 'code' },
    basis: 'basis',
  },
};
function fixture() {
  const records = new Map<string, StoredProgramRun>();
  let launches = 0;
  const ports: ProgramPorts = {
    records: () => ({
      get(id) {
        const value = records.get(id);
        assert(value);
        return structuredClone(value);
      },
      findOperation(id, principal) {
        return structuredClone(
          [...records.values()].find(
            (value) => value.run.operationId === id && value.run.principal?.id === principal.id,
          ),
        );
      },
      put(value) {
        records.set(value.run.programRunId, structuredClone(value));
      },
      list() {
        return { runs: [...records.values()].map((item) => structuredClone(item.run)) };
      },
      unfinished() {
        return [...records.values()]
          .filter((item) => ['queued', 'running', 'cancelling', 'unknown'].includes(item.run.state))
          .map((value) => structuredClone(value));
      },
      close() {},
    }),
    async check() {},
    available() {},
    async describe(evidence) {
      return {
        ref: evidence.ref,
        basis: evidence.basis,
        path: 'program.mjs',
        name: 'program.mjs',
        format: 'text',
        capabilities: { read: true, write: true, render: false, readingRecords: false },
      };
    },
    async output() {
      throw new OperationError('notFound', 'missing');
    },
    async mkdir() {},
    async launch() {
      launches++;
      return 'command';
    },
    async cancel() {},
    environment() {
      return { executableId: 'node', executable: '/registered/node' };
    },
    changed() {},
    retainUnknown() {},
    prepareHandoff() {
      return () => {};
    },
  };
  const runs = new ProgramRuns(ports);
  return {
    runs,
    ports,
    records,
    get launches() {
      return launches;
    },
  };
}

test('cancelling while code is being described prevents subsequent program dispatch', async () => {
  const f = fixture();
  let release = () => {};
  let entered = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const describe = f.ports.describe;
  f.ports.describe = async (...args) => {
    entered();
    await gate;
    return describe(...args);
  };
  try {
    const starting = f.runs.start(input, context);
    await waiting;
    const accepted = await f.runs.run({ projectId: 'project', operationId: 'operation' }, context);
    expect(
      (await f.runs.cancel({ projectId: 'project', programRunId: accepted.programRunId }, context))
        .state,
    ).toBe('cancelling');
    release();
    expect((await starting).state).toBe('cancelled');
    expect(f.launches).toBe(0);
  } finally {
    release();
    await f.runs.close();
  }
});

test('handoff authorization storage failure preserves parent ownership', async () => {
  const f = fixture();
  const agent: CallContext = {
    ...context,
    role: 'execution',
    principal: { kind: 'agent', id: 'session' },
    projectId: 'project',
    sessionId: 'session',
    runId: 'parent',
    instanceId: 'instance',
    workDomain: { kind: 'project', projectId: 'project', sessionId: 'session' },
  };
  let detached = false;
  f.ports.prepareHandoff = () => () => {
    detached = true;
  };
  const original = f.ports.records;
  f.ports.records = (projectId) => ({
    ...original(projectId),
    put(value) {
      if (value.run.backgroundOwner)
        throw new OperationError('unavailable', 'synthetic receipt failure');
      original(projectId).put(value);
    },
  });
  const accepted = await f.runs.start(input, agent);
  const identity = { projectId: 'project', programRunId: accepted.programRunId };
  for (const [seq, kind] of ['intent', 'started'].entries())
    await f.runs.event({
      ...identity,
      commandInstanceId: 'command',
      hostInstanceId: 'host',
      seq,
      event: { kind: kind as 'intent' | 'started' },
    });
  try {
    await expect(f.runs.handoff(identity, context)).rejects.toMatchObject({ code: 'unavailable' });
    expect(detached).toBe(false);
    expect((await f.runs.run(identity, context)).backgroundOwner).toBeUndefined();
  } finally {
    await f.runs.event({
      ...identity,
      commandInstanceId: 'command',
      hostInstanceId: 'host',
      seq: 2,
      event: { kind: 'exited', code: 0 },
    });
    await f.runs.event({
      ...identity,
      commandInstanceId: 'command',
      hostInstanceId: 'host',
      seq: 3,
      event: { kind: 'stopped' },
    });
    await f.runs.close();
  }
});

for (const boundary of ['parent-abort', 'takeover-failure', 'completion-write'] as const) {
  test(`handoff ${boundary} keeps authorization and actual ownership distinguishable`, async () => {
    const f = fixture();
    const parent = new AbortController();
    const agent: CallContext = {
      ...context,
      role: 'execution',
      principal: { kind: 'agent', id: 'session' },
      projectId: 'project',
      sessionId: 'session',
      runId: 'parent',
      instanceId: 'instance',
      workDomain: { kind: 'project', projectId: 'project', sessionId: 'session' },
      signal: parent.signal,
    };
    let committed = false;
    let failing = true;
    f.ports.prepareHandoff = () => {
      parent.signal.throwIfAborted();
      return () => {
        parent.signal.throwIfAborted();
        if (boundary === 'takeover-failure')
          throw new OperationError('instanceMismatch', 'synthetic lost controller');
        committed = true;
      };
    };
    const records = f.ports.records;
    f.ports.records = (projectId) => ({
      ...records(projectId),
      put(value) {
        if (
          failing &&
          boundary === 'completion-write' &&
          value.run.backgroundOwner?.state === 'active'
        )
          throw new OperationError('unavailable', 'synthetic completion receipt failure');
        records(projectId).put(value);
        if (
          failing &&
          boundary === 'parent-abort' &&
          value.run.backgroundOwner?.state === 'authorized'
        )
          parent.abort(new OperationError('shuttingDown', 'parent cancelled'));
      },
    });
    const accepted = await f.runs.start(input, agent);
    const identity = { projectId: 'project', programRunId: accepted.programRunId };
    const observation = { ...identity, commandInstanceId: 'command', hostInstanceId: 'host' };
    await f.runs.event({ ...observation, seq: 0, event: { kind: 'intent' } });
    await f.runs.event({ ...observation, seq: 1, event: { kind: 'started' } });
    try {
      await expect(f.runs.handoff(identity, context)).rejects.toMatchObject({
        code:
          boundary === 'parent-abort'
            ? 'shuttingDown'
            : boundary === 'takeover-failure'
              ? 'instanceMismatch'
              : 'outcomeUnknown',
      });
      const persisted = f.records.get(accepted.programRunId)?.run.backgroundOwner;
      const current = (await f.runs.run(identity, context)).backgroundOwner;
      expect(committed).toBe(boundary === 'completion-write');
      expect(persisted?.state).toBe(boundary === 'completion-write' ? 'authorized' : 'failed');
      expect(current?.state).toBe(boundary === 'completion-write' ? 'active' : 'failed');
      expect(current?.error?.code).toBe(
        boundary === 'completion-write'
          ? 'outcomeUnknown'
          : boundary === 'parent-abort'
            ? 'shuttingDown'
            : 'instanceMismatch',
      );
    } finally {
      failing = false;
      await f.runs.event({ ...observation, seq: 2, event: { kind: 'exited', code: 0 } });
      await f.runs.event({ ...observation, seq: 3, event: { kind: 'stopped' } });
      await f.runs.close();
    }
  });
}

test('parent exit still sees persistent unknown ownership after live monitoring has ended', async () => {
  const f = fixture();
  const agent: CallContext = {
    moduleId: 'harness',
    role: 'execution',
    principal: { kind: 'agent', id: 'session' },
    projectId: 'project',
    sessionId: 'session',
    runId: 'parent',
    instanceId: 'instance',
    workDomain: { kind: 'project', projectId: 'project', sessionId: 'session' },
  };
  try {
    const accepted = await f.runs.start(input, agent);
    for (const [seq, event] of [
      [0, { kind: 'intent' as const }],
      [1, { kind: 'started' as const }],
      [
        2,
        {
          kind: 'unknown' as const,
          error: { code: 'outcomeUnknown' as const, message: 'controller lost' },
        },
      ],
    ] as const)
      await f.runs.event({
        programRunId: accepted.programRunId,
        hostInstanceId: 'host',
        commandInstanceId: 'command',
        seq,
        event,
      });
    await expect(f.runs.settleExecution(agent)).rejects.toMatchObject({ code: 'outcomeUnknown' });
    expect(
      (await f.runs.run({ projectId: 'project', programRunId: accepted.programRunId }, context))
        .stop,
    ).toBe('unknown');
  } finally {
    await expect(f.runs.close()).rejects.toMatchObject({ code: 'outcomeUnknown' });
  }
});

test('a failed observation stays unknown and prevents project release and new dispatch', async () => {
  const f = fixture();
  const accepted = await f.runs.start(input, context);
  f.runs.observationFailed(
    accepted.programRunId,
    new OperationError('unavailable', 'storage failed'),
  );
  expect(
    (await f.runs.run({ projectId: 'project', programRunId: accepted.programRunId }, context))
      .state,
  ).toBe('unknown');
  expect((await f.runs.list({ projectId: 'project' }, context)).runs[0]?.state).toBe('unknown');
  await expect(f.runs.releaseProject('project')).rejects.toMatchObject({ code: 'outcomeUnknown' });
  expect(() => f.runs.assertIdle('project')).toThrow();
  await expect(f.runs.start({ ...input, operationId: 'second' }, context)).rejects.toMatchObject({
    code: 'outcomeUnknown',
  });
  await expect(f.runs.close()).rejects.toMatchObject({ code: 'outcomeUnknown' });
});
