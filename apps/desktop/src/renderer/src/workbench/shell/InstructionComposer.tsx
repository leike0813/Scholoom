import { ComposerPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import type { ComponentProps } from 'react';
import { IconSend } from './icons';

export function InstructionInput(props: ComponentProps<typeof ComposerPrimitive.Input>) {
  const aui = useAui();
  return (
    <ComposerPrimitive.Input
      {...props}
      onKeyDownCapture={(event) => {
        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing &&
          aui.thread.getState().isRunning &&
          aui.composer.getState().canSend
        ) {
          event.preventDefault();
          event.stopPropagation();
          aui.composer.send();
        }
      }}
    />
  );
}

export function InstructionSend() {
  const aui = useAui();
  const canSend = useAuiState((state) => !state.thread.isDisabled && state.composer.canSend);
  // 指令由内核持久受理，执行中也直接发送，不另设浏览器队列。
  return (
    <button
      type="button"
      className="send-btn"
      aria-label="发送指令"
      title="发送指令"
      disabled={!canSend}
      onClick={() => aui.composer.send()}
    >
      <IconSend />
    </button>
  );
}
