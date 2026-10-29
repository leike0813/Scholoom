import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import type { ReportSnapshot } from '../../packages/protocol/dist/report-contracts.js';

const snapshot: ReportSnapshot = {
  resource: {
    ref: { source: 'project', projectId: 'project', fileId: 'report' },
    basis: 'report-v1',
    name: 'comparison.html',
    format: 'html',
    capabilities: { read: true, write: false, readingRecords: false, render: false },
  },
  manifest: {
    version: 1,
    resources: [],
    sources: [
      {
        ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'v1' },
        basis: 'paper-v1',
      },
      { ref: { source: 'project', projectId: 'project', fileId: 'notes' }, basis: 'notes-v1' },
      {
        ref: { materialVersionId: 'v1', attachmentId: 'paper', source: 'library' },
        basis: 'paper-v1',
      },
      {
        ref: { source: 'library', attachmentId: 'paper', materialVersionId: 'v2' },
        basis: 'paper-v2',
      },
      { ref: { source: 'project', projectId: 'project', fileId: 'unselected' }, basis: 'u1' },
    ],
    objects: [
      { objectId: 'row-a', name: 'Paper A', semantics: 'Dose 10', sourceIndexes: [0, 1, 2] },
      { objectId: 'row-b', name: 'Paper B', semantics: 'Dose 20', sourceIndexes: [2, 3] },
    ],
  },
};
const envelope = { version: 1, viewId: 'report-view', generation: 1, basis: 'report-v1' };
const request = 'Compare these claims';
const select = { ...envelope, type: 'select', objectIds: ['row-a'], request };

let script = '';
test.beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {useBusinessSession} from './src/renderer/src/workbench/business-session';
        import {ContextContributionProvider,useContextContribution} from './src/renderer/src/workbench/context-contributions';
        import {createReportContext} from './src/renderer/src/workbench/report-context';
        import {readDraft,writeDraft,subscribeDraft} from './src/renderer/src/workbench/drafts';
        const project={id:'application',name:'fixture',path:'fixture',trust:'trusted',autoBackup:false};
        window.calls=[];
        const client={getSnapshot:()=>({phase:'connected',status:{dataDirectory:'report-context-profile'}}),subscribe:()=>()=>{},subscribeChanges:()=>()=>{},call:async(method,input)=>{
          window.calls.push(method);
          return {revision:1,provider:{configured:true,model:'fixture',models:[]},projects:[project],sessions:[],messages:[],artifacts:[],...(input.sessionId?{session:{id:input.sessionId,projectId:input.projectId,title:input.sessionId,state:'completed'}}:{})};
        }};
        function Controls({session}){
          const context=useContextContribution();
          window.fixture={session,context,readDraft,writeDraft,subscribeDraft,createReportContext};
          return <output aria-label="report-context-state">{JSON.stringify({key:session.draftKey,session:session.activeSessionId,items:context.items})}</output>;
        }
        function App(){
          const session=useBusinessSession(client,'connected');
          return <ContextContributionProvider items={session.contextItems} appendContextItems={session.appendContextItems} contextError={session.contextError}>
            <button onClick={()=>session.selectSession('first')}>First receiver</button>
            <button onClick={()=>session.selectSession('second')}>Second receiver</button>
            <Controls session={session}/>
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
            contents:
              'export const ArtifactNotice=()=>null, FileExplorer=()=>null, LibraryTab=()=>null, ProjectOnboardingDialog=()=>null, ProjectTrustDialog=()=>null, ProjectControls=()=>null, ResourceView=()=>null, SessionList=()=>null, SessionSearchDialog=()=>null;',
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'silent',
  });
  script = bundle.outputFiles[0]?.text ?? '';
  expect(script).not.toBe('');
});

async function mount(page: Page) {
  await page.route('https://report-context.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/fixture.js')
        ? { contentType: 'text/javascript', body: script }
        : {
            contentType: 'text/html',
            body: '<div id="root"></div><script src="/fixture.js"></script>',
          },
    ),
  );
  await page.goto('https://report-context.test/');
  await page.getByRole('button', { name: 'First receiver', exact: true }).click();
  await expect(page.getByLabel('report-context-state')).toContainText('"session":"first"');
  await page.evaluate(
    ({ snapshot, envelope }) => {
      const f = Reflect.get(window, 'fixture');
      f.writeDraft(f.session.draftKey, 'Keep the user body');
      f.session.appendContextItems([
        {
          kind: 'resource',
          itemId: 'original',
          ref: snapshot.resource.ref,
          basis: 'older-report',
          comment: 'Keep the old comment',
        },
      ]);
      Reflect.set(
        window,
        'consumer',
        f.createReportContext({
          ...envelope,
          snapshot,
          appendContextItems: f.context.appendContextItems,
        }),
      );
    },
    { snapshot, envelope },
  );
}

