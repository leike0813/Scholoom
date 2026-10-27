import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { FileExecutionFacts } from '../../apps/kernel/dist/manual.js';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import { createModelServer } from '../model-server.js';

test('the trusted provider seam keeps instruction sets and rejects facts from another execution', async () => {
  class Binder extends ManualApplication {
    facts?: FileExecutionFacts;
    protected override checkExecutionContext() {}
    protected override executionFileFacts() {
      return this.facts;
    }
    bind(context: CallContext) {
      return this.fileOrigin('p', context);
    }
  }
  const app = new Binder(await mkdtemp(join(tmpdir(), 'scholoom-origin-binder-')));
  try {
    const context: CallContext = {
      moduleId: 'harness',
      principal: { kind: 'agent', id: 's' },
      role: 'execution',
      projectId: 'p',
      sessionId: 's',
      runId: 'r',
      instanceId: 'child',
    };
    app.facts = {
      projectId: 'p',
      sessionId: 's',
      runId: 'r',
      instanceId: 'child',
      instructionIds: ['first', 'second'],
      delegation: {
        delegationId: 'fixture-delegation',
        parentInstanceId: 'parent',
        parentRunId: 'r',
      },
    };
    await expect(app.bind(context)).resolves.toMatchObject({
      instanceId: 'child',
      instructionContext: { state: 'observed', instructionIds: ['first', 'second'] },
      tool: { state: 'unknown' },
      delegation: app.facts.delegation,
    });
    app.facts = { ...app.facts, instanceId: 'other' };
    await expect(app.bind(context)).rejects.toMatchObject({ code: 'instanceMismatch' });
  } finally {
    await app.close();
  }
});

test('human saves, resource creation and whole-edit undo expose the actual edit and source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-origin-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    const created = await app.call('resources.create', {
      projectId: project.id,
      path: 'notes.md',
      operationId: randomUUID(),
      content: 'Original conditions.',
    });
    assert(created.state === 'complete');
    assert(created.editId);
    const scope = { projectId: project.id, fileId: created.resource.ref.fileId };
    const first = await app.call('files.edit', { ...scope, editId: created.editId });
    expect(first.origin?.kind).toBe('human');
    expect(first.afterEvidence?.basis).toBe(created.resource.basis);
    expect((await app.call('files.changes', { ...scope, afterEditId: first.id })).changes).toEqual(
      [],
    );
    const read = await app.call('files.read', { projectId: project.id, path: 'notes.md' });
    const saved = await app.call('files.save', {
      projectId: project.id,
      path: 'notes.md',
      basis: read.basis,
      content: 'Revised conditions.',
    });
    expect(saved.origin?.kind).toBe('human');
    const changes = await app.call('files.changes', { ...scope, afterEditId: first.id });
    expect(changes.changes.map((item) => item.editId)).toEqual([saved.id]);
    expect(changes.coverage.current).toBe('matchesLatest');
    const reverted = await app.call('files.undo', { projectId: project.id, editId: saved.id });
    expect(reverted.revertsEditId).toBe(saved.id);
    expect(reverted.origin?.kind).toBe('human');
    expect(await readFile(join(project.path, 'notes.md'), 'utf8')).toBe('Original conditions.');
    const history = await app.call('files.changes', scope);
    expect(history.changes[0]?.editId).toBe(reverted.id);
    await writeFile(join(project.path, 'notes.md'), 'Outside modification.');
    expect((await app.call('files.changes', scope)).coverage.current).toBe('changedOrUnrecorded');
    await expect(
      app.call('files.undo', { projectId: project.id, editId: reverted.id }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
  } finally {
    await app.close();
  }
});

