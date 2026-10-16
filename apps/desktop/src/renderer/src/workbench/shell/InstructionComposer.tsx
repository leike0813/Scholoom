import { ComposerPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import type { Effort } from '@scholoom/protocol';
import type { ComponentProps, ReactNode } from 'react';
import type { WorkbenchSession } from '../session';
import { IconChevronDown, IconSend } from './icons';

/**
 * dock 与 overlay 共用的执行上下文配置行：权限只读段、模型选择、推理强度选择与发送动作同一行；
 * 模型与推理强度选项只来自内核下发的 provider 目录，“跟随默认”清除会话覆盖；项目环境行窄窗口可隐藏。
 */
export function ExecutionContext({
  context,
  actions,
}: {
  context: WorkbenchSession['executionContext'];
  actions?: ReactNode;
}) {
  const configurable =
    !!context?.modelOptions?.length && !!context.onModelChange && !!context.onEffortChange;
  const disabled = !context || !!context.configureDisabled;
  const supportsEffort = context?.supportsEffort !== false;
  return (
    <section className="composer-context" aria-label="执行上下文">
      <div className="composer-config">
        <span className="composer-context__field">
          {context ? `权限：${context.permissions}` : '权限未就绪'}
        </span>
        {configurable && context ? (
          <>
            <label className="composer-context__control">
              <span className="composer-context__label">模型</span>
              <span className="composer-context__select-wrap">
                <select
                  className="composer-context__select"
                  aria-label="模型"
                  value={context.modelOverridden ? context.model : ''}
                  disabled={disabled}
                  onChange={(event) =>
                    context.onModelChange?.(event.target.value === '' ? null : event.target.value)
                  }
                >
                  <option value="">跟随默认（{context.defaultModel ?? context.model}）</option>
                  {context.modelOptions?.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.id}
                    </option>
                  ))}
                </select>
                <IconChevronDown />
              </span>
            </label>
            <label className="composer-context__control">
              <span className="composer-context__label">推理强度</span>
              <span className="composer-context__select-wrap">
                <select
                  className="composer-context__select"
                  aria-label="推理强度"
                  value={context.effortOverridden ? (context.effort ?? '') : ''}
                  disabled={disabled || !supportsEffort}
                  onChange={(event) =>
                    context.onEffortChange?.(
                      event.target.value === '' ? null : (event.target.value as Effort),
                    )
                  }
                >
                  <option value="">跟随默认（{context.defaultEffort ?? context.effort}）</option>
                  {context.effortOptions?.map((effort) => (
                    <option key={effort} value={effort}>
                      {effort}
                    </option>
                  ))}
                </select>
                <IconChevronDown />
              </span>
            </label>
            {!supportsEffort ? (
              <span className="composer-context__hint">该模型不支持推理强度</span>
            ) : null}
          </>
        ) : (
          <span className="composer-context__field">
            {context ? `模型：${context.model}` : '模型未就绪'}
          </span>
        )}
        <span className="spacer" />
        <div className="composer-actions">{actions}</div>
      </div>
      {context?.configureError ? (
        <p className="composer-config-error" role="alert">
          {context.configureError}
          <button type="button" className="text-btn" onClick={() => context.retryConfigure?.()}>
            重试
          </button>
        </p>
      ) : null}
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
