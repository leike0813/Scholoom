import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { build } from '../../packages/editor/node_modules/esbuild/lib/main.js';
import type {
  FileChangeCursor,
  FileChangesResult,
  FileEdit,
  FileEditOrigin,
} from '../../packages/protocol/dist/projects.js';

const projectId = 'historyProject';
const createdAt = '2026-01-01T12:00:00.000Z';
let script = '';

test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {MaterialHistory} from './src/renderer/src/workbench/MaterialChangeView';
        const calls=[],pending=new Map();let sequence=0;
        const fixture={calls,changed:0,
          resolve(id,value){const gate=pending.get(id);if(!gate)throw Error('Unknown gate');pending.delete(id);gate.resolve(value)},
          reject(id,code){const gate=pending.get(id);if(!gate)throw Error('Unknown gate');pending.delete(id);gate.reject(Object.assign(Error('Controlled response'),{code}))}
        };
        window.materialHistoryFixture=fixture;
        // Only the KernelClient request boundary is substituted; the history UI is real.
        const client={call(method,params){
          const id=++sequence;calls.push({id,method,params});
          if(!['files.changes','files.edit','files.undo'].includes(method))
            return Promise.reject(Error('Unexpected operation: '+method));
          return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
        }};
        function App(){
          const [fileId,setFileId]=React.useState('fileA'),[open,setOpen]=React.useState(true),
            [canUndo,setCanUndo]=React.useState(true);
          return <>
            <button onClick={()=>setFileId(value=>value==='fileA'?'fileB':'fileA')}>切换测试文件</button>
            <button onClick={()=>setOpen(true)}>重新打开测试历史</button>
            <button onClick={()=>setOpen(value=>!value)}>切换测试可读状态</button>
            <button onClick={()=>setCanUndo(value=>!value)}>切换测试撤销能力</button>
            {<MaterialHistory key={'${projectId}:'+fileId} client={client} projectId="${projectId}" visible={open}
              fileId={fileId} canUndo={canUndo} onChanged={async()=>{fixture.changed++}}
              onClose={()=>setOpen(false)}/>}
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
  script = result.outputFiles[0]?.text ?? '';
});

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><div id="root"></div>');
  await page.addScriptTag({ content: script });
});

interface Request {
  id: number;
  method: string;
  params: Record<string, unknown>;
}

async function calls(page: Page, method?: string): Promise<Request[]> {
  const all: Request[] = await page.evaluate(
    () => Reflect.get(window, 'materialHistoryFixture').calls,
  );
  return method ? all.filter((call) => call.method === method) : all;
}

async function request(page: Page, method: string, index = 0): Promise<Request> {
  await expect.poll(async () => (await calls(page, method)).length).toBeGreaterThan(index);
  const call = (await calls(page, method))[index];
  if (!call) throw new Error('Expected request was not captured');
  return call;
}

async function respond(page: Page, call: Request, value: unknown) {
  await page.evaluate(
    async ({ id, result }) => {
      Reflect.get(window, 'materialHistoryFixture').resolve(id, result);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    },
    { id: call.id, result: value },
  );
}

function record(id: string, fileId = 'fileA', origin?: FileEditOrigin): FileEdit {
  return {
    id,
    fileId,
    path: `notes/${fileId}.md`,
    createdAt,
    basis: `undoOnly:${id}`,
    before: `BEFORE ${id}`,
    after: `AFTER ${id}`,
    ...(origin ? { origin } : {}),
  };
}

function summaries(edits: FileEdit[], nextCursor?: FileChangeCursor): FileChangesResult {
  return {
    changes: edits.map((edit) => ({
      editId: edit.id,
      fileId: edit.fileId ?? 'fileA',
      createdAt: edit.createdAt,
      ...(edit.origin ? { origin: edit.origin } : {}),
      ...(edit.beforeEvidence ? { beforeEvidence: edit.beforeEvidence } : {}),
      ...(edit.afterEvidence ? { afterEvidence: edit.afterEvidence } : {}),
    })),
    coverage: { anchor: 'missing', retention: 'pruned', current: 'changedOrUnrecorded' },
    ...(nextCursor ? { nextCursor } : {}),
  };
}

