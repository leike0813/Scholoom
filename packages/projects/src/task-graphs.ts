import { failure } from '@scholoom/platform/node';
import { type CallContext, compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type TaskGraphInputs,
  type TaskGraphOutputs,
  type TaskPort,
  type TaskResearchPort,
  taskGraphOperations,
} from '@scholoom/protocol/projects';
import type {
  ExecutionResourcePort,
  ResourceEvidence,
  ResourcePort,
} from '@scholoom/protocol/resources';

const listContract = compileContract(taskGraphOperations['tasks.graphs']);
const runContract = compileContract(taskGraphOperations['tasks.runGraph']);
const callContract = compileContract({
  params: taskGraphOperations['tasks.runGraph'].result.properties.call,
  result: taskGraphOperations['tasks.runGraph'].result.properties.call,
});

/** Task evidence and process pointers only; starting research remains the injected owner's job. */
export class TaskGraphs {
  constructor(
    private readonly tasks: Pick<TaskPort, 'read' | 'save'>,
    private readonly resources: Pick<ResourcePort, 'describe'> &
      Pick<ExecutionResourcePort, 'create'>,
    private readonly research: TaskResearchPort,
  ) {}

  private check(projectId: string, context: CallContext): void {
    if (
      context.role !== 'product' ||
      context.principal.kind !== 'human' ||
      (context.projectId !== undefined && context.projectId !== projectId)
    )
      throw new OperationError('permissionDenied', '科研图任务动作需要当前项目的人工产品入口。');
  }

  async list(
    input: TaskGraphInputs['tasks.graphs'],
    context: CallContext,
  ): Promise<TaskGraphOutputs['tasks.graphs']> {
    if (!listContract.params(input))
      throw new OperationError('invalidRequest', '科研图目录参数无效。');
    this.check(input.projectId, context);
    const { projectId: _projectId, ...page } = input;
    const result = await this.research.graphs(page, { ...context, projectId: input.projectId });
    if (!listContract.result(result))
      throw new OperationError('unavailable', '科研图目录提供者返回无效结果。');
    return result;
  }

  async run(
    input: TaskGraphInputs['tasks.runGraph'],
    context: CallContext,
  ): Promise<TaskGraphOutputs['tasks.runGraph']> {
    if (!runContract.params(input))
      throw new OperationError('invalidRequest', '任务科研图参数无效。');
    const { task, basis, workItemId, processOperationId } = input;
    this.check(task.projectId, context);
    const read = await this.tasks.read({ task });
    if (read.entry.basis !== basis)
      throw new OperationError('contentChanged', '任务入口已变化，请重新读取。');
    if (
      workItemId !== undefined &&
      !read.metadata.workItems?.some((item) => item.id === workItemId)
    )
      throw new OperationError('notFound', '任务工作项不存在。');
    const links = read.metadata.links ?? [];
    if (links.some((link) => link.id === processOperationId))
      throw new OperationError('targetAmbiguous', '过程材料身份已被任务引用占用。');
    if (links.length >= 100) throw new OperationError('tooLarge', '任务材料引用已达到上限。');

    const materials: ResourceEvidence[] = [read.entry];
    for (const linkId of input.sourceLinkIds) {
      const link = links.find((candidate) => candidate.id === linkId);
      if (!link) throw new OperationError('notFound', '所选任务来源不存在。');
      if (
        link.role !== 'source' ||
        (link.workItemId !== undefined && link.workItemId !== workItemId)
      )
        throw new OperationError('invalidRequest', '所选材料不是当前工作项的来源。');
      const locator =
        link.target.kind === 'project-file'
          ? { source: 'project' as const, projectId: task.projectId, fileId: link.target.fileId }
          : {
              source: 'library' as const,
              attachmentId: link.target.attachmentId,
              materialVersionId: link.target.materialVersionId,
            };
      const resource = await this.resources.describe(locator);
      if (link.basis !== undefined && link.basis !== resource.basis)
        throw new OperationError('contentChanged', '任务来源版本已变化，请核查原引用。');
      if (!resource.capabilities.read)
        throw new OperationError(
          'unavailable',
          resource.unavailableReason ?? '任务来源当前不可读。',
        );
      materials.push({ ref: resource.ref, basis: resource.basis, role: 'source' });
    }
    const fresh = await this.tasks.read({ task });
    if (fresh.entry.basis !== basis)
      throw new OperationError('contentChanged', '核查来源期间任务入口已变化。');

    const started = await this.research.start(
      {
        projectId: task.projectId,
        sessionId: input.sessionId,
        invocationId: input.invocationId,
        instructionId: input.instructionId,
        graphId: input.graphId,
        version: input.version,
        config: input.config,
        materials,
        text: read.content,
      },
      context,
    );
    if (
      !started ||
      typeof started !== 'object' ||
      started.invocationId !== input.invocationId ||
      started.instructionId !== input.instructionId ||
      ('projectId' in started && started.projectId !== task.projectId) ||
      ('sessionId' in started && started.sessionId !== input.sessionId)
    )
      throw new OperationError('outcomeUnknown', '科研调用身份不匹配，请按原请求身份核查。');
    const call = {
      projectId: task.projectId,
      sessionId: input.sessionId,
      invocationId: started.invocationId,
      instructionId: started.instructionId,
      runId: started.runId,
    };
    if (!callContract.result(call))
      throw new OperationError('outcomeUnknown', '科研调用回执不完整，请按原请求身份核查。');
    let process: TaskGraphOutputs['tasks.runGraph']['process'];
    try {
      process = await this.resources.create({
        projectId: task.projectId,
        operationId: processOperationId,
        path: `tasks/${processOperationId}.graph-call.md`,
        content: `${JSON.stringify(call, null, 2)}\n`,
      });
    } catch (error) {
      const info = failure(error);
      process = {
        operationId: processOperationId,
        state:
          !(error instanceof OperationError) || info.code === 'outcomeUnknown'
            ? 'unknown'
            : 'failed',
        error: info,
      };
    }
    if (process.state !== 'complete')
      return { call, process, taskAssociation: { state: 'pending' } };

    const metadata = {
      ...read.metadata,
      links: [
        ...links,
        {
          id: processOperationId,
          role: 'process' as const,
          target: { kind: 'project-file' as const, fileId: process.resource.ref.fileId },
          basis: process.resource.basis,
          ...(workItemId === undefined ? {} : { workItemId }),
        },
      ],
    };
    const content = read.content.replace(
      /^(\uFEFF?---\r?\n)[\s\S]*?(\r?\n---(?:\r?\n|$))/,
      (_header, opening: string, closing: string) =>
        `${opening}${JSON.stringify(metadata, null, 2)}${closing}`,
    );
    try {
      await this.tasks.save({ task, basis, content });
      return { call, process, taskAssociation: { state: 'confirmed' } };
    } catch (error) {
      const info = failure(error);
      return {
        call,
        process,
        taskAssociation: {
          state:
            !(error instanceof OperationError) || info.code === 'outcomeUnknown'
              ? 'unknown'
              : 'failed',
          error: info,
        },
      };
    }
  }
}
