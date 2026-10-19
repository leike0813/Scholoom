import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
import { init } from '@embedpdf/pdfium';
import { OperationError } from '@scholoom/protocol/core';
import { serveMaterial } from './material-execution.js';
import type { PdfRequest } from './material-reading.js';

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

serveMaterial(async (request, bytes) => {
  if (request.kind === 'document') throw new OperationError('invalidRequest', '读取类型无效。');
  return parse(request, bytes);
});
