import type { ThreadMessageLike } from '@assistant-ui/react';
import { ComposerPrimitive } from '@assistant-ui/react';
import { type ToolCallView, toolCallView, toolStateDot, toolStateLabel } from '../projection';
import type { WorkbenchSession } from '../session';
import { ExecutionContext, InstructionInput, InstructionSend } from './InstructionComposer';

interface DockPreview {
  tool: ToolCallView | undefined;
  agentText: string | undefined;
}

/** 从消息流尾部提取 dock 投影：最新一条 tool 消息与最新一条 agent 消息。 */
function readDockPreview(messages: readonly ThreadMessageLike[]): DockPreview {
  let tool: ToolCallView | undefined;
  let agentText: string | undefined;

  for (
    let i = messages.length - 1;
    i >= 0 && (tool === undefined || agentText === undefined);
    i--
  ) {
    const message = messages[i];
    if (message === undefined) continue;
    const parts =
      typeof message.content === 'string'
        ? ([{ type: 'text', text: message.content }] as const)
        : message.content;
    if (tool === undefined) {
      const part = parts.find((item) => item.type === 'tool-call');
      if (part?.type === 'tool-call') tool = toolCallView(part);
    }
    if (agentText === undefined && message.role === 'assistant') {
      const text = parts
        .filter((part) => part.type === 'text')
        .map((part) => ('text' in part ? part.text : ''))
        .join('\n')
        .trim();
      agentText = text.length > 0 ? text : undefined;
    }
  }
  return { tool, agentText };
}

export interface AgentDockProps {
  messages: readonly ThreadMessageLike[];
  context: WorkbenchSession['executionContext'];
  reset?: (() => void) | undefined;
  onExpand: () => void;
  cancel?: (() => void) | undefined;
  resume?: (() => void) | undefined;
}

/** 折叠态 Agent 面板：tool 消息固定顶部，agent 消息截头留尾，右侧精简 composer。 */
export function AgentDock({ messages, context, reset, onExpand, cancel, resume }: AgentDockProps) {
  const preview = readDockPreview(messages);
  const tool = preview.tool;

  return (
    <div className="agent-dock">
      <button
        type="button"
        className="dock-transcript"
        id="dock-transcript"
        onClick={onExpand}
        title="点击展开会话"
        aria-label="展开 Agent 会话"
      >
        {tool !== undefined ? (
          <span className="tool-line">
            <span
              className={toolStateDot(tool.state)}
              role="img"
              aria-label={toolStateLabel(tool.state)}
            />
            <span className="tool-line__state">{toolStateLabel(tool.state)}</span>
            <code>
              Ran {tool.name}({tool.input})
            </code>
          </span>
        ) : null}
        {preview.agentText !== undefined ? (
          <span className="dock-agent-msg">
            <span className="dock-agent-msg__tail">{preview.agentText}</span>
          </span>
        ) : null}
        {tool === undefined && preview.agentText === undefined ? (
          <span className="empty-hint">暂无会话进展，点击展开完整会话</span>
        ) : null}
      </button>
      <ComposerPrimitive.Root className="dock-composer">
        <InstructionInput
          className="composer-input"
          placeholder="输入研究指令…"
          aria-label="研究指令"
          minRows={2}
          maxRows={4}
          submitMode="ctrlEnter"
        />
        <div className="dock-composer__row">
          {reset ? (
            <button type="button" className="chip" onClick={reset}>
              重置示例
            </button>
          ) : null}
          <span className="spacer" />
          {cancel ? (
            <button type="button" onClick={cancel}>
              取消执行
            </button>
          ) : null}
          {resume ? (
            <button type="button" onClick={resume}>
              继续执行
            </button>
          ) : null}
          <InstructionSend />
        </div>
        <ExecutionContext context={context} />
      </ComposerPrimitive.Root>
    </div>
  );
}
