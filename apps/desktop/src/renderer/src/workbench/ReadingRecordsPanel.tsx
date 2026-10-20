import type { KernelClient } from '@scholoom/client';
import {
  type BusinessParams,
  type LibraryAttachment,
  type ReadingLocation,
  type ReadingRecord,
  validateBusiness,
} from '@scholoom/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import { draftKey, readDraft, subscribeDraft, writeDraft } from './drafts';
import type { ReadingRecordAdapter } from './resource-controller';
import { createReadingRecordAdapter } from './resource-controller';

const PAGE = 25;
/** 界面只展示协议枚举的中文；材料状态同时用于解释新建为何不可用。 */
const KIND_LABEL: Record<ReadingRecord['kind'], string> = {
  bookmark: '书签',
  highlight: '高亮',
  note: '笔记',
};
const MATERIAL_LABEL: Record<LibraryAttachment['state'], string> = {
  available: '可读',
  missing: '缺失',
  changed: '内容已变',
  unavailable: '不可用',
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';
const codeOf = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
};
/** 摘录与解释分开呈现；作者是注入的可信身份，不混作原文。 */
const authorLabel = (author: ReadingRecord['createdBy']) =>
  author.kind === 'agent' ? `Agent 会话 ${author.sessionId}` : '用户';
/** PDF 与规范化正文共用记录列表；位置只在各自联合分支内读取。 */
const locationLabel = (location: ReadingLocation) =>
  'pageIndex' in location
    ? `第 ${location.pageIndex + 1} 页`
    : `章节 ${location.sectionId} · 字符 ${location.start}${location.end === location.start ? '' : `–${location.end}`}`;

/** 更正草稿保存编辑body和读取时的revision及原记录，刷新后仍按原修订提交。 */
type EditDraft = { revision: number; body: string; record: ReadingRecord };
/** 新笔记草稿保存稳定recordId与后续输入；pending表示创建回执未知。 */
type NoteDraft = {
  recordId: string;
  body: string;
  capture?: BusinessParams<'library.saveReadingRecord'>;
  pending?: BusinessParams<'library.saveReadingRecord'>;
};
type Editing = EditDraft & { id: string };

function readEditDraft(key: string): EditDraft | undefined {
  try {
    const value = JSON.parse(readDraft(key) || 'null') as Partial<EditDraft> | null;
    if (!value || typeof value !== 'object') return undefined;
    if (typeof value.revision !== 'number' || typeof value.body !== 'string') return undefined;
    if (!value.record || typeof value.record.id !== 'string') return undefined;
    return { revision: value.revision, body: value.body, record: value.record };
  } catch {
    return undefined;
  }
}

function readNoteDraft(key: string): NoteDraft | undefined {
  try {
    const value = JSON.parse(readDraft(key) || 'null') as Partial<NoteDraft> | null;
    if (!value || typeof value !== 'object') return undefined;
    if (typeof value.recordId !== 'string' || !value.recordId) return undefined;
    if (typeof value.body !== 'string') return undefined;
    return {
      recordId: value.recordId,
      body: value.body,
      ...(value.capture && validateBusiness('library.saveReadingRecord', 'params', value.capture)
        ? { capture: value.capture }
        : {}),
      ...(value.pending && validateBusiness('library.saveReadingRecord', 'params', value.pending)
        ? { pending: value.pending }
        : {}),
    };
  } catch {
    return undefined;
  }
}

export function prepareReadingRecord(
  adapter: ReadingRecordAdapter,
  evidence: Pick<ReadingRecord, 'kind' | 'quote' | 'location'>,
): void {
  const key = draftKey(
    adapter.directory,
    'library',
    'reading-record',
    adapter.attachment.id,
    adapter.attachment.materialVersionId,
    'note',
  );
  const note = readNoteDraft(key) ?? { recordId: crypto.randomUUID(), body: '' };
  if (note.pending) throw new Error('请先核查待确认的保存结果。');
  const capture = {
    recordId: note.recordId,
    attachmentId: adapter.attachment.id,
    materialVersionId: adapter.attachment.materialVersionId,
    ...evidence,
    body: note.body,
  };
  if (!validateBusiness('library.saveReadingRecord', 'params', capture))
    throw new Error('选区超出记录范围，请缩小选区后重试。');
  writeDraft(key, JSON.stringify({ ...note, capture }));
}