const history = (page: Page) => page.getByRole('region', { name: '文件修改历史', exact: true });
const selected = (page: Page) =>
  history(page).getByRole('region', { name: '选定修改', exact: true });
const field = (view: Locator, label: string) =>
  view.getByRole('term').filter({ hasText: label }).locator('xpath=following-sibling::dd[1]');

async function choose(page: Page, edit: FileEdit, index: number) {
  await history(page)
    .getByRole('button', { name: `查看修改 ${edit.id}`, exact: true })
    .click();
  const call = await request(page, 'files.edit', index);
  expect(call.params).toEqual({ projectId, fileId: edit.fileId, editId: edit.id });
  await respond(page, call, edit);
  await expect(selected(page)).toContainText(edit.after);
}

test('bounded summaries preserve coverage gaps and cursor values without eager bodies or accumulated pages', async ({
  page,
}) => {
  const edits = Array.from({ length: 10 }, (_, index) => record(`edit${index}`));
  const cursor: FileChangeCursor = {
    projectId,
    fileId: 'fileA',
    anchor: 'missing',
    afterEditId: 'missingAnchor',
    fromEditId: 'edit0',
    throughEditId: 'edit9',
    beforeEditId: 'edit9',
  };
  const initial = await request(page, 'files.changes');
  expect(initial.params).toEqual({ projectId, fileId: 'fileA', limit: 10 });
  await respond(page, initial, summaries(edits, cursor));
  await expect(history(page).getByRole('button', { name: /^查看修改 / })).toHaveCount(10);
  expect(await calls(page, 'files.history')).toEqual([]);
  expect(await calls(page, 'files.edit')).toEqual([]);
  const coverage = history(page).getByRole('status', { name: '历史覆盖范围', exact: true });
  await expect(coverage).toContainText(/缺口|未找到/);
  await expect(coverage).toContainText(/清理|裁剪/);
  await expect(coverage).toContainText(/未记录|已变化/);
  const first = edits[0],
    second = edits[1];
  if (!first || !second) throw new Error('Two selected records are required');
  await choose(page, first, 0);
  await choose(page, second, 1);
  await expect(selected(page)).toHaveCount(1);
  await expect(selected(page)).not.toContainText(first.after);
  await history(page).getByRole('button', { name: '更早修改', exact: true }).click();
  const next = await request(page, 'files.changes', 1);
  expect(next.params).toEqual({ projectId, fileId: 'fileA', limit: 10, cursor });
  await respond(page, next, summaries([]));
  await expect(history(page).getByRole('button', { name: /^查看修改 / })).toHaveCount(0);
  await expect(selected(page)).toHaveCount(0);
  await expect(history(page).getByText(/不能.*确认.*没有变化/)).toBeVisible();
  await expect(coverage).toContainText(/未记录|已变化/);
  expect((await calls(page, 'files.edit')).map((call) => call.params.editId)).toEqual([
    'edit0',
    'edit1',
  ]);
  expect(await calls(page, 'files.history')).toEqual([]);
});

