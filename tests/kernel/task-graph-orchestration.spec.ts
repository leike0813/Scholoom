import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { TaskGraphs } from '../../packages/projects/dist/task-graphs.js';
import {
  type CallContext,
  compileContract,
  OperationError,
} from '../../packages/protocol/dist/core.js';
import type { TaskMetadata, TaskPort } from '../../packages/protocol/dist/projects.js';
import type {
  ExecutionResourcePort,
  ResourcePort,
} from '../../packages/protocol/dist/resources.js';
import {
  type TaskCatalogPort,
  type TaskGraphInputs,
  type TaskResearchPort,
  taskGraphInputSnapshotSchema,
  taskGraphOperations,
} from '../../packages/protocol/dist/task-graph-contracts.js';

const body = '\r\n目标：比较样本。\r\n\r\n下一步：核查来源。\r\n';
const note = (metadata: TaskMetadata) =>
  `\uFEFF---\r\n${JSON.stringify(metadata)}\r\n---\r\n${body}`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-graphs-'));
  let research: TaskResearchPort;
  const app = new ManualApplication(join(root, 'profile'), {
    graphs: (...args) => research.graphs(...args),
    start: (...args) => research.start(...args),
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const source = await app.call('resources.create', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'source.md',
      content: '来源正文不复制到启动文字。',
    });
    assert(source.state === 'complete');
    const created = await app.call('tasks.create', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'tasks/compare.task.md',
      content: note({
        kind: 'research-task',
        formatVersion: 1,
        id: 'compare',
        title: '实际任务',
        status: 'active',
        workItems: [
          { id: 'compare', title: '比较' },
          { id: 'other', title: '其他' },
        ],
        links: [
          {
            id: 'source',
            role: 'source',
            target: { kind: 'project-file', fileId: source.resource.ref.fileId },
            basis: source.resource.basis,
            workItemId: 'compare',
          },
          {
            id: 'other-source',
            role: 'source',
            target: { kind: 'project-file', fileId: source.resource.ref.fileId },
            workItemId: 'other',
          },
          {
            id: 'process',
            role: 'process',
            target: { kind: 'project-file', fileId: source.resource.ref.fileId },
          },
        ],
      }),
    });
    assert(created.state === 'complete');
    const task = { projectId: project.id, taskId: 'compare', fileId: created.resource.ref.fileId };
    const read = await app.call('tasks.read', { task });
    const context: CallContext = {
      moduleId: 'product',
      role: 'product',
      principal: { kind: 'human', id: 'local' },
      projectId: project.id,
    };
    const tasks: TaskPort = {
      list: (input) => app.call('tasks.list', input),
      read: (input) => app.call('tasks.read', input),
      create: (input) => app.call('tasks.create', input),
      save: (input) => app.call('tasks.save', input),
    };
    const resources: Pick<ResourcePort, 'describe'> & Pick<ExecutionResourcePort, 'create'> = {
      describe: (locator) => app.call('resources.describe', { locator }),
      create: (input) => app.call('resources.create', input),
    };
    const catalog: TaskCatalogPort = {
      read: async (input) => {
        app.library.checkSelection(input);
        const source = await app.call('library.get', { sourceId: input.sourceId });
        app.library.checkSelection(input);
        return source;
      },
    };
    const starts: { input: Parameters<TaskResearchPort['start']>[0]; context: CallContext }[] = [];
    const pages: { input: Parameters<TaskResearchPort['graphs']>[0]; context: CallContext }[] = [];
    const controls: {
      onStart?: () => Promise<void>;
      error?: OperationError;
      reply?: Awaited<ReturnType<TaskResearchPort['start']>>;
    } = {};
    research = {
      graphs: async (input, context) => {
        pages.push({ input, context });
        return {
          graphs: [
            {
              name: '固定测试图',
              definition: {
                graphId: 'fixture',
                version: '1',
                stateFormatVersion: '1',
                configSchema: { type: 'object' },
              },
            },
          ],
        };
      },
      start: async (input, context) => {
        starts.push({ input, context });
        await controls.onStart?.();
        if (controls.error) throw controls.error;
        return (
          controls.reply ?? {
            invocationId: input.invocationId,
            instructionId: input.instructionId,
            runId: 'fixture-run',
          }
        );
      },
    };
    const input: TaskGraphInputs['tasks.runGraph'] = {
      task,
      basis: read.entry.basis,
      sessionId: 'selected-idle-session',
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      processOperationId: randomUUID(),
      graphId: 'fixture',
      version: '1',
      config: { goal: '核查样本' },
      sourceLinkIds: ['source'],
      workItemId: 'compare',
    };
    return {
      app,
      root,
      project,
      source: source.resource,
      read,
      context,
      tasks,
      resources,
      catalog,
      research,
      starts,
      pages,
      controls,
      input,
      graphs: new TaskGraphs(tasks, resources, research, catalog),
      close: async () => {
        await app.close();
        await rm(root, { recursive: true });
      },
    };
  } catch (error) {
    await app.close();
    await rm(root, { recursive: true });
    throw error;
  }
}