/**
 * 所选附件的共同阅读记录：只列表当前材料，正文用 div/article 承载，不改动外层附件列表数量。
 * 新建仅覆盖整份材料的笔记；摘录、定位与类别在更正时只读，草稿按配置、附件、材料版本和记录身份保存。
 */
export function ReadingRecordsPanel({
  materialAvailable: available,
  adapter: suppliedAdapter,
  client,
  enabled,
  readable,
  writable,
  attachment,
  tick,
  onRecords,
  onLocate,
}: {
  materialAvailable?: boolean;
  adapter?: ReadingRecordAdapter;
  client?: KernelClient;
  enabled: boolean;
  readable?: boolean;
  writable?: boolean;
  attachment?: LibraryAttachment;
  tick?: number;
  onRecords?: ((records: ReadingRecord[]) => void) | undefined;
  onLocate?: ((record: ReadingRecord) => void) | undefined;
}) {
  const legacyAdapter = useMemo(
    () => (client && attachment ? createReadingRecordAdapter(client, attachment) : undefined),
    [client, attachment],
  );
  const adapter = suppliedAdapter ?? legacyAdapter;
  const material = adapter?.attachment;
  const directory = adapter?.directory ?? '';
  const attachmentId = material?.id ?? '';
  const materialVersionId = material?.materialVersionId ?? '';
  const recordPort = adapter?.port;
  const [grant, setGrant] = useState({ read: false, write: false });
  const [accessTick, setAccessTick] = useState(0);
  useEffect(() => {
    if (!adapter || !enabled) {
      setGrant({ read: false, write: false });
      return;
    }
    let live = true;
    const refresh = () => {
      setGrant({ read: false, write: false });
      void adapter.status().then(
        (value) => {
          if (live) setGrant(value);
        },
        () => {
          if (live) setGrant({ read: false, write: false });
        },
      );
    };
    refresh();
    const unsubscribe = adapter.subscribe(() => {
      setAccessTick((value) => value + 1);
      refresh();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [adapter, enabled]);
  const active = enabled && !!adapter && grant.read && (readable ?? true);
  const writableAccess = grant.write && (writable ?? true);
  const materialKey = `${attachmentId}:${materialVersionId}`;
  const materialAvailable = available ?? material?.state === 'available';
  /** 只有可读且启用时才请求；tick 只触发重读同一材料，不重置编辑草稿。 */

  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  const [paging, setPaging] = useState<{ material: string; offsets: number[] }>({
    material: materialKey,
    offsets: [0],
  });
  const offsets = paging.material === materialKey ? paging.offsets : [0];
  const offset = offsets.at(-1) ?? 0;

  const [received, setReceived] = useState<{
    identity: string;
    records?: ReadingRecord[];
    nextOffset?: number;
    error?: string;
  }>();
  // 材料与分页构成画面身份；键变化后旧的迟到结果不回写。
  const identity = `${materialKey}:${offset}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick和reload显式刷新当前材料页，保留草稿。
  useEffect(() => {
    if (!active || !recordPort) return;
    let live = true;
    void recordPort['library.readingRecords']({
      attachmentId,
      materialVersionId,
      offset,
      limit: PAGE,
    }).then(
      (value) => {
        if (!live) return;
        setReceived({
          identity,
          records: value.records,
          ...(value.nextOffset === undefined ? {} : { nextOffset: value.nextOffset }),
        });
      },
      (reason: unknown) => {
        if (live) setReceived({ identity, error: messageOf(reason) });
      },
    );
    return () => {
      live = false;
    };
  }, [
    recordPort,
    active,
    attachmentId,
    materialVersionId,
    offset,
    identity,
    tick,
    accessTick,
    reload,
  ]);

  const current = active && received?.identity === identity ? received : undefined;
  const records = current?.records ?? [];
  useEffect(() => {
    onRecords?.(current?.records ?? []);
  }, [current, onRecords]);

  const [editing, setEditing] = useState<Editing>();
  const editingRef = useRef<Editing | undefined>(undefined);
  editingRef.current = editing;
  const [note, setNote] = useState<NoteDraft>();

  const draftFor = (recordId: string) =>
    draftKey(directory, 'library', 'reading-record', attachmentId, materialVersionId, recordId);
  const noteDraftKey = draftFor('note');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const updateNote = (value: NoteDraft) => {
    writeDraft(noteDraftKey, JSON.stringify(value));
  };
  const updateEdit = (value: Editing) => {
    writeDraft(draftFor(value.id), JSON.stringify(value));
    if (mounted.current) {
      editingRef.current = value;
      setEditing(value);
    }
  };

  // 按配置、附件与材料版本读取该对象的笔记草稿，保留稳定recordId与后续输入。
  useEffect(() => {
    const sync = () =>
      setNote(readNoteDraft(noteDraftKey) ?? { recordId: crypto.randomUUID(), body: '' });
    sync();
    return subscribeDraft(noteDraftKey, sync);
  }, [noteDraftKey]);

  const editingKey = editing ? draftFor(editing.id) : '';
  useEffect(() => {
    if (!editingKey) return;
    return subscribeDraft(editingKey, () => {
      const saved = readEditDraft(editingKey);
      setEditing(saved ? { ...saved, id: saved.record.id } : undefined);
    });
  }, [editingKey]);

  const [history, setHistory] = useState<{ recordId: string; offsets: number[] }>();
  const historyRecordId = history?.recordId ?? '';
  const historyOffsets = history?.offsets ?? [0];
  const historyOffset = historyOffsets.at(-1) ?? 0;
  const [historyReceived, setHistoryReceived] = useState<{
    identity: string;
    records?: ReadingRecord[];
    nextOffset?: number;
    error?: string;
  }>();
  const historyIdentity = `${historyRecordId}:${historyOffset}`;

  // 历史只在用户明确点击后读取当前记录，不随列表刷新扩大查询。
  useEffect(() => {
    if (!active || !historyRecordId || !recordPort) return;
    let live = true;
    void recordPort['library.readingHistory']({
      recordId: historyRecordId,
      offset: historyOffset,
      limit: PAGE,
    }).then(
      (value) => {
        if (!live) return;
        setHistoryReceived({
          identity: historyIdentity,
          records: value.records,
          ...(value.nextOffset === undefined ? {} : { nextOffset: value.nextOffset }),
        });
      },
      (reason: unknown) => {
        if (live) setHistoryReceived({ identity: historyIdentity, error: messageOf(reason) });
      },
    );
    return () => {
      live = false;
    };
  }, [recordPort, active, historyRecordId, historyOffset, historyIdentity]);

  const currentHistory =
    active && historyReceived?.identity === historyIdentity ? historyReceived : undefined;

  const runRecord = (token: string, action: () => Promise<void>) => {
    if (busy || !active || !recordPort) return;
    setBusy(token);
    setActionError('');
    void action()
      .catch((reason: unknown) => {
        if (mounted.current) setActionError(messageOf(reason));
      })
      .finally(() => {
        if (mounted.current) setBusy('');
      });
  };

  const openEdit = (record: ReadingRecord) => {
    setActionError('');
    const saved = readEditDraft(draftFor(record.id));
    updateEdit(
      saved && saved.record.id === record.id
        ? { id: record.id, body: saved.body, revision: saved.revision, record: saved.record }
        : { id: record.id, body: record.body, revision: record.revision, record },
    );
  };

  const cancelEdit = () => {
    if (editing) writeDraft(draftFor(editing.id), '');
    setEditing(undefined);
  };

  const saveEdit = () => {
    const started = editing;
    const port = recordPort;
    if (!started || busy || !port) return;
    const submitted = started.body;
    runRecord(started.id, async () => {
      const updated = await port['library.saveReadingRecord']({
        recordId: started.record.id,
        attachmentId: started.record.attachmentId,
        materialVersionId: started.record.materialVersionId,
        kind: started.record.kind,
        quote: started.record.quote,
        ...(started.record.location ? { location: started.record.location } : {}),
        body: submitted,
        expectedRevision: started.revision,
      });
      const live = readEditDraft(draftFor(updated.id));
      if (!live) return;
      if (live.body === submitted) {
        // 等待期间没有新输入：草稿已保存，关闭编辑。
        writeDraft(draftFor(updated.id), '');
        if (mounted.current && editingRef.current?.id === updated.id) setEditing(undefined);
      } else {
        // 保留等待期间的新输入，只同步已保存修订。
        const value = { ...live, id: updated.id, revision: updated.revision, record: updated };
        writeDraft(draftFor(updated.id), JSON.stringify(value));
        if (mounted.current && editingRef.current?.id === updated.id) setEditing(value);
      }
      if (mounted.current) setReload((value) => value + 1);
    });
  };

  const reloadEdit = () => {
    const started = editing;
    const port = recordPort;
    if (!started || !port) return;
    runRecord(started.id, async () => {
      const record = await port['library.readingRecord']({ recordId: started.id });
      const live = readEditDraft(draftFor(record.id));
      if (live) updateEdit({ id: record.id, body: live.body, revision: record.revision, record });
      if (mounted.current) setReload((value) => value + 1);
    });
  };

  const removeRecord = (record: ReadingRecord) => {
    const port = recordPort;
    if (!port) return;
    const draft = readEditDraft(draftFor(record.id));
    const expectedRevision =
      editing?.id === record.id
        ? editing.revision
        : draft && draft.record.id === record.id
          ? draft.revision
          : record.revision;
    runRecord(record.id, async () => {
      await port['library.removeReadingRecord']({
        recordId: record.id,
        expectedRevision,
      });
      writeDraft(draftFor(record.id), '');
      if (mounted.current && editingRef.current?.id === record.id) setEditing(undefined);
      if (mounted.current) setReload((value) => value + 1);
    });
  };

  const saveNote = (retry = false) => {
    const started = note;
    const port = recordPort;
    if (!started || !active || !port || !writableAccess || busy || (!retry && started.pending))
      return;
    const input = retry
      ? started.pending
      : started.capture
        ? { ...started.capture, body: started.body }
        : {
            recordId: started.recordId,
            attachmentId,
            materialVersionId,
            kind: 'note' as const,
            quote: '',
            body: started.body,
          };
    if (!input || (input.kind === 'note' && !input.body.trim())) return;
    const submitted = input.body;
    const recordId = started.recordId;
    updateNote({ ...started, pending: input });
    setBusy('note');
    setActionError('');
    void port['library.saveReadingRecord'](input)
      .then(
        () => {
          const live = readNoteDraft(noteDraftKey);
          if (live && live.recordId === recordId) {
            updateNote({
              recordId: crypto.randomUUID(),
              body: live.body === submitted ? '' : live.body,
            });
          }
          if (mounted.current) setReload((value) => value + 1);
        },
        (reason: unknown) => {
          if (mounted.current) setActionError(messageOf(reason));
          // 确认失败可继续编辑；未知结果保留发送前持久化的原输入。
          if (
            ['invalidRequest', 'tooLarge', 'permissionDenied', 'notFound'].includes(
              codeOf(reason) ?? '',
            )
          ) {
            const live = readNoteDraft(noteDraftKey);
            if (live?.recordId === recordId) {
              const { pending: _pending, ...draft } = live;
              updateNote(draft);
            }
          }
        },
      )
      .finally(() => {
        if (mounted.current) setBusy('');
      });
  };

  const checkNote = () => {
    const started = note;
    const port = recordPort;
    if (!started || busy || !port) return;
    const recordId = started.recordId;
    setBusy('note');
    setActionError('');
    void port['library.readingRecord']({ recordId })
      .then(
        (record) => {
          // 已创建：只同步已保存修订，保留后续输入。
          const live = readNoteDraft(noteDraftKey);
          if (live?.recordId === recordId) {
            if (record.deleted) {
              updateNote({ recordId: crypto.randomUUID(), body: live.body });
            } else if (live.body === started.pending?.body) {
              updateNote({ recordId: crypto.randomUUID(), body: '' });
            } else updateNote({ recordId: crypto.randomUUID(), body: live.body });
          }
          if (mounted.current) setReload((value) => value + 1);
        },
        (reason: unknown) => {
          if (mounted.current) setActionError(messageOf(reason));
          // 未查到也保留原提交输入：原请求仍可能迟到。
        },
      )
      .finally(() => {
        if (mounted.current) setBusy('');
      });
  };

  return (
    <section className="project-controls" aria-label="阅读记录">
      {actionError ? (
        <p className="business-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {current?.error ? (
        <p className="business-error" role="alert">
          {current.error}
        </p>
      ) : null}

      <div>
        {active && note?.capture ? (
          <p role="status">
            待保存{KIND_LABEL[note.capture.kind]}
            {note.capture.location ? ` · ${locationLabel(note.capture.location)}` : ''}
            {note.capture.quote ? ` · ${note.capture.quote}` : ''}
          </p>
        ) : null}
        <label>
          新文献笔记
          <textarea
            className="composer-input"
            aria-label="新文献笔记"
            rows={3}
            spellCheck={false}
            disabled={!active || !writableAccess}
            value={note?.body ?? ''}
            onChange={(event) => note && updateNote({ ...note, body: event.target.value })}
          />
        </label>
        <div className="file-view-controls">
          <button
            type="button"
            className="btn"
            aria-busy={busy === 'note'}
            disabled={
              !active ||
              !writableAccess ||
              !materialAvailable ||
              !!busy ||
              !!note?.pending ||
              (!note?.capture && !note?.body.trim())
            }
            onClick={() => saveNote()}
          >
            {note?.capture ? `保存${KIND_LABEL[note.capture.kind]}` : '保存文献笔记'}
          </button>
          {note?.capture && !note.pending ? (
            <button
              type="button"
              className="btn"
              disabled={!!busy}
              onClick={() => updateNote({ recordId: note.recordId, body: note.body })}
            >
              改为独立笔记
            </button>
          ) : null}
          {note?.pending ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={!active || !!busy}
                onClick={checkNote}
              >
                核查笔记保存结果
              </button>
              <button
                type="button"
                className="btn"
                disabled={!active || !writableAccess || !materialAvailable || !!busy}
                onClick={() => saveNote(true)}
              >
                按原输入重试保存笔记
              </button>
            </>
          ) : null}
        </div>
        {materialAvailable || !active ? null : (
          <p className="empty-hint">
            材料当前
            {material?.state === 'available'
              ? '暂不可读取'
              : MATERIAL_LABEL[material?.state ?? 'unavailable']}
            ，暂不能新建文献笔记；已有记录仍可查看和更正说明。
          </p>
        )}
      </div>

      {!current ? (
        <p className="empty-hint">{active ? '正在读取阅读记录…' : '需先授权库读取。'}</p>
      ) : null}
      {current && !records.length ? <p className="empty-hint">该材料还没有阅读记录</p> : null}

      <div>
        {records.map((record) => {
          const creator = authorLabel(record.createdBy);
          const updater = authorLabel(record.updatedBy);
          const open = editing?.id === record.id ? editing : undefined;
          return (
            <article key={record.id}>
              <div>
                {KIND_LABEL[record.kind]} · {creator}
                {updater === creator ? '' : ` · 更新者 ${updater}`}
                {record.location ? ` · ${locationLabel(record.location)}` : ''}
              </div>
              {record.quote ? <blockquote>{record.quote}</blockquote> : null}
              {record.body ? <p>{record.body}</p> : null}
              <div className="file-view-controls">
                {onLocate && record.location ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={!active || !materialAvailable}
                    onClick={() => onLocate(record)}
                  >
                    定位{locationLabel(record.location)}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  aria-label={`编辑阅读记录 ${record.id}`}
                  disabled={!active || open !== undefined || !!busy}
                  onClick={() => openEdit(record)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`移除阅读记录 ${record.id}`}
                  disabled={!active || !writableAccess || !!busy}
                  onClick={() => removeRecord(record)}
                >
                  移除
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={`查看阅读记录历史 ${record.id}`}
                  disabled={!active}
                  onClick={() =>
                    setHistory((live) =>
                      live?.recordId === record.id
                        ? undefined
                        : { recordId: record.id, offsets: [0] },
                    )
                  }
                >
                  查看历史
                </button>
              </div>

              {open ? (
                <div>
                  <label>
                    阅读记录说明
                    <textarea
                      className="composer-input"
                      aria-label="阅读记录说明"
                      rows={3}
                      spellCheck={false}
                      disabled={!active || !writableAccess}
                      value={open.body}
                      onChange={(event) =>
                        editing && updateEdit({ ...editing, body: event.target.value })
                      }
                    />
                  </label>
                  <div className="file-view-controls">
                    <button
                      type="button"
                      className="btn"
                      aria-busy={busy === record.id}
                      disabled={
                        !active ||
                        !writableAccess ||
                        !!busy ||
                        (record.kind === 'note' && !open.body.trim())
                      }
                      onClick={saveEdit}
                    >
                      保存阅读记录
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!active || !!busy}
                      onClick={reloadEdit}
                    >
                      重新读取阅读记录
                    </button>
                    <button type="button" className="btn" disabled={!!busy} onClick={cancelEdit}>
                      取消编辑阅读记录
                    </button>
                  </div>
                </div>
              ) : null}

              {historyRecordId === record.id ? (
                <section aria-label="阅读记录历史">
                  {currentHistory?.error ? (
                    <p className="business-error" role="alert">
                      {currentHistory.error}
                    </p>
                  ) : null}
                  {currentHistory ? null : <p className="empty-hint">正在读取阅读历史…</p>}
                  {(currentHistory?.records ?? []).map((old) => (
                    <div key={`${old.id}:${old.revision}`}>
                      修订 {old.revision} · {authorLabel(old.updatedBy)}
                      {old.body ? <p>{old.body}</p> : null}
                    </div>
                  ))}
                  <div className="file-view-controls">
                    <button
                      type="button"
                      className="btn"
                      disabled={!active || historyOffsets.length < 2}
                      onClick={() =>
                        setHistory((live) =>
                          live && live.recordId === record.id
                            ? { ...live, offsets: live.offsets.slice(0, -1) }
                            : live,
                        )
                      }
                    >
                      上一页历史
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!active || currentHistory?.nextOffset === undefined}
                      onClick={() => {
                        const next = currentHistory?.nextOffset;
                        if (next === undefined) return;
                        setHistory((live) =>
                          live && live.recordId === record.id
                            ? { ...live, offsets: [...live.offsets, next] }
                            : live,
                        );
                      }}
                    >
                      下一页历史
                    </button>
                  </div>
                </section>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="file-view-controls">
        <button
          type="button"
          className="btn"
          disabled={!active || offsets.length < 2}
          onClick={() => setPaging({ material: materialKey, offsets: offsets.slice(0, -1) })}
        >
          上一页记录
        </button>
        <button
          type="button"
          className="btn"
          disabled={!active || current?.nextOffset === undefined}
          onClick={() => {
            const next = current?.nextOffset;
            if (next !== undefined)
              setPaging({ material: materialKey, offsets: [...offsets, next] });
          }}
        >
          下一页记录
        </button>
      </div>
    </section>
  );
}