for (const change of ['cancel', 'revoke'] as const) {
  test(`waiting for real execution facts does not permit a save after ${change}`, async () => {
    const root = test.info().outputPath('origin-await');
    let reached!: () => void;
    let resume!: () => void;
    const reachedPromise = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const resumePromise = new Promise<void>((resolve) => {
      resume = resolve;
    });
    class WaitingApplication extends KernelApplication {
      protected override async executionFileFacts(context: CallContext) {
        const facts = await super.executionFileFacts(context);
        reached();
        await resumePromise;
        return facts;
      }
    }
    const model = await createModelServer({
      respond: ({ calls }) =>
        calls.includes('write_file')
          ? { text: 'The rejected write remains unfinished.' }
          : {
              tool: {
                name: 'write_file',
                input: { file_path: 'blocked.md', content: 'Must not publish.' },
              },
            },
    });
    const app = new WaitingApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const session = await app.call('session.create', { projectId: project.id });
      const scope = { projectId: project.id, sessionId: session.id };
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'Save blocked.md.',
        materials: [],
      });
      await reachedPromise;
      if (change === 'cancel') app.harness.cancel(project.id, session.id);
      else app.projects.get(project.id).grant({ trust: 'restricted', autoBackup: false });
      resume();
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .not.toMatch(/^(queued|running|cancelling)$/);
      await expect(readFile(join(project.path, 'blocked.md'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(
        app.projects.get(project.id).database.prepare('SELECT count(*) AS n FROM edits').get(),
      ).toMatchObject({ n: 0 });
    } finally {
      resume();
      await app.close();
      await model.close();
    }
  });
}

test('file changes keep a bounded cursor window and report pruned anchors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-window-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const first = await app.call('files.save', {
      projectId: project.id,
      path: 'notes.md',
      content: 'v0',
    });
    assert(first.fileId);
    const scope = { projectId: project.id, fileId: first.fileId };
    const edits = [first.id];
    const save = async (n: number) => {
      const read = await app.call('files.read', { projectId: project.id, path: 'notes.md' });
      const edit = await app.call('files.save', {
        projectId: project.id,
        path: 'notes.md',
        basis: read.basis,
        content: `v${n}`,
      });
      edits.push(edit.id);
    };
    for (let n = 1; n <= 5; n++) await save(n);
    const page = await app.call('files.changes', { ...scope, afterEditId: first.id, limit: 2 });
    expect(page.changes.map((item) => item.editId)).toEqual([edits[5], edits[4]]);
    expect(page.changes.every((item) => !('before' in item) && !('after' in item))).toBe(true);
    assert(page.nextCursor);
    await save(6);
    const second = await app.call('files.changes', { ...scope, cursor: page.nextCursor, limit: 2 });
    expect(second.changes.map((item) => item.editId)).toEqual([edits[3], edits[2]]);
    await expect(
      app.call('files.changes', { ...scope, cursor: { ...page.nextCursor, fileId: randomUUID() } }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    for (let n = 7; n <= 28; n++) await save(n);
    await expect(
      app.call('files.changes', { ...scope, cursor: page.nextCursor }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    const pruned = await app.call('files.changes', { ...scope, afterEditId: first.id });
    expect(pruned.coverage).toMatchObject({
      anchor: 'missing',
      retention: 'pruned',
      current: 'matchesLatest',
    });
    expect(pruned.changes).toHaveLength(20);
    const missing = await app.call('files.changes', { ...scope, afterEditId: first.id, limit: 2 });
    assert(missing.nextCursor);
    const continuation = await app.call('files.changes', {
      ...scope,
      cursor: missing.nextCursor,
      limit: 2,
    });
    expect(continuation.coverage.anchor).toBe('missing');
    expect(continuation.changes.map((edit) => edit.editId)).toEqual(
      pruned.changes.slice(2, 4).map((edit) => edit.editId),
    );
    const unanchored = await app.call('files.changes', { ...scope, limit: 2 });
    assert(unanchored.nextCursor);
    await save(29);
    for (const cursor of [unanchored.nextCursor, missing.nextCursor])
      await expect(app.call('files.changes', { ...scope, cursor })).rejects.toMatchObject({
        code: 'contentChanged',
      });
  } finally {
    await app.close();
  }
});

for (const kind of ['create', 'update'] as const) {
  test(`whole ${kind} undo follows an internal rename while protecting the actual entity`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-rename-undo-'));
    const app = new ManualApplication(join(root, 'profile'));
    try {
      await app.initialize();
      const project = await app.call('project.create', { path: join(root, 'project') });
      let edit = await app.call('files.save', {
        projectId: project.id,
        path: 'before.md',
        content: 'original',
      });
      if (kind === 'update') {
        const read = await app.call('files.read', { projectId: project.id, path: 'before.md' });
        edit = await app.call('files.save', {
          projectId: project.id,
          path: 'before.md',
          basis: read.basis,
          content: 'updated',
        });
      }
      await app.call('files.rename', {
        projectId: project.id,
        path: 'before.md',
        name: 'after.md',
        operationId: randomUUID(),
      });
      const undone = await app.call('files.undo', { projectId: project.id, editId: edit.id });
      expect(undone).toMatchObject({
        fileId: edit.fileId,
        revertsEditId: edit.id,
        origin: { kind: 'human' },
      });
      if (kind === 'create')
        await expect(readFile(join(project.path, 'after.md'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      else expect(await readFile(join(project.path, 'after.md'), 'utf8')).toBe('original');
    } finally {
      await app.close();
    }
  });
}

test('history registration failure preserves the saved file and never invents an edit source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-source-failure-'));
  const profile = join(root, 'profile');
  let app = new ManualApplication(profile);
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const saved = await app.call('files.save', {
      projectId: project.id,
      path: 'notes.md',
      content: 'original',
    });
    assert(saved.fileId);
    const store = app.projects.get(project.id);
    store.database.exec(
      "UPDATE edits SET value=json_remove(value,'$.origin','$.beforeEvidence','$.afterEvidence')",
    );
    const legacy = await app.call('files.edit', {
      projectId: project.id,
      fileId: saved.fileId,
      editId: saved.id,
    });
    expect(legacy.origin).toBeUndefined();
    store.database.exec(
      "CREATE TRIGGER reject_edit BEFORE INSERT ON edits BEGIN SELECT RAISE(ABORT, 'synthetic history failure'); END",
    );
    const read = await app.call('files.read', { projectId: project.id, path: 'notes.md' });
    await expect(
      app.call('files.save', {
        projectId: project.id,
        path: 'notes.md',
        basis: read.basis,
        content: 'published despite history failure',
      }),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
    expect(await readFile(join(project.path, 'notes.md'), 'utf8')).toBe(
      'published despite history failure',
    );
    store.database.exec('DROP TRIGGER reject_edit');
    await app.close();
    app = new ManualApplication(profile);
    await app.initialize();
    const changes = await app.call('files.changes', {
      projectId: project.id,
      fileId: saved.fileId,
    });
    expect(changes.changes.map((item) => item.editId)).toEqual([saved.id]);
    expect(changes.changes[0]?.origin).toBeUndefined();
    expect(changes.coverage.current).toBe('changedOrUnrecorded');
  } finally {
    await app.close();
  }
});

