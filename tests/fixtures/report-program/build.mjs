import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from '../../../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import { reportSourceBuildOptions } from '../../../packages/editor/report/build-options.mjs';

const output = resolve(process.argv[2]);
const surface = spawnSync(process.execPath, ['tests/fixtures/report-dom/build.mjs', output], {
  encoding: 'utf8',
});
assert.equal(surface.status, 0, surface.stderr);
await mkdir(output, { recursive: true });
const result = await build({
  entryPoints: ['tests/fixtures/report-program/source-driver.mjs'],
  outfile: join(output, 'source.cjs'),
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  bundle: true,
  ...reportSourceBuildOptions,
  sourcemap: true,
  metafile: true,
});
await writeFile(join(output, 'source.meta.json'), JSON.stringify(result.metafile, null, 2));
