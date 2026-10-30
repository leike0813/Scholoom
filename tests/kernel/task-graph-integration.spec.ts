import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createModelServer } from '../model-server.js';
import { taskGraphIntegration } from '../task-graph-integration-fixture.js';

test('the default task research port discovers the actual registered graph', async () => {
  const info = test.info();
  const f = await taskGraphIntegration(info.outputPath('i1'));
  try {
    expect(await f.app.call('tasks.graphs', { projectId: f.project.id, limit: 25 })).toEqual({
      graphs: [{ definition: f.description.definition, name: f.description.name }],
    });
  } finally {
    await f.app.close();
  }
});

for (const change of ['read', 'send', 'revision'] as const) {
  test(`catalog ${change} changes during real research admission refuse the original task start`, async () => {
    const f = await taskGraphIntegration(test.info().outputPath('catalog-admission'));
    let reach = () => {};
    let resume = () => {};
    const reached = new Promise<void>((resolve) => {
      reach = resolve;
    });
    const released = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const executions = f.app.harness.executions.bind(f.app.harness);
    let held = false;
    let pending: Promise<unknown> | undefined;
    try {
      const batch = await f.app.call('library.ingest', {
        batchId: randomUUID(),
        origin: 'catalog-admission',
        version: 'published',
        json: JSON.stringify([{ title: 'Catalog-only admission source' }]),
      });
      await expect
        .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const sourceId = (await f.app.call('library.batch', { batchId: batch.id })).entries[0]
        ?.sourceId;
      assert(sourceId);
      const source = await f.app.call('library.get', { sourceId });
      const libraryId = (await f.app.call('library.status', {})).id;
      const saved = await f.app.call('tasks.save', {
        task: f.input.task,
        basis: f.read.entry.basis,
        content: `---\n${JSON.stringify({ ...f.metadata, links: [{ id: 'catalog', role: 'source', workItemId: 'comparison', target: { kind: 'library-source', libraryId, sourceId }, basis: source.version }] })}\n---\n\nCompare the selected catalog source.\n`,
      });
      const input = { ...f.input, basis: saved.entry.basis, sourceLinkIds: ['catalog'] };
      f.app.harness.executions = async (query) => {
        const result = await executions(query);
        if (!held && query.instructionId === input.instructionId) {
          held = true;
          reach();
          await released;
        }
        return result;
      };
      pending = f.app.call('tasks.runGraph', input);
      void pending.catch(() => {});
      await reached;
      if (change === 'revision') {
        await f.app.call('library.update', {
          sourceId,
          revision: source.revision,
          metadata: { ...source.metadata, title: 'Changed during admission' },
          tags: source.tags,
          collectionIds: source.collectionIds,
          relatedIds: source.relatedIds,
        });
      } else {
        await f.app.call('library.grant', {
          read: change !== 'read',
          send: change !== 'send',
          write: true,
          autoBackup: false,
        });
      }
      resume();
      await expect(pending).rejects.toMatchObject({
        code: change === 'revision' ? 'contentChanged' : 'permissionDenied',
      });
      expect(
        (
          await executions({
            projectId: f.project.id,
            sessionId: input.sessionId,
            instructionId: input.instructionId,
            limit: 1,
          })
        ).runs,
      ).toEqual([]);
      expect(
        await f.app.call('resources.creation', {
          projectId: f.project.id,
          operationId: `${input.processOperationId}_input`,
        }),
      ).toMatchObject({ state: 'complete' });
    } finally {
      resume();
      await pending?.catch(() => {});
      f.app.harness.executions = executions;
      await f.app.close();
    }
  });
}