test('history follows stable identity across same-path replacement and create undo reports registration failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-replacement-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const first = await app.call('files.save', {
      projectId: project.id,
      path: 'same.md',
      content: 'old',
    });
    assert(first.fileId);
    await unlink(join(project.path, 'same.md'));
    const second = await app.call('files.save', {
      projectId: project.id,
      path: 'same.md',
      content: 'new',
    });
    assert(second.fileId);
    expect(second.fileId).not.toBe(first.fileId);
    const scope = { projectId: project.id, fileId: second.fileId };
    expect((await app.call('files.changes', scope)).changes.map((edit) => edit.editId)).toEqual([
      second.id,
    ]);
    await expect(app.call('files.edit', { ...scope, editId: first.id })).rejects.toMatchObject({
      code: 'notFound',
    });
    const store = app.projects.get(project.id);
    store.database.exec(
      "CREATE TRIGGER reject_undo BEFORE INSERT ON edits BEGIN SELECT RAISE(ABORT, 'synthetic undo history failure'); END",
    );
    await expect(
      app.call('files.undo', { projectId: project.id, editId: second.id }),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
    expect(await readFile(join(store.internal, 'reverted', second.id), 'utf8')).toBe('new');
    await expect(readFile(join(project.path, 'same.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect((await app.call('files.changes', scope)).changes.map((edit) => edit.editId)).toEqual([
      second.id,
    ]);
  } finally {
    await app.close();
  }
});

