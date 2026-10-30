import { randomUUID } from 'node:crypto';
import type { RpcPeer } from '@scholoom/broker/rpc';
import { callExecutionControl } from '@scholoom/harness/worker';
import { failure } from '@scholoom/platform/node';
import {
  compileContract,
  type ErrorInfo,
  isErrorInfo,
  OperationError,
} from '@scholoom/protocol/core';
import {
  type TaskGraphInputSnapshot,
  type TaskRead,
  taskGraphInputSnapshotSchema,
  taskOperations,
} from '@scholoom/protocol/projects';
import { type ResourceSaveResult, resourceDescriptorSchema } from '@scholoom/protocol/resources';

const snapshotContract = compileContract({ params: taskGraphInputSnapshotSchema, result: true });
const readContract = compileContract(taskOperations['tasks.read']);
const resourceContract = compileContract({ params: resourceDescriptorSchema, result: true });

export type TaskResearchAssociation =
  | { state: 'confirmed' }
  | { state: 'failed' | 'unknown'; error: ErrorInfo };

/** Merge navigation only; research files and their execution associations remain their owners' facts. */
export async function linkTaskResearchArtifacts(
  peer: RpcPeer,
  snapshot: TaskGraphInputSnapshot,
  artifacts: readonly { role: 'report' | 'process'; result: ResourceSaveResult }[],
): Promise<TaskResearchAssociation> {
  try {
    if (!snapshotContract.params(snapshot))
      throw new OperationError('invalidRequest', '任务历史输入不符合契约。');
    const { task, workItemId } = snapshot;
    const sameEntry = (entry: TaskRead['entry']) =>
      entry.ref.source === 'project' &&
      entry.ref.projectId === task.projectId &&
      entry.ref.fileId === task.fileId;
    if (!sameEntry(snapshot.entry))
      throw new OperationError('instanceMismatch', '任务历史入口不属于原任务。');

    const call = async (name: 'read_research_task' | 'save_research_task', args: object) => {
      const raw = await callExecutionControl(peer, 'execution.custom', { name, args: { ...args } });
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new OperationError(
          name === 'save_research_task' ? 'outcomeUnknown' : 'unavailable',
          '任务操作回执不能解析，请核查原入口。',
        );
      }
      if (value && typeof value === 'object' && 'error' in value && isErrorInfo(value.error))
        throw new OperationError(value.error.code, value.error.message);
      if (!readContract.result(value))
        throw new OperationError(
          name === 'save_research_task' ? 'outcomeUnknown' : 'unavailable',
          '任务操作回执不符合契约，请核查原入口。',
        );
      const read = value as TaskRead;
      if (
        read.task.projectId !== task.projectId ||
        read.task.taskId !== task.taskId ||
        read.task.fileId !== task.fileId ||
        read.metadata.id !== task.taskId ||
        !sameEntry(read.entry)
      )
        throw new OperationError('instanceMismatch', '任务操作回执不属于原任务。');
      if (
        workItemId !== undefined &&
        !read.metadata.workItems?.some((item) => item.id === workItemId)
      )
        throw new OperationError('notFound', '原任务工作项已不存在，请核查入口。');
      return read;
    };

    for (const { role, result } of artifacts) {
      if (!['report', 'process'].includes(role) || !resourceContract.params(result?.resource))
        throw new OperationError('invalidRequest', '研究文件保存回执不符合契约。');
      const ref = result.resource.ref;
      if (
        ref.source !== 'project' ||
        ref.projectId !== task.projectId ||
        ref.fileId === task.fileId
      )
        throw new OperationError('instanceMismatch', '研究文件须属于原项目且不能替代任务入口。');
    }
    const current = await call('read_research_task', { task });
    const links = [...(current.metadata.links ?? [])];
    let changed = false;
    for (const { role, result } of artifacts) {
      const ref = result.resource.ref;
      if (ref.source !== 'project') continue;
      const linkRole = role === 'report' ? 'result' : 'process';
      const matching = links.filter(
        (link) =>
          link.role === linkRole &&
          link.workItemId === workItemId &&
          link.target.kind === 'project-file' &&
          link.target.fileId === ref.fileId,
      );
      if (matching.length) {
        for (const link of matching) {
          if (link.basis === result.resource.basis) continue;
          links[links.indexOf(link)] = { ...link, basis: result.resource.basis };
          changed = true;
        }
      } else {
        links.push({
          id: randomUUID(),
          role: linkRole,
          target: { kind: 'project-file', fileId: ref.fileId },
          basis: result.resource.basis,
          ...(workItemId === undefined ? {} : { workItemId }),
        });
        changed = true;
      }
    }
    if (!changed) return { state: 'confirmed' };
    const metadata = { ...current.metadata, links };
    const content = current.content.replace(
      /^(\uFEFF?---\r?\n)[\s\S]*?(\r?\n---(?:\r?\n|$))/,
      (_header, opening: string, closing: string) =>
        `${opening}${JSON.stringify(metadata, null, 2)}${closing}`,
    );
    const saved = await call('save_research_task', { task, basis: current.entry.basis, content });
    if (saved.content !== content)
      throw new OperationError('outcomeUnknown', '任务保存后正文与候选不符，请核查原入口。');
    return { state: 'confirmed' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    const info = failure(error);
    return {
      state:
        !(error instanceof OperationError) || info.code === 'outcomeUnknown' ? 'unknown' : 'failed',
      error: info,
    };
  }
}