test('the product broker mounts the injected research seam with real task and process saves', async () => {
  const f = await fixture();
  try {
    expect(
      (await f.app.call('tasks.graphs', { projectId: f.project.id, limit: 25 })).graphs,
    ).toHaveLength(1);
    const result = await f.app.call('tasks.runGraph', f.input);
    expect(result.taskAssociation.state).toBe('confirmed');
    const changes = await f.app.call('files.changes', {
      projectId: f.project.id,
      fileId: f.input.task.fileId,
    });
    expect(changes.changes[0]?.origin).toMatchObject({
      kind: 'human',
      principal: { kind: 'human', id: 'local' },
    });
    expect(f.starts[0]?.context).toMatchObject({
      role: 'product',
      principal: { kind: 'human', id: 'local' },
    });
    assert(result.inputSnapshot?.resource.path);
    expect(f.starts[0]?.input.materials).toEqual(
      expect.arrayContaining([
        {
          ref: result.inputSnapshot.resource.ref,
          basis: result.inputSnapshot.resource.basis,
          role: 'task-input',
        },
      ]),
    );
    expect(
      JSON.parse(await readFile(join(f.project.path, result.inputSnapshot.resource.path), 'utf8')),
    ).toMatchObject({
      formatVersion: 1,
      task: f.input.task,
      entry: f.read.entry,
      content: f.read.content,
    });
    expect(
      (await f.app.call('tasks.read', { task: f.input.task })).metadata.links?.some(
        (link) => link.id === f.input.processOperationId,
      ),
    ).toBe(true);
    expect(result.call.runId).toBe('fixture-run');
  } finally {
    await f.close();
  }
});

async function catalogCandidate(f: Awaited<ReturnType<typeof fixture>>) {
  await f.app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
  const batch = await f.app.call('library.ingest', {
    batchId: randomUUID(),
    origin: 'task-catalog-test',
    version: 'preprint-v2',
    json: JSON.stringify([{ title: '只有题录的候选' }]),
  });
  await expect
    .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
    .toBe('completed');
  const sourceId = (await f.app.call('library.batch', { batchId: batch.id })).entries[0]?.sourceId;
  assert(sourceId);
  const source = await f.app.call('library.get', { sourceId });
  const libraryId = (await f.app.call('library.status', {})).id;
  const read = await f.tasks.save({
    task: f.input.task,
    basis: f.read.entry.basis,
    content: note({
      ...f.read.metadata,
      links: [
        ...(f.read.metadata.links ?? []),
        {
          id: 'catalog',
          role: 'source',
          basis: source.version,
          target: { kind: 'library-source', libraryId, sourceId },
        },
      ],
    }),
  });
  return {
    source,
    libraryId,
    read,
    input: { ...f.input, basis: read.entry.basis, sourceLinkIds: ['catalog'] },
  };
}

