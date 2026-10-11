import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
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

export function Workbench({ session }: { session: WorkbenchSession }) {
  const runtime = useExternalStoreRuntime(session.adapter);

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
          <p role="status" aria-label="连接状态">
            {session.status === 'sample' ? '样例场景 · 刷新后重置' : '内核未连接'}
          </p>
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
