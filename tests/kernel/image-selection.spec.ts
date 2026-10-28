import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';

let script = '';
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {ContextContributionProvider} from './src/renderer/src/workbench/context-contributions';
        import {ImageResourceView} from './src/renderer/src/workbench/ImageResourceView';
        const query=new URLSearchParams(location.search);
        const mode=query.get('mode'), format=query.get('format')||'png';
        const ref=query.get('source')==='library'
          ? {source:'library',attachmentId:'attachment',materialVersionId:'version-1'}
          : {source:'project',projectId:'project',fileId:'file'};
        const descriptor={ref,basis:'version-1',name:'figure.'+format,format:'image',
          capabilities:{read:true,write:false,readingRecords:false,render:false}};
        const canvas=document.createElement('canvas'); canvas.width=100; canvas.height=80;
        const ctx=canvas.getContext('2d'); ctx.fillStyle='navy'; ctx.fillRect(0,0,100,80);
        const encoded=format==='gif'?'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
          : canvas.toDataURL('image/'+format).split(',')[1];
        const data=mode==='invalid-raster'?'<svg></svg>':mode==='decode'?atob('iVBORw0KGgo=')+'broken':atob(encoded);
        let readable=true,basis='version-1',release;
        const listeners=new Set();
        const stats={reads:[],created:[],revoked:[],describes:0,subscriptions:0};
        const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
        URL.createObjectURL=blob=>{const url=create(blob);stats.created.push(url);return url;};
        URL.revokeObjectURL=url=>{stats.revoked.push(url);revoke(url);};
        window.imageFixture=stats;
        const notify=()=>listeners.forEach(listener=>listener());
        const port={
          describe:async()=>{stats.describes++;return {...descriptor,basis,capabilities:{...descriptor.capabilities,read:readable}}},
          subscribe:listener=>{listeners.add(listener);stats.subscriptions=listeners.size;
            return ()=>{listeners.delete(listener);stats.subscriptions=listeners.size;}},
          cancelPending:()=>{},
          read:async input=>{
            stats.reads.push(input);
            if(mode==='pending')await new Promise(resolve=>{release=resolve});
            const end=Math.min(input.offset+31,data.length);
            const part={ref,basis:'version-1',data:btoa(data.slice(input.offset,end)),offset:input.offset,
              size:data.length,unit:'byte',truncated:false,...(end<data.length?{nextOffset:end}:{})};
            if(mode==='offset')part.offset++;
            if(mode==='next')part.nextOffset=input.offset;
            if(mode==='basis')part.basis='version-2';
            if(mode==='identity')part.ref={source:'project',projectId:'project',fileId:'another'};
            if(mode==='size')part.size=8*1024*1024+1;
            if(mode==='size-change'&&input.offset)part.size++;
            if(mode==='truncated')part.truncated=true;
            return part;
          }
        };
        if(mode==='pixels'){
          const decode=Image.prototype.decode;
          Image.prototype.decode=async function(){await decode.call(this);
            Object.defineProperty(this,'naturalWidth',{value:4001});
            Object.defineProperty(this,'naturalHeight',{value:4000});};
        }
        function App(){
          const [items,setItems]=React.useState([]),[snapshot,setSnapshot]=React.useState(null),
            [mounted,setMounted]=React.useState(true),[enabled,setEnabled]=React.useState(true);
          const publish=React.useCallback(value=>setSnapshot(value),[]);
          return <ContextContributionProvider items={items} appendContextItems={batch=>{setItems(values=>[...values,...batch]);return true}}
            activeViewId="image" receiver={{projectId:'project',sessionId:'session'}} publishContext={publish}>
            <button onClick={()=>{readable=false;notify()}}>撤回读取权限</button>
            <button onClick={()=>{readable=true;notify()}}>恢复读取权限</button>
            <button onClick={()=>{basis='version-2';notify()}}>变更材料版本</button>
            <button onClick={notify}>通知其他资源变化</button>
            <button onClick={()=>setMounted(value=>!value)}>切换图片挂载</button>
            <button onClick={()=>setEnabled(false)}>断开连接</button>
            <button onClick={()=>release?.()}>返回延迟分片</button>
            {mounted&&<ImageResourceView resource={descriptor} port={port} enabled={enabled} viewId="image"/>}
            <output aria-label="实时图片选区">{JSON.stringify(snapshot)}</output>
            <output aria-label="已附加图片选区">{JSON.stringify(items)}</output>
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
    logLevel: 'silent',
  });
  script = bundle.outputFiles[0]?.text ?? '';
});

