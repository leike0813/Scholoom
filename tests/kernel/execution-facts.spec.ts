import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import type { DelegationRequest } from '../../packages/protocol/dist/harness.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationModel } from '../fixtures/delegation-model.js';

class FactsApplication extends KernelApplication {
  readonly observed: Array<{
    context: CallContext;
    facts: Awaited<ReturnType<KernelApplication['executionFacts']>>;
  }> = [];
  override executionResources(context: CallContext) {
    const resources = super.executionResources(context);
    const observe = async () => {
      this.observed.push({ context, facts: await this.executionFacts(context) });
      expect(await this.executionFacts({ ...context, instanceId: randomUUID() })).toEqual({
        state: 'unknown',
      });
      const { instanceId: _instance, ...missing } = context;
      for (const invalid of [
        missing,
        { ...context, runId: randomUUID() },
        { ...context, signal: AbortSignal.abort() },
      ])
        expect(await this.executionFacts(invalid)).toEqual({ state: 'unknown' });
      await expect(
        this.executionFacts({ ...context, principal: { kind: 'human', id: 'forged' } }),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
      await expect(
        this.modulePort(context, 'kernel').call('harness.executionFacts', {
          instanceId: 'forged',
        } as never),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
    };
    return {
      ...resources,
      read: async (input: Parameters<typeof resources.read>[0]) => {
        await observe();
        return resources.read(input);
      },
      create: async (input: Parameters<typeof resources.create>[0]) => {
        await observe();
        return resources.create(input);
      },
    };
  }
}

test('actual parent and child resource calls expose verified execution facts without inferred instruction authors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-execution-facts-'));
  const work: DelegationRequest = {
    delegationId: randomUUID(),
    roleId: 'worker',
    roleVersion: '1',
    tools: ['resource.read', 'resource.create'],
    workPackage: {
      objective: 'CHILD_DELEGATION',
      requirements: 'Save a real report.',
      materials: [],
      outputs: [{ kind: 'create', path: 'report.md' }],
    },
  };
  const model = await delegationModel(work);
  const profile = join(root, 'profile');
  const settings = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  const app = new FactsApplication(profile, settings);
  try {
    await app.initialize();
    expect(app.available()).not.toContain('harness.executionFacts');
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await app.call('files.save', {
      projectId: project.id,
      path: 'input.md',
      content: 'Original observation: 42.',
    });
    const material = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'input.md' },
    });
    work.workPackage.materials = [{ ref: material.ref, basis: material.basis }];
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const instructionId = randomUUID();
    await app.call('session.send', {
      ...scope,
      instructionId,
      text: 'PARENT_DELEGATION',
      materials: [],
    });
    await expectExecutionCompleted(app, scope, model);
    const delegation = await app.call('delegation.get', {
      ...scope,
      delegationId: work.delegationId,
    });
    expect(
      delegation,
      JSON.stringify({
        report: delegation.report,
        error: delegation.error,
        observed: app.observed,
      }),
    ).toMatchObject({ state: 'completed', resultState: 'available' });
    const parent = app.observed.find(
      (item) => item.context.instanceId === delegation.parentInstanceId,
    );
    const child = app.observed.find(
      (item) => item.context.instanceId === delegation.childInstanceId,
    );
    expect(parent?.facts).toMatchObject({
      state: 'verified',
      ...scope,
      principal: { kind: 'agent', id: session.id },
      instanceId: delegation.parentInstanceId,
      delegation: { state: 'none' },
    });
    expect(child?.facts).toEqual({
      state: 'verified',
      ...scope,
      runId: delegation.parentRunId,
      instanceId: delegation.childInstanceId,
      principal: { kind: 'agent', id: session.id },
      delegation: {
        state: 'verified',
        delegationId: delegation.id,
        parentInstanceId: delegation.parentInstanceId,
        parentRunId: delegation.parentRunId,
      },
      instructionContext: { state: 'unknown', reason: 'notCaptured' },
      tool: { state: 'unknown', reason: 'notBound' },
    });
    expect(await app.harness.executions({ ...scope, instructionId })).toMatchObject({
      runs: [{ id: delegation.parentRunId }],
      instruction: { id: instructionId },
    });
    if (!child) throw new Error('Expected actual child resource context');
    const { signal: _signal, ...previousContext } = child.context;
    expect(await app.executionFacts(previousContext)).toEqual({ state: 'unknown' });
    await app.close();
    const count = model.requests.length;
    const restarted = new KernelApplication(profile, settings);
    try {
      await restarted.initialize();
      expect(await restarted.executionFacts(previousContext)).toEqual({ state: 'unknown' });
      expect(
        (await restarted.call('delegation.get', { ...scope, delegationId: work.delegationId }))
          .artifacts,
      ).toEqual(delegation.artifacts);
      expect(model.requests).toHaveLength(count);
    } finally {
      await restarted.close();
    }
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
