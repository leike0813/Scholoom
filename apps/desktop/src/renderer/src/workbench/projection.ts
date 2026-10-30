import type { ThreadMessageLike } from '@assistant-ui/react';
import type {
  Artifact,
  Message,
  ResourceCreationOutputs,
  ResourceSaveResult,
  Run,
} from '@scholoom/protocol';
import { sameResourceRef } from './resource-controller.js';

export interface GraphResultView {
  role?: string;
  result?: ResourceSaveResult;
  creation?: ResourceCreationOutputs['resources.create'];
}

/** 合并同依据的保存与创建回执，保留角色及未完成操作，不从资源存在推定交付。 */
export function graphResults(run: Run): GraphResultView[] {
  const evidence = run.graphProgress?.evidence;
  const rows: GraphResultView[] = (evidence?.roleResults ?? []).map((item) => ({ ...item }));
  const same = (left: ResourceSaveResult, right: ResourceSaveResult) =>
    sameResourceRef(left.resource.ref, right.resource.ref) &&
    left.resource.basis === right.resource.basis;
  for (const result of evidence?.results ?? []) {
    if (!rows.some((row) => row.result && same(row.result, result))) rows.push({ result });
  }
  for (const creation of evidence?.creations ?? []) {
    const resource = 'resource' in creation ? creation.resource : undefined;
    const existing = resource
      ? rows.find((row) => row.result && same(row.result, { resource }))
      : undefined;
    if (existing && !existing.creation) existing.creation = creation;
    else rows.push({ creation });
  }
  return rows;
}

export function graphStateLabel(run: Run): string {
  return {
    queued: '排队中',
    running: '执行中',
    waiting: '等待输入',
    cancelling: '正在取消',
    cancelled: '已取消',
    completed: '执行结束',
    failed: '执行失败',
    interrupted: '执行中断',
  }[run.state];
}

export function graphPrompt(run: Run): string | undefined {
  if (run.state !== 'waiting') return undefined;
  return (
    run.graph?.wait?.prompt ??
    (run.graphProgress?.kind === 'graph.waiting' ? run.graphProgress.wait.prompt : undefined)
  );
}

/** 工具记录在界面中的呈现视图；形状由本模块投影，渲染组件只读这一层。 */
export interface ToolCallView {
  delegationId?: string;
  name: string;
  input: string;
  inputTruncated: boolean;
  state: Message['state'];
  output?: string | undefined;
  outputTruncated?: boolean | undefined;
}

interface ToolCallPartLike {
  toolName: string;
  args?: unknown;
  result?: unknown;
}

export function artifactStateLabel(artifact: Artifact): string {
  return artifact.state === 'linked' ? '已保存并登记' : '登记结果待核查';
}

type ToolCallArgs = {
  delegationId: string;
  input: string;
  inputTruncated: boolean;
  state: Message['state'];
};

type ToolCallResult = { output: string; outputTruncated: boolean };

export function toolCallView(part: ToolCallPartLike): ToolCallView {
  const args = (part.args ?? {}) as Partial<ToolCallArgs>;
  const result = part.result as Partial<ToolCallResult> | undefined;
  const view: ToolCallView = {
    ...(args.delegationId ? { delegationId: args.delegationId } : {}),
    name: part.toolName,
    input: args.input ?? '',
    inputTruncated: args.inputTruncated ?? false,
    // 形状缺失时按未确认呈现，不冒充成功。
    state: args.state ?? 'unknown',
  };
  if (result?.output !== undefined) {
    view.output = result.output;
    view.outputTruncated = result.outputTruncated ?? false;
  }
  return view;
}

export function toolStateLabel(state: Message['state']): string {
  if (state === 'streaming') return '执行中';
  if (state === 'error') return '失败';
  if (state === 'unknown') return '结果未知';
  return '完成';
}

export function toolStateDot(state: Message['state']): string {
  if (state === 'streaming') return 'dot dot--run';
  if (state === 'error') return 'dot dot--err';
  if (state === 'unknown') return 'dot dot--idle';
  return 'dot dot--ok';
}

/** 成果只附在已加载且明确属于同执行的最后回复，无正文时保留工具结果入口。 */
export function toThreadMessages(
  messages: readonly Message[],
  artifacts: readonly Artifact[],
  current?: { run: Run | undefined; sessionId: string },
): ThreadMessageLike[] {
  const replies = new Map<string, string>();
  const tools = new Map<string, string>();
  for (const message of messages) {
    if (message.role === 'assistant' && message.runId) replies.set(message.runId, message.id);
    if (message.role === 'tool' && message.tool) tools.set(message.tool.runId, message.id);
  }
  const attached = new Map<string, Artifact[]>();
  for (const artifact of artifacts) {
    const id = replies.get(artifact.runId) ?? tools.get(artifact.runId);
    if (!id) continue;
    const list = attached.get(id) ?? [];
    list.push(artifact);
    attached.set(id, list);
  }
  const projected = messages.map((message) => toThreadMessage(message, attached.get(message.id)));
  const run = current?.run;
  if (run?.graph && run.sessionId === current?.sessionId) {
    const wait =
      run.state === 'waiting'
        ? (run.graph.wait ??
          (run.graphProgress?.kind === 'graph.waiting' ? run.graphProgress.wait : undefined))
        : undefined;
    projected.push({
      id: JSON.stringify([
        'graph',
        run.sessionId,
        run.id,
        run.attempt,
        wait?.attemptId,
        wait?.waitId,
      ]),
      role: 'assistant',
      content: `科研图 · ${graphStateLabel(run)}`,
      metadata: { custom: { graphRun: run } },
      status: { type: 'complete', reason: 'stop' },
    });
  }
  return projected;
}

export function toThreadMessage(
  message: Message,
  artifacts?: readonly Artifact[],
): ThreadMessageLike {
  const common = {
    id: message.id,
    createdAt: new Date(message.createdAt),
    metadata: { custom: { source: message, artifacts: artifacts ?? [] } },
  };
  if (message.role === 'user') {
    return {
      ...common,
      role: 'user',
      content: message.text,
    };
  }
  const status =
    message.state === 'streaming'
      ? { type: 'running' as const }
      : message.state === 'error'
        ? { type: 'incomplete' as const, reason: 'error' as const }
        : message.state === 'unknown'
          ? { type: 'incomplete' as const, reason: 'other' as const }
          : { type: 'complete' as const, reason: 'stop' as const };
  if (message.role === 'tool') {
    const tool = message.tool;
    // 旧记录无详情：输入留作未记录，历史文字作为其说明呈现，不捏造参数或结果。
    const output = tool ? tool.output : message.text;
    return {
      ...common,
      role: 'assistant',
      status,
      content: [
        {
          type: 'tool-call',
          toolCallId: message.id,
          toolName: tool?.name ?? '项目工具',
          args: {
            ...(tool?.delegationId ? { delegationId: tool.delegationId } : {}),
            input: tool?.input ?? '未记录',
            inputTruncated: tool?.inputTruncated ?? false,
            state: message.state,
          },
          isError: message.state === 'error',
          ...(output !== undefined
            ? { result: { output, outputTruncated: tool?.outputTruncated ?? false } }
            : {}),
        },
      ],
    };
  }
  return {
    ...common,
    role: 'assistant',
    status,
    content: message.text,
  };
}
