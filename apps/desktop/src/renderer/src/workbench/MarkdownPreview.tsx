import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import 'katex/dist/katex.min.css';
import {
  type ComponentPropsWithoutRef,
  createContext,
  Fragment,
  type MouseEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { boundedSelection, type ContentSelection, selectionText } from './content-selection';
import { assetTarget, linkTarget } from './markdown-paths';
import { acquireMarkdownQueue, type MarkdownQueueHandle } from './markdown-queue';
import type { PreviewNode } from './markdown-render';

const MAX_CONCURRENT_READS = 4;
const MAX_CACHED_RESOURCES = 8;

const bytes = (base64: string) =>
  Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));

interface ResourceLease {
  url: string;
  release: () => void;
}

interface PreviewResources {
  resume(): void;
  acquire(path: string): Promise<ResourceLease>;
  dispose(): void;
}

/** 每份文档一份：限制并发、缓存少量已读资源，离开可见区即释放 blob URL。 */
function createResources(
  readResource: (path: string) => Promise<{ mimeType: string; data: string }>,
): PreviewResources {
  const cache = new Map<string, { mimeType: string; data: string }>();
  const queue: Array<() => void> = [];
  let active = 0;
  let disposed = false;
  const pump = () => {
    while (!disposed && active < MAX_CONCURRENT_READS && queue.length) {
      active += 1;
      queue.shift()?.();
    }
  };
  return {
    resume() {
      disposed = false;
      pump();
    },
    acquire(path) {
      return new Promise<ResourceLease>((resolve, reject) => {
        queue.push(() => {
          const cached = cache.get(path);
          const read = cached ? Promise.resolve(cached) : readResource(path);
          read
            .then((resource) => {
              if (disposed) {
                reject(new Error('预览已关闭'));
                return;
              }
              if (!cached) {
                cache.set(path, resource);
                const oldest = cache.keys().next();
                if (cache.size > MAX_CACHED_RESOURCES && !oldest.done) cache.delete(oldest.value);
              }
              const url = URL.createObjectURL(
                new Blob([bytes(resource.data)], { type: resource.mimeType }),
              );
              resolve({ url, release: () => URL.revokeObjectURL(url) });
            }, reject)
            .finally(() => {
              active -= 1;
              pump();
            });
        });
        pump();
      });
    },
    dispose() {
      disposed = true;
      // 排队中的读取直接丢弃：请求方已卸载，未决 Promise 不再持有资源。
      queue.length = 0;
    },
  };
}

interface PreviewValue {
  basePath: string;
  resources: PreviewResources;
  openFile: (path: string) => void;
  openExternal: (url: string) => void;
  focusAnchor: (id: string) => void;
}

const PreviewContext = createContext<PreviewValue | null>(null);
const ObjectSelectionContext = createContext<((node: PreviewNode) => void) | null>(null);

function* selectedPreviewText(node: Node, range: Range): Generator<string> {
  let separator = '';
  let started = false;
  function* visit(current: Node): Generator<string> {
    if (!range.intersectsNode(current)) return;
    const element = current instanceof Element ? current : undefined;
    if (element?.matches('button, .markdown-image')) return;
    if (element?.tagName === 'BR') {
      separator += '\n';
      return;
    }
    if (element?.tagName === 'TR') {
      let first = true;
      for (const cell of element.children) {
        if (!cell.matches('td, th') || !range.intersectsNode(cell)) continue;
        if (started && separator) yield separator;
        separator = '';
        if (!first) yield '\t';
        started = true;
        yield* visit(cell);
        first = false;
      }
      if (!first) separator = '\n';
      return;
    }
    const block = element?.matches(
      'p, h1, h2, h3, h4, h5, h6, pre, blockquote, li, dt, dd, div, section, table, thead, tbody, tfoot, tr, caption',
    );
    if (block) separator ||= '\n';
    const text = element?.classList.contains('katex')
      ? (element.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? '')
      : current.nodeType === Node.TEXT_NODE
        ? (current.textContent ?? '').slice(
            current === range.startContainer ? range.startOffset : 0,
            current === range.endContainer ? range.endOffset : undefined,
          )
        : undefined;
    if (text !== undefined) {
      if (text) {
        if (started && separator) yield separator;
        yield text;
        started = true;
        separator = '';
      }
    } else {
      for (const child of current.childNodes) yield* visit(child);
    }
    if (block) separator = '\n';
  }
  yield* visit(node);
}

