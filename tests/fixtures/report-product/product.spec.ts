/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createKernelClient } from '../../../packages/client/dist/index.js';
import { businessSchemas } from '../../../packages/protocol/dist/business.js';
import type { ResourceDescriptor } from '../../../packages/protocol/dist/resources.js';
import { runningKernel } from '../../kernel-fixture.js';
import { startModelKernel } from '../../model-kernel.js';
import { createModelServer } from '../../model-server.js';
import { addProject, createSession, expect, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';
import { reportCSS, reportPage, reportScript } from './sample.js';

test('installed report carries actual selections through the composer, worker publication and exact original reopen', async ({
  uiPage: ui,
  uiHost,
  uiRpc,
}, info) => {
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  assert(directory && process.env.SCHOOLOOM_REPORT_PRODUCT_RUN);
  await mkdir(info.outputDir, { recursive: true });
  const root = info.outputPath('project');
  let firstHTML = '';
  let secondHTML = '';
  let source: ResourceDescriptor | undefined;
  let continuing = false;
  const model = await createModelServer({
    respond: ({ calls }) => {
      if (continuing) {
        assert(source);
        if (!calls.includes('read_context_resource'))
          return {
            tool: {
              name: 'read_context_resource',
              input: { ref: source.ref, basis: source.basis, encoding: 'utf8' },
            },
          };
        return { text: 'Original source checked in the new conversation.' };
      }
      if (!calls.includes('read_file'))
        return { tool: { name: 'read_file', input: { file_path: '/report.html' } } };
      if (!calls.includes('edit_file'))
        return {
          tool: {
            name: 'edit_file',
            input: { file_path: '/report.html', old_string: firstHTML, new_string: secondHTML },
          },
        };
      return { text: 'The complete second report version was saved.' };
    },
  });
  let stop: (() => Promise<void>) | undefined;
  let client: ReturnType<typeof createKernelClient> | undefined;
  const evidence: Record<string, unknown> = {
    host: uiHost,
    model: 'controlled loopback responses only',
    pageProgram: 'installed production bootstrap',
    domainAndOS: 'real',
  };
  try {
    stop = await startModelKernel(directory, model.url);
    client = createKernelClient(await runningKernel(directory));
    await client.connect();
    const kernel = client;
    await kernel.call('provider.configure', { apiKey: 'synthetic-report-product-key' });
    const project = await kernel.call('project.create', { path: root, trust: 'trusted' });
    await kernel.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const paper = info.outputPath('source.md');
    await writeFile(
      paper,
      '# Source\nPaper A score 10; Paper B score 20. Synthetic mechanical sample.\n',
    );
    const batch = await kernel.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [paper],
      storage: 'linked',
      purpose: '正文',
      version: 'unspecified',
      origin: 'isolated-report-product-test',
    });
    await expect
      .poll(async () => (await kernel.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const imported = (await kernel.call('library.batch', { batchId: batch.id })).entries[0];
    assert(imported?.attachmentId);
    const attachment = await kernel.call('library.attachment', {
      attachmentId: imported.attachmentId,
    });
    source = await kernel.call('resources.describe', {
      locator: {
        source: 'library',
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      },
    });
    const dependencies = [];
    for (const [path, content, mediaType] of [
      ['report.js', reportScript, 'text/javascript'],
      ['report.css', reportCSS, 'text/css'],
    ] as const) {
      await kernel.call('files.save', { projectId: project.id, path, content });
      const file = await kernel.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path },
      });
      dependencies.push({ path, ref: file.ref, basis: file.basis, mediaType });
    }
    const manifest = {
      version: 1,
      resources: dependencies,
      sources: [{ ref: source.ref, basis: source.basis }],
      objects: [
        { objectId: 'paper-a', name: 'Paper A', semantics: 'Paper A score 10', sourceIndexes: [0] },
        { objectId: 'paper-b', name: 'Paper B', semantics: 'Paper B score 20', sourceIndexes: [0] },
      ],
    };
    // Independent wire header; source identities come only from the actual domains.
    const header = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replace(/[<>-]/g, (value) => `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`)}\n-->\n`;
    firstHTML = header + reportPage('R1');
    secondHTML = header + reportPage('R2');
    await kernel.call('files.save', {
      projectId: project.id,
      path: 'report.html',
      content: firstHTML,
    });
    const entry = await kernel.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'report.html' },
    });
    expect(entry.report).toBe(true);
    assert(entry.ref.source === 'project');
    await ui.goto(rendererUrl);
    await addProject(ui, root);
    await createSession(ui, { projectId: project.id });
    const selectedSession = async () => {
      const sessionId = await ui
        .getByRole('button', { name: /^打开会话 /, pressed: true })
        .evaluate((button) => button.closest('li')?.getAttribute('data-session-id'));
      assert(sessionId);
      return { projectId: project.id, sessionId };
    };
    const scope = await selectedSession();
    await ui.getByRole('treeitem', { name: '打开文件 report.html', exact: true }).dblclick();
    const report = ui.getByRole('region', { name: '交互报告 report.html', exact: true });
    const frame = ui.frameLocator('iframe[title="交互报告"]');
    const displayedVersion = (version: 'R1' | 'R2') =>
      expect(
        frame.getByRole('heading', { name: `Comparison ${version}`, exact: true }),
      ).toBeVisible({
        timeout: businessSchemas['resources.reportOpen'].semantics.waitMs,
      });
    await expect(report.getByRole('status').first()).toHaveText('报告已就绪', {
      timeout: businessSchemas['resources.reportOpen'].semantics.waitMs,
    });
    await displayedVersion('R1');
    const filter = frame.getByRole('textbox', { name: 'Report filter', exact: true });
    await filter.fill('Paper A');
    await expect(frame.locator('article:visible')).toHaveCount(1);
    await filter.fill('');
    await frame.getByLabel('Report order', { exact: true }).selectOption('descending');
    await expect
      .poll(() =>
        frame
          .locator('article')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-object'))),
      )
      .toEqual(['paper-b', 'paper-a']);
    await frame.getByRole('button', { name: 'Expand Paper A', exact: true }).click();
    await expect(
      frame.getByRole('button', { name: 'Expand Paper A', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(model.requests).toHaveLength(0);
    expect((await kernel.call('workbench.snapshot', scope)).run).toBeUndefined();
    const note = frame.getByRole('textbox', { name: 'Report note', exact: true });
    await note.fill('Check Paper A against the original source.');
    const composer = ui.getByRole('textbox', { name: '研究指令', exact: true });
    await composer.fill('Publish the revised comparison while preserving the source.');
    await frame.getByRole('button', { name: 'Choose Paper A', exact: true }).click();
    await ui.getByLabel('查看附加上下文', { exact: true }).click();
    const inspector = ui.getByRole('region', { name: '附加上下文', exact: true });
    await inspector.locator('.menu__body > details > summary').first().click();
    const comment = 'Check this fixed object and its declared original source.';
    await expect(ui.getByLabel('上下文批注 1', { exact: true })).toHaveValue(
      'Check Paper A against the original source.',
    );
    await ui.getByLabel('上下文批注 1', { exact: true }).fill(comment);
    await ui.getByLabel('查看附加上下文', { exact: true }).click();
    expect(model.requests).toHaveLength(0);
    model.hold = true;
    await ui.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect.poll(() => model.requests.length, { timeout: 20000 }).toBe(1);
    const sent = (await kernel.call('workbench.snapshot', scope)).messages.find(
      (message) => message.role === 'user',
    );
    assert(sent?.contextItems?.length === 2);
    expect(sent.contextItems[0]).toMatchObject({
      kind: 'object',
      ref: entry.ref,
      basis: entry.basis,
      objectId: 'paper-a',
      providerId: 'report',
      comment,
    });
    expect(sent.contextItems[1]).toMatchObject({
      kind: 'resource',
      ref: source.ref,
      basis: source.basis,
    });
    const unsent = 'Keep this next instruction as a draft.';
    await composer.fill(unsent);
    model.release();
    await expect(ui.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 30000,
    });
    await expect.poll(() => readFile(join(root, 'report.html'), 'utf8')).toBe(secondHTML);
    await expect(report.getByRole('button', { name: '查看新版', exact: true })).toBeEnabled();
    await displayedVersion('R1');
    await expect(note).toHaveValue('Check Paper A against the original source.');
    await expect(composer).toHaveValue(unsent);
    const changed = await kernel.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, fileId: entry.ref.fileId },
    });
    expect(changed.basis).not.toBe(entry.basis);
    const snapshot = await kernel.call('workbench.snapshot', scope);
    expect(snapshot.messages.find((message) => message.tool?.name === 'edit_file')?.state).toBe(
      'complete',
    );
    expect(snapshot.artifacts.some((artifact) => artifact.path === 'report.html')).toBe(true);
    const edits = await kernel.call('files.changes', {
      projectId: project.id,
      fileId: entry.ref.fileId,
    });
    expect(edits.changes.some((edit) => edit.origin?.kind === 'execution')).toBe(true);
    evidence.publication = {
      scope,
      entry,
      changed,
      sent,
      run: snapshot.run,
      artifacts: snapshot.artifacts,
      edits: edits.changes,
    };
    await report.getByRole('button', { name: '查看新版', exact: true }).click();
    await displayedVersion('R2');
    await expect(note).toHaveValue('');
    await expect(composer).toHaveValue(unsent);
    await ui.getByRole('button', { name: '关闭 report.html', exact: true }).click();
    await expect(ui.locator('iframe[title="交互报告"]')).toHaveCount(0);
    await ui.getByRole('treeitem', { name: '打开文件 report.html', exact: true }).dblclick();
    await report.getByLabel('保存的报告版本').selectOption(entry.basis);
    await displayedVersion('R1');
    await expect(note).toHaveValue('Check Paper A against the original source.');
    await expect(frame.getByLabel('Report order', { exact: true })).toHaveValue('descending');
    await expect(
      frame.getByRole('button', { name: 'Expand Paper A', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(composer).toHaveValue(unsent);
    continuing = true;
    await createSession(ui, { projectId: project.id });
    const resumedScope = await selectedSession();
    expect(resumedScope.sessionId).not.toBe(scope.sessionId);
    await displayedVersion('R1');
    await note.fill('Continue with Paper B and the retained original source.');
    await frame.getByRole('button', { name: 'Choose Paper B', exact: true }).click();
    await expect(ui.getByRole('region', { name: '附加上下文', exact: true })).toContainText(
      '2 个附加项',
    );
    await composer.fill('Continue checking the saved original report.');
    await ui.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect(ui.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
      timeout: 30000,
    });
    const resumed = await kernel.call('workbench.snapshot', resumedScope);
    const resumedInput = resumed.messages.find((message) => message.role === 'user');
    assert(resumedInput?.contextItems?.length === 2);
    expect(resumedInput.contextItems[0]).toMatchObject({
      kind: 'object',
      objectId: 'paper-b',
      basis: entry.basis,
    });
    expect(JSON.stringify(model.requests.at(-1)?.messages)).toContain(
      'Synthetic mechanical sample.',
    );
    expect(await readFile(join(root, 'report.html'), 'utf8')).toBe(secondHTML);
    evidence.continuation = { scope: resumedScope, message: resumedInput, run: resumed.run };
    await ui.screenshot({ path: info.outputPath('report-product.png'), fullPage: true });
    await ui.getByRole('button', { name: '关闭 report.html', exact: true }).click();
    await expect(ui.locator('iframe[title="交互报告"]')).toHaveCount(0);
    await expect(composer).toHaveValue('');
    await expect(ui.getByRole('region', { name: '附加上下文', exact: true })).toHaveCount(0);
    await kernel.call('files.save', {
      projectId: project.id,
      path: 'clean-report.html',
      content: firstHTML,
    });
    await ui.getByRole('treeitem', { name: '打开文件 clean-report.html', exact: true }).dblclick();
    const cleanReport = ui.getByRole('region', { name: '交互报告 clean-report.html', exact: true });
    await displayedVersion('R1');
    await filter.fill('Paper A');
    await expect(frame.locator('article:visible')).toHaveCount(1);
    await frame.getByLabel('Report order', { exact: true }).selectOption('descending');
    await frame.getByRole('button', { name: 'Expand Paper A', exact: true }).click();
    await expect(
      frame.getByRole('button', { name: 'Expand Paper A', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
    const cleanOriginal = await kernel.call('files.read', {
      projectId: project.id,
      path: 'clean-report.html',
    });
    expect(cleanOriginal.truncated).toBe(false);
    expect(cleanOriginal.content).toBe(firstHTML);
    await kernel.call('files.save', {
      projectId: project.id,
      path: 'clean-report.html',
      content: secondHTML,
      basis: cleanOriginal.basis,
    });
    await displayedVersion('R2');
    await expect(filter).toHaveValue('Paper A');
    await expect(frame.locator('article:visible')).toHaveCount(1);
    await expect(frame.getByLabel('Report order', { exact: true })).toHaveValue('descending');
    await expect(
      frame.getByRole('button', { name: 'Expand Paper A', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(note).toHaveValue('');
    await expect(cleanReport.getByRole('button', { name: '查看新版', exact: true })).toHaveCount(0);
    const cleanEntry = await kernel.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'clean-report.html' },
    });
    const retained = 'Retain this instruction when source access is revoked.';
    await composer.fill(retained);
    await frame.getByRole('button', { name: 'Choose Paper A', exact: true }).click();
    await expect(ui.getByRole('region', { name: '附加上下文', exact: true })).toContainText(
      '2 个附加项',
    );
    const requestsBeforeRevocation = model.requests.length;
    await kernel.call('library.grant', {
      read: false,
      write: false,
      send: false,
      autoBackup: false,
    });
    await expect(ui.locator('iframe[title="交互报告"]')).toHaveCount(0);
    await expect(cleanReport.getByRole('alert')).toBeVisible();
    await expect(composer).toHaveValue(retained);
    await expect(ui.getByRole('region', { name: '附加上下文', exact: true })).toContainText(
      '2 个附加项',
    );
    expect(model.requests).toHaveLength(requestsBeforeRevocation);
    await expect(
      kernel.call('resources.report', { ref: cleanEntry.ref, basis: cleanEntry.basis }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    evidence.unprotectedUpdateAndRevocation = {
      entry: cleanEntry,
      source: source.ref,
      requestsBeforeRevocation,
      requestsAfterRevocation: model.requests.length,
      composerRetained: true,
    };
    await ui.screenshot({ path: info.outputPath('report-revoked.png'), fullPage: true });
    await ui.getByRole('button', { name: '关闭 clean-report.html', exact: true }).click();
    const observerError = await uiRpc.save(info);
    if (observerError) throw observerError;
  } finally {
    model.release();
    client?.dispose();
    try {
      await stop?.();
    } finally {
      await model.close();
      await writeFile(info.outputPath('report-product.json'), JSON.stringify(evidence, null, 2));
    }
  }
});
