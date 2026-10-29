import type { KernelClient } from '@scholoom/client';
import { type ContextItem, isContextItems, type ResourceDescriptor } from '@scholoom/protocol';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArtifactAnnotation } from './ArtifactAnnotation';
import { type ContentSelection, domTextSelection } from './content-selection';
import { useContextContribution } from './context-contributions';
import { renderedHtml } from './editor/render-output';
import { sameResourceRef, type WorkbenchResourcePort } from './resource-controller';

type Display = { resource: ResourceDescriptor; html: string; release(): void };

/** Static content stays in its frame; only the trusted host reads its selection. */
export function HtmlRenderView({
  client,
  resource,
  port,
  enabled,
  dirty = false,
  viewId: suppliedViewId,
}: {
  client: KernelClient;
  resource: ResourceDescriptor;
  port: WorkbenchResourcePort;
  enabled: boolean;
  dirty?: boolean;
  viewId?: string | undefined;
}) {
  const instanceId = useId();
  const viewId = suppliedViewId ?? instanceId;
  const context = useContextContribution();
  const [display, setDisplay] = useState<Display>();
  const shown = useRef<Display | undefined>(undefined);
  const [pending, setPending] = useState<Display>();
  const candidate = useRef<Display | undefined>(undefined);
  const guards = useRef({ dirty, items: context.items });
  guards.current = { dirty, items: context.items };
  const [selection, setSelection] = useState<ContentSelection | null>(null);
  const [error, setError] = useState('');
  const disposeFrame = useRef<() => void>(() => {});
  const replace = useCallback((next: Display | undefined) => {
    if (candidate.current && candidate.current !== next) candidate.current.release();
    candidate.current = undefined;
    setPending(undefined);
    disposeFrame.current();
    shown.current?.release();
    shown.current = next;
    setSelection(null);
    setDisplay(next);
  }, []);
  useEffect(
    () => () => {
      disposeFrame.current();
      shown.current?.release();
      candidate.current?.release();
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) {
      replace(undefined);
      return;
    }
    setError('');
    void (async () => {
      const ref = resource.ref;
      if (ref.source !== 'render' || resource.format !== 'html' || !resource.render)
        throw new Error('HTML 排版产物缺少可核对的依据。');
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let offset = 0;
      for (;;) {
        controller.signal.throwIfAborted();
        const part = await port.read({
          ref,
          basis: resource.basis,
          encoding: 'base64',
          offset,
          limit: 262144,
        });
        if (part.size > 67108864) throw new Error('排版产物超过读取容量。');
        chunks.push(Uint8Array.from(atob(part.data), (char) => char.charCodeAt(0)));
        if (part.nextOffset === undefined) break;
        if (part.nextOffset <= offset) throw new Error('产物读取位置未推进。');
        offset = part.nextOffset;
      }
      const result = await renderedHtml(
        client,
        ref.projectId,
        ref.outputId,
        new Blob(chunks),
        controller.signal,
      );
      try {
        controller.signal.throwIfAborted();
        const fresh = await port.describe(ref);
        if (
          fresh.basis !== resource.basis ||
          !sameResourceRef(fresh.ref, ref) ||
          !fresh.capabilities.read
        )
          throw new Error('产物版本或权限已变化。');
        controller.signal.throwIfAborted();
        const next = { resource, ...result };
        const current = shown.current;
        const blocked =
          current &&
          (guards.current.dirty ||
            guards.current.items.some(
              (item) =>
                sameResourceRef(item.ref, current.resource.ref) &&
                item.basis === current.resource.basis,
            ));
        if (blocked) {
          candidate.current?.release();
          candidate.current = next;
          setPending(next);
        } else replace(next);
      } catch (failure) {
        result.release();
        throw failure;
      }
    })().catch((failure) => {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'HTML 预览读取失败。');
    });
    return () => controller.abort();
  }, [client, port, resource, enabled, replace]);
  useEffect(() => {
    if (!pending || dirty || !display) return;
    if (
      !context.items.some(
        (item) =>
          sameResourceRef(item.ref, display.resource.ref) && item.basis === display.resource.basis,
      )
    )
      replace(pending);
  }, [pending, dirty, display, context.items, replace]);
  useEffect(() => {
    if (!enabled || !display) return;
    let active = true;
    let checking = false;
    let queued = false;
    const check = async () => {
      if (checking) {
        queued = true;
        return;
      }
      checking = true;
      do {
        queued = false;
        try {
          const fresh = await port.describe(display.resource.ref);
          if (fresh.basis !== display.resource.basis || !fresh.capabilities.read)
            throw new Error('排版产物版本或权限已变化，请重新打开。');
        } catch (failure) {
          if (active && shown.current === display) {
            replace(undefined);
            setError(failure instanceof Error ? failure.message : '排版产物不可用。');
          }
        }
      } while (active && queued);
      checking = false;
    };
    const unsubscribe = port.subscribe(() => void check());
    void check();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [display, enabled, port, replace]);
  const item = useMemo<ContextItem | undefined>(
    () =>
      enabled && display && selection && 'kind' in selection && selection.kind === 'text'
        ? {
            ...selection,
            kind: 'text',
            contentState: 'saved',
            itemId: crypto.randomUUID(),
            ref: display.resource.ref,
            basis: display.resource.basis,
          }
        : undefined,
    [display, enabled, selection],
  );
  const valid = item && isContextItems([item]);
  const contribute = context.contributeSelection;
  useEffect(() => {
    contribute(viewId, valid ? { selections: [item] } : undefined);
    return () => contribute(viewId);
  }, [contribute, viewId, item, valid]);
  return (
    <section className="render-pane" aria-label="HTML 产物阅读">
      {context.available ? (
        <div className="file-toolbar">
          <button
            type="button"
            className="btn"
            disabled={!valid}
            onClick={() => {
              if (valid) context.appendContextItems([{ ...item, itemId: crypto.randomUUID() }]);
            }}
          >
            附加选区
          </button>
          <ArtifactAnnotation item={valid ? item : undefined} />
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {pending ? (
        <p role="status">
          新版排版已就绪，当前预览和批注已保留。{' '}
          <button type="button" className="btn" onClick={() => replace(pending)}>
            查看新版
          </button>
        </p>
      ) : display && !sameResourceRef(display.resource.ref, resource.ref) ? (
        <p role="status">正在读取新版，保留当前预览。</p>
      ) : null}
      {selection && 'error' in selection ? (
        <p role="alert">
          {selection.error === 'partialFormula'
            ? '请重新选择完整公式。'
            : '选区超出附加容量，请缩小选择。'}
        </p>
      ) : null}
      {enabled && display ? (
        <iframe
          title="HTML 排版预览"
          className="render-html"
          sandbox="allow-same-origin"
          srcDoc={display.html}
          onLoad={(event) => {
            disposeFrame.current();
            setSelection(null);
            const document = event.currentTarget.contentDocument;
            if (!document?.body || document.URL !== 'about:srcdoc') {
              replace(undefined);
              setError('预览已离开原产物，选择已停用，请重新打开。');
              return;
            }
            const navigate = (event: Event) => {
              const target = event.target as Node | null;
              const element = target?.nodeType === 1 ? (target as Element) : target?.parentElement;
              const link = element?.closest('a, area');
              if (!link) return;
              event.preventDefault();
              const href =
                link.getAttribute('href') ??
                link.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
              if (!href) return;
              if (href.startsWith('#')) {
                try {
                  document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
                } catch {}
              } else if (/^(https?:|mailto:)/i.test(href)) {
                if (window.scholoomDesktop)
                  void window.scholoomDesktop
                    .openExternal(href)
                    .catch(() => setError('外部链接无法打开。'));
                else window.open(href, '_blank', 'noopener,noreferrer');
              }
            };
            const capture = () =>
              setSelection(domTextSelection(document.body, document.getSelection()));
            const clear = () => {
              if (document.getSelection()?.isCollapsed) setSelection(null);
            };
            document.addEventListener('pointerup', capture);
            document.addEventListener('keyup', capture);
            document.addEventListener('selectionchange', clear);
            document.addEventListener('click', navigate, true);
            document.addEventListener('auxclick', navigate, true);
            disposeFrame.current = () => {
              document.removeEventListener('pointerup', capture);
              document.removeEventListener('keyup', capture);
              document.removeEventListener('selectionchange', clear);
              document.removeEventListener('click', navigate, true);
              document.removeEventListener('auxclick', navigate, true);
            };
          }}
        />
      ) : !error ? (
        <p role="status">正在打开 HTML 产物…</p>
      ) : null}
    </section>
  );
}
