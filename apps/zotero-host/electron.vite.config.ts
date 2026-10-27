import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@scholoom/client/host': resolve(__dirname, '../../packages/client/dist/host.js'),
        '@scholoom/protocol': resolve(__dirname, '../../packages/protocol/dist'),
      },
    },
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          host: resolve(__dirname, 'src/main/host.ts'),
          managed: resolve(__dirname, 'src/main/managed.ts'),
        },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  preload: { build: { rollupOptions: { output: { format: 'cjs', entryFileNames: 'index.cjs' } } } },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          worker: resolve(__dirname, 'src/renderer/worker.html'),
        },
      },
    },
  },
});
