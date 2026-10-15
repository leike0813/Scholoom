import { ComposerPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import type { ComponentProps } from 'react';
import type { WorkbenchSession } from '../session';
import { IconSend } from './icons';

/**
 * dock 与 overlay 共用的当前执行上下文；模型与权限常显，项目环境行窄窗口可隐藏。
 */
export function ExecutionContext({ context }: { context: WorkbenchSession['executionContext'] }) {
  return (
    <section className="composer-context" aria-label="执行上下文">
      <div className="composer-config">
        <span className="composer-context__field">
          {context ? `模型：${context.model}` : '模型未就绪'}
        </span>
        <span className="composer-context__field">
          {context ? `权限：${context.permissions}` : '权限未就绪'}
        </span>
      </div>
      <div className="composer-env">{context ? `项目：${context.project}` : '项目未就绪'}</div>
    </section>
  );
}

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
