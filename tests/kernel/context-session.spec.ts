import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

test.afterEach(async ({ page }, info) => {
  const errors = await page.pageErrors();
  if (errors.length)
    await info.attach('page-errors', {
      body: JSON.stringify(errors.map((error) => ({ name: error.name, message: error.message }))),
      contentType: 'application/json',
    });
});

test('business session preserves later drafts across rejected, delayed and unknown send receipts', async ({
  page,
}) => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {KernelClientError} from '@scholoom/client';
        import {useBusinessSession} from './src/renderer/src/workbench/business-session';
        import {readDraft} from './src/renderer/src/workbench/drafts';
        const project={id:'application',name:'Application',path:'fixture',trust:'trusted',autoBackup:false};
        window.mode='reject';window.sent=[];
        const client={getSnapshot:()=>({phase:'connected',status:{dataDirectory:'fixture-profile'}}),subscribe:()=>()=>{},subscribeChanges:()=>()=>{},call:async(method,input)=>{
          if(method==='session.send'){
            window.sent.push(input);
            if(window.mode==='reject')throw new KernelClientError('unavailable','Synthetic unavailable');
            if(window.mode==='unknown')throw new KernelClientError('outcomeUnknown','Synthetic receipt loss');
            return new Promise(resolve=>window.release=()=>resolve({instructionId:input.instructionId,runId:'run'}));
          }
          return {revision:1,provider:{configured:true,model:'fixture',models:[]},projects:[project],sessions:[],messages:[],artifacts:[],...(input.sessionId?{session:{id:input.sessionId,projectId:'application',title:input.sessionId,state:'completed'}}:{})};
        }};
        let counter=0;
        function App(){
          const session=useBusinessSession(client,'connected');
          const [,update]=React.useState(0);
          const send=()=>{session.adapter.onNew({content:[{type:'text',text:'Synthetic instruction'}]}).catch(()=>{}).finally(()=>update(value=>value+1));};
          return <><button onClick={()=>session.selectSession('first')}>选择一</button><button onClick={()=>session.selectSession('second')}>选择二</button>
            <button onClick={()=>session.appendContextItem({kind:'text',itemId:'item-'+(++counter),ref:{source:'project',projectId:'project',fileId:'file'},basis:'v1',quote:'Quote '+counter,contentState:'saved'})}>附加</button>
            <button disabled={session.adapter.isSendDisabled} onClick={send}>发送测试指令</button>
            {session.notices.map(notice=><div key={notice.id}>{notice.content}</div>)}
            <output aria-label="会话数据">{JSON.stringify({key:session.draftKey,session:session.activeSessionId,items:session.contextItems,disabled:session.adapter.isSendDisabled,pending:readDraft(session.draftKey+'|pending')})}</output>
          </>;
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
            contents:
              'export const ArtifactNotice=()=>null, FileExplorer=()=>null, LibraryTab=()=>null, ProjectOnboardingDialog=()=>null, ProjectTrustDialog=()=>null, ProjectControls=()=>null, ResourceView=()=>null, SessionList=()=>null, SessionSearchDialog=()=>null;',
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'silent',
  });
  await page.route('https://context-session.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: bundle.outputFiles[0]?.text ?? '' }
        : {
            contentType: 'text/html',
            body: '<div id="root"></div><script src="/fixture.js"></script>',
          },
    ),
  );
  await page.goto('https://context-session.test/');
  const state = page.getByLabel('会话数据');
  const send = page.getByRole('button', { name: '发送测试指令', exact: true });
  await page.getByRole('button', { name: '选择一', exact: true }).click();
  await expect(send).toBeEnabled();
  const key = JSON.parse(await state.innerText()).key;
  await page.evaluate((key) => {
    localStorage.setItem(
      'scholoom.draft.v1:fixture-profile|application|first',
      'Legacy source text',
    );
    localStorage.setItem('scholoom.draft.v1:' + key + '|materials', '[]');
    localStorage.setItem('scholoom.draft.v1:' + key + '|material-file-ids', '{}');
  }, key);
  await page.getByRole('button', { name: '选择二', exact: true }).click();
  await page.getByRole('button', { name: '选择一', exact: true }).click();
  await page.getByRole('button', { name: '恢复旧草稿', exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem('scholoom.draft.v1:' + key), key)).toBe(
    'Legacy source text',
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem('scholoom.draft.v1:fixture-profile|application|first'),
    ),
  ).toBe('Legacy source text');
  await page.getByRole('button', { name: '附加', exact: true }).click();
  await send.click();
  await expect(send).toBeEnabled();
  expect(JSON.parse(await state.innerText()).pending).toBe('');
  await page.evaluate(() => Reflect.set(window, 'mode', 'delay'));
  await send.click();
  await expect(send).toBeDisabled();
  await page.getByRole('button', { name: '附加', exact: true }).click();
  await page.getByRole('button', { name: '选择二', exact: true }).click();
  await page.getByRole('button', { name: '附加', exact: true }).click();
  await page.evaluate(() => Reflect.get(window, 'release')());
  await expect(state).toContainText('item-3');
  expect(
    JSON.parse(await state.innerText()).items.map((item: { itemId: string }) => item.itemId),
  ).toEqual(['item-3']);
  await page.getByRole('button', { name: '选择一', exact: true }).click();
  await expect(state).toContainText('item-2');
  expect(
    JSON.parse(await state.innerText()).items.map((item: { itemId: string }) => item.itemId),
  ).toEqual(['item-2']);
  await page.reload();
  await expect(state).toContainText('item-2');
  await page.evaluate(() => Reflect.set(window, 'mode', 'unknown'));
  await send.click();
  await expect(send).toBeDisabled();
  const pending = JSON.parse(JSON.parse(await state.innerText()).pending);
  await page.reload();
  await expect(send).toBeDisabled();
  expect(JSON.parse(JSON.parse(await state.innerText()).pending)).toEqual(pending);
});
