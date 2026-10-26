import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManagedNode, processMayBeAlive } from '../../packages/platform/dist/node.js';
import type { DelegationRequest } from '../../packages/protocol/dist/index.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationModel } from '../fixtures/delegation-model.js';

class CapacityApplication extends KernelApplication {
  occupySpareCapacity() {
    return [this.processes.reserve(), this.processes.reserve(), this.processes.reserve()];
  }
}

test('two owned executions save a real report and the parent reads it without sharing private context', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-agent-delegation-'));
  const request: DelegationRequest = {
    delegationId: randomUUID(),
    roleId: 'worker',
    roleVersion: '1',
    tools: ['resource.read', 'resource.create', 'resource.creation', 'scratch'],
    workPackage: {
      objective: 'CHILD_DELEGATION Read original input and report observations.',
      requirements: 'Save report.md and report actual evidence.',
      materials: [],
      outputs: [{ kind: 'create', path: 'report.md' }],
    },
  };
  const model = await delegationModel(request);
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic-delegation-key' },
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await app.call('files.save', {
      projectId: project.id,
      path: 'input.md',
      content: 'Original observation: 42.',
    });
    const resource = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'input.md' },
    });
    request.workPackage.materials = [{ ref: resource.ref, basis: resource.basis }];
    const profile = await app.call('provider.saveProfile', {
      id: 'child-model',
      name: 'Child model',
      expectedRevision: 0,
      config: { model: 'MiniMax-M2.7' },
    });
    request.modelProfileId = profile.id;
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'PARENT_DELEGATION Parent-only private marker PARENT_PRIVATE_902.',
      materials: [],
    });
    await expectExecutionCompleted(app, scope, model);
    const result = await app.call('delegation.get', {
      ...scope,
      delegationId: request.delegationId,
    });
    await test.info().attach('delegation-result', {
      body: JSON.stringify(
        {
          result,
          tools: (await app.snapshot(scope)).messages
            .filter((item) => item.tool)
            .map((item) => ({
              name: item.tool?.name,
              state: item.state,
              output: item.tool?.output,
            })),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(result, JSON.stringify(result.error)).toMatchObject({
      state: 'completed',
      resultState: 'available',
      report: { findings: 'Observed 42.', unfinished: '', blockers: '' },
    });
    expect(result.childInstanceId).not.toBe(result.parentInstanceId);
    expect(result.childProcessId).toBeGreaterThan(0);
    expect(result.parentProcessId).toBeGreaterThan(0);
    expect(result.childProcessId).not.toBe(result.parentProcessId);
    expect(result.reads).toContainEqual({ ref: resource.ref, basis: resource.basis });
    expect(result.artifacts).toHaveLength(1);
    expect(result.modelProfile).toEqual(profile);
    expect(result.modelConfig).toEqual({ model: 'MiniMax-M2.7' });
    expect(await readFile(join(root, 'project', 'report.md'), 'utf8')).toContain('Observed 42');
    const childRequests = model.requests.filter(
      (body) =>
        Array.isArray(body.tools) &&
        body.tools.some((tool: { name: string }) => tool.name === 'report_delegation'),
    );
    expect(childRequests.length).toBeGreaterThan(1);
    expect(childRequests.every((body) => body.model === 'MiniMax-M2.7')).toBe(true);
    expect(
      childRequests.every((body) => !JSON.stringify(body.messages).includes('PARENT_PRIVATE_902')),
    ).toBe(true);
    const messages = (await app.snapshot(scope)).messages;
    expect(
      messages
        .filter(
          (message) =>
            message.tool?.name === 'read_context_resource' && !message.id.includes(':delegation:'),
        )
        .some((message) => message.tool?.output?.includes('Observed 42')),
    ).toBe(true);
    const listed = await app.call('delegation.list', scope);
    expect(listed.delegations.map((item) => item.id)).toEqual([request.delegationId]);
    await app.call('provider.removeProfile', {
      id: profile.id,
      expectedRevision: profile.revision,
    });
    expect(
      (await app.call('delegation.get', { ...scope, delegationId: request.delegationId }))
        .modelProfile,
    ).toEqual(profile);
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

async function scenario(options: Parameters<typeof delegationModel>[1] = {}) {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-delegation-case-'));
  const request: DelegationRequest = {
    delegationId: randomUUID(),
    roleId: 'worker',
    roleVersion: '1',
    tools: ['resource.read', 'resource.create', 'resource.creation', 'scratch'],
    workPackage: {
      objective: 'CHILD_DELEGATION Read original material.',
      requirements: 'Save the report.',
      materials: [],
      outputs: [{ kind: 'create', path: 'report.md' }],
    },
  };
  const model = await delegationModel(request, options);
  const settings = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  const profile = join(root, 'profile');
  const app = new CapacityApplication(profile, settings);
  await app.initialize();
  const project = await app.call('project.create', {
    path: join(root, 'project'),
    trust: 'trusted',
  });
  await app.call('files.save', {
    projectId: project.id,
    path: 'input.md',
    content: 'Original observation: 42.',
  });
  const resource = await app.call('resources.describe', {
    locator: { source: 'project', projectId: project.id, path: 'input.md' },
  });
  request.workPackage.materials = [{ ref: resource.ref, basis: resource.basis }];
  const session = await app.call('session.create', { projectId: project.id });
  const scope = { projectId: project.id, sessionId: session.id };
  return {
    root,
    app,
    model,
    request,
    resource,
    scope,
    profile,
    settings,
    start: () =>
      app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'PARENT_DELEGATION',
        materials: [],
      }),
    result: () => app.call('delegation.get', { ...scope, delegationId: request.delegationId }),
    close: async () => {
      model.release();
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    },
  };
}

for (const mode of ['forbiddenWrite', 'childMissing', 'repeat', 'conflict'] as const) {
  test(`delegation handles ${mode} without losing actual effects or creating another child`, async () => {
    const f = await scenario({ [mode]: true });
    try {
      await f.start();
      await expectExecutionCompleted(f.app, f.scope, f.model);
      const result = await f.result();
      expect(await readFile(join(f.root, 'project', 'input.md'), 'utf8')).toBe(
        'Original observation: 42.',
      );
      if (mode === 'childMissing') {
        expect(result).toMatchObject({ state: 'completed', resultState: 'missing', artifacts: [] });
        await expect(readFile(join(f.root, 'project', 'report.md'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      } else {
        expect(result, JSON.stringify(result.error)).toMatchObject({
          state: 'completed',
          resultState: 'available',
        });
        expect(result.artifacts).toHaveLength(1);
      }
      expect((await f.app.call('delegation.list', f.scope)).delegations).toHaveLength(1);
      const messages = (await f.app.snapshot(f.scope)).messages;
      if (mode === 'forbiddenWrite')
        expect(
          messages.some((item) => item.tool?.name === 'write_file' && item.state === 'error'),
        ).toBe(true);
      if (mode === 'conflict')
        expect(
          messages.some(
            (item) =>
              item.tool?.name === 'delegate_agent' &&
              item.state === 'error' &&
              item.tool.output?.includes('invalidRequest'),
          ),
        ).toBe(true);
    } finally {
      await f.close();
    }
  });
}

test('cancelling a child stops its actual work and keeps the parent and persisted result usable after restart', async () => {
  const f = await scenario({ childHold: true });
  try {
    await f.start();
    await expect
      .poll(async () => (await f.app.call('delegation.list', f.scope)).delegations[0]?.state)
      .toBe('running');
    await expect.poll(() => f.model.requests.length).toBeGreaterThanOrEqual(3);
    await expect
      .poll(
        async () =>
          (await f.app.snapshot(f.scope)).messages.some(
            (item) =>
              item.tool?.name === 'wait_delegation' &&
              item.tool.output?.includes('"timedOut":true'),
          ),
        { timeout: 20000 },
      )
      .toBe(true);
    expect((await f.result()).state).toBe('running');
    const requested = await f.app.call('delegation.cancel', {
      ...f.scope,
      delegationId: f.request.delegationId,
    });
    expect(['cancelling', 'cancelled']).toContain(requested.state);
    f.model.release();
    await expect.poll(async () => (await f.result()).state).toBe('cancelled');
    await expectExecutionCompleted(f.app, f.scope, f.model);
    const before = await f.result();
    await f.app.close();
    const count = f.model.requests.length;
    const restarted = new KernelApplication(f.profile, f.settings);
    try {
      await restarted.initialize();
      const result = await restarted.call('delegation.get', {
        ...f.scope,
        delegationId: f.request.delegationId,
      });
      expect(result).toEqual(before);
      expect(f.model.requests).toHaveLength(count);
    } finally {
      await restarted.close();
    }
  } finally {
    await f.close();
  }
});

test('parent completion collects its unfinished child instead of leaving background work', async () => {
  const f = await scenario({ parentExit: true });
  try {
    await f.start();
    await expectExecutionCompleted(f.app, f.scope, f.model);
    const result = await f.result();
    expect(result.state).toBe('cancelled');
    const requests = f.model.requests.length;
    await f.app.call('delegation.list', f.scope);
    expect(f.model.requests).toHaveLength(requests);
  } finally {
    await f.close();
  }
});

test('a full host refuses child admission before material reading without deadlocking the parent', async () => {
  const f = await scenario();
  const occupied = f.app.occupySpareCapacity();
  try {
    await f.start();
    await expectExecutionCompleted(f.app, f.scope, f.model);
    expect((await f.app.call('delegation.list', f.scope)).delegations).toEqual([]);
    const messages = (await f.app.snapshot(f.scope)).messages;
    expect(
      messages.some(
        (item) =>
          item.tool?.name === 'delegate_agent' &&
          item.state === 'error' &&
          item.tool.output?.includes('resourceLimit'),
      ),
    ).toBe(true);
    expect(
      f.model.requests.some(
        (body) =>
          Array.isArray(body.tools) &&
          body.tools.some((tool: { name: string }) => tool.name === 'report_delegation'),
      ),
    ).toBe(false);
  } finally {
    for (const reservation of occupied) reservation.release();
    await f.close();
  }
});

test('changed material returns its version error and cannot be reported as a completed saved review', async () => {
  const options: NonNullable<Parameters<typeof delegationModel>[1]> = {};
  const f = await scenario(options);
  options.beforeChild = () =>
    writeFileSync(join(f.root, 'project', 'input.md'), 'New observation: 99.');
  try {
    await f.start();
    await expectExecutionCompleted(f.app, f.scope, f.model);
    const result = await f.result();
    expect(result).toMatchObject({
      state: 'completed',
      resultState: 'missing',
      reads: [],
      artifacts: [],
      report: { blockers: 'contentChanged' },
    });
    expect(await readFile(join(f.root, 'project', 'input.md'), 'utf8')).toBe(
      'New observation: 99.',
    );
  } finally {
    await f.close();
  }
});

test('saved report survives a failed association and an explicit reconciliation never rewrites it', async () => {
  const f = await scenario();
  const project = f.app.projects.get(f.scope.projectId);
  const link = project.linkArtifact.bind(project);
  project.linkArtifact = () => {
    throw new Error('Synthetic association failure');
  };
  try {
    await f.start();
    await expectExecutionCompleted(f.app, f.scope, f.model);
    const result = await f.result();
    expect(result).toMatchObject({ state: 'completed', resultState: 'partial' });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.association?.state).not.toBe('confirmed');
    const before = await readFile(join(f.root, 'project', 'report.md'), 'utf8');
    project.linkArtifact = link;
    const reconciled = await f.app.call('artifacts.reconcile', {
      ...f.scope,
      runId: result.parentRunId,
      paths: ['report.md'],
    });
    expect(reconciled[0]?.state).toBe('linked');
    expect(await readFile(join(f.root, 'project', 'report.md'), 'utf8')).toBe(before);
  } finally {
    project.linkArtifact = link;
    await f.close();
  }
});

test('losing a child controller preserves unknown ownership and blocks unsafe project release', async () => {
  test.skip(process.platform === 'win32', 'POSIX controller fault injection');
  const f = await scenario({ childHold: true });
  const start = ManagedNode.start;
  let owned: ManagedNode | undefined;
  let count = 0;
  ManagedNode.start = async (options) => {
    const child = await start(options);
    if (options.entry.href.endsWith('/execution-worker.js') && ++count === 2) owned = child;
    return child;
  };
  try {
    await f.start();
    await expect.poll(() => f.model.hold, { timeout: 20000 }).toBe(true);
    expect(owned?.identity?.pid).toBeGreaterThan(0);
    const pid = owned!.identity!.pid;
    (Reflect.get(owned!, 'controller') as ChildProcess).kill('SIGKILL');
    await owned!.exited;
    f.app.harness.cancel(f.scope.projectId, f.scope.sessionId);
    f.model.release();
    await expect
      .poll(async () => (await f.app.snapshot(f.scope)).run?.state, { timeout: 20000 })
      .toBe('interrupted');
    expect(await f.result()).toMatchObject({ state: 'interrupted', resultState: 'unknown' });
    await expect.poll(() => processMayBeAlive(pid)).toBe(false);
    await expect(f.app.harness.releaseProject(f.scope.projectId)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
  } finally {
    ManagedNode.start = start;
    await owned?.stop().catch(() => {});
    await f.close();
  }
});
