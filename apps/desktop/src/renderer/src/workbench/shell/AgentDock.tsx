import type { ThreadMessageLike } from '@assistant-ui/react';
import { ComposerPrimitive } from '@assistant-ui/react';
import { IconSend } from './icons';

interface DockPreview {
  toolText: string | undefined;
  toolFailed: boolean;
  agentText: string | undefined;
}

/** 从消息流尾部提取 dock 投影：最新一条 tool 消息与最新一条 agent 消息。 */
function readDockPreview(messages: readonly ThreadMessageLike[]): DockPreview {
  let toolText: string | undefined;
  let toolFailed = false;
  let agentText: string | undefined;

  for (
    let i = messages.length - 1;
    i >= 0 && (toolText === undefined || agentText === undefined);
    i--
  ) {
    const message = messages[i];
    if (message === undefined) continue;
    const parts =
      typeof message.content === 'string'
        ? ([{ type: 'text', text: message.content }] as const)
        : message.content;
    if (toolText === undefined) {
      const tool = parts.find((part) => part.type === 'tool-call');
      if (tool?.type === 'tool-call') {
        const args = tool.argsText ?? JSON.stringify(tool.args ?? {});
        toolText = `Ran ${tool.toolName}(${args})`;
        toolFailed = tool.isError === true;
      }
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
  return { toolText, toolFailed, agentText };
}

export interface AgentDockProps {
  messages: readonly ThreadMessageLike[];
  reset?: (() => void) | undefined;
  onExpand: () => void;
}

/** 折叠态 Agent 面板：tool 消息固定顶部，agent 消息截头留尾，右侧精简 composer。 */
export function AgentDock({ messages, reset, onExpand }: AgentDockProps) {
  const preview = readDockPreview(messages);

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
        {preview.toolText !== undefined ? (
          <span className="tool-line">
            <span
              className={preview.toolFailed ? 'dot dot--err' : 'dot dot--ok'}
              role="img"
              aria-label={preview.toolFailed ? '失败' : '完成'}
            />
            <code>{preview.toolText}</code>
          </span>
        ) : null}
        {preview.agentText !== undefined ? (
          <span className="dock-agent-msg">
            <span className="dock-agent-msg__tail">{preview.agentText}</span>
          </span>
        ) : null}
        {preview.toolText === undefined && preview.agentText === undefined ? (
          <span className="empty-hint">暂无会话进展，点击展开完整会话</span>
        ) : null}
      </button>
      <ComposerPrimitive.Root className="dock-composer">
        <ComposerPrimitive.Input
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
          <ComposerPrimitive.Send className="send-btn" aria-label="发送指令" title="发送指令">
            <IconSend />
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
}
