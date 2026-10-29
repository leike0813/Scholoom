import assets from 'virtual:scholoom-pdf-assets';
import { PdfAnnotationSubtype, restoreRect, rotateRect, transformSize } from '@embedpdf/models';
import {
  type AnnotationPlugin,
  type DocumentManagerPlugin,
  LockModeType,
  PDFViewer,
  type PDFViewerConfig,
  type PluginRegistry,
  type ScrollPlugin,
  type SelectionPlugin,
  ZoomMode,
} from '@embedpdf/react-pdf-viewer';
import { type ContextItem, isContextItems, type ReadingRecord } from '@scholoom/protocol';
import type { ResourceDescriptor } from '@scholoom/protocol/resources';
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArtifactAnnotation } from './ArtifactAnnotation';
import { useContextContribution } from './context-contributions';
import { prepareReadingRecord, ReadingRecordsPanel } from './ReadingRecordsPanel';
import {
  type ReadingRecordAdapter,
  sameResourceRef,
  type WorkbenchResourcePort,
} from './resource-controller';

const messageOf = (reason: unknown) =>
  reason instanceof Error ? reason.message : 'PDF读取未完成。';
type Selection = {
  pageIndex: number;
  quote: string;
  rects: { x: number; y: number; width: number; height: number }[];
};
const colors = {
  background: {
    app: 'var(--surface)',
    surface: 'var(--bg)',
    surfaceAlt: 'var(--surface)',
    elevated: 'var(--elevated)',
    input: 'var(--bg)',
  },
  foreground: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-tertiary)',
  },
  border: { default: 'var(--border)', subtle: 'var(--border)', strong: 'var(--border-strong)' },
  accent: {
    primary: 'var(--accent)',
    primaryHover: 'var(--accent)',
    primaryActive: 'var(--accent)',
    primaryLight: 'var(--surface-active)',
  },
  interactive: {
    hover: 'var(--surface-hover)',
    active: 'var(--surface-active)',
    selected: 'var(--surface-active)',
    focus: 'var(--accent)',
    focusRing: 'var(--accent)',
  },
};

function PdfViewport({
  config,
  onReady,
}: {
  config: PDFViewerConfig;
  onReady: (registry: PluginRegistry) => () => void;
}) {
  const release = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    return () => {
      release.current?.();
      release.current = undefined;
    };
  }, []);
  return (
    <PDFViewer
      config={config}
      onReady={(registry) => {
        release.current = onReady(registry);
      }}
    />
  );
}

export function RenderedPdf({ url }: { url: string }) {
  const config = useMemo<PDFViewerConfig>(
    () => ({
      src: url,
      wasmUrl: new URL(assets.wasmUrl, window.location.href).href,
      fontFallback: {
        defaultFont: new URL(assets.fontFallback.defaultFont, window.location.href).href,
        fonts: Object.fromEntries(
          Object.entries(assets.fontFallback.fonts).map(([charset, value]) => [
            charset,
            new URL(value, window.location.href).href,
          ]),
        ),
      },
      fonts: { ui: null, signature: null },
      stamp: { libraries: [], manifests: [], defaultLibrary: false },
      theme: { preference: 'system', light: colors, dark: colors },
      annotations: { autoCommit: false, locked: { type: LockModeType.All } },
      form: { withForms: false },
      render: { withForms: false },
      disabledCategories: [
        'annotation',
        'redaction',
        'stamp',
        'signature',
        'form',
        'document-open',
        'print',
        'export',
      ],
    }),
    [url],
  );
  return (
    <section className="pdf-viewer" aria-label="排版 PDF">
      <PDFViewer config={config} />
    </section>
  );
}

export type PreparedPdf = { url: string; release(): void };
export async function preparePdfResource(
  resource: ResourceDescriptor,
  port: WorkbenchResourcePort,
  signal: AbortSignal,
): Promise<PreparedPdf> {
  await port.document(resource, 'pdfInfo', {});
  const parts: BlobPart[] = [];
  let offset = 0;
  for (;;) {
    signal.throwIfAborted();
    const result = await port.read({
      ref: resource.ref,
      basis: resource.basis,
      encoding: 'base64',
      offset,
      limit: 262144,
    });
    signal.throwIfAborted();
    if (
      !sameResourceRef(result.ref, resource.ref) ||
      result.unit !== 'byte' ||
      result.offset !== offset ||
      result.basis !== resource.basis
    )
      throw new Error('材料依据或读取位置已变化。');
    const bytes = Uint8Array.from(atob(result.data), (char) => char.charCodeAt(0));
    if (result.size > 134217728 || offset + bytes.length > result.size)
      throw new Error('PDF超过128MiB读取上限。');
    parts.push(bytes);
    if (result.nextOffset === undefined) {
      if (offset + bytes.length !== result.size) throw new Error('PDF读取不完整。');
      break;
    }
    if (!bytes.length || result.nextOffset !== offset + bytes.length)
      throw new Error('材料读取位置未推进。');
    offset = result.nextOffset;
  }
  const fresh = await port.describe(resource.ref);
  signal.throwIfAborted();
  if (
    !sameResourceRef(fresh.ref, resource.ref) ||
    fresh.basis !== resource.basis ||
    !fresh.capabilities.read
  )
    throw new Error('材料版本或权限已变化。');

  const url = URL.createObjectURL(new Blob(parts, { type: 'application/pdf' }));
  return { url, release: () => URL.revokeObjectURL(url) };
}

