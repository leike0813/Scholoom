import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { useState } from 'react';
import { toolCallView, toolStateDot, toolStateLabel } from '../projection';
import { DelegationCall } from './DelegationCall';

/** overlay 工具记录：摘要为调用名与状态，展开显示有界输入与结果预览。 */
export function ToolCall(props: ToolCallMessagePartProps) {
  const view = toolCallView(props);
  const label = toolStateLabel(view.state);
  const [expanded, setExpanded] = useState(false);

  return (
    <details className="tool-call" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="tool-call__summary">
        <span className={toolStateDot(view.state)} role="img" aria-label={label} />
        <span className="tool-call__name">Ran {view.name}</span>
        <span className="tool-call__state">{label}</span>
      </summary>
      <div className="tool-call__body">
        {expanded && view.delegationId ? <DelegationCall delegationId={view.delegationId} /> : null}
        <div className="tool-call__label">输入</div>
        <pre>{view.input}</pre>
        {view.inputTruncated ? <p className="tool-call__hint">输入已截断，仅显示预览</p> : null}
        {view.output !== undefined ? (
          <>
            <div className="tool-call__label">{view.state === 'error' ? '相关原因' : '结果'}</div>
            <pre>{view.output}</pre>
            {view.outputTruncated ? (
              <p className="tool-call__hint">结果已截断，仅显示预览</p>
            ) : null}
          </>
        ) : null}
      </div>
    </details>
  );
}
