import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { defaultClientConditions } from 'vite';
import { kernelBootstrap } from './kernel-bootstrap';
import { pdfAssets } from './pdf-assets';

export default defineConfig({
  main: {
    build: {
      externalizeDeps: { exclude: ['@scholoom/protocol'] },
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } },
    },
  },
  renderer: {
    plugins: [react(), kernelBootstrap(), pdfAssets()],
    server: { host: '127.0.0.1', cors: false },
    resolve: { conditions: ['worker', ...defaultClientConditions] },
  },
});
