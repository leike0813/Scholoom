import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
import { init } from '@embedpdf/pdfium';
import { failure, OperationError } from '../errors.js';
import type { PdfRequest } from './pdf-reading.js';

const input = workerData as { bytes: ArrayBuffer; request: PdfRequest };
type SdkTask<T> = { toPromise(): Promise<T> };
type SdkPage = { size: { width: number; height: number } };
type SdkDocument = { pageCount: number; isEncrypted: boolean; pages: SdkPage[] };
type PdfExecutor = {
  openDocumentBuffer(file: { id: string; content: ArrayBuffer }): SdkTask<SdkDocument>;
  extractText(doc: SdkDocument, pages: number[]): SdkTask<string>;
  getPageGeometry(doc: SdkDocument, page: SdkPage): SdkTask<{ runs: { glyphs: unknown[] }[] }>;
  closeDocument(doc: SdkDocument): SdkTask<boolean>;
  destroy(): SdkTask<boolean>;
};
// v2发布声明使用无扩展名的re-export；NodeNext在此以公开executor约束运行时导出。
const { PdfiumNative } = createRequire(import.meta.url)('@embedpdf/engines/pdfium') as {
  PdfiumNative: new (module: WrappedPdfiumModule, options: { fontFallback: null }) => PdfExecutor;
};
let engine: PdfExecutor | undefined;
try {
  engine = new PdfiumNative(
    await init({
      wasmBinary: await readFile(
        fileURLToPath(import.meta.resolve('@embedpdf/pdfium/pdfium.wasm')),
      ),
    }),
    { fontFallback: null },
  );
  const doc = await engine.openDocumentBuffer({ id: 'material', content: input.bytes }).toPromise();
  try {
    if (doc.isEncrypted) throw new OperationError('invalidRequest', '暂不支持加密PDF。');
    const request = input.request;
    if (request.kind === 'info') {
      parentPort?.postMessage({ result: { pageCount: doc.pageCount } });
    } else {
      const page = doc.pages[request.pageIndex];
      if (!page) throw new OperationError('invalidRequest', 'PDF页码超出材料。');
      if (request.kind === 'geometry') {
        parentPort?.postMessage({ result: page.size });
      } else {
        // 2.15.1的空页extractText会读取未初始化的缓冲；先用公开字形几何判空。
        const geometry = await engine.getPageGeometry(doc, page).toPromise();
        const text = geometry.runs.some((run) => run.glyphs.length)
          ? await engine.extractText(doc, [request.pageIndex]).toPromise()
          : '';
        const offset = request.offset ?? 0,
          limit = request.limit ?? 16384;
        if (offset > text.length)
          throw new OperationError('invalidRequest', '文字读取位置超出页面。');
        const end = Math.min(text.length, offset + limit);
        parentPort?.postMessage({
          result: {
            pageIndex: request.pageIndex,
            ...page.size,
            offset,
            text: text.slice(offset, end),
            hasText: text.length > 0,
            ...(end < text.length ? { nextOffset: end } : {}),
          },
        });
      }
    }
  } finally {
    await engine.closeDocument(doc).toPromise();
  }
} catch (error) {
  const reason = (error as { reason?: { code?: number } })?.reason;
  parentPort?.postMessage({
    error:
      error instanceof OperationError
        ? failure(error)
        : {
            code: 'invalidRequest',
            message:
              reason?.code === 4
                ? 'PDF需要密码，暂不支持加密材料。'
                : 'PDF无法解析，请核对格式或加密状态。',
          },
  });
} finally {
  await engine?.destroy().toPromise();
}