test('a real worker records its coarse source and the next instruction can query human changes', async () => {
  test.setTimeout(60000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-file-source-agent-'));
  let phase: 'save' | 'inspect' = 'save';
  let projectId = '',
    fileId = '',
    editId = '';
  let inspection = 0;
  let afterEditId: string | undefined;
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (phase === 'save')
        return calls.includes('write_file')
          ? { text: '已保存。' }
          : {
              tool: {
                name: 'write_file',
                input: { file_path: 'source.md', content: 'Synthetic process and next step.' },
              },
            };
      if (calls.filter((name) => name === 'get_file_changes').length < inspection)
        return {
          tool: {
            name: 'get_file_changes',
            input: { projectId, fileId, ...(afterEditId ? { afterEditId } : {}) },
          },
        };
      if (calls.filter((name) => name === 'read_file_edit').length < inspection)
        return { tool: { name: 'read_file_edit', input: { projectId, fileId, editId } } };
      return { text: '已核对实际人工更改。' };
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
    projectId = project.id;
    const session = await app.call('session.create', { projectId });
    const scope = { projectId, sessionId: session.id };
    const send = async (text: string) => {
      const receipt = await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text,
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 25000 })
        .toBe('completed');
      return receipt;
    };
    const receipt = await send('保存source.md作为合成过程材料。');
    const read = await app.call('files.read', { projectId, path: 'source.md' });
    const originalBytes = await readFile(join(project.path, 'source.md'));
    assert(read.fileId);
    fileId = read.fileId;
    const first = (await app.call('files.changes', { projectId, fileId })).changes[0];
    assert(first);
    expect(first.origin).toMatchObject({
      kind: 'execution',
      projectId,
      principal: { kind: 'agent', id: session.id },
      sessionId: session.id,
      runId: receipt.runId,
      instructionContext: { state: 'unknown' },
      tool: { state: 'unknown' },
    });
    const human = await app.call('files.save', {
      projectId,
      path: 'source.md',
      basis: read.basis,
      content: 'Explicit human correction and next step.',
    });
    editId = human.id;
    phase = 'inspect';
    inspection++;
    const inspected = await send('读取该文件的实际修改记录，核查人工更改。');
    const messages = (await app.snapshot(scope)).messages;
    const detail = messages.findLast((message) => message.tool?.name === 'read_file_edit');
    expect(detail?.state).toBe('complete');
    expect(JSON.parse(detail?.tool?.output ?? '{}')).toMatchObject({
      id: human.id,
      origin: { kind: 'human' },
      after: 'Explicit human correction and next step.',
    });
    const requestCount = model.requests.length;
    const undone = await app.call('files.undo', { projectId, editId: human.id });
    assert(human.afterEvidence && undone.beforeEvidence && undone.afterEvidence);
    expect(undone.beforeEvidence).toEqual(human.afterEvidence);
    const restored = await app.call('resources.describe', {
      locator: { source: 'project', projectId, fileId },
    });
    expect(undone.afterEvidence).toEqual({ ref: restored.ref, basis: restored.basis });
    expect(await readFile(join(project.path, 'source.md'))).toEqual(originalBytes);
    const undoRecord = await app.call('files.edit', { projectId, fileId, editId: undone.id });
    expect(undoRecord).toMatchObject({
      id: undone.id,
      fileId,
      origin: { kind: 'human' },
      before: human.after,
      after: read.content,
      beforeEvidence: undone.beforeEvidence,
      afterEvidence: undone.afterEvidence,
      revertsEditId: human.id,
    });
    expect((await app.snapshot(scope)).run).toMatchObject({
      id: inspected.runId,
      state: 'completed',
    });
    expect(model.requests).toHaveLength(requestCount);

    editId = undone.id;
    afterEditId = human.id;
    inspection++;
    const inspectedUndo = await send('读取人工修改之后的变化，核查实际撤销记录及恢复后的正文。');
    expect(inspectedUndo.runId).not.toBe(inspected.runId);
    const undoMessages = (await app.snapshot(scope)).messages.filter(
      (message) => message.tool?.runId === inspectedUndo.runId,
    );
    const changes = undoMessages.find((message) => message.tool?.name === 'get_file_changes');
    expect(changes?.state).toBe('complete');
    expect(JSON.parse(changes?.tool?.input ?? '{}')).toMatchObject({
      projectId,
      fileId,
      afterEditId: human.id,
    });
    expect(JSON.parse(changes?.tool?.output ?? '{}')).toMatchObject({
      changes: [{ editId: undone.id, fileId, origin: { kind: 'human' }, revertsEditId: human.id }],
      coverage: { anchor: 'matched', current: 'matchesLatest' },
    });
    const undoDetail = undoMessages.find((message) => message.tool?.name === 'read_file_edit');
    expect(undoDetail?.state).toBe('complete');
    expect(JSON.parse(undoDetail?.tool?.output ?? '{}')).toMatchObject({
      id: undone.id,
      fileId,
      origin: { kind: 'human' },
      before: human.after,
      after: read.content,
      beforeEvidence: undoRecord.beforeEvidence,
      afterEvidence: undoRecord.afterEvidence,
      revertsEditId: human.id,
    });
  } finally {
    await app.close();
    await model.close();
  }
});