for (const objectIds of [['row-a'], ['row-b', 'row-a']]) {
  test(`report ${objectIds.length}-object selection atomically reaches the original draft with exact sources`, async ({
    page,
  }) => {
    await mount(page);
    const result = await page.evaluate(
      (message) => {
        const f = Reflect.get(window, 'fixture');
        const key = `${f.session.draftKey}|context-items`;
        const before = JSON.parse(f.readDraft(key));
        const observed: unknown[] = [];
        const stop = f.subscribeDraft(key, () => observed.push(JSON.parse(f.readDraft(key))));
        const reply = Reflect.get(window, 'consumer').receive(message);
        stop();
        return {
          reply,
          before,
          stored: JSON.parse(f.readDraft(key)),
          observed,
          body: f.readDraft(f.session.draftKey),
          sends: Reflect.get(window, 'calls').filter((method: string) => method === 'session.send'),
        };
      },
      { ...select, objectIds },
    );
    expect(result.reply).toEqual({ ...envelope, type: 'queued' });
    expect(result.body).toBe('Keep the user body');
    expect(result.sends).toEqual([]);
    expect(result.stored.slice(0, 1)).toEqual(result.before);
    expect(result.observed).toEqual([result.stored]);
    const objects = result.stored.filter((item: { kind: string }) => item.kind === 'object');
    expect(objects).toEqual(
      objectIds.map((id) => ({
        kind: 'object',
        itemId: expect.any(String),
        ref: snapshot.resource.ref,
        basis: snapshot.resource.basis,
        providerId: 'report',
        objectId: id,
        name: id === 'row-a' ? 'Paper A' : 'Paper B',
        semantics: id === 'row-a' ? 'Dose 10' : 'Dose 20',
        comment: request,
      })),
    );
    const sources = result.stored.filter(
      (item: { kind: string; itemId: string }) =>
        item.kind === 'resource' && item.itemId !== 'original',
    );
    const expectedSources = (objectIds.length === 1 ? [0, 1] : [0, 1, 3]).map((index) => ({
      kind: 'resource',
      itemId: expect.any(String),
      ...snapshot.manifest.sources[index],
    }));
    expect(sources).toHaveLength(expectedSources.length);
    expect(sources).toEqual(expect.arrayContaining(expectedSources));
    expect(new Set(result.stored.map((item: { itemId: string }) => item.itemId)).size).toBe(
      result.stored.length,
    );
  });
}

test('illegal, stale or incomplete selections reject the whole batch without changing the draft', async ({
  page,
}) => {
  await mount(page);
  const messages = [
    null,
    { ...select, version: 2 },
    { ...select, viewId: 'another-view' },
    { ...select, generation: 2 },
    { ...select, basis: 'new-report' },
    { ...select, objectIds: ['row-a', 'unknown'] },
    { ...select, objectIds: ['row-a', 'row-a'] },
    { ...select, objectIds: [] },
    { ...select, objectIds: Array.from({ length: 101 }, (_, index) => `object-${index}`) },
    {
      ...select,
      objectIds: Array.from({ length: 100 }, (_, index) => `${index}${'界'.repeat(500)}`),
    },
    { ...select, request: 'a'.repeat(4097) },
    { ...select, ref: snapshot.resource.ref },
    { ...select, sessionId: 'another-receiver' },
    { ...envelope, type: 'ready' },
    { ...envelope, type: 'queued' },
  ];
  expect(
    await page.evaluate((messages) => {
      const f = Reflect.get(window, 'fixture');
      const key = `${f.session.draftKey}|context-items`;
      const before = f.readDraft(key);
      let notifications = 0;
      const stop = f.subscribeDraft(key, () => notifications++);
      const replies = messages.map((message) => Reflect.get(window, 'consumer').receive(message));
      stop();
      return {
        types: replies.map((reply) => reply.type),
        unchanged: before === f.readDraft(key),
        notifications,
      };
    }, messages),
  ).toEqual({ types: messages.map(() => 'error'), unchanged: true, notifications: 0 });
});

