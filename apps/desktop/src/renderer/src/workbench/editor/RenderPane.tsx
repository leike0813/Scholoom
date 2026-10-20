import type { KernelClient } from '@scholoom/client';
import type { FileTransfer, RenderFormat, RenderJob } from '@scholoom/protocol';
import { useEffect, useRef, useState } from 'react';
import { RenderedPdf } from '../PdfReader';
import type { FileTarget } from '../session';
import { Dialog } from '../shell/dialog';
import { useFileWatch } from '../useFileWatch';
import { outputBytes, renderedHtml } from './render-output';

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
}: {
  client: KernelClient;
  target: FileTarget;
  savedContent: string;
  dirty: boolean;
}) {
  const latex = /\.tex$/i.test(target.path);
  const [format, setFormat] = useState<RenderFormat>(latex ? 'pdf' : 'html');
  const [job, setJob] = useState<RenderJob>();
  const [tick, refresh] = useState(0);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
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
  const output = job?.output ?? job?.lastSuccess;
  const outputId = output?.id;
  const outputFormat = output?.format;
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
    const timer = setTimeout(() => void run.current(), 350);
    return () => clearTimeout(timer);
  }, [savedContent, format, tick, target.path, target.projectId]);
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
    setUrl('');
    setHtml('');
    if (outputId)
      void (async () => {
        const blob = await outputBytes(
          client,
          target.projectId,
          outputId,
          undefined,
          controller.signal,
        );
        if (outputFormat === 'html') {
          const result = await renderedHtml(
            client,
            target.projectId,
            outputId,
            blob,
            controller.signal,
          );
          release = result.release;
          if (!controller.signal.aborted) setHtml(result.html);
          else release();
        } else {
          const next = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          release = () => URL.revokeObjectURL(next);
          if (!controller.signal.aborted) setUrl(next);
          else release();
        }
      })().catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      });
    return () => {
      controller.abort();
      release();
    };
  }, [client, target.projectId, outputId, outputFormat]);
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
      {html ? (
        <iframe
          title="HTML 排版预览"
          className="render-html"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={html}
        />
      ) : url ? (
        <RenderedPdf url={url} />
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
