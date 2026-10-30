import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { InstructionSaver, openCheckpoint } from '../../packages/harness/dist/node.js';
import type { ResearchGraphStart } from '../../packages/protocol/dist/research.js';
import { graphArtifactOperation } from '../../packages/research/dist/node.js';

async function fixture(withLibrary = false, withUpdates = false) {
  const { description, updateDescription, graphs } = await import(
    // @ts-expect-error Source-only calibration fixture, shared by catalog and worker.
    '../fixtures/research-graph-worker/graphs.mjs'
  );
  const root = await mkdtemp(join(tmpdir(), 'scholoom-research-graphs-'));
  const profile = join(root, 'profile');
  const options = {
    environment: {},
    researchGraphs: withUpdates ? [updateDescription] : [description],
    executionGraphs: graphs,
    workerEntry: new URL('../fixtures/research-graph-worker/worker.mjs', import.meta.url),
  };
  // No task port is installed: these checks do not claim the I1 task integration.
  const app = new KernelApplication(profile, options);
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await app.call('files.save', {
      projectId: project.id,
      path: 'input.md',
      content: '合成项目材料：结果42，样本数1。',
    });
    const material = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'input.md' },
    });
    const materials = [{ ref: material.ref, basis: material.basis }];
    if (withLibrary) {
      await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
      const path = join(root, 'library.txt');
      await writeFile(path, '合成文献材料：对照组结果17。');
      const imported = await app.call('library.importFiles', {
        batchId: randomUUID(),
        paths: [path],
        storage: 'managed',
        purpose: '正文',
        version: 'unspecified',
        origin: 'research-graph-calibration',
      });
      await expect
        .poll(async () => (await app.call('library.batch', { batchId: imported.id })).batch.state, {
          timeout: 20000,
        })
        .toBe('completed');
      const attachmentId = (await app.call('library.batch', { batchId: imported.id })).entries[0]
        ?.attachmentId;
      assert(attachmentId);
      const attachment = await app.call('library.attachment', { attachmentId });
      const library = await app.call('resources.describe', {
        locator: {
          source: 'library',
          attachmentId,
          materialVersionId: attachment.materialVersionId,
        },
      });
      materials.push({ ref: library.ref, basis: library.basis });
    }
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const input: ResearchGraphStart = {
      ...scope,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      graphId: description.definition.graphId,
      version: description.definition.version,
      config: { outputPath: 'report.md', goal: '验证合成材料的读取与交付机制。' },
      materials,
      text: 'Run the source-defined calibration and wait for confirmation.',
    };
    return { app, profile, options, project, description, updateDescription, scope, input };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function requestGraph(app: KernelApplication, input: ResearchGraphStart) {
  const product = app.connectProduct();
  try {
    return await product.call('research.requestGraph', input);
  } finally {
    product.close();
  }
}

async function graphCall(app: KernelApplication, input: ResearchGraphStart) {
  const result = await app.call('research.graphCalls', {
    projectId: input.projectId,
    sessionId: input.sessionId,
    invocationId: input.invocationId,
  });
  expect(result.calls).toHaveLength(1);
  const call = result.calls[0];
  assert(call);
  return call;
}

async function waitFor(app: KernelApplication, input: ResearchGraphStart, state: string) {
  const scope = { projectId: input.projectId, sessionId: input.sessionId };
  await expect
    .poll(
      async () => {
        const run = (await app.snapshot(scope)).run;
        if (run?.state === 'failed' && state !== 'failed') throw new Error(JSON.stringify(run));
        return run?.state;
      },
      { timeout: 20000 },
    )
    .toBe(state);
}

