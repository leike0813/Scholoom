import { randomUUID } from 'node:crypto';
import { failure } from '@scholoom/platform/node';
import { OperationError } from '@scholoom/protocol/core';
import {
  type FileEditOrigin,
  isTaskMetadata,
  type ProjectTaskInputs,
  type ProjectTaskOutputs,
  projectLimits,
  type TaskMetadata,
  type TaskRead,
  type TaskRef,
} from '@scholoom/protocol/projects';
import type { CreationOwner } from './creations.js';
import type { ProjectStore } from './store.js';

function metadata(content: string): TaskMetadata {
  if (Buffer.byteLength(content) > projectLimits.fileBytes)
    throw new OperationError('tooLarge', '任务入口超过文本编辑上限，请拆分过程材料。');
  const header = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  let value: unknown;
  try {
    value = header ? JSON.parse(header[1] ?? '') : undefined;
  } catch {
    throw new OperationError('invalidRequest', '任务入口需要有效的 JSON 元信息。');
  }
  if (value && typeof value === 'object' && 'formatVersion' in value && value.formatVersion !== 1)
    throw new OperationError('unavailable', '任务入口格式版本不可用，原文件已保留。');
  if (!isTaskMetadata(value))
    throw new OperationError('invalidRequest', '任务入口元信息不符合任务契约。');
  const work = value.workItems ?? [];
  const links = value.links ?? [];
  if (
    new Set(work.map((item) => item.id)).size !== work.length ||
    new Set(links.map((item) => item.id)).size !== links.length
  )
    throw new OperationError('targetAmbiguous', '工作项或材料引用身份重复。');
  const items = new Map(work.map((item) => [item.id, item]));
  const plans = new Set(links.filter((link) => link.role === 'plan').map((link) => link.id));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new OperationError('invalidRequest', '工作项依赖存在循环。');
    if (visited.has(id)) return;
    const item = items.get(id);
    if (!item) throw new OperationError('invalidRequest', '工作项依赖不存在。');
    if (item.planLinkId && !plans.has(item.planLinkId))
      throw new OperationError('invalidRequest', '工作项的计划入口不存在。');
    visiting.add(id);
    for (const dependency of item.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const item of work) visit(item.id);
  if (links.some((link) => link.workItemId && !items.has(link.workItemId)))
    throw new OperationError('invalidRequest', '材料引用的工作项不存在。');
  return value;
}

/** Task content and relationships remain in the entry; file protection belongs to ProjectStore. */
export class ProjectTasks {
  constructor(private readonly store: ProjectStore) {}

  private check(task?: TaskRef): void {
    this.store.check('read');
    if (task && task.projectId !== this.store.project.id)
      throw new OperationError('permissionDenied', '任务不属于当前项目。');
  }

