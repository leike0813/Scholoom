import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import 'katex/dist/katex.min.css';
import {
  type ComponentPropsWithoutRef,
  createContext,
  Fragment,
  isValidElement,
  type ReactNode,
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

interface MessageValue {
  openFile: ((path: string) => void) | undefined;
  openExternal: ((url: string) => void) | undefined;
  focusAnchor: (id: string) => void;
}

const MessageContext = createContext<MessageValue | null>(null);

/** 相对链接与项目根对齐；外链只在点击后交给宿主打开，其余协议不处理。 */
function MessageLink({ href, children, ...rest }: ComponentPropsWithoutRef<'a'>) {
  const message = useContext(MessageContext);
  const target = typeof href === 'string' ? linkTarget('', href) : undefined;
  let follow: (() => void) | undefined;
  if (message && target?.kind === 'external' && message.openExternal) {
    const open = message.openExternal;
    follow = () => open(target.url);
  } else if (message && target?.kind === 'file' && message.openFile) {
    const open = message.openFile;
    follow = () => open(target.path);
  } else if (message && target?.kind === 'anchor') {
    const focus = message.focusAnchor;
    follow = () => focus(target.id);
  }
  if (!follow) return <span className="markdown-link-blocked">{children}</span>;
  return (
    <a
      {...rest}
      className={
        target?.kind === 'external' ? 'markdown-link markdown-link-external' : 'markdown-link'
      }
      href={href}
      onClick={(event) => {
        event.preventDefault();
        follow();
      }}
    >
      {children}
    </a>
  );
}

/** 消息图片只留替代说明，任何来源都不发起请求。 */
function MessageImage({ src, alt }: ComponentPropsWithoutRef<'img'>) {
  const target = typeof src === 'string' ? assetTarget('', src) : undefined;
  return (
    <span className="markdown-image">
      <span className="markdown-image-note">
        {target?.kind === 'remote' ? '远端图片未加载' : '图片未加载：仅支持项目内相对路径'}
        {alt ? ` · ${alt}` : ''}
      </span>
    </span>
  );
}

/** 取出 React 节点里的纯文本：代码复制与图片说明都用渲染后的原始文本。 */
function plainText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return '';
}

function MessageCode({ children, ...rest }: ComponentPropsWithoutRef<'pre'>) {
  const text = plainText(children);
  // 记下复制时的正文：正文随流式输出变化后，反馈自动回到初始态。
  const [copied, setCopied] = useState<{ text: string; ok: boolean } | null>(null);
  const label = copied?.text === text ? (copied.ok ? '已复制' : '复制失败') : '复制代码';
  return (
    <div className="markdown-code">
      <button
        type="button"
        className="markdown-copy"
        onClick={() => {
          const pending = navigator.clipboard?.writeText(text);
          if (!pending) {
            setCopied({ text, ok: false });
            return;
          }
          void pending.then(
            () => setCopied({ text, ok: true }),
            () => setCopied({ text, ok: false }),
          );
        }}
      >
        {label}
      </button>
      <pre {...rest}>{children}</pre>
    </div>
  );
}

const components = { a: MessageLink, img: MessageImage, pre: MessageCode };

export interface MarkdownTextProps {
  content: string;
  documentKey: string;
  openFile?: (path: string) => void;
  openExternal?: (url: string) => void;
}

export function MarkdownText({ content, documentKey, openFile, openExternal }: MarkdownTextProps) {
  const host = useRef<HTMLDivElement>(null);
  const queue = useRef<MarkdownQueueHandle | null>(null);
  const requestedKey = useRef(documentKey);
  /** 已渲染正文离开可见区后的占位高度；未渲染过的消息用原文占位。 */
  const placeholder = useRef(0);
  const rendered = useRef(false);
  const [visible, setVisible] = useState(false);
  const [tree, setTree] = useState<PreviewNode | undefined>(undefined);

  // 共享调度：所有消息共用一个 Worker，最后一个引用释放即终止。
  useEffect(() => {
    const handle = acquireMarkdownQueue();
    queue.current = handle;
    return () => {
      queue.current = null;
      handle.release();
    };
  }, []);

  // 只解析可见正文；离开可见区记录当前高度，占位保持滚动位置与可观察尺寸。
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      const intersecting = entries.some((entry) => entry.isIntersecting);
      if (intersecting) {
        setVisible(true);
        return;
      }
      if (rendered.current) placeholder.current = element.offsetHeight;
      setVisible(intersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const switching = requestedKey.current !== documentKey;
    requestedKey.current = documentKey;
    if (switching) {
      // 切换正文：不留旧树、旧占位与旧测量高度。
      rendered.current = false;
      placeholder.current = 0;
      setTree(undefined);
    }
    const handle = queue.current;
    if (!visible) {
      handle?.clear();
      // 释放展示树：离开可见区只留测量高度。
      setTree((current) => (current ? undefined : current));
      return;
    }
    if (!handle) return;
    handle.request(content, (result) => {
      if ('tree' in result) rendered.current = true;
      setTree('tree' in result ? result.tree : undefined);
    });
  }, [content, documentKey, visible]);

  const body = useMemo(() => {
    if (!tree) return null;
    try {
      return toJsxRuntime(tree as unknown as Parameters<typeof toJsxRuntime>[0], {
        Fragment,
        jsx,
        jsxs,
        components,
      });
    } catch {
      // 展示树转换失败退回原始正文，消息保持可读。
      return null;
    }
  }, [tree]);

  const value = useMemo<MessageValue>(
    () => ({
      openFile,
      openExternal,
      focusAnchor: (id) => {
        // 锚点只在本条消息内查找，不跨消息跳转。
        const headings = host.current?.querySelectorAll<HTMLElement>('[id]') ?? [];
        for (const heading of headings) {
          if (heading.id === id) {
            heading.scrollIntoView({ block: 'start' });
            return;
          }
        }
      },
    }),
    [openFile, openExternal],
  );

  return (
    <div
      className="markdown-message"
      ref={host}
      style={visible ? undefined : { minHeight: placeholder.current }}
    >
      {visible && body ? (
        <div className="markdown-message-body">
          <MessageContext.Provider value={value}>{body}</MessageContext.Provider>
        </div>
      ) : null}
      {!body && (visible || !rendered.current) ? (
        <div className="markdown-message-plain">{content}</div>
      ) : null}
    </div>
  );
}
