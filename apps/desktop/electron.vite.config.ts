import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { defaultClientConditions } from 'vite';
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
    plugins: [react(), pdfAssets()],
    resolve: { conditions: ['worker', ...defaultClientConditions] },
  },
});
