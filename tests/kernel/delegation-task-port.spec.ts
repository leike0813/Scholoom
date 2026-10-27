import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { DelegationRequest } from '../../packages/protocol/dist/index.js';
import type { TaskMetadata } from '../../packages/protocol/dist/projects.js';
import { expectExecutionCompleted } from '../execution-diagnostics.js';
import { delegationModel } from '../fixtures/delegation-model.js';

for (const scenario of ['complete', 'materialChanged', 'linkConflict', 'cancel'] as const) {
  test(`real TaskPort and bounded worker keep task association separate: ${scenario}`, async () => {
    const root = test.info().outputPath('task-delegation');
    const taskId = randomUUID();
    const workItemId = 'check-observation';
    const metadata: TaskMetadata = {
      kind: 'research-task',
      formatVersion: 1,
      id: taskId,
      title: 'Synthetic observation',
      status: 'active',
      workItems: [{ id: workItemId, title: 'Check original observation' }],
    };
    const content = `---\n${JSON.stringify(metadata)}\n---\n\nOriginal observation: 42.\n`;
    const request: DelegationRequest = {
      delegationId: randomUUID(),
      roleId: 'worker',
      roleVersion: '1',
      tools: ['resource.read', 'resource.create', 'resource.creation'],
      workPackage: {
        objective: 'CHILD_DELEGATION',
        requirements: 'Read the original task and save report.md.',
        materials: [],
        outputs: [{ kind: 'create', path: 'report.md' }],
      },
    };
    // Task identity is assigned by the real owner before any model request.
    const task = { projectId: '', taskId, fileId: '' };
    let paused = false;
    let release!: () => void;
    const resumed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const model = await delegationModel(request, {
      task: {
        ref: task,
        workItemId,
        pause: async () => {
          paused = true;
          await resumed;
        },
        ...(scenario === 'materialChanged'
          ? { gate: 'material' as const }
          : scenario === 'linkConflict' || scenario === 'cancel'
            ? { gate: 'link' as const }
            : {}),
      },
    });
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const created = await app.call('tasks.create', {
        projectId: project.id,
        operationId: randomUUID(),
        path: `tasks/${taskId}.task.md`,
        content,
      });
      assert(created.state === 'complete' && created.resource.ref.source === 'project');
      Object.assign(task, { projectId: project.id, fileId: created.resource.ref.fileId });
      const original = await app.call('tasks.read', { task });
      const session = await app.call('session.create', { projectId: project.id });
      const scope = { projectId: project.id, sessionId: session.id };
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'PARENT_DELEGATION',
        materials: [],
      });
      if (scenario !== 'complete') {
        await expect.poll(() => paused, { timeout: 20000 }).toBe(true);
        if (scenario === 'cancel') app.harness.cancel(project.id, session.id);
        else {
          const current = await app.call('tasks.read', { task });
          await app.call('tasks.save', {
            task,
            basis: current.entry.basis,
            content: `${current.content}\nHuman retained condition.\n`,
          });
        }
        release();
      }
      if (scenario === 'cancel')
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe('cancelled');
      else await expectExecutionCompleted(app, scope, model);
      const result = await app.call('delegation.get', {
        ...scope,
        delegationId: request.delegationId,
      });
      const current = await app.call('tasks.read', { task });
      const snapshot = await app.snapshot(scope);
      await test.info().attach('task-delegation', {
        body: JSON.stringify({
          result,
          current,
          messages: snapshot.messages.filter((m) => m.tool),
        }),
        contentType: 'application/json',
      });
      expect(request.workPackage.materials).toEqual([original.entry]);
      expect(current.metadata.status).toBe('active');
      expect(result.childInstanceId).not.toBe(result.parentInstanceId);
      expect(result.childProcessId).not.toBe(result.parentProcessId);
      const childRequests = model.requests.filter((body) =>
        (body.tools as { name: string }[]).some((t) => t.name === 'report_delegation'),
      );
      expect(childRequests.length).toBeGreaterThan(0);
      for (const body of childRequests) {
        const names = (body.tools as { name: string }[]).map((t) => t.name);
        expect(names).not.toContain('save_research_task');
        expect(names).not.toContain('start_project_program');
        expect(names).not.toContain('read_file_edit');
      }
      if (scenario === 'materialChanged') {
        expect(result.artifacts).toEqual([]);
        expect(result.report).toMatchObject({
          blockers: 'contentChanged',
          unfinished: 'Material was not read.',
        });
        await expect(readFile(join(project.path, 'report.md'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      } else {
        expect(result).toMatchObject({ state: 'completed', resultState: 'available' });
        const resource = result.artifacts[0]!.resource;
        assert(resource.ref.source === 'project');
        expect(await readFile(join(project.path, 'report.md'), 'utf8')).toContain('Observed 42');
        expect(result.reads).toContainEqual(original.entry);
        expect(
          snapshot.messages.some(
            (m) =>
              m.tool?.name === 'read_context_resource' && m.tool.output?.includes('Observed 42'),
          ),
        ).toBe(true);
        if (scenario === 'complete') {
          expect(current.metadata.links).toContainEqual({
            id: 'delegated-result',
            role: 'result',
            workItemId,
            target: { kind: 'project-file', fileId: resource.ref.fileId },
            basis: resource.basis,
          });
          const changes = await app.call('files.changes', {
            projectId: project.id,
            fileId: task.fileId,
          });
          expect(changes.changes[0]?.origin).toMatchObject({
            kind: 'execution',
            instanceId: result.parentInstanceId,
          });
        } else if (scenario === 'linkConflict') {
          const save = snapshot.messages.find((m) => m.tool?.name === 'save_research_task');
          expect(JSON.parse(save?.tool?.output ?? '{}')).toMatchObject({
            error: { code: 'contentChanged' },
          });
          expect(snapshot.messages.some((m) => m.text.includes('association unfinished'))).toBe(
            true,
          );
        }
      }
      if (scenario !== 'complete') expect(current.metadata.links ?? []).toEqual([]);
      if (scenario === 'materialChanged' || scenario === 'linkConflict')
        expect(current.content).toContain('Human retained condition.');
      if (scenario === 'cancel') expect(current.entry).toEqual(original.entry);
      expect((await app.call('tasks.list', { projectId: project.id })).tasks).toHaveLength(1);
    } finally {
      release();
      model.release();
      await app.close();
      await model.close();
    }
  });
}
