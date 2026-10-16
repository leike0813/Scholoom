import type { KernelClient } from '@scholoom/client';
import type { LibraryAttachment, LibraryBatch } from '@scholoom/protocol';
import { useEffect, useRef, useState } from 'react';
import { ReadingRecordsPanel } from './ReadingRecordsPanel';

const PAGE = 25;
/** 与协议 library.readAttachment 的分段上限一致：一次下载只读取有界片段。 */
const SEGMENT = 262144;
/** 与单份材料摄取上限一致，避免把整库材料读入内存。 */
const DOWNLOAD_LIMIT = 128 * 1024 * 1024;
const PURPOSES = ['正文', '补充材料'] as const;
const ATTACHMENT_STATE: Record<LibraryAttachment['state'], { label: string; pill: string }> = {
  available: { label: '可读', pill: 'pill--run' },
  missing: { label: '缺失', pill: 'pill--idle' },
  changed: { label: '内容已变', pill: 'pill--idle' },
  unavailable: { label: '不可用', pill: 'pill--idle' },
};
const MANAGE_HINT = '每行一份本机绝对路径，最多 100 份；按文件名建立待核对题录，外链只登记原位置。';
const ATTACH_HINT = '每行一份本机绝对路径，最多 100 份；附件加入当前题录，外链只登记原位置。';

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请核对当前状态。';
const pathsOf = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
const bytesOfBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

/**
 * 本机路径摄取表单：不指定题录时按文件名建立待核对候选，指定题录时为其添加附件。
 * 批次回执交给调用方接入既有批次结果区。
 */
