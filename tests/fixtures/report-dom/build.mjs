import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';

const output = resolve(process.argv[2]);
assert(output.startsWith(join(homedir(), '.cache', 'scholoom-report-dom') + sep));
await mkdir(output, { recursive: true });
const result = await build({
  entryPoints: [fileURLToPath(new URL('entry.tsx', import.meta.url))],
  outfile: join(output, 'surface.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2023',
  jsx: 'automatic',
  nodePaths: [resolve('apps/desktop/node_modules')],
  metafile: true,
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' },
});
assert(
  Object.keys(result.metafile.inputs).some((path) =>
    path.endsWith('packages/editor/src/report-dom.ts'),
  ),
);
assert(!Object.keys(result.metafile.inputs).some((path) => path.includes('/vendor/worker-dom/')));
await writeFile(join(output, 'surface.meta.json'), JSON.stringify(result.metafile, null, 2));
const map = JSON.parse(await readFile(join(output, 'surface.js.map'), 'utf8'));
for (const source of [
  'packages/editor/src/report-dom.ts',
  'packages/protocol/src/report-rendering.ts',
]) {
  const index = map.sources.findIndex((path) => path.endsWith(source));
  assert(index >= 0 && typeof map.sourcesContent[index] === 'string');
  await writeFile(join(output, source.split('/').at(-1)), map.sourcesContent[index]);
}
await writeFile(
  join(output, 'index.html'),
  '<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/surface.css"><div id="fixture"></div><script type="module" src="/surface.js"></script></html>',
);
