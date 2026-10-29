import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { initializeProjectContainer } from '../../apps/kernel/dist/storage/project-container.js';
import { Projects, ProjectTasks } from '../../packages/projects/dist/node.js';
import type { TaskMetadata, TaskRef } from '../../packages/protocol/dist/projects.js';

const note = (
  id: string,
  body = '目标：比较测量方案。\n障碍：样本待补充。\n下一步：核对条件。',
  extra: Partial<TaskMetadata> = {},
) =>
  `---\n${JSON.stringify({ kind: 'research-task', formatVersion: 1, id, title: '比较测量方案', status: 'active', ...extra })}\n---\n\n${body}\n`;

test('file-backed tasks can be created and resumed without a session or a model', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-tasks-'));
  let projects = new Projects(join(root, 'profile'), initializeProjectContainer);
  try {
    await projects.initialize();
    const store = await projects.create(join(root, 'project'));
    store.grant({ trust: 'restricted', autoBackup: false });
    const tasks = new ProjectTasks(store);
    expect((await tasks.list()).tasks).toEqual([]);
    await expect(stat(join(store.project.path, 'tasks'))).rejects.toMatchObject({ code: 'ENOENT' });
    const id = randomUUID();
    const content = note(id);
    const created = await tasks.create(
      { path: `tasks/${id}.task.md`, content },
      { operationId: randomUUID(), owner: 'human:test' },
    );
    assert(created.fileId);
    const task = { projectId: store.project.id, taskId: id, fileId: created.fileId };
    expect((await tasks.read(task)).content).toBe(content);
    expect((await tasks.list()).tasks.map((entry) => entry.task)).toEqual([task]);
    expect(await readFile(join(store.project.path, created.path), 'utf8')).toBe(content);
    await projects.close();
    projects = new Projects(join(root, 'profile'), initializeProjectContainer);
    await projects.initialize();
    const resumed = await new ProjectTasks(projects.get(task.projectId)).read(task);
    expect(resumed.metadata.id).toBe(id);
    expect(resumed.content).toContain('下一步');
  } finally {
    await projects.close();
    await rm(root, { recursive: true });
  }
});

