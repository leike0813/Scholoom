import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

const desktop = fileURLToPath(new URL('../../apps/desktop/', import.meta.url));
let script = '';
const deliveredRequests = new WeakMap<Page, string[]>();
const html = `<!doctype html><html><head><style>@import url('https://html-selection.test/egress');</style></head><body>
  <p>Original HTML evidence 73.</p><script>parent.unexpectedScript=true;fetch('/egress')</script>
  <img src="https://html-selection.test/egress" onerror="parent.unexpectedEvent=true">
  <iframe src="https://html-selection.test/egress"></iframe>
  <svg width="100" height="30"><a xlink:href="/foreign"><text x="0" y="20">SVG link</text></a></svg>
  <map><area href="/foreign" shape="rect" coords="0,0,10,10"></map>
  <p id="part">Local fragment</p><a href="#part">Jump within document</a>
</body></html>`;

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {HtmlRenderView} from './src/renderer/src/workbench/HtmlRenderView';
    import {ContextContributionProvider} from './src/renderer/src/workbench/context-contributions';
    const make=id=>({ref:{source:'render',projectId:'project',outputId:id},basis:'basis-'+id,name:'paper.html',format:'html',render:{jobId:'job-'+id,input:{ref:{source:'project',projectId:'project',fileId:'file'},basis:'source-'+id,dependencies:[]}},capabilities:{read:true,write:false,readingRecords:false,render:false}});
    const resources={a:make('a'),b:make('b')};
    const html=${JSON.stringify(html)};
    const listeners=new Set();
    const port={describe:async ref=>{if(window.revoked)throw Error('permissionDenied');return resources[ref.outputId]},
      read:async({ref,basis})=>{
        if(ref.outputId==='b'){window.waiting=true;await new Promise(resolve=>window.releaseCandidate=resolve);window.waiting=false;}
        const data=ref.outputId==='a'?html:'<p>New complete HTML evidence 74.</p>';
        return {ref,basis,encoding:'base64',data:btoa(data),offset:0,size:data.length,unit:'byte',truncated:false};
      },subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},cancelPending(){}};
    const client={call:async()=>{throw Error('Unexpected asset request')}};
    function App(){const [resource,setResource]=React.useState(resources.a),[items,setItems]=React.useState([]);
      window.next=()=>setResource(resources.b);window.revoke=()=>{window.revoked=true;listeners.forEach(fn=>fn())};
      return <ContextContributionProvider items={items} appendContextItems={added=>{setItems(previous=>[...previous,...added]);return true}}
        updateContextComment={(id,comment)=>setItems(previous=>previous.map(item=>item.itemId===id?{...item,comment}:item))}
        removeContextItem={id=>setItems(previous=>previous.filter(item=>item.itemId!==id))}>
        <HtmlRenderView client={client} resource={resource} port={port} enabled={true} viewId="view"/>
        <output aria-label="Fixture context">{JSON.stringify(items)}</output>
      </ContextContributionProvider>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `,
      resolveDir: desktop,
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    outfile: 'html-selection-fixture.js',
    format: 'iife',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  script = result.outputFiles[0]?.text ?? '';
});

test.beforeEach(async ({ page }) => {
  const delivered: string[] = [];
  deliveredRequests.set(page, delivered);
  await page.route('https://html-selection.test/**', (route) => {
    if (/egress|foreign/.test(route.request().url())) delivered.push(route.request().url());
    return route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: script }
        : {
            contentType: 'text/html',
            body: '<div id="root"></div><script src="/fixture.js"></script>',
          },
    );
  });
  await page.goto('https://html-selection.test/');
});

test('static HTML blocks active content and link navigation before attaching original evidence', async ({
  page,
}) => {
  const frame = page.frameLocator('iframe[title="HTML 排版预览"]');
  await expect(frame.getByText('Original HTML evidence 73.', { exact: true })).toBeVisible();
  await frame.locator('svg a').click();
  await frame.locator('area').evaluate((element) => (element as HTMLAreaElement).click());
  await frame.getByRole('link', { name: 'Jump within document' }).click();
  expect(await frame.locator('body').evaluate((element) => element.ownerDocument.URL)).toBe(
    'about:srcdoc',
  );
  expect(
    await page.evaluate(() => [
      Reflect.get(window, 'unexpectedScript'),
      Reflect.get(window, 'unexpectedEvent'),
    ]),
  ).toEqual([undefined, undefined]);
  expect(deliveredRequests.get(page)).toEqual([]);
  await page.locator('iframe').evaluate((element) => {
    const frame = element as HTMLIFrameElement;
    if (frame.contentWindow) frame.contentWindow.location.href = 'about:blank';
  });
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '附加选区', exact: true })).toBeDisabled();
});

test('a comment added while the next HTML is loading protects the actual old page and survives revocation', async ({
  page,
}) => {
  const frame = page.frameLocator('iframe[title="HTML 排版预览"]');
  const original = frame.getByText('Original HTML evidence 73.', { exact: true });
  await expect(original).toBeVisible();
  await page.evaluate(() => Reflect.get(window, 'next')());
  await page.waitForFunction(() => Reflect.get(window, 'waiting'));
  await original.evaluate((element) => {
    const document = element.ownerDocument;
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await page.getByRole('button', { name: '批注', exact: true }).click();
  const comment = page.getByRole('textbox', { name: '材料批注', exact: true });
  await comment.fill('Keep the original target.');
  await page.evaluate(() => Reflect.get(window, 'releaseCandidate')());
  await expect(page.getByRole('button', { name: '查看新版', exact: true })).toBeVisible();
  await expect(original).toBeVisible();
  const items = JSON.parse(await page.getByLabel('Fixture context').innerText());
  expect(items[0]).toMatchObject({
    ref: { outputId: 'a' },
    basis: 'basis-a',
    comment: 'Keep the original target.',
  });
  await page.getByRole('button', { name: '查看新版', exact: true }).click();
  await expect(frame.getByText('New complete HTML evidence 74.', { exact: true })).toBeVisible();
  await expect(comment).toHaveValue('Keep the original target.');
  await page.evaluate(() => Reflect.get(window, 'revoke')());
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(comment).toHaveValue('Keep the original target.');
});
