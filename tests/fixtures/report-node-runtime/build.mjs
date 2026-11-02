import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import { reportSourceBuildOptions } from '../../../packages/editor/report/build-options.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && output && isAbsolute(output), 'absolute output directory');
await mkdir(output, { recursive: true });
const result = await build({
  entryPoints: [fileURLToPath(new URL('./bootstrap.mts', import.meta.url))],
  outfile: join(output, 'bootstrap.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  metafile: true,
  ...reportSourceBuildOptions,
  define: {
    ...reportSourceBuildOptions.define,
    'process.env.NODE_ENV': '"production"',
  },
});
await writeFile(join(output, 'bootstrap.meta.json'), JSON.stringify(result.metafile, null, 2));
for (const [path, name] of [
  ['LICENSE', 'worker-dom-LICENSE.txt'],
  ['src/third_party/html-parser/LICENSE', 'html-parser-LICENSE.txt'],
  ['MODIFICATIONS.md', 'worker-dom-MODIFICATIONS.md'],
]) {
  await writeFile(
    join(output, name),
    await readFile(new URL(`../../../packages/editor/vendor/worker-dom/${path}`, import.meta.url)),
  );
}
