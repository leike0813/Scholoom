import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
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
          return <ContextContributionProvider items={items} appendContextItems={batch=>{setItems(items=>[...items,...batch]);return true}} removeContextItem={id=>setItems(items=>items.filter(item=>item.itemId!==id))} updateContextComment={(id,comment)=>setItems(items=>items.map(item=>item.itemId===id?{...item,comment}:item))} publishContext={publish} activeViewId={active} receiver={{projectId:'project',sessionId:'session'}}>
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

async function mountBusinessContext(page: Page): Promise<void> {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {useBusinessSession} from './src/renderer/src/workbench/business-session';
        import {ContextContributionProvider,useContextContribution} from './src/renderer/src/workbench/context-contributions';
        import {readDraft,subscribeDraft} from './src/renderer/src/workbench/drafts';
        window.directory='fixture-profile';
        const projects=['application','other'].map(id=>({id,name:id,path:id,trust:'trusted',autoBackup:false}));
        const client={getSnapshot:()=>({phase:'connected',status:{dataDirectory:window.directory}}),subscribe:()=>()=>{},subscribeChanges:()=>()=>{},call:async(method,input)=>({revision:1,provider:{configured:true,model:'fixture',models:[]},projects,sessions:[],messages:[],artifacts:[],...(input.sessionId?{session:{id:input.sessionId,projectId:input.projectId,title:input.sessionId,state:'completed'}}:{})})};
        function Controls({session}){
          const context=useContextContribution();
          window.contextFixture={session,context,readDraft,subscribeDraft};
          return <output aria-label="上下文状态">{JSON.stringify({key:session.draftKey,project:session.projectId,session:session.activeSessionId,items:context.items,error:context.contextError,available:context.available})}</output>;
        }
        function App(){
          const session=useBusinessSession(client,'connected');
          const [,update]=React.useState(0);
          return <ContextContributionProvider items={session.contextItems} appendContextItems={session.appendContextItems} contextError={session.contextError}>
            <button onClick={()=>session.selectSession('first')}>选择一</button>
            <button onClick={()=>session.selectSession('second')}>选择二</button>
            <button onClick={()=>{window.directory='other-profile';update(value=>value+1)}}>切换配置</button>
            <button onClick={()=>{window.directory='fixture-profile';update(value=>value+1)}}>返回配置</button>
            {session.sessionNavigation}<Controls session={session}/>
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
            contents: `import React from 'react';
              export const ArtifactNotice=()=>null, FileExplorer=()=>null, LibraryTab=()=>null, ProjectOnboardingDialog=()=>null, ProjectTrustDialog=()=>null, ProjectControls=()=>null, ResourceView=()=>null, SessionSearchDialog=()=>null;
              export const SessionList=({select})=>React.createElement(React.Fragment,null,
                React.createElement('button',{onClick:()=>select('other','first')},'切换项目'),
                React.createElement('button',{onClick:()=>select('application','first')},'返回项目'));`,
            resolveDir: fileURLToPath(new URL('../../apps/desktop/', import.meta.url)),
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'silent',
  });
  await page.route('https://context-batch.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: bundle.outputFiles[0]?.text ?? '' }
        : {
            contentType: 'text/html',
            body: '<div id="root"></div><script src="/fixture.js"></script>',
          },
    ),
  );
  await page.goto('https://context-batch.test/');
  await page.getByRole('button', { name: '选择一', exact: true }).click();
  await expect(page.getByLabel('上下文状态')).toContainText('"session":"first"');
}

