import { useAuiState } from '@assistant-ui/react';
import type { Artifact, Message, ResourceRef, Run } from '@scholoom/protocol';
import { createContext, useContext, useState } from 'react';
import { ContextItemLocation } from './ContextItemLocation';
import { MarkdownText } from './MarkdownText';
import { graphPrompt, graphResults, graphStateLabel } from './projection';
import { resourceSourceLabels } from './resource-controller';
import type { WorkbenchSession } from './session';

export const MessageFiles = createContext<{
  documentKey: string;
  openFile: WorkbenchSession['openMessageFile'];
  openResource?: ((ref: ResourceRef) => Promise<void>) | undefined;
}>({ documentKey: '', openFile: undefined });

export function GraphRunContent({ run }: { run: Run }) {
  const { openResource } = useContext(MessageFiles);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const rows = graphResults(run);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
  const prompt = graphPrompt(run);
  const failure =
    run.error ??
    (run.graphProgress?.kind === 'graph.failed' ? run.graphProgress.error.message : undefined);
  return (
    <section aria-label="科研图状态">
      <strong>科研图 · {graphStateLabel(run)}</strong>
      {prompt !== undefined ? <p className="message-user-text">{prompt}</p> : null}
      {failure ? <p>{failure}</p> : null}
      {rows.length ? (
        <section aria-label="科研图成果">
          <p>已记录成果及操作 {rows.length} 项；保存与关联状态分别列出。</p>
          {rows.slice(currentPage * 25, (currentPage + 1) * 25).map((row) => {
            const resource =
              row.result?.resource ??
              (row.creation && 'resource' in row.creation ? row.creation.resource : undefined);
            const association =
              row.result?.association ??
              (row.creation && 'association' in row.creation
                ? row.creation.association
                : undefined);
            const creation = row.creation;
            const creationError = creation && 'error' in creation ? creation.error : undefined;
            return (
              <div
                className="artifact-card"
                key={JSON.stringify([
                  row.role,
                  resource?.ref,
                  resource?.basis,
                  creation?.operationId,
                  row.result?.editId,
                ])}
              >
                <div className="artifact-card__info">
                  <span className="artifact-card__name">
                    {row.role === 'report'
                      ? '报告'
                      : row.role === 'process'
                        ? '研究过程'
                        : (row.role ?? '成果')}
                    {resource ? ` · ${resource.name}` : ''}
                  </span>
                  {resource?.path ? (
                    <span className="artifact-card__path">{resource.path}</span>
                  ) : null}
                  <span>
                    {creation
                      ? {
                          complete: '创建已确认',
                          prepared: '创建待核查',
                          unknown: '创建结果未知',
                          failed: '创建失败',
                        }[creation.state]
                      : row.result?.editId
                        ? '保存有回执'
                        : '已记录资源，保存待核查'}
                    {' · '}
                    {association
                      ? {
                          confirmed: '执行关联已确认',
                          pending: '执行关联待核查',
                          unknown: '执行关联结果未知',
                        }[association.state]
                      : '执行关联未确认'}
                  </span>
                </div>
                {resource ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      aria-label={`打开当前成果 ${resource.name}`}
                      disabled={
                        !openResource || !resource.capabilities.read || !!resource.unavailableReason
                      }
                      onClick={() => {
                        setError('');
                        void openResource?.(resource.ref).catch((reason: unknown) =>
                          setError(reason instanceof Error ? reason.message : '成果无法打开。'),
                        );
                      }}
                    >
                      打开当前成果
                    </button>
                    <span className="artifact-card__note">
                      打开当前版本；未核对与图保存时版本是否一致。
                    </span>
                    <details className="artifact-card__note">
                      <summary>保存时资源依据</summary>
                      <p className="message-user-text">
                        {JSON.stringify(resource.ref)} · {resource.basis}
                      </p>
                      {row.result?.editId ? <p>保存编号：{row.result.editId}</p> : null}
                      {association ? <p>关联编号：{association.operationId}</p> : null}
                    </details>
                    {resource.unavailableReason ? (
                      <p className="artifact-card__note">{resource.unavailableReason}</p>
                    ) : null}
                  </>
                ) : null}
                {creation ? (
                  <span className="artifact-card__note">创建编号：{creation.operationId}</span>
                ) : null}
                {creationError ? (
                  <p className="artifact-card__note">{creationError.message}</p>
                ) : null}
              </div>
            );
          })}
          {rows.length > 25 ? (
            <nav aria-label="科研图成果分页">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                上一页
              </button>
              <span>第 {currentPage + 1} 页</span>
              <button
                type="button"
                disabled={(currentPage + 1) * 25 >= rows.length}
                onClick={() => setPage(currentPage + 1)}
              >
                下一页
              </button>
            </nav>
          ) : null}
        </section>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

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
  const { openFile, openResource, documentKey } = useContext(MessageFiles);
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
                {resourceSourceLabels[item.ref.source]} · {item.basis}
              </span>
              {item.ref.source === 'render' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!openResource}
                  onClick={() => {
                    void openResource?.(item.ref).catch((reason: unknown) =>
                      setFeedback({
                        key: documentKey,
                        message: reason instanceof Error ? reason.message : '排版产物无法打开。',
                        error: true,
                      }),
                    );
                  }}
                >
                  打开排版产物
                </button>
              ) : null}
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
