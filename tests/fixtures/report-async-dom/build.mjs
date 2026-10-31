import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';

const output = resolve(process.argv[2]);
assert(
  output.startsWith('/home/joshua/.cache/scholoom-closeout-execution-20261030/report-async-dom/'),
);
await mkdir(output, { recursive: true });
for (const [path, name] of [
  ['LICENSE', 'worker-dom-LICENSE.txt'],
  ['src/third_party/html-parser/LICENSE', 'html-parser-LICENSE.txt'],
  ['MODIFICATIONS.md', 'worker-dom-MODIFICATIONS.md'],
]) {
  await writeFile(
    join(output, name),
    await readFile(new URL(`../report-worker-dom/vendor/${path}`, import.meta.url)),
  );
}
for (const [entry, name, platform] of [
  ['source.mts', 'source.mjs', 'node'],
  ['string-budget.mts', 'string-budget.mjs', 'node'],
  ['entry.tsx', 'surface.js', 'browser'],
]) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    outfile: join(output, name),
    bundle: true,
    platform,
    format: 'esm',
    target: 'node24',
    jsx: 'automatic',
    nodePaths: [resolve('apps/desktop/node_modules')],
    metafile: true,
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
    define: {
      'process.env.SERVER': 'false',
      IS_AMP: 'false',
      WORKER_DOM_DEBUG: 'false',
      'process.env.NODE_ENV': '"production"',
    },
    loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' },
    logLevel: 'info',
  });
  if (platform === 'browser')
    assert(
      !Object.keys(result.metafile.inputs).some((p) =>
        /report-async-dom\/(source.mts|sample.mjs)/.test(p),
      ),
    );
  await writeFile(join(output, `${name}.meta.json`), JSON.stringify(result.metafile, null, 2));
}
await writeFile(
  join(output, 'sample.js'),
  await readFile(new URL('./sample.mjs', import.meta.url)),
);
await writeFile(
  join(output, 'index.html'),
  '<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/surface.css"><div id="fixture"></div><script type="module" src="/surface.js"></script></html>',
);
