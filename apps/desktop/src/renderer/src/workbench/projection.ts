import type { ThreadMessageLike } from '@assistant-ui/react';
import type { Message } from '@scholoom/protocol';

/** 工具记录在界面中的呈现视图；形状由本模块投影，渲染组件只读这一层。 */
export interface ToolCallView {
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

type ToolCallArgs = {
  input: string;
  inputTruncated: boolean;
  state: Message['state'];
};

type ToolCallResult = { output: string; outputTruncated: boolean };

export function toolCallView(part: ToolCallPartLike): ToolCallView {
  const args = (part.args ?? {}) as Partial<ToolCallArgs>;
  const result = part.result as Partial<ToolCallResult> | undefined;
  const view: ToolCallView = {
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

export function toThreadMessage(message: Message): ThreadMessageLike {
  const common = {
    id: message.id,
    createdAt: new Date(message.createdAt),
    metadata: { custom: { source: message } },
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
