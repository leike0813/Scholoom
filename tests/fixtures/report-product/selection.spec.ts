/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createKernelClient } from '../../../packages/client/dist/index.js';
import { businessSchemas } from '../../../packages/protocol/dist/business.js';
import type { ReportManifest } from '../../../packages/protocol/dist/report-contracts.js';
import { runningKernel } from '../../kernel-fixture.js';
import { addProject, createSession, expect, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';

type SelectionAction = { label: string; objectIds: string[] };

function reportHTML(
  title: string,
  objects: ReportManifest['objects'],
  actions: SelectionAction[],
): string {
  const manifest: ReportManifest = { version: 1, resources: [], sources: [], objects };
  const header = JSON.stringify(manifest).replace(
    /[<>-]/g,
    (value) => `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  return `<!--scholoom-report-v1\n${header}\n-->
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
<main>
  <h1>${title}</h1>
  ${actions.map((action, index) => `<button type="button" id="select-${index}">${action.label}</button>`).join('\n')}
  <p id="attempt" role="status" aria-label="Selection attempt">idle</p>
  <p id="reply" role="status" aria-label="Selection reply">idle</p>
  <section aria-label="Report objects">
    ${objects.map((object) => `<article id="${object.objectId}" data-object="${object.objectId}"><h2>${object.name}</h2><p>${object.semantics}</p></article>`).join('\n')}
  </section>
</main>
<script>
(() => {
  const actions = ${JSON.stringify(actions)};
  const attempt = document.getElementById('attempt');
  const reply = document.getElementById('reply');
  let sequence = 0;
  actions.forEach((action, index) => {
    document.getElementById('select-' + index).addEventListener('click', () => {
      sequence++;
      attempt.textContent = sequence + ':' + action.label + ':' + action.objectIds.length;
      reply.textContent = sequence + ':pending';
      scholoomReport.postMessage({ type: 'select', objectIds: action.objectIds, request: 'Review this selection without sending.' });
    });
  });
  scholoomReport.addEventListener('message', ({ data }) => {
    if (!data || (data.type !== 'queued' && data.type !== 'error')) return;
    reply.textContent = sequence + ':' + data.type + (data.type === 'error' ? ':' + data.error.code : '');
  });
})();
</script>
</body>
</html>`;
}

test('installed report preserves an explicit R1 selection on R2 and atomically rejects excess or unknown objects', async ({
  uiPage: ui,
  uiHost,
  uiRpc,
}, info) => {
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  assert(directory && process.env.SCHOOLOOM_REPORT_PRODUCT_RUN);
  await mkdir(info.outputDir, { recursive: true });
  const root = info.outputPath('project');
  const evidence: Record<string, unknown> = {
    host: uiHost,
    pageProgram: 'installed production bootstrap',
    model: 'no model configured by this test; no send action',
  };
  const checks: unknown[] = [];
  evidence.checks = checks;
  const client = createKernelClient(await runningKernel(directory));
  try {
    await client.connect();
    const project = await client.call('project.create', { path: root, trust: 'trusted' });
    const objectId = 'retained-observation';
    const r1Excerpt = 'R1 evidence: the original observation is 11.';
    const r2Excerpt = 'R2 evidence: the revised observation is 29.';
    const selection = [{ label: 'Select observation', objectIds: [objectId] }];
    const originalHTML = reportHTML(
      'Selection report R1',
      [{ objectId, name: 'Retained observation', semantics: r1Excerpt }],
      selection,
    );
    const revisedHTML = reportHTML(
      'Selection report R2',
      [{ objectId, name: 'Retained observation', semantics: r2Excerpt }],
      selection,
    );
    const bulkObjects = Array.from({ length: 20 }, (_, index) => ({
      objectId: `bulk-object-${index + 1}`,
      name: `Bulk observation ${index + 1}`,
      semantics: `Bulk evidence ${index + 1}`,
    }));
    await client.call('files.save', {
      projectId: project.id,
      path: 'selection-report.html',
      content: originalHTML,
    });
    await client.call('files.save', {
      projectId: project.id,
      path: 'bulk-report.html',
      content: reportHTML('Bulk selection report', bulkObjects, [
        { label: 'Select 20 objects', objectIds: bulkObjects.map((object) => object.objectId) },
        {
          label: 'Select 16 objects',
          objectIds: bulkObjects.slice(0, 16).map((object) => object.objectId),
        },
        { label: 'Select unknown object', objectIds: ['unknown-object'] },
      ]),
    });
    const entry = await client.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'selection-report.html' },
    });
    assert(entry.ref.source === 'project');
    expect(entry.report).toBe(true);
    evidence.original = entry;

    await ui.goto(rendererUrl);
    await addProject(ui, root);
    await createSession(ui, { projectId: project.id });
    const sessionId = await ui
      .getByRole('button', { name: /^打开会话 /, pressed: true })
      .evaluate((button) => button.closest('li')?.getAttribute('data-session-id'));
    assert(sessionId);
    const scope = { projectId: project.id, sessionId };
    const noExecution = async (stage: string) => {
      const snapshot = await client.call('workbench.snapshot', scope);
      expect(snapshot.run).toBeUndefined();
      expect(snapshot.messages.filter((message) => message.role === 'user')).toHaveLength(0);
      checks.push({ stage, scope, run: snapshot.run ?? null, messages: snapshot.messages });
    };
    await noExecution('before-opening');
    await ui
      .getByRole('treeitem', { name: '打开文件 selection-report.html', exact: true })
      .dblclick();
    const report = ui.getByRole('region', { name: '交互报告 selection-report.html', exact: true });
    const frame = report.frameLocator('iframe[title="交互报告"]');
    const wait = { timeout: businessSchemas['resources.reportOpen'].semantics.waitMs };
    await expect(report.getByRole('status').first()).toHaveText('报告已就绪', wait);
    await expect(
      frame.getByRole('heading', { name: 'Selection report R1', exact: true }),
    ).toBeVisible(wait);
    await expect(frame.locator(`article[id="${objectId}"]`)).toContainText(r1Excerpt);
    const composer = ui.getByRole('textbox', { name: '研究指令', exact: true });
    const body = 'Keep the R1 evidence for review; do not execute this draft.';
    await composer.fill(body);
    await frame.getByRole('button', { name: 'Select observation', exact: true }).click();
    await expect(frame.getByRole('status', { name: 'Selection attempt', exact: true })).toHaveText(
      '1:Select observation:1',
    );
    await expect(frame.getByRole('status', { name: 'Selection reply', exact: true })).toHaveText(
      '1:queued',
    );

    const inspectRetained = async (stage: string) => {
      await expect(composer).toHaveValue(body);
      const inspector = ui.getByRole('region', { name: '附加上下文', exact: true });
      const toggle = inspector.getByLabel('查看附加上下文', { exact: true });
      await expect(toggle).toContainText('1 个附加项');
      await toggle.click();
      const items = inspector.locator('.menu__body > details');
      await expect(items).toHaveCount(1);
      const item = items.first();
      if ((await item.getAttribute('open')) === null) await item.locator('summary').click();
      await expect(item.getByText(r1Excerpt, { exact: true })).toBeVisible();
      await expect(item.getByText(entry.basis, { exact: false })).toBeVisible();
      await expect(item.getByText(r2Excerpt, { exact: true })).toHaveCount(0);
      checks.push({
        stage,
        visibleContext: await item.innerText(),
        composer: await composer.inputValue(),
      });
      await ui.screenshot({ path: info.outputPath(`${stage}.png`), fullPage: true });
      await toggle.click();
      await noExecution(stage);
    };
    await inspectRetained('selected-r1');

    // A full read supplies the conditional-save lease; describe's resource basis does not.
    const read = await client.call('files.read', {
      projectId: project.id,
      path: 'selection-report.html',
    });
    expect(read.truncated).toBe(false);
    expect(read.content).toBe(originalHTML);
    expect(read.fileId).toBe(entry.ref.fileId);
    await client.call('files.save', {
      projectId: project.id,
      path: 'selection-report.html',
      content: revisedHTML,
      basis: read.basis,
    });
    const changed = await client.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, fileId: entry.ref.fileId },
    });
    expect(changed.ref).toEqual(entry.ref);
    expect(changed.basis).not.toBe(entry.basis);
    evidence.revised = changed;
    await expect(report.getByRole('button', { name: '查看新版', exact: true })).toBeEnabled(wait);
    await expect(
      frame.getByRole('heading', { name: 'Selection report R1', exact: true }),
    ).toBeVisible();
    await expect(frame.locator(`article[id="${objectId}"]`)).toContainText(r1Excerpt);
    await inspectRetained('r2-pending-keeps-r1');
    await report.getByRole('button', { name: '查看新版', exact: true }).click();
    await expect(
      frame.getByRole('heading', { name: 'Selection report R2', exact: true }),
    ).toBeVisible(wait);
    await expect(frame.locator(`article[id="${objectId}"]`)).toContainText(r2Excerpt);
    await inspectRetained('r2-visible-keeps-r1-context');

    await ui.getByRole('treeitem', { name: '打开文件 bulk-report.html', exact: true }).dblclick();
    const bulk = ui.getByRole('region', { name: '交互报告 bulk-report.html', exact: true });
    const bulkFrame = bulk.frameLocator('iframe[title="交互报告"]');
    await expect(bulk.getByRole('status').first()).toHaveText('报告已就绪', wait);
    await expect(
      bulkFrame.getByRole('heading', { name: 'Bulk selection report', exact: true }),
    ).toBeVisible(wait);
    await expect(bulkFrame.locator('article')).toHaveCount(20);
    expect(
      await bulkFrame.locator('article').evaluateAll((nodes) => nodes.map((node) => node.id)),
    ).toEqual(bulkObjects.map((object) => object.objectId));
    await expect(bulkFrame.locator('article')).toContainText(
      bulkObjects.map((object) => object.semantics),
    );
    const attempt = bulkFrame.getByRole('status', { name: 'Selection attempt', exact: true });
    const reply = bulkFrame.getByRole('status', { name: 'Selection reply', exact: true });
    await bulkFrame.getByRole('button', { name: 'Select 20 objects', exact: true }).click();
    await expect(attempt).toHaveText('1:Select 20 objects:20');
    await expect(reply).toHaveText('1:error:tooLarge');
    await expect(bulk.getByRole('alert')).toBeVisible();
    await inspectRetained('bulk-rejected-without-partial-append');
    // Sixteen incoming items pass report validation but exceed the composer cap with the R1 item.
    await bulkFrame.getByRole('button', { name: 'Select 16 objects', exact: true }).click();
    await expect(attempt).toHaveText('2:Select 16 objects:16');
    await expect(reply).toHaveText('2:error:unavailable');
    await inspectRetained('merged-capacity-rejected-without-partial-append');
    await bulkFrame.getByRole('button', { name: 'Select unknown object', exact: true }).click();
    await expect(attempt).toHaveText('3:Select unknown object:1');
    await expect(reply).toHaveText('3:error:invalidRequest');
    await inspectRetained('unknown-rejected-without-append');
    const observerError = await uiRpc.save(info);
    if (observerError) throw observerError;
  } finally {
    client.dispose();
    await writeFile(info.outputPath('selection.json'), JSON.stringify(evidence, null, 2));
  }
});
