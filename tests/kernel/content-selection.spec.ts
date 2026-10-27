import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import { contextLimits } from '../../packages/protocol/dist/workbench-context-contracts.js';

const desktop = fileURLToPath(new URL('../../apps/desktop/', import.meta.url));
const editorModules = fileURLToPath(
  new URL('../../packages/editor/node_modules/', import.meta.url),
);
let script = '';

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {MarkdownPreview} from './src/renderer/src/workbench/MarkdownPreview';
        import {VisualEditor} from './src/renderer/src/workbench/editor/VisualEditor';
        import {renderMarkdown} from './src/renderer/src/workbench/markdown-render';
        // Only the Worker transport and visual converter/UI shell are substitutes.
        // Markdown parsing, HAST rendering and ProseMirror transactions are real.
        window.Worker=class {
          postMessage({id,content}) {
            const respond=()=>content==='fail'
              ? this.onmessage({data:{id,error:'fixture conversion failure'}})
              : renderMarkdown(content).then(tree=>this.onmessage?.({data:{id,tree}}));
            if(content==='pending') window.releaseMarkdown=respond;
            else void respond();
          }
          terminate(){this.onmessage=null;}
        };
        const client={};
        const initial='Hello preview\\n\\n| Header |\\n| --- |\\n| real cell |\\n\\n![Actual image](plot.png "Plot title")';
        let visualRevision=0;
        window.visualRevision=()=>visualRevision;
        function App(){
          const [content,setContent]=React.useState(initial),[visual,setVisual]=React.useState('Hello visual'),
            [markdownSelection,setMarkdownSelection]=React.useState(null),
            [visualSelection,setVisualSelection]=React.useState({revision:0,value:null}),[mounted,setMounted]=React.useState(true);
          window.setMarkdown=setContent; window.unmountViews=()=>setMounted(false);
          return <><p id="outside">Outside text</p>{mounted&&<>
            <MarkdownPreview content={content} documentKey="fixture" basePath="paper.md" resourceRevision={0}
              readResource={async()=>{throw Error('No raster bytes in this fixture')}}
              openFile={()=>{}} openExternal={()=>{}} onSelection={setMarkdownSelection}/>
            <VisualEditor client={client} projectId="project" path="paper.md" content={visual} readOnly={false}
              onChange={setVisual} onError={()=>{}} onPending={()=>{}} onSave={()=>{}}
              registerFlush={flush=>window.flushVisual=flush}
              onSelection={value=>setVisualSelection({revision:++visualRevision,value})}/>
          </>}
          <output id="markdown-selection">{JSON.stringify(markdownSelection)}</output>
          <output id="visual-selection" data-revision={visualSelection.revision}>{JSON.stringify(visualSelection.value)}</output></>;
        }
        createRoot(document.getElementById('root')).render(<App/>);`,
      resolveDir: desktop,
      loader: 'tsx',
    },
    plugins: [
      {
        name: 'visual-converter-fixture',
        setup(builder) {
          builder.onResolve({ filter: /^@scholoom\/editor\/visual$/ }, () => ({
            path: 'visual',
            namespace: 'fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: `import {Schema} from ${JSON.stringify(`${editorModules}prosemirror-model/dist/index.js`)};
            import {EditorState,TextSelection,NodeSelection} from ${JSON.stringify(`${editorModules}prosemirror-state/dist/index.js`)};
            export const DispatchEvent={}; export const EditorCommands={};
            export const defaultTheme=()=>({code:{}}); export const defaultEditorUIImages=()=>({});
            const schema=new Schema({nodes:{
              doc:{content:'block+'},text:{group:'inline'},paragraph:{group:'block',content:'inline*'},
              table_container:{group:'block',content:'table table_caption'},table:{content:'table_row+'},
              table_row:{content:'table_cell+'},table_cell:{content:'paragraph+'},table_caption:{content:'text*'},
              image:{inline:true,group:'inline',atom:true,attrs:{src:{},title:{},caption:{},id:{}}}}});
            const n=(name,children)=>schema.node(name,null,children);
            export const Editor={create:async()=>{
              let listener;
              let state=EditorState.create({doc:n('doc',[
                n('paragraph',[schema.text('Hello visual')]),
                n('table_container',[n('table',[n('table_row',[n('table_cell',[n('paragraph',[schema.text('real cell')])])])]),
                  n('table_caption',[schema.text('Actual table caption')])]),
                n('paragraph',[schema.node('image',{src:'actual.png',title:'Visual title',caption:'Actual caption',id:'figure-1'})])])});
              const position=type=>{let found;state.doc.descendants((node,pos)=>{if(found===undefined&&node.type.name===type)found=pos});return found};
              const dispatch=tr=>{state=state.apply(tr);listener?.(tr)};
              const api={
                selectText:()=>dispatch(state.tr.setSelection(TextSelection.create(state.doc,1,6))),
                tableCursor:()=>dispatch(state.tr.setSelection(TextSelection.create(state.doc,position('table_cell')+2))),
                image:()=>dispatch(state.tr.setSelection(NodeSelection.create(state.doc,position('image')))),
                edit:()=>dispatch(state.tr.insertText('x',1)),
                refreshEditable(){},applyTheme(){},commands:()=>[],destroy(){},
                setMarkdown:async()=>({unrecognized:[],example_lists:false,unparsed_meta:{}}),
                getSelectedText:()=>state.doc.textBetween(state.selection.from,state.selection.to),
                getSelection:()=>({from:state.selection.from,to:state.selection.to}),
                getImagePosition:()=>position('image'),
                getStateJson:()=>state.toJSON(),
                getMarkdown:()=>new Promise((resolve,reject)=>{
                  window.finishConversion=()=>resolve({code:state.doc.textContent});
                  window.failConversion=()=>reject(Error('fixture conversion failure'));
                }),
                subscribe:(_event,callback)=>{listener=callback;window.visualFixture=api;return ()=>{listener=null}},
              };return api;
            }};`,
            loader: 'js',
            resolveDir: desktop,
          }));
        },
      },
    ],
    bundle: true,
    write: false,
    loader: { '.css': 'empty' },
    outfile: '/tmp/scholoom-content-selection-fixture.js',
    format: 'iife',
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.url': '"https://content-selection.test/fixture.js"',
    },
    logLevel: 'silent',
  });
  script =
    result.outputFiles.find((file) => file.path.endsWith('.js'))?.text ??
    result.outputFiles[0]?.text ??
    '';
});

test.beforeEach(async ({ page }) => {
  await page.route('https://content-selection.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: script }
        : {
            contentType: 'text/html',
            body: '<!doctype html><div id="root"></div><script src="/fixture.js"></script>',
          },
    ),
  );
  await page.goto('https://content-selection.test/');
  await expect(page.locator('.markdown-preview-body > p').first()).toHaveText('Hello preview');
  await expect.poll(() => page.evaluate(() => !!Reflect.get(window, 'visualFixture'))).toBe(true);
});

async function selectText(element: Locator, keyboard = false) {
  await element.evaluate((node, useKeyboard) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    node.dispatchEvent(
      useKeyboard
        ? new KeyboardEvent('keyup', { key: 'Shift', bubbles: true })
        : new PointerEvent('pointerup', { bubbles: true }),
    );
  }, keyboard);
}

async function visualAction(page: Page, action: string) {
  const observation = await page.evaluate((name) => {
    Reflect.get(window, 'visualFixture')[name]();
    return {
      revision: Reflect.get(window, 'visualRevision')(),
      committed: Number(document.getElementById('visual-selection')?.getAttribute('data-revision')),
      selection: Reflect.get(window, 'visualFixture').getSelection(),
    };
  }, action);
  await expect
    .poll(async () => Number(await page.locator('#visual-selection').getAttribute('data-revision')))
    .toBeGreaterThanOrEqual(observation.revision);
  return observation;
}

test('Markdown contributes only its own text and explicitly chosen real table/image objects', async ({
  page,
}) => {
  const output = page.locator('#markdown-selection');
  await selectText(page.locator('.markdown-preview-body > p').first(), true);
  await expect
    .poll(async () => JSON.parse(await output.innerText()))
    .toEqual({
      kind: 'text',
      quote: 'Hello preview',
    });
  await selectText(page.locator('.markdown-preview-body'));
  const bodySelection = JSON.parse(await output.innerText());
  expect(bodySelection.quote).toContain('real cell');
  expect(bodySelection.quote).not.toContain('选择表格');
  expect(bodySelection.quote).not.toContain('选择图片');
  await page.getByRole('button', { name: '选择表格', exact: true }).focus();
  await page.keyboard.press('Enter');
  const table = JSON.parse(await output.innerText());
  expect(table).toMatchObject({ kind: 'object', providerId: 'markdown', name: '表格' });
  expect(table.semantics).toContain('real cell');
  await page.getByRole('button', { name: '选择图片', exact: true }).click();
  const image = JSON.parse(await output.innerText());
  expect(image).toMatchObject({ kind: 'object', providerId: 'markdown', name: 'Plot title' });
  expect(image.semantics).toContain('plot.png');
  expect(image.semantics).toContain('Actual image');
  expect(image.objectId).not.toBe(table.objectId);
  await page.locator('.markdown-preview-body').evaluate((host) => {
    const range = document.createRange();
    range.setStart(document.getElementById('outside')?.firstChild as Node, 0);
    range.setEnd(host.querySelector('p')?.firstChild as Node, 3);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    host.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await expect(output).toHaveText('null');
});

test('Markdown text keeps paragraph, line-break and table boundaries inside the selected range', async ({
  page,
}) => {
  const body = page.locator('.markdown-preview-body');
  const output = page.locator('#markdown-selection');
  for (const content of [
    'Dose 1\n\n2 mg',
    'Dose 1  \n2 mg',
    '| Dose | Amount |\n| --- | --- |\n| 10 | 20 |',
  ]) {
    await page.evaluate((value) => Reflect.get(window, 'setMarkdown')(value), content);
    await expect(body).toContainText(content.startsWith('|') ? 'Amount' : 'Dose 1');
    await selectText(body);
    const selected = JSON.parse(await output.innerText());
    expect(selected.kind).toBe('text');
    expect(selected.quote).toMatch(content.startsWith('|') ? /10\s+20/ : /Dose 1\s+2 mg/);
    expect(selected.quote).not.toMatch(/Dose 12|1020/);
  }
  await page.evaluate(() => Reflect.get(window, 'setMarkdown')('Dose 1\n\n2 mg'));
  await expect(body.locator('p')).toHaveCount(2);
  await body.evaluate((node) => {
    const paragraphs = node.querySelectorAll('p');
    const range = document.createRange();
    range.setStart(paragraphs[0]?.firstChild as Text, 5);
    range.setEnd(paragraphs[1]?.firstChild as Text, 1);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  expect(JSON.parse(await output.innerText()).quote).toMatch(/^1\s+2$/);
  await page.evaluate(() =>
    Reflect.get(
      window,
      'setMarkdown',
    )(
      '| Dose | Empty | Amount |\n| --- | --- | --- |\n| 10 | | 20 |\n| | 30 | 40 |\n| 50 | 60 | |',
    ),
  );
  await expect(body.locator('tr')).toHaveCount(4);
  await selectText(body);
  const rows = JSON.parse(await output.innerText())
    .quote.split(/\n+/)
    .map((row: string) => row.split('\t'));
  expect(rows).toContainEqual(['10', '', '20']);
  expect(rows).toContainEqual(['', '30', '40']);
  expect(rows).toContainEqual(['50', '60', '']);
  const overLimit = `${'x'.repeat(contextLimits.excerptUnits - 1)}\n\n2`;
  await page.evaluate((value) => Reflect.get(window, 'setMarkdown')(value), overLimit);
  await expect(body.locator('p').first()).toHaveText('x'.repeat(contextLimits.excerptUnits - 1));
  await selectText(body);
  expect(JSON.parse(await output.innerText())).toEqual({ error: 'tooLarge' });
});

test('Markdown rejects stale trees while pending or failed and clears selection on unmount', async ({
  page,
}) => {
  const output = page.locator('#markdown-selection');
  await selectText(page.locator('.markdown-preview-body > p').first());
  await page.evaluate(() => Reflect.get(window, 'setMarkdown')('pending'));
  await expect(output).toHaveText('null');
  await selectText(page.locator('.markdown-preview-body > p').first());
  await expect(output).toHaveText('null');
  await expect(page.getByRole('button', { name: '选择表格', exact: true })).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, 'releaseMarkdown')());
  await expect(page.locator('.markdown-preview-body > p').first()).toHaveText('pending');
  await page.evaluate(() => Reflect.get(window, 'setMarkdown')('fail'));
  await expect(page.getByRole('status').first()).toContainText('失败');
  await selectText(page.locator('.markdown-preview-body > p').first());
  await expect(output).toHaveText('null');
  await page.evaluate(() => Reflect.get(window, 'setMarkdown')('current'));
  await expect(page.locator('.markdown-preview-body > p').first()).toHaveText('current');
  await selectText(page.locator('.markdown-preview-body > p').first());
  await expect(output).toContainText('current');
  await page.evaluate(() => Reflect.get(window, 'unmountViews')());
  await expect(output).toHaveText('null');
});

test('Markdown extracts one TeX representation per fully selected formula in text and tables', async ({
  page,
}) => {
  const content = 'Energy $x^2$ done.\n\n| Formula |\n| --- |\n| Energy $x^2$ done. |';
  await page.evaluate((value) => Reflect.get(window, 'setMarkdown')(value), content);
  const paragraph = page.locator('.markdown-preview-body > p').first();
  await expect(paragraph.locator('.katex')).toHaveCount(1);
  const output = page.locator('#markdown-selection');
  await selectText(paragraph);
  await expect
    .poll(async () => JSON.parse(await output.innerText()))
    .toEqual({
      kind: 'text',
      quote: 'Energy x^2 done.',
    });
  await page.getByRole('button', { name: '选择表格', exact: true }).click();
  const table = JSON.parse(await output.innerText());
  expect(table.semantics).toContain('Energy x^2 done.');
  expect(table.semantics.match(/x\^2/g)).toHaveLength(1);
  expect(table.semantics).not.toContain('x2');
  for (const layer of ['.katex-html', '.katex-mathml']) {
    await selectText(paragraph.locator(layer));
    await expect
      .poll(async () => JSON.parse(await output.innerText()))
      .toEqual({ error: 'partialFormula' });
  }
  for (const direction of ['into', 'outOf']) {
    await paragraph.evaluate((node, edge) => {
      const formula = node.querySelector('.katex-html') as Element;
      const text = document.createTreeWalker(formula, NodeFilter.SHOW_TEXT).nextNode() as Text;
      const range = document.createRange();
      if (edge === 'into') {
        range.setStart(node.firstChild as Node, 0);
        range.setEnd(text, text.length);
      } else {
        range.setStart(text, 0);
        range.setEnd(node.lastChild as Text, (node.lastChild as Text).length);
      }
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }, direction);
    await expect
      .poll(async () => JSON.parse(await output.innerText()))
      .toEqual({ error: 'partialFormula' });
  }
  await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(output).toHaveText('null');
  await selectText(paragraph.locator('.katex'));
  await expect
    .poll(async () => JSON.parse(await output.innerText()))
    .toEqual({
      kind: 'text',
      quote: 'x^2',
    });
});

for (const method of ['collapse', 'removeAllRanges'] as const) {
  test(`Markdown clears invalid native text after ${method} outside the view and retains explicit objects`, async ({
    page,
  }) => {
    const output = page.locator('#markdown-selection');
    await selectText(page.locator('.markdown-preview-body > p').first());
    await expect(output).toContainText('Hello preview');
    const cancelSelection = () =>
      page.evaluate((action) => {
        const selection = window.getSelection();
        if (action === 'collapse')
          selection?.collapse(document.getElementById('outside')?.firstChild as Node, 0);
        else selection?.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
      }, method);
    await cancelSelection();
    await expect(output).toHaveText('null');
    for (const name of ['选择表格', '选择图片']) {
      await page.getByRole('button', { name, exact: true }).click();
      const object = JSON.parse(await output.innerText());
      expect(object.kind).toBe('object');
      await cancelSelection();
      expect(JSON.parse(await output.innerText())).toEqual(object);
    }
  });
}

test('oversized text and table semantics report tooLarge without contributing a prefix', async ({
  page,
}) => {
  const text = 'x'.repeat(contextLimits.excerptUnits + 1);
  await page.evaluate((content) => Reflect.get(window, 'setMarkdown')(content), text);
  await expect(page.locator('.markdown-preview-body > p').first()).toHaveText(text);
  await selectText(page.locator('.markdown-preview-body > p').first());
  await expect(page.locator('#markdown-selection')).toHaveText(
    JSON.stringify({ error: 'tooLarge' }),
  );
  await page.evaluate(
    (content) => Reflect.get(window, 'setMarkdown')(`| Header |\n| --- |\n| ${content} |`),
    text,
  );
  await page.getByRole('button', { name: '选择表格', exact: true }).click();
  await expect(page.locator('#markdown-selection')).toHaveText(
    JSON.stringify({ error: 'tooLarge' }),
  );
});

test('visual selection-only transactions, explicit tables and image snapshots preserve pending drafts', async ({
  page,
}) => {
  const output = page.locator('#visual-selection');
  await visualAction(page, 'selectText');
  await expect
    .poll(async () => JSON.parse(await output.innerText()))
    .toEqual({
      kind: 'text',
      quote: 'Hello',
    });
  await visualAction(page, 'tableCursor');
  await expect(output).toHaveText('null');
  await page.getByRole('button', { name: '选择当前表格', exact: true }).focus();
  await page.keyboard.press('Enter');
  const table = JSON.parse(await output.innerText());
  expect(table).toMatchObject({ kind: 'object', providerId: 'visual', name: '表格' });
  expect(table.semantics).toContain('real cell');
  expect(table.semantics).toContain('Actual table caption');
  const imageAction = await visualAction(page, 'image');
  const image = JSON.parse(await output.innerText());
  expect(image).toMatchObject({ kind: 'object', providerId: 'visual', name: 'Visual title' });
  expect(image.objectId).not.toBe(table.objectId);
  expect(image.semantics).toContain('actual.png');
  expect(image.semantics).toContain('Actual caption');
  expect(image.semantics).toContain('figure-1');
  const selected = await page.evaluate(() => {
    const editor = Reflect.get(window, 'visualFixture');
    return { ...editor.getSelection(), imagePosition: editor.getImagePosition() };
  });
  expect(selected.from).toBe(selected.imagePosition);
  expect(selected.to - selected.from).toBe(1);
  await test.info().attach('visual-selection-commit', {
    body: JSON.stringify({
      imageAction,
      selected,
      tableId: table.objectId,
      imageId: image.objectId,
    }),
    contentType: 'application/json',
  });
  await visualAction(page, 'edit');
  await expect(output).toHaveText('null');
  await expect
    .poll(() => page.evaluate(() => !!Reflect.get(window, 'finishConversion')))
    .toBe(true);
  await visualAction(page, 'selectText');
  await expect(output).toContainText('"contentState":"draft"');
  await visualAction(page, 'image');
  expect(JSON.parse(await output.innerText())).toMatchObject({
    kind: 'object',
    contentState: 'draft',
  });
  await page.evaluate(() => Reflect.get(window, 'failConversion')());
  await expect(output).toHaveText('null');
  await visualAction(page, 'selectText');
  expect(JSON.parse(await output.innerText())).toMatchObject({
    kind: 'text',
    quote: 'xHell',
    contentState: 'draft',
  });
  await page.evaluate(() => {
    void Reflect.get(window, 'flushVisual')();
  });
  await page.evaluate(() => Reflect.get(window, 'finishConversion')());
  await expect(output).toHaveText('null');
  await visualAction(page, 'selectText');
  expect(JSON.parse(await output.innerText())).not.toHaveProperty('contentState');
  await page.evaluate(() => Reflect.get(window, 'unmountViews')());
  await expect(output).toHaveText('null');
});