test('task discovery bounds scanned entries and diagnoses damaged and duplicate entries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-pages-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    const scope = { projectId: project.id };
    expect((await app.call('tasks.list', scope)).tasks).toEqual([]);
    await mkdir(join(project.path, 'tasks'));
    await writeFile(join(project.path, 'tasks', '0-readme.md'), 'ordinary project file');
    await writeFile(join(project.path, 'tasks', '1-broken.task.md'), '---\n{ broken\n---\n');
    await writeFile(join(project.path, 'tasks', '2-first.task.md'), note('shared'));
    await writeFile(join(project.path, 'tasks', '3-second.task.md'), note('shared'));
    const first = await app.call('tasks.list', { ...scope, limit: 1 });
    assert(first.version);
    expect(first.tasks).toEqual([]);
    expect(first.nextOffset).toBe(1);
    const broken = await app.call('tasks.list', {
      ...scope,
      offset: 1,
      limit: 1,
      version: first.version,
    });
    expect(broken.issues[0]?.error.code).toBe('invalidRequest');
    expect(broken.nextOffset).toBe(2);
    const duplicates = await app.call('tasks.list', {
      ...scope,
      offset: 2,
      limit: 2,
      version: first.version,
    });
    expect(duplicates.tasks.map((task) => task.task.taskId)).toEqual(['shared', 'shared']);
    expect(new Set(duplicates.tasks.map((task) => task.task.fileId)).size).toBe(2);
    expect(duplicates.issues[0]?.error.code).toBe('targetAmbiguous');
    await writeFile(join(project.path, 'tasks', '4-later.task.md'), note('later'));
    await expect(
      app.call('tasks.list', { ...scope, version: first.version }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('task saves protect manual changes and retain saved process materials when association conflicts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-save-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    const id = randomUUID();
    const operationId = randomUUID();
    const created = await app.call('tasks.create', {
      projectId: project.id,
      operationId,
      path: `tasks/${id}.task.md`,
      content: note(id),
    });
    assert(created.state === 'complete');
    const task: TaskRef = {
      projectId: project.id,
      taskId: id,
      fileId: created.resource.ref.fileId,
    };
    const prior = await app.call('tasks.read', { task });
    const process = await app.call('resources.create', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'comparison.md',
      content: '完整方法比较。\n'.repeat(2000),
    });
    assert(process.state === 'complete');
    const manual = note(id, '人工补充：先核对样本；下一步读取比较材料。');
    await writeFile(join(project.path, prior.path), manual);
    const candidate = note(id, '下一步核对比较结果。', {
      links: [
        {
          id: 'comparison',
          role: 'process',
          target: { kind: 'project-file', fileId: process.resource.ref.fileId },
        },
      ],
    });
    await expect(
      app.call('tasks.save', { task, basis: prior.entry.basis, content: candidate }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect((await app.call('tasks.read', { task })).content).toBe(manual);
    expect(await readFile(join(project.path, 'comparison.md'), 'utf8')).toContain('完整方法比较');
    const fresh = await app.call('tasks.read', { task });
    const linked = await app.call('tasks.save', {
      task,
      basis: fresh.entry.basis,
      content: candidate,
    });
    expect(linked.metadata.links?.[0]?.target).toEqual({
      kind: 'project-file',
      fileId: process.resource.ref.fileId,
    });
    expect(
      (await app.call('resources.creation', { projectId: project.id, operationId })).state,
    ).toBe('complete');
    await app.call('files.rename', {
      projectId: project.id,
      path: linked.path,
      name: 'renamed.task.md',
      expectedFileId: task.fileId,
      operationId: randomUUID(),
    });
    expect((await app.call('tasks.read', { task })).path).toBe('tasks/renamed.task.md');
    expect((await app.call('tasks.list', { projectId: project.id })).tasks[0]?.task).toEqual(task);
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('redirecting one task library link preserves another task adoption and both material identities', async () => {
  const root = test.info().outputPath('shared-library-tasks');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'restricted',
    });
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const sharedPath = join(root, 'shared.md');
    const alternativePath = join(root, 'alternative.md');
    const paths = [sharedPath, alternativePath];
    await writeFile(sharedPath, 'shared source: large-sample method\n');
    await writeFile(alternativePath, 'alternative source: small-sample method\n');
    const batch = await app.call('library.importFiles', {
      batchId: randomUUID(),
      paths,
      storage: 'managed',
      purpose: '正文',
      version: 'unspecified',
      origin: 'task-local-redirection',
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const entries = (await app.call('library.batch', { batchId: batch.id })).entries;
    const attachments = await Promise.all(
      entries.map((entry) => {
        assert(entry.attachmentId);
        return app.call('library.attachment', { attachmentId: entry.attachmentId });
      }),
    );
    const original = attachments.find((attachment) => attachment.name === 'shared.md');
    const alternative = attachments.find((attachment) => attachment.name === 'alternative.md');
    assert(original && alternative);
    const resource = (attachment: typeof original) => ({
      source: 'library' as const,
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    });
    const refs: TaskRef[] = [];
    for (const [id, judgment] of [
      ['task-a', '排除：当前样本规模不满足此来源的前提。'],
      ['task-b', '采用：本任务样本规模满足该来源前提。'],
    ] as const) {
      const created = await app.call('tasks.create', {
        projectId: project.id,
        path: `tasks/${id}.task.md`,
        operationId: randomUUID(),
        content: note(id, '研究依据和下一步只属于本任务。', {
          links: [
            {
              id: 'method',
              role: 'source',
              target: {
                kind: 'library-material',
                attachmentId: original.id,
                materialVersionId: original.materialVersionId,
              },
              basis: original.materialVersionId,
              note: judgment,
            },
          ],
        }),
      });
      assert(created.state === 'complete');
      refs.push({ projectId: project.id, taskId: id, fileId: created.resource.ref.fileId });
    }
    const [taskA, taskB] = refs;
    assert(taskA && taskB);
    const a = await app.call('tasks.read', { task: taskA });
    const b = await app.call('tasks.read', { task: taskB });
    assert(a.metadata.links && b.metadata.links);
    expect(a.metadata.links?.[0]?.target).toEqual(b.metadata.links?.[0]?.target);
    const reason = '仅将A的method引用重定向至小样本方法；原来源仍排除，不代表已读新来源。';
    const candidate = note(a.metadata.id, '研究依据和下一步只属于本任务。', {
      ...a.metadata,
      links: a.metadata.links.map((link) =>
        link.id === 'method'
          ? {
              ...link,
              target: {
                kind: 'library-material' as const,
                attachmentId: alternative.id,
                materialVersionId: alternative.materialVersionId,
              },
              basis: alternative.materialVersionId,
              note: reason,
            }
          : link,
      ),
    });
    const changed = await app.call('tasks.save', {
      task: taskA,
      basis: a.entry.basis,
      content: candidate,
    });
    expect(changed.metadata.links).toEqual([
      {
        ...a.metadata.links?.[0],
        target: {
          kind: 'library-material',
          attachmentId: alternative.id,
          materialVersionId: alternative.materialVersionId,
        },
        basis: alternative.materialVersionId,
        note: reason,
      },
    ]);
    const bAfter = await app.call('tasks.read', { task: taskB });
    expect(bAfter).toEqual(b);
    expect(await readFile(join(project.path, b.path), 'utf8')).toBe(b.content);
    expect(await readFile(join(project.path, changed.path), 'utf8')).toBe(candidate);
    const attachmentsAfter = await Promise.all(
      attachments.map((attachment) =>
        app.call('library.attachment', { attachmentId: attachment.id }),
      ),
    );
    expect(attachmentsAfter).toEqual(attachments);
    for (const attachment of attachments) {
      expect(
        (await app.call('library.attachments', { sourceId: attachment.sourceId })).attachments,
      ).toEqual([attachment]);
    }
    expect(
      (
        await app.call('resources.read', {
          ref: resource(original),
          basis: original.materialVersionId,
          encoding: 'utf8',
        })
      ).data,
    ).toBe('shared source: large-sample method\n');
    expect(
      (
        await app.call('resources.read', {
          ref: resource(alternative),
          basis: alternative.materialVersionId,
          encoding: 'utf8',
        })
      ).data,
    ).toBe('alternative source: small-sample method\n');
    await writeFile(
      test.info().outputPath('task-local-redirection.json'),
      JSON.stringify(
        { aBefore: a, aAfter: changed, bBefore: b, bAfter, attachments, attachmentsAfter },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
});

test('same-content entry replacement and changed task identity cannot be saved with old evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-identity-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const content = note('original');
    const created = await app.call('tasks.create', {
      projectId: project.id,
      path: 'tasks/identity.task.md',
      operationId: randomUUID(),
      content,
    });
    assert(created.state === 'complete');
    const task = { projectId: project.id, taskId: 'original', fileId: created.resource.ref.fileId };
    const read = await app.call('tasks.read', { task });
    await rename(join(project.path, read.path), join(project.path, 'kept-original.md'));
    await writeFile(join(project.path, read.path), content);
    await expect(
      app.call('tasks.save', {
        task,
        basis: read.entry.basis,
        content: note('original', '过期覆盖'),
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    expect(await readFile(join(project.path, read.path), 'utf8')).toBe(content);
    await writeFile(join(project.path, read.path), note('different'));
    await expect(app.call('tasks.read', { task })).rejects.toMatchObject({
      code: 'contentChanged',
    });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('task metadata validates work-item relationships and refuses invalid writes without altering files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-plan-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const path = 'tasks/plan.task.md';
    for (const workItems of [
      [{ id: 'a', title: 'A', dependsOn: ['missing'] }],
      [
        { id: 'a', title: 'A', dependsOn: ['b'] },
        { id: 'b', title: 'B', dependsOn: ['a'] },
      ],
      [{ id: 'a', title: 'A', planLinkId: 'missing' }],
    ]) {
      await expect(
        app.call('tasks.create', {
          projectId: project.id,
          path,
          operationId: randomUUID(),
          content: note('plan', '目标', { workItems }),
        }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
    }
    for (const [content, code] of [
      [note('plan', '未知版本', { formatVersion: 2 as 1 }), 'unavailable'],
      [note('plan', '中文'.repeat(70000)), 'tooLarge'],
    ] as const) {
      await expect(
        app.call('tasks.create', {
          projectId: project.id,
          path,
          operationId: randomUUID(),
          content,
        }),
      ).rejects.toMatchObject({ code });
    }
    await expect(stat(join(project.path, path))).rejects.toMatchObject({ code: 'ENOENT' });
    const completed = await app.call('tasks.create', {
      projectId: project.id,
      path,
      operationId: randomUUID(),
      content: note('plan', '已交付比较，保留当时条件。', { status: 'completed' }),
    });
    assert(completed.state === 'complete');
    const task = { projectId: project.id, taskId: 'plan', fileId: completed.resource.ref.fileId };
    const read = await app.call('tasks.read', { task });
    const expanded = await app.call('tasks.save', {
      task,
      basis: read.entry.basis,
      content: note('plan', '已交付比较，保留当时条件。\n新增目标：补充条件。', {
        status: 'active',
      }),
    });
    expect(expanded.metadata.status).toBe('active');
    expect(expanded.content).toContain('保留当时条件');
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('restored task links read the independent project copy and preserve later original work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-restore-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const saved = await app.call('files.save', {
      projectId: project.id,
      path: 'process.md',
      content: '备份中的条件比较。',
    });
    assert(saved.fileId);
    const created = await app.call('tasks.create', {
      projectId: project.id,
      path: 'tasks/copy.task.md',
      operationId: randomUUID(),
      content: note('copy', '目标与过程见链接。', {
        links: [
          {
            id: 'process',
            role: 'process',
            target: { kind: 'project-file', fileId: saved.fileId },
          },
        ],
      }),
    });
    assert(created.state === 'complete');
    const store = app.projects.get(project.id);
    const backup = await store.backup();
    await writeFile(join(project.path, 'process.md'), '原项目后续工作，不应覆盖。');
    const copy = await app.projects.open(await store.restore(backup.id, join(root, 'restored')));
    const task = {
      projectId: copy.project.id,
      taskId: 'copy',
      fileId: created.resource.ref.fileId,
    };
    const read = await app.call('tasks.read', { task });
    const target = read.metadata.links?.[0]?.target;
    assert(target?.kind === 'project-file');
    const descriptor = await app.call('resources.describe', {
      locator: { source: 'project', projectId: copy.project.id, fileId: target.fileId },
    });
    const content = await app.call('resources.read', {
      ref: descriptor.ref,
      basis: descriptor.basis,
      encoding: 'utf8',
    });
    expect(content.data).toBe('备份中的条件比较。');
    expect(copy.project.id).not.toBe(project.id);
    expect(copy.project.trust).toBe('pending');
    expect(await readFile(join(project.path, 'process.md'), 'utf8')).toBe(
      '原项目后续工作，不应覆盖。',
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('external UTF-8 BOM entries preserve their original content when conditionally saved', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-bom-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    await mkdir(join(project.path, 'tasks'));
    const path = 'tasks/bom.task.md';
    const original = `\uFEFF${note('bom')}`;
    await writeFile(join(project.path, path), original);
    const task = (await app.call('tasks.list', { projectId: project.id })).tasks[0]?.task;
    assert(task);
    const read = await app.call('tasks.read', { task });
    expect(read.content).toBe(original);
    const content = `${read.content}\n保存后仍可核对下一步。\n`;
    expect((await app.call('tasks.save', { task, basis: read.entry.basis, content })).content).toBe(
      content,
    );
    expect(await readFile(join(project.path, path), 'utf8')).toBe(content);
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});

test('directory preparation failure identifies its own operation without inventing a task creation receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-task-directory-'));
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: join(root, 'project') });
    const store = app.projects.get(project.id);
    store.database.exec(
      "CREATE TRIGGER reject_task_directory BEFORE INSERT ON file_references WHEN json_extract(NEW.value, '$.kind') = 'dir' BEGIN SELECT RAISE(ABORT, 'synthetic directory registration failure'); END",
    );
    const operationId = randomUUID();
    const created = await app.call('tasks.create', {
      projectId: project.id,
      operationId,
      path: 'tasks/new.task.md',
      content: note('new'),
    });
    expect(created.state).toBe('failed');
    assert(created.state === 'failed');
    expect(created.error.code).toBe('outcomeUnknown');
    const directoryId = created.error.message.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)?.[0];
    assert(directoryId);
    expect(directoryId).not.toBe(operationId);
    store.database.exec('DROP TRIGGER reject_task_directory');
    expect(
      (await app.call('files.operation', { projectId: project.id, operationId: directoryId })).kind,
    ).toBe('mkdir');
    await expect(
      app.call('resources.creation', { projectId: project.id, operationId }),
    ).rejects.toMatchObject({ code: 'notFound' });
    await expect(stat(join(project.path, 'tasks/new.task.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await app.close();
    await rm(root, { recursive: true });
  }
});
