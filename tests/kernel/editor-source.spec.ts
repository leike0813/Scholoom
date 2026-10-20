import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

test('source views share history and retain their own mapped cursor after reopening', async ({
  page,
}, info) => {
  const bundled = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {SourceEditor} from './src/renderer/src/workbench/editor/SourceEditor';
        function App(){
          const [content,setContent]=React.useState('First line\\nSecond line\\nLast line');
          const [visible,setVisible]=React.useState(true);
          const [readOnly,setReadOnly]=React.useState(false);
          const props={documentId:'shared-fixture',path:'sample.ts',content,onChange:setContent,onSave:()=>window.saved=(window.saved||0)+1,autoFocus:false};
          return <><button onClick={()=>setVisible(!visible)}>切换左视图</button><button onClick={()=>setReadOnly(!readOnly)}>切换只读</button>
            <section aria-label="左视图">{visible&&<SourceEditor {...props} viewId="left" readOnly={readOnly}/>}</section>
            <section aria-label="右视图"><SourceEditor {...props} viewId="right"/></section></>;
        }
        createRoot(document.getElementById('root')).render(<App/>);`,
      loader: 'tsx',
      resolveDir: fileURLToPath(new URL('../../apps/desktop/', import.meta.url)),
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  await page.setContent('<!doctype html><div id="root"></div>');
  await page.addStyleTag({
    content: await readFile(
      new URL('../../apps/desktop/src/renderer/src/styles.css', import.meta.url),
      'utf8',
    ),
  });
  await page.addStyleTag({
    content:
      'section[aria-label="左视图"],section[aria-label="右视图"]{height:350px;display:flex;min-height:0;}',
  });
  await page.addScriptTag({ content: bundled.outputFiles[0]?.text ?? '' });
  const left = page.getByRole('region', { name: '左视图', exact: true });
  const right = page.getByRole('region', { name: '右视图', exact: true });
  const editor = (region: typeof left) =>
    region.getByRole('textbox', { name: '文件内容 sample.ts', exact: true });
  await editor(left).press('ControlOrMeta+End');
  await page.keyboard.insertText(' newest');
  await expect(editor(right)).toContainText('Last line newest');
  await right.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(editor(left)).not.toContainText('newest');
  await right.getByRole('button', { name: '重做', exact: true }).click();
  await expect(editor(left)).toContainText('newest');
  await editor(left).press('ControlOrMeta+End');
  await page.getByRole('button', { name: '切换左视图', exact: true }).click();
  await editor(right).press('ControlOrMeta+Home');
  await page.keyboard.insertText('Prefix ');
  await page.getByRole('button', { name: '切换左视图', exact: true }).click();
  await expect(left.getByRole('status', { name: '编辑器状态' })).toContainText('行 3');
  await editor(left).press('x');
  await expect(editor(right)).toContainText('Last line newestx');
  await editor(left).press('ControlOrMeta+s');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'saved'))).toBe(1);
  await page.getByRole('button', { name: '切换只读', exact: true }).click();
  await expect(editor(left)).toHaveAttribute('contenteditable', 'false');
  await expect(editor(right)).toHaveAttribute('contenteditable', 'true');
  const large = 'const evidence = 42;\n'.repeat(12000);
  expect(Buffer.byteLength(large)).toBeGreaterThan(230000);
  expect(Buffer.byteLength(large)).toBeLessThan(262144);
  await editor(right).press('ControlOrMeta+a');
  await editor(right).evaluate((element, text) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
    );
  }, large);
  await editor(right).press('ControlOrMeta+End');
  await editor(right).evaluate((element) => {
    element.addEventListener(
      'input',
      () => {
        const start = performance.now();
        requestAnimationFrame(() =>
          Reflect.set(window, 'sourceInputLatency', performance.now() - start),
        );
      },
      { once: true, capture: true },
    );
  });
  await editor(right).press('x');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'sourceInputLatency')))
    .toBeGreaterThanOrEqual(0);
  const inputLatency = await page.evaluate(() => Reflect.get(window, 'sourceInputLatency'));
  expect(inputLatency).toBeLessThan(1000);
  const latencyPath = info.outputPath('source-latency.json');
  await writeFile(latencyPath, JSON.stringify({ bytes: Buffer.byteLength(large), inputLatency }));
  await info.attach('source-latency.json', { path: latencyPath, contentType: 'application/json' });
});
