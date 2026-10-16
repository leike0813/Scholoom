import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const virtualId = 'virtual:scholoom-pdf-assets';
const resolvedId = `\0${virtualId}`;
const require = createRequire(import.meta.url);
const snippet = createRequire(
  createRequire(require.resolve('@embedpdf/react-pdf-viewer')).resolve('@embedpdf/snippet'),
);
const engine = createRequire(snippet.resolve('@embedpdf/engines'));
const fontFiles = [
  [0, 'latin', 'NotoSans-Regular.ttf'],
  [128, 'jp', 'NotoSansJP-Regular.otf'],
  [129, 'kr', 'NotoSansKR-Regular.otf'],
  [134, 'sc', 'NotoSansHans-Regular.otf'],
  [136, 'tc', 'NotoSansHant-Regular.otf'],
  [177, 'hebrew', 'NotoSansHebrew-Regular.ttf'],
  [178, 'arabic', 'NotoNaskhArabic-Regular.ttf'],
] as const;

/** SDK配置只接本地白名单；构建产物保留实际发布包的许可文本。 */
export function pdfAssets(): Plugin {
  const files = new Map<string, string>();
  files.set('pdfium.wasm', require.resolve('@embedpdf/pdfium/pdfium.wasm'));
  const fontNames = new Map<number, string>();
  for (const [charset, script, filename] of fontFiles) {
    const root = join(dirname(engine.resolve(`@embedpdf/fonts-${script}`)), '..');
    files.set(filename, join(root, 'fonts', filename));
    files.set(`LICENSE-fonts-${script}.txt`, join(root, 'LICENSE'));
    fontNames.set(charset, filename);
  }
  const pdfiumRoot = join(dirname(require.resolve('@embedpdf/pdfium')), '..');
  files.set('LICENSE-EmbedPDF.txt', join(pdfiumRoot, 'LICENSE'));
  files.set('LICENSE-PDFium.txt', join(pdfiumRoot, 'LICENSE.pdfium'));
  let serving = false;
  return {
    name: 'scholoom-pdf-assets',
    configResolved(config) {
      serving = config.command === 'serve';
    },
    resolveId(id) {
      return id === virtualId ? resolvedId : null;
    },
    async load(id) {
      if (id !== resolvedId) return null;
      const urls = new Map<string, string>();
      for (const [filename, path] of files) {
        urls.set(
          filename,
          serving
            ? JSON.stringify(`/__scholoom/pdf-assets/${filename}`)
            : `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: 'asset', name: filename, source: await readFile(path) })}`,
        );
      }
      const fonts = [...fontNames]
        .map(([charset, filename]) => `${charset}:${urls.get(filename)}`)
        .join(',');
      return `export default {wasmUrl:${urls.get('pdfium.wasm')},fontFallback:{fonts:{${fonts}},defaultFont:${urls.get('NotoSans-Regular.ttf')}}};`;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const prefix = '/__scholoom/pdf-assets/';
        const url = (request.url ?? '').split('?')[0] ?? '';
        if (!url.startsWith(prefix)) {
          next();
          return;
        }
        const filename = url.slice(prefix.length);
        const path = files.get(filename);
        if (!path || !['GET', 'HEAD'].includes(request.method ?? '')) {
          response.writeHead(404).end();
          return;
        }
        void readFile(path).then(
          (bytes) => {
            response.setHeader(
              'Content-Type',
              filename.endsWith('.wasm')
                ? 'application/wasm'
                : filename.endsWith('.txt')
                  ? 'text/plain; charset=utf-8'
                  : 'application/octet-stream',
            );
            response.setHeader('X-Content-Type-Options', 'nosniff');
            response.end(request.method === 'HEAD' ? undefined : bytes);
          },
          () => response.writeHead(404).end(),
        );
      });
    },
  };
}