async function openImage(page: Page, query = '') {
  await page.route('https://image-components.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: script }
        : {
            contentType: 'text/html',
            body: '<div id="root"></div><script src="/fixture.js"></script>',
          },
    ),
  );
  await page.goto(`https://image-components.test/${query}`);
}

async function selectWithKeyboard(page: Page) {
  for (const [name, value] of [
    ['区域横坐标', '0.1'],
    ['区域纵坐标', '0.2'],
    ['区域宽度', '0.3'],
    ['区域高度', '0.4'],
  ] as const) {
    await page.getByRole('spinbutton', { name, exact: true }).fill(value);
  }
  await page.getByRole('button', { name: '应用图片区域', exact: true }).click();
}

async function snapshot(page: Page) {
  return JSON.parse(await page.getByLabel('实时图片选区', { exact: true }).innerText());
}

for (const source of ['project', 'library']) {
  test(`${source} raster selection follows the image through zoom and rotation and only attaches explicitly`, async ({
    page,
  }) => {
    await openImage(page, `?source=${source}`);
    const image = page.getByRole('img', { name: 'figure.png', exact: true });
    await expect(image).toBeVisible();
    expect(await image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(100);
    const attached = page.getByLabel('已附加图片选区', { exact: true });
    const live = page.getByLabel('实时图片选区', { exact: true });
    await selectWithKeyboard(page);
    await expect(live).toContainText('region');
    expect(JSON.parse(await attached.innerText())).toEqual([]);
    expect((await snapshot(page)).selections[0]).toMatchObject({
      kind: 'region',
      basis: 'version-1',
      ref: { source },
      target: { kind: 'image' },
      region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    });
    const beforeRefresh = await page.evaluate(() => {
      const stats = Reflect.get(window, 'imageFixture');
      return { reads: stats.reads.length, describes: stats.describes };
    });
    await page.getByRole('button', { name: '通知其他资源变化', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'imageFixture').describes))
      .toBeGreaterThan(beforeRefresh.describes);
    expect(await page.evaluate(() => Reflect.get(window, 'imageFixture').reads.length)).toBe(
      beforeRefresh.reads,
    );
    expect((await snapshot(page)).selections[0].region).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
    await page.getByRole('combobox', { name: '图片缩放', exact: true }).selectOption('2');
    await page.getByRole('button', { name: '旋转图片', exact: true }).click();
    expect((await snapshot(page)).selections[0].region).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
    const box = await page.getByRole('group', { name: '图片框选区域', exact: true }).boundingBox();
    if (!box) throw new Error('Image selection area is missing');
    // A clockwise quarter-turn maps original (x,y) to displayed (1-y,x).
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.up();
    await expect
      .poll(async () => (await snapshot(page))?.selections[0].region.width)
      .toBeCloseTo(0.4, 2);
    const region = (await snapshot(page)).selections[0].region;
    expect(region.x).toBeCloseTo(0.1, 2);
    expect(region.y).toBeCloseTo(0.2, 2);
    expect(region.height).toBeCloseTo(0.5, 2);
    expect(JSON.parse(await attached.innerText())).toHaveLength(0);
    await page.getByRole('button', { name: '附加图片区域', exact: true }).click();
    expect(JSON.parse(await attached.innerText())).toHaveLength(1);
    await page.getByRole('button', { name: '撤回读取权限', exact: true }).click();
    await expect(image).toHaveCount(0);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(live).toHaveText('null');
    expect(JSON.parse(await attached.innerText())).toHaveLength(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const stats = Reflect.get(window, 'imageFixture');
          return stats.created.every((url: string) => stats.revoked.includes(url));
        }),
      )
      .toBe(true);
    await page.getByRole('button', { name: '恢复读取权限', exact: true }).click();
    await expect(image).toBeVisible();
    await selectWithKeyboard(page);
    await page.getByRole('button', { name: '切换图片挂载', exact: true }).click();
    await expect(live).toHaveText('null');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const stats = Reflect.get(window, 'imageFixture');
          return (
            stats.subscriptions === 0 &&
            stats.created.every((url: string) => stats.revoked.includes(url))
          );
        }),
      )
      .toBe(true);
    const reads = await page.evaluate(() => Reflect.get(window, 'imageFixture').reads);
    expect(reads.length).toBeGreaterThan(1);
    expect(
      reads.every(
        (read: { encoding: string; limit: number }) =>
          read.encoding === 'base64' && read.limit <= 262144,
      ),
    ).toBe(true);
  });
}