function texAnnotation(node: PreviewNode): PreviewNode | undefined {
  if (node.tagName === 'annotation' && node.properties?.encoding === 'application/x-tex')
    return node;
  for (const child of node.children ?? []) {
    const annotation = texAnnotation(child);
    if (annotation) return annotation;
  }
  return undefined;
}

function* previewObjectText(node: PreviewNode): Generator<string> {
  if (node.type === 'text') yield node.value ?? '';
  else if (
    Array.isArray(node.properties?.className) &&
    node.properties.className.includes('katex')
  ) {
    const annotation = texAnnotation(node);
    if (annotation) yield* previewObjectText(annotation);
  } else if (node.tagName === 'img') {
    yield `图片\n${node.properties?.src ?? ''}\n${node.properties?.title ?? ''}\n${node.properties?.alt ?? ''}`;
  } else {
    for (const child of node.children ?? []) yield* previewObjectText(child);
    if (node.tagName === 'td' || node.tagName === 'th') yield '\t';
    if (node.tagName === 'tr' || node.tagName === 'caption') yield '\n';
  }
}

function ObjectSelectionButton({ node }: { node: PreviewNode | undefined }) {
  const select = useContext(ObjectSelectionContext);
  if (!select || !node) return null;
  return (
    <button
      className="btn"
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        select(node);
      }}
    >
      {node.tagName === 'table' ? '选择表格' : '选择图片'}
    </button>
  );
}

function PreviewTable({
  node,
  children,
  ...rest
}: ComponentPropsWithoutRef<'table'> & { node?: PreviewNode }) {
  return (
    <div>
      <ObjectSelectionButton node={node} />
      <table {...rest}>{children}</table>
    </div>
  );
}

function PreviewAnchor({
  href,
  children,
  node: _node,
  ...rest
}: ComponentPropsWithoutRef<'a'> & { node?: PreviewNode }) {
  const preview = useContext(PreviewContext);
  const target =
    preview && typeof href === 'string' ? linkTarget(preview.basePath, href) : undefined;
  if (!preview || !target) return <span className="markdown-link-blocked">{children}</span>;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (target.kind === 'external') preview.openExternal(target.url);
    else if (target.kind === 'file') preview.openFile(target.path);
    else preview.focusAnchor(target.id);
  };
  return (
    <a
      {...rest}
      className={
        target.kind === 'external' ? 'markdown-link markdown-link-external' : 'markdown-link'
      }
      href={href}
      onClick={follow}
    >
      {children}
    </a>
  );
}

function PreviewImage({
  src,
  alt,
  node,
  ...rest
}: ComponentPropsWithoutRef<'img'> & { node?: PreviewNode }) {
  const preview = useContext(PreviewContext);
  const host = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState<{
    path: string;
    url: string;
    resources: PreviewResources;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const target =
    preview && typeof src === 'string' ? assetTarget(preview.basePath, src) : undefined;
  const path = target?.kind === 'local' ? target.path : undefined;

  useEffect(() => {
    const element = host.current;
    if (!preview || !path || !element) return;
    let lease: ResourceLease | undefined;
    let cancelled = false;
    let visible = false;
    let pending = false;
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) {
          lease?.release();
          lease = undefined;
          setLoaded((current) => (current?.path === path ? null : current));
          return;
        }
        if (lease || cancelled || pending) return;
        pending = true;
        preview.resources.acquire(path).then(
          (value) => {
            pending = false;
            if (cancelled || !visible) {
              value.release();
              return;
            }
            lease = value;
            setFailed(false);
            setLoaded({ path, url: value.url, resources: preview.resources });
          },
          () => {
            pending = false;
            if (!cancelled) setFailed(true);
          },
        );
      },
      { rootMargin: '240px' },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      lease?.release();
    };
  }, [preview, path]);

  const url =
    loaded && loaded.path === path && loaded.resources === preview?.resources
      ? loaded.url
      : undefined;
  if (!preview || !path)
    return (
      <span className="markdown-image" ref={host}>
        <ObjectSelectionButton node={node} />
        <span className="markdown-image-note">
          {target?.kind === 'remote' ? '远端图片未加载' : '图片未加载：仅支持项目内相对路径'}
          {alt ? ` · ${alt}` : ''}
        </span>
      </span>
    );
  return (
    <span className="markdown-image" ref={host}>
      <ObjectSelectionButton node={node} />
      {url ? (
        <img {...rest} alt={alt ?? ''} src={url} />
      ) : (
        <span className="markdown-image-note">
          {alt ?? '图片'} · {failed ? '图片不可用' : '图片加载中'}
        </span>
      )}
    </span>
  );
}

