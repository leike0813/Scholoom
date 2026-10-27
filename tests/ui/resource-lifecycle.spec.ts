/// <reference lib="dom" />
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { epubFixture } from '../document-fixture.js';
import { runningKernel } from '../kernel-fixture.js';
import { createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('closing a resource cancels its in-flight request without disrupting another reader', async ({
  uiPage,
}) => {
  test.setTimeout(120000);
  uiPage.setDefaultTimeout(15000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-resource-lifecycle-'));
  const token = randomUUID().slice(0, 8);
  const targetName = `target-${token}.epub`;
  const siblingName = `sibling-${token}.epub`;
  const targetPath = join(root, targetName);
  const siblingPath = join(root, siblingName);
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  try {
    await client.connect();
    await client.call('library.grant', {
      read: true,
      write: true,
      send: false,
      autoBackup: false,
    });
    await Promise.all([
      writeFile(targetPath, epubFixture()),
      writeFile(siblingPath, epubFixture(2)),
    ]);
    const batch = await client.call('library.importFiles', {
      batchId: randomUUID(),
      paths: [targetPath, siblingPath],
      storage: 'linked',
      purpose: '正文',
      version: 'unspecified',
      origin: 'resource-lifecycle-ui',
    });
    await expect
      .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    const entries = (await client.call('library.batch', { batchId: batch.id })).entries;
    const targetEntry = entries[0];
    assert(targetEntry?.sourceId && targetEntry.attachmentId);
    const attachment = await client.call('library.attachment', {
      attachmentId: targetEntry.attachmentId,
    });
    assert(attachment);
    await client.call('library.saveReadingRecord', {
      recordId: randomUUID(),
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
      kind: 'note',
      quote: '',
      body: '关闭后重新打开仍保留的阅读记录',
    });

    // The kernel executes the document request and sends its response. Only delivery of that
    // response to the renderer's RPC listener is held at the WebSocket boundary.
    await uiPage.addInitScript(() => {
      const state: {
        request?: { rpcId: string | number; requestId: string };
        cancels: string[];
        held: boolean;
        release?: () => void;
      } = { cancels: [], held: false };
      Reflect.set(globalThis, '__resourceLifecycle', state);
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (
        payload: Parameters<typeof WebSocket.prototype.send>[0],
      ) {
        if (typeof payload === 'string') {
          const message = JSON.parse(payload);
          if (
            message.method === 'resources.document' &&
            message.params?.request?.method === 'searchDocument'
          )
            state.request = {
              rpcId: message.id,
              requestId: message.params.requestId,
            };
          if (message.method === 'resources.cancel') state.cancels.push(message.params.requestId);
        }
        send.call(this, payload);
      };
      const add = WebSocket.prototype.addEventListener;
      const instrumentedAdd = function (
        this: WebSocket,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (type !== 'message' || !listener)
          return Reflect.apply(add, this, [type, listener, options]);
        const wrapped = function (this: WebSocket, event: MessageEvent) {
          const request = state.request;
          if (request && !state.held) {
            const message = JSON.parse(event.data as string);
            if (message.id === request.rpcId && ('result' in message || 'error' in message)) {
              state.held = true;
              state.release = () => deliver(listener, this, event);
              return;
            }
          }
          deliver(listener, this, event);
        };
        return Reflect.apply(add, this, [type, wrapped, options]);
      };
      WebSocket.prototype.addEventListener =
        instrumentedAdd as typeof WebSocket.prototype.addEventListener;
      function deliver(
        listener: EventListenerOrEventListenerObject,
        socket: WebSocket,
        event: MessageEvent,
      ) {
        if (typeof listener === 'function') Reflect.apply(listener, socket, [event]);
        else listener.handleEvent.call(listener, event);
      }
    });
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    await createSession(uiPage);
    const open = async (name: string) => {
      await uiPage.getByRole('button', { name: '文献库', exact: true }).click();
      await uiPage.getByLabel('查找题录', { exact: true }).fill(name);
      await uiPage.getByRole('option').filter({ hasText: name }).click();
      await uiPage.getByRole('tab', { name: '文献详情', exact: true }).click();
      await uiPage.getByRole('button', { name: `打开 EPUB ${name}`, exact: true }).click();
    };
    await open(targetName);
    const targetReader = uiPage.getByRole('region', {
      name: `文档阅读 ${targetName}`,
      exact: true,
    });
    await expect(targetReader.getByRole('article', { name: '文档正文' })).toContainText('evidence');
    await open(siblingName);
    const siblingReader = uiPage.getByRole('region', {
      name: `文档阅读 ${siblingName}`,
      exact: true,
    });
    await expect(siblingReader.getByRole('article', { name: '文档正文' })).toContainText(
      'evidence',
    );

    await uiPage.getByRole('button', { name: '向右拆分', exact: true }).click();
    await expect(uiPage.getByLabel('标签组 2')).toBeVisible();
    await siblingReader.getByRole('textbox', { name: '搜索文档', exact: true }).fill('result 73');
    await siblingReader.getByRole('button', { name: '搜索文档', exact: true }).click();
    await expect
      .poll(() => uiPage.evaluate(() => Reflect.get(globalThis, '__resourceLifecycle').held))
      .toBe(true);
    const requestId = await uiPage.evaluate(
      () => Reflect.get(globalThis, '__resourceLifecycle').request.requestId as string,
    );
    await uiPage.getByRole('button', { name: `关闭 ${siblingName}`, exact: true }).click();
    await expect(uiPage.getByLabel('标签组 2')).toBeHidden();
    await expect
      .poll(() => uiPage.evaluate(() => Reflect.get(globalThis, '__resourceLifecycle').cancels))
      .toContain(requestId);

    await expect(targetReader.getByRole('article', { name: '文档正文' })).toContainText('evidence');
    await targetReader.getByRole('textbox', { name: '搜索文档', exact: true }).fill('result 73');
    await targetReader.getByRole('button', { name: '搜索文档', exact: true }).click();
    await expect(targetReader.getByRole('region', { name: '文档搜索结果' })).toContainText(
      'result 73',
    );

    await uiPage.evaluate(() => Reflect.get(globalThis, '__resourceLifecycle').release());
    await uiPage.getByRole('button', { name: `关闭 ${targetName}`, exact: true }).click();
    await open(targetName);
    const reopened = uiPage.getByRole('region', {
      name: `文档阅读 ${targetName}`,
      exact: true,
    });
    await expect(reopened.getByRole('article', { name: '文档正文' })).toContainText('evidence');
    const records = reopened.getByRole('region', { name: '阅读记录' });
    if (!(await records.isVisible()))
      await reopened.getByText('共同阅读记录', { exact: true }).click();
    await expect(records).toContainText('关闭后重新打开仍保留的阅读记录');
  } finally {
    client.dispose();
    await rm(root, { recursive: true });
  }
});