test('role save verifies the exact update beyond the artifact list and retains history after a human edit', async () => {
  const f = await fixture(false, true);
  let app = f.app;
  try {
    await app.call('files.save', {
      projectId: f.project.id,
      path: 'report.md',
      content: 'Original report',
    });
    const before = await app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'report.md' },
    });
    const store = app.projects.get(f.project.id);
    for (let i = 0; i < 101; i++)
      store.linkArtifact(f.scope.sessionId, {
        runId: `old-${i}`,
        fileId: `old-${i}`,
        path: `old-${i}.md`,
        state: 'linked',
      });
    f.input.graphId = f.updateDescription.definition.graphId;
    const receipt = await requestGraph(app, f.input);
    await waitFor(app, f.input, 'completed');
    const original = await graphCall(app, f.input);
    expect(original.executions[0]?.check).toEqual({
      delivery: 'usable',
      researchAssessment: 'notAssessed',
      issues: [],
    });
    const result = original.executions[0]?.run.graphProgress?.evidence.roleResults?.[0]?.result;
    assert(result?.editId && result.resource.ref.source === 'project');
    expect(result.resource.ref).toEqual(before.ref);
    expect(result.resource.basis).not.toBe(before.basis);
    const edit = await app.call('files.edit', {
      projectId: f.project.id,
      fileId: result.resource.ref.fileId,
      editId: result.editId,
    });
    expect(edit).toMatchObject({
      beforeEvidence: { ref: before.ref, basis: before.basis },
      afterEvidence: { ref: result.resource.ref, basis: result.resource.basis },
      origin: { kind: 'execution', ...f.scope, runId: receipt.runId },
    });
    assert(edit.origin?.kind === 'execution' && edit.origin.instanceId);
    expect(store.artifacts(f.scope.sessionId)).toHaveLength(100);
    expect(store.artifacts(f.scope.sessionId).some((item) => item.runId === receipt.runId)).toBe(
      false,
    );
    const port = app.harnessProject({
      moduleId: 'harness',
      role: 'product',
      principal: { kind: 'human', id: 'test' },
    });
    const item = { runId: receipt.runId, fileId: result.resource.ref.fileId };
    expect(await port['project.artifacts']({ ...f.scope, item })).toMatchObject([
      { ...item, state: 'linked' },
    ]);
    const other = await app.call('session.create', { projectId: f.project.id });
    expect(await port['project.artifacts']({ ...f.scope, sessionId: other.id, item })).toEqual([]);
    await expect(
      port['project.artifacts']({ ...f.scope, item: { runId: receipt.runId } } as never),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await app.close();
    app = new KernelApplication(f.profile, f.options);
    await app.initialize();
    expect((await graphCall(app, f.input)).executions[0]?.check.delivery).toBe('usable');
    await app.call('resources.save', {
      ref: result.resource.ref,
      basis: result.resource.basis,
      content: 'Later human revision',
    });
    const later = await graphCall(app, f.input);
    expect(later.executions[0]?.check).toMatchObject({
      delivery: 'incomplete',
      issues: [{ code: 'artifactUnavailable', role: 'report' }],
    });
    expect(later.executions[0]?.run.graphProgress?.evidence.roleResults?.[0]?.result).toEqual(
      result,
    );
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toBe('Later human revision');
    expect(app.projects.get(f.project.id).history('report.md')).toHaveLength(3);
  } finally {
    await app.close();
  }
});

