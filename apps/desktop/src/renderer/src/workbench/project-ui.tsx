import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { KernelClient } from '@scholoom/client';
import type { FileEdit } from '@scholoom/protocol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { draftKey } from './drafts';
import { fileDocument, useFileDocument } from './file-document';
import { lineDiff } from './line-diff';
import { MarkdownPreview } from './MarkdownPreview';
import type { FileTarget } from './session';
import { useFileWatch } from './useFileWatch';

export { ProjectControls } from './ProjectNavigation';

export function FileEditor({
  client,
  directory,
  target,
  onChanged,
  revision = 0,
  mode = 'source',
  onOpenFile,
  onDirty,
}: {
  client: KernelClient;
  directory: string;
  target: FileTarget;
  onChanged: (target: FileTarget) => void;
  revision?: number;
  mode?: 'source' | 'preview';
  onOpenFile?: (target: FileTarget) => void;
  onDirty?: (() => void) | undefined;
}) {
  const document = useMemo(
    () =>
      fileDocument(
        draftKey(directory, target.projectId, target.fileId ?? target.path, 'file'),
        draftKey(directory, target.projectId, target.path, 'file'),
      ),
    [directory, target.projectId, target.fileId, target.path],
  );
  const value = useFileDocument(document);
  const mount = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const applying = useRef(false);
  const dirtyCallback = useRef(onDirty);
  dirtyCallback.current = onDirty;
  const active = useRef(0);
  const [path, setPath] = useState(target.path);
  const [edits, setEdits] = useState<FileEdit[]>([]);
  const [saving, setSaving] = useState(false);
  const currentPath = useCallback(async () => {
    const fileId = target.fileId ?? document.get().source?.fileId;
    if (!fileId) return target.path;
    const [location] = await client.call('files.resolve', {
      projectId: target.projectId,
      fileIds: [fileId],
    });
    if (location?.state !== 'present')
      throw new Error('原文件已回收或缺失；草稿保留，可在回收站恢复。');
    return location.path;
  }, [client, target.projectId, target.fileId, target.path, document]);
  const reload = useCallback(
    async (explicit = false) => {
      const generation = ++active.current;
      try {
        const current = await currentPath();
        const source = await client.call('files.read', {
          projectId: target.projectId,
          path: current,
        });
        if (generation !== active.current) return;
        setPath(current);
        if (source.fileId)
          document.moveTo(draftKey(directory, target.projectId, source.fileId, 'file'));
        const state = document.get();
        const dirty = state.loaded && state.content !== state.source?.content;
        if (!explicit && dirty && state.source?.content !== source.content) {
          document.update({ diskChanged: true, error: '' });
          return;
        }
        document.update({
          source,
          content: dirty || (!state.loaded && document.hasDraft()) ? state.content : source.content,
          loaded: true,
          error: '',
          diskChanged: false,
        });
      } catch (error) {
        if (generation === active.current)
          document.update({
            error: error instanceof Error ? error.message : '读取失败，草稿已保留。',
          });
      }
    },
    [client, currentPath, directory, target.projectId, document],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 文件修订变化时重读已打开文档。
  useEffect(() => {
    if (!target.create || document.get().source) void reload();
    else document.update({ loaded: true });
    return () => {
      active.current++;
    };
  }, [target.create, revision, reload, document]);
  const watchError = useFileWatch(
    client,
    target.projectId,
    [path],
    (paths) => {
      if (paths.some((item) => !item || item === path || path.startsWith(`${item}/`)))
        void reload();
    },
    () => {
      void reload();
    },
  );
  useEffect(() => {
    if (mode !== 'source' || !mount.current) return;
    const view = new EditorView({
      parent: mount.current,
      state: EditorState.create({
        doc: document.get().content,
        extensions: [
          markdown(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': `文件内容 ${path}` }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applying.current) {
              document.update({ content: update.state.doc.toString() }, true);
              dirtyCallback.current?.();
            }
          }),
        ],
      }),
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, [document, mode, path]);
  useEffect(() => {
    if (mode === 'source' && target.openMode !== 'preview') editor.current?.focus();
  }, [mode, target.openMode]);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value.content) {
      applying.current = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value.content } });
      applying.current = false;
    }
  }, [value.content]);
  const save = async () => {
    const submitted = document.get().content;
    setSaving(true);
    try {
      const current = await currentPath();
      const source = document.get().source;
      const edit = await client.call('files.save', {
        projectId: target.projectId,
        path: current,
        content: submitted,
        ...(source?.basis ? { basis: source.basis } : {}),
      });
      const stored = await client.call('files.read', {
        projectId: target.projectId,
        path: current,
      });
      const latest = document.get();
      if (edit.fileId) document.moveTo(draftKey(directory, target.projectId, edit.fileId, 'file'));
      document.update({ source: stored, error: '', diskChanged: false });
      if (latest.content === submitted && stored.content === submitted) document.clearDraft();
      onChanged({
        projectId: target.projectId,
        path: current,
        ...(stored.fileId ? { fileId: stored.fileId } : {}),
      });
    } catch (error) {
      document.update({
        error: error instanceof Error ? error.message : '保存未完成，草稿已保留。',
      });
    } finally {
      setSaving(false);
    }
  };
  const resource = useCallback(
    (local: string) => client.call('files.resource', { projectId: target.projectId, path: local }),
    [client, target.projectId],
  );
  const openFile = useCallback(
    (local: string) => onOpenFile?.({ projectId: target.projectId, path: local }),
    [onOpenFile, target.projectId],
  );
  const external = useCallback((url: string) => {
    if (!/^(https?:|mailto:)/i.test(url)) return;
    if (window.scholoomDesktop) void window.scholoomDesktop.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }, []);
  const differences = useMemo(
    () => lineDiff(value.source?.content ?? '', value.content),
    [value.source?.content, value.content],
  );
  return (
    <section className="file-editor" aria-label={`编辑 ${path}`}>
      <div className="file-toolbar">
        <span>
          {path}
          {value.content !== value.source?.content ? ' · 未保存' : ''}
        </span>
        <button
          type="button"
          className="btn"
          disabled={!!value.source?.truncated || saving}
          onClick={() => {
            void save();
          }}
        >
          保存文件
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void reload(true);
          }}
        >
          重新读取
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void currentPath()
              .then((current) =>
                client.call('files.history', { projectId: target.projectId, path: current }),
              )
              .then(setEdits, (error) => document.update({ error: String(error) }));
          }}
        >
          修改历史
        </button>
      </div>
      {value.source?.truncated ? <p>文件超过本期编辑范围，仅显示当前读取部分。</p> : null}
      {value.diskChanged ? (
        <p role="status">磁盘内容已变化。草稿已保留，请重新读取并核对差异。</p>
      ) : null}
      {value.error ? <p role="alert">{value.error} 草稿已保留。</p> : null}
      {watchError ? <p role="status">自动更新暂不可用：{watchError}</p> : null}
      {mode === 'preview' ? (
        /\.(md|markdown)$/i.test(path) ? (
          <>
            <p className="preview-status">
              {value.content !== value.source?.content ? '未保存草稿预览' : '已保存内容预览'}
            </p>
            <MarkdownPreview
              documentKey={draftKey(directory, target.projectId, target.fileId ?? path)}
              content={value.content}
              basePath={path}
              resourceRevision={revision}
              readResource={resource}
              openFile={openFile}
              openExternal={external}
            />
          </>
        ) : (
          <p>此文件提供源码查看，Markdown 文件可预览。</p>
        )
      ) : (
        <>
          <div className="codemirror-host" ref={mount} />
          <details>
            <summary>查看差异</summary>
            {differences ? (
              <pre>
                {differences.map((row, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 只读差异行无状态，相同内容可出现多次。
                  <div key={`${index}-${row.kind}`} className={`diff-${row.kind}`}>
                    {row.kind === 'add' ? '+ ' : row.kind === 'remove' ? '- ' : '  '}
                    {row.text}
                  </div>
                ))}
              </pre>
            ) : (
              <>
                <pre>{value.source?.content}</pre>
                <pre>{value.content}</pre>
              </>
            )}
          </details>
          {edits.map((edit) => (
            <details key={edit.id}>
              <summary>{edit.createdAt}</summary>
              <pre>{edit.before}</pre>
              <pre>{edit.after}</pre>
              <button
                type="button"
                onClick={() => {
                  void client
                    .call('files.undo', { projectId: target.projectId, editId: edit.id })
                    .then(
                      () => reload(true),
                      (error) => document.update({ error: String(error) }),
                    );
                }}
              >
                撤销此修改
              </button>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
