import { ComposerPrimitive, useAui, useAuiState } from '@assistant-ui/react';
import type { Effort } from '@scholoom/protocol';
import type { ComponentProps, ReactNode } from 'react';
import { useContextContribution } from '../context-contributions';
import type { WorkbenchSession } from '../session';
import { IconChevronDown, IconSend, IconTune } from './icons';
import { Menu } from './menu';

type Context = NonNullable<WorkbenchSession['executionContext']>;

export function InstructionContextItems() {
  const context = useContextContribution();
  if (!context.items.length && !context.contextError) return null;
  return (
    <section aria-label="附加上下文" className="execution-status composer-context-items">
      <Menu
        label="查看附加上下文"
        summary={`${context.items.length} 个附加项`}
        className="menu--up"
      >
        {context.items.map((item, index) => (
          <details key={item.itemId}>
            <summary>
              {index + 1}.{' '}
              {item.kind === 'text'
                ? item.contentState === 'draft'
                  ? '草稿摘录'
                  : '文字摘录'
                : item.kind === 'object'
                  ? item.name
                  : item.kind === 'region'
                    ? '图片区域'
                    : '资源'}
            </summary>
            <p>
              {item.ref.source === 'project' ? '项目材料' : '库材料'} · {item.basis}
            </p>
            {item.kind === 'text' ? <blockquote>{item.quote}</blockquote> : null}
            {item.kind === 'object' ? <p>{item.semantics}</p> : null}
            {item.kind === 'region' ? (
              <p>
                区域：{Math.round(item.region.x * 100)}%，{Math.round(item.region.y * 100)}%；
                {Math.round(item.region.width * 100)}% × {Math.round(item.region.height * 100)}%
              </p>
            ) : null}
            <label>
              批注
              <textarea
                aria-label={`上下文批注 ${index + 1}`}
                value={item.comment ?? ''}
                onChange={(event) => context.updateContextComment(item.itemId, event.target.value)}
              />
            </label>
            <button
              type="button"
              className="text-btn"
              aria-label={`移除上下文 ${index + 1}`}
              onClick={() => context.removeContextItem(item.itemId)}
            >
              移除
            </button>
          </details>
        ))}
      </Menu>
      {context.contextError ? <p role="alert">{context.contextError}</p> : null}
    </section>
  );
}

function PickerOption({
  name,
  value,
  current,
  onSelect,
  children,
}: {
  name: string;
  value: string;
  current: string;
  onSelect: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="composer-picker__option">
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={() => onSelect(value)}
      />
      <span>{children}</span>
    </label>
  );
}

/**
 * Codex 式聚合入口：overlay 显示当前模型与推理强度，dock 只留图标；点击后在同一弹层内选择两项。
 * “跟随默认”清除对应会话覆盖；所选模型不支持推理强度时禁用该组并说明原因。
 */
function ModelPicker({ context, compact }: { context: Context; compact: boolean }) {
  const supportsEffort = context.supportsEffort !== false;
  const summary =
    supportsEffort && context.effort ? `${context.model} · ${context.effort}` : context.model;
  const label = `模型与推理强度：${summary}`;
  const trigger = compact ? (
    <IconTune />
  ) : (
    <>
      <span className="composer-picker__summary">{summary}</span>
      <IconChevronDown />
    </>
  );
  const className = `composer-picker${compact ? ' composer-picker--icon' : ''}`;
  if (context.configureDisabled)
    return (
      <button type="button" className={className} aria-label={label} title={label} disabled>
        {trigger}
      </button>
    );
  return (
    <span title={label} className="composer-picker__anchor">
      <Menu label={label} summary={trigger} className={`menu--up ${className}`}>
        <fieldset className="composer-picker__group">
          <legend>模型</legend>
          <PickerOption
            name="composer-model"
            value=""
            current={context.modelOverridden ? context.model : ''}
            onSelect={() => context.onModelChange?.(null)}
          >
            跟随默认（{context.defaultModel ?? context.model}）
          </PickerOption>
          {context.modelOptions?.map((option) => (
            <PickerOption
              key={option.id}
              name="composer-model"
              value={option.id}
              current={context.modelOverridden ? context.model : ''}
              onSelect={(value) => context.onModelChange?.(value)}
            >
              {option.id}
            </PickerOption>
          ))}
        </fieldset>
        <fieldset className="composer-picker__group" disabled={!supportsEffort}>
          <legend>推理强度</legend>
          {!supportsEffort ? <p className="menu__hint">该模型不支持推理强度</p> : null}
          <PickerOption
            name="composer-effort"
            value=""
            current={context.effortOverridden ? (context.effort ?? '') : ''}
            onSelect={() => context.onEffortChange?.(null)}
          >
            跟随默认（{context.defaultEffort ?? context.effort}）
          </PickerOption>
          {context.effortOptions?.map((effort) => (
            <PickerOption
              key={effort}
              name="composer-effort"
              value={effort}
              current={context.effortOverridden ? (context.effort ?? '') : ''}
              onSelect={(value) => context.onEffortChange?.(value as Effort)}
            >
              {effort}
            </PickerOption>
          ))}
        </fieldset>
      </Menu>
    </span>
  );
}

/**
 * dock 与 overlay 共用的执行上下文配置行：左侧权限只读段与模型／推理强度聚合入口，右侧取消／发送；
 * 模型与推理强度选项只来自内核下发的 provider 目录；项目环境行窄窗口可隐藏。
 */
export function ExecutionContext({
  context,
  actions,
  compact = false,
}: {
  context: WorkbenchSession['executionContext'];
  actions?: ReactNode;
  /** dock 形态：聚合入口只显示图标。 */
  compact?: boolean;
}) {
  const configurable =
    !!context?.modelOptions?.length && !!context.onModelChange && !!context.onEffortChange;
  const permissions = context ? `权限：${context.permissions}` : '权限未就绪';
  return (
    <section className="composer-context" aria-label="执行上下文">
      <div className="composer-config">
        <div className="composer-config__options">
          <span className="composer-context__field" title={permissions}>
            {permissions}
          </span>
          {configurable && context ? (
            <ModelPicker context={context} compact={compact} />
          ) : (
            <span className="composer-context__field">
              {context ? `模型：${context.model}` : '模型未就绪'}
            </span>
          )}
        </div>
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