test('role save keeps unknown association and rejects missing, before-side and other-run save evidence', async () => {
  const f = await fixture(false, true);
  try {
    await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'report.md',
      content: 'Original report',
    });
    const before = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'report.md' },
    });
    f.input.graphId = f.updateDescription.definition.graphId;
    const store = f.app.projects.get(f.project.id);
    store.database.exec(
      "CREATE TRIGGER reject_role_association BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'synthetic association failure'); END",
    );
    await requestGraph(f.app, f.input);
    await waitFor(f.app, f.input, 'completed');
    const first = await graphCall(f.app, f.input);
    const old = first.executions[0]?.run.graphProgress?.evidence.roleResults?.[0]?.result;
    assert(old?.editId);
    expect(first.executions[0]?.check.issues).toEqual([
      { code: 'associationIncomplete', role: 'report' },
    ]);
    store.database.exec('DROP TRIGGER reject_role_association');
    expect((await graphCall(f.app, f.input)).executions[0]?.check.issues).toEqual(
      first.executions[0]?.check.issues,
    );
    const next = { ...f.input, invocationId: randomUUID(), instructionId: randomUUID() };
    const receipt = await requestGraph(f.app, next);
    await waitFor(f.app, next, 'completed');
    const second = (await graphCall(f.app, next)).executions[0];
    assert(second?.run.graphProgress);
    const result = second.run.graphProgress.evidence.roleResults?.[0]?.result;
    assert(result?.editId);
    assert(result.resource.ref.source === 'project');
    const editScope = { projectId: f.project.id, fileId: result.resource.ref.fileId };
    const currentEdit = await f.app.call('files.edit', { ...editScope, editId: result.editId });
    const oldEdit = await f.app.call('files.edit', { ...editScope, editId: old.editId });
    expect(currentEdit.after).toBe(oldEdit.after);
    expect(second.check.delivery).toBe('usable');
    expect((await graphCall(f.app, f.input)).executions[0]?.check.issues).toEqual([
      { code: 'associationIncomplete', role: 'report' },
      { code: 'artifactUnavailable', role: 'report' },
    ]);
    const human = await f.app.call('files.save', {
      projectId: f.project.id,
      path: 'report.md',
      basis: (await f.app.call('files.read', { projectId: f.project.id, path: 'report.md' })).basis,
      content: 'Later human revision',
    });
    const humanResource = await f.app.call('resources.describe', {
      locator: { source: 'project', projectId: f.project.id, path: 'report.md' },
    });
    const { editId: _editId, ...missingId } = result;
    for (const candidate of [
      missingId,
      { ...result, editId: 'missing-history' },
      { ...result, resource: before },
      old,
      { resource: humanResource, editId: human.id },
    ]) {
      const run = structuredClone(second.run);
      assert(run.graphProgress);
      run.graphProgress.evidence.roleResults = [{ role: 'report', result: candidate }];
      store.database
        .prepare('UPDATE runs SET value = ? WHERE id = ?')
        .run(JSON.stringify(run), receipt.runId);
      const view = await graphCall(f.app, next);
      expect(view.executions[0]?.check.delivery).toBe('incomplete');
      expect(view.executions[0]?.check.issues).toContainEqual({
        code: 'artifactMissing',
        role: 'report',
      });
    }
    store.database
      .prepare('UPDATE runs SET value = ? WHERE id = ?')
      .run(JSON.stringify(second.run), receipt.runId);
    const resources = f.app.executionResources.bind(f.app);
    let authorizationChecked = false;
    f.app.executionResources = (context) => {
      const port = resources(context);
      return {
        ...port,
        save: async (input) => {
          const query = (scope = context) =>
            f.app
              .researchTools(scope)
              ['research.graphCalls']({ ...f.scope, invocationId: next.invocationId });
          const authorized = await query();
          expect(authorized.calls[0]?.executions[0]?.check.issues).not.toContainEqual({
            code: 'artifactMissing',
            role: 'report',
          });
          for (const [scope, code] of [
            [{ ...context, instanceId: 'wrong-instance' }, 'instanceMismatch'],
            [{ ...context, runId: 'wrong-run' }, 'instanceMismatch'],
            [
              {
                ...context,
                targetRead: { targetProjectId: 'other-project', access: 'read' as const },
              },
              'permissionDenied',
            ],
          ] as const) {
            const denied = await query(scope);
            expect(denied.calls[0]?.error?.code).toBe(code);
            expect(denied.calls[0]?.executions[0]?.check.issues).toContainEqual({
              code: 'artifactMissing',
              role: 'report',
            });
          }
          await f.app.call('project.grant', {
            projectId: f.project.id,
            trust: 'restricted',
            autoBackup: false,
          });
          const denied = await query();
          expect(denied.calls[0]?.error?.code).toBe('permissionDenied');
          expect(denied.calls[0]?.executions[0]?.check.issues).toContainEqual({
            code: 'artifactMissing',
            role: 'report',
          });
          authorizationChecked = true;
          return port.save(input);
        },
      };
    };
    const blocked = { ...next, invocationId: randomUUID(), instructionId: randomUUID() };
    await requestGraph(f.app, blocked);
    await waitFor(f.app, blocked, 'failed');
    expect(authorizationChecked).toBe(true);
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toBe('Later human revision');
    expect(store.history('report.md')).toHaveLength(4);
  } finally {
    await f.app.close();
  }
});

