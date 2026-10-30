import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react';
import type { Message, Run } from '@scholoom/protocol';
import { forwardRef } from 'react';
import {
  GraphRunContent,
  MessageArtifacts,
  MessageContent,
  MessageFacts,
  MessageFiles,
} from '../MessageContent';
import type { WorkbenchSession } from '../session';
import {
  ExecutionContext,
  InstructionContextItems,
  InstructionInput,
  InstructionSend,
} from './InstructionComposer';
import { IconChevronDown } from './icons';
import { ToolCall } from './ToolCall';

function UserMessage() {
  return (
    <MessagePrimitive.Root asChild>
      <article className="thread-msg thread-msg--user" aria-label="用户消息">
        <MessagePrimitive.Parts components={{ Text: MessageContent }} />
        <MessageFacts />
      </article>
    </MessagePrimitive.Root>
  );
}

/**
 * 每轮 Agent 工作结束处的分隔线。
 * 耗时取指令受理（用户消息 createdAt）到最终输出落盘（assistant 消息 createdAt，
 * 内核在完成时重写）的真实差值；轮次以工具消息收尾或无起始指令时只画线不带时长。
 */
function TurnSeparator() {
  const seconds = useAuiState((state) => {
    const messages = state.thread.messages;
    const index = messages.findIndex((item) => item.id === state.message.id);
    const current = messages[index];
    const next = messages[index + 1];
    if (!current || (next !== undefined && next.role !== 'user')) return null;
    if ('status' in current && current.status?.type === 'running') return null;
    const source = current.metadata.custom.source as Message | undefined;
    if (source?.role !== 'assistant') return -1;
    for (let i = index; i >= 0; i--) {
      const item = messages[i];
      if (item?.role === 'user') {
        const elapsed = current.createdAt.getTime() - item.createdAt.getTime();
        return elapsed >= 1000 ? Math.round(elapsed / 1000) : -1;
      }
    }
    return -1;
  });
  if (seconds === null) return null;
  return <div className="turn-separator">{seconds >= 0 ? `本轮用时 ${seconds} 秒` : null}</div>;
}

function AssistantMessage() {
  const graph = useAuiState((state) => state.message.metadata.custom.graphRun) as Run | undefined;
  return (
    <>
      <MessagePrimitive.Root asChild>
        <article
          className="thread-msg thread-msg--assistant"
          aria-label={graph ? '科研图进展' : 'Agent 回复'}
        >
          {graph ? (
            <GraphRunContent run={graph} />
          ) : (
            <>
              <MessagePrimitive.Parts
                components={{ Text: MessageContent, tools: { Fallback: ToolCall } }}
              />
              <MessageFacts />
              <MessageArtifacts />
            </>
          )}
        </article>
      </MessagePrimitive.Root>
      {graph ? null : <TurnSeparator />}
    </>
  );
}

export interface AgentOverlayProps {
  title: string;
  messageKey: string;
  openFile?: WorkbenchSession['openMessageFile'];
  openResource?: WorkbenchSession['openMessageResource'];
  context: WorkbenchSession['executionContext'];
  reset?: (() => void) | undefined;
  onCollapse: () => void;
  cancel?: (() => void) | undefined;
  loadEarlier?: (() => void) | undefined;
}

/** 展开态 Agent 面板：占满中间区的 overlay，完整消息流 + composer。 */
export const AgentOverlay = forwardRef<HTMLDivElement, AgentOverlayProps>(function AgentOverlay(
  { title, messageKey, openFile, openResource, context, reset, onCollapse, cancel, loadEarlier },
  ref,
) {
  return (
    <div className="agent-overlay" role="dialog" aria-label="Agent 会话" ref={ref}>
      <header className="overlay-header">
        <span className="overlay-header__title">{title}</span>
        {context ? <span className="overlay-header__meta">{context.model}</span> : null}
        <span className="spacer" />
        <button
          type="button"
          className="icon-btn"
          onClick={onCollapse}
          title="收起 (Esc)"
          aria-label="收起会话"
        >
          <IconChevronDown />
        </button>
      </header>

      <ThreadPrimitive.Viewport className="overlay-messages" aria-live="polite">
        {loadEarlier ? (
          <button type="button" onClick={loadEarlier}>
            更早消息
          </button>
        ) : null}
        <MessageFiles.Provider
          key={messageKey}
          value={{ documentKey: messageKey, openFile, openResource }}
        >
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </MessageFiles.Provider>
      </ThreadPrimitive.Viewport>

      <div className="overlay-composer">
        <ComposerPrimitive.Root className="composer-box">
          <InstructionContextItems />
          <InstructionInput
            className="composer-input"
            placeholder="继续这个研究任务…"
            aria-label="研究指令"
            minRows={3}
            maxRows={10}
            submitMode="ctrlEnter"
          />
          <ExecutionContext
            context={context}
            actions={
              <>
                {reset ? (
                  <button type="button" className="chip" onClick={reset}>
                    重置示例
                  </button>
                ) : null}
                {cancel ? (
                  <button type="button" className="btn" onClick={cancel}>
                    取消执行
                  </button>
                ) : null}
                <InstructionSend />
              </>
            }
          />
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
});
