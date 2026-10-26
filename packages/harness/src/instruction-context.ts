import { type CallContext, OperationError } from '@scholoom/protocol/core';
import type {
  ContextItem,
  InstructionContext,
  WorkbenchContextOutputs,
  WorkbenchSource,
} from '@scholoom/protocol/harness';
import type { LibraryModuleInputs, LibraryModuleOutputs } from '@scholoom/protocol/library';
import type { ExecutionResourcePort, ResourceEvidence } from '@scholoom/protocol/resources';

type SnapshotResult = Exclude<
  WorkbenchContextOutputs['workbench.context.read'],
  { state: 'ambiguous' }
>;
export type ContextBridge = {
  catalog?: (context: CallContext) => {
    read: (
      input: LibraryModuleInputs['library.selection'],
    ) => Promise<LibraryModuleOutputs['library.selection']>;
    check: (libraryId: string) => void;
  };
  read: (
    source: WorkbenchSource | undefined,
    receiver: { projectId: string; sessionId: string },
  ) =>
    | Omit<Extract<SnapshotResult, { state: 'available' }>, 'instructionId'>
    | Extract<SnapshotResult, { state: 'unavailable' }>;
  /** The owner checks current read/send grants, including after model admission waits. */
  resources?: (context: CallContext) => {
    port: Pick<ExecutionResourcePort, 'describe'> & Partial<Pick<ExecutionResourcePort, 'read'>>;
    check: (evidence: readonly ResourceEvidence[], libraryUsed?: boolean) => void;
  };
};

export async function authorizeContextItems(
  bridge: ContextBridge | undefined,
  context: CallContext,
  items: readonly ResourceEvidence[],
): Promise<void> {
  if (!items.length) return;
  const resources = bridge?.resources?.(context);
  if (!resources) throw new OperationError('unavailable', '执行资源授权适配尚未接线。');
  resources.check(items);
  for (const item of items) {
    // Stored excerpts keep their original basis; actual resource reads verify that version.
    const resource = await resources.port.describe(item.ref);
    if (!resource.capabilities.read)
      throw new OperationError(
        'unavailable',
        resource.unavailableReason ?? '上下文材料当前不可读。',
      );
  }
  resources.check(items);
}

/** Only instructions injected into this advancement may select a connection. */
export async function readInstructionContext(
  instructions: readonly InstructionContext[],
  instructionId: string | undefined,
  context: CallContext,
  bridge: ContextBridge | undefined,
): Promise<WorkbenchContextOutputs['workbench.context.read']> {
  const selected = instructionId
    ? instructions.find((item) => item.instructionId === instructionId)
    : instructions[0];
  if (instructionId && !selected)
    throw new OperationError('invalidRequest', '指令不属于当前有效推进。');
  if (!instructionId && new Set(instructions.map((item) => item.source?.connectionId)).size > 1)
    return { state: 'ambiguous', instructionIds: instructions.map((item) => item.instructionId) };
  if (!selected?.source) return { state: 'unavailable', reason: 'noSource' };
  if (!bridge) throw new OperationError('unavailable', '工作台上下文端口不可用。');
  const result = bridge.read(selected.source, {
    projectId: context.projectId as string,
    sessionId: context.sessionId as string,
  });
  if (result.state !== 'available') return result;
  const evidenced = new Set(result.snapshot.selections.map((item) => item.itemId));
  if (result.snapshot.selectedItems.some((id) => !evidenced.has(id)))
    throw new OperationError('unavailable', '选择条目的资源授权适配尚未接线。');
  await authorizeContextItems(bridge, context, result.snapshot.selections);
  if (result.snapshot.catalogSelection) {
    const catalog = bridge.catalog?.(context);
    if (!catalog) throw new OperationError('unavailable', '题录选择提供者尚未接线。');
    const selection = result.snapshot.catalogSelection;
    catalog.check(selection.libraryId);
    const verified = await catalog.read({ libraryId: selection.libraryId, items: selection.items });
    catalog.check(selection.libraryId);
    return { ...result, catalog: verified, instructionId: selected.instructionId };
  }
  return { ...result, instructionId: selected.instructionId };
}

export function contextItemContent(item: ContextItem): string {
  const reference = `材料引用：${JSON.stringify(item.ref)}；版本：${item.basis}`;
  const content =
    item.kind === 'text'
      ? `${item.contentState === 'draft' ? '用户草稿摘录' : '所附摘录'}：${item.quote}`
      : item.kind === 'object'
        ? `${item.contentState === 'draft' ? '用户草稿对象' : '对象'} ${item.name}（${item.providerId}/${item.objectId}）：${item.semantics}`
        : item.kind === 'region'
          ? `所选区域：${JSON.stringify(item.region)}；坐标基准：${item.target ? JSON.stringify(item.target) : '未记录，需重新核查'}`
          : '整份材料引用，请实际读取后使用。';
  const location =
    item.kind === 'text' && item.location ? `\n当次位置：${JSON.stringify(item.location)}` : '';
  return `${reference}\n${content}${location}${item.comment ? `\n用户批注：${item.comment}` : ''}`;
}