test('batch and merged-draft count/byte limits and a refusing receiver never acknowledge partial append', async ({
  page,
}) => {
  await mount(page);
  const results = await page.evaluate(
    ({ snapshot, envelope, select }) => {
      const f = Reflect.get(window, 'fixture');
      const key = `${f.session.draftKey}|context-items`;
      f.session.appendContextItems([
        {
          kind: 'text',
          itemId: 'large-original',
          ref: snapshot.resource.ref,
          basis: 'report-v1',
          quote: '界'.repeat(8192),
          contentState: 'saved',
        },
      ]);
      const before = f.readDraft(key);
      let notifications = 0;
      const stop = f.subscribeDraft(key, () => notifications++);
      const results = [
        { count: 17, semantics: 'short' },
        { count: 3, semantics: '界'.repeat(8192) },
        { count: 15, semantics: 'short' },
        { count: 2, semantics: '界'.repeat(8192) },
      ].map(({ count, semantics }) => {
        const current = structuredClone(snapshot);
        current.manifest.objects = Array.from({ length: count }, (_, index) => ({
          objectId: `item-${index}`,
          name: 'Item',
          semantics,
        }));
        const consumer = f.createReportContext({
          ...envelope,
          snapshot: current,
          appendContextItems: f.context.appendContextItems,
        });
        return consumer.receive({
          ...select,
          objectIds: current.manifest.objects.map((item) => item.objectId),
        });
      });
      const refused = f
        .createReportContext({ ...envelope, snapshot, appendContextItems: () => false })
        .receive(select);
      stop();
      return {
        types: [...results, refused].map((reply) => reply.type),
        codes: results.map((reply) => reply.error.code),
        unchanged: before === f.readDraft(key),
        notifications,
      };
    },
    { snapshot, envelope, select },
  );
  expect(results).toEqual({
    types: Array(5).fill('error'),
    codes: ['tooLarge', 'tooLarge', 'unavailable', 'unavailable'],
    unchanged: true,
    notifications: 0,
  });
});

test('page disposal, snapshot capture and real receiver replacement keep old callbacks from affecting either draft', async ({
  page,
}) => {
  await mount(page);
  expect(
    await page.evaluate(
      ({ snapshot, envelope, select }) => {
        const f = Reflect.get(window, 'fixture');
        const current = structuredClone(snapshot);
        const consumer = f.createReportContext({
          ...envelope,
          snapshot: current,
          appendContextItems: f.context.appendContextItems,
        });
        current.manifest.objects = current.manifest.objects.map((item) => ({
          ...item,
          semantics: 'Later snapshot mutation',
        }));
        consumer.receive(select);
        const key = `${f.session.draftKey}|context-items`;
        const items = JSON.parse(f.readDraft(key));
        const before = f.readDraft(key);
        consumer.dispose();
        consumer.dispose();
        const disposed = consumer.receive(select);
        const next = f.createReportContext({
          ...envelope,
          generation: 2,
          snapshot,
          appendContextItems: f.context.appendContextItems,
        });
        const oldGeneration = next.receive(select);
        return {
          semantics: items[1].semantics,
          disposed: disposed.type,
          oldGeneration: oldGeneration.type,
          unchanged: before === f.readDraft(key),
        };
      },
      { snapshot, envelope, select },
    ),
  ).toEqual({ semantics: 'Dose 10', disposed: 'error', oldGeneration: 'error', unchanged: true });
  const firstKey = JSON.parse(await page.getByLabel('report-context-state').innerText()).key;
  await page.getByRole('button', { name: 'Second receiver', exact: true }).click();
  await expect(page.getByLabel('report-context-state')).toContainText('"session":"second"');
  for (const back of [false, true]) {
    if (back) {
      await page.getByRole('button', { name: 'First receiver', exact: true }).click();
      await expect(page.getByLabel('report-context-state')).toContainText('"session":"first"');
    }
    expect(
      await page.evaluate(
        ({ firstKey, select }) => {
          const f = Reflect.get(window, 'fixture');
          const original = f.readDraft(`${firstKey}|context-items`);
          const currentKey = `${f.session.draftKey}|context-items`;
          const current = f.readDraft(currentKey);
          const reply = Reflect.get(window, 'consumer').receive(select);
          return {
            type: reply.type,
            originalUnchanged: original === f.readDraft(`${firstKey}|context-items`),
            currentUnchanged: current === f.readDraft(currentKey),
          };
        },
        { firstKey, select },
      ),
    ).toEqual({ type: 'error', originalUnchanged: true, currentUnchanged: true });
  }
  expect(
    await page.evaluate(
      ({ snapshot, envelope, select }) => {
        const f = Reflect.get(window, 'fixture');
        return f
          .createReportContext({
            ...envelope,
            snapshot,
            appendContextItems: f.context.appendContextItems,
          })
          .receive(select).type;
      },
      { snapshot, envelope, select },
    ),
  ).toBe('queued');
});