test('legacy metadata stays unknown while real principals, evidence and execution fields remain distinct', async ({
  page,
}) => {
  const execution: FileEditOrigin = {
    kind: 'execution',
    projectId,
    moduleId: 'harnessRecorded',
    principal: { kind: 'agent', id: 'agentRecorded' },
    sessionId: 'sessionRecorded',
    runId: 'runRecorded',
    instanceId: 'instanceRecorded',
    instructionContext: { state: 'unknown', reason: 'notCaptured' },
    tool: { state: 'unknown', reason: 'notBound' },
  };
  const edits = [
    record('legacyMissing'),
    record('legacyExplicit', 'fileA', { kind: 'unknown', reason: 'legacy' }),
    record('human', 'fileA', {
      kind: 'human',
      projectId,
      moduleId: 'projectsRecorded',
      principal: { kind: 'human', id: 'humanRecorded' },
    }),
    record('system', 'fileA', {
      kind: 'system',
      projectId,
      moduleId: 'maintenanceRecorded',
      principal: { kind: 'system', id: 'systemRecorded' },
    }),
    record('execution', 'fileA', execution),
    record('observed', 'fileA', {
      ...execution,
      instructionContext: { state: 'observed', instructionIds: ['instructionRecorded'] },
      delegation: {
        delegationId: 'delegationRecorded',
        parentRunId: 'parentRunRecorded',
        parentInstanceId: 'parentInstanceRecorded',
      },
    }),
  ];
  const human = edits[2];
  if (!human) throw new Error('Human fixture is required');
  human.beforeEvidence = {
    ref: { source: 'project', projectId, fileId: 'fileA' },
    basis: 'beforeRecorded',
  };
  human.afterEvidence = {
    ref: { source: 'project', projectId, fileId: 'fileA' },
    basis: 'afterRecorded',
  };
  await respond(page, await request(page, 'files.changes'), summaries(edits));
  for (const [index, edit] of edits.entries()) {
    await choose(page, edit, index);
    const view = selected(page);
    await expect(field(view, '修改理由')).toContainText(/未知|未提供/);
    if (!edit.origin || edit.origin.kind === 'unknown') {
      await expect(field(view, '执行者')).toContainText('未知');
      await expect(field(view, '修改前依据')).toContainText(/未知|未记录/);
      await expect(field(view, '修改后依据')).toContainText(/未知|未记录/);
      await expect(view).not.toContainText(`undoOnly:${edit.id}`);
    } else {
      await expect(field(view, '执行者')).toContainText(edit.origin.principal.id);
      await expect(field(view, '执行者')).toContainText(edit.origin.moduleId);
      if (edit.origin.kind === 'human') {
        await expect(field(view, '执行者')).toContainText('人工');
        await expect(field(view, '修改前依据')).toContainText('beforeRecorded');
        await expect(field(view, '修改后依据')).toContainText('afterRecorded');
      } else if (edit.origin.kind === 'system') {
        await expect(field(view, '执行者')).toContainText('系统');
      } else {
        for (const id of [edit.origin.sessionId, edit.origin.runId, edit.origin.instanceId])
          await expect(view).toContainText(id);
        await expect(field(view, '单次修改对应指令')).toContainText('未知');
        await expect(field(view, '工具关联')).toContainText('未知');
        if (edit.origin.instructionContext.state === 'unknown') {
          await expect(field(view, '执行指令集合')).toContainText('未知');
          await expect(field(view, '委派关联')).toContainText('未知');
        } else {
          await expect(field(view, '执行指令集合')).toContainText('instructionRecorded');
          for (const id of ['delegationRecorded', 'parentRunRecorded', 'parentInstanceRecorded'])
            await expect(field(view, '委派关联')).toContainText(id);
        }
      }
    }
  }
});

