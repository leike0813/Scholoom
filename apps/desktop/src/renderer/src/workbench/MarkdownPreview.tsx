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

function PreviewAnchor({ href, children, ...rest }: ComponentPropsWithoutRef<'a'>) {
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

function PreviewImage({ src, alt, ...rest }: ComponentPropsWithoutRef<'img'>) {
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
        <span className="markdown-image-note">
          {target?.kind === 'remote' ? '远端图片未加载' : '图片未加载：仅支持项目内相对路径'}
          {alt ? ` · ${alt}` : ''}
        </span>
      </span>
    );
  return (
    <span className="markdown-image" ref={host}>
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

const components = { a: PreviewAnchor, img: PreviewImage };

interface PreviewState {
  tree: PreviewNode | undefined;
  error: string | undefined;
  busy: boolean;
}

export interface MarkdownPreviewProps {
  content: string;
  documentKey: string;
  basePath: string;
  resourceRevision: number;
  readResource: (path: string) => Promise<{ mimeType: string; data: string }>;
  openFile: (path: string) => void;
  openExternal: (url: string) => void;
}

export function MarkdownPreview({
  content,
  documentKey,
  basePath,
  resourceRevision,
  readResource,
  openFile,
  openExternal,
}: MarkdownPreviewProps) {
  const [preview, setPreview] = useState<PreviewState>({
    tree: undefined,
    error: undefined,
    busy: true,
  });
  const host = useRef<HTMLDivElement>(null);
  const queue = useRef<MarkdownQueueHandle | null>(null);
  const requestedKey = useRef(documentKey);
  // 回调经 ref 转发，父组件传内联箭头函数也不会让资源状态和已加载图片反复重建。
  const handlers = useRef({ readResource, openFile, openExternal });
  useEffect(() => {
    handlers.current = { readResource, openFile, openExternal };
  });

  // 文档或资源修订变化即换一份资源状态，旧缓存与 blob URL 随旧实例释放。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 资源修订变化时重建资源状态。
  const resources = useMemo(
    () => createResources((path) => handlers.current.readResource(path)),
    [documentKey, resourceRevision],
  );
  useEffect(() => {
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
          ? { tree: result.tree, error: undefined, busy: false }
          : { tree: current.tree, error: result.error, busy: false },
      );
    });
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
            })
          : null,
        error: undefined,
      };
    } catch (error) {
      return { body: null, error: error instanceof Error ? error.message : '预览转换失败' };
    }
  }, [preview.tree]);

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
      <div className="markdown-preview-body" ref={host}>
        <PreviewContext.Provider value={value}>{rendered.body}</PreviewContext.Provider>
      </div>
    </section>
  );
}
