import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../../../packages/editor/node_modules/esbuild/lib/main.js';

export async function buildReportContextFixture(directory: string) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./entry.tsx', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    nodePaths: [fileURLToPath(new URL('../../../apps/desktop/node_modules', import.meta.url))],
    outfile: join(directory, 'fixture.js'),
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'unmounted-navigation',
        setup(build) {
          build.onResolve(
            {
              filter:
                /(?:ArtifactNotice|file-explorer\/Explorer|library\/LibraryTab|ProjectOnboarding|ProjectTrustDialog|project-ui|ResourceView|SessionList|SessionSearch)$/,
            },
            (args) => ({ path: args.path, namespace: 'unmounted' }),
          );
          build.onLoad({ filter: /.*/, namespace: 'unmounted' }, () => ({
            contents:
              'export const ArtifactNotice=()=>null, FileExplorer=()=>null, LibraryTab=()=>null, ProjectOnboardingDialog=()=>null, ProjectTrustDialog=()=>null, ProjectControls=()=>null, ResourceView=()=>null, SessionList=()=>null, SessionSearchDialog=()=>null;',
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'info',
  });
  await mkdir(directory, { recursive: true });
  for (const output of result.outputFiles) await writeFile(output.path, output.contents);
  await writeFile(
    join(directory, 'index.html'),
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>可信报告选择夹具</title><link rel="stylesheet" href="fixture.css"></head><body><div id="fixture"></div><script src="fixture.js"></script></body></html>',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Supply a dedicated cache output directory');
  await buildReportContextFixture(directory);
}