for (const format of ['jpeg', 'gif', 'webp']) {
  test(`decodes a real ${format} image`, async ({ page }) => {
    await openImage(page, `?format=${format}`);
    await expect(page.getByRole('img', { name: `figure.${format}`, exact: true })).toBeVisible();
  });
}

for (const mode of [
  'offset',
  'next',
  'basis',
  'identity',
  'size',
  'size-change',
  'truncated',
  'invalid-raster',
  'decode',
  'pixels',
]) {
  test(`rejects invalid image input: ${mode}`, async ({ page }) => {
    await openImage(page, `?mode=${mode}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(page.getByLabel('实时图片选区', { exact: true })).toHaveText('null');
    expect(
      await page.evaluate(() => {
        const stats = Reflect.get(window, 'imageFixture');
        return stats.created.every((url: string) => stats.revoked.includes(url));
      }),
    ).toBe(true);
  });
}

test('content changes and disconnection hide cached images and clear live selection', async ({
  page,
}) => {
  await openImage(page);
  await expect(page.getByRole('img')).toBeVisible();
  await selectWithKeyboard(page);
  await page.getByRole('button', { name: '变更材料版本', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByLabel('实时图片选区', { exact: true })).toHaveText('null');
  await page.reload();
  await expect(page.getByRole('img')).toBeVisible();
  await selectWithKeyboard(page);
  await page.getByRole('button', { name: '断开连接', exact: true }).click();
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByLabel('实时图片选区', { exact: true })).toHaveText('null');
  expect(
    await page.evaluate(() => {
      const stats = Reflect.get(window, 'imageFixture');
      return stats.created.every((url: string) => stats.revoked.includes(url));
    }),
  ).toBe(true);
});

test('a late image read cannot restore an unmounted view', async ({ page }) => {
  await openImage(page, '?mode=pending');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'imageFixture').reads.length))
    .toBe(1);
  await page.getByRole('button', { name: '切换图片挂载', exact: true }).click();
  await page.getByRole('button', { name: '返回延迟分片', exact: true }).click();
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByLabel('实时图片选区', { exact: true })).toHaveText('null');
  expect(await page.evaluate(() => Reflect.get(window, 'imageFixture').created)).toEqual([]);
});

test('revocation during a pending read prevents a late image from becoming visible', async ({
  page,
}) => {
  await openImage(page, '?mode=pending');
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'imageFixture').reads.length))
    .toBe(1);
  await page.getByRole('button', { name: '撤回读取权限', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '返回延迟分片', exact: true }).click();
  await expect(page.getByRole('img')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'imageFixture').created)).toEqual([]);
});

test('invalid keyboard regions keep the last valid selection and clearing removes only live selection', async ({
  page,
}) => {
  await openImage(page);
  await expect(page.getByRole('img')).toBeVisible();
  await selectWithKeyboard(page);
  const live = page.getByLabel('实时图片选区', { exact: true });
  await expect(live).toContainText('region');
  await page.getByRole('button', { name: '附加图片区域', exact: true }).click();
  await page.getByRole('spinbutton', { name: '区域宽度', exact: true }).fill('0.95');
  await page.getByRole('button', { name: '应用图片区域', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect((await snapshot(page)).selections[0].region.width).toBe(0.3);
  await page.getByRole('button', { name: '清除图片选区', exact: true }).click();
  await expect(live).toHaveText('null');
  expect(
    JSON.parse(await page.getByLabel('已附加图片选区', { exact: true }).innerText()),
  ).toHaveLength(1);
});
