import { ComposerPrimitive, MessagePrimitive, ThreadPrimitive } from '@assistant-ui/react';
import { forwardRef } from 'react';
import { InstructionInput, InstructionSend } from './InstructionComposer';
import { IconChevronDown } from './icons';

function UserMessage() {
  return (
    <MessagePrimitive.Root asChild>
      <article className="thread-msg thread-msg--user" aria-label="用户消息">
        <MessagePrimitive.Parts />
      </article>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root asChild>
      <article className="thread-msg thread-msg--assistant" aria-label="Agent 回复">
        <MessagePrimitive.Parts />
      </article>
    </MessagePrimitive.Root>
  );
}

export interface AgentOverlayProps {
  title: string;
  reset?: (() => void) | undefined;
  onCollapse: () => void;
  cancel?: (() => void) | undefined;
  resume?: (() => void) | undefined;
  loadEarlier?: (() => void) | undefined;
}

/** 展开态 Agent 面板：占满中间区的 overlay，完整消息流 + composer。 */
export const AgentOverlay = forwardRef<HTMLDivElement, AgentOverlayProps>(function AgentOverlay(
  { title, reset, onCollapse, cancel, resume, loadEarlier },
  ref,
) {
  return (
    <div className="agent-overlay" role="dialog" aria-label="Agent 会话" ref={ref}>
      <header className="overlay-header">
        <span className="overlay-header__title">{title}</span>
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
        <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
      </ThreadPrimitive.Viewport>

      <div className="overlay-composer">
        <ComposerPrimitive.Root className="composer-box">
          <InstructionInput
            className="composer-input"
            placeholder="继续这个研究任务…"
            aria-label="研究指令"
            minRows={3}
            maxRows={10}
            submitMode="ctrlEnter"
          />
          <div className="composer-config">
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
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
});
