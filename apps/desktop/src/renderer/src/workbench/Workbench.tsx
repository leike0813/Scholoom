import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import { useRef } from 'react';
import type { WorkbenchSession } from './session';

function UserMessage() {
  return (
    <MessagePrimitive.Root asChild>
      <article className="workbench__message" aria-label="用户消息">
        <h3>指令</h3>
        <MessagePrimitive.Parts />
      </article>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root asChild>
      <article className="workbench__message" aria-label="Agent 回复">
        <h3>回复</h3>
        <MessagePrimitive.Parts />
      </article>
    </MessagePrimitive.Root>
  );
}

/** 明确停机入口：说明影响范围，确认与取消都是可键盘操作的常规控件。 */
function StopKernel({ onStop }: { onStop: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (menu.current !== null) menu.current.open = false;
  };

  return (
    <details className="workbench__menu" ref={menu}>
      <summary>停止内核</summary>
      <p>停止后所有已连接的客户端（包括其他窗口与 CLI）都会断开，需要重新启动才能继续。</p>
      <div className="workbench__actions">
        <button
          type="button"
          onClick={() => {
            close();
            onStop();
          }}
        >
          确认停止
        </button>
        <button type="button" onClick={close}>
          取消
        </button>
      </div>
    </details>
  );
}

export function Workbench({ session }: { session: WorkbenchSession }) {
  const runtime = useExternalStoreRuntime(session.adapter);
  const connection = session.connection;

  const reset = () => {
    session.reset?.();
    runtime.thread.composer.setText('');
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="workbench">
        <header className="workbench__header">
          <h1>Scholoom</h1>
          <p>科研工作台</p>
          <div className="workbench__lifecycle">
            <p role="status" aria-label="连接状态">
              {connection?.message ??
                (session.status === 'sample' ? '样例场景 · 刷新后重置' : '内核未连接')}
            </p>
            {connection?.instanceId ? (
              <p className="workbench__detail">实例 {connection.instanceId}</p>
            ) : null}
            {connection?.retry ? (
              <button type="button" onClick={connection.retry}>
                重试连接
              </button>
            ) : null}
            {connection?.inspect ? (
              <button type="button" onClick={connection.inspect}>
                查询状态
              </button>
            ) : null}
            {connection?.stop ? <StopKernel onStop={connection.stop} /> : null}
          </div>
        </header>
        <div className="workbench__columns">
          <section className="workbench__panel" aria-labelledby="materials-title">
            <h2 id="materials-title">材料</h2>
            {session.materials.length === 0 ? (
              <p>暂无材料</p>
            ) : (
              <ul className="workbench__materials">
                {session.materials.map((name) => (
                  <li key={name}>
                    <label className="workbench__material">
                      <input
                        type="checkbox"
                        checked={session.selectedMaterials.includes(name)}
                        onChange={() => session.toggleMaterial(name)}
                      />
                      <span>{name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="workbench__panel" aria-labelledby="agent-title">
            <h2 id="agent-title">Agent 交流</h2>
            <ThreadPrimitive.Root>
              <ThreadPrimitive.Viewport className="workbench__messages" aria-live="polite">
                <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
              </ThreadPrimitive.Viewport>
              <ComposerPrimitive.Root className="workbench__composer">
                <label htmlFor="research-instruction">研究指令</label>
                <ComposerPrimitive.Input
                  id="research-instruction"
                  className="workbench__input"
                  minRows={6}
                  maxRows={12}
                  submitMode="ctrlEnter"
                />
                <div className="workbench__actions">
                  <ComposerPrimitive.Send>发送指令</ComposerPrimitive.Send>
                  {session.reset ? (
                    <button type="button" onClick={reset}>
                      重置示例
                    </button>
                  ) : null}
                </div>
              </ComposerPrimitive.Root>
            </ThreadPrimitive.Root>
          </section>
        </div>
      </main>
    </AssistantRuntimeProvider>
  );
}
