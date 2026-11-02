import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { reportSourceBuildOptions } from './report/build-options.mjs';

const destination = new URL('./dist/report-runtime/', import.meta.url);
await mkdir(destination, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('./report/bootstrap.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('./dist/report-program.cjs', import.meta.url)),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node24',
  ...reportSourceBuildOptions,
});
for (const name of [
  'LICENSE',
  'MODIFICATIONS.md',
  'upstream-manifest.json',
  'local.patch',
  'src/third_party/html-parser/LICENSE',
]) {
  await cp(
    new URL(`./vendor/worker-dom/${name}`, import.meta.url),
    new URL(
      name === 'src/third_party/html-parser/LICENSE' ? 'html-parser-LICENSE' : name,
      destination,
    ),
  );
}
const cssTreeRequire = createRequire(import.meta.resolve('css-tree/package.json'));
for (const name of ['css-tree', 'mdn-data', 'source-map-js']) {
  await cp(
    new URL('./LICENSE', pathToFileURL(cssTreeRequire.resolve(`${name}/package.json`))),
    new URL(`${name}-LICENSE`, destination),
  );
}