test('catalog candidates keep real identity and immutable v2 input when full text arrives later', async () => {
  const f = await fixture();
  try {
    const c = await catalogCandidate(f);
    expect(c.source.attachmentState).toBe('unavailable');
    const first = await f.app.call('tasks.runGraph', c.input);
    assert(first.inputSnapshot?.resource.path);
    const path = join(f.project.path, first.inputSnapshot.resource.path);
    const original = await readFile(path, 'utf8');
    const captured = JSON.parse(original);
    expect(captured).toMatchObject({ formatVersion: 2, task: c.input.task, entry: c.read.entry });
    expect(captured.sources).toEqual([
      {
        linkId: 'catalog',
        catalog: {
          libraryId: c.libraryId,
          sourceId: c.source.id,
          version: 'preprint-v2',
          revision: c.source.revision,
        },
      },
    ]);
    const contract = compileContract({
      params: taskGraphInputSnapshotSchema,
      result: taskGraphInputSnapshotSchema,
    });
    expect(contract.result(captured)).toBe(true);
    expect(contract.result({ ...captured, formatVersion: 1 })).toBe(false);
    expect(f.starts[0]?.input.materials).toEqual([
      {
        ref: first.inputSnapshot.resource.ref,
        basis: first.inputSnapshot.resource.basis,
        role: 'task-input',
      },
    ]);
    expect(f.starts[0]?.input.text).not.toContain(c.source.metadata.title);

    const fullText = join(f.root, 'candidate.txt');
    await writeFile(fullText, '后补真实正文。');
    const batch = await f.app.call('library.importFiles', {
      batchId: randomUUID(),
      sourceId: c.source.id,
      paths: [fullText],
      purpose: '正文',
      storage: 'managed',
      version: 'preprint-v2',
      origin: 'task-catalog-test',
    });
    await expect
      .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const current = await f.app.call('library.get', { sourceId: c.source.id });
    expect(current).toMatchObject({
      id: c.source.id,
      version: 'preprint-v2',
      attachmentState: 'recorded',
    });
    expect(
      (await f.app.call('library.attachments', { sourceId: c.source.id })).attachments[0]?.state,
    ).toBe('available');
    const read = await f.tasks.read({ task: f.input.task });
    f.controls.onStart = async () => {
      const entry = await f.tasks.read({ task: f.input.task });
      await f.tasks.save({
        task: entry.task,
        basis: entry.entry.basis,
        content: `${entry.content}\n人工补充。`,
      });
    };
    const next = {
      ...c.input,
      basis: read.entry.basis,
      sessionId: 'next-selected-idle-session',
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      processOperationId: randomUUID(),
      sourceLinkIds: ['catalog', 'source'],
    };
    const second = await f.app.call('tasks.runGraph', next);
    assert(second.inputSnapshot?.resource.path);
    const later = JSON.parse(
      await readFile(join(f.project.path, second.inputSnapshot.resource.path), 'utf8'),
    );
    expect(later.sources).toEqual([
      {
        linkId: 'catalog',
        catalog: {
          libraryId: c.libraryId,
          sourceId: current.id,
          version: current.version,
          revision: current.revision,
        },
      },
      { linkId: 'source', evidence: { ref: f.source.ref, basis: f.source.basis, role: 'source' } },
    ]);
    expect(contract.result(later)).toBe(true);
    expect(f.starts[1]?.input.materials).toHaveLength(2);
    expect(second.taskAssociation).toMatchObject({
      state: 'failed',
      error: { code: 'contentChanged' },
    });
    expect(second.process.state).toBe('complete');
    expect(await readFile(path, 'utf8')).toBe(original);
    expect((await f.tasks.read({ task: f.input.task })).content).toContain('人工补充');
  } finally {
    await f.close();
  }
});

