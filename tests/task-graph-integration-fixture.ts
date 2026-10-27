import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { KernelApplication } from '../apps/kernel/dist/application.js';
import type { TaskGraphInputs, TaskMetadata } from '../packages/protocol/dist/projects.js';

/** Only the external model may be controlled; every domain and the fixed worker are real. */
export async function taskGraphIntegration(root: string, modelEndpoint?: string) {
  // @ts-expect-error Source-only registry shared by the real host and worker.
  const { description, graphs } = await import('./fixtures/research-graph-worker/graphs.mjs');
  await mkdir(root, { recursive: true });
  const app = new KernelApplication(join(root, 'profile'), {
    environment: modelEndpoint ? { MINIMAX_CN_API_KEY: 'synthetic' } : {},
    ...(modelEndpoint ? { modelEndpoint } : {}),
    researchGraphs: [description],
    executionGraphs: graphs,
    workerEntry: new URL('./fixtures/research-graph-worker/worker.mjs', import.meta.url),
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
      content: 'I1项目材料：结果42，样本数1。',
    });
    assert(source.state === 'complete');
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const libraryPath = join(root, 'library.txt');
    await writeFile(libraryPath, 'I1库材料：对照组结果17。');
    const imported = await app.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [libraryPath],
      storage: 'managed',
      purpose: '正文',
      version: 'unspecified',
      origin: 'task-graph-integration',
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
      locator: { source: 'library', attachmentId, materialVersionId: attachment.materialVersionId },
    });
    assert(library.ref.source === 'library');
    const metadata: TaskMetadata = {
      kind: 'research-task',
      formatVersion: 1,
      id: 'compare',
      title: 'I1比较任务',
      status: 'active',
      workItems: [{ id: 'comparison', title: '比较工作项' }],
      links: [
        {
          id: 'project-source',
          role: 'source',
          workItemId: 'comparison',
          note: '项目来源',
          target: { kind: 'project-file', fileId: source.resource.ref.fileId },
          basis: source.resource.basis,
        },
        {
          id: 'library-source',
          role: 'source',
          workItemId: 'comparison',
          note: '库来源',
          target: {
            kind: 'library-material',
            attachmentId,
            materialVersionId: library.ref.materialVersionId,
          },
          basis: library.basis,
        },
      ],
    };
    const content = `---\n${JSON.stringify(metadata)}\n---\n\n目标：核对两个样本。\n障碍：样本量小。\n下一步：重读实际报告并保存后续安排。\n`;
    const created = await app.call('tasks.create', {
      projectId: project.id,
      operationId: randomUUID(),
      path: 'tasks/compare.task.md',
      content,
    });
    assert(created.state === 'complete');
    const task = { projectId: project.id, taskId: 'compare', fileId: created.resource.ref.fileId };
    const read = await app.call('tasks.read', { task });
    const session = await app.call('session.create', { projectId: project.id });
    const input: TaskGraphInputs['tasks.runGraph'] = {
      task,
      basis: read.entry.basis,
      sessionId: session.id,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      processOperationId: randomUUID(),
      graphId: description.definition.graphId,
      version: description.definition.version,
      config: { outputPath: 'report.md', goal: '核对真实任务、项目和库材料的机械组合。' },
      sourceLinkIds: ['project-source', 'library-source'],
      workItemId: 'comparison',
    };
    return {
      root,
      app,
      project,
      source: source.resource,
      library,
      description,
      metadata,
      read,
      input,
    };
  } catch (error) {
    await app.close();
    throw error;
  }
}
