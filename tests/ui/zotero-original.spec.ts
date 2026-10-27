import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, type ElectronApplication } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import type { IsolatedZotero } from '../../apps/kernel/dist/zotero.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import { closeDesktop } from '../desktop-fixture.js';
import { createSession, expect, test } from './fixture.js';
import { rendererOrigin } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

const xpi = process.env.SCHOOLOOM_BBT_XPI;
test.skip(process.platform !== 'linux', 'Bounded Linux managed original BBT calibration');
test.skip(!xpi, 'Supply the unchanged local BBT 9.0.68 release via SCHOOLOOM_BBT_XPI');

type WireCall = { method: string; params: Record<string, unknown> };
test('single original actions use the real library and BBT, preserve CSL drafts, and query lost writes without replay', async ({
  page,
  uiHost,
}, info) => {
  test.setTimeout(90000);
  const root = info.outputPath('isolated');
  await mkdir(root, { recursive: true });
  const packageDirectory = join(root, 'package');
  execFileSync('unzip', ['-q', xpi as string, '-d', packageDirectory]);
  const configuration: IsolatedZotero = {
    libraryId: '',
    packageDirectory,
    executable: '/usr/bin/xvfb-run',
    args: [
      '-a',
      createRequire(import.meta.url)('electron'),
      '--no-sandbox',
      fileURLToPath(new URL('../../apps/zotero-host/out/main/managed.cjs', import.meta.url)),
    ],
  };
  const profile = join(root, 'profile');
  const app = new KernelApplication(profile, { isolatedZotero: configuration, environment: {} });
  let kernel: Awaited<ReturnType<typeof startKernelServer>> | undefined;
  let proxy: ReturnType<typeof createServer> | undefined;
  let desktop: ElectronApplication | undefined;
  try {
    await app.initialize();
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const libraryId = (await app.call('library.status', {})).id;
    configuration.libraryId = libraryId;
    const instance = await app.call('library.createSourceInstance', {
      requestId: randomUUID(),
      libraryId,
      label: 'Synthetic UI journal source',
    });
    const batch = await app.call('library.ingest', {
      batchId: randomUUID(),
      origin: 'synthetic',
      version: 'published',
      json: JSON.stringify([{ title: 'Preserved journal' }, { title: 'Unsupported original' }]),
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const rows = (await app.call('library.list', { limit: 100 })).sources;
    const source = rows.find((row) => row.metadata.title === 'Preserved journal');
    const unsupported = rows.find((row) => row.metadata.title === 'Unsupported original');
    assert(source && unsupported);
    // Independent preserved-journal sample from tests/kernel/zotero-host.spec.ts.
    const original = {
      identity: { instanceId: instance.id, libraryLocator: 'local', objectKey: 'JRNL0002' },
      schemaVersion: '44',
      itemType: 'journalArticle',
      fields: {
        title: 'Preserved journal',
        date: '2026',
        publicationTitle: 'Isolated Research',
        extra: 'Unrecognized preserved line',
      },
      creators: [{ firstName: 'Ada', lastName: 'Chen', creatorType: 'author' }],
      relations: {},
    };
    const citationKey = { value: 'ScholoomPreserved2026', pinned: true };
    expect(
      await app.call('library.commitRecords', {
        libraryId,
        requestId: randomUUID(),
        changes: [
          {
            sourceId: source.id,
            revision: source.revision,
            original,
            key: { ...citationKey, intent: 'explicit' },
          },
          {
            sourceId: unsupported.id,
            revision: unsupported.revision,
            original: {
              ...original,
              identity: { ...original.identity, objectKey: 'BOOK0001' },
              itemType: 'book',
            },
          },
        ],
      }),
    ).toMatchObject({ state: 'committed' });
    const savedMetadata = {
      title: 'Common CSL corrected title',
      issued: {
        'date-parts': [
          [2025, 9],
          [2026, 2],
        ],
        circa: true,
      },
      author: [{ literal: 'Synthetic Research Consortium' }],
    };
    const seeded = await app.call('library.get', { sourceId: source.id });
    await app.call('library.update', {
      sourceId: source.id,
      revision: seeded.revision,
      metadata: savedMetadata,
      tags: seeded.tags,
      collectionIds: seeded.collectionIds,
      relatedIds: seeded.relatedIds,
    });
    const record = () => app.call('library.record', { libraryId, sourceId: source.id });
    const history = async () =>
      (await app.call('library.recordHistory', { libraryId, sourceId: source.id })).records.filter(
        (entry) => entry.kind === 'original',
      );
    const before = await record();
    const historyBefore = await history();
    const status = {
      protocolVersion,
      nodeVersion: process.versions.node,
      processId: process.pid,
      instanceId: randomUUID(),
      dataDirectory: profile,
      startedAt: new Date().toISOString(),
      state: 'running' as const,
    };
    kernel = await startKernelServer(status, () => app.close(), app);
    const endpoint = { ...status, url: kernel.url, token: kernel.token };
    // Only bootstrap is supplied here; rendererOrigin serves the built product assets.
    proxy = createServer(async (request, response) => {
      try {
        if (request.url === '/__scholoom/kernel/bootstrap') {
          response
            .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
            .end(JSON.stringify({ state: 'running', endpoint }));
          return;
        }
        const result = await fetch(new URL(request.url ?? '/', rendererOrigin));
        response
          .writeHead(result.status, {
            'Content-Type': result.headers.get('content-type') ?? 'application/octet-stream',
            'Cache-Control': 'no-store',
          })
          .end(Buffer.from(await result.arrayBuffer()));
      } catch {
        response.writeHead(502).end();
      }
    });
    const serving = proxy;
    await new Promise<void>((resolve) => serving.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/`;
    let ui = page;
    if (uiHost === 'electron') {
      desktop = await _electron.launch({
        args: [fileURLToPath(new URL('../../apps/desktop', import.meta.url))],
        env: {
          ...process.env,
          ELECTRON_RENDERER_URL: url,
          SCHOOLOOM_DATA_DIR: join(root, 'desktop'),
          SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
        },
      });
      ui = await desktop.firstWindow();
      await ui.waitForURL(url);
    }
    const calls: WireCall[] = [];
    const replies: { method: string; result: Record<string, unknown> }[] = [];
    const errors: { method: string; code: string }[] = [];
    let loss: 'receipt' | 'request' | undefined;
    let droppedReceipt: Record<string, unknown> | undefined;
    let forwardedTitles = 0;
    await ui.routeWebSocket(kernel.url, (route) => {
      const server = route.connectToServer();
      const pending = new Map<string, string>();
      route.onMessage((message) => {
        const frame = JSON.parse(message.toString());
        if (frame.method?.startsWith('zotero.') || frame.method === 'library.update') {
          calls.push({ method: frame.method, params: frame.params });
          pending.set(String(frame.id), frame.method);
        }
        if (frame.method === 'zotero.replaceTitle') {
          if (loss === 'request') {
            loss = undefined;
            void route.close({ code: 1011, reason: 'Request delivery lost' });
            void server.close();
            return;
          }
          forwardedTitles += 1;
        }
        server.send(message);
      });
      server.onMessage((message) => {
        const frame = JSON.parse(message.toString());
        const method = pending.get(String(frame.id));
        if (method) {
          pending.delete(String(frame.id));
          if (frame.result) replies.push({ method, result: frame.result });
          if (frame.error) errors.push({ method, code: frame.error.data?.code });
          if (
            method === 'zotero.replaceTitle' &&
            loss === 'receipt' &&
            frame.result?.state === 'committed'
          ) {
            loss = undefined;
            droppedReceipt = frame.result;
            void route.close({ code: 1011, reason: 'Committed receipt lost' });
            void server.close();
            return;
          }
        }
        route.send(message);
      });
    });
    await installRpcGate(ui);
    const titleCalls = () => calls.filter((call) => call.method === 'zotero.replaceTitle');
    const exportCalls = () => calls.filter((call) => call.method === 'zotero.export');
    const queryReplies = () => replies.filter((reply) => reply.method === 'zotero.result');
    await ui.goto(url);
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await createSession(ui);
    const detail = ui.getByRole('region', { name: '题录详情', exact: true });
    const originals = detail.locator('details').filter({
      has: ui.locator('summary').filter({ hasText: /^原值与导出$/ }),
    });
    const openOriginal = async () => {
      await ui.getByRole('button', { name: '文献库', exact: true }).click();
      const expand = ui.getByRole('button', { name: '展开右区', exact: true });
      if (await expand.isVisible()) await expand.click();
      await ui.getByRole('tab', { name: '文献详情', exact: true }).click();
      await ui
        .getByRole('option', { name: `查看题录 ${savedMetadata.title}`, exact: true })
        .click();
      if (!(await originals.evaluate((element) => (element as HTMLDetailsElement).open)))
        await originals.locator('summary').click();
    };
    await openOriginal();
    const inspect = originals.getByRole('button', { name: '核对所选原值', exact: true });
    const csl = originals.getByLabel('已保存 CSL 核对', { exact: true });
    const raw = originals.getByLabel('所选原值核对', { exact: true });
    const title = originals.getByLabel('原值题名更正', { exact: true });
    const preview = originals.getByRole('button', { name: '预览原值题名更正', exact: true });
    const submit = originals.getByRole('button', { name: '提交原值题名更正', exact: true });
    const consent = originals.getByRole('checkbox', { name: '采用所示原值导出', exact: true });
    const output = originals.getByLabel('原值导出文本', { exact: true });
    const operationStatus = originals.getByRole('status', { name: '原值操作状态', exact: true });
    const draft = detail.getByLabel('题录 CSL JSON', { exact: true });
    const check = originals.getByRole('button', { name: '核查原值更正结果', exact: true });
    await inspect.click();
    await expect.poll(async () => JSON.parse(await csl.inputValue())).toEqual(savedMetadata);
    await expect.poll(async () => JSON.parse(await raw.inputValue())).toEqual(original);
    await expect(csl).toHaveAttribute('readonly', '');
    await expect(raw).toHaveAttribute('readonly', '');
    const inspected = replies.find((reply) => reply.method === 'zotero.inspect');
    expect(inspected?.result.sources).toEqual([
      {
        sourceId: source.id,
        revision: before.revision,
        csl: savedMetadata,
        original,
        citationKey,
        comparison: { title: 'different', remaining: 'notComparable' },
      },
    ]);
    await expect(originals).toContainText(original.identity.objectKey);
    await expect(originals).toContainText(original.identity.instanceId);
    await expect(originals).toContainText(`修订号 ${before.revision}`);
    await expect(originals).toContainText('其他属性无法比较');
    await expect(submit).toHaveCount(0);
    await expect(consent).not.toBeChecked();
    const exportButton = originals.getByRole('button', { name: '导出所选原值', exact: true });
    await expect(exportButton).toBeDisabled();
    await expect
      .poll(async () => !(await output.isVisible()) || (await output.inputValue()) === '')
      .toBe(true);
    expect(exportCalls()).toHaveLength(0);
    await originals
      .getByRole('combobox', { name: '原值导出格式', exact: true })
      .selectOption('bibtex');
    await consent.check();
    await exportButton.click();
    await expect(output).toHaveValue(/ScholoomPreserved2026/, { timeout: 30000 });
    expect((await output.inputValue()).toLowerCase()).toContain('preserved journal');
    expect(await output.inputValue()).not.toContain(savedMetadata.title);
    expect(exportCalls()).toEqual([
      {
        method: 'zotero.export',
        params: {
          libraryId,
          format: 'bibtex',
          sources: [
            {
              sourceId: source.id,
              revision: before.revision,
              expression: { kind: 'zotero-original', identity: original.identity },
            },
          ],
        },
      },
    ]);
    const list = ui.getByRole('listbox', { name: '题录列表', exact: true });
    await expect(list.getByRole('option').first()).toHaveAttribute(
      'aria-label',
      `查看题录 ${savedMetadata.title}`,
    );
    await armRpcGate(ui, 'zotero.export');
    await exportButton.click();
    await ui.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    await list.press('ControlOrMeta+a');
    await expect(detail.getByText('请选择单条题录核对原值。', { exact: true })).toBeVisible();
    await list
      .getByRole('option', { name: `查看题录 ${savedMetadata.title}`, exact: true })
      .click();
    await expect(consent).not.toBeChecked();
    const exportReplyCount = replies.filter((reply) => reply.method === 'zotero.export').length;
    await releaseRpcGate(ui);
    await expect
      .poll(() => replies.filter((reply) => reply.method === 'zotero.export').length)
      .toBe(exportReplyCount + 1);
    await expect(inspect).toBeEnabled();
    await expect(output).toHaveCount(0);
    const unsaved = {
      ...savedMetadata,
      title: 'Unsaved CSL title retained across original writes',
    };
    await draft.fill(JSON.stringify(unsaved));
    const correctedTitle = '  Explicit original title correction  ';
    await title.fill(correctedTitle);
    expect(titleCalls()).toHaveLength(0);
    await preview.click();
    await expect(submit).toBeVisible();
    const confirmation = originals.getByRole('group', { name: '原值题名更正预览', exact: true });
    await expect(confirmation).toContainText(original.fields.title);
    await expect(confirmation).toContainText(correctedTitle.trim());
    await ui.screenshot({ path: info.outputPath('original-title-preview.png') });
    expect(titleCalls()).toHaveLength(0);
    await submit.click();
    await expect.poll(async () => (await record()).revision).toBe(before.revision + 1);
    const first = await record();
    const firstOriginal = { ...original, fields: { ...original.fields, title: correctedTitle } };
    expect(first.originals).toEqual([firstOriginal]);
    expect(first.citationKey).toEqual(citationKey);
    expect((await app.call('library.get', { sourceId: source.id })).metadata).toEqual(
      savedMetadata,
    );
    await expect.poll(async () => JSON.parse(await draft.inputValue())).toEqual(unsaved);
    expect(await history()).toHaveLength(historyBefore.length + 1);
    await detail.getByRole('button', { name: '保存题录更正', exact: true }).click();
    await expect(
      detail.getByRole('alert').filter({ hasText: /变化|contentChanged/ }),
    ).toBeVisible();
    expect(calls.filter((call) => call.method === 'library.update').at(-1)?.params.revision).toBe(
      before.revision,
    );
    await expect.poll(async () => JSON.parse(await draft.inputValue())).toEqual(unsaved);
    expect((await app.call('library.get', { sourceId: source.id })).metadata).toEqual(
      savedMetadata,
    );

    await expect(detail).toContainText(`修订号 ${first.revision}`);
    await inspect.click();
    await expect.poll(async () => JSON.parse(await raw.inputValue())).toEqual(firstOriginal);
    const conflictTitle = 'Concurrent original correction';
    await title.fill(conflictTitle);
    await preview.click();
    await armRpcGate(ui, 'zotero.replaceTitle');
    await submit.click();
    await ui.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
    const current = await app.call('library.get', { sourceId: source.id });
    const externalMetadata = {
      ...current.metadata,
      abstract: 'External CSL update during held original write',
    };
    await app.call('library.update', {
      sourceId: source.id,
      revision: current.revision,
      metadata: externalMetadata,
      tags: current.tags,
      collectionIds: current.collectionIds,
      relatedIds: current.relatedIds,
    });
    await releaseRpcGate(ui);
    await expect(originals.getByRole('alert')).toContainText(/变化|contentChanged/);
    await expect(title).toHaveValue(conflictTitle);
    expect((await record()).originals).toEqual([firstOriginal]);
    expect(await history()).toHaveLength(historyBefore.length + 1);
    expect(titleCalls()).toHaveLength(2);
    expect(titleCalls()[1]?.params.revision).toBe(first.revision);
    await expect(detail).toContainText(`修订号 ${first.revision + 1}`);
    await inspect.click();
    await expect.poll(async () => JSON.parse(await csl.inputValue())).toEqual(externalMetadata);
    await expect(title).toHaveValue(conflictTitle);
    expect(titleCalls()).toHaveLength(2);
    await preview.click();
    await submit.click();
    await expect.poll(async () => (await record()).revision).toBe(first.revision + 2);
    const second = await record();
    const secondOriginal = { ...original, fields: { ...original.fields, title: conflictTitle } };
    expect(second.originals).toEqual([secondOriginal]);
    expect(second.citationKey).toEqual(citationKey);
    expect((await app.call('library.get', { sourceId: source.id })).metadata).toEqual(
      externalMetadata,
    );
    await expect.poll(async () => JSON.parse(await draft.inputValue())).toEqual(unsaved);

    await expect(detail).toContainText(`修订号 ${second.revision}`);
    await inspect.click();
    await expect.poll(async () => JSON.parse(await raw.inputValue())).toEqual(secondOriginal);
    const unknownTitle = 'Committed despite lost observation';
    await title.fill(unknownTitle);
    await preview.click();
    loss = 'receipt';
    await submit.click();
    await expect.poll(() => droppedReceipt?.state).toBe('committed');
    await ui.reload();
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await openOriginal();
    await expect(check).toBeVisible();
    const unknownRequest = titleCalls().at(-1)?.params;
    assert(unknownRequest);
    expect(unknownRequest).toMatchObject({
      libraryId,
      sourceId: source.id,
      revision: second.revision,
      identity: original.identity,
      title: unknownTitle,
    });
    expect(titleCalls()).toHaveLength(4);
    const afterLostReceipt = await record();
    expect(afterLostReceipt.revision).toBe(second.revision + 1);
    expect(afterLostReceipt.originals).toEqual([
      { ...original, fields: { ...original.fields, title: unknownTitle } },
    ]);
    expect(afterLostReceipt.citationKey).toEqual(citationKey);
    expect(await history()).toHaveLength(historyBefore.length + 3);
    await ui.reload();
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await openOriginal();
    await expect(originals).toContainText(unknownTitle);
    await expect.poll(async () => JSON.parse(await draft.inputValue())).toEqual(unsaved);
    expect(titleCalls()).toHaveLength(4);
    const queried = queryReplies().length;
    await check.click();
    await expect.poll(() => queryReplies().length).toBe(queried + 1);
    expect(calls.filter((call) => call.method === 'zotero.result').at(-1)?.params).toEqual({
      libraryId,
      requestId: unknownRequest.requestId,
    });
    expect(queryReplies().at(-1)?.result).toMatchObject({
      requestId: unknownRequest.requestId,
      state: 'committed',
    });
    await expect(operationStatus).toBeVisible();
    expect(await record()).toEqual(afterLostReceipt);
    expect(titleCalls()).toHaveLength(4);

    await inspect.click();
    await expect
      .poll(async () => JSON.parse(await raw.inputValue()))
      .toEqual(afterLostReceipt.originals[0]);
    await expect(title).toHaveValue(unknownTitle);
    await title.fill('Undelivered title must not be retried');
    await preview.click();
    loss = 'request';
    await submit.click();
    await expect.poll(() => titleCalls().length).toBe(5);
    await ui.reload();
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await openOriginal();
    await expect(check).toBeEnabled();
    const undelivered = titleCalls().at(-1)?.params;
    assert(undelivered);
    expect(titleCalls()).toHaveLength(5);
    expect(forwardedTitles).toBe(4);
    await ui.reload();
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await openOriginal();
    await check.click();
    await expect
      .poll(() => queryReplies().at(-1)?.result)
      .toEqual({
        requestId: undelivered.requestId,
        state: 'notFound',
      });
    await inspect.click();
    await expect(title).toHaveValue('Undelivered title must not be retried');
    await expect(title).toBeDisabled();
    await expect(preview).toBeDisabled();
    await expect
      .poll(async () => !(await submit.isVisible()) || (await submit.isDisabled()))
      .toBe(true);
    expect(titleCalls()).toHaveLength(5);
    expect(await record()).toEqual(afterLostReceipt);
    expect(await history()).toHaveLength(historyBefore.length + 3);
    expect((await app.call('library.get', { sourceId: source.id })).metadata).toEqual(
      externalMetadata,
    );

    await ui.getByRole('option', { name: '查看题录 Unsupported original', exact: true }).click();
    if (!(await originals.evaluate((element) => (element as HTMLDetailsElement).open)))
      await originals.locator('summary').click();
    await inspect.click();
    await expect(originals.getByRole('alert')).toContainText(/原值|期刊|unavailable/);
    expect(errors).toContainEqual({ method: 'zotero.inspect', code: 'unavailable' });
    const beforeMulti = calls.filter((call) => call.method.startsWith('zotero.')).length;
    await ui
      .getByRole('option', { name: `查看题录 ${savedMetadata.title}`, exact: true })
      .click({ modifiers: ['Control'] });
    if (!(await originals.evaluate((element) => (element as HTMLDetailsElement).open)))
      await originals.locator('summary').click();
    await expect(detail.getByText('请选择单条题录核对原值。', { exact: true })).toBeVisible();
    await expect
      .poll(async () => !(await inspect.isVisible()) || (await inspect.isDisabled()))
      .toBe(true);
    await expect
      .poll(async () => !(await exportButton.isVisible()) || (await exportButton.isDisabled()))
      .toBe(true);
    expect(calls.filter((call) => call.method.startsWith('zotero.'))).toHaveLength(beforeMulti);
    expect(titleCalls()).toHaveLength(5);
    const finalHistory = await history();
    expect(finalHistory.map((entry) => entry.value)).toEqual([
      secondOriginal,
      firstOriginal,
      original,
      ...historyBefore.map((entry) => entry.value),
    ]);
    await ui.evaluate(
      ({ sourceId, unsupportedId }) => {
        const stored = Object.keys(localStorage).find((key) =>
          key.endsWith(`|original-title|${sourceId}`),
        );
        if (!stored) throw new Error('Missing original operation draft');
        localStorage.setItem(stored.slice(0, -sourceId.length) + unsupportedId, 'null');
      },
      { sourceId: source.id, unsupportedId: unsupported.id },
    );
    await ui.reload();
    await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await openOriginal();
    await ui.getByRole('option', { name: '查看题录 Unsupported original', exact: true }).click();
    if (!(await originals.evaluate((element) => (element as HTMLDetailsElement).open)))
      await originals.locator('summary').click();
    await expect(originals.getByRole('alert')).toContainText('草稿');
    await expect(ui.getByRole('region', { name: '文献库', exact: true })).toBeVisible();
    await writeFile(
      info.outputPath('original-actions.json'),
      JSON.stringify({ calls, errors, before, afterLostReceipt, history: finalHistory }, null, 2),
    );
  } finally {
    try {
      if (desktop) await closeDesktop(desktop);
      else await page.goto('about:blank');
    } finally {
      try {
        const serving = proxy;
        if (serving?.listening)
          await new Promise<void>((resolve, reject) =>
            serving.close((error) => (error ? reject(error) : resolve())),
          );
      } finally {
        if (kernel) await kernel.stop();
        else await app.close();
      }
    }
  }
});
