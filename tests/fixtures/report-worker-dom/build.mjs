import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';

const output = resolve(process.argv[2]);
assert(output.startsWith('/home/joshua/.cache/'));
await mkdir(output, { recursive: true });
const manifests = [];
for (const [entry, name, platform] of [
  ['source.ts', 'source.mjs', 'node'],
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
        /report-worker-dom\/(source\.ts|sample\.js)/.test(p),
      ),
    );
  await writeFile(join(output, `${name}.meta.json`), JSON.stringify(result.metafile, null, 2));
  manifests.push({
    name,
    sha256: createHash('sha256')
      .update(await readFile(join(output, name)))
      .digest('hex'),
    inputs: Object.keys(result.metafile.inputs),
  });
}
await writeFile(join(output, 'sample.js'), await readFile(new URL('./sample.js', import.meta.url)));
await writeFile(
  join(output, 'index.html'),
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>WorkerDOM probe</title><link rel="stylesheet" href="surface.css"><div id="fixture"></div><script type="module" src="surface.js"></script></html>',
);
await writeFile(
  join(output, 'build-inputs.json'),
  JSON.stringify(
    {
      node: process.version,
      esbuild: version,
      defines: { SERVER: false, IS_AMP: false, WORKER_DOM_DEBUG: false },
      useDefineForClassFields: false,
      manifests,
    },
    null,
    2,
  ),
);
