/// <reference lib="dom" />
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

function observe(document: Document) {
  const node = document.createElement('textarea');
  document.body.appendChild(node);
  const result: object[] = [];
  const read = () =>
    result.push({
      value: node.value,
      defaultValue: node.defaultValue,
      text: node.textContent,
      length: node.textLength,
      type: node.type,
    });
  read();
  node.textContent = 'default\r\ntext';
  read();
  node.defaultValue = 'second\rtext';
  read();
  node.value = 'draft\r\n🧵';
  read();
  node.defaultValue = 'changed default';
  read();
  node.textContent = 'changed text';
  read();
  node.value = '';
  node.defaultValue = 'keep empty';
  read();
  Reflect.set(node, 'value', null);
  read();
  Reflect.set(node, 'value', undefined);
  read();
  node.remove();
  return result;
}

test('report source textarea follows native defaults, dirty edits and newline normalization', async ({
  page,
}) => {
  const { reportSourceBuildOptions } = await import(
    new URL('../../packages/editor/report/build-options.mjs', import.meta.url).href
  );
  const file = test.info().outputPath('textarea.cjs');
  await build({
    stdin: {
      contents: `import {createWorkerDOM} from './packages/editor/vendor/worker-dom/src/worker-thread/index';
        import './packages/editor/report/textarea.mjs';
        const source = createWorkerDOM(() => {}, () => {}, () => {});
        console.log(JSON.stringify((${observe.toString()})(source.document)));`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    outfile: file,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node24',
    ...reportSourceBuildOptions,
  });
  const source = spawnSync(process.execPath, [file], {
    env: { PATH: '/usr/bin:/bin' },
    encoding: 'utf8',
    timeout: 5000,
  });
  expect(source.error).toBeUndefined();
  expect(source.signal).toBeNull();
  expect(source.status, source.stderr).toBe(0);
  const actual = JSON.parse(source.stdout);
  const native = await page.evaluate(`(${observe.toString()})(document)`);
  await writeFile(
    test.info().outputPath('comparison.json'),
    JSON.stringify({ actual, native }, null, 2),
  );
  expect(actual).toEqual(native);
});
