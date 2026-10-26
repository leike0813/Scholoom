import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

test.beforeEach(async ({ page }) => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {DelegationContext} from './src/renderer/src/workbench/shell/DelegationCall';
        import {ToolCall} from './src/renderer/src/workbench/shell/ToolCall';
        import {toThreadMessage} from './src/renderer/src/workbench/projection';
        import {NamedModelProfiles} from './src/renderer/src/workbench/ProjectNavigation';
        const resource={ref:{source:'project',projectId:'project',fileId:'saved-file'},name:'report.md',basis:'saved-version',format:'text',capabilities:{read:true,write:true,readingRecords:false,render:false}};
        const record=(session)=>({id:'delegation',projectId:'project',sessionId:session,role:{id:'reader',version:'v1'},modelConfig:{model:'actual-'+session,effort:'high'},state:'running',resultState:'partial',artifacts:[{resource,association:{state:'pending'}}],report:{findings:'Fixture finding',unfinished:'Fixture unfinished',blockers:'Fixture blocker',artifacts:[{ref:{source:'project',projectId:'project',fileId:'candidate-only'},basis:'candidate'}]}});
        const fixture=window.fixture={reads:[],cancels:[],opened:[],profileCalls:[],profileFailure:'',profileUnknown:false,profileRevision:1};
        fixture.settle=(index,overrides={})=>{const item=fixture.reads[index];item.resolve({...record(item.session),...overrides});};
        const profileCall=async(method,input)=>{
          fixture.profileCalls.push({method,input});
          if(method==='provider.profiles')return {profiles:[{id:'profile',name:'Existing',revision:fixture.profileRevision,provider:'minimax-cn-m-plan',config:{model:fixture.profileUnknown?'unknown-model':'model-one',effort:'high'}}],...(input.offset===0?{nextOffset:25}:{})};
          if(fixture.profileFailure)throw new Error(fixture.profileFailure);
          if(method==='provider.saveProfile')return {id:input.id,name:input.name,revision:++fixture.profileRevision,provider:'minimax-cn-m-plan',config:input.config};
          return {ok:true};
        };
        const provider={models:[{id:'model-one',supportsEffort:true},{id:'model-two',supportsEffort:false}],efforts:['low','high']};
        const message={id:'tool',role:'tool',state:'complete',createdAt:'2026-10-25T00:00:00Z',text:'',tool:{name:'delegate_agent',runId:'run',input:'{"delegationId":"wrong-preview-id"}',inputTruncated:true,delegationId:'delegation'}};
        function App(){
          const [session,setSession]=React.useState('a'),[revision,setRevision]=React.useState(0),[connection,setConnection]=React.useState(0),[draft,setDraft]=React.useState('');
          const access=React.useMemo(()=>({
            get:id=>new Promise((resolve,reject)=>fixture.reads.push({session,id,resolve,reject})),
            cancel:async id=>{fixture.cancels.push({session,id});return {...record(session),state:'cancelling'};},
            open:resource=>fixture.opened.push(resource),
          }),[session,connection]);
          return <>
            <textarea aria-label="Fixture draft" value={draft} onChange={event=>setDraft(event.target.value)}/>
            <button onClick={()=>setRevision(value=>value+1)}>会话刷新</button>
            <button onClick={()=>setSession(value=>value==='a'?'b':'a')}>切换会话</button>
            <button onClick={()=>setConnection(value=>value+1)}>重新连接</button>
            <output aria-label="Fixture session">{session}</output>
            <DelegationContext.Provider value={{...access,revision}}><ToolCall {...toThreadMessage(message).content[0]}/></DelegationContext.Provider>
            <NamedModelProfiles call={profileCall} provider={provider} enabled={true}/>
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
    logLevel: 'silent',
  });
  await page.route('https://delegation-components.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: bundle.outputFiles[0]?.text ?? '' }
        : {
            contentType: 'text/html',
            body: '<div id="root"></div><script src="/fixture.js"></script>',
          },
    ),
  );
  await page.goto('https://delegation-components.test/');
});

test('expanded tool reads are coalesced and use saved resources and scoped cancellation', async ({
  page,
}) => {
  const reads = () => page.evaluate(() => Reflect.get(window, 'fixture').reads.length);
  expect(await reads()).toBe(0);
  await page.locator('.tool-call > summary').click();
  await expect.poll(reads).toBe(1);
  expect(await page.evaluate(() => Reflect.get(window, 'fixture').reads[0].id)).toBe('delegation');
  for (let index = 0; index < 4; index++) await page.getByText('会话刷新', { exact: true }).click();
  expect(await reads()).toBe(1);
  await page.evaluate(() => Reflect.get(window, 'fixture').settle(0));
  await expect.poll(reads).toBe(2);
  await page.evaluate(() => Reflect.get(window, 'fixture').settle(1));
  const detail = page.getByRole('region', { name: '委派详情' });
  await expect(detail).toContainText('actual-a');
  await expect(detail).toContainText('Fixture blocker');
  await expect(detail.getByText('Fixture finding', { exact: true })).toBeHidden();
  await detail.locator('summary').click();
  await expect(detail).toContainText('Fixture unfinished');
  await expect(detail.getByRole('button', { name: /打开委派成果/ })).toHaveCount(1);
  await page.getByRole('button', { name: '打开委派成果 report.md' }).click();
  expect(await page.evaluate(() => Reflect.get(window, 'fixture').opened[0])).toMatchObject({
    ref: { source: 'project', fileId: 'saved-file' },
    basis: 'saved-version',
  });
  await page.getByRole('button', { name: '取消委派', exact: true }).click();
  await expect(detail).toContainText('停止核查中');
  expect(await page.evaluate(() => Reflect.get(window, 'fixture').cancels)).toEqual([
    { session: 'a', id: 'delegation' },
  ]);
  await expect(detail.getByRole('button', { name: '停止核查中', exact: true })).toBeDisabled();
  await expect(detail.getByRole('button', { name: '打开委派成果 report.md' })).toBeVisible();
});