test('catalog task admission refuses revoked access, foreign libraries and wrong versions without rebinding by title', async () => {
  const f = await fixture();
  try {
    const c = await catalogCandidate(f);
    for (const grants of [
      { read: false, send: true },
      { read: true, send: false },
    ]) {
      await f.app.call('library.grant', { ...grants, write: true, autoBackup: false });
      await expect(f.app.call('tasks.runGraph', c.input)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
    }
    await f.app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    let read = c.read;
    for (const [target, basis, code] of [
      [
        { kind: 'library-source', libraryId: 'foreign-library', sourceId: c.source.id },
        c.source.version,
        'instanceMismatch',
      ],
      [
        { kind: 'library-source', libraryId: c.libraryId, sourceId: 'missing-original-source' },
        c.source.version,
        'notFound',
      ],
      [
        { kind: 'library-source', libraryId: c.libraryId, sourceId: c.source.id },
        'other-version',
        'contentChanged',
      ],
    ] as const) {
      read = await f.tasks.save({
        task: read.task,
        basis: read.entry.basis,
        content: note({
          ...read.metadata,
          links: [{ id: 'catalog', role: 'source', target, basis }],
        }),
      });
      await expect(
        f.app.call('tasks.runGraph', { ...c.input, basis: read.entry.basis }),
      ).rejects.toMatchObject({ code });
    }
    expect(f.starts).toHaveLength(0);
  } finally {
    await f.close();
  }
});

for (const change of ['revision', 'permission'] as const) {
  test(`catalog ${change} changes after input publication preserve history and refuse research admission`, async () => {
    const f = await fixture();
    try {
      const c = await catalogCandidate(f);
      const graphs = new TaskGraphs(
        f.tasks,
        {
          ...f.resources,
          create: async (input) => {
            const result = await f.resources.create(input);
            if (change === 'permission')
              await f.app.call('library.grant', {
                read: true,
                send: false,
                write: true,
                autoBackup: false,
              });
            else
              await f.app.call('library.update', {
                sourceId: c.source.id,
                revision: c.source.revision,
                metadata: { ...c.source.metadata, title: '人工更正题名' },
                tags: c.source.tags,
                collectionIds: c.source.collectionIds,
                relatedIds: c.source.relatedIds,
              });
            return result;
          },
        },
        f.research,
        f.catalog,
      );
      await expect(graphs.run(c.input, f.context)).rejects.toMatchObject({
        code: change === 'permission' ? 'permissionDenied' : 'contentChanged',
      });
      expect(f.starts).toHaveLength(0);
      const captured = JSON.parse(
        await readFile(
          join(f.project.path, `tasks/${c.input.processOperationId}.graph-input.md`),
          'utf8',
        ),
      );
      expect(captured.sources[0]?.catalog).toMatchObject({
        sourceId: c.source.id,
        revision: c.source.revision,
      });
      expect((await f.tasks.read({ task: c.input.task })).content).toBe(c.read.content);
    } finally {
      await f.close();
    }
  });
}

test('a product without the actual research adapter has an unavailable empty catalog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-no-research-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const result = await app.call('tasks.graphs', { projectId: project.id, limit: 25 });
    expect(result.graphs).toEqual([]);
    expect(result.unavailableReason).toBeTruthy();
  } finally {
    await app.close();
  }
});

