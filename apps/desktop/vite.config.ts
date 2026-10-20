import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';
import { kernelBootstrap } from './kernel-bootstrap';
import { pdfAssets } from './pdf-assets';

export default defineConfig({
  // Markdown 的依赖提供无 DOM 的 worker 导出；开发预打包也必须采用同一条件。
  resolve: { conditions: ['worker', ...defaultClientConditions] },
  optimizeDeps: {
    include: [
      '@scholoom/editor/visual',
      'unified',
      'remark-parse',
      'remark-gfm',
      'remark-math',
      'remark-rehype',
      'rehype-katex',
      'hast-util-to-jsx-runtime',
    ],
  },
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  plugins: [react(), kernelBootstrap(), pdfAssets()],
  server: { host: '127.0.0.1', cors: false },
});
