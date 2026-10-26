import type { KernelClient } from '@scholoom/client';
import type {
  ContextItem,
  FileContent,
  FileEdit,
  ResourceDescriptor,
  ResourceRef,
} from '@scholoom/protocol';
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ContentSelection } from './content-selection';
import { useContextContribution } from './context-contributions';
import { draftKey } from './drafts';
import { RenderPane } from './editor/RenderPane';
import { SourceEditor } from './editor/SourceEditor';
import { fileDocument, useFileDocument } from './file-document';
import { MarkdownPreview } from './MarkdownPreview';
import { ContentDiff, MaterialChangeView } from './MaterialChangeView';
import { ReadingRecordsPanel } from './ReadingRecordsPanel';
import {
  projectTarget,
  type ReadingRecordAdapter,
  type ResourceTarget,
  resourceKey,
  sameResourceRef,
  type WorkbenchResourcePort,
} from './resource-controller';
import type { FileTarget } from './session';
import type { FileViewMode } from './tab-state';
import { useFileWatch } from './useFileWatch';

export { ProjectControls } from './ProjectNavigation';

const VisualEditor = lazy(() =>
  import('./editor/VisualEditor').then((module) => ({ default: module.VisualEditor })),
);

export function FileEditor({
  client,
  directory,
  resourceTarget,
  port,
  enabled = true,
  records,
  onChanged,
  revision = 0,
  mode = 'source',
  onOpenFile,
  onDirty,
  editorViewId,
}: {
  client: KernelClient;
  directory: string;
  resourceTarget: ResourceTarget;
  port: WorkbenchResourcePort;
  enabled?: boolean;
  records?: ReadingRecordAdapter | undefined;
  onChanged?: ((target: FileTarget) => void) | undefined;
  revision?: number;
  mode?: FileViewMode;
  onOpenFile?: (target: FileTarget) => void;
  onDirty?: (() => void) | undefined;
  editorViewId?: string | undefined;
}) {
  const project = useMemo(() => projectTarget(resourceTarget), [resourceTarget]);
  const locatorKey = resourceKey(resourceTarget);
  const locator = useMemo(
    () =>
      project
        ? {
            source: 'project' as const,
            projectId: project.projectId,
            ...(project.fileId ? { fileId: project.fileId } : { path: project.path }),
          }
        : resourceTarget.locator,
    [project, resourceTarget.locator],
  );
  const initialPath = project?.path ?? resourceTarget.name;
  const document = useMemo(
    () =>
      fileDocument(
        project
          ? draftKey(directory, project.projectId, project.fileId ?? project.path, 'file')
          : draftKey(directory, locatorKey, 'file'),
        project
          ? draftKey(directory, project.projectId, project.path, 'file')
          : draftKey(directory, locatorKey, 'file'),
      ),
    [directory, locatorKey, project],
  );
  const value = useFileDocument(document);
  const boundRef = useRef<ResourceRef | undefined>(undefined);
  const currentLocator = useCallback(() => {
    if (boundRef.current) return boundRef.current;
    const fileId = project?.fileId ?? document.get().source?.fileId;
    return project && fileId
      ? { source: 'project' as const, projectId: project.projectId, fileId }
      : locator;
  }, [project, document, locator]);
  const changedCallback = useRef(onChanged);
  changedCallback.current = onChanged;
  const [descriptor, setDescriptor] = useState<ResourceDescriptor>();
  const [accessRevoked, setAccessRevoked] = useState(false);
  const libraryLocator =
    resourceTarget.locator.source === 'library' ? resourceTarget.locator : undefined;
  const descriptorMatches = project
    ? descriptor?.ref.source === 'project' &&
      descriptor.ref.projectId === project.projectId &&
      (project.fileId ? descriptor.ref.fileId === project.fileId : descriptor.path === project.path)
    : libraryLocator &&
      descriptor?.ref.source === 'library' &&
      descriptor.ref.attachmentId === libraryLocator.attachmentId &&
      descriptor.ref.materialVersionId === libraryLocator.materialVersionId;
  const writable =
    !!project &&
    ((descriptorMatches && !!descriptor?.capabilities.write) ||
      (!!project.create && !project.fileId && !value.source));
  const projectWritable = !!project && descriptorMatches && !!descriptor?.capabilities.write;
  const instanceId = useId();
  const viewId = editorViewId ?? instanceId;
  const context = useContextContribution();
  const [sourceSelection, setSourceSelection] = useState<ContentSelection | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 模式或文稿切换使旧视图选择失效。
  useEffect(() => setSourceSelection(null), [mode, document]);
  const contextItem = useMemo<ContextItem | undefined>(() => {
    if (
      !enabled ||
      !descriptorMatches ||
      !descriptor?.capabilities.read ||
      accessRevoked ||
      (sourceSelection && 'error' in sourceSelection) ||
      mode === 'render' ||
      value.visualRecovery
    )
      return undefined;
    const base = {
      itemId: crypto.randomUUID(),
      ref: descriptor.ref,
      basis: value.source?.basis ?? descriptor.basis,
    };
    const contentState =
      value.content !== value.source?.content ||
      value.conversionOwner ||
      sourceSelection?.contentState === 'draft'
        ? 'draft'
        : 'saved';
    return sourceSelection && 'kind' in sourceSelection && sourceSelection.kind === 'object'
      ? { ...sourceSelection, ...base, contentState }
      : sourceSelection && 'quote' in sourceSelection
        ? {
            ...base,
            kind: 'text',
            quote: sourceSelection.quote,
            contentState,
          }
        : { ...base, kind: 'resource' };
  }, [
    enabled,
    descriptorMatches,
    descriptor,
    accessRevoked,
    sourceSelection,
    mode,
    value.visualRecovery,
    value.content,
    value.source?.content,
    value.source?.basis,
    value.conversionOwner,
  ]);
  const contribute = context.contributeSelection;
  useEffect(() => {
    if (mode === 'render') return;
    contribute(viewId, contextItem ? { selections: [contextItem] } : undefined);
    return () => contribute(viewId);
  }, [contribute, viewId, contextItem, mode]);
  const unregisterFlush = useRef<(() => void) | undefined>(undefined);
  const registerFlush = useCallback(
    (next: (() => Promise<void>) | undefined) => {
      unregisterFlush.current?.();
      unregisterFlush.current = next ? document.registerFlusher(next) : undefined;
    },
    [document],
  );
  const pending = useCallback(
    (active: boolean) => {
      if (active) {
        if (document.get().conversionOwner !== viewId) document.update({ conversionOwner: viewId });
      } else if (document.get().conversionOwner === viewId)
        document.update({ conversionOwner: undefined });
    },
    [document, viewId],
  );
  const readOnly =
    !writable ||
    !!value.source?.truncated ||
    !!value.visualRecovery ||
    (!!value.conversionOwner && value.conversionOwner !== viewId);
  const dirtyCallback = useRef(onDirty);
  dirtyCallback.current = onDirty;
  const active = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [path, setPath] = useState(initialPath);
  const [edits, setEdits] = useState<FileEdit[]>([]);
  const [saving, setSaving] = useState(false);
  const readResource = useCallback(async () => {
    const before = await port.describe(currentLocator());
    boundRef.current = before.ref;
    if (!before.capabilities.read) throw new Error('此资源当前不可读取。');
    if (before.format !== 'text') throw new Error('当前格式不支持源码查看。');
    const result = await port.read({ ref: before.ref, basis: before.basis, encoding: 'utf8' });
    const after = await port.describe(before.ref);
    if (
      before.basis !== after.basis ||
      !after.capabilities.read ||
      !sameResourceRef(before.ref, after.ref) ||
      result.basis !== before.basis ||
      !sameResourceRef(result.ref, before.ref)
    )
      throw new Error('资源内容已变化，请重新读取并核对。');
    const source: FileContent = {
      ...(after.ref.source === 'project' ? { fileId: after.ref.fileId } : {}),
      path: after.path ?? after.name,
      content: result.data,
      basis: after.basis,
      truncated: result.truncated || result.nextOffset !== undefined,
    };
    return { descriptor: after, source };
  }, [port, currentLocator]);
  const reload = useCallback(
    async (explicit = false) => {
      const generation = ++active.current;
      try {
        const { descriptor: currentDescriptor, source } = await readResource();
        if (generation !== active.current) return;
        const currentPath = source.path;
        setDescriptor(currentDescriptor);
        setAccessRevoked(false);
        setPath(currentPath);
        if (project && source.fileId)
          document.moveTo(draftKey(directory, project.projectId, source.fileId, 'file'));
        const state = document.get();
        const dirty =
          !!state.conversionOwner || (state.loaded && state.content !== state.source?.content);
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
        if (project && !project.fileId && source.fileId)
          changedCallback.current?.({
            projectId: project.projectId,
            path: project.path,
            fileId: source.fileId,
          });
      } catch (error) {
        if (generation === active.current) {
          const code =
            typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
          if (code === 'permissionDenied' || !project) {
            setDescriptor(undefined);
            setAccessRevoked(code === 'permissionDenied');
          }
          document.update({
            error: error instanceof Error ? error.message : '读取失败，草稿已保留。',
          });
        }
      }
    },
    [readResource, directory, project, document],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 文件修订事件触发当前资源重读，保留草稿。
  useEffect(() => {
    setPath(initialPath);
    setEdits([]);
    if (!project && !enabled) setDescriptor(undefined);
    else if (!project?.create || project.fileId || document.get().source) void reload();
    else document.update({ loaded: true });
    return () => {
      active.current++;
    };
  }, [initialPath, project, revision, reload, document, enabled]);
  useEffect(() => {
    if (resourceTarget.locator.source !== 'library') return;
    return port.subscribe(() => void reload());
  }, [resourceTarget.locator.source, port, reload]);
  const watchError = useFileWatch(
    client,
    project?.projectId ?? '',
    project ? [path] : [],
    (paths) => {
      if (paths.some((item) => !item || item === path || path.startsWith(`${item}/`)))
        void reload();
    },
    () => {
      void reload();
    },
  );
  const save = async () => {
    if (saving || !writable || document.get().source?.truncated || document.get().visualRecovery)
      return;
    setSaving(true);
    try {
      await document.flush();
      const submitted = document.get().content;
      const source = document.get().source;
      if (project.create && !project.fileId && !source) {
        const created = await client.call('files.save', {
          projectId: project.projectId,
          path: project.path,
          content: submitted,
        });
        if (!created.fileId) throw new Error('文件已创建，但稳定身份尚不可用，请核查保存结果。');
        boundRef.current = {
          source: 'project',
          projectId: project.projectId,
          fileId: created.fileId,
        };
      } else {
        const current = await port.describe(currentLocator());
        if (!source || current.basis !== source.basis || !current.capabilities.write)
          throw new Error('资源内容或写入权限已变化，请重新读取并核对。');
        await port.save({ ref: current.ref, basis: current.basis, content: submitted });
      }
      active.current++;
      const { descriptor: storedDescriptor, source: stored } = await readResource();
      const latest = document.get();
      setDescriptor(storedDescriptor);
      setPath(stored.path);
      if (stored.fileId)
        document.moveTo(draftKey(directory, project.projectId, stored.fileId, 'file'));
      document.update({ source: stored, error: '', diskChanged: false });
      if (
        latest.content === submitted &&
        stored.content === submitted &&
        !latest.conversionOwner &&
        !latest.visualRecovery
      )
        document.clearDraft();
      if (mounted.current && storedDescriptor.ref.source === 'project')
        onChanged?.({
          projectId: storedDescriptor.ref.projectId,
          path: project.fileId ? stored.path : project.path,
          fileId: storedDescriptor.ref.fileId,
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
    (local: string) =>
      project
        ? client.call('files.resource', { projectId: project.projectId, path: local })
        : Promise.reject(new Error('文献附件不提供项目相对资源读取。')),
    [client, project],
  );
  const openFile = useCallback(
    (local: string) => {
      if (project) onOpenFile?.({ projectId: project.projectId, path: local });
    },
    [onOpenFile, project],
  );
  const external = useCallback((url: string) => {
    if (!/^(https?:|mailto:)/i.test(url)) return;
    if (window.scholoomDesktop) void window.scholoomDesktop.openExternal(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }, []);
  const renderable = writable && descriptorMatches && !!descriptor?.capabilities.render;
  return (
    <section className="file-editor" aria-label={`编辑 ${path}`}>
      <div className="file-toolbar">
        <span>
          {path}
          {value.loaded && !writable ? ' · 只读' : ''}
          {value.content !== value.source?.content ? ' · 未保存' : ''}
        </span>
        {writable ? (
          <button
            type="button"
            className="btn"
            disabled={!!value.source?.truncated || !!value.visualRecovery || saving}
            onClick={() => {
              void save();
            }}
          >
            保存文件
          </button>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => {
            void reload(true);
          }}
        >
          重新读取
        </button>
        {projectWritable ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!project) return;
              void client
                .call('files.history', { projectId: project.projectId, path })
                .then(setEdits, (error) => document.update({ error: String(error) }));
            }}
          >
            修改历史
          </button>
        ) : null}
      </div>
      {value.source?.truncated ? <p>文件超过本期编辑范围，仅显示当前读取部分。</p> : null}
      {value.diskChanged ? (
        <p role="status">磁盘内容已变化。草稿已保留，请重新读取并核对差异。</p>
      ) : null}
      {value.error ? <p role="alert">{value.error} 草稿已保留。</p> : null}
      {context.available ? (
        <div className="source-editor-tools">
          <button
            type="button"
            className="btn"
            disabled={contextItem?.kind !== 'text' && contextItem?.kind !== 'object'}
            onClick={() => {
              if (contextItem?.kind === 'text' || contextItem?.kind === 'object')
                context.appendContextItem({ ...contextItem, itemId: crypto.randomUUID() });
            }}
          >
            {contextItem?.kind === 'object' ? '附加对象' : '附加选区'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!contextItem}
            onClick={() => {
              if (contextItem)
                context.appendContextItem({
                  kind: 'resource',
                  itemId: crypto.randomUUID(),
                  ref: contextItem.ref,
                  basis: contextItem.basis,
                });
            }}
          >
            附加资源
          </button>
          {(contextItem?.kind === 'text' || contextItem?.kind === 'object') &&
          contextItem.contentState === 'draft' ? (
            <span>{contextItem.kind === 'object' ? '草稿对象' : '草稿摘录'}</span>
          ) : null}
          {sourceSelection && 'error' in sourceSelection ? (
            <p role="alert">
              {sourceSelection.error === 'partialFormula'
                ? '选区包含部分公式，请重新选择完整公式。'
                : '选区超出附加容量，请缩小选择。'}
            </p>
          ) : null}
        </div>
      ) : null}
      {project && watchError ? <p role="status">自动更新暂不可用：{watchError}</p> : null}
      {!project && !enabled ? (
        <p role="status">需连接内核以读取此资源。</p>
      ) : accessRevoked ? (
        <p role="status">已失去此资源的读取权限，正文已隐藏；草稿仍保留。</p>
      ) : !descriptorMatches && (!project || !value.error) && !writable ? (
        <p role="status">{value.error ? '资源当前不可读取。' : '正在打开资源…'}</p>
      ) : mode === 'preview' && !value.visualRecovery ? (
        /\.(md|markdown|qmd)$/i.test(path) ? (
          <>
            <p className="preview-status">
              {value.content !== value.source?.content ? '未保存草稿预览' : '已保存内容预览'}
            </p>
            <MarkdownPreview
              documentKey={
                project
                  ? draftKey(directory, project.projectId, project.fileId ?? path)
                  : draftKey(directory, locatorKey)
              }
              content={value.content}
              basePath={path}
              resourceRevision={revision}
              readResource={resource}
              openFile={openFile}
              openExternal={external}
              onSelection={setSourceSelection}
            />
          </>
        ) : (
          <p>此文件提供源码查看，Markdown 文件可预览。</p>
        )
      ) : mode === 'render' && project && renderable && !value.visualRecovery ? (
        <RenderPane
          key={`${project.projectId}:${path}`}
          client={client}
          target={{ ...project, path }}
          savedContent={value.source?.content ?? ''}
          dirty={value.content !== value.source?.content}
          enabled={enabled && !accessRevoked}
          viewId={viewId}
        />
      ) : projectWritable && (mode === 'visual' || value.visualRecovery) ? (
        <Suspense fallback={<p role="status">正在打开可视编辑器…</p>}>
          <VisualEditor
            client={client}
            projectId={project.projectId}
            path={path}
            content={value.content}
            recovery={value.visualRecovery}
            getRecovery={() => document.get().visualRecovery}
            onCheckpoint={(visualRecovery) => {
              if (document.get().conversionOwner === viewId)
                document.update({ visualRecovery }, true);
            }}
            onRecover={(checkpoint, content) => {
              if (document.get().visualRecovery === checkpoint) {
                document.update(
                  { content, visualRecovery: undefined, conversionOwner: undefined },
                  true,
                );
                dirtyCallback.current?.();
              }
              return document.get().content;
            }}
            readOnly={readOnly}
            onPending={pending}
            registerFlush={registerFlush}
            onSave={save}
            onChange={(content) => {
              if (document.get().conversionOwner !== viewId) return;
              document.update({ content, visualRecovery: undefined }, true);
              dirtyCallback.current?.();
            }}
            onError={(error) => document.update({ error })}
            onSelection={setSourceSelection}
          />
        </Suspense>
      ) : (
        <>
          <SourceEditor
            documentId={document.identity}
            viewId={viewId}
            path={path}
            content={value.content}
            readOnly={readOnly}
            autoFocus={resourceTarget.openMode !== 'preview'}
            onSave={save}
            onSelection={(selection) =>
              setSourceSelection(
                selection && 'quote' in selection ? { kind: 'text', ...selection } : selection,
              )
            }
            onChange={(content) => {
              if (readOnly) return;
              document.update({ content }, true);
              dirtyCallback.current?.();
            }}
          />
          <details>
            <summary>查看差异</summary>
            <ContentDiff before={value.source?.content ?? ''} after={value.content} />
          </details>
        </>
      )}
      {projectWritable && !accessRevoked
        ? edits.map((edit) => (
            <MaterialChangeView
              key={edit.id}
              edit={edit}
              onUndo={() => {
                if (!project) return;
                void client
                  .call('files.undo', { projectId: project.projectId, editId: edit.id })
                  .then(
                    () => reload(true),
                    (error) => document.update({ error: String(error) }),
                  );
              }}
            />
          ))
        : null}
      {records ? (
        <details>
          <summary>共同阅读记录</summary>
          <ReadingRecordsPanel
            adapter={records}
            enabled={enabled}
            materialAvailable={
              !!descriptorMatches && !!descriptor?.capabilities.read && !accessRevoked
            }
          />
        </details>
      ) : null}
    </section>
  );
}
