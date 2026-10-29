import type { KernelClient } from '@scholoom/client';
import type { FileTransfer, RenderFormat, RenderJob, ResourceDescriptor } from '@scholoom/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useContextContribution } from '../context-contributions';
import { HtmlRenderView } from '../HtmlRenderView';
import { PdfReader, RenderedPdf } from '../PdfReader';
import { createResourcePort, sameResourceRef } from '../resource-controller';
import type { FileTarget } from '../session';
import { Dialog } from '../shell/dialog';
import { useFileWatch } from '../useFileWatch';
import { outputBytes } from './render-output';

const terminal = (job: RenderJob) => !['queued', 'running', 'cancelling'].includes(job.state);
const stateLabels: Record<RenderJob['state'], string> = {
  queued: '等待编译',
  running: '正在编译',
  completed: '编译完成',
  failed: '编译失败',
  cancelling: '正在取消',
  cancelled: '已取消',
  interrupted: '编译已中断',
  unknown: '编译结果待核查',
};
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function RenderPane({
  client,
  target,
  savedContent,
  dirty,
  enabled,
  viewId,
}: {
  client: KernelClient;
  target: FileTarget;
  savedContent: string;
  dirty: boolean;
  enabled: boolean;
  viewId?: string | undefined;
}) {
  const latex = /\.tex$/i.test(target.path);
  const [format, setFormat] = useState<RenderFormat>(latex ? 'pdf' : 'html');
  const [job, setJob] = useState<RenderJob>();
  const [tick, refresh] = useState(0);
  const [error, setError] = useState('');
  const [legacyPreview, setLegacyPreview] = useState<{ outputId: string; url: string }>();
  const port = useMemo(() => createResourcePort(client), [client]);
  const [preview, setPreview] = useState<{
    outputId: string;
    resource?: ResourceDescriptor;
    error?: string;
  }>();
  const [resourceAttempt, retryResource] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<RenderFormat>(latex ? 'pdf' : 'docx');
  const [destination, setDestination] = useState(
    target.path.replace(/\.[^.]+$/, latex ? '.pdf' : '.docx'),
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [transfer, setTransfer] = useState<FileTransfer>();
  const sequence = useRef(0);
  const activeJob = useRef<string | undefined>(undefined);
  const queued = useRef(false);
  const run = useRef<() => Promise<void>>(async () => {});
  const live = useRef(true);
  const latestOutput = job?.output ?? job?.lastSuccess;
  const [output, setOutput] = useState<RenderJob['output']>();
  const context = useContextContribution();
  const hasAnnotations = context.items.some(
    (item) =>
      item.ref.source === 'render' &&
      item.ref.projectId === target.projectId &&
      item.ref.outputId === output?.id,
  );
  useEffect(() => {
    if (latestOutput && (!output || latestOutput.format === 'html' || (!dirty && !hasAnnotations)))
      setOutput(latestOutput);
  }, [latestOutput, output, dirty, hasAnnotations]);
  const hasNewOutput =
    latestOutput && output && latestOutput.format !== 'html' && latestOutput.id !== output.id;
  const outputId = output?.id;
  const outputFormat = output?.format;
  const legacyPdf =
    output?.format === 'pdf' && (output.basis === undefined || output.input === undefined);
  useEffect(() => {
    if (
      !enabled ||
      !outputId ||
      !['pdf', 'html'].includes(outputFormat ?? '') ||
      legacyPdf ||
      preview?.resource
    )
      return;
    return port.subscribe(() => retryResource((value) => value + 1));
  }, [port, enabled, outputId, outputFormat, legacyPdf, preview?.resource]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 权限通知重试尚未打开的产物。
  useEffect(() => {
    let current = true;
    if (enabled && outputId && ['pdf', 'html'].includes(outputFormat ?? '') && !legacyPdf) {
      const locator = { source: 'render' as const, projectId: target.projectId, outputId };
      void port
        .describe(locator)
        .then((resource) => {
          if (!current) return;
          if (resource.format !== outputFormat || !sameResourceRef(resource.ref, locator))
            throw new Error('排版产物身份或格式不匹配。');
          setPreview({ outputId, resource });
        })
        .catch((reason: unknown) => {
          if (current) {
            setError(message(reason));
            setPreview((previous) =>
              previous?.resource ? previous : { outputId, error: message(reason) },
            );
          }
        });
    }
    return () => {
      current = false;
      port.cancelPending();
    };
  }, [port, target.projectId, outputId, outputFormat, legacyPdf, enabled, resourceAttempt]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      sequence.current++;
      if (activeJob.current && activeJob.current !== 'starting')
        void client
          .call('editor.cancel', { projectId: target.projectId, jobId: activeJob.current })
          .catch(() => {});
    };
  }, [client, target.projectId]);
  const waitJob = async (value: RenderJob, callback?: (value: RenderJob) => void) => {
    let next = value;
    while (!terminal(next)) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!live.current) throw new Error('排版视图已关闭。');
      next = await client.call('editor.job', { projectId: target.projectId, jobId: next.id });
      callback?.(next);
    }
    return next;
  };
  run.current = async () => {
    if (!enabled) return;
    if (activeJob.current) {
      queued.current = true;
      return;
    }
    const version = ++sequence.current;
    activeJob.current = 'starting';
    setError('');
    try {
      const created = await client.call('editor.render', {
        projectId: target.projectId,
        path: target.path,
        ...(target.fileId ? { fileId: target.fileId } : {}),
        format: latex ? 'pdf' : format,
        automatic: true,
        operationId: crypto.randomUUID(),
      });
      activeJob.current = created.id;
      if (version !== sequence.current || !live.current) {
        await client.call('editor.cancel', { projectId: target.projectId, jobId: created.id });
        return;
      }
      setJob(created);
      await waitJob(created, (value) => {
        if (version === sequence.current && live.current) setJob(value);
      });
    } catch (reason) {
      if (live.current && version === sequence.current) setError(message(reason));
    } finally {
      activeJob.current = undefined;
      if (queued.current && live.current) {
        queued.current = false;
        void run.current();
      }
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: 已保存版本、输出格式和显式刷新共同触发最新请求；run ref 避免旧闭包排队。
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => void run.current(), 350);
    return () => clearTimeout(timer);
  }, [savedContent, format, tick, target.path, target.projectId, enabled]);
  const dependencies = job?.dependencies.length
    ? job.dependencies.map((item) => item.path)
    : [target.path];
  const folders = target.path.split('/').slice(0, -1);
  const configDirectories = latex
    ? []
    : Array.from({ length: Math.min(folders.length + 1, 33) }, (_, depth) =>
        folders.slice(0, depth).join('/'),
      );
  const watchedInputs = [
    ...dependencies,
    ...configDirectories.map((directory) => `${directory ? `${directory}/` : ''}_quarto.yml`),
  ];
  const watchError = useFileWatch(
    client,
    target.projectId,
    [...dependencies, ...configDirectories],
    (paths) => {
      if (
        paths.some((path) =>
          watchedInputs.some((input) => !path || input === path || input.startsWith(`${path}/`)),
        )
      )
        refresh((value) => value + 1);
    },
    () => refresh((value) => value + 1),
  );
  useEffect(() => {
    const controller = new AbortController();
    let release = () => {};
    setLegacyPreview(undefined);
    if (enabled && outputId && legacyPdf)
      void (async () => {
        const blob = await outputBytes(
          client,
          target.projectId,
          outputId,
          undefined,
          controller.signal,
        );
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        release = () => URL.revokeObjectURL(url);
        if (!controller.signal.aborted) setLegacyPreview({ outputId, url });
        else release();
      })().catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      });
    return () => {
      controller.abort();
      release();
    };
  }, [client, target.projectId, outputId, legacyPdf, enabled]);
  const pollTransfer = async (id: string) => {
    let value = await client.call('files.transferStatus', {
      projectId: target.projectId,
      operationId: id,
      limit: 100,
    });
    while (value.state === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!live.current) return;
      value = await client.call('files.transferStatus', {
        projectId: target.projectId,
        operationId: id,
        limit: 100,
      });
    }
    if (live.current) setTransfer(value);
  };
  const exportFile = async () => {
    setExporting(true);
    setError('');
    try {
      const created = await client.call('editor.render', {
        projectId: target.projectId,
        path: target.path,
        ...(target.fileId ? { fileId: target.fileId } : {}),
        format: exportFormat,
        operationId: crypto.randomUUID(),
      });
      const result = await waitJob(created);
      if (result.state !== 'completed' || !result.output)
        throw new Error(
          result.diagnostics.map((item) => item.message).join('\n') || '导出编译未完成。',
        );
      const exported = await client.call('editor.export', {
        projectId: target.projectId,
        outputId: result.output.id,
        operationId: crypto.randomUUID(),
        path: destination,
      });
      await pollTransfer(exported.transferId);
    } catch (reason) {
      if (live.current) setError(message(reason));
    } finally {
      if (live.current) setExporting(false);
    }
  };
  return (
    <section className="render-pane" aria-label="完整排版预览">
      <div className="file-toolbar">
        <label>
          预览格式{' '}
          <select
            aria-label="预览格式"
            value={latex ? 'pdf' : format}
            disabled={latex}
            onChange={(event) => setFormat(event.target.value as RenderFormat)}
          >
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <button type="button" className="btn" onClick={() => refresh((value) => value + 1)}>
          重新编译
        </button>
        <button
          type="button"
          className="btn"
          disabled={!job || terminal(job)}
          onClick={() => {
            if (job)
              void client
                .call('editor.cancel', { projectId: target.projectId, jobId: job.id })
                .then(setJob, (reason) => setError(message(reason)));
          }}
        >
          取消编译
        </button>
        <button type="button" className="btn" onClick={() => setExportOpen(true)}>
          导出文件
        </button>
      </div>
      <p role="status" aria-label="排版状态">
        {job ? stateLabels[job.state] : '等待已保存稿件'}
        {dirty ? ' · 有未保存草稿' : ''}
        {output ? ` · 产物时间 ${new Date(output.createdAt).toLocaleTimeString()}` : ''}
        {job && job.state !== 'completed' && output ? ' · 显示上次成功结果' : ''}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {hasNewOutput ? (
        <p role="status">
          新版排版已就绪，当前预览和批注已保留。{' '}
          <button type="button" className="btn" onClick={() => setOutput(latestOutput)}>
            查看新版
          </button>
        </p>
      ) : null}
      {watchError ? <p role="status">{watchError}</p> : null}
      {job?.diagnostics.map((item) => (
        <p
          key={`${item.path}:${item.code}:${item.message}`}
          role={job.state === 'failed' ? 'alert' : 'status'}
        >
          {item.message}
        </p>
      ))}
      {job?.log ? (
        <details>
          <summary>编译日志</summary>
          <pre>{job.log}</pre>
        </details>
      ) : null}
      {legacyPdf ? <p role="status">历史产物缺少附加依据，仅可预览或导出。</p> : null}
      {outputFormat === 'html' ? (
        preview?.resource?.format === 'html' ? (
          <HtmlRenderView
            client={client}
            resource={preview.resource}
            port={port}
            enabled={enabled}
            dirty={dirty}
            viewId={viewId}
          />
        ) : (
          <p role={preview?.error ? 'alert' : 'status'}>{preview?.error ?? '正在核对排版产物…'}</p>
        )
      ) : legacyPdf ? (
        enabled && legacyPreview && legacyPreview.outputId === outputId ? (
          <RenderedPdf key={outputId} url={legacyPreview.url} />
        ) : null
      ) : outputId && outputFormat === 'pdf' ? (
        preview?.resource?.format === 'pdf' ? (
          <PdfReader
            key={preview.outputId}
            resource={preview.resource}
            port={port}
            enabled={enabled}
            viewId={viewId}
            ariaLabel="排版 PDF"
          />
        ) : (
          <p role={preview?.outputId === outputId && preview.error ? 'alert' : 'status'}>
            {preview?.outputId === outputId && preview.error
              ? preview.error
              : enabled
                ? '正在核对排版产物…'
                : '需连接内核。'}
          </p>
        )
      ) : null}
      {exportOpen ? (
        <Dialog title="导出稿件" onClose={() => setExportOpen(false)}>
          <label>
            导出格式{' '}
            <select
              aria-label="导出格式"
              value={exportFormat}
              disabled={latex || exporting}
              onChange={(event) => {
                const next = event.target.value as RenderFormat;
                setExportFormat(next);
                setDestination(target.path.replace(/\.[^.]+$/, `.${next}`));
              }}
            >
              <option value="html">HTML</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
            </select>
          </label>
          <label>
            项目内路径{' '}
            <input
              aria-label="导出项目内路径"
              value={destination}
              disabled={exporting}
              onChange={(event) => setDestination(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={exporting || !destination}
            onClick={() => void exportFile()}
          >
            {exporting ? '正在生成并导出' : '生成并导出'}
          </button>
          {transfer ? (
            <p role="status">
              {transfer.state === 'complete'
                ? '导出完成'
                : (transfer.error ?? `导出状态：${transfer.state}`)}
            </p>
          ) : null}
          {transfer?.conflict ? (
            <div>
              <p>目标已存在：{transfer.conflict.destination}</p>
              {(['skip', 'keepBoth', 'replace'] as const).map((decision) => (
                <button
                  type="button"
                  className="btn"
                  key={decision}
                  onClick={() => {
                    const conflict = transfer.conflict;
                    if (conflict?.basis)
                      void client
                        .call('files.transferDecide', {
                          projectId: target.projectId,
                          operationId: transfer.id,
                          entryId: conflict.id,
                          basis: conflict.basis,
                          decision,
                        })
                        .then(
                          () => pollTransfer(transfer.id),
                          (reason) => setError(message(reason)),
                        );
                  }}
                >
                  {decision === 'skip'
                    ? '跳过'
                    : decision === 'keepBoth'
                      ? '保留两份'
                      : '替换，原文件进入回收站'}
                </button>
              ))}
            </div>
          ) : null}
        </Dialog>
      ) : null}
    </section>
  );
}