test('batch append commits complete context or preserves the original draft on rejection', async ({
  page,
}) => {
  await mountBusinessContext(page);
  const ref = { source: 'project', projectId: 'project', fileId: 'file' };
  const original = {
    kind: 'resource',
    itemId: 'original',
    ref,
    basis: 'v1',
    comment: 'Keep this comment',
  };
  expect(
    await page.evaluate((item) => {
      const { session } = Reflect.get(window, 'contextFixture');
      return session.appendContextItem(item) === undefined;
    }, original),
  ).toBe(true);
  const batch = [
    {
      kind: 'object',
      itemId: 'object',
      ref,
      basis: 'report-v1',
      providerId: 'fixture',
      objectId: 'comparison',
      name: 'Comparison',
      semantics: 'Selected comparison',
      comment: 'Inspect the sources',
    },
    { ...original, itemId: 'source' },
  ];
  expect(
    await page.evaluate((items) => {
      const { session, context, readDraft, subscribeDraft } = Reflect.get(window, 'contextFixture');
      const key = `${session.draftKey}|context-items`;
      const observed: unknown[] = [];
      const unsubscribe = subscribeDraft(key, () => observed.push(JSON.parse(readDraft(key))));
      const result = context.appendContextItems(items);
      unsubscribe();
      return { result, observed, stored: JSON.parse(readDraft(key)), available: context.available };
    }, batch),
  ).toEqual({
    result: true,
    observed: [[original, ...batch]],
    stored: [original, ...batch],
    available: true,
  });

  const rejected = [
    [
      { ...original, itemId: 'valid' },
      { ...original, itemId: 'invalid', basis: 42 },
    ],
    Array.from({ length: 14 }, (_, i) => ({ ...original, itemId: `extra-${i}` })),
    Array.from({ length: 8 }, (_, i) => ({
      kind: 'text',
      itemId: `large-${i}`,
      ref,
      basis: 'v1',
      quote: '界'.repeat(3000),
      contentState: 'saved',
    })),
  ];
  for (const items of rejected) {
    expect(
      await page.evaluate((items) => {
        const { session, context, readDraft, subscribeDraft } = Reflect.get(
          window,
          'contextFixture',
        );
        const key = `${session.draftKey}|context-items`;
        const before = readDraft(key);
        let notifications = 0;
        const unsubscribe = subscribeDraft(key, () => notifications++);
        const result = context.appendContextItems(items);
        unsubscribe();
        return { result, unchanged: readDraft(key) === before, notifications };
      }, items),
    ).toEqual({ result: false, unchanged: true, notifications: 0 });
    await expect
      .poll(async () => JSON.parse(await page.getByLabel('上下文状态').innerText()).error)
      .toBeTruthy();
  }
  const rest = Array.from({ length: 13 }, (_, i) => ({ ...original, itemId: `rest-${i}` }));
  expect(
    await page.evaluate(
      (items) => Reflect.get(window, 'contextFixture').context.appendContextItems(items),
      rest,
    ),
  ).toBe(true);
  await expect
    .poll(async () => JSON.parse(await page.getByLabel('上下文状态').innerText()).items.length)
    .toBe(16);
  expect(JSON.parse(await page.getByLabel('上下文状态').innerText()).error).toBeUndefined();
});

test('stale append callbacks preserve both drafts after session, project and configuration switches', async ({
  page,
}) => {
  await mountBusinessContext(page);
  for (const [action, back] of [
    ['选择二', '选择一'],
    ['切换项目', '返回项目'],
    ['切换配置', '返回配置'],
  ] as const) {
    await page.evaluate(() => {
      const fixture = Reflect.get(window, 'contextFixture');
      const item = {
        kind: 'resource',
        itemId: crypto.randomUUID(),
        ref: { source: 'project', projectId: 'project', fileId: 'file' },
        basis: 'v1',
      };
      fixture.session.appendContextItems([item]);
      Reflect.set(window, 'oldContext', {
        context: fixture.context,
        session: fixture.session,
        key: `${fixture.session.draftKey}|context-items`,
        stored: fixture.readDraft(`${fixture.session.draftKey}|context-items`),
        item,
      });
    });
    const oldKey = JSON.parse(await page.getByLabel('上下文状态').innerText()).key;
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect
      .poll(async () => JSON.parse(await page.getByLabel('上下文状态').innerText()).key)
      .not.toBe(oldKey);
    expect(
      await page.evaluate(() => {
        const { context, session, readDraft } = Reflect.get(window, 'contextFixture');
        const old = Reflect.get(window, 'oldContext');
        const key = `${session.draftKey}|context-items`;
        const before = readDraft(key);
        return {
          providerResult: old.context.appendContextItems([old.item]),
          sessionResult: old.session.appendContextItems([old.item]),
          singleResult: old.session.appendContextItem(old.item) === undefined,
          currentUnchanged: readDraft(key) === before,
          oldUnchanged: readDraft(old.key) === old.stored,
          currentError: context.contextError,
        };
      }),
    ).toEqual({
      providerResult: false,
      sessionResult: false,
      singleResult: true,
      currentUnchanged: true,
      oldUnchanged: true,
      currentError: undefined,
    });
    expect(JSON.parse(await page.getByLabel('上下文状态').innerText()).error).toBeUndefined();
    await page.getByRole('button', { name: back, exact: true }).click();
    await expect
      .poll(async () => JSON.parse(await page.getByLabel('上下文状态').innerText()).key)
      .toBe(oldKey);
    expect(
      await page.evaluate(() => {
        const { context, readDraft } = Reflect.get(window, 'contextFixture');
        const old = Reflect.get(window, 'oldContext');
        return {
          result: old.context.appendContextItems([{ ...old.item, itemId: crypto.randomUUID() }]),
          unchanged: readDraft(old.key) === old.stored,
          currentError: context.contextError,
        };
      }),
    ).toEqual({ result: false, unchanged: true, currentError: undefined });
  }
});