test('closing, changing sessions and reconnecting discard late reads without changing the draft', async ({
  page,
}) => {
  const reads = () => page.evaluate(() => Reflect.get(window, 'fixture').reads.length);
  const summary = page.locator('.tool-call > summary');
  await page.getByLabel('Fixture draft').fill('unsent instruction');
  await summary.click();
  await expect.poll(reads).toBe(1);
  await summary.click();
  await page.getByText('会话刷新', { exact: true }).click();
  await page.evaluate(() => Reflect.get(window, 'fixture').settle(0));
  expect(await reads()).toBe(1);
  await expect(page.getByRole('region', { name: '委派详情' })).toHaveCount(0);
  await summary.click();
  await expect.poll(reads).toBe(2);
  await page.getByText('切换会话', { exact: true }).click();
  await expect.poll(reads).toBe(3);
  await page.evaluate(() =>
    Reflect.get(window, 'fixture').settle(1, { modelConfig: { model: 'stale-session' } }),
  );
  await expect(page.getByRole('region', { name: '委派详情' })).not.toContainText('stale-session');
  await page.getByText('重新连接', { exact: true }).click();
  await expect.poll(reads).toBe(4);
  await page.evaluate(() =>
    Reflect.get(window, 'fixture').settle(2, { modelConfig: { model: 'stale-connection' } }),
  );
  await page.evaluate(() => Reflect.get(window, 'fixture').settle(3));
  await expect(page.getByRole('region', { name: '委派详情' })).toContainText('actual-b');
  await expect(page.getByRole('region', { name: '委派详情' })).not.toContainText(
    'stale-connection',
  );
  await expect(page.getByLabel('Fixture session')).toHaveText('b');
  await expect(page.getByLabel('Fixture draft')).toHaveValue('unsent instruction');
});

test('profile pagination, catalogue errors and revision conflicts preserve explicit edits', async ({
  page,
}) => {
  await page.getByText('命名模型配置', { exact: true }).click();
  await page.getByRole('button', { name: '编辑命名配置 Existing' }).click();
  await page.getByLabel('配置名称', { exact: true }).fill('My draft');
  await page.evaluate(() => {
    Reflect.get(window, 'fixture').profileFailure = 'contentChanged: fixture revision conflict';
  });
  await page.getByRole('button', { name: '保存命名配置' }).click();
  await expect(page.getByRole('alert')).toContainText('contentChanged');
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveValue('My draft');
  await page.getByRole('button', { name: '刷新配置列表' }).click();
  await expect(page.getByRole('button', { name: '编辑命名配置 Existing' })).toBeVisible();
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveValue('My draft');
  await page.getByRole('button', { name: '下一页配置' }).click();
  await expect(page.getByRole('button', { name: '下一页配置' })).toBeDisabled();
  expect(
    await page.evaluate(() =>
      Reflect.get(window, 'fixture')
        .profileCalls.filter((item: { method: string }) => item.method === 'provider.profiles')
        .map((item: { input: unknown }) => item.input),
    ),
  ).toEqual([
    { offset: 0, limit: 25 },
    { offset: 0, limit: 25 },
    { offset: 25, limit: 25 },
  ]);
  await page.evaluate(() => {
    Reflect.get(window, 'fixture').profileFailure = '';
  });
  await page.getByRole('button', { name: '保存命名配置' }).click();
  await expect(page.getByText(/修订 2/)).toBeVisible();
  await page.getByLabel('配置模型', { exact: true }).selectOption('model-two');
  await expect(page.getByRole('button', { name: '保存命名配置' })).toBeDisabled();
  await page.getByLabel('配置推理强度', { exact: true }).selectOption('');
  await expect(page.getByRole('button', { name: '保存命名配置' })).toBeEnabled();
  await page.getByRole('button', { name: '删除命名配置' }).click();
  expect(
    await page.evaluate(
      () =>
        Reflect.get(window, 'fixture').profileCalls.find(
          (item: { method: string }) => item.method === 'provider.removeProfile',
        ).input,
    ),
  ).toEqual({ id: 'profile', expectedRevision: 2 });
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    Reflect.get(window, 'fixture').profileUnknown = true;
  });
  await page.getByRole('button', { name: '刷新配置列表' }).click();
  await page.getByRole('button', { name: '编辑命名配置 Existing' }).click();
  await expect(page.getByLabel('配置模型', { exact: true })).toHaveValue('unknown-model');
  await expect(page.getByRole('button', { name: '保存命名配置' })).toBeDisabled();
});
