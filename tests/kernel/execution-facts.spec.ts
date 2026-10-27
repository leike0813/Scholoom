import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import type { DelegationRequest } from '../../packages/protocol/dist/harness.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationModel } from '../fixtures/delegation-model.js';

class FactsApplication extends KernelApplication {
  readonly saved: Array<{ context: CallContext; editId: string | undefined }> = [];
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
        const result = await resources.create(input);
        if (result.state === 'complete') this.saved.push({ context, editId: result.editId });
        return result;
      },
    };
  }
}

test('actual parent and child resource calls expose verified execution facts without inferred instruction authors', async () => {
  const root = test.info().outputPath('execution-facts');
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
  const model = await delegationModel(work, { parentSave: true });
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
    for (const [path, instanceId] of [
      ['parent.md', delegation.parentInstanceId],
      ['report.md', delegation.childInstanceId],
    ] as const) {
      const file = await app.call('files.read', { projectId: project.id, path });
      if (!file.fileId) throw new Error('Expected stable saved file');
      const changes = await app.call('files.changes', {
        projectId: project.id,
        fileId: file.fileId,
      });
      const editId = changes.changes[0]!.editId;
      const edit = await app.call('files.edit', {
        projectId: project.id,
        fileId: file.fileId,
        editId,
      });
      expect(edit.origin).toMatchObject({
        kind: 'execution',
        ...scope,
        runId: delegation.parentRunId,
        instanceId,
        principal: { kind: 'agent', id: session.id },
        instructionContext: { state: 'unknown' },
        tool: { state: 'unknown' },
      });
      const resource = await app.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path },
      });
      expect(edit.afterEvidence?.basis).toBe(resource.basis);
      if (path === 'report.md') {
        expect(edit.origin).toMatchObject({
          delegation: {
            delegationId: delegation.id,
            parentRunId: delegation.parentRunId,
            parentInstanceId: delegation.parentInstanceId,
          },
        });
        expect(app.saved).toContainEqual({ context: child!.context, editId });
        const fileScope = { projectId: project.id, fileId: file.fileId };
        const originalBytes = await readFile(join(project.path, path));
        const requestsBeforeUndo = model.requests.length;
        const runBeforeUndo = (await app.snapshot(scope)).run?.id;
        const human = await app.call('files.save', {
          projectId: project.id,
          path,
          basis: file.basis,
          content: '# Report\n\nHuman overlapping correction.\n',
        });
        expect(human).toMatchObject({
          fileId: file.fileId,
          origin: { kind: 'human' },
          before: edit.after,
          beforeEvidence: edit.afterEvidence,
        });
        await expect(
          app.call('files.undo', { projectId: project.id, editId }),
        ).rejects.toMatchObject({ code: 'contentChanged' });
        expect(await readFile(join(project.path, path), 'utf8')).toBe(human.after);
        const undone = await app.call('files.undo', { projectId: project.id, editId: human.id });
        expect(undone).toMatchObject({
          fileId: file.fileId,
          origin: { kind: 'human' },
          before: human.after,
          after: edit.after,
          beforeEvidence: human.afterEvidence,
          revertsEditId: human.id,
        });
        expect(await readFile(join(project.path, path))).toEqual(originalBytes);
        const restored = await app.call('resources.describe', { locator: resource.ref });
        expect(undone.afterEvidence).toEqual({ ref: resource.ref, basis: restored.basis });
        const history = await app.call('files.changes', { ...fileScope, afterEditId: editId });
        expect(history).toMatchObject({
          changes: [
            { editId: undone.id, fileId: file.fileId, revertsEditId: human.id },
            { editId: human.id, fileId: file.fileId, origin: { kind: 'human' } },
          ],
          coverage: { anchor: 'matched', current: 'matchesLatest' },
        });
        expect(await app.call('files.edit', { ...fileScope, editId })).toEqual(edit);
        expect(await app.call('files.edit', { ...fileScope, editId: undone.id })).toEqual(undone);
        expect((await app.snapshot(scope)).run?.id).toBe(runBeforeUndo);
        expect(model.requests).toHaveLength(requestsBeforeUndo);
        await test.info().attach('delegation-file-history', {
          body: JSON.stringify({ scope, delegation, childEdit: edit, human, undone, history }),
          contentType: 'application/json',
        });
      } else expect(edit.origin && 'delegation' in edit.origin).toBe(false);
    }
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
  }
});
