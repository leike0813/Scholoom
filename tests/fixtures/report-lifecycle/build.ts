import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../../packages/editor/node_modules/esbuild/lib/main.js';

const directory = process.argv[2];
if (!directory) throw new Error('Supply a dedicated cache build directory');
await mkdir(directory, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('./entry.tsx', import.meta.url))],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  outfile: join(directory, 'fixture.js'),
  nodePaths: [fileURLToPath(new URL('../../../apps/desktop/node_modules', import.meta.url))],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' },
  plugins: [
    {
      name: 'unmounted-default-panels',
      setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)(ResourceView|project-ui)$/ }, (args) => ({
          path: args.path,
          namespace: 'unused-resource',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'unused-resource' }, () => ({
          contents: 'export const ResourceView=()=>null,ProjectControls=()=>null;',
          loader: 'js',
        }));
      },
    },
  ],
});
await writeFile(
  join(directory, 'index.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>可信报告生命周期夹具</title><link rel="stylesheet" href="fixture.css"><div id="fixture"></div><script type="module" src="fixture.js"></script></html>',
);
