import {
  type ContextItem,
  type DocumentNode,
  isContextItems,
  type ReadingRecord,
  type TextLocation,
} from '@scholoom/protocol';
import type {
  ResourceDescriptor,
  ResourceDocumentInputs,
  ResourceDocumentOutputs,
} from '@scholoom/protocol/resources';
import {
  createElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useContextContribution } from './context-contributions';
import { prepareReadingRecord, ReadingRecordsPanel } from './ReadingRecordsPanel';
import type { ReadingRecordAdapter, WorkbenchResourcePort } from './resource-controller';

type Section = ResourceDocumentOutputs['readDocumentSection'];
type Info = ResourceDocumentOutputs['documentInfo'];
type Search = ResourceDocumentOutputs['searchDocument'];
type Target = { sectionId: string; offset: number; anchor?: string };
const messageOf = (error: unknown) => (error instanceof Error ? error.message : '文档读取未完成。');

function DocumentImage({
  port,
  resource,
  sectionId,
  resourceId,
  alt,
  active,
  enqueue,
}: {
  port: WorkbenchResourcePort;
  resource: ResourceDescriptor;
  sectionId: string;
  resourceId: string | undefined;
  alt: string;
  active: boolean;
  enqueue: (job: () => Promise<void>) => void;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!element.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry explicitly restarts a failed bounded image read.
  useEffect(() => {
    if (!active || !visible || !resourceId) return;
    let current = true;
    let url = '';
    setImage('');
    setError('');
    enqueue(async () => {
      if (!current) return;
      try {
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let offset = 0;
        let mimeType = '';
        for (;;) {
          const input: ResourceDocumentInputs['readDocumentResource'] = {
            sectionId,
            resourceId,
            offset,
          };
          const value = await port.document<'readDocumentResource'>(
            resource,
            'readDocumentResource',
            input,
          );
          if (!current) return;
          if (value.byteLength > 1024 * 1024 || value.offset !== offset)
            throw new Error('图片超出读取范围。');
          chunks.push(Uint8Array.from(atob(value.base64), (character) => character.charCodeAt(0)));
          mimeType = value.mimeType;
          if (value.nextOffset === undefined) break;
          if (value.nextOffset <= offset) throw new Error('图片继续位置无效。');
          offset = value.nextOffset;
        }
        if (!current) return;
        url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        setImage(url);
      } catch (reason) {
        if (current) setError(messageOf(reason));
      }
    });
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [port, resource, sectionId, resourceId, active, visible, retry, enqueue]);
  return (
    <span ref={element} className="document-image">
      {image && active ? (
        <img src={image} alt={alt} />
      ) : (
        <span>
          {alt} · {error || (resourceId ? '图片未加载' : '资源未纳入')}
          {error && resourceId ? (
            <button
              type="button"
              className="btn"
              disabled={!active}
              onClick={() => setRetry((value) => value + 1)}
            >
              重试图片
            </button>
          ) : null}
        </span>
      )}
    </span>
  );
}

/** A text leaf owns its absolute interval even when marks split its DOM text nodes. */
function markedText(node: DocumentNode, ranges: TextLocation[]): ReactNode {
  const text = node.text ?? '';
  const boundaries = new Set([node.start, node.end]);
  for (const range of ranges)
    if (range.end > node.start && range.start < node.end) {
      boundaries.add(Math.max(node.start, range.start));
      boundaries.add(Math.min(node.end, range.end));
    }
  const points = [...boundaries].sort((a, b) => a - b);
  return (
    <span data-document-start={node.start}>
      {points.slice(0, -1).map((start, index) => {
        const end = points[index + 1] ?? node.end;
        const value = text.slice(start - node.start, end - node.start);
        return ranges.some((range) => range.start < end && range.end > start) ? (
          <mark key={start}>{value}</mark>
        ) : (
          <span key={start}>{value}</span>
        );
      })}
    </span>
  );
}

function selectionPoint(container: HTMLElement, node: Node, offset: number): number | undefined {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const leaf = element?.closest<HTMLElement>('[data-document-start]');
  if (!leaf || !container.contains(leaf)) return undefined;
  const prefix = document.createRange();
  prefix.selectNodeContents(leaf);
  try {
    prefix.setEnd(node, offset);
  } catch {
    return undefined;
  }
  return Number(leaf.dataset.documentStart) + prefix.toString().length;
}

export function DocumentReader({
  resource,
  port,
  records: recordAdapter,
  enabled,
  viewId: suppliedViewId,
}: {
  resource: ResourceDescriptor;
  port: WorkbenchResourcePort;
  records?: ReadingRecordAdapter | undefined;
  enabled: boolean;
  viewId?: string | undefined;
}) {
  const [tick, setTick] = useState(0);
  const [grants, setGrants] = useState({ read: false });
  const [recordWrite, setRecordWrite] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [info, setInfo] = useState<Info>();
  const [infoOffset, setInfoOffset] = useState(0);
  const [target, setTarget] = useState<Target>();
  const trail = useRef<Target[]>([]);
  const targetRef = useRef(target);
  targetRef.current = target;
  const go = useCallback((next: Target, forward = false) => {
    if (forward && targetRef.current) trail.current.push(targetRef.current);
    else trail.current = [];
    setTarget(next);
  }, []);
  const [received, setReceived] = useState<{ key: string; value: Section }>();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search>();
  const [searching, setSearching] = useState(false);
  const [selection, setSelection] = useState<{ quote: string; location: TextLocation }>();
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [recordsOpen, setRecordsOpen] = useState(true);
  const [focusRange, setFocusRange] = useState<TextLocation>();
  const [imagePage, setImagePage] = useState(0);
  const imageQueue = useRef(Promise.resolve());
  const enqueueImage = useCallback((job: () => Promise<void>) => {
    imageQueue.current = imageQueue.current.then(job, job);
  }, []);
  const article = useRef<HTMLElement>(null);
  useEffect(() => {
    const clearInvalidSelection = () => {
      const current = window.getSelection();
      if (
        !current?.rangeCount ||
        current.isCollapsed ||
        !article.current?.contains(current.anchorNode) ||
        !article.current.contains(current.focusNode)
      )
        setSelection((value) => (value ? undefined : value));
    };
    document.addEventListener('selectionchange', clearInvalidSelection);
    return () => document.removeEventListener('selectionchange', clearInvalidSelection);
  }, []);
  const searchEpoch = useRef(0);
  const mounted = useRef(true);
  const resourceKey = JSON.stringify([resource.ref, resource.basis]);
  const key = target
    ? `${resourceKey}:${target.sectionId}:${target.offset}:${target.anchor ?? ''}`
    : '';
  const section = received?.key === key ? received.value : undefined;
  const [authorizedKey, setAuthorizedKey] = useState('');
  const active = enabled && grants.read && authorizedKey === resourceKey;
  const context = useContextContribution();
  const instanceId = useId();
  const viewId = suppliedViewId ?? instanceId;
  const contextItem = useMemo<ContextItem | undefined>(
    () =>
      active && section && selection && selection.location.sectionId === section.sectionId
        ? {
            kind: 'text',
            itemId: crypto.randomUUID(),
            ref: resource.ref,
            basis: resource.basis,
            quote: selection.quote,
            contentState: 'saved',
            location: selection.location,
          }
        : undefined,
    [active, section, selection, resource],
  );
  const selectionValid = !contextItem || isContextItems([contextItem]);
  const contribute = context.contributeSelection;
  useEffect(() => {
    contribute(viewId, contextItem && selectionValid ? { selections: [contextItem] } : undefined);
    return () => contribute(viewId);
  }, [contribute, viewId, contextItem, selectionValid]);
  const activeRef = useRef(active);
  activeRef.current = active;
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
    if (active) return;
    searchEpoch.current++;
    setSearch(undefined);
    setSearching(false);
    setSelection(undefined);
    setReceived(undefined);
  }, [active]);
  const failRead = useCallback((reason: unknown) => {
    setError(messageOf(reason));
    setReceived(undefined);
    setSelection(undefined);
    const code =
      typeof reason === 'object' && reason !== null ? Reflect.get(reason, 'code') : undefined;
    if (code === 'contentChanged' || code === 'notFound' || code === 'permissionDenied') {
      setGrants({ read: false });
      setAuthorizedKey('');
      activeRef.current = false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      searchEpoch.current++;
    };
  }, []);
  useEffect(
    () =>
      port.subscribe(() => {
        searchEpoch.current++;
        setSearching(false);
        setTick((value) => value + 1);
      }),
    [port],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: resource notifications explicitly refresh describe authorization.
  useEffect(() => {
    let live = true;
    if (!enabled) {
      setGrants({ read: false });
      setAuthorizedKey('');
      return () => {
        live = false;
      };
    }
    void port
      .describe({ ...resource.ref })
      .then(
        (fresh) => {
          if (!live) return;
          if (fresh.basis !== resource.basis) throw new Error('材料依据已变化，请重新打开资源。');
          setGrants({ read: fresh.capabilities.read });
          setError(fresh.unavailableReason ?? '');
          setAuthorizedKey(resourceKey);
        },
        (reason) => {
          if (live) {
            setGrants({ read: false });
            setAuthorizedKey('');
            activeRef.current = false;
            setError(messageOf(reason));
          }
        },
      )
      .catch((reason) => {
        if (live) {
          setGrants({ read: false });
          setAuthorizedKey('');
          activeRef.current = false;
          setError(messageOf(reason));
        }
      });
    return () => {
      live = false;
    };
  }, [port, enabled, resource, resourceKey, tick]);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const input: ResourceDocumentInputs['documentInfo'] = { offset: infoOffset, limit: 25 };
    void port
      .document<'documentInfo'>(resource, 'documentInfo', input)
      .then((value) => {
        if (!live) return;
        setInfo(value);
        setTarget(
          (current) =>
            current ??
            (value.sections[0] ? { sectionId: value.sections[0].id, offset: 0 } : undefined),
        );
      })
      .catch((reason) => {
        if (live) failRead(reason);
      });
    return () => {
      live = false;
    };
  }, [port, resource, active, infoOffset, failRead]);
  useEffect(() => {
    if (!active || !target) return;
    let live = true;
    setLoading(true);
    setSelection(undefined);
    setImagePage(0);
    setActionError('');
    const input: ResourceDocumentInputs['readDocumentSection'] = {
      sectionId: target.sectionId,
      offset: target.offset,
      ...(target.anchor ? { anchor: target.anchor } : {}),
    };
    void port
      .document<'readDocumentSection'>(resource, 'readDocumentSection', input)
      .then((value) => {
        if (live) {
          setReceived({ key, value });
          setError('');
        }
      })
      .catch((reason) => {
        if (live) failRead(reason);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [port, resource, active, target, key, failRead]);
  const imageIndexes = useMemo(() => {
    const indexes = new Map<number, number>();
    section?.nodes.forEach((node, index) => {
      if (node.tag === 'img') indexes.set(index, indexes.size);
    });
    return indexes;
  }, [section]);
  const ranges = useMemo(
    () =>
      records.flatMap((record) =>
        record.kind === 'highlight' &&
        record.location &&
        'kind' in record.location &&
        record.location.sectionId === section?.sectionId
          ? [record.location]
          : [],
      ),
    [records, section?.sectionId],
  );
  const projected = useMemo(
    () => [
      ...ranges,
      ...(focusRange && focusRange.sectionId === section?.sectionId ? [focusRange] : []),
    ],
    [ranges, focusRange, section?.sectionId],
  );
  const children = useMemo(() => {
    const map = new Map<number, number[]>();
    section?.nodes.forEach((node, index) => {
      const group = map.get(node.parent) ?? [];
      group.push(index);
      map.set(node.parent, group);
    });
    return map;
  }, [section]);
  const capture = () => {
    const element = article.current,
      value = window.getSelection();
    if (!element || !value?.rangeCount || value.isCollapsed || !section || !active) {
      setSelection(undefined);
      return;
    }
    const range = value.getRangeAt(0);
    const start = selectionPoint(element, range.startContainer, range.startOffset),
      end = selectionPoint(element, range.endContainer, range.endOffset);
    if (
      start === undefined ||
      end === undefined ||
      start >= end ||
      start < section.offset ||
      end > section.offset + section.text.length
    ) {
      setSelection(undefined);
      return;
    }
    setSelection({
      quote: section.text.slice(start - section.offset, end - section.offset),
      location: { kind: 'text', normalizationVersion: 1, sectionId: section.sectionId, start, end },
    });
  };
  const prepare = (kind: 'highlight' | 'bookmark') => {
    if (!section) return;
    try {
      const evidence =
        kind === 'highlight'
          ? selection
          : {
              quote: '',
              location: {
                kind: 'text' as const,
                normalizationVersion: 1 as const,
                sectionId: section.sectionId,
                start: section.offset,
                end: section.offset,
              },
            };
      if (!evidence) return;
      if (!recordAdapter) return;
      prepareReadingRecord(recordAdapter, { kind, ...evidence });
      setRecordsOpen(true);
      setActionError('');
    } catch (reason) {
      setActionError(messageOf(reason));
    }
  };
  const locate = useCallback(
    (record: ReadingRecord) => {
      if (!record.location || !('kind' in record.location)) return;
      setFocusRange(record.location);
      go({ sectionId: record.location.sectionId, offset: record.location.start });
    },
    [go],
  );
  const runSearch = async (continuing = false) => {
    const epoch = ++searchEpoch.current;
    setSearching(true);
    setActionError('');
    try {
      const input: ResourceDocumentInputs['searchDocument'] = {
        query,
        limit: 25,
        ...(continuing && search?.nextCursor ? { cursor: search.nextCursor } : {}),
      };
      const result = await port.document<'searchDocument'>(resource, 'searchDocument', input);
      if (mounted.current && activeRef.current && epoch === searchEpoch.current) setSearch(result);
    } catch (reason) {
      if (mounted.current && epoch === searchEpoch.current) setActionError(messageOf(reason));
    } finally {
      if (mounted.current && epoch === searchEpoch.current) setSearching(false);
    }
  };
  const navigate = (href: string) => {
    if (/^(https?:|mailto:)/i.test(href)) {
      if (window.scholoomDesktop)
        void window.scholoomDesktop
          .openExternal(href)
          .catch((reason) => setActionError(messageOf(reason)));
      else window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      const index = href.indexOf('#');
      let sectionId = index < 0 ? href : href.slice(0, index);
      let anchor = index < 0 ? '' : href.slice(index + 1);
      try {
        sectionId = decodeURIComponent(sectionId);
        anchor = decodeURIComponent(anchor);
      } catch {
        setActionError('文档链接无效。');
        return;
      }
      go({ sectionId, offset: 0, ...(anchor ? { anchor } : {}) });
    }
  };
  const renderNode = (index: number): ReactNode => {
    const node = section?.nodes[index];
    if (!node) return null;
    if (node.tag === 'text') {
      const parent = section?.nodes[node.parent]?.tag;
      if (parent && ['table', 'thead', 'tbody', 'tr'].includes(parent)) return node.text;
      return <span key={index}>{markedText(node, projected)}</span>;
    }
    const descendants = children.get(index)?.map(renderNode);
    if (node.tag === 'img' && Math.floor((imageIndexes.get(index) ?? 0) / 8) !== imagePage)
      return (
        <button
          type="button"
          key={index}
          className="btn"
          onClick={() => setImagePage(Math.floor((imageIndexes.get(index) ?? 0) / 8))}
        >
          显示图片 {node.alt ?? ''}
        </button>
      );
    if (node.tag === 'img')
      return (
        <DocumentImage
          key={`${resource.basis}:${section?.sectionId}:${section?.offset}:${index}`}
          port={port}
          resource={resource}
          sectionId={section?.sectionId ?? ''}
          resourceId={node.resourceId}
          alt={node.alt ?? '图片'}
          active={active}
          enqueue={enqueueImage}
        />
      );
    if (node.tag === 'a')
      return (
        <a
          key={index}
          href={node.href ? '#' : undefined}
          onClick={(event) => {
            event.preventDefault();
            if (node.href) navigate(node.href);
          }}
        >
          {descendants}
        </a>
      );
    return createElement(node.tag, { key: index }, ...(descendants ?? []));
  };
  return (
    <section className="document-reader" aria-label={`文档阅读 ${resource.name}`}>
      <div className="document-reader-toolbar project-controls">
        <label>
          文档章节
          <select
            aria-label="文档章节"
            disabled={!active || !info}
            value={target?.sectionId ?? ''}
            onChange={(event) => {
              setFocusRange(undefined);
              go({ sectionId: event.target.value, offset: 0 });
            }}
          >
            {target && !info?.sections.some((value) => value.id === target.sectionId) ? (
              <option value={target.sectionId}>{target.sectionId}</option>
            ) : null}
            {info?.sections.map((value) => (
              <option key={value.id} value={value.id}>
                {value.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          disabled={!active || infoOffset === 0}
          onClick={() => setInfoOffset(Math.max(0, infoOffset - 25))}
        >
          上一页章节
        </button>
        <button
          type="button"
          className="btn"
          disabled={!active || info?.nextOffset === undefined}
          onClick={() => setInfoOffset(info?.nextOffset ?? 0)}
        >
          下一页章节
        </button>
        <button
          type="button"
          className="btn"
          disabled={!active || !section || section.offset === 0 || loading}
          onClick={() => {
            if (section)
              setTarget(trail.current.pop() ?? { sectionId: section.sectionId, offset: 0 });
          }}
        >
          上一段
        </button>
        <button
          type="button"
          className="btn"
          disabled={!active || section?.nextOffset === undefined || loading}
          onClick={() => {
            if (section?.nextOffset !== undefined)
              go({ sectionId: section.sectionId, offset: section.nextOffset }, true);
          }}
        >
          下一段
        </button>
        <button
          type="button"
          className="btn"
          disabled={!enabled || !grants.read}
          onClick={() => {
            setTick((value) => value + 1);
            if (target) setTarget({ ...target });
          }}
        >
          重新读取文档
        </button>
        {context.available ? (
          <button
            type="button"
            className="btn"
            disabled={!contextItem || !selectionValid}
            onClick={() => {
              if (contextItem && selectionValid)
                context.appendContextItem({ ...contextItem, itemId: crypto.randomUUID() });
            }}
          >
            附加选区
          </button>
        ) : null}
        {recordAdapter && resource.capabilities.readingRecords ? (
          <>
            <button
              type="button"
              className="btn"
              disabled={!active || !recordWrite || !selection}
              onClick={() => prepare('highlight')}
            >
              保留选区
            </button>
            <button
              type="button"
              className="btn"
              disabled={!active || !recordWrite || !section || loading}
              onClick={() => prepare('bookmark')}
            >
              添加书签
            </button>
          </>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <input
            aria-label="搜索文档"
            value={query}
            onChange={(event) => {
              searchEpoch.current++;
              setSearching(false);
              setQuery(event.target.value);
              setSearch(undefined);
            }}
          />
          <button type="submit" className="btn" disabled={!active || !query.trim() || searching}>
            搜索文档
          </button>
        </form>
      </div>
      {error || actionError ? (
        <p role="alert" className="business-error">
          {actionError || error}
        </p>
      ) : null}
      {!selectionValid ? <p role="alert">选区超出附加容量，请缩小选择。</p> : null}
      {!grants.read ? <p>资源当前不可读取。</p> : null}
      {loading ? <p role="status">正在读取文档。</p> : null}
      {active && search ? (
        <section aria-label="文档搜索结果" className="document-search-results">
          <p>{search.complete ? '已搜索完整文档' : '搜索尚未覆盖全文，可继续'}</p>
          {search.hits.map((hit) => (
            <button
              type="button"
              className="btn"
              key={`${hit.sectionId}:${hit.start}`}
              onClick={() => {
                setFocusRange({
                  kind: 'text',
                  normalizationVersion: 1,
                  sectionId: hit.sectionId,
                  start: hit.start,
                  end: hit.end,
                });
                go({ sectionId: hit.sectionId, offset: hit.start });
              }}
            >
              {hit.sectionId} · {hit.quote}
            </button>
          ))}
          {search.nextCursor ? (
            <button
              type="button"
              className="btn"
              disabled={searching || !active}
              onClick={() => void runSearch(true)}
            >
              继续搜索
            </button>
          ) : null}
        </section>
      ) : null}
      {active && section ? (
        <article
          aria-label="文档正文"
          className="document-prose"
          ref={article}
          onPointerUp={capture}
          onKeyUp={capture}
        >
          {children.get(-1)?.map(renderNode)}
        </article>
      ) : null}
      {recordAdapter && resource.capabilities.readingRecords ? (
        <details open={recordsOpen} onToggle={(event) => setRecordsOpen(event.currentTarget.open)}>
          <summary>共同阅读记录</summary>
          <ReadingRecordsPanel
            adapter={recordAdapter}
            enabled={enabled}
            materialAvailable={active}
            onRecords={setRecords}
            onLocate={locate}
          />
        </details>
      ) : null}
    </section>
  );
}