  async list(
    input: Omit<ProjectTaskInputs['tasks.list'], 'projectId'> = {},
  ): Promise<ProjectTaskOutputs['tasks.list']> {
    this.check();
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 25;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new OperationError('invalidRequest', '任务分页范围无效。');
    let page: Awaited<ReturnType<ProjectStore['list']>>;
    try {
      page = await this.store.list('tasks', offset, limit, input.version);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.check();
      if (input.version) throw new OperationError('contentChanged', '任务目录已变化，请重新读取。');
      return { tasks: [], issues: [], offset };
    }
    const result: ProjectTaskOutputs['tasks.list'] = {
      tasks: [],
      issues: [],
      offset: page.offset,
      version: page.version,
      ...(page.nextOffset === undefined ? {} : { nextOffset: page.nextOffset }),
    };
    const ids = new Set<string>();
    for (const entry of page.entries) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.task.md') || !entry.fileId) continue;
      try {
        const read = await this.readEntry(entry.fileId);
        if (ids.has(read.task.taskId))
          result.issues.push({
            path: entry.path,
            fileId: entry.fileId,
            error: { code: 'targetAmbiguous', message: '发现多个相同任务身份的入口，请明确核对。' },
          });
        ids.add(read.task.taskId);
        const body = read.content.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim();
        result.tasks.push({
          task: read.task,
          title: read.metadata.title,
          status: read.metadata.status,
          path: read.path,
          basis: read.entry.basis,
          summary: body.split(/\r?\n\s*\r?\n/)[0]?.slice(0, 512) ?? '',
        });
      } catch (error) {
        this.check();
        const info = failure(error);
        if (info.code === 'permissionDenied' || info.code === 'instanceMismatch') throw error;
        result.issues.push({ path: entry.path, fileId: entry.fileId, error: info });
      }
    }
    await this.store.list('tasks', offset, 1, page.version);
    this.check();
    return result;
  }

  private async readEntry(
    fileId: string,
    resourceBasis?: string,
    basis?: string,
  ): Promise<TaskRead> {
    this.check();
    const bytes = await this.store.files.readBytes(fileId, {
      ...(resourceBasis ? { resourceBasis } : {}),
      ...(basis ? { basis } : {}),
      limit: projectLimits.fileBytes,
    });
    if (bytes.nextOffset !== undefined || bytes.size > projectLimits.fileBytes)
      throw new OperationError('tooLarge', '任务入口超过文本编辑上限。');
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        Buffer.from(bytes.data, 'base64'),
      );
    } catch {
      throw new OperationError('invalidRequest', '任务入口必须是 UTF-8 文本。');
    }
    const value = metadata(content);
    this.check();
    const projectId = this.store.project.id;
    return {
      task: { projectId, taskId: value.id, fileId },
      path: bytes.path,
      content,
      metadata: value,
      entry: { ref: { source: 'project', projectId, fileId }, basis: bytes.resourceBasis },
    };
  }

  async read(task: TaskRef): Promise<TaskRead> {
    this.check(task);
    const result = await this.readEntry(task.fileId);
    if (result.task.taskId !== task.taskId)
      throw new OperationError('contentChanged', '任务身份已变化，请重新核对入口。');
    return result;
  }

  async create(
    input: Pick<ProjectTaskInputs['tasks.create'], 'path' | 'content'>,
    owner: CreationOwner,
  ) {
    this.store.check('write');
    if (!/^tasks\/[^/\\]+\.task\.md$/.test(input.path))
      throw new OperationError('invalidRequest', '任务入口应位于 tasks/ 并以 .task.md 结尾。');
    metadata(input.content);
    try {
      await this.store.list('tasks', 0, 1);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const directoryOperationId = randomUUID();
      try {
        const operation = await this.store.files.mutate('mkdir', directoryOperationId, {
          path: 'tasks',
        });
        if (operation.state !== 'complete')
          throw new OperationError('outcomeUnknown', '任务目录创建结果待核查。');
      } catch (createError) {
        if (createError instanceof OperationError && createError.code === 'outcomeUnknown')
          throw new OperationError(
            'outcomeUnknown',
            `任务入口尚未创建；目录操作 ${directoryOperationId} 待核查，请查询 files.operation。`,
          );
        if (!(createError instanceof OperationError) || createError.code !== 'contentChanged')
          throw createError;
        await this.store.list('tasks', 0, 1);
      }
    }
    return this.store.save(input.path, input.content, undefined, undefined, undefined, owner);
  }

  async save(input: ProjectTaskInputs['tasks.save'], origin?: FileEditOrigin): Promise<TaskRead> {
    this.check(input.task);
    this.store.check('write');
    const candidate = metadata(input.content);
    if (candidate.id !== input.task.taskId)
      throw new OperationError('invalidRequest', '保存不能改变任务身份。');
    const prior = await this.readEntry(input.task.fileId, input.basis);
    if (prior.task.taskId !== input.task.taskId)
      throw new OperationError('contentChanged', '任务身份已变化，请重新读取。');
    const edit = await this.store.save(
      prior.path,
      input.content,
      undefined,
      prior.content,
      input.task.fileId,
      undefined,
      input.basis,
      origin ? { origin } : undefined,
    );
    try {
      return await this.readEntry(input.task.fileId, undefined, edit.basis);
    } catch {
      throw new OperationError('outcomeUnknown', '入口已保存，当前读取结果待核查；请重读原任务。');
    }
  }
}
