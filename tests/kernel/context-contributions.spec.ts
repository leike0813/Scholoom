import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

test('real text selections and fixed region/object providers share the inspected composer draft', async ({
  page,
}) => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {ContextContributionProvider,useContextContribution} from './src/renderer/src/workbench/context-contributions';
        import {FileEditor} from './src/renderer/src/workbench/project-ui';
        import {InstructionContextItems} from './src/renderer/src/workbench/shell/InstructionComposer';
        const ref={source:'project',projectId:'project',fileId:'file'};
        const descriptor={ref,basis:'version-1',name:'note.md',path:'note.md',format:'text',capabilities:{read:true,write:true,readingRecords:false}};
        const port={describe:async()=>descriptor,read:async()=>({ref,basis:'version-1',data:'Saved text',truncated:false}),subscribe:()=>()=>{}};
        const client={getSnapshot:()=>({phase:'connected'}),subscribe:()=>()=>{},subscribeChanges:()=>()=>{},call:async()=>({watchId:'fixture-watch'})};
        const target={name:'note.md',locator:{...ref,path:'note.md'}};
        const region={kind:'region',itemId:'region',ref,basis:'image-version',region:{x:0.1,y:0.2,width:0.3,height:0.4}};
        const object={kind:'object',itemId:'object',ref,basis:'object-version',providerId:'fixture',objectId:'chart',name:'Chart',semantics:'Synthetic comparison'};
        function Controls({setActive}){
          const context=useContextContribution();
          return <><button onClick={()=>{setActive('fixed');context.contributeSelection('fixed',{selections:[region]});}}>选择固定区域</button>
            <button onClick={()=>context.appendContextItem(region)}>附加固定区域</button>
            <button onClick={()=>{setActive('fixed');context.contributeSelection('fixed',{selections:[object]});}}>选择固定对象</button>
            <button onClick={()=>context.appendContextItem(object)}>附加固定对象</button></>;
        }
        function App(){
          const [items,setItems]=React.useState([]),[snapshot,setSnapshot]=React.useState(null),[active,setActive]=React.useState('source'),[tick,setTick]=React.useState(0);
          const publish=React.useCallback(snapshot=>{window.publishes=(window.publishes||0)+1;setSnapshot(snapshot)},[]);
          return <ContextContributionProvider items={items} appendContextItem={item=>setItems(items=>[...items,item])} removeContextItem={id=>setItems(items=>items.filter(item=>item.itemId!==id))} updateContextComment={(id,comment)=>setItems(items=>items.map(item=>item.itemId===id?{...item,comment}:item))} publishContext={publish} activeViewId={active} receiver={{projectId:'project',sessionId:'session'}}>
            <button onClick={()=>setTick(tick+1)}>刷新无关状态</button><span>{tick}</span>
            <FileEditor client={client} directory="fixture" resourceTarget={target} port={port} editorViewId="source" mode="source"/>
            <Controls setActive={setActive}/><InstructionContextItems/>
            <output aria-label="附加项数据">{JSON.stringify(items)}</output><output aria-label="快照数据">{JSON.stringify(snapshot)}</output>
          </ContextContributionProvider>;
        }
        createRoot(document.getElementById('root')).render(<App/>);`,
      loader: 'tsx',
      resolveDir: fileURLToPath(new URL('../../apps/desktop/', import.meta.url)),
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    plugins: [
      {
        name: 'unmounted-view-boundaries',
        setup(build) {
          build.onResolve(
            {
              filter:
                /(?:ProjectNavigation|VisualEditor|MarkdownPreview|ReadingRecordsPanel|RenderPane)$/,
            },
            (args) => ({ path: args.path, namespace: 'unmounted' }),
          );
          build.onLoad({ filter: /.*/, namespace: 'unmounted' }, () => ({
            contents:
              'export const ProjectControls=()=>null, VisualEditor=()=>null, MarkdownPreview=()=>null, ReadingRecordsPanel=()=>null, RenderPane=()=>null;',
            loader: 'js',
          }));
        },
      },
    ],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  await page.route('https://context-components.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: bundle.outputFiles[0]?.text ?? '' }
        : {
            contentType: 'text/html',
            body: '<div id="root"></div><script src="/fixture.js"></script>',
          },
    ),
  );
  await page.goto('https://context-components.test/');
  const editor = page.getByRole('textbox', { name: '文件内容 note.md', exact: true });
  const attached = page.getByLabel('附加项数据');
  const snapshot = page.getByLabel('快照数据');
  await expect(editor).toContainText('Saved text');
  await editor.press('ControlOrMeta+End');
  await page.keyboard.insertText(' unsaved');
  await editor.press('Home');
  await editor.press('Shift+End');
  await expect(snapshot).toContainText('draft');
  expect(JSON.parse(await attached.innerText())).toEqual([]);
  await page.getByRole('button', { name: '附加选区', exact: true }).click();
  const item = JSON.parse(await attached.innerText())[0];
  expect(item).toMatchObject({
    kind: 'text',
    basis: 'version-1',
    quote: 'Saved text unsaved',
    contentState: 'draft',
  });
  const inspector = page.getByRole('region', { name: '附加上下文', exact: true });
  await page.getByLabel('查看附加上下文', { exact: true }).click();
  await inspector.locator('details details summary').first().click();
  await page.getByLabel('上下文批注 1', { exact: true }).fill('Check this claim');
  await expect(attached).toContainText('Check this claim');
  const publishes = await page.evaluate(() => Reflect.get(window, 'publishes'));
  await page.getByRole('button', { name: '刷新无关状态', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(window, 'publishes'))).toBe(publishes);
  await page.getByRole('button', { name: '选择固定区域', exact: true }).click();
  await expect(snapshot).toContainText('image-version');
  expect(JSON.parse(await attached.innerText())).toHaveLength(1);
  await page.getByRole('button', { name: '附加固定区域', exact: true }).click();
  await page.getByRole('button', { name: '选择固定对象', exact: true }).click();
  await expect(snapshot).toContainText('Synthetic comparison');
  await page.getByRole('button', { name: '附加固定对象', exact: true }).click();
  expect(
    JSON.parse(await attached.innerText()).map((value: { kind: string }) => value.kind),
  ).toEqual(['text', 'region', 'object']);
  await page.getByLabel('查看附加上下文', { exact: true }).click();
  await page.getByRole('button', { name: '移除上下文 1', exact: true }).click();
  expect(
    JSON.parse(await attached.innerText()).map((value: { kind: string }) => value.kind),
  ).toEqual(['region', 'object']);
});
