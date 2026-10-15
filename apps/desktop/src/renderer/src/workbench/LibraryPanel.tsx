import type { KernelClient } from '@scholoom/client';
import type { CslMetadata, LibraryBatch, LibraryStatus } from '@scholoom/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { draftKey, readDraft, writeDraft } from './drafts';

const PAGE = 25;
/** 与协议 library.ingest.json 的上限一致；按字节核对多字节文本。 */
const IMPORT_LIMIT = 262144;
const BATCH_STATE: Record<LibraryBatch['state'], string> = {
  queued: '排队中',
  running: '处理中',
  completed: '已完成',
  interrupted: '已中断',
};
const ENTRY_STATE: Record<string, string> = {
  pending: '未执行',
  created: '已创建',
  reused: '已复用',
  failed: '失败',
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';
const bytesOf = (text: string): number => new TextEncoder().encode(text).length;

/**
 * 读取结果与请求键绑定：键变化后的迟到结果不写入界面。
 * tick 只触发重读，键不变时保留上一次结果，避免库变化使输入短暂失效。
 */
function useRead<T>(
  key: string,
  load: (() => Promise<T>) | undefined,
  tick = 0,
): { value: T | undefined; error: string } {
  const [received, setReceived] = useState<{ key: string; value?: T; error?: string }>();
  const loader = useRef(load);
  loader.current = load;
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick 显式刷新同一有界对象，保留其当前画面。
  useEffect(() => {
    const run = loader.current;
    if (!run) return;
    let active = true;
    void run().then(
      (value) => {
        if (active) setReceived({ key, value });
      },
      (reason) => {
        if (active) setReceived({ key, error: messageOf(reason) });
      },
    );
    return () => {
      active = false;
    };
  }, [key, tick]);
  if (received !== undefined && received.key === key)
    return { value: received.value, error: received.error ?? '' };
  return { value: undefined, error: '' };
}

export function LibraryPanel({ client, enabled }: { client: KernelClient; enabled: boolean }) {
  const directory = client.getSnapshot().status?.dataDirectory ?? '';
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');

  const [grants, setGrants] = useState({ read: true, write: false, send: false, autoBackup: true });
  const grantsEdited = useRef(false);
  const editGrant = (name: keyof typeof grants, value: boolean) => {
    grantsEdited.current = true;
    setGrants((current) => ({ ...current, [name]: value }));
  };
  const [destination, setDestination] = useState('');
  const [restored, setRestored] = useState('');

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [collectionOffsets, setCollectionOffsets] = useState<number[]>([0]);
  const collectionOffset = collectionOffsets.at(-1) ?? 0;
  const [offsets, setOffsets] = useState<number[]>([0]);
  const offset = offsets.at(-1) ?? 0;

  const [selectedId, setSelectedId] = useState('');
  const [editId, setEditId] = useState('');
  const [editRevision, setEditRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metadataText, setMetadataText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [chosenCollections, setChosenCollections] = useState<readonly string[]>([]);
  const [chosenRelated, setChosenRelated] = useState<readonly string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOffsets, setHistoryOffsets] = useState<number[]>([0]);
  const historyOffset = historyOffsets.at(-1) ?? 0;

  const [title, setTitle] = useState('');
  const [doi, setDoi] = useState('');
  const [version, setVersion] = useState('published');
  const [importText, setImportText] = useState('');
  const [importVersion, setImportVersion] = useState('published');

  const [collectionName, setCollectionName] = useState('');
  const [parentId, setParentId] = useState('');

  const [batchId, setBatchId] = useState('');
  const [batchOffsets, setBatchOffsets] = useState<number[]>([0]);
  const batchOffset = batchOffsets.at(-1) ?? 0;
  const [entryOffsets, setEntryOffsets] = useState<number[]>([0]);
  const entryOffset = entryOffsets.at(-1) ?? 0;
  const [poll, setPoll] = useState(0);

  const importDraft = draftKey(directory, 'library', 'import');
  const metadataDraft = useCallback(
    (sourceId: string) => draftKey(directory, 'library', 'metadata', sourceId),
    [directory],
  );
  const editSnapshot = JSON.stringify({
    id: editId,
    revision: editRevision,
    metadataText,
    tagsText,
    chosenCollections,
    chosenRelated,
  });
  const currentEdit = useRef({ id: editId, snapshot: editSnapshot });
  currentEdit.current = { id: editId, snapshot: editSnapshot };
  const currentSelection = useRef(selectedId);
  currentSelection.current = selectedId;
  const refresh = () => setRevision((value) => value + 1);

  // 库变化只重读当前范围；未保存的更正由 dirty 保护。
  useEffect(
    () =>
      client.subscribeChanges((change) => {
        if (change.libraryChanged === true) setRevision((value) => value + 1);
      }),
    [client],
  );

  useEffect(() => {
    setImportText(readDraft(importDraft));
  }, [importDraft]);

  useEffect(() => {
    const timer = setTimeout(() => setActiveQuery(query.trim()), query.trim() ? 150 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  const status = useRead<LibraryStatus>(
    `status:${enabled}`,
    enabled ? () => client.call('library.status', {}) : undefined,
    revision,
  );
  const readable = enabled && status.value?.read === true;
  const writable = enabled && status.value?.write === true;

  useEffect(() => {
    const value = status.value;
    if (value && !grantsEdited.current)
      setGrants({
        read: value.read,
        write: value.write,
        send: value.send,
        autoBackup: value.autoBackup,
      });
  }, [status.value]);

  const collectionsRead = useRead(
    `collections:${readable}:${collectionOffset}`,
    readable
      ? () => client.call('library.collections', { offset: collectionOffset, limit: 100 })
      : undefined,
    revision,
  );
  const collections = collectionsRead.value?.collections ?? [];

  const listRead = useRead(
    `list:${readable}:${offset}:${activeQuery}:${collectionFilter}:${tagFilter}`,
    readable
      ? () =>
          client.call('library.list', {
            offset,
            limit: PAGE,
            ...(activeQuery ? { query: activeQuery } : {}),
            ...(collectionFilter ? { collectionId: collectionFilter } : {}),
            ...(tagFilter.trim() ? { tag: tagFilter.trim() } : {}),
          })
      : undefined,
    revision,
  );
  const sources = listRead.value?.sources ?? [];

  const detailRead = useRead(
    `get:${readable}:${selectedId}`,
    readable && selectedId ? () => client.call('library.get', { sourceId: selectedId }) : undefined,
    revision,
  );
  const detail = detailRead.value;

  const historyRead = useRead(
    `history:${readable}:${selectedId}:${historyOffset}`,
    readable && selectedId && historyOpen
      ? () =>
          client.call('library.history', {
            sourceId: selectedId,
            offset: historyOffset,
            limit: PAGE,
          })
      : undefined,
    revision,
  );

  const batchesRead = useRead(
    `batches:${readable}:${batchOffset}`,
    readable
      ? () => client.call('library.batches', { offset: batchOffset, limit: PAGE })
      : undefined,
    revision,
  );

  const batchRead = useRead(
    `batch:${readable}:${batchId}:${entryOffset}`,
    readable && batchId
      ? () => client.call('library.batch', { batchId, offset: entryOffset, limit: PAGE })
      : undefined,
    revision + poll,
  );
  const batch = batchRead.value?.batch;

  const backupsRead = useRead(
    `backups:${readable}`,
    readable ? () => client.call('library.backups', {}) : undefined,
    revision,
  );

  // 只轮询仍在执行的批次；完成或中断后自动停止。
  useEffect(() => {
    if (!batch) return;
    if (batch.state !== 'queued' && batch.state !== 'running') return;
    const timer = setTimeout(() => setPoll((value) => value + 1), 800);
    return () => clearTimeout(timer);
  }, [batch]);

  // 草稿只在切换条目或显式重读时替换，库范围刷新不覆盖未保存的更正。
  useEffect(() => {
    if (!detail) return;
    if (detail.id === editId && (dirty || detail.revision <= editRevision)) return;
    let saved:
      | {
          revision: number;
          metadataText: string;
          tagsText: string;
          chosenCollections: string[];
          chosenRelated: string[];
        }
      | undefined;
    try {
      const value = JSON.parse(readDraft(metadataDraft(detail.id)) || 'null');
      if (
        value &&
        Number.isInteger(value.revision) &&
        typeof value.metadataText === 'string' &&
        typeof value.tagsText === 'string' &&
        [value.chosenCollections, value.chosenRelated].every(
          (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
        )
      )
        saved = value;
    } catch {
      /* Keep the authoritative record readable if local storage was edited. */
    }
    setEditId(detail.id);
    setEditRevision(saved?.revision ?? detail.revision);
    setDirty(!!saved);
    setMetadataText(saved?.metadataText ?? JSON.stringify(detail.metadata, null, 2));
    setTagsText(saved?.tagsText ?? detail.tags.join(', '));
    setChosenCollections(saved?.chosenCollections ?? [...detail.collectionIds]);
    setChosenRelated(saved?.chosenRelated ?? [...detail.relatedIds]);
  }, [detail, dirty, editId, editRevision, metadataDraft]);

  useEffect(() => {
    if (dirty && editId === selectedId)
      writeDraft(
        metadataDraft(editId),
        JSON.stringify({
          revision: editRevision,
          metadataText,
          tagsText,
          chosenCollections,
          chosenRelated,
        }),
      );
  }, [
    dirty,
    editId,
    selectedId,
    editRevision,
    metadataText,
    tagsText,
    chosenCollections,
    chosenRelated,
    metadataDraft,
  ]);

  const relatedCandidates = [
    ...sources.map((source) => ({ id: source.id, title: source.metadata.title })),
    ...(detail?.relatedIds ?? [])
      .filter((id) => !sources.some((source) => source.id === id))
      .map((id) => ({ id, title: id })),
  ].filter((candidate) => candidate.id !== detail?.id);

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(messageOf(reason));
    }
  };

  const ingest = async (json: string, batchVersion: string, origin: string) => {
    if (bytesOf(json) > IMPORT_LIMIT) throw new Error('题录输入超过 256KiB 上限。');
    const batch = await client.call('library.ingest', {
      batchId: crypto.randomUUID(),
      json,
      version: batchVersion,
      origin,
    });
    setBatchId(batch.id);
    setEntryOffsets([0]);
    refresh();
  };

  const createRecord = () =>
    run(async () => {
      const metadata: Record<string, unknown> = { title: title.trim() };
      if (doi.trim()) metadata.DOI = doi.trim();
      await ingest(JSON.stringify([metadata]), version.trim(), 'workbench-manual');
      setTitle('');
      setDoi('');
    });

  const importRecords = () =>
    run(() => ingest(importText, importVersion.trim(), 'workbench-import'));

  const selectFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    void run(async () => {
      const text = await file.text();
      if (bytesOf(text) > IMPORT_LIMIT) throw new Error('所选文件超过 256KiB 上限。');
      setImportText(text);
      writeDraft(importDraft, text);
    });
  };

  const createCollection = () =>
    run(async () => {
      await client.call('library.saveCollection', {
        name: collectionName.trim(),
        ...(parentId ? { parentId } : {}),
      });
      setCollectionName('');
      refresh();
    });

  const saveDetail = () =>
    run(async () => {
      if (!detail || saving) return;
      setSaving(true);
      try {
        const submitted = currentEdit.current;
        let metadata: CslMetadata;
        try {
          metadata = JSON.parse(metadataText) as CslMetadata;
        } catch {
          throw new Error('题录 JSON 无法解析，草稿已保留。');
        }
        const updated = await client.call('library.update', {
          sourceId: detail.id,
          revision: editRevision,
          metadata,
          tags: [
            ...new Set(
              tagsText
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ],
          collectionIds: [...chosenCollections],
          relatedIds: [...chosenRelated],
        });
        const key = metadataDraft(detail.id);
        try {
          const draft = JSON.parse(readDraft(key) || 'null');
          if (draft?.revision === editRevision) {
            const same =
              draft.metadataText === metadataText &&
              draft.tagsText === tagsText &&
              JSON.stringify(draft.chosenCollections) === JSON.stringify(chosenCollections) &&
              JSON.stringify(draft.chosenRelated) === JSON.stringify(chosenRelated);
            writeDraft(key, same ? '' : JSON.stringify({ ...draft, revision: updated.revision }));
          }
        } catch {
          /* Preserve an unreadable local draft for explicit recovery. */
        }
        if (currentSelection.current === detail.id && currentEdit.current.id === detail.id) {
          setEditRevision((current) => (current === editRevision ? updated.revision : current));
          if (currentEdit.current.snapshot === submitted.snapshot) {
            writeDraft(metadataDraft(detail.id), '');
            setDirty(false);
          }
        }
        refresh();
      } finally {
        setSaving(false);
      }
    });

  const reloadDetail = () => {
    if (!detail) return;
    writeDraft(metadataDraft(detail.id), '');
    setEditRevision(0);
    setDirty(false);
    refresh();
  };

  const resumeBatch = () =>
    run(async () => {
      await client.call('library.resume', { batchId });
      refresh();
    });

  const toggled = (ids: readonly string[], id: string): string[] =>
    ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];

  return (
    <section aria-label="文献库">
      {error ? (
        <p className="business-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="project-controls">
        <label>
          标签筛选
          <input
            aria-label="按标签筛选"
            maxLength={100}
            value={tagFilter}
            onChange={(event) => {
              setTagFilter(event.target.value);
              setOffsets([0]);
            }}
          />
        </label>
        <label>
          查找题录
          <input
            type="search"
            aria-label="查找题录"
            maxLength={200}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOffsets([0]);
            }}
          />
        </label>
        <label>
          集合筛选
          <select
            aria-label="按集合筛选"
            value={collectionFilter}
            onChange={(event) => {
              setCollectionFilter(event.target.value);
              setOffsets([0]);
            }}
          >
            <option value="">全部集合</option>
            {collectionFilter && !collections.some((item) => item.id === collectionFilter) ? (
              <option value={collectionFilter}>当前集合 {collectionFilter}</option>
            ) : null}
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {listRead.error ? (
        <p className="business-error" role="alert">
          {listRead.error}
        </p>
      ) : null}
      {!listRead.value ? (
        <p className="empty-hint">{readable ? '正在读取题录…' : '需先授权库读取。'}</p>
      ) : null}
      {listRead.value && !sources.length ? <p className="empty-hint">没有匹配的题录</p> : null}
      <ul>
        {sources.map((source) => (
          <li key={source.id}>
            <button
              type="button"
              className="btn"
              aria-label={`查看题录 ${source.metadata.title}`}
              aria-pressed={source.id === selectedId}
              onClick={() => {
                setSelectedId(source.id);
                setHistoryOpen(false);
                setHistoryOffsets([0]);
              }}
            >
              {source.metadata.title}
            </button>{' '}
            {source.version} · 附件未取得 · 分析未生成
          </li>
        ))}
      </ul>
      <div className="file-view-controls">
        <button
          type="button"
          className="btn"
          disabled={!readable || offsets.length < 2}
          onClick={() => setOffsets((current) => current.slice(0, -1))}
        >
          上一页题录
        </button>
        <button
          type="button"
          className="btn"
          disabled={!readable || listRead.value?.nextOffset === undefined}
          onClick={() => {
            const next = listRead.value?.nextOffset;
            if (next !== undefined) setOffsets((current) => [...current, next]);
          }}
        >
          下一页题录
        </button>
      </div>

      {selectedId ? (
        <section aria-label="题录详情">
          {detailRead.error ? (
            <p className="business-error" role="alert">
              {detailRead.error}
            </p>
          ) : null}
          {detail ? (
            <p>
              稳定身份 {detail.id} · 修订号 {detail.revision} · 版本 {detail.version} · 来源{' '}
              {detail.origins.join('、') || '无'}
            </p>
          ) : (
            <p className="empty-hint">正在读取题录…</p>
          )}
          {detail ? (
            <fieldset className="project-controls" disabled={!enabled}>
              <label>
                CSL JSON 题录
                <textarea
                  className="composer-input"
                  aria-label="题录 CSL JSON"
                  rows={10}
                  spellCheck={false}
                  value={metadataText}
                  onChange={(event) => {
                    setMetadataText(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                标签
                <input
                  aria-label="题录标签"
                  value={tagsText}
                  onChange={(event) => {
                    setTagsText(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <fieldset>
                <legend>集合</legend>
                {collections.map((collection) => (
                  <label key={collection.id}>
                    <input
                      type="checkbox"
                      checked={chosenCollections.includes(collection.id)}
                      onChange={() => {
                        setChosenCollections((current) => toggled(current, collection.id));
                        setDirty(true);
                      }}
                    />
                    集合 {collection.name}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>关联版本</legend>
                {relatedCandidates.map((candidate) => (
                  <label key={candidate.id}>
                    <input
                      type="checkbox"
                      checked={chosenRelated.includes(candidate.id)}
                      onChange={() => {
                        setChosenRelated((current) => toggled(current, candidate.id));
                        setDirty(true);
                      }}
                    />
                    关联版本 {candidate.title}
                  </label>
                ))}
              </fieldset>
              <div className="file-view-controls">
                <button
                  type="button"
                  className="btn"
                  disabled={!writable || saving}
                  onClick={() => void saveDetail()}
                >
                  保存题录更正
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!readable || saving}
                  onClick={reloadDetail}
                >
                  重新读取题录
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!readable}
                  onClick={() => setHistoryOpen((value) => !value)}
                >
                  {historyOpen ? '收起历史' : '查看历史'}
                </button>
              </div>
              {historyOpen ? (
                <>
                  {historyRead.error ? (
                    <p className="business-error" role="alert">
                      {historyRead.error}
                    </p>
                  ) : null}
                  <ul>
                    {(historyRead.value?.sources ?? []).map((snapshot) => (
                      <li key={snapshot.revision}>
                        修订号 {snapshot.revision} · {snapshot.metadata.title} ·{' '}
                        {snapshot.updatedAt}
                      </li>
                    ))}
                  </ul>
                  <div className="file-view-controls">
                    <button
                      type="button"
                      className="btn"
                      disabled={!readable || historyOffsets.length < 2}
                      onClick={() => setHistoryOffsets((current) => current.slice(0, -1))}
                    >
                      上一页历史
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!readable || historyRead.value?.nextOffset === undefined}
                      onClick={() => {
                        const next = historyRead.value?.nextOffset;
                        if (next !== undefined) setHistoryOffsets((current) => [...current, next]);
                      }}
                    >
                      下一页历史
                    </button>
                  </div>
                </>
              ) : null}
            </fieldset>
          ) : null}
        </section>
      ) : null}

      <fieldset className="project-controls" disabled={!enabled}>
        <legend>摄取批次</legend>
        {batchesRead.error ? (
          <p className="business-error" role="alert">
            {batchesRead.error}
          </p>
        ) : null}
        <ul>
          {(batchesRead.value?.batches ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="btn"
                aria-label={`查看批次 ${item.createdAt}`}
                aria-pressed={item.id === batchId}
                onClick={() => {
                  setBatchId(item.id);
                  setEntryOffsets([0]);
                }}
              >
                {item.createdAt} · {BATCH_STATE[item.state]} · {item.processed}/{item.total}
              </button>
            </li>
          ))}
        </ul>
        <div className="file-view-controls">
          <button
            type="button"
            className="btn"
            disabled={!readable || batchOffsets.length < 2}
            onClick={() => setBatchOffsets((current) => current.slice(0, -1))}
          >
            上一页批次
          </button>
          <button
            type="button"
            className="btn"
            disabled={!readable || batchesRead.value?.nextOffset === undefined}
            onClick={() => {
              const next = batchesRead.value?.nextOffset;
              if (next !== undefined) setBatchOffsets((current) => [...current, next]);
            }}
          >
            下一页批次
          </button>
        </div>
        {batchRead.error ? (
          <p className="business-error" role="alert">
            {batchRead.error}
          </p>
        ) : null}
        {batch ? (
          <>
            <p role="status" aria-label="批次进度">
              批次 {batch.id} · {BATCH_STATE[batch.state]} · 已处理 {batch.processed}/{batch.total}{' '}
              · 失败 {batch.failed} · 来源 {batch.origin}
              {batch.error ? ` · 中断原因 ${batch.error.message}` : ''}
            </p>
            <ul>
              {(batchRead.value?.entries ?? []).map((entry) => (
                <li key={entry.index}>
                  第 {entry.index + 1} 条 · {ENTRY_STATE[entry.state] ?? entry.state}
                  {entry.conflicts.length ? ` · 冲突字段 ${entry.conflicts.join('、')}` : ''}
                  {entry.error ? ` · ${entry.error.message}` : ''}
                  {typeof entry.candidate?.title === 'string' ? ` · ${entry.candidate.title}` : ''}
                  {entry.sourceId ? ` · ${entry.sourceId}` : ''}
                </li>
              ))}
            </ul>
            <div className="file-view-controls">
              <button
                type="button"
                className="btn"
                disabled={!readable || entryOffsets.length < 2}
                onClick={() => setEntryOffsets((current) => current.slice(0, -1))}
              >
                上一页批次结果
              </button>
              <button
                type="button"
                className="btn"
                disabled={!readable || batchRead.value?.nextOffset === undefined}
                onClick={() => {
                  const next = batchRead.value?.nextOffset;
                  if (next !== undefined) setEntryOffsets((current) => [...current, next]);
                }}
              >
                下一页批次结果
              </button>
              {batch.state === 'interrupted' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={!writable}
                  onClick={() => void resumeBatch()}
                >
                  接续未执行项
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </fieldset>

      <fieldset className="project-controls" disabled={!enabled}>
        <details>
          <summary>手动建项</summary>
          <label>
            题名
            <input
              aria-label="题名"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            DOI
            <input aria-label="DOI" value={doi} onChange={(event) => setDoi(event.target.value)} />
          </label>
          <label>
            版本标签
            <input
              aria-label="版本标签"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </label>
          <p>未知发表版本填 unspecified，不参与自动去重。</p>
          <button
            type="button"
            className="btn"
            disabled={!writable || !title.trim()}
            onClick={() => void createRecord()}
          >
            创建题录
          </button>
        </details>

        <details>
          <summary>CSL JSON 导入</summary>
          <label>
            CSL JSON 文本
            <textarea
              className="composer-input"
              aria-label="CSL JSON 文本"
              rows={8}
              spellCheck={false}
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                writeDraft(importDraft, event.target.value);
              }}
            />
          </label>
          <label>
            选择本机文件
            <input
              type="file"
              accept="application/json,.json"
              aria-label="选择 CSL JSON 文件"
              onChange={(event) => selectFile(event.currentTarget)}
            />
          </label>
          <label>
            导入版本标签
            <input
              aria-label="导入版本标签"
              value={importVersion}
              onChange={(event) => setImportVersion(event.target.value)}
            />
          </label>
          <p>上限 256KiB／1000 条；选择文件只读取你选中的 JSON 文本。</p>
          <button
            type="button"
            className="btn"
            disabled={!writable || !importText.trim()}
            onClick={() => void importRecords()}
          >
            导入批次
          </button>
        </details>

        <details>
          <summary>集合</summary>
          <label>
            集合名称
            <input
              aria-label="集合名称"
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
            />
          </label>
          <label>
            父集合
            <select
              aria-label="父集合"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">无父集合</option>
              {parentId && !collections.some((item) => item.id === parentId) ? (
                <option value={parentId}>所选父集合 {parentId}</option>
              ) : null}
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={!writable || !collectionName.trim()}
            onClick={() => void createCollection()}
          >
            创建集合
          </button>
          <ul>
            {collections.map((collection) => (
              <li key={collection.id}>
                {collection.name}
                {collection.parentId ? `（父集合 ${collection.parentId}）` : ''}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn"
            disabled={collectionOffsets.length < 2}
            onClick={() => setCollectionOffsets((current) => current.slice(0, -1))}
          >
            上一页集合
          </button>
          <button
            type="button"
            className="btn"
            disabled={collectionsRead.value?.nextOffset === undefined}
            onClick={() => {
              const next = collectionsRead.value?.nextOffset;
              if (next !== undefined) setCollectionOffsets((current) => [...current, next]);
            }}
          >
            下一页集合
          </button>
        </details>

        <details>
          <summary>文献库授权与备份</summary>
          <p role="status" aria-label="库状态">
            库 {status.value?.id ?? '未读取'} · 修订号 {status.value?.revision ?? 0}
          </p>
          <label>
            <input
              type="checkbox"
              checked={grants.read}
              onChange={(event) => editGrant('read', event.target.checked)}
            />
            读取库
          </label>
          <label>
            <input
              type="checkbox"
              checked={grants.write}
              onChange={(event) => editGrant('write', event.target.checked)}
            />
            写入库
          </label>
          <label>
            <input
              type="checkbox"
              checked={grants.send}
              onChange={(event) => editGrant('send', event.target.checked)}
            />
            发送题录到模型
          </label>
          <label>
            <input
              type="checkbox"
              checked={grants.autoBackup}
              onChange={(event) => editGrant('autoBackup', event.target.checked)}
            />
            自动备份
          </label>
          <button
            type="button"
            className="btn"
            onClick={() =>
              void run(async () => {
                const result = await client.call('library.grant', grants);
                grantsEdited.current = false;
                setGrants({
                  read: result.read,
                  write: result.write,
                  send: result.send,
                  autoBackup: result.autoBackup,
                });
                refresh();
              })
            }
          >
            保存库授权
          </button>
          <button
            type="button"
            className="btn"
            disabled={!readable}
            onClick={() =>
              void run(async () => {
                await client.call('library.backup', {});
                refresh();
              })
            }
          >
            立即备份
          </button>
          <label>
            独立恢复目录
            <input
              aria-label="独立恢复目录"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </label>
          {backupsRead.error ? (
            <p className="business-error" role="alert">
              {backupsRead.error}
            </p>
          ) : null}
          {(backupsRead.value ?? []).map((backup) => (
            <div key={backup.id}>
              <span>{backup.createdAt} · 题录数据库（不含附件）</span>{' '}
              <button
                type="button"
                className="btn"
                aria-label={`恢复备份 ${backup.createdAt}`}
                disabled={!readable || !destination.trim()}
                onClick={() =>
                  void run(async () => {
                    const copy = await client.call('library.restore', {
                      backupId: backup.id,
                      destination: destination.trim(),
                    });
                    setRestored(`副本目录：${copy.directory}`);
                  })
                }
              >
                恢复此副本
              </button>
            </div>
          ))}
          {restored ? (
            <p role="status" aria-label="恢复结果">
              {restored}
            </p>
          ) : null}
        </details>
      </fieldset>
    </section>
  );
}