export function PdfReader({
  resource,
  port,
  records: recordAdapter,
  enabled,
  prepared,
  onUnavailable,
  viewId: suppliedViewId,
  ariaLabel,
}: {
  resource: ResourceDescriptor;
  port: WorkbenchResourcePort;
  records?: ReadingRecordAdapter | undefined;
  enabled: boolean;
  /** Borrowed from the render pane; its owner releases the object URL. */
  prepared?: PreparedPdf | undefined;
  onUnavailable?: (() => void) | undefined;
  viewId?: string | undefined;
  ariaLabel?: string | undefined;
}) {
  const [tick, setTick] = useState(0);
  const unavailableCallback = useRef(onUnavailable);
  unavailableCallback.current = onUnavailable;
  const [grants, setGrants] = useState({ read: false });
  const [recordWrite, setRecordWrite] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [page, setPage] = useState(1);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [registry, setRegistry] = useState<PluginRegistry>();
  const [documentEpoch, setDocumentEpoch] = useState(0);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const projected = useRef<{ id: string; pageIndex: number }[]>([]);
  const resourceKey = JSON.stringify([resource.ref, resource.basis]);
  const [authorizedKey, setAuthorizedKey] = useState('');
  const active = enabled && grants.read && authorizedKey === resourceKey;
  const context = useContextContribution();
  const instanceId = useId();
  const viewId = suppliedViewId ?? instanceId;
  const contextItems = useMemo<ContextItem[]>(
    () =>
      active && url
        ? selections.map((selection) => ({
            kind: 'text',
            itemId: crypto.randomUUID(),
            ref: resource.ref,
            basis: resource.basis,
            quote: selection.quote,
            contentState: 'saved',
            location: { pageIndex: selection.pageIndex, rects: selection.rects },
          }))
        : [],
    [active, url, selections, resource],
  );
  const selectionValid = isContextItems(contextItems);
  const contribute = context.contributeSelection;
  useEffect(() => {
    contribute(
      viewId,
      selectionValid && contextItems.length ? { selections: contextItems } : undefined,
    );
    return () => contribute(viewId);
  }, [contribute, viewId, contextItems, selectionValid]);
  useEffect(() => {
    if (!active) setSelections([]);
  }, [active]);
  useEffect(
    () =>
      port.subscribe(() => {
        setTick((value) => value + 1);
      }),
    [port],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: resource notifications explicitly refresh describe authorization.
  useEffect(() => {
    let current = true;
    if (!enabled) {
      setGrants({ read: false });
      setAuthorizedKey('');
      return () => {
        current = false;
      };
    }
    void port
      .describe({ ...resource.ref })
      .then(
        (fresh) => {
          if (!current) return;
          if (!sameResourceRef(fresh.ref, resource.ref) || fresh.basis !== resource.basis)
            throw new Error('材料依据已变化，请重新打开资源。');
          if (fresh.ref.source === 'render' && !fresh.render)
            throw new Error('排版产物缺少生产依据，无法直接附加选区。');
          setUnavailable(!fresh.capabilities.read);
          setError(fresh.unavailableReason ?? '');
          setGrants({ read: fresh.capabilities.read });
          setAuthorizedKey(resourceKey);
          if (!fresh.capabilities.read) unavailableCallback.current?.();
        },
        (reason) => {
          if (current) {
            setGrants({ read: false });
            setAuthorizedKey('');
            setUnavailable(true);
            setError(messageOf(reason));
            unavailableCallback.current?.();
          }
        },
      )
      .catch((reason) => {
        if (current) {
          setGrants({ read: false });
          setAuthorizedKey('');
          setUnavailable(true);
          setError(messageOf(reason));
          unavailableCallback.current?.();
        }
      });
    return () => {
      current = false;
    };
  }, [port, enabled, resource, resourceKey, tick]);
  useEffect(() => {
    if (!recordAdapter || !enabled || !resource.capabilities.readingRecords) {
      setRecordWrite(false);
      return;
    }
    let live = true;
    const refresh = () => {
      setRecordWrite(false);
      void recordAdapter.status().then(
        (status) => {
          if (live) setRecordWrite(status.write);
        },
        () => {
          if (live) setRecordWrite(false);
        },
      );
    };
    refresh();
    const unsubscribe = recordAdapter.subscribe(refresh);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [recordAdapter, enabled, resource.capabilities.readingRecords]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let loaded: PreparedPdf | undefined;
    setError('');
    if (prepared) {
      setUrl(prepared.url);
      return () => setUrl('');
    }
    void preparePdfResource(resource, port, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          result.release();
          return;
        }
        loaded = result;
        setUrl(result.url);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(messageOf(reason));
          setUnavailable(true);
          unavailableCallback.current?.();
        }
      });
    return () => {
      controller.abort();
      loaded?.release();
      setUrl('');
    };
  }, [port, resource, active, prepared]);

  const ready = useCallback((value: PluginRegistry) => {
    const cleanups: (() => void)[] = [];
    let generation = 0;
    let live = true;
    setRegistry(value);
    const selection = value.getPlugin<SelectionPlugin>('selection')?.provides();
    const scroll = value.getPlugin<ScrollPlugin>('scroll')?.provides();
    const documents = value.getPlugin<DocumentManagerPlugin>('document-manager')?.provides();
    if (documents)
      cleanups.push(documents.onDocumentOpened(() => setDocumentEpoch((value) => value + 1)));
    if (scroll) cleanups.push(scroll.onPageChange((event) => setPage(event.pageNumber)));
    if (selection) {
      cleanups.push(
        selection.onSelectionChange(() => {
          generation++;
          setSelections((current) => (current.length ? [] : current));
        }),
      );
      cleanups.push(
        selection.onEndSelection((event) => {
          const started = generation;
          const formatted = selection.getFormattedSelection(event.documentId);
          void selection
            .getSelectedText(event.documentId)
            .toPromise()
            .then(
              (text) => {
                if (!live || started !== generation) return;
                setSelections(
                  formatted.flatMap((item, index) => {
                    const page = documents?.getDocument(event.documentId)?.pages[item.pageIndex];
                    if (!page) return [];
                    return [
                      {
                        pageIndex: item.pageIndex,
                        quote: text[index] ?? '',
                        rects: item.segmentRects
                          .map((rect) => rotateRect(page.size, rect, page.rotation))
                          .map((rect) => ({
                            x: rect.origin.x,
                            y: rect.origin.y,
                            width: rect.size.width,
                            height: rect.size.height,
                          })),
                      },
                    ];
                  }),
                );
              },
              () => {
                if (live && started === generation) setError('选区文字未取得，请重新选择。');
              },
            );
        }),
      );
    }
    return () => {
      live = false;
      for (const cleanup of cleanups) cleanup();
      projected.current = [];
      setRegistry(undefined);
      setSelections([]);
    };
  }, []);
  const config = useMemo<PDFViewerConfig>(
    () => ({
      src: url,
      wasmUrl: new URL(assets.wasmUrl, window.location.href).href,
      fontFallback: {
        defaultFont: new URL(assets.fontFallback.defaultFont, window.location.href).href,
        fonts: Object.fromEntries(
          Object.entries(assets.fontFallback.fonts).map(([charset, url]) => [
            charset,
            new URL(url, window.location.href).href,
          ]),
        ),
      },
      fonts: { ui: null, signature: null },
      stamp: { libraries: [], manifests: [], defaultLibrary: false },
      theme: { preference: 'system', light: colors, dark: colors },
      annotations: { autoCommit: false, locked: { type: LockModeType.All } },
      form: { withForms: false },
      render: { withForms: false },
      disabledCategories: [
        'annotation',
        'redaction',
        'stamp',
        'signature',
        'form',
        'document-open',
        'document-close',
        'document-export',
        'document-print',
        'document-protect',
        'document-capture',
        'capture',
        'insert',
        'rotate',
      ],
      tabBar: 'never',
      zoom: { defaultZoomLevel: ZoomMode.FitWidth },
    }),
    [url],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: SDK文档打开在React状态之外，documentEpoch触发初次投影。
  useEffect(() => {
    const annotations = registry?.getPlugin<AnnotationPlugin>('annotation')?.provides();
    if (!annotations) return;
    for (const old of projected.current) annotations.purgeAnnotation(old.pageIndex, old.id);
    projected.current = [];
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    for (const record of records) {
      const location = record.location;
      if (
        record.kind !== 'highlight' ||
        !location ||
        !('pageIndex' in location) ||
        !location.rects?.length
      )
        continue;
      const page = registry
        ?.getPlugin<DocumentManagerPlugin>('document-manager')
        ?.provides()
        ?.getActiveDocument()?.pages[location.pageIndex];
      if (!page) continue;
      const rects = location.rects.map((rect) =>
        restoreRect(
          transformSize(page.size, page.rotation, 1),
          {
            origin: { x: rect.x, y: rect.y },
            size: { width: rect.width, height: rect.height },
          },
          page.rotation,
          1,
        ),
      );
      const x = Math.min(...rects.map((rect) => rect.origin.x)),
        y = Math.min(...rects.map((rect) => rect.origin.y));
      const id = `scholoom:${record.id}`;
      annotations.importAnnotations([
        {
          annotation: {
            id,
            pageIndex: location.pageIndex,
            type: PdfAnnotationSubtype.HIGHLIGHT,
            rect: {
              origin: { x, y },
              size: {
                width: Math.max(...rects.map((rect) => rect.origin.x + rect.size.width)) - x,
                height: Math.max(...rects.map((rect) => rect.origin.y + rect.size.height)) - y,
              },
            },
            segmentRects: rects,
            contents: record.quote,
            opacity: 0.35,
            strokeColor: color,
          },
        },
      ]);
      projected.current.push({ id, pageIndex: location.pageIndex });
    }
  }, [registry, records, documentEpoch]);

  const prepare = (evidence: Pick<ReadingRecord, 'kind' | 'quote' | 'location'>) => {
    try {
      if (!recordAdapter) return;
      prepareReadingRecord(recordAdapter, evidence);
      setError('');
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  const locate = async (record: ReadingRecord) => {
    try {
      await port.document(resource, 'pdfInfo', {});
      const location = record.location;
      if (location && 'pageIndex' in location)
        registry
          ?.getPlugin<ScrollPlugin>('scroll')
          ?.provides()
          ?.scrollToPage({ pageNumber: location.pageIndex + 1, behavior: 'instant' });
    } catch (reason) {
      setError(messageOf(reason));
      setUnavailable(true);
    }
  };
  const annotationPages = new Map<number, ContextItem | undefined>();
  for (const item of context.items) {
    if (
      item.kind === 'text' &&
      item.location &&
      'pageIndex' in item.location &&
      item.basis === resource.basis &&
      sameResourceRef(item.ref, resource.ref)
    )
      annotationPages.set(item.location.pageIndex, undefined);
  }
  for (const item of contextItems) {
    if (item.kind === 'text' && item.location && 'pageIndex' in item.location)
      annotationPages.set(item.location.pageIndex, item);
  }
  return (
    <section className="pdf-reader" aria-label={ariaLabel ?? `PDF 阅读 ${resource.name}`}>
      {error ? (
        <p className="business-error" role="alert">
          {error}
        </p>
      ) : null}
      {!active ? <p className="empty-hint">当前资源不可读取。</p> : null}
      <div className="pdf-viewer">
        {url && active ? (
          <PdfViewport key={url} config={config} onReady={ready} />
        ) : (
          <p className="empty-hint">
            {error ? '原材料暂不能定位，已存记录仍可核查。' : '正在读取 PDF…'}
          </p>
        )}
      </div>
      {context.available || (recordAdapter && resource.capabilities.readingRecords) ? (
        <div className="file-view-controls">
          {context.available
            ? [...annotationPages].map(([pageIndex, item]) => (
                <Fragment key={`${resourceKey}:${pageIndex}`}>
                  <button
                    type="button"
                    className="btn"
                    disabled={!item || !selectionValid}
                    onClick={() => {
                      if (item) context.appendContextItem({ ...item, itemId: crypto.randomUUID() });
                    }}
                  >
                    附加第 {pageIndex + 1} 页选区
                  </button>
                  <ArtifactAnnotation item={item} disabled={!selectionValid} />
                </Fragment>
              ))
            : null}
          {!selectionValid ? <p role="alert">选区超出附加容量，请缩小选择。</p> : null}
          {recordAdapter && resource.capabilities.readingRecords ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={!active || !recordWrite || !url || unavailable}
                onClick={() =>
                  prepare({ kind: 'bookmark', quote: '', location: { pageIndex: page - 1 } })
                }
              >
                标记第 {page} 页书签
              </button>
              {selections.map((selection) => (
                <button
                  type="button"
                  className="btn"
                  key={selection.pageIndex}
                  disabled={!active || !recordWrite || unavailable}
                  onClick={() =>
                    prepare({
                      kind: 'highlight',
                      quote: selection.quote,
                      location: { pageIndex: selection.pageIndex, rects: selection.rects },
                    })
                  }
                >
                  保留第 {selection.pageIndex + 1} 页选区
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      {recordAdapter && resource.capabilities.readingRecords ? (
        <details className="pdf-records" open>
          <summary>共同阅读记录</summary>
          <ReadingRecordsPanel
            adapter={recordAdapter}
            enabled={enabled}
            materialAvailable={!unavailable && resource.capabilities.read}
            onRecords={setRecords}
            onLocate={(record) => {
              void locate(record);
            }}
          />
        </details>
      ) : null}
    </section>
  );
}
