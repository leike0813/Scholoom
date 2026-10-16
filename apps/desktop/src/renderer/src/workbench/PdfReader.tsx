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
import type { KernelClient } from '@scholoom/client';
import type { LibraryAttachment, ReadingRecord } from '@scholoom/protocol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prepareReadingRecord, ReadingRecordsPanel } from './ReadingRecordsPanel';

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

export function PdfReader({
  client,
  material,
  enabled,
}: {
  client: KernelClient;
  material: LibraryAttachment;
  enabled: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [grants, setGrants] = useState({ read: false, write: false });
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [page, setPage] = useState(1);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [registry, setRegistry] = useState<PluginRegistry>();
  const [documentEpoch, setDocumentEpoch] = useState(0);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const projected = useRef<{ id: string; pageIndex: number }[]>([]);
  const active = enabled && grants.read;
  useEffect(
    () =>
      client.subscribeChanges((change) => {
        if (change.libraryChanged) setTick((value) => value + 1);
      }),
    [client],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 库通知仅刷新授权，不重载材料和viewer。
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void client.call('library.status', {}).then(
      async (status) => {
        if (!current) return;
        setGrants(status);
        if (!status.read) return;
        try {
          const value = await client.call('library.readAttachment', {
            attachmentId: material.id,
            limit: 1,
          });
          if (value.materialVersionId !== material.materialVersionId)
            throw new Error('材料版本已变化。');
          if (current) setUnavailable(false);
        } catch (reason) {
          if (current) {
            setUnavailable(true);
            setError(messageOf(reason));
          }
        }
      },
      (reason) => {
        if (current) {
          setGrants({ read: false, write: false });
          setError(messageOf(reason));
        }
      },
    );
    return () => {
      current = false;
    };
  }, [client, enabled, tick, material.id, material.materialVersionId]);

  useEffect(() => {
    if (!active) return;
    let current = true;
    let objectUrl = '';
    setError('');
    void (async () => {
      await client.call('library.pdfInfo', {
        attachmentId: material.id,
        materialVersionId: material.materialVersionId,
      });
      const parts: BlobPart[] = [];
      let offset = 0;
      for (;;) {
        if (!current) return;
        const result = await client.call('library.readAttachment', {
          attachmentId: material.id,
          offset,
          limit: 262144,
        });
        if (!current) return;
        if (result.materialVersionId !== material.materialVersionId)
          throw new Error('材料已变化，保留原版本阅读记录。');
        const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
        if (offset + bytes.length > 134217728) throw new Error('PDF超过128MiB读取上限。');
        parts.push(bytes);
        if (result.nextOffset === undefined) break;
        if (result.nextOffset <= offset) throw new Error('材料读取位置未推进。');
        offset = result.nextOffset;
      }
      if (!current) return;
      objectUrl = URL.createObjectURL(new Blob(parts, { type: 'application/pdf' }));
      setUrl(objectUrl);
    })().catch((reason) => {
      if (current) {
        setError(messageOf(reason));
        setUnavailable(true);
      }
    });
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl('');
    };
  }, [client, active, material.id, material.materialVersionId]);

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
      if (record.kind !== 'highlight' || !record.location?.rects?.length) continue;
      const page = registry
        ?.getPlugin<DocumentManagerPlugin>('document-manager')
        ?.provides()
        ?.getActiveDocument()?.pages[record.location.pageIndex];
      if (!page) continue;
      const rects = record.location.rects.map((rect) =>
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
            pageIndex: record.location.pageIndex,
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
      projected.current.push({ id, pageIndex: record.location.pageIndex });
    }
  }, [registry, records, documentEpoch]);

  const prepare = (evidence: Pick<ReadingRecord, 'kind' | 'quote' | 'location'>) => {
    try {
      prepareReadingRecord(client, material, evidence);
      setError('');
    } catch (reason) {
      setError(messageOf(reason));
    }
  };
  const locate = async (record: ReadingRecord) => {
    try {
      await client.call('library.pdfInfo', {
        attachmentId: material.id,
        materialVersionId: material.materialVersionId,
      });
      if (record.location)
        registry
          ?.getPlugin<ScrollPlugin>('scroll')
          ?.provides()
          ?.scrollToPage({ pageNumber: record.location.pageIndex + 1, behavior: 'instant' });
    } catch (reason) {
      setError(messageOf(reason));
      setUnavailable(true);
    }
  };
  return (
    <section className="pdf-reader" aria-label={`PDF 阅读 ${material.name}`}>
      {error ? (
        <p className="business-error" role="alert">
          {error}
        </p>
      ) : null}
      {!active ? <p className="empty-hint">需连接内核并授权库读取。</p> : null}
      <div className="pdf-viewer">
        {url && active ? (
          <PdfViewport key={url} config={config} onReady={ready} />
        ) : (
          <p className="empty-hint">
            {error ? '原材料暂不能定位，已存记录仍可核查。' : '正在读取 PDF…'}
          </p>
        )}
      </div>
      <div className="file-view-controls">
        <button
          type="button"
          className="btn"
          disabled={!active || !grants.write || !url || unavailable}
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
            disabled={!active || !grants.write || unavailable}
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
      </div>
      <details className="pdf-records" open>
        <summary>共同阅读记录</summary>
        <ReadingRecordsPanel
          client={client}
          enabled={enabled}
          readable={grants.read}
          writable={grants.write}
          attachment={{ ...material, state: unavailable ? 'unavailable' : 'available' }}
          tick={tick}
          onRecords={setRecords}
          onLocate={(record) => {
            void locate(record);
          }}
        />
      </details>
    </section>
  );
}
