import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import type { Page, TestInfo } from '@playwright/test';
import {
  isReportProgramCommand,
  isReportProgramPacket,
  type ReportProgramCommand,
  type ReportProgramPacket,
  reportRenderLimits,
} from '../../../packages/protocol/src/report-contracts';
import { expect, test } from '../../ui/fixture';
import { rendererUrl } from '../../ui/renderer-url';

const binding = {
  version: 1,
  viewId: 'program-mechanical',
  generation: 1,
  basis: 'synthetic-v1',
} as const;
type NativeEvent = { index: number; type: string; trusted: boolean; value?: string };

async function mount(page: Page, host: string) {
  const built = process.env.SCHOOLOOM_REPORT_DOM_BUILD;
  assert(built);
  if (host === 'browser') await page.goto(rendererUrl);
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接');
  for (const [name, contentType] of [
    ['surface.js', 'text/javascript'],
    ['surface.css', 'text/css'],
    ['index.html', 'text/html'],
  ] as const) {
    const body = await readFile(join(built, name));
    await page.route(name === 'index.html' ? rendererUrl : `${rendererUrl}${name}`, (route) =>
      route.fulfill({ contentType, body }),
    );
  }
  await page.goto(rendererUrl);
  await expect(page.getByRole('tab', { name: 'Report DOM probe.html' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.waitForFunction(() => Boolean(Reflect.get(window, 'reportDOMProbe')));
  await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').ready);
}

function source(page: Page, info: TestInfo) {
  const built = process.env.SCHOOLOOM_REPORT_DOM_BUILD;
  assert(built);
  const child = spawn(process.execPath, ['--enable-source-maps', join(built, 'source.cjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const packets: ReportProgramPacket[] = [];
  const commands: ReportProgramCommand[] = [];
  const receipts: unknown[] = [];
  const waiters = new Set<() => void>();
  const outstanding = new Set<number>();
  const queue: ReportProgramPacket[] = [];
  const decoder = new StringDecoder('utf8');
  let buffered = '';
  let stderr = '';
  let totalBytes = 0;
  let maxOutstanding = 0;
  let applied = 0;
  let processed = 0;
  let pumping = false;
  let stopping = false;
  let failure: unknown;
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('close', (code, signal) => {
      if (!stopping) fail(new Error(`source exited before stop: ${code}/${signal}`));
      resolve({ code, signal });
    });
  });
  const wake = () => {
    for (const notify of waiters) notify();
  };
  function fail(error: unknown) {
    failure ??= error;
    wake();
  }
  child.on('error', fail);
  child.stdin.on('error', fail);
  child.stderr.on('data', (chunk: Buffer) => {
    if (Buffer.byteLength(stderr) + chunk.length > 65536)
      return fail(new Error('source stderr exceeded fixture capacity'));
    stderr += chunk.toString('utf8');
  });
  async function send(command: ReportProgramCommand) {
    if (failure) throw failure;
    assert.ok(isReportProgramCommand(command));
    assert.ok(commands.length < 64);
    commands.push(command);
    await new Promise<void>((resolve, reject) =>
      child.stdin.write(`${JSON.stringify(command)}\n`, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
  }
  async function pump() {
    if (pumping || failure || stopping) return;
    pumping = true;
    try {
      while (queue.length && !stopping && !failure) {
        const packet = queue.shift();
        assert(packet);
        if ('sequence' in packet) {
          assert.equal(packet.sequence, applied + 1);
          const receipt = await page.evaluate(
            (frame) => Reflect.get(window, 'reportDOMProbe').apply(frame),
            packet,
          );
          assert.equal(receipt.sequence, packet.sequence);
          receipts.push(receipt);
          await send({ type: 'consume', sequences: [packet.sequence] });
          outstanding.delete(packet.sequence);
          applied = packet.sequence;
        } else {
          expect(packet).toMatchObject(binding);
          if (packet.type === 'inputConfirmed') assert.ok(packet.through <= applied);
        }
        processed++;
        wake();
      }
    } catch (error) {
      fail(error);
    } finally {
      pumping = false;
    }
  }
  child.stdout.on('data', (chunk: Buffer) => {
    if (failure || stopping) return;
    try {
      totalBytes += chunk.length;
      assert.ok(totalBytes <= 2 * 1024 * 1024, 'bounded source evidence');
      buffered += decoder.write(chunk);
      assert.ok(
        Buffer.byteLength(buffered) <= 8 * reportRenderLimits.frameBytes,
        'bounded line buffer',
      );
      for (let newline = buffered.indexOf('\n'); newline >= 0; newline = buffered.indexOf('\n')) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        assert.ok(Buffer.byteLength(line) <= reportRenderLimits.frameBytes);
        const packet: unknown = JSON.parse(line);
        assert.ok(isReportProgramPacket(packet), 'source packet schema');
        assert.ok(queue.length < 16 && packets.length < 128, 'bounded packet queue');
        if ('sequence' in packet) {
          assert.ok(!outstanding.has(packet.sequence));
          outstanding.add(packet.sequence);
          maxOutstanding = Math.max(maxOutstanding, outstanding.size);
          assert.ok(
            maxOutstanding <= reportRenderLimits.inFlight,
            'at most four unconsumed frames',
          );
        }
        packets.push(packet);
        queue.push(packet);
      }
      void pump();
    } catch (error) {
      fail(error);
    }
  });
  async function wait(predicate: (packet: ReportProgramPacket) => boolean) {
    const deadline = Date.now() + 15000;
    while (true) {
      if (failure) throw failure;
      const found = packets.slice(0, processed).find(predicate);
      if (found) return found;
      assert.ok(Date.now() < deadline, 'source receipt deadline');
      await new Promise<void>((resolve) => {
        const notify = () => {
          clearTimeout(timer);
          waiters.delete(notify);
          resolve();
        };
        const timer = setTimeout(notify, Math.max(1, deadline - Date.now()));
        waiters.add(notify);
      });
    }
  }
  return {
    send,
    wait,
    async stop(error?: unknown) {
      stopping = true;
      child.stdin.end();
      const kill = setTimeout(() => child.kill('SIGKILL'), 5000);
      const status = await exited;
      clearTimeout(kill);
      const evidence = {
        binding,
        pid: child.pid,
        status,
        osIsolation: false,
        authority: 'synthetic files and binding',
        agentHarness: false,
        packets,
        commands,
        receipts,
        maxOutstanding,
        applied,
        queued: queue.length,
        buffered,
        failure: String(error ?? failure ?? ''),
      };
      await writeFile(info.outputPath('source.stderr.log'), stderr);
      await writeFile(info.outputPath('source-evidence.json'), JSON.stringify(evidence, null, 2));
      if (error || failure)
        await writeFile(info.outputPath('first-failure.json'), JSON.stringify(evidence, null, 2));
      if (!error) {
        if (failure) throw failure;
        assert.deepEqual(status, { code: 0, signal: null });
        assert.equal(outstanding.size, 0);
        assert.equal(queue.length, 0);
        assert.equal(buffered, '');
      }
    },
  };
}

test('real source and native controls reach the production DOM', async ({
  uiPage: page,
  uiHost,
}, info) => {
  await mount(page, uiHost);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const child = source(page, info);
  const frame = page.frameLocator('iframe[title="交互报告"]');
  const evidence: Record<string, unknown> = { host: uiHost };
  let failure: unknown;
  try {
    await child.send({
      ...binding,
      type: 'start',
      restorePending: true,
      viewport: [1280, 840],
      cssProperties: [],
      eventProperties: [],
    });
    await child.wait((packet) => 'sequence' in packet);
    const initialNote = 'Retained initial note';
    await child.send({
      ...binding,
      type: 'restore',
      browse: {},
      draft: { note: initialNote },
      dirty: true,
    });
    await child.wait((packet) => 'type' in packet && packet.type === 'ready');
    await expect(frame.getByLabel('Report note', { exact: true })).toHaveValue(initialNote);
    await expect(frame.locator('#classic')).toHaveText('Classic global');
    await expect(frame.locator('#classic')).toHaveCSS('padding-left', '3px');
    await expect(frame.locator('#classic')).toHaveCSS('background-color', 'rgb(12, 34, 56)');
    await expect(frame.locator('#module')).toHaveText('Loaded native ESM');
    await expect(frame.locator('#inline-module')).toHaveText('Loaded native ESM inline');
    await expect(frame.locator('article[data-object]')).toHaveCount(100);
    await expect(frame.locator('article[data-object="99"] td')).toHaveText('99');
    evidence.math = await frame.locator('math').evaluate((node) => ({
      namespace: node.namespaceURI,
      fraction: node.firstElementChild?.localName,
      numerator: node.querySelector('mi')?.textContent,
      denominator: node.querySelector('mn')?.textContent,
    }));
    expect(evidence.math).toEqual({
      namespace: 'http://www.w3.org/1998/Math/MathML',
      fraction: 'mfrac',
      numerator: 'x',
      denominator: '2',
    });
    expect(await frame.locator('script').count()).toBe(0);
    const input = frame.getByLabel('Report query', { exact: true });
    await input.click();
    await input.press('q');
    await input.press('Shift+ArrowLeft');
    const handle = await input.elementHandle();
    assert(handle);
    const inspect = () =>
      handle.evaluate((node: HTMLInputElement) => ({
        sameNode: node === node.ownerDocument.querySelector('#query'),
        value: node.value,
        selection: [node.selectionStart, node.selectionEnd],
        focused: node.ownerDocument.activeElement === node,
      }));
    const before = await inspect();
    expect(before).toEqual({ sameNode: true, value: 'q', selection: [0, 1], focused: true });
    const events: NativeEvent[] = await page.evaluate(() =>
      Reflect.get(window, 'reportDOMProbe').events(),
    );
    const inputs = events.filter((event) => event.type === 'input');
    expect(inputs).toHaveLength(1);
    const native = inputs[0];
    assert(native);
    expect(native).toMatchObject({ trusted: true, value: 'q' });
    assert(typeof native.value === 'string');
    await child.send({
      ...binding,
      type: 'input',
      input: {
        nodeId: native.index,
        revision: 1,
        eventType: native.type,
        bubbles: true,
        cancelable: false,
        isTrusted: native.trusted,
        value: native.value,
      },
    });
    const confirmation = await child.wait(
      (packet) => 'type' in packet && packet.type === 'inputConfirmed' && packet.revision === 1,
    );
    await expect(frame.locator('#result')).toHaveText('q');
    expect(await inspect()).toEqual(before);
    expect(confirmation).toMatchObject({ nodeId: native.index, revision: 1, value: 'q' });
    evidence.input = { native, before, after: await inspect(), confirmation };
    const eventCount = events.length;
    await frame.getByRole('button', { name: 'Choose object', exact: true }).click();
    const clicks: NativeEvent[] = await page.evaluate(
      (start) => Reflect.get(window, 'reportDOMProbe').events().slice(start),
      eventCount,
    );
    const click = clicks.find((event) => event.type === 'click');
    assert(click);
    expect(click.trusted).toBe(true);
    await child.send({
      ...binding,
      type: 'input',
      input: {
        nodeId: click.index,
        revision: 2,
        eventType: click.type,
        bubbles: true,
        cancelable: true,
        isTrusted: click.trusted,
      },
    });
    const selection = await child.wait((packet) => 'type' in packet && packet.type === 'select');
    expect(selection).toMatchObject({
      ...binding,
      objectIds: ['object-1'],
      request: 'Compare evidence',
    });
    const clicked = await child.wait(
      (packet) => 'type' in packet && packet.type === 'inputConfirmed' && packet.revision === 2,
    );
    evidence.selection = {
      click,
      selection,
      confirmation: clicked,
      consumer: 'fixture only; no Agent dispatch',
    };
    const note = frame.getByLabel('Report note', { exact: true });
    await expect(note).toHaveValue(initialNote);
    const noteHandle = await note.elementHandle();
    assert(noteHandle);
    await note.fill('Native note\nsecond line');
    const noteEvents: NativeEvent[] = await page.evaluate(() =>
      Reflect.get(window, 'reportDOMProbe').events(),
    );
    const noteEvent = noteEvents.findLast((event) => event.type === 'input');
    assert(noteEvent?.trusted);
    await child.send({
      ...binding,
      type: 'input',
      input: {
        nodeId: noteEvent.index,
        revision: 3,
        eventType: 'input',
        bubbles: true,
        cancelable: false,
        isTrusted: noteEvent.trusted,
        value: await note.inputValue(),
      },
    });
    const noteConfirmation = await child.wait(
      (packet) => 'type' in packet && packet.type === 'inputConfirmed' && packet.revision === 3,
    );
    expect(noteConfirmation).toMatchObject({ value: 'Native note\nsecond line' });
    await expect(frame.locator('#note-result')).toHaveText('Native note\nsecond line');
    await note.press('Tab');
    await expect(note).not.toBeFocused();
    await child.send({
      ...binding,
      type: 'restore',
      browse: {},
      draft: { note: 'Restored\r\nnote' },
      dirty: true,
    });
    await expect(note).toHaveValue('Restored\nnote');
    expect(
      await noteHandle.evaluate((node) => node === node.ownerDocument.querySelector('#note')),
    ).toBe(true);
    evidence.textarea = {
      native: noteEvent,
      confirmation: noteConfirmation,
      restored: await note.inputValue(),
      sameNode: true,
    };
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('host.png') });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await writeFile(
      info.outputPath('evidence.json'),
      JSON.stringify({ ...evidence, errors, failure: String(failure ?? '') }, null, 2),
    );
    try {
      await child.stop(failure);
    } finally {
      await page.evaluate(() => Reflect.get(window, 'reportDOMProbe').close());
    }
  }
});