export function AttachmentImport({
  client,
  enabled,
  writable,
  sourceId,
  onBatch,
}: {
  client: KernelClient;
  enabled: boolean;
  writable: boolean;
  sourceId?: string;
  onBatch: (batch: LibraryBatch) => void;
}) {
  const [paths, setPaths] = useState('');
  const [purpose, setPurpose] = useState<string>(PURPOSES[0]);
  const [storage, setStorage] = useState<'managed' | 'linked'>('managed');
  const [version, setVersion] = useState('unspecified');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latestPaths = useRef(paths);
  latestPaths.current = paths;

  const submit = () => {
    const submitted = paths;
    setError('');
    setBusy(true);
    void (async () => {
      const list = pathsOf(submitted);
      if (!list.length) throw new Error('请先填写本机文件路径。');
      if (list.length > 100) throw new Error('一批最多摄取 100 份文件。');
      const batch = await client.call('library.importFiles', {
        batchId: crypto.randomUUID(),
        paths: list,
        purpose,
        storage,
        version: version.trim() || 'unspecified',
        origin: 'workbench-files',
        ...(sourceId ? { sourceId } : {}),
      });
      onBatch(batch);
      // 迟到回执只清空未再编辑的输入，等待期间的新输入保留。
      if (latestPaths.current === submitted) setPaths('');
    })()
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      {error ? (
        <p className="business-error" role="alert">
          {error}
        </p>
      ) : null}
      <label>
        本机文件路径
        <textarea
          className="composer-input"
          aria-label="本机文件路径"
          rows={4}
          spellCheck={false}
          value={paths}
          onChange={(event) => setPaths(event.target.value)}
        />
      </label>
      <label>
        附件用途
        <select
          aria-label="附件用途"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        >
          {PURPOSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        托管方式
        <select
          aria-label="托管方式"
          value={storage}
          onChange={(event) => setStorage(event.target.value === 'linked' ? 'linked' : 'managed')}
        >
          <option value="managed">托管副本（复制入库）</option>
          <option value="linked">外链原件（只登记位置）</option>
        </select>
      </label>
      {sourceId ? null : (
        <label>
          版本标签
          <input
            aria-label="附件版本标签"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
        </label>
      )}
      <p>{sourceId ? ATTACH_HINT : MANAGE_HINT}</p>
      <button
        type="button"
        className="btn"
        disabled={!enabled || !writable || busy || !paths.trim()}
        onClick={submit}
      >
        {sourceId ? '添加附件' : '导入文件批次'}
      </button>
    </>
  );
}

/**
 * 所选题录的附件分页：登记只是登记，实际状态只来自有界附件请求；
 * 下载仅在用户点击后逐段读取，不随浏览加载全文。
 */
export function AttachmentsPanel({
  client,
  enabled,
  readable,
  writable,
  sourceId,
  tick,
  onBatch,
  onOpenPdf,
}: {
  client: KernelClient;
  enabled: boolean;
  readable: boolean;
  writable: boolean;
  sourceId: string;
  tick: number;
  onBatch: (batch: LibraryBatch) => void;
  onOpenPdf?: ((material: LibraryAttachment) => void) | undefined;
}) {
  const [paging, setPaging] = useState<{ sourceId: string; offsets: number[] }>({
    sourceId,
    offsets: [0],
  });
  const offsets = paging.sourceId === sourceId ? paging.offsets : [0];
  const offset = offsets.at(-1) ?? 0;
  const [reload, setReload] = useState(0);
  const [received, setReceived] = useState<{
    identity: string;
    attachments?: LibraryAttachment[];
    nextOffset?: number;
    error?: string;
  }>();
  const [busyId, setBusyId] = useState('');
  const [rowError, setRowError] = useState<{ id: string; message: string }>();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [recordsTarget, setRecordsTarget] = useState<{ sourceId: string; attachmentId: string }>();
  const urlRef = useRef('');
  const shownSource = useRef(sourceId);
  shownSource.current = sourceId;
  const live = useRef(true);
  /** 卸载或已切换题录后，迟到回执不再驱动当前画面或新下载。 */
  const stale = () => shownSource.current !== sourceId || !live.current;

  // 题录与分页构成画面身份；刷新沿用当前页，旧题录或旧页的迟到结果不回写。
  const identity = `${sourceId}:${offset}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 刷新只重读同一有界页面，保留当前列表。
  useEffect(() => {
    if (!readable) return;
    let active = true;
    void client.call('library.attachments', { sourceId, offset, limit: PAGE }).then(
      (value) => {
        if (!active) return;
        setReceived({
          identity,
          attachments: value.attachments,
          ...(value.nextOffset === undefined ? {} : { nextOffset: value.nextOffset }),
        });
      },
      (reason: unknown) => {
        if (active) setReceived({ identity, error: messageOf(reason) });
      },
    );
    return () => {
      active = false;
    };
  }, [client, readable, sourceId, offset, identity, tick, reload]);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    };
  }, []);

  const current = received?.identity === identity ? received : undefined;
  const attachments = current?.attachments ?? [];

  const release = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = '';
  };
  const run = (id: string, action: () => Promise<void>) => {
    setRowError(undefined);
    setBusyId(id);
    void action()
      .catch((reason: unknown) => setRowError({ id, message: messageOf(reason) }))
      .finally(() => setBusyId(''));
  };

  const download = (attachment: LibraryAttachment) =>
    run(attachment.id, async () => {
      const parts: BlobPart[] = [];
      let length = 0;
      let offset = 0;
      for (;;) {
        // 已切换题录或卸载时停止读取，也不再启动新的下载。
        if (stale()) return;
        const page = await client.call('library.readAttachment', {
          attachmentId: attachment.id,
          offset,
          limit: SEGMENT,
        });
        if (stale()) return;
        if (page.materialVersionId !== attachment.materialVersionId)
          throw new Error('附件内容在下载期间变化，已保留原条目。');
        const chunk = bytesOfBase64(page.base64);
        length += chunk.length;
        if (length > DOWNLOAD_LIMIT) throw new Error('附件超过 128MiB 下载上限。');
        parts.push(chunk);
        const next = page.nextOffset;
        if (next === undefined) break;
        if (next <= offset) throw new Error('附件读取位置未推进，已停止下载。');
        offset = next;
      }
      release();
      const url = URL.createObjectURL(new Blob(parts, { type: 'application/octet-stream' }));
      urlRef.current = url;
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      link.click();
    });

  const relocate = (attachment: LibraryAttachment) =>
    run(attachment.id, async () => {
      const path = (targets[attachment.id] ?? '').trim();
      if (!path) throw new Error('请先填写外链的新本机路径。');
      await client.call('library.relocateAttachment', { attachmentId: attachment.id, path });
      if (!stale()) setReload((value) => value + 1);
    });

  return (
    <fieldset className="project-controls" disabled={!enabled}>
      {current?.error ? (
        <p className="business-error" role="alert">
          {current.error}
        </p>
      ) : null}
      {current ? null : (
        <p className="empty-hint">{readable ? '正在读取附件…' : '需先授权库读取。'}</p>
      )}
      {current && !attachments.length ? <p className="empty-hint">该题录还没有附件</p> : null}
      <ul>
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            {attachment.name} · {attachment.purpose} ·{' '}
            {attachment.storage === 'managed' ? '托管副本' : '外链原件'} · {attachment.byteLength}{' '}
            字节{' '}
            <span className={`pill ${ATTACHMENT_STATE[attachment.state].pill}`}>
              {ATTACHMENT_STATE[attachment.state].label}
            </span>
            {attachment.error ? ` · ${attachment.error.message}` : ''}
            <div className="file-view-controls">
              {onOpenPdf && attachment.name.toLowerCase().endsWith('.pdf') ? (
                <button
                  type="button"
                  className="btn"
                  aria-label={`打开 PDF ${attachment.name}`}
                  disabled={!readable}
                  onClick={() => onOpenPdf(attachment)}
                >
                  打开 PDF
                </button>
              ) : null}
              <button
                type="button"
                className="btn"
                aria-label={`下载 ${attachment.name}`}
                disabled={!readable || busyId === attachment.id}
                onClick={() => download(attachment)}
              >
                下载
              </button>
              <button
                type="button"
                className="btn"
                aria-label={`阅读记录 ${attachment.name}`}
                aria-expanded={
                  recordsTarget?.sourceId === sourceId &&
                  recordsTarget.attachmentId === attachment.id
                }
                disabled={!readable}
                onClick={() =>
                  setRecordsTarget((current) =>
                    current?.sourceId === sourceId && current.attachmentId === attachment.id
                      ? undefined
                      : { sourceId, attachmentId: attachment.id },
                  )
                }
              >
                阅读记录
              </button>
              {attachment.storage === 'linked' ? (
                <>
                  <label>
                    新路径
                    <input
                      aria-label={`新路径 ${attachment.name}`}
                      value={targets[attachment.id] ?? ''}
                      onChange={(event) =>
                        setTargets((chosen) => ({
                          ...chosen,
                          [attachment.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    aria-label={`重新定位 ${attachment.name}`}
                    disabled={!writable || busyId === attachment.id}
                    onClick={() => relocate(attachment)}
                  >
                    重新定位
                  </button>
                </>
              ) : null}
            </div>
            {rowError?.id === attachment.id ? (
              <p className="business-error" role="alert">
                {rowError.message}
              </p>
            ) : null}
            {recordsTarget?.sourceId === sourceId &&
            recordsTarget.attachmentId === attachment.id ? (
              <ReadingRecordsPanel
                key={`${client.getSnapshot().status?.dataDirectory}:${attachment.id}:${attachment.materialVersionId}`}
                client={client}
                enabled={enabled}
                readable={readable}
                writable={writable}
                attachment={attachment}
                tick={tick}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <div className="file-view-controls">
        <button
          type="button"
          className="btn"
          disabled={!readable}
          onClick={() => setReload((value) => value + 1)}
        >
          重新读取附件
        </button>
        <button
          type="button"
          className="btn"
          disabled={!readable || offsets.length < 2}
          onClick={() => setPaging({ sourceId, offsets: offsets.slice(0, -1) })}
        >
          上一页附件
        </button>
        <button
          type="button"
          className="btn"
          disabled={!readable || current?.nextOffset === undefined}
          onClick={() => {
            const next = current?.nextOffset;
            if (next !== undefined) setPaging({ sourceId, offsets: [...offsets, next] });
          }}
        >
          下一页附件
        </button>
      </div>
      <details>
        <summary>添加本地附件</summary>
        <AttachmentImport
          client={client}
          enabled={enabled}
          writable={writable}
          sourceId={sourceId}
          onBatch={onBatch}
        />
      </details>
    </fieldset>
  );
}