test('research graph reads project and managed library text, waits and delivers after a normal message', async () => {
  const f = await fixture(true);
  f.input.instructionId = 'x'.repeat(1024);
  let app = f.app;
  try {
    expect(await app.call('research.graphs', { limit: 1 })).toEqual({
      descriptions: [f.description],
    });
    expect(
      await app.call('research.graph', { graphId: f.input.graphId, version: f.input.version }),
    ).toEqual(f.description);
    expect(await app.call('research.methods', {})).toHaveLength(1);
    expect(app.available()).not.toContain('research.startGraph');
    await expect(
      app.research.graphCalls.start(f.input, {
        moduleId: 'research',
        role: 'execution',
        principal: { kind: 'agent', id: 'agent' },
        ...f.scope,
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    for (const changed of [
      { config: { ...f.input.config, operationId: 'caller-controlled' } },
      { config: { ...f.input.config, goal: 'x'.repeat(4097) } },
      { materials: [] },
      { modulePath: '/untrusted/worker.mjs' },
    ])
      await expect(requestGraph(app, { ...f.input, ...changed } as never)).rejects.toMatchObject({
        code: 'invalidRequest',
      });

    const [receipt, replay] = await Promise.all([
      requestGraph(app, f.input),
      requestGraph(app, f.input),
    ]);
    expect(replay).toEqual(receipt);
    expect(
      (await app.snapshot(f.scope)).messages.find((item) => item.id === f.input.instructionId)
        ?.source,
    ).toBeDefined();
    await expect(
      requestGraph(app, { ...f.input, invocationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(await app.call('research.attempts', f.scope)).toEqual({ attempts: [] });
    await waitFor(app, f.input, 'waiting');
    const waiting = await graphCall(app, f.input);
    expect(waiting.executions).toHaveLength(1);
    expect(waiting.executions[0]).toMatchObject({
      run: { id: receipt.runId, state: 'waiting', graphProgress: { kind: 'graph.waiting' } },
      check: { delivery: 'incomplete', researchAssessment: 'notAssessed' },
    });
    expect(waiting.executions[0]?.check.issues).toContainEqual({ code: 'executionIncomplete' });
    const creation = waiting.executions[0]?.run.graphProgress?.evidence.creations?.[0];
    assert(creation?.state === 'complete');
    expect(creation.operationId).toBe(graphArtifactOperation(f.input.instructionId, 'report'));
    expect(waiting.executions[0]?.run.graphProgress?.evidence.reads).toEqual(f.input.materials);
    const bytes = await readFile(join(f.project.path, 'report.md'), 'utf8');
    for (const expected of ['Mechanism calibration', f.input.config.goal, '结果42', '结果17'])
      expect(bytes).toContain(expected);
    const identity = await stat(join(f.project.path, 'report.md'), { bigint: true });

    await app.close();
    app = new KernelApplication(f.profile, f.options);
    await app.initialize();
    expect((await graphCall(app, f.input)).executions).toEqual(waiting.executions);
    expect(await requestGraph(app, f.input)).toEqual(receipt);
    await expect(
      requestGraph(app, { ...f.input, config: { ...f.input.config, goal: 'changed goal' } }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });

    const unmatched = {
      ...f.scope,
      instructionId: randomUUID(),
      text: '{"confirm":true,"unexpected":true}',
      materials: [],
    };
    await app.call('session.send', unmatched);
    await waitFor(app, f.input, 'waiting');
    expect(
      (await app.snapshot(f.scope)).messages.find((item) => item.id === unmatched.instructionId),
    ).toMatchObject({ state: 'accepted' });
    const projectMaterial = f.input.materials[0];
    assert(projectMaterial?.ref.source === 'project');
    const confirmation = {
      ...f.scope,
      instructionId: randomUUID(),
      text: '{"confirm":true}',
      materials: ['input.md'],
      materialFileIds: [projectMaterial.ref.fileId],
      contextItems: [
        {
          kind: 'text' as const,
          itemId: randomUUID(),
          ...projectMaterial,
          quote: '结果42',
          contentState: 'saved' as const,
          comment: '确认合成材料。',
        },
      ],
    };
    const product = app.connectProduct();
    try {
      expect((await product.call('session.send', confirmation)).runId).toBe(receipt.runId);
    } finally {
      product.close();
    }
    await waitFor(app, f.input, 'completed');
    const completed = await graphCall(app, f.input);
    expect(completed.executions[0]).toMatchObject({
      run: { id: receipt.runId, graphProgress: { kind: 'graph.completed' } },
      check: { delivery: 'usable', issues: [], researchAssessment: 'notAssessed' },
    });
    expect(completed.error).toBeUndefined();
    const persisted = (await app.snapshot(f.scope)).messages.find(
      (item) => item.id === confirmation.instructionId,
    );
    expect(persisted).toMatchObject({ state: 'consumed', contextItems: confirmation.contextItems });
    expect(persisted?.source).toBeDefined();
    const checkpoint = await openCheckpoint(app.projects.get(f.project.id).internal, receipt.runId);
    try {
      const saved = await new InstructionSaver(checkpoint.database, async () => {}).getTuple({
        configurable: { thread_id: receipt.runId },
      });
      const { projectId: _project, sessionId: _session, ...instruction } = confirmation;
      expect(saved?.checkpoint.channel_values.instructions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ...instruction, source: persisted?.source }),
        ]),
      );
    } finally {
      checkpoint.database.close();
    }
    expect(await requestGraph(app, f.input)).toEqual(receipt);
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toBe(bytes);
    expect((await stat(join(f.project.path, 'report.md'), { bigint: true })).ino).toBe(
      identity.ino,
    );
    expect(app.projects.get(f.project.id).history('report.md')).toHaveLength(1);

    const independent = {
      ...f.input,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      config: { ...f.input.config, outputPath: 'second-report.md' },
    };
    const second = await requestGraph(app, independent);
    await waitFor(app, independent, 'waiting');
    expect(second.runId).not.toBe(receipt.runId);
    expect((await graphCall(app, f.input)).executions).toEqual(completed.executions);
    const page = await app.call('research.graphCalls', { ...f.scope, limit: 1 });
    expect(page.calls[0]?.call.invocationId).toBe(independent.invocationId);
    expect(page.nextOffset).toBe(1);
    const next = await app.call('research.graphCalls', { ...f.scope, offset: 1, limit: 1 });
    expect(next.calls[0]?.call.invocationId).toBe(f.input.invocationId);
    expect(next.nextOffset).toBeUndefined();
    await expect(
      app.call('research.graphCalls', { ...f.scope, executionOffset: 1 }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });

    const backup = await app.projects.get(f.project.id).backup();
    const restored = await app.call('project.restore', {
      projectId: f.project.id,
      backupId: backup.id,
      destination: join(f.profile, '..', 'restored'),
    });
    const copyInput = { ...f.input, projectId: restored.id };
    const copy = await graphCall(app, copyInput);
    expect(copy.call).toMatchObject({
      projectId: restored.id,
      restoredFromProjectId: f.project.id,
      materials: f.input.materials,
    });
    expect(copy.executions[0]).toMatchObject({
      run: { id: receipt.runId, state: 'completed' },
      check: { delivery: 'incomplete' },
    });
    expect(copy.error?.code).toBe('unavailable');
    const describe = app.resources.describe.bind(app.resources);
    let described = 0;
    app.resources.describe = async (...args) => {
      described++;
      return describe(...args);
    };
    try {
      await expect(requestGraph(app, copyInput)).rejects.toMatchObject({ code: 'unavailable' });
      expect(described).toBe(0);
    } finally {
      app.resources.describe = describe;
    }
    expect(await readFile(join(restored.path, 'report.md'), 'utf8')).toBe(bytes);
  } finally {
    await app.close();
  }
});

test('human graph requests reject untrusted context, payloads and stale authority before recording intent', async () => {
  const f = await fixture(true);
  try {
    for (const context of [
      { role: 'execution' as const, principal: { kind: 'agent' as const, id: 'agent' } },
      { role: 'host' as const, principal: { kind: 'system' as const, id: 'host' } },
      {
        role: 'product' as const,
        principal: { kind: 'human' as const, id: 'local' },
        projectId: 'other',
      },
      {
        role: 'product' as const,
        principal: { kind: 'human' as const, id: 'local' },
        sessionId: 'other',
      },
    ])
      expect(() =>
        f.app.research.graphCalls.request(f.input, { moduleId: 'research', ...context }),
      ).toThrow(expect.objectContaining({ code: 'permissionDenied' }));
    for (const extra of [
      { role: 'host' },
      { workDomain: { kind: 'project', ...f.scope } },
      { workerEntry: '/tmp/worker.mjs' },
      { task: { projectId: f.project.id, taskId: 'task', fileId: 'file' } },
      { config: { outputPath: 'report.md', goal: 'check', code: 'arbitrary' } },
    ])
      await expect(requestGraph(f.app, { ...f.input, ...extra } as never)).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    await expect(requestGraph(f.app, { ...f.input, version: 'missing' })).rejects.toMatchObject({
      code: 'notFound',
    });
    await expect(
      requestGraph(f.app, {
        ...f.input,
        materials: f.input.materials.map((m) => ({ ...m, basis: 'stale' })),
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'restricted',
      autoBackup: false,
    });
    await expect(requestGraph(f.app, f.input)).rejects.toMatchObject({ code: 'permissionDenied' });
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'trusted',
      autoBackup: false,
    });
    await f.app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    await expect(requestGraph(f.app, f.input)).rejects.toMatchObject({ code: 'permissionDenied' });
    await f.app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    await f.app.call('session.archive', { ...f.scope, archived: true });
    await expect(requestGraph(f.app, f.input)).rejects.toMatchObject({ code: 'invalidRequest' });
    expect((await f.app.call('research.graphCalls', f.scope)).calls).toEqual([]);
    await expect(stat(join(f.project.path, 'report.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await f.app.close();
  }
});

test('human graph admission rechecks revocation after waiting and refuses a competing request', async () => {
  const f = await fixture();
  let release = () => {};
  let entered = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const observed = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const describe = f.app.resources.describe.bind(f.app.resources);
  let first = true;
  f.app.resources.describe = async (...args) => {
    const result = await describe(...args);
    if (first) {
      first = false;
      entered();
      await held;
    }
    return result;
  };
  let pending: ReturnType<typeof requestGraph> | undefined;
  try {
    pending = requestGraph(f.app, f.input);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'permissionDenied' });
    await observed;
    await expect(
      requestGraph(f.app, { ...f.input, invocationId: randomUUID(), instructionId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'restricted',
      autoBackup: false,
    });
    release();
    await rejected;
    expect((await f.app.call('research.graphCalls', f.scope)).calls).toEqual([]);
    await f.app.call('project.grant', {
      projectId: f.project.id,
      trust: 'trusted',
      autoBackup: false,
    });
    const [a, b] = await Promise.all([requestGraph(f.app, f.input), requestGraph(f.app, f.input)]);
    expect(a).toEqual(b);
    await waitFor(f.app, f.input, 'waiting');
    await expect(
      requestGraph(f.app, { ...f.input, invocationId: randomUUID(), instructionId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect((await graphCall(f.app, f.input)).executions).toHaveLength(1);
    expect((await f.app.call('research.graphCalls', f.scope)).calls).toHaveLength(1);
  } finally {
    release();
    await pending?.catch(() => {});
    await f.app.close();
  }
});

for (const boundary of ['revoke', 'waiting'] as const) {
  test(`human graph final admission protects ${boundary} after the host check waits`, async () => {
    const f = await fixture(boundary === 'revoke');
    let release = () => {};
    let entered = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const observed = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let pending: ReturnType<typeof requestGraph> | undefined;
    try {
      if (boundary === 'waiting') {
        await requestGraph(f.app, f.input);
        await waitFor(f.app, f.input, 'waiting');
        await f.app.call('session.send', {
          ...f.scope,
          instructionId: randomUUID(),
          text: '{"confirm":true}',
          materials: [],
        });
        await waitFor(f.app, f.input, 'completed');
      }
      const project = f.app.harnessProject.bind(f.app);
      let first = true;
      f.app.harnessProject = (context) => {
        const port = project(context);
        return {
          ...port,
          'project.check': async (input) => {
            const result = await port['project.check'](input);
            if (first && input.access === 'send') {
              first = false;
              entered();
              await gate;
            }
            return result;
          },
        };
      };
      const input = {
        ...f.input,
        invocationId: randomUUID(),
        instructionId: randomUUID(),
        config: { ...f.input.config, outputPath: 'new-report.md' },
      };
      pending = requestGraph(f.app, input);
      const rejected = expect(pending).rejects.toMatchObject({
        code: boundary === 'revoke' ? 'permissionDenied' : 'invalidRequest',
      });
      await observed;
      let ordinary: { runId: string } | undefined;
      if (boundary === 'revoke')
        await f.app.call('library.grant', {
          read: true,
          write: true,
          send: false,
          autoBackup: false,
        });
      else {
        ordinary = await f.app.call('session.send', {
          ...f.scope,
          instructionId: randomUUID(),
          text: 'Continue calibration.',
          materials: [],
        });
        await waitFor(f.app, f.input, 'waiting');
      }
      release();
      await rejected;
      const snapshot = await f.app.snapshot(f.scope);
      expect(snapshot.messages.some((item) => item.id === input.instructionId)).toBe(false);
      expect((await graphCall(f.app, input)).executions).toHaveLength(0);
      if (ordinary) expect(snapshot.run).toMatchObject({ id: ordinary.runId, state: 'waiting' });
      else expect(snapshot.run).toBeUndefined();
      await expect(stat(join(f.project.path, 'new-report.md'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      release();
      await pending?.catch(() => {});
      await f.app.close();
    }
  });
}

test('research replay rejects changed text from an instruction already accepted by harness', async () => {
  const f = await fixture();
  try {
    const accepted = await f.app.startGraph({
      ...f.scope,
      instructionId: f.input.instructionId,
      text: 'A',
      execution: {
        kind: 'registered',
        graphId: f.input.graphId,
        version: f.input.version,
        config: f.input.config,
        materials: f.input.materials,
        workDomain: { kind: 'project', ...f.scope },
      },
    });
    await waitFor(f.app, f.input, 'waiting');
    await expect(requestGraph(f.app, { ...f.input, text: 'B' })).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    expect(await graphCall(f.app, f.input)).toMatchObject({
      executions: [],
      error: { code: 'invalidRequest' },
    });
    expect((await f.app.snapshot(f.scope)).run?.id).toBe(accepted.runId);
  } finally {
    await f.app.close();
  }
});

test('an unknown creation remains incomplete until its original owner reconciles it', async () => {
  const f = await fixture();
  try {
    const store = f.app.projects.get(f.project.id);
    store.database.exec(
      "CREATE TRIGGER reject_creation BEFORE INSERT ON file_references BEGIN SELECT RAISE(ABORT, 'synthetic registration failure'); END",
    );
    await requestGraph(f.app, f.input);
    await waitFor(f.app, f.input, 'failed');
    const original = await graphCall(f.app, f.input);
    expect(original.executions[0]).toMatchObject({
      run: { graphProgress: { evidence: { creations: [{ state: 'unknown' }] } } },
      check: { delivery: 'incomplete' },
    });
    const bytes = await readFile(join(f.project.path, 'report.md'), 'utf8');
    const identity = await stat(join(f.project.path, 'report.md'), { bigint: true });
    store.database.exec('DROP TRIGGER reject_creation');
    await graphCall(f.app, f.input);
    expect(store.history('report.md')).toHaveLength(0);
    const checked = await f.app.call('resources.creation', {
      projectId: f.project.id,
      operationId: graphArtifactOperation(f.input.instructionId, 'report'),
    });
    expect(checked).toMatchObject({ state: 'complete', association: { state: 'confirmed' } });
    expect((await graphCall(f.app, f.input)).executions[0]?.check.delivery).toBe('incomplete');
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toBe(bytes);
    expect((await stat(join(f.project.path, 'report.md'), { bigint: true })).ino).toBe(
      identity.ino,
    );
    expect(store.history('report.md')).toHaveLength(1);
  } finally {
    await f.app.close();
  }
});

test('cancelling an accepted save preserves its original receipt and execution query authority', async () => {
  const f = await fixture();
  let release = () => {};
  const delivery = new Promise<void>((resolve) => {
    release = resolve;
  });
  let published = false;
  const resources = f.app.executionResources.bind(f.app);
  f.app.executionResources = (context) => {
    const port = resources(context);
    return {
      ...port,
      create: async (input) => {
        const view = await f.app.researchTools(context)['research.graphCalls']({
          ...f.scope,
          invocationId: f.input.invocationId,
        });
        assert(view.calls[0] && !view.calls[0].error);
        const result = await port.create(input);
        published = true;
        await delivery;
        return result;
      },
    };
  };
  try {
    const receipt = await requestGraph(f.app, f.input);
    await expect.poll(() => published, { timeout: 20000 }).toBe(true);
    const bytes = await readFile(join(f.project.path, 'report.md'), 'utf8');
    const cancelled = f.app.call('session.cancel', f.scope);
    release();
    await cancelled;
    await waitFor(f.app, f.input, 'cancelled');
    const view = await graphCall(f.app, f.input);
    expect(view.executions[0]).toMatchObject({
      run: { id: receipt.runId, state: 'cancelled', remoteOutcome: 'unknown' },
      check: { delivery: 'incomplete' },
    });
    const original = await f.app.call('resources.creation', {
      projectId: f.project.id,
      operationId: graphArtifactOperation(f.input.instructionId, 'report'),
    });
    expect(original).toMatchObject({ state: 'complete', association: { state: 'confirmed' } });
    expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toBe(bytes);
    expect(f.app.projects.get(f.project.id).history('report.md')).toHaveLength(1);
  } finally {
    release();
    await f.app.close();
  }
});

for (const boundary of ['association', 'revoke', 'cancel', 'receipt'] as const) {
  test(`research graph preserves its original creation across ${boundary}`, async () => {
    const f = await fixture();
    let app = f.app;
    try {
      const store = app.projects.get(f.project.id);
      if (boundary === 'association')
        store.database.exec(
          "CREATE TRIGGER reject_report_association BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'synthetic association failure'); END",
        );
      if (boundary === 'receipt')
        store.database.exec(
          "CREATE TRIGGER lose_research_receipt BEFORE UPDATE ON research_attempts WHEN json_extract(NEW.value, '$.kind') = 'graph' BEGIN SELECT RAISE(ABORT, 'synthetic lost receipt'); END",
        );
      if (boundary === 'receipt')
        await expect(requestGraph(app, f.input)).rejects.toMatchObject({
          code: 'outcomeUnknown',
        });
      else await requestGraph(app, f.input);
      await waitFor(app, f.input, boundary === 'association' ? 'failed' : 'waiting');
      const original = await graphCall(app, f.input);
      const execution = original.executions[0];
      const creation = execution?.run.graphProgress?.evidence.creations?.[0];
      assert(execution && creation?.state === 'complete');
      expect(creation.resource.ref.source).toBe('project');
      const bytes = await readFile(join(f.project.path, 'report.md'), 'utf8');
      const identity = await stat(join(f.project.path, 'report.md'), { bigint: true });
      const operationId = graphArtifactOperation(f.input.instructionId, 'report');

      if (boundary === 'association') {
        expect(execution.run.graphProgress).toMatchObject({
          kind: 'graph.failed',
          error: { code: 'unavailable' },
          evidence: {
            reads: f.input.materials,
            results: [{ resource: creation.resource, association: { state: 'unknown' } }],
          },
        });
        expect(execution.check.delivery).toBe('incomplete');
        expect(execution.check.issues).toContainEqual({
          code: 'associationIncomplete',
          role: 'report',
        });
        store.database.exec('DROP TRIGGER reject_report_association');
        expect(
          await app.call('resources.creation', { projectId: f.project.id, operationId }),
        ).toMatchObject({
          state: 'complete',
          resource: creation.resource,
          association: { state: 'confirmed' },
        });
      } else if (boundary === 'revoke') {
        await app.call('project.grant', {
          projectId: f.project.id,
          trust: 'restricted',
          autoBackup: false,
        });
        const denied = await graphCall(app, f.input);
        expect(denied.executions[0]?.check.delivery).toBe('incomplete');
        await expect(
          app.call('session.send', {
            ...f.scope,
            instructionId: randomUUID(),
            text: '{"confirm":true}',
            materials: [],
          }),
        ).rejects.toMatchObject({ code: 'permissionDenied' });
      } else if (boundary === 'cancel') {
        await app.call('session.cancel', f.scope);
        await waitFor(app, f.input, 'cancelled');
      } else store.database.exec('DROP TRIGGER lose_research_receipt');

      await app.close();
      app = new KernelApplication(f.profile, f.options);
      await app.initialize();
      const reopened = await graphCall(app, f.input);
      expect(reopened.executions[0]?.run.id).toBe(execution.run.id);
      expect(reopened.executions[0]?.check.delivery).toBe('incomplete');
      if (boundary === 'cancel') {
        expect(reopened.executions[0]?.run.state).toBe('cancelled');
        const continued = await app.call('session.send', {
          ...f.scope,
          instructionId: randomUUID(),
          text: 'Continue the same calibration.',
          materials: [],
        });
        expect(continued.runId).not.toBe(execution.run.id);
        await waitFor(app, f.input, 'waiting');
        await app.call('session.send', {
          ...f.scope,
          instructionId: randomUUID(),
          text: '{"confirm":true}',
          materials: [],
        });
        await waitFor(app, f.input, 'completed');
        const history = await graphCall(app, f.input);
        expect(history.executions).toHaveLength(2);
        expect(
          history.executions.find((item) => item.run.id === execution.run.id)?.check.delivery,
        ).toBe('incomplete');
        const latest = history.executions.find((item) => item.run.id === continued.runId);
        expect(latest?.check.delivery).toBe('usable');
        expect(latest?.run.graphProgress?.evidence.creations?.[0]).toMatchObject({
          state: 'complete',
          operationId,
          resource: creation.resource,
        });
      } else if (boundary === 'receipt') {
        expect(await requestGraph(app, f.input)).toMatchObject({
          invocationId: f.input.invocationId,
          instructionId: f.input.instructionId,
          runId: execution.run.id,
        });
        expect((await graphCall(app, f.input)).executions).toHaveLength(1);
      }
      expect(await readFile(join(f.project.path, 'report.md'), 'utf8')).toBe(bytes);
      expect((await stat(join(f.project.path, 'report.md'), { bigint: true })).ino).toBe(
        identity.ino,
      );
      expect(app.projects.get(f.project.id).history('report.md')).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
}
