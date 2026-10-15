import { useAuiState } from '@assistant-ui/react';
import type { Message } from '@scholoom/protocol';
import { createContext, useContext, useState } from 'react';
import { MarkdownText } from './MarkdownText';
import type { WorkbenchSession } from './session';

export const MessageFiles = createContext<{
  documentKey: string;
  openFile: WorkbenchSession['openMessageFile'];
}>({ documentKey: '', openFile: undefined });

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
      {feedback?.key === documentKey ? (
        <span role={feedback.error ? 'alert' : 'status'}>{feedback.message}</span>
      ) : null}
    </footer>
  );
}
