import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../packages/editor/node_modules/esbuild/lib/main.js';

const directory = process.argv[2];
if (!directory) throw new Error('Supply a dedicated cache build directory');
await mkdir(directory, { recursive: true });
for (const entry of ['entry.tsx', 'source.ts']) {
  await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    jsx: 'automatic',
    outfile: join(directory, entry === 'entry.tsx' ? 'surface.js' : 'source.js'),
    nodePaths: [fileURLToPath(new URL('../../../apps/desktop/node_modules', import.meta.url))],
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' },
    logLevel: 'info',
  });
}
await writeFile(
  join(directory, 'source.html'),
  await readFile(new URL('./source.html', import.meta.url)),
);
await writeFile(
  join(directory, 'index.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>R2可信呈现调查</title><link rel="stylesheet" href="surface.css"><div id="fixture"></div><script type="module" src="surface.js"></script></html>',
);