test('task graphs derive current project and library evidence from the real entry and preserve its BOM/body', async () => {
  const f = await fixture();
  try {
    await f.app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const path = join(f.root, 'library.md');
    await writeFile(path, '库来源正文不复制到启动文字。');
    const batch = await f.app.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [path],
      storage: 'linked',
      purpose: '正文',
      version: 'unspecified',
      origin: 'task-graph-test',
    });
    await expect
      .poll(async () => (await f.app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const receipt = (await f.app.call('library.batch', { batchId: batch.id })).entries[0];
    assert(receipt?.attachmentId);
    const attachment = await f.app.call('library.attachment', {
      attachmentId: receipt.attachmentId,
    });
    const library = await f.app.call('resources.describe', {
      locator: {
        source: 'library',
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      },
    });
    let read = await f.tasks.save({
      task: f.input.task,
      basis: f.input.basis,
      content: note({
        ...f.read.metadata,
        links: [
          ...(f.read.metadata.links ?? []),
          {
            id: 'library',
            role: 'source',
            target: {
              kind: 'library-material',
              attachmentId: attachment.id,
              materialVersionId: attachment.materialVersionId,
            },
          },
        ],
      }),
    });
    const invalid = await f.tasks.save({
      task: f.input.task,
      basis: read.entry.basis,
      content: note({
        ...read.metadata,
        links:
          read.metadata.links?.map((link) =>
            link.target.kind === 'library-material'
              ? { ...link, target: { ...link.target, materialVersionId: 'self-reported-version' } }
              : link,
          ) ?? [],
      }),
    });
    await expect(
      f.graphs.run(
        { ...f.input, basis: invalid.entry.basis, sourceLinkIds: ['library'] },
        f.context,
      ),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    read = await f.tasks.save({
      task: f.input.task,
      basis: invalid.entry.basis,
      content: read.content,
    });
    const input = { ...f.input, basis: read.entry.basis, sourceLinkIds: ['library', 'source'] };
    await rename(path, `${path}.held`);
    await expect(f.graphs.run(input, f.context)).rejects.toMatchObject({ code: 'unavailable' });
    await rename(`${path}.held`, path);
    expect(f.starts).toHaveLength(0);
    const listed = await f.graphs.list({ projectId: f.project.id, offset: 2, limit: 5 }, f.context);
    expect(listed.graphs[0]?.definition.graphId).toBe('fixture');
    expect(f.pages).toEqual([{ input: { offset: 2, limit: 5 }, context: f.context }]);
    const result = await f.graphs.run(input, f.context);
    expect(compileContract(taskGraphOperations['tasks.runGraph']).result(result)).toBe(true);
    expect(result.taskAssociation.state).toBe('confirmed');
    expect(f.starts).toHaveLength(1);
    expect(f.starts[0]?.context).toBe(f.context);
    assert(result.inputSnapshot);
    expect(f.starts[0]?.input).toEqual({
      projectId: f.project.id,
      sessionId: input.sessionId,
      invocationId: input.invocationId,
      instructionId: input.instructionId,
      graphId: input.graphId,
      version: input.version,
      config: input.config,
      materials: [
        {
          ref: result.inputSnapshot.resource.ref,
          basis: result.inputSnapshot.resource.basis,
          role: 'task-input',
        },
        { ref: library.ref, basis: library.basis, role: 'source' },
        { ref: f.source.ref, basis: f.source.basis, role: 'source' },
      ],
      text: read.content,
    });
    assert(result.process.state === 'complete');
    const pointer = await readFile(
      join(f.project.path, `tasks/${input.processOperationId}.graph-call.md`),
      'utf8',
    );
    expect(JSON.parse(pointer)).toMatchObject({
      ...result.call,
      inputSnapshot: {
        ref: result.inputSnapshot.resource.ref,
        basis: result.inputSnapshot.resource.basis,
        role: 'task-input',
      },
    });
    const saved = await f.tasks.read({ task: input.task });
    expect(saved.content.startsWith('\uFEFF')).toBe(true);
    expect(saved.content.slice(saved.content.indexOf('\r\n---\r\n') + '\r\n---\r\n'.length)).toBe(
      body,
    );
    expect(saved.metadata.links?.find((link) => link.id === input.processOperationId)).toEqual({
      id: input.processOperationId,
      role: 'process',
      workItemId: 'compare',
      basis: result.process.resource.basis,
      target: { kind: 'project-file', fileId: result.process.resource.ref.fileId },
    });
    await expect(
      f.graphs.run({ ...input, basis: saved.entry.basis }, f.context),
    ).rejects.toMatchObject({ code: 'targetAmbiguous' });
    expect(f.starts).toHaveLength(1);
  } finally {
    await f.close();
  }
});

test('task graph boundary rejects forged evidence, unsafe operation identities and foreign source/work scopes before starting', async () => {
  const f = await fixture();
  try {
    const cases: [Partial<TaskGraphInputs['tasks.runGraph']> & { materials?: unknown }, string][] =
      [
        [{ basis: 'self-reported-version' }, 'contentChanged'],
        [{ workItemId: 'missing' }, 'notFound'],
        [{ sourceLinkIds: ['missing'] }, 'notFound'],
        [{ sourceLinkIds: ['process'] }, 'invalidRequest'],
        [{ sourceLinkIds: ['other-source'] }, 'invalidRequest'],
        [{ sourceLinkIds: ['source', 'source'] }, 'invalidRequest'],
        [{ processOperationId: '../escape' }, 'invalidRequest'],
        [{ processOperationId: 'a'.repeat(97) }, 'invalidRequest'],
        [{ processOperationId: 'source' }, 'targetAmbiguous'],
        [{ materials: [{ ref: f.source.ref, basis: 'forged' }] }, 'invalidRequest'],
      ];
    for (const [changes, code] of cases) {
      await expect(f.graphs.run({ ...f.input, ...changes }, f.context)).rejects.toMatchObject({
        code,
      });
    }
    for (const context of [
      { ...f.context, projectId: 'other-project' },
      { ...f.context, role: 'host' as const },
      { ...f.context, principal: { kind: 'agent' as const, id: 'agent' } },
    ]) {
      await expect(f.graphs.run(f.input, context)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
      await expect(f.graphs.list({ projectId: f.project.id }, context)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
    }
    expect(f.starts).toHaveLength(0);
  } finally {
    await f.close();
  }
});

test('actual source changes and old entry evidence are refused without starting or creating a pointer', async () => {
  const f = await fixture();
  try {
    await f.app.call('resources.save', {
      ref: f.source.ref,
      basis: f.source.basis,
      content: '人工更新来源。',
    });
    await expect(f.graphs.run(f.input, f.context)).rejects.toMatchObject({
      code: 'contentChanged',
    });
    const changed = await f.tasks.save({
      task: f.input.task,
      basis: f.input.basis,
      content: `${f.read.content}\r\n人工后续决定。`,
    });
    await expect(f.graphs.run({ ...f.input, sourceLinkIds: [] }, f.context)).rejects.toMatchObject({
      code: 'contentChanged',
    });
    expect((await f.tasks.read({ task: f.input.task })).entry.basis).toBe(changed.entry.basis);
    expect(f.starts).toHaveLength(0);
    await expect(
      stat(join(f.project.path, `tasks/${f.input.processOperationId}.graph-call.md`)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await f.close();
  }
});

test('an entry conflict after start retains the actual call, process file and manual changes without retrying', async () => {
  const f = await fixture();
  try {
    const manual = `${f.read.content}\r\n人工新增要求，不可回滚。`;
    f.controls.onStart = async () => {
      await writeFile(join(f.project.path, f.read.path), manual);
    };
    const result = await f.graphs.run(f.input, f.context);
    expect(result.taskAssociation).toMatchObject({
      state: 'failed',
      error: { code: 'contentChanged' },
    });
    expect(result.process.state).toBe('complete');
    expect(
      JSON.parse(
        await readFile(
          join(f.project.path, `tasks/${f.input.processOperationId}.graph-call.md`),
          'utf8',
        ),
      ),
    ).toMatchObject(result.call);
    expect((await f.tasks.read({ task: f.input.task })).content).toBe(manual);
    expect(
      await f.app.call('resources.creation', {
        projectId: f.project.id,
        operationId: f.input.processOperationId,
      }),
    ).toEqual(result.process);
    expect(f.starts).toHaveLength(1);
  } finally {
    await f.close();
  }
});

test('a published entry whose history registration fails reports association unknown and retains the pointer', async () => {
  const f = await fixture();
  try {
    f.controls.onStart = async () => {
      f.app.projects
        .get(f.project.id)
        .database.exec(
          "CREATE TRIGGER reject_graph_association BEFORE INSERT ON edits WHEN NEW.path = 'tasks/compare.task.md' BEGIN SELECT RAISE(ABORT, 'synthetic task history failure'); END",
        );
    };
    const result = await f.graphs.run(f.input, f.context);
    expect(result.taskAssociation).toMatchObject({
      state: 'unknown',
      error: { code: 'outcomeUnknown' },
    });
    expect(result.process.state).toBe('complete');
    expect(
      JSON.parse(
        await readFile(
          join(f.project.path, `tasks/${f.input.processOperationId}.graph-call.md`),
          'utf8',
        ),
      ),
    ).toMatchObject(result.call);
    expect(
      (await f.tasks.read({ task: f.input.task })).metadata.links?.some(
        (link) => link.id === f.input.processOperationId,
      ),
    ).toBe(true);
    expect(f.starts).toHaveLength(1);
  } finally {
    await f.close();
  }
});

for (const state of ['failed', 'unknown'] as const) {
  test(`process creation ${state} retains the call and leaves task association pending`, async () => {
    const f = await fixture();
    try {
      const path = `tasks/${f.input.processOperationId}.graph-call.md`;
      if (state === 'failed') {
        await f.resources.create({
          projectId: f.project.id,
          operationId: randomUUID(),
          path,
          content: '已有文件不得覆盖。',
        });
      } else {
        f.controls.onStart = async () => {
          f.app.projects
            .get(f.project.id)
            .database.exec(
              "CREATE TRIGGER reject_graph_pointer BEFORE INSERT ON file_references BEGIN SELECT RAISE(ABORT, 'synthetic registration failure'); END",
            );
        };
      }
      const result = await f.graphs.run(f.input, f.context);
      expect(result.process.state).toBe(state);
      expect(result.call.runId).toBe('fixture-run');
      expect(result.taskAssociation.state).toBe('pending');
      expect((await f.tasks.read({ task: f.input.task })).content).toBe(f.read.content);
      const saved = await readFile(join(f.project.path, path), 'utf8');
      if (state === 'failed') expect(saved).toBe('已有文件不得覆盖。');
      else expect(JSON.parse(saved)).toMatchObject(result.call);
      expect(f.starts).toHaveLength(1);
    } finally {
      await f.close();
    }
  });
}

test('unconfirmed input publication preserves its operation and never starts research', async () => {
  const f = await fixture();
  try {
    f.app.projects
      .get(f.project.id)
      .database.exec(
        "CREATE TRIGGER reject_input BEFORE INSERT ON file_references BEGIN SELECT RAISE(ABORT, 'synthetic input registration failure'); END",
      );
    await expect(f.graphs.run(f.input, f.context)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    expect(f.starts).toHaveLength(0);
    const operationId = `${f.input.processOperationId}_input`;
    f.app.projects.get(f.project.id).database.exec('DROP TRIGGER reject_input');
    expect(
      await f.app.call('resources.creation', { projectId: f.project.id, operationId }),
    ).toMatchObject({ operationId, state: 'complete' });
    expect(
      JSON.parse(
        await readFile(
          join(f.project.path, `tasks/${f.input.processOperationId}.graph-input.md`),
          'utf8',
        ),
      ),
    ).toMatchObject({ task: f.input.task, entry: f.read.entry, content: f.read.content });
    await expect(
      stat(join(f.project.path, `tasks/${f.input.processOperationId}.graph-call.md`)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await f.tasks.read({ task: f.input.task })).content).toBe(f.read.content);
  } finally {
    await f.close();
  }
});

for (const outcome of [
  'unknown',
  'mismatched-identity',
  'wrong-project',
  'wrong-session',
] as const) {
  test(`start ${outcome} preserves the original request and does not retry or invent a call pointer`, async () => {
    const f = await fixture();
    try {
      const request = structuredClone(f.input);
      if (outcome === 'unknown')
        f.controls.error = new OperationError('outcomeUnknown', '受理结果待核查。');
      else if (outcome === 'mismatched-identity')
        f.controls.reply = {
          invocationId: 'different-call',
          instructionId: f.input.instructionId,
          runId: 'returned-run',
        };
      else {
        const reply = {
          invocationId: f.input.invocationId,
          instructionId: f.input.instructionId,
          runId: 'returned-run',
          ...(outcome === 'wrong-project'
            ? { projectId: 'other-project' }
            : { sessionId: 'other-session' }),
        };
        f.controls.reply = reply;
      }
      await expect(f.graphs.run(f.input, f.context)).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
      expect(f.input).toEqual(request);
      expect(f.starts).toHaveLength(1);
      expect(f.starts[0]?.input).toMatchObject({
        invocationId: request.invocationId,
        instructionId: request.instructionId,
      });
      expect((await f.tasks.read({ task: f.input.task })).content).toBe(f.read.content);
      await expect(
        stat(join(f.project.path, `tasks/${f.input.processOperationId}.graph-call.md`)),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await f.close();
    }
  });
}