test('default task admission preserves the research subject, trust, send and capacity guards', async () => {
  const info = test.info();
  const f = await taskGraphIntegration(info.outputPath('i1'));
  try {
    await expect(
      f.app.call('tasks.runGraph', {
        ...f.input,
        principal: { kind: 'system', id: 'host' },
      } as never),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'restricted',
      autoBackup: false,
    });
    await expect(f.app.call('tasks.runGraph', f.input)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'trusted',
      autoBackup: false,
    });
    for (const access of [
      { read: false, send: true },
      { read: true, send: false },
    ]) {
      await f.app.call('library.grant', { ...access, write: true, autoBackup: false });
      await expect(f.app.call('tasks.runGraph', f.input)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
    }
    await f.app.call('library.grant', { read: true, send: true, write: true, autoBackup: false });
    const other = await f.app.call('project.create', {
      path: join(f.root, 'other'),
      trust: 'trusted',
    });
    const session = await f.app.call('session.create', { projectId: other.id });
    await expect(
      f.app.call('tasks.runGraph', {
        ...f.input,
        sessionId: session.id,
        invocationId: randomUUID(),
        instructionId: randomUUID(),
        processOperationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'notFound' });
    await expect(
      f.app.call('tasks.runGraph', { ...f.input, config: { goal: 'missing output' } }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect((await f.app.call('tasks.read', { task: f.input.task })).content).toBe(f.read.content);
    const self = await f.app.call('tasks.save', {
      task: f.input.task,
      basis: f.read.entry.basis,
      content: `---\n${JSON.stringify({ ...f.metadata, links: [{ id: 'self', role: 'source', target: { kind: 'project-file', fileId: f.input.task.fileId } }] })}\n---\n\n入口自己。\n`,
    });
    const selfRequest = {
      ...f.input,
      basis: self.entry.basis,
      sourceLinkIds: ['self'],
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      processOperationId: randomUUID(),
    };
    await expect(f.app.call('tasks.runGraph', selfRequest)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    await expect(
      f.app.call('resources.creation', {
        projectId: f.project.id,
        operationId: `${selfRequest.processOperationId}_input`,
      }),
    ).rejects.toMatchObject({ code: 'notFound' });
    const sourceLink = f.metadata.links?.[0];
    assert(sourceLink);
    const links = Array.from({ length: 10 }, (_, i) => ({
      ...sourceLink,
      id: `source-${i}`,
    }));
    const updated = await f.app.call('tasks.save', {
      task: f.input.task,
      basis: self.entry.basis,
      content: `---\n${JSON.stringify({ ...f.metadata, links })}\n---\n\n容量边界。\n`,
    });
    const capacityInput = {
      ...f.input,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      processOperationId: randomUUID(),
      basis: updated.entry.basis,
      sourceLinkIds: links.map((link) => link.id),
    };
    await expect(f.app.call('tasks.runGraph', capacityInput)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    expect(
      await f.app.call('resources.creation', {
        projectId: f.project.id,
        operationId: `${capacityInput.processOperationId}_input`,
      }),
    ).toMatchObject({ state: 'complete' });
    const acceptedInput = {
      ...capacityInput,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      processOperationId: randomUUID(),
      sourceLinkIds: capacityInput.sourceLinkIds.slice(0, 9),
    };
    const accepted = await f.app.call('tasks.runGraph', acceptedInput);
    expect(accepted.taskAssociation.state).toBe('confirmed');
    await expect
      .poll(
        async () => {
          const run = (
            await f.app.snapshot({ projectId: f.project.id, sessionId: acceptedInput.sessionId })
          ).run;
          if (run?.state === 'failed') throw new Error(JSON.stringify(run));
          return run?.state;
        },
        { timeout: 20000 },
      )
      .toBe('waiting');
    const capacityCall = (
      await f.app.call('research.graphCalls', {
        projectId: f.project.id,
        sessionId: acceptedInput.sessionId,
        invocationId: acceptedInput.invocationId,
      })
    ).calls[0];
    expect(capacityCall?.executions[0]?.run.graph?.materials).toHaveLength(10);
    expect(capacityCall?.executions[0]?.run.graphProgress?.evidence.reads).toHaveLength(10);
    expect(
      (
        await f.app.call('research.graphCalls', {
          projectId: f.project.id,
          sessionId: f.input.sessionId,
          invocationId: f.input.invocationId,
        })
      ).calls,
    ).toEqual([]);
    await expect(
      f.app.call('resources.creation', {
        projectId: f.project.id,
        operationId: f.input.processOperationId,
      }),
    ).rejects.toMatchObject({ code: 'notFound' });
  } finally {
    await f.app.close();
  }
});

test('default task starts refuse a busy or waiting session without creating another call', async () => {
  const info = test.info();
  const model = await createModelServer({ respond: () => ({ text: '已完成受控的外部回复。' }) });
  model.hold = true;
  const f = await taskGraphIntegration(info.outputPath('i1'), model.url);
  const scope = { projectId: f.project.id, sessionId: f.input.sessionId };
  try {
    await f.app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: '等待外部回复。',
      materials: [],
    });
    await expect
      .poll(async () => {
        const run = (await f.app.snapshot(scope)).run;
        if (run?.state === 'failed') throw new Error(JSON.stringify(run));
        return run && ['queued', 'running'].includes(run.state);
      })
      .toBe(true);
    await expect(f.app.call('tasks.runGraph', f.input)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    model.hold = false;
    model.release();
    await expect
      .poll(async () => (await f.app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('completed');
    await f.app.call('research.requestGraph', {
      ...scope,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      graphId: f.input.graphId,
      version: f.input.version,
      config: { goal: '实际等待图。', outputPath: 'waiting-report.md' },
      materials: [
        { ref: f.source.ref, basis: f.source.basis },
        { ref: f.library.ref, basis: f.library.basis },
      ],
      text: '固定图等待，未引用可变任务入口。',
    });
    await expect
      .poll(async () => (await f.app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('waiting');
    await expect(f.app.call('tasks.runGraph', f.input)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    expect(
      (await f.app.call('research.graphCalls', { ...scope, invocationId: f.input.invocationId }))
        .calls,
    ).toEqual([]);
    expect((await f.app.call('tasks.read', { task: f.input.task })).content).toBe(f.read.content);
  } finally {
    await f.app.close();
    await model.close();
  }
});

test('the real task start lets the fixed worker read the entry and both sources before waiting', async () => {
  const info = test.info();
  const f = await taskGraphIntegration(info.outputPath('i1'));
  try {
    const result = await f.app.call('tasks.runGraph', f.input);
    expect(result.process.state).toBe('complete');
    expect(result.taskAssociation.state).toBe('confirmed');
    assert(result.inputSnapshot?.resource.path);
    const inputEvidence = {
      ref: result.inputSnapshot.resource.ref,
      basis: result.inputSnapshot.resource.basis,
      role: 'task-input',
    };
    const frozen = JSON.parse(
      await readFile(join(f.project.path, result.inputSnapshot.resource.path), 'utf8'),
    );
    expect(frozen).toMatchObject({
      task: f.input.task,
      entry: f.read.entry,
      content: f.read.content,
      invocationId: f.input.invocationId,
      instructionId: f.input.instructionId,
    });
    const scope = { projectId: f.project.id, sessionId: f.input.sessionId };
    await expect
      .poll(
        async () => {
          const run = (await f.app.snapshot(scope)).run;
          if (run?.state === 'failed') throw new Error(JSON.stringify(run));
          return run?.state;
        },
        { timeout: 20000 },
      )
      .toBe('waiting');
    const call = (
      await f.app.call('research.graphCalls', { ...scope, invocationId: f.input.invocationId })
    ).calls[0];
    expect(call?.executions[0]?.run.graphProgress?.evidence.reads).toEqual([
      { ref: inputEvidence.ref, basis: inputEvidence.basis },
      { ref: f.source.ref, basis: f.source.basis },
      { ref: f.library.ref, basis: f.library.basis },
    ]);
    const report = await readFile(join(f.project.path, 'report.md'), 'utf8');
    for (const fragment of ['目标：核对两个样本', '结果42', '结果17'])
      expect(report).toContain(fragment);
  } finally {
    await f.app.close();
  }
});
