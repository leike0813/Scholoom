import { fileURLToPath } from 'node:url';

/** The official self-contained ESM build includes grammar data without runtime package reads. */
export const reportSourceBuildOptions = {
  tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
  define: { 'process.env.SERVER': 'false', IS_AMP: 'false', WORKER_DOM_DEBUG: 'false' },
  alias: { 'css-tree': fileURLToPath(import.meta.resolve('css-tree/dist/csstree.esm')) },
};
