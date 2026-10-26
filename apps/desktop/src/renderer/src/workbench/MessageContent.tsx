import { useAuiState } from '@assistant-ui/react';
import type { Artifact, Message } from '@scholoom/protocol';
import { createContext, useContext, useState } from 'react';
import { ContextItemLocation } from './ContextItemLocation';
import { MarkdownText } from './MarkdownText';
import type { WorkbenchSession } from './session';

export const MessageFiles = createContext<{
  documentKey: string;
  openFile: WorkbenchSession['openMessageFile'];
}>({ documentKey: '', openFile: undefined });

export function MessageArtifacts() {
  const artifacts = useAuiState((state) => state.message.metadata.custom.artifacts) as
    | readonly Artifact[]
    | undefined;
  const { openFile } = useContext(MessageFiles);
  const [error, setError] = useState('');
  const open = async (artifact: Artifact) => {
    setError('');
    try {
      await openFile?.(artifact.location?.path ?? artifact.path, artifact.fileId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '成果无法打开。');
    }
  };
  return artifacts?.length ? (
    <section aria-label="本轮成果">
      {artifacts.map((artifact) => (
        <div className="artifact-card" key={`${artifact.runId}:${artifact.path}`}>
          <div className="artifact-card__info">
            <span className="artifact-card__name" title={artifact.path}>
              {artifact.path.split('/').pop() ?? artifact.path}
            </span>
            <span className="artifact-card__path" title={artifact.path}>
              {artifact.location?.path ?? artifact.path}
            </span>
          </div>
          <button
            type="button"
            className="btn"
            aria-label={`打开成果 ${artifact.path}`}
            disabled={!openFile || (!!artifact.location && artifact.location.state !== 'present')}
            onClick={() => void open(artifact)}
          >
            打开成果
          </button>
          {artifact.location?.state === 'trashed' ? (
            <span className="artifact-card__note">已回收，可在回收站恢复</span>
          ) : null}
        </div>
      ))}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  ) : null;
}

export function MessageContent({ text }: { text: string }) {
  const { documentKey, openFile } = useContext(MessageFiles);
  const id = useAuiState((state) => state.message.id);
  const role = useAuiState((state) => state.message.role);
  const [error, setError] = useState('');
  const open = (path: string) => {
    setError('');
    void openFile?.(path).catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : '文件无法打开。'),
    );
  };
  const external = (url: string) => {
    setError('');
    if (window.scholoomDesktop)
      void window.scholoomDesktop.openExternal(url).catch(() => setError('外部链接无法打开。'));
    else window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <>
      {role === 'assistant' ? (
        <MarkdownText
          content={text}
          documentKey={`${documentKey}:${id}`}
          {...(openFile ? { openFile: open } : {})}
          openExternal={external}
        />
      ) : (
        <span className="message-user-text">{text}</span>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}

export function MessageFacts() {
  const source = useAuiState((state) => state.message.metadata.custom.source) as
    | Message
    | undefined;
  const { openFile, documentKey } = useContext(MessageFiles);
  const [feedback, setFeedback] = useState<{ key: string; message: string; error: boolean }>();
  if (!source || source.role === 'tool') return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source.text);
      setFeedback({ key: documentKey, message: '已复制正文', error: false });
    } catch {
      setFeedback({ key: documentKey, message: '复制失败，请手动选择正文复制。', error: true });
    }
  };
  const open = async (path: string, fileId?: string) => {
    try {
      await openFile?.(path, fileId);
    } catch (reason) {
      setFeedback({
        key: documentKey,
        message: reason instanceof Error ? reason.message : '材料无法打开。',
        error: true,
      });
    }
  };
  return (
    <footer className="message-facts">
      {source.role === 'user' ? (
        <span>{source.state === 'accepted' ? '已受理' : '已消费'}</span>
      ) : null}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={source.role === 'user' ? '复制用户正文' : '复制 Agent 正文'}
      >
        复制正文
      </button>
      {source.materials.length ? (
        <div className="message-materials">
          <span>{source.role === 'user' ? '附加材料' : '实际使用材料'}：</span>
          {source.materials.map((path, index) => (
            <button
              type="button"
              key={source.materialFileIds?.[index] ?? path}
              disabled={!openFile}
              onClick={() => void open(path, source.materialFileIds?.[index])}
              aria-label={`打开材料 ${path}`}
            >
              {path}
              {source.materialFileIds?.[index] ? '' : '（历史路径）'}
            </button>
          ))}
        </div>
      ) : null}
      {source.contextItems?.length ? (
        <details className="message-materials">
          <summary>明确附加上下文（{source.contextItems.length}）</summary>
          {source.contextItems.map((item) => (
            <div key={item.itemId}>
              <span>
                {(item.kind === 'text' || item.kind === 'object') && item.contentState === 'draft'
                  ? item.kind === 'text'
                    ? '草稿摘录'
                    : '草稿对象'
                  : item.kind}
              </span>
              <span>
                {item.ref.source === 'project' ? '项目材料' : '库材料'} · {item.basis}
              </span>
              {item.kind === 'text' ? <blockquote>{item.quote}</blockquote> : null}
              {item.kind === 'object' ? (
                <p>
                  {item.name}：{item.semantics}
                </p>
              ) : null}
              <ContextItemLocation item={item} />
              {item.comment ? <p>{item.comment}</p> : null}
            </div>
          ))}
        </details>
      ) : null}
      {feedback?.key === documentKey ? (
        <span role={feedback.error ? 'alert' : 'status'}>{feedback.message}</span>
      ) : null}
    </footer>
  );
}