const components = { a: PreviewAnchor, img: PreviewImage, table: PreviewTable };

interface PreviewState {
  tree: PreviewNode | undefined;
  error: string | undefined;
  busy: boolean;
  source?: { content: string; documentKey: string };
}

export interface MarkdownPreviewProps {
  content: string;
  documentKey: string;
  basePath: string;
  resourceRevision: number;
  readResource: (path: string) => Promise<{ mimeType: string; data: string }>;
  openFile: (path: string) => void;
  openExternal: (url: string) => void;
  onSelection?: ((selection: ContentSelection | null) => void) | undefined;
}

export function MarkdownPreview({
  content,
  documentKey,
  basePath,
  resourceRevision,
  readResource,
  openFile,
  openExternal,
  onSelection,
}: MarkdownPreviewProps) {
  const [preview, setPreview] = useState<PreviewState>({
    tree: undefined,
    error: undefined,
    busy: true,
  });
  const host = useRef<HTMLDivElement>(null);
  const textRange = useRef<Range | null>(null);
  const queue = useRef<MarkdownQueueHandle | null>(null);
  const requestedKey = useRef(documentKey);
  // 回调经 ref 转发，父组件传内联箭头函数也不会让资源状态和已加载图片反复重建。
  const handlers = useRef({ readResource, openFile, openExternal, onSelection });
  useEffect(() => {
    handlers.current = { readResource, openFile, openExternal, onSelection };
  });

  useEffect(() => {
    const document = host.current?.ownerDocument;
    if (!document) return;
    const clearInvalidText = () => {
      const previous = textRange.current;
      if (!previous) return;
      const selection = document.getSelection();
      const element = host.current;
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (
        !selection ||
        selection.isCollapsed ||
        !range ||
        !element ||
        !element.contains(selection.anchorNode) ||
        !element.contains(selection.focusNode) ||
        range.compareBoundaryPoints(Range.START_TO_START, previous) !== 0 ||
        range.compareBoundaryPoints(Range.END_TO_END, previous) !== 0
      ) {
        textRange.current = null;
        handlers.current.onSelection?.(null);
      }
    };
    document.addEventListener('selectionchange', clearInvalidText);
    return () => document.removeEventListener('selectionchange', clearInvalidText);
  }, []);

  // 文档或资源修订变化即换一份资源状态，旧缓存与 blob URL 随旧实例释放。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 资源修订变化时重建资源状态。
  const resources = useMemo(
    () => createResources((path) => handlers.current.readResource(path)),
    [documentKey, resourceRevision],
  );
  useEffect(() => {
    textRange.current = null;
    handlers.current.onSelection?.(null);
    resources.resume();
    return () => resources.dispose();
  }, [resources]);

  // 与消息正文共用一次 Worker 引用：挂载时取得，卸载时释放。
  useEffect(() => {
    const handle = acquireMarkdownQueue();
    queue.current = handle;
    return () => {
      queue.current = null;
      handle.release();
    };
  }, []);

  useEffect(() => {
    // 切换文档时不留上一份文档的结果；同一文档内保留上一次成功预览。
    const switching = requestedKey.current !== documentKey;
    requestedKey.current = documentKey;
    setPreview((current) => ({
      tree: switching ? undefined : current.tree,
      error: undefined,
      busy: true,
    }));
    const handle = queue.current;
    if (!handle) {
      setPreview({ tree: undefined, error: '预览进程未就绪', busy: false });
      return;
    }
    // 连续编辑只保留最后一版，旧文档或旧正文的结果由共享调度丢弃。
    handle.request(content, (result) => {
      setPreview((current) =>
        'tree' in result
          ? { tree: result.tree, source: { content, documentKey }, error: undefined, busy: false }
          : { ...current, error: result.error, busy: false },
      );
    });
    return () => {
      handle.clear();
      textRange.current = null;
      handlers.current.onSelection?.(null);
    };
  }, [content, documentKey]);

  const value = useMemo<PreviewValue>(
    () => ({
      basePath,
      resources,
      openFile: (path) => handlers.current.openFile(path),
      openExternal: (url) => handlers.current.openExternal(url),
      focusAnchor: (id) => {
        const headings = host.current?.querySelectorAll<HTMLElement>('[id]') ?? [];
        for (const heading of headings) {
          if (heading.id === id) {
            heading.scrollIntoView({ block: 'start' });
            return;
          }
        }
      },
    }),
    [basePath, resources],
  );

  const rendered = useMemo(() => {
    try {
      return {
        body: preview.tree
          ? toJsxRuntime(preview.tree as unknown as Parameters<typeof toJsxRuntime>[0], {
              Fragment,
              jsx,
              jsxs,
              components,
              passNode: true,
            })
          : null,
        error: undefined,
      };
    } catch (error) {
      return { body: null, error: error instanceof Error ? error.message : '预览转换失败' };
    }
  }, [preview.tree]);

  // Object identities belong only to this rendered tree, never to a future revision.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 每棵实际展示树使用独立身份。
  const objects = useMemo(
    () => ({ prefix: crypto.randomUUID(), ids: new WeakMap<PreviewNode, string>(), count: 0 }),
    [preview.tree],
  );
  const selectable =
    !preview.busy &&
    !preview.error &&
    !rendered.error &&
    preview.source?.content === content &&
    preview.source.documentKey === documentKey;
  const selectObject = (node: PreviewNode) => {
    if (!selectable) return;
    textRange.current = null;
    const semantics = selectionText(previewObjectText(node));
    let objectId = objects.ids.get(node);
    if (!objectId) {
      objectId = `${objects.prefix}:${++objects.count}`;
      objects.ids.set(node, objectId);
    }
    const properties = node.properties;
    const name = node.tagName === 'table' ? '表格' : properties?.title || properties?.alt || '图片';
    handlers.current.onSelection?.(
      semantics === null
        ? { error: 'tooLarge' }
        : boundedSelection({
            kind: 'object',
            providerId: 'markdown',
            objectId,
            name: String(name),
            semantics,
          }),
    );
  };
  const captureText = (target: EventTarget) => {
    if (target instanceof Element && target.closest('button')) return;
    if (!onSelection) return;
    textRange.current = null;
    const selection = window.getSelection();
    const element = host.current;
    if (
      !selectable ||
      !element ||
      !selection ||
      selection.isCollapsed ||
      !element.contains(selection.anchorNode) ||
      !element.contains(selection.focusNode)
    ) {
      onSelection(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const root = range.commonAncestorContainer;
    if (root.parentElement?.closest('button, .markdown-image')) {
      onSelection(null);
      return;
    }
    // A partially intersected formula contains at least one selection endpoint.
    for (const boundary of [range.startContainer, range.endContainer]) {
      const formula = (boundary instanceof Element ? boundary : boundary.parentElement)?.closest(
        '.katex',
      );
      if (!formula || !element.contains(formula)) continue;
      const contents = formula.ownerDocument.createRange();
      contents.selectNodeContents(formula);
      if (
        range.compareBoundaryPoints(Range.START_TO_START, contents) > 0 ||
        range.compareBoundaryPoints(Range.END_TO_END, contents) < 0
      ) {
        textRange.current = range.cloneRange();
        onSelection({ error: 'partialFormula' });
        return;
      }
    }
    const formula = (root instanceof Element ? root : root.parentElement)?.closest('.katex');
    const quote = selectionText(
      selectedPreviewText(formula && element.contains(formula) ? formula : root, range),
    );
    if (quote !== '') textRange.current = range.cloneRange();
    onSelection(quote === null ? { error: 'tooLarge' } : quote ? { kind: 'text', quote } : null);
  };

  const status = preview.busy
    ? preview.tree
      ? '正在更新预览…（以下为上一次结果）'
      : '正在更新预览…'
    : preview.error || rendered.error
      ? preview.tree
        ? `预览失败：${preview.error ?? rendered.error}（保留文档草稿）`
        : `预览失败：${preview.error ?? rendered.error}`
      : '预览已更新';

  return (
    <section className="markdown-preview" aria-label="Markdown 预览">
      <p className="preview-status" role="status">
        {status}
      </p>
      <div
        className="markdown-preview-body"
        ref={host}
        onPointerUpCapture={(event) => captureText(event.target)}
        onKeyUpCapture={(event) => captureText(event.target)}
      >
        <PreviewContext.Provider value={value}>
          <ObjectSelectionContext.Provider value={onSelection && selectable ? selectObject : null}>
            {rendered.body}
          </ObjectSelectionContext.Provider>
        </PreviewContext.Provider>
      </div>
    </section>
  );
}
