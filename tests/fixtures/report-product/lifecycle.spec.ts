/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, type Page } from '@playwright/test';
import { inspectKernel } from '../../../apps/kernel/dist/lifecycle.js';
import { createKernelClient } from '../../../packages/client/dist/index.js';
import { businessSchemas } from '../../../packages/protocol/dist/business.js';
import type { ResearchGraphStart } from '../../../packages/protocol/dist/research.js';
import { graphArtifactOperation } from '../../../packages/research/dist/node.js';
import { closeDesktop } from '../../desktop-fixture.js';
import {
  kernelConnectionTimeout,
  kernelResultSummary,
  waitForKernelStop,
} from '../../kernel-fixture.js';
import { createModelServer } from '../../model-server.js';
import { expect, test } from '../../ui/fixture.js';
import { rendererUrl } from '../../ui/renderer-url.js';
import { startReportKernel } from '../report-reconnection/connection.js';

test('ordinary accepted graph saves after the window closes; report ready preserves its wait until the common composer confirms', async ({
  page,
  uiHost,
}, info) => {
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  assert(directory && process.env.SCHOOLOOM_REPORT_PRODUCT_RUN);
  await mkdir(info.outputDir, { recursive: true });
  const evidence: Record<string, unknown> = {
    host: uiHost,
    graph: 'registered no-model mechanical fixture, not a production research graph',
    pageProgram: 'installed production bootstrap',
    lifecycleLog: info.outputPath('ordinary-kernel.log'),
    phases: [],
  };
  const phases = evidence.phases as unknown[];
  const mark = (phase: string, value: unknown) => phases.push({ phase, value, at: Date.now() });

  // Retire the static host's initial kernel before registering the fixture graph.
  const previous = await inspectKernel(directory);
  mark('previous-kernel', kernelResultSummary(previous));
  if (previous.state === 'running') {
    const client = createKernelClient(previous.endpoint);
    try {
      await client.connect();
      expect((await client.shutdown()).instanceId).toBe(previous.endpoint.instanceId);
    } finally {
      client.dispose();
    }
  } else expect(previous.state).toBe('stopped');
  expect(
    (
      await waitForKernelStop(
        directory,
        'endpoint' in previous ? previous.endpoint.instanceId : undefined,
      )
    ).state,
  ).toBe('stopped');

  const barrier = info.outputPath('publication-barrier');
  await mkdir(barrier, { mode: 0o700 });
  const release = () => writeFile(join(barrier, 'release'), 'release', { mode: 0o600 });
  // The UI requires configured credentials; this loopback trap must receive zero model calls.
  const model = await createModelServer();
  let kernel: Awaited<ReturnType<typeof startReportKernel>> | undefined;
  let client: ReturnType<typeof createKernelClient> | undefined;
  let desktop: ElectronApplication | undefined;
  let ui: Page | undefined;
  let opened = false;
  const profile = info.outputPath('electron-profile');
  const openWindow = async () => {
    if (uiHost === 'browser') {
      ui = opened ? await page.context().newPage() : page;
      await ui.goto(rendererUrl);
    } else {
      const { ELECTRON_RENDERER_URL: _renderer, ...environment } = process.env;
      desktop = await electron.launch({
        args: [
          `--user-data-dir=${profile}`,
          fileURLToPath(new URL('../../../apps/desktop', import.meta.url)),
        ],
        env: {
          ...environment,
          SCHOOLOOM_DATA_DIR: directory,
          SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
        },
      });
      ui = await desktop.firstWindow();
      const paths = await desktop.evaluate(({ app, session }) => ({
        userData: app.getPath('userData'),
        sessionData: app.getPath('sessionData'),
        storagePath: session.defaultSession.storagePath,
      }));
      for (const path of Object.values(paths)) {
        assert(path !== null);
        expect(relative(profile, path)).toBe('');
      }
      mark('electron-profile', paths);
    }
    opened = true;
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
      timeout: kernelConnectionTimeout,
    });
    return ui;
  };
  const closeWindow = async () => {
    if (desktop) {
      const child = desktop.process();
      await closeDesktop(desktop);
      expect(child.exitCode).toBe(0);
      expect(child.signalCode).toBeNull();
      mark('electron-exited', { processId: child.pid, code: child.exitCode });
      desktop = undefined;
    } else if (ui && !ui.isClosed()) await ui.close();
    if (ui) expect(ui.isClosed()).toBe(true);
    ui = undefined;
  };
  try {
    kernel = await startReportKernel(directory, info.outputPath('ordinary-kernel.log'), {
      publicationBarrier: barrier,
      modelEndpoint: model.url,
    });
    evidence.kernel = kernel.identity;
    client = await kernel.connect();
    const rpc = client;
    await expect(rpc.attachDevelopment()).rejects.toMatchObject({ code: 'permissionDenied' });
    await rpc.call('provider.configure', { apiKey: 'synthetic-no-model-lifecycle-key' });
    const project = await rpc.call('project.create', {
      path: info.outputPath('project'),
      trust: 'trusted',
    });
    await mkdir(join(project.path, 'assets'));
    await rpc.call('files.save', {
      projectId: project.id,
      path: 'assets/data.json',
      content: '[10,20]',
    });
    const data = await rpc.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'assets/data.json' },
    });
    await rpc.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const sourceText = '# Synthetic source\nDose 10 and 20; sample size 1.\n';
    const paper = info.outputPath('source.md');
    await writeFile(paper, sourceText);
    const batch = await rpc.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [paper],
      storage: 'managed',
      purpose: '正文',
      version: 'unspecified',
      origin: 'report-product-lifecycle-test',
    });
    await expect
      .poll(async () => (await rpc.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const imported = (await rpc.call('library.batch', { batchId: batch.id })).entries[0];
    assert(imported?.attachmentId);
    const attachment = await rpc.call('library.attachment', {
      attachmentId: imported.attachmentId,
    });
    const source = await rpc.call('resources.describe', {
      locator: {
        source: 'library',
        attachmentId: attachment.id,
        materialVersionId: attachment.materialVersionId,
      },
    });
    const session = await rpc.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const input: ResearchGraphStart = {
      ...scope,
      graphId: 'scholoom.test.report-reconnection',
      version: '1',
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      config: { mode: 'publish' },
      materials: [data, source].map(({ ref, basis }) => ({ ref, basis })),
      text: 'Publish the fixed synthetic report, then wait for explicit confirmation.',
    };
    const selectSession = async (window: Page) => {
      const projectRow = window.locator(`[data-project-id="${project.id}"]`);
      await expect(projectRow).toBeVisible();
      const collapsed = projectRow.getByRole('button', {
        name: `${project.name}，已折叠`,
        exact: true,
      });
      if (await collapsed.count()) await collapsed.click();
      const selected = projectRow
        .locator(`[data-session-id="${session.id}"]`)
        .getByRole('button', { name: /^打开会话 / });
      await selected.click();
      await expect(selected).toHaveAttribute('aria-pressed', 'true');
    };
    await selectSession(await openWindow());
    const receipt = await rpc.call('research.requestGraph', input);
    evidence.invocation = { input, receipt };
    await expect
      .poll(
        async () => {
          try {
            return JSON.parse(await readFile(join(barrier, 'entered.json'), 'utf8'));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
          }
        },
        { timeout: 20_000 },
      )
      .toMatchObject({ attemptId: receipt.runId, originInstructionId: input.instructionId });
    const accepted = await rpc.call('workbench.snapshot', scope);
    expect(accepted.run).toMatchObject({ id: receipt.runId, state: 'running' });
    mark('worker-paused-before-publication', {
      worker: JSON.parse(await readFile(join(barrier, 'entered.json'), 'utf8')),
      run: accepted.run,
    });
    const reportPath = join(project.path, 'report.html');
    const continuationPath = join(project.path, 'continuation.json');
    await expect(stat(reportPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await closeWindow();
    expect(kernel.alive()).toBe(true);
    const afterClose = await inspectKernel(directory);
    expect(kernelResultSummary(afterClose)).toEqual({
      state: 'running',
      processId: kernel.identity.processId,
      instanceId: kernel.identity.instanceId,
    });
    expect((await rpc.call('workbench.snapshot', scope)).run?.id).toBe(receipt.runId);
    await expect(stat(reportPath)).rejects.toMatchObject({ code: 'ENOENT' });
    mark('window-closed-before-publication', kernelResultSummary(afterClose));
    await release();
    const snapshot = () => rpc.call('workbench.snapshot', scope);
    await expect
      .poll(async () => (await snapshot()).run?.state, { timeout: 20_000 })
      .toBe('waiting');
    const waiting = await snapshot();
    const wait = waiting.run?.graph?.wait;
    assert(wait);
    expect(waiting.run).toMatchObject({
      id: receipt.runId,
      graph: { originInstructionId: input.instructionId },
      graphProgress: { kind: 'graph.waiting' },
    });
    expect(
      (await stat(join(project.path, '.scholoom/harness/checkpoints', `${receipt.runId}.sqlite`)))
        .size,
    ).toBeGreaterThan(0);
    const creation = waiting.run?.graphProgress?.evidence.creations?.[0];
    assert(creation?.state === 'complete' && creation.resource.ref.source === 'project');
    expect(creation.association?.state).toBe('confirmed');
    expect(creation.operationId).toBe(graphArtifactOperation(input.instructionId, 'report'));
    const publication = (
      await rpc.call('files.changes', {
        projectId: project.id,
        fileId: creation.resource.ref.fileId,
      })
    ).changes[0];
    expect(publication).toMatchObject({
      editId: creation.editId,
      origin: {
        kind: 'execution',
        projectId: project.id,
        sessionId: session.id,
        runId: receipt.runId,
      },
    });
    const html = await readFile(reportPath, 'utf8');
    expect(html).toContain('<!--scholoom-report-v1');
    expect(html).toContain('<td>10</td>');
    expect(html).toContain('<td>20</td>');
    await expect(stat(continuationPath)).rejects.toMatchObject({ code: 'ENOENT' });
    const calls = () =>
      rpc.call('research.graphCalls', { ...scope, invocationId: input.invocationId });
    const originalCalls = await calls();
    expect(originalCalls.calls).toHaveLength(1);
    expect(originalCalls.calls[0]?.executions).toHaveLength(1);
    expect(originalCalls.calls[0]?.call).toMatchObject({
      invocationId: input.invocationId,
      instructionId: input.instructionId,
    });
    mark('saved-and-persistently-waiting-without-window', {
      run: waiting.run,
      publication,
      calls: originalCalls,
    });

    const reopened = await openWindow();
    await selectSession(reopened);
    await reopened.getByRole('treeitem', { name: '打开文件 report.html', exact: true }).dblclick();
    const report = reopened.getByRole('region', { name: '交互报告 report.html', exact: true });
    await expect(report.getByRole('status').first()).toHaveText('报告已就绪', {
      timeout: businessSchemas['resources.reportOpen'].semantics.waitMs,
    });
    await expect(
      reopened
        .frameLocator('iframe[title="交互报告"]')
        .getByRole('heading', { name: 'Fixed dose comparison', exact: true }),
    ).toBeVisible();
    expect(kernel.alive()).toBe(true);
    expect(kernelResultSummary(await inspectKernel(directory))).toEqual({
      state: 'running',
      instanceId: kernel.identity.instanceId,
      processId: kernel.identity.processId,
    });
    const ready = await snapshot();
    expect(ready.run).toEqual(waiting.run);
    expect(ready.messages).toEqual(waiting.messages);
    expect(await calls()).toEqual(originalCalls);
    await expect(stat(continuationPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(model.requests).toHaveLength(0);
    mark('actual-report-ready-preserves-original-wait', { run: ready.run, wait });

    await reopened.getByRole('textbox', { name: '研究指令', exact: true }).fill('{"confirm":true}');
    await reopened.getByRole('button', { name: '发送指令', exact: true }).click();
    await expect
      .poll(async () => (await snapshot()).run?.state, { timeout: 20_000 })
      .toBe('completed');
    const completed = await snapshot();
    expect(completed.run?.id).toBe(receipt.runId);
    expect(completed.run?.graph?.originInstructionId).toBe(input.instructionId);
    const confirmation = completed.messages.find(
      (message) => message.role === 'user' && message.text === '{"confirm":true}',
    );
    assert(confirmation);
    expect(confirmation.id).not.toBe(input.instructionId);
    expect(confirmation.state).toBe('consumed');
    expect(completed.messages.find((message) => message.id === input.instructionId)?.state).toBe(
      'consumed',
    );
    const continuation = JSON.parse(await readFile(continuationPath, 'utf8'));
    expect(continuation.waitId).toBe(wait.waitId);
    expect(
      continuation.instructions.map(
        (instruction: { instructionId: string }) => instruction.instructionId,
      ),
    ).toContain(confirmation.id);
    expect(continuation.reads[0]).toMatchObject({
      ref: creation.resource.ref,
      basis: creation.resource.basis,
      data: html,
    });
    expect(continuation.reads[2]).toMatchObject({
      ref: source.ref,
      basis: source.basis,
      data: sourceText,
    });
    const continued = completed.run?.graphProgress?.evidence.creations?.[1];
    assert(continued?.state === 'complete' && continued.resource.ref.source === 'project');
    expect(continued.association?.state).toBe('confirmed');
    expect(continued.operationId).toBe(graphArtifactOperation(input.instructionId, 'continuation'));
    const edit = (
      await rpc.call('files.changes', {
        projectId: project.id,
        fileId: continued.resource.ref.fileId,
      })
    ).changes[0];
    expect(edit).toMatchObject({
      editId: continued.editId,
      origin: {
        kind: 'execution',
        projectId: project.id,
        sessionId: session.id,
        runId: receipt.runId,
      },
    });
    const completedCalls = await calls();
    expect(completedCalls.calls).toHaveLength(1);
    expect(completedCalls.calls[0]?.call).toEqual(originalCalls.calls[0]?.call);
    expect(await readFile(reportPath, 'utf8')).toBe(html);
    expect(model.requests).toHaveLength(0);
    evidence.continuation = { run: completed.run, confirmation, continuation, edit };
    await reopened.screenshot({ path: info.outputPath('lifecycle-completed.png'), fullPage: true });
  } finally {
    // Release only the test scheduler gate, then retire windows before the owned ordinary kernel.
    await release();
    try {
      await closeWindow();
    } finally {
      client?.dispose();
      try {
        if (kernel) {
          mark('ordinary-kernel-stop-requested', kernel.identity);
          const stopped = await kernel.stop();
          mark('ordinary-kernel-exited', stopped);
        }
      } finally {
        await model.close();
        evidence.modelRequests = model.requests.length;
        await writeFile(info.outputPath('lifecycle.json'), JSON.stringify(evidence, null, 2));
      }
    }
  }
});
