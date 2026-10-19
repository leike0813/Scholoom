import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
import { init } from '@embedpdf/pdfium';
import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import type { PdfRequest } from './pdf-reading.js';

type SdkTask<T> = { toPromise(): Promise<T> };
type SdkPage = { size: { width: number; height: number } };
type SdkDocument = { pageCount: number; isEncrypted: boolean; pages: SdkPage[] };
type PdfExecutor = {
  openDocumentBuffer(file: { id: string; content: ArrayBuffer }): SdkTask<SdkDocument>;
  extractText(doc: SdkDocument, pages: number[]): SdkTask<string>;
  getPageGeometry(doc: SdkDocument, page: SdkPage): SdkTask<{ runs: { glyphs: unknown[] }[] }>;
  closeDocument(doc: SdkDocument): SdkTask<boolean>;
};
// v2发布声明使用无扩展名的re-export；NodeNext在此以公开executor约束运行时导出。
const { PdfiumNative } = createRequire(import.meta.url)('@embedpdf/engines/pdfium') as {
  PdfiumNative: new (module: WrappedPdfiumModule, options: { fontFallback: null }) => PdfExecutor;
};

/** 与宿主一致的单块上限：base64后仍远低于2MiB帧，PDF字节按范围拉取。 */
const CHUNK_BYTES = 256 * 1024;
const send = (value: object) => {
  if (process.connected) process.send?.(value);
};

let engine: Promise<PdfExecutor> | undefined;
const loadEngine = (): Promise<PdfExecutor> =>
  (engine ??= (async () =>
    new PdfiumNative(
      await init({
        wasmBinary: await readFile(
          fileURLToPath(import.meta.resolve('@embedpdf/pdfium/pdfium.wasm')),
        ),
      }),
      { fontFallback: null },
    ))());

type RunFrame = { kind: 'run'; ref: string; token: string; size: number; request: PdfRequest };
let waiting:
  | { offset: number; resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }
  | undefined;
let busy = false;
let stopping = false;

function requestChunk(
  ref: string,
  token: string,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    waiting = { offset, resolve, reject };
    send({ kind: 'chunk', ref, token, offset, length });
  });
}

async function fetchMaterial(input: RunFrame): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(input.size);
  for (let offset = 0; offset < input.size; offset += CHUNK_BYTES) {
    if (stopping) process.exit(0);
    bytes.set(
      await requestChunk(
        input.ref,
        input.token,
        offset,
        Math.min(CHUNK_BYTES, input.size - offset),
      ),
      offset,
    );
  }
  return bytes.buffer;
}

async function parse(request: PdfRequest, bytes: ArrayBuffer): Promise<unknown> {
  const pdfium = await loadEngine();
  const doc = await pdfium.openDocumentBuffer({ id: 'material', content: bytes }).toPromise();
  try {
    if (doc.isEncrypted) throw new OperationError('invalidRequest', '暂不支持加密PDF。');
    if (request.kind === 'info') return { pageCount: doc.pageCount };
    const page = doc.pages[request.pageIndex];
    if (!page) throw new OperationError('invalidRequest', 'PDF页码超出材料。');
    if (request.kind === 'geometry') return page.size;
    // 2.15.1的空页extractText会读取未初始化的缓冲；先用公开字形几何判空。
    const geometry = await pdfium.getPageGeometry(doc, page).toPromise();
    const text = geometry.runs.some((run) => run.glyphs.length)
      ? await pdfium.extractText(doc, [request.pageIndex]).toPromise()
      : '';
    const offset = request.offset ?? 0,
      limit = request.limit ?? 16384;
    if (offset > text.length) throw new OperationError('invalidRequest', '文字读取位置超出页面。');
    const end = Math.min(text.length, offset + limit);
    return {
      pageIndex: request.pageIndex,
      ...page.size,
      offset,
      text: text.slice(offset, end),
      hasText: text.length > 0,
      ...(end < text.length ? { nextOffset: end } : {}),
    };
  } finally {
    await pdfium.closeDocument(doc).toPromise();
  }
}

async function run(input: RunFrame): Promise<void> {
  busy = true;
  try {
    const bytes = await fetchMaterial(input);
    if (stopping) process.exit(0);
    send({
      kind: 'result',
      ref: input.ref,
      token: input.token,
      result: await parse(input.request, bytes),
    });
  } catch (error) {
    if (stopping) process.exit(0);
    const reason = (error as { reason?: { code?: number } })?.reason;
    send({
      kind: 'failure',
      ref: input.ref,
      token: input.token,
      error:
        error instanceof OperationError
          ? { code: error.code, message: error.message }
          : ({
              code: 'invalidRequest',
              message:
                reason?.code === 4
                  ? 'PDF需要密码，暂不支持加密材料。'
                  : 'PDF无法解析，请核对格式或加密状态。',
            } satisfies ErrorInfo),
    });
  } finally {
    busy = false;
  }
}

// 监听在模块求值时同步注册，spawn后立即发送的运行帧不会丢失。
// 停止只在分块与解析步骤之间协作退出；同步WASM调用期间的硬终止由控制进程升级完成。
process.on('message', (value: unknown) => {
  const message = value as {
    method?: string;
    kind?: string;
    ref?: string;
    token?: string;
    offset?: number;
    data?: string;
    error?: ErrorInfo;
  };
  if (message?.method === 'execution.stop') {
    stopping = true;
    if (!busy) process.exit(0);
  } else if (message?.kind === 'chunk') {
    const pending = waiting;
    if (!pending || pending.offset !== message.offset) return;
    waiting = undefined;
    if (message.error)
      pending.reject(new OperationError(message.error.code, message.error.message));
    else pending.resolve(new Uint8Array(Buffer.from(message.data ?? '', 'base64')));
  } else if (message?.kind === 'run' && !busy && !stopping) {
    void run(message as RunFrame);
  }
});
process.on('disconnect', () => process.exit(0));
