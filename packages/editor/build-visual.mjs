import { execFileSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.', import.meta.url));
const packages = ['editor', 'editor-types', 'editor-core', 'core', 'core-browser'];
for (const name of packages) {
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url)),
      '-p',
      `${root}vendor/quarto/${name}/tsconfig.json`,
    ],
    { stdio: 'inherit' },
  );
}
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL('./vendor/quarto/editor/src/index.ts', import.meta.url).pathname],
  outfile: new URL('./dist/quarto.js', import.meta.url).pathname,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2023',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.MODE': '"production"' },
  minifySyntax: true,
  alias: Object.fromEntries(
    packages.map((name) => [name, `${root}vendor/quarto/${name}/src/index.ts`]),
  ),
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.gif': 'dataurl' },
  sourcemap: true,
});
await cp(new URL('./resources/', import.meta.url), new URL('./dist/resources/', import.meta.url), {
  recursive: true,
});
