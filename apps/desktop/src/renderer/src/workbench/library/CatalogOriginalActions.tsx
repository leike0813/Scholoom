import { type KernelClient, KernelClientError } from '@scholoom/client';
import { cslMetadataSchema, validateBusiness } from '@scholoom/protocol';
import type { ZoteroInputs, ZoteroInspection, ZoteroOutputs } from '@scholoom/protocol/zotero';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { draftKey, readDraft, subscribeDraft, writeDraft } from '../drafts';
import { librarySaves } from './library-state';

type Intent = { title?: string; pending?: ZoteroInputs['zotero.replaceTitle'] };
type Receipt = ZoteroOutputs['zotero.result'];

export function CatalogOriginalActions({
  client,
  scope,
  libraryId,
  sourceId,
  revision,
  single,
  readable,
  writable,
  onCommitted,
}: {
  client: KernelClient;
  scope: string;
  libraryId: string;
  sourceId: string;
  revision: number;
  single: boolean;
  readable: boolean;
  writable: boolean;
  onCommitted: () => void;
}) {
  const key = draftKey(scope, 'original-title', sourceId);
  const subscribe = useCallback((listener: () => void) => subscribeDraft(key, listener), [key]);
  const text = useSyncExternalStore(subscribe, () => readDraft(key));
  const busy = useSyncExternalStore(librarySaves.subscribe, () => librarySaves.has(key));
  const [inspection, setInspection] = useState<ZoteroInspection>();
  const [preview, setPreview] = useState(false);
  const [adopt, setAdopt] = useState(false);
  const [format, setFormat] = useState<'bibtex' | 'biblatex'>('bibtex');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(true);
  const basis = useMemo(() => ({ revision, single, readable }), [revision, single, readable]);
  const current = useRef(basis);
  current.current = basis;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  // Confirmation and output belong to the inspected revision and current selection only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these inputs invalidate explicit user confirmation.
  useEffect(() => {
    setPreview(false);
    setAdopt(false);
    setOutput('');
  }, [revision, single, readable]);

  let intent: Intent = {};
  let damaged = false;
  try {
    intent = text ? JSON.parse(text) : {};
    if (
      !intent ||
      typeof intent !== 'object' ||
      Array.isArray(intent) ||
      (intent.title !== undefined && typeof intent.title !== 'string') ||
      (intent.pending !== undefined &&
        (!validateBusiness('zotero.replaceTitle', 'params', intent.pending) ||
          intent.pending.libraryId !== libraryId ||
          intent.pending.sourceId !== sourceId))
    )
      throw new Error();
  } catch {
    damaged = true;
    intent = {};
  }
  const title = intent.title ?? String(inspection?.original.fields.title ?? '');
  const fresh = inspection?.sourceId === sourceId && inspection.revision === revision;
  const relevant = () =>
    active.current && current.current === basis && basis.readable && basis.single;
  const problem = (reason: unknown) =>
    reason instanceof KernelClientError
      ? `${reason.code}：${reason.message}`
      : reason instanceof Error
        ? reason.message
        : '操作结果未确认，请核查原操作。';
  const store = (next: Intent) => writeDraft(key, JSON.stringify(next));
  const settle = (requestId: string, receipt: Receipt) => {
    if (receipt.requestId !== requestId) return;
    if (receipt.state === 'notFound') {
      if (active.current) setNotice('尚未查到确定结果；保留原操作，请继续核查，不重新提交。');
      return;
    }
    const stored: Intent = JSON.parse(readDraft(key) || '{}');
    if (stored.pending?.requestId !== requestId) return;
    store({ title: stored.title ?? stored.pending.title });
    if (active.current) {
      setPreview(false);
      setAdopt(false);
      setOutput('');
      setNotice(
        receipt.state === 'committed'
          ? '原值题名已保存，CSL草稿保留。'
          : '原值更正被拒绝，输入保留。',
      );
      setError(receipt.error ? `${receipt.error.code}：${receipt.error.message}` : '');
      if (receipt.state === 'committed') onCommitted();
    }
  };

  const inspect = async () => {
    if (librarySaves.has(key)) return;
    librarySaves.set(key, true);
    setError('');
    setPreview(false);
    setAdopt(false);
    setOutput('');
    try {
      const result = await client.call('zotero.inspect', {
        libraryId,
        sources: [{ sourceId, revision }],
      });
      if (relevant()) setInspection(result.sources[0]);
    } catch (reason) {
      if (relevant()) setError(problem(reason));
    } finally {
      librarySaves.set(key, false);
    }
  };
  const submit = async () => {
    if (!inspection || !fresh || !preview || !writable || intent.pending || librarySaves.has(key))
      return;
    const request: ZoteroInputs['zotero.replaceTitle'] = {
      libraryId,
      requestId: crypto.randomUUID(),
      sourceId,
      revision: inspection.revision,
      identity: inspection.original.identity,
      title,
    };
    store({ title, pending: request });
    librarySaves.set(key, true);
    setError('');
    setNotice('正在提交原值题名…');
    setAdopt(false);
    setOutput('');
    try {
      settle(request.requestId, (await client.call('zotero.replaceTitle', request)).receipt);
    } catch (reason) {
      // contentChanged is raised before commit; unknown outcomes retain their frozen request.
      if (reason instanceof KernelClientError && reason.code === 'contentChanged') {
        store({ title: request.title });
        if (active.current) setPreview(false);
      }
      if (active.current) {
        setError(problem(reason));
        setNotice('原输入已保留，请核对当前原值及原操作结果。');
      }
    } finally {
      librarySaves.set(key, false);
    }
  };
  const query = async () => {
    const request = intent.pending;
    if (!request || librarySaves.has(key)) return;
    librarySaves.set(key, true);
    setError('');
    try {
      settle(
        request.requestId,
        await client.call('zotero.result', { libraryId, requestId: request.requestId }),
      );
    } catch (reason) {
      if (active.current) setError(problem(reason));
    } finally {
      librarySaves.set(key, false);
    }
  };
  const exportOriginal = async () => {
    if (!inspection || !fresh || !adopt || intent.pending || librarySaves.has(key)) return;
    librarySaves.set(key, true);
    setOutput('');
    setError('');
    try {
      const result = await client.call('zotero.export', {
        libraryId,
        sources: [
          {
            sourceId,
            revision,
            expression: { kind: 'zotero-original', identity: inspection.original.identity },
          },
        ],
        format,
      });
      if (!relevant()) return;
      if (result.state === 'exported') setOutput(result.text);
      else {
        setInspection(result.sources[0]);
        setAdopt(false);
      }
    } catch (reason) {
      if (relevant()) {
        setAdopt(false);
        setError(problem(reason));
      }
    } finally {
      librarySaves.set(key, false);
    }
  };

  return (
    <details>
      <summary>原值与导出</summary>
      {!single ? (
        <p>请选择单条题录核对原值。</p>
      ) : !readable ? (
        <p>当前原值不可读取。</p>
      ) : damaged ? (
        <p role="alert">原值操作草稿无法核对，请保留并检查原草稿，暂不重新提交。</p>
      ) : (
        <fieldset className="project-controls" disabled={busy}>
          <button type="button" className="btn" onClick={() => void inspect()}>
            核对所选原值
          </button>
          {error && (
            <p className="business-error" role="alert">
              {error}
            </p>
          )}
          <p role="status" aria-label="原值操作状态">
            {notice}
          </p>
          {intent.pending && (
            <>
              <p>
                待核查操作 {intent.pending.requestId} · 原值题名 {intent.pending.title}
              </p>
              <button type="button" className="btn" onClick={() => void query()}>
                核查原值更正结果
              </button>
            </>
          )}
          {inspection && (
            <>
              <p>
                修订号 {inspection.revision} · 来源 {inspection.original.identity.instanceId} /{' '}
                {inspection.original.identity.libraryLocator} /{' '}
                {inspection.original.identity.objectKey}
              </p>
              <p>
                题名{inspection.comparison.title === 'equal' ? '相同' : '不同'}；其他属性无法比较。
              </p>
              {!fresh && <p role="status">修订已变化，请重新核对；原输入及CSL草稿保留。</p>}
              <label>
                已保存 CSL 核对
                <textarea
                  className="composer-input"
                  aria-label="已保存 CSL 核对"
                  rows={4}
                  readOnly
                  value={JSON.stringify(inspection.csl, null, 2)}
                />
              </label>
              <label>
                所选原值核对
                <textarea
                  className="composer-input"
                  aria-label="所选原值核对"
                  rows={4}
                  readOnly
                  value={JSON.stringify(inspection.original, null, 2)}
                />
              </label>
              <label>
                原值题名更正
                <input
                  aria-label="原值题名更正"
                  value={title}
                  disabled={!writable || !!intent.pending}
                  onChange={(event) => {
                    store({ title: event.target.value });
                    setPreview(false);
                    setAdopt(false);
                    setOutput('');
                  }}
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={
                  !fresh ||
                  !writable ||
                  !!intent.pending ||
                  !title.length ||
                  title.length > cslMetadataSchema.properties.title.maxLength
                }
                onClick={() => setPreview(true)}
              >
                预览原值题名更正
              </button>
              {preview && fresh && (
                <fieldset aria-label="原值题名更正预览">
                  <p>原题名：{String(inspection.original.fields.title)}</p>
                  <p>新题名：{title}</p>
                  <p>仅更正所示来源的题名；未保存CSL草稿保留。</p>
                  <button
                    type="button"
                    className="btn"
                    disabled={!writable || !!intent.pending}
                    onClick={() => void submit()}
                  >
                    提交原值题名更正
                  </button>
                </fieldset>
              )}
              <label>
                原值导出格式
                <select
                  aria-label="原值导出格式"
                  value={format}
                  onChange={(event) => {
                    setFormat(event.target.value as 'bibtex' | 'biblatex');
                    setAdopt(false);
                    setOutput('');
                  }}
                >
                  <option value="bibtex">BibTeX</option>
                  <option value="biblatex">BibLaTeX</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  aria-label="采用所示原值导出"
                  checked={fresh && adopt}
                  disabled={!fresh || !!intent.pending}
                  onChange={(event) => {
                    setAdopt(event.target.checked);
                    setOutput('');
                  }}
                />
                采用所示原值导出
              </label>
              <button
                type="button"
                className="btn"
                disabled={!fresh || !adopt || !!intent.pending}
                onClick={() => void exportOriginal()}
              >
                导出所选原值
              </button>
              {fresh && output && (
                <label>
                  原值导出文本
                  <textarea
                    className="composer-input"
                    aria-label="原值导出文本"
                    rows={8}
                    readOnly
                    value={output}
                  />
                </label>
              )}
            </>
          )}
        </fieldset>
      )}
    </details>
  );
}