test('late selected bodies cannot reopen a closed view or cross the parent file identity key', async ({
  page,
}) => {
  const old = record('closedBody');
  await respond(page, await request(page, 'files.changes'), summaries([old]));
  await history(page)
    .getByRole('button', { name: `查看修改 ${old.id}`, exact: true })
    .click();
  const closedRead = await request(page, 'files.edit');
  await history(page).getByRole('button', { name: '关闭修改历史', exact: true }).click();
  await respond(page, closedRead, old);
  await expect(history(page)).toHaveCount(0);
  await expect(page.getByText(old.after, { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: '重新打开测试历史', exact: true }).click();
  const stale = record('staleFileA');
  await respond(page, await request(page, 'files.changes', 1), summaries([stale]));
  await history(page)
    .getByRole('button', { name: `查看修改 ${stale.id}`, exact: true })
    .click();
  const oldRead = await request(page, 'files.edit', 1);
  await page.getByRole('button', { name: '切换测试文件', exact: true }).click();
  const changed = await request(page, 'files.changes', 2);
  expect(changed.params).toEqual({ projectId, fileId: 'fileB', limit: 10 });
  const current = record('currentFileB', 'fileB');
  await respond(page, changed, summaries([current]));
  await choose(page, current, 2);
  await respond(page, oldRead, stale);
  await expect(selected(page)).toHaveCount(1);
  await expect(selected(page)).toContainText(current.after);
  await expect(history(page)).not.toContainText(stale.after);
  await expect(
    history(page).getByRole('button', { name: `查看修改 ${stale.id}`, exact: true }),
  ).toHaveCount(0);
});

test('undo respects draft/read-only capability, suppresses duplicates and never replays an unknown outcome', async ({
  page,
}) => {
  const edit = record('undoCandidate');
  await respond(page, await request(page, 'files.changes'), summaries([edit]));
  await choose(page, edit, 0);
  const undo = selected(page).getByRole('button', { name: '撤销此修改', exact: true });
  await page.getByRole('button', { name: '切换测试撤销能力', exact: true }).click();
  await expect(undo).toBeDisabled();
  await undo.evaluate((button) => (button as HTMLButtonElement).click());
  expect(await calls(page, 'files.undo')).toEqual([]);
  await page.getByRole('button', { name: '切换测试撤销能力', exact: true }).click();
  await expect(undo).toBeEnabled();
  await undo.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  const undoRequest = await request(page, 'files.undo');
  expect(undoRequest.params).toEqual({ projectId, editId: edit.id });
  await expect(undo).toBeDisabled();
  expect(await calls(page, 'files.undo')).toHaveLength(1);
  await expect(
    history(page).getByRole('button', { name: '关闭修改历史', exact: true }),
  ).toBeDisabled();
  await page.evaluate(async (id) => {
    Reflect.get(window, 'materialHistoryFixture').reject(id, 'outcomeUnknown');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }, undoRequest.id);
  await expect(history(page).getByRole('alert')).toContainText('outcomeUnknown');
  await expect(selected(page)).toContainText(edit.before);
  await expect(selected(page)).toContainText(edit.after);
  await expect(
    history(page)
      .getByRole('status')
      .filter({ hasText: /结果未知|待核查/ }),
  ).toBeVisible();
  await expect(undo).toBeDisabled();
  await history(page).getByRole('button', { name: '重读修改历史', exact: true }).click();
  await respond(page, await request(page, 'files.changes', 1), summaries([edit]));
  await choose(page, edit, 1);
  await expect(undo).toBeDisabled();
  expect(await calls(page, 'files.undo')).toHaveLength(1);
  expect(await page.evaluate(() => Reflect.get(window, 'materialHistoryFixture').changed)).toBe(0);
  expect(await calls(page, 'files.history')).toEqual([]);
});

test('closing and reopening history preserves unknown undo protection within the file view', async ({
  page,
}) => {
  const edit = record('unknownAcrossClose');
  await respond(page, await request(page, 'files.changes'), summaries([edit]));
  await choose(page, edit, 0);
  await selected(page).getByRole('button', { name: '撤销此修改', exact: true }).click();
  const pending = await request(page, 'files.undo');
  await page.evaluate(
    (id) => Reflect.get(window, 'materialHistoryFixture').reject(id, 'outcomeUnknown'),
    pending.id,
  );
  await expect(history(page).getByRole('alert')).toContainText('outcomeUnknown');
  await history(page).getByRole('button', { name: '关闭修改历史', exact: true }).click();
  await expect(history(page)).toHaveCount(0);
  await page.getByRole('button', { name: '重新打开测试历史', exact: true }).click();
  await respond(page, await request(page, 'files.changes', 1), summaries([edit]));
  await choose(page, edit, 1);
  await expect(
    selected(page).getByRole('button', { name: '撤销此修改', exact: true }),
  ).toBeDisabled();
  expect(await calls(page, 'files.undo')).toHaveLength(1);
});

test('temporary disconnection hides bodies and retains a pending unknown undo across reconnection', async ({
  page,
}) => {
  const edit = record('unknownAcrossConnection');
  await respond(page, await request(page, 'files.changes'), summaries([edit]));
  await choose(page, edit, 0);
  await selected(page).getByRole('button', { name: '撤销此修改', exact: true }).click();
  const pending = await request(page, 'files.undo');
  await page.getByRole('button', { name: '切换测试可读状态', exact: true }).click();
  await expect(history(page)).toHaveCount(0);
  await page.evaluate(
    (id) => Reflect.get(window, 'materialHistoryFixture').reject(id, 'outcomeUnknown'),
    pending.id,
  );
  await expect(page.getByText(edit.after, { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: '切换测试可读状态', exact: true }).click();
  await respond(page, await request(page, 'files.changes', 1), summaries([edit]));
  await choose(page, edit, 1);
  await expect(
    selected(page).getByRole('button', { name: '撤销此修改', exact: true }),
  ).toBeDisabled();
  expect(await calls(page, 'files.undo')).toHaveLength(1);
});
