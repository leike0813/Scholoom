import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LiteratureCatalog } from '../../apps/kernel/dist/literature/catalog.js';
import { PdfReading } from '../../apps/kernel/dist/literature/pdf-reading.js';
import {
  encryptedPdf,
  malformedPdf,
  syntheticPdf,
  textlessPdf,
  toArrayBuffer,
} from '../pdf-fixture.js';

const hangingLoad = () => new Promise<ArrayBuffer>(() => {});
const outcome = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => 'resolved',
    (error: { code: string }) => error.code,
  );

/** Replaces the 30s acceptance budget with a callback the test fires by hand. */
function captureAcceptanceBudget() {
  const realSetTimeout = globalThis.setTimeout;
  let expired: (() => void) | undefined;
  globalThis.setTimeout = ((handler: () => void, delay?: number) => {
    if (delay === 30_000) {
      expired ??= handler;
      return { syntheticBudget: true };
    }
    return realSetTimeout(handler, delay);
  }) as unknown as typeof globalThis.setTimeout;
  return {
    fire: () => {
      const handler = expired;
      expired = undefined;
      handler?.();
    },
    restore: () => {
      globalThis.setTimeout = realSetTimeout;
    },
  };
}

async function importPdf(root: string, bytes: Buffer) {
  const catalog = new LiteratureCatalog(join(root, 'profile'), () => {});
  await catalog.initialize();
  catalog.grant({ read: true, write: true, send: false, autoBackup: false });
  const path = join(root, 'material.pdf');
  await writeFile(path, bytes);
  const batch = catalog.importFiles({
    batchId: randomUUID(),
    paths: [path],
    purpose: '正文',
    version: 'unspecified',
    origin: 'pdf-boundary-test',
  });
  await expect.poll(() => catalog.batch({ batchId: batch.id }).batch.state).toBe('completed');
  const receipt = catalog.batch({ batchId: batch.id }).entries[0];
  assert(receipt?.sourceId);
  const attachment = (await catalog.attachments({ sourceId: receipt.sourceId })).attachments[0];
  assert(attachment);
  return {
    catalog,
    reference: { attachmentId: attachment.id, materialVersionId: attachment.materialVersionId },
  };
}

test('queue admits one running and eight waiting PDF requests, then refuses more', async () => {
  const reading = new PdfReading();
  const accepted = [outcome(reading.run(hangingLoad, { kind: 'info' }))];
  for (let index = 0; index < 8; index++)
    accepted.push(outcome(reading.run(hangingLoad, { kind: 'info' })));
  await expect(reading.run(hangingLoad, { kind: 'info' })).rejects.toMatchObject({
    code: 'unavailable',
  });
  reading.close();
  expect(await Promise.all(accepted)).toEqual(Array.from({ length: 9 }, () => 'shuttingDown'));
});

test('shutdown aborts the running request and refuses later ones', async () => {
  const reading = new PdfReading();
  let signal: AbortSignal | undefined;
  const running = outcome(
    reading.run(
      (received) => {
        signal = received;
        return hangingLoad();
      },
      { kind: 'info' },
    ),
  );
  const waiting = outcome(reading.run(hangingLoad, { kind: 'info' }));
  reading.close();
  expect(await Promise.all([running, waiting])).toEqual(['shuttingDown', 'shuttingDown']);
  expect(signal?.aborted).toBe(true);
  await expect(reading.run(hangingLoad, { kind: 'info' })).rejects.toMatchObject({
    code: 'shuttingDown',
  });
});

test('a timed-out request releases the slot so a later read still completes', async () => {
  const reading = new PdfReading();
  const budget = captureAcceptanceBudget();
  try {
    const timedOut = outcome(reading.run(hangingLoad, { kind: 'info' }));
    budget.fire();
    expect(await timedOut).toBe('unavailable');
    const info = await reading.run(async () => toArrayBuffer(syntheticPdf()), { kind: 'info' });
    expect(info).toMatchObject({ pageCount: 2 });
  } finally {
    budget.restore();
    reading.close();
  }
});

test('a damaged PDF is reported as unparsable, not as empty text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-pdf-damaged-'));
  const { catalog, reference } = await importPdf(root, malformedPdf());
  try {
    await expect(catalog.readPdfPage({ ...reference, pageIndex: 0 })).rejects.toMatchObject({
      code: 'invalidRequest',
      message: expect.stringContaining('无法解析'),
    });
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});

test('delivery verification shares the request deadline and cancellation releases queued work', async () => {
  const reading = new PdfReading();
  const budget = captureAcceptanceBudget();
  let checking!: () => void;
  const entered = new Promise<void>((resolve) => {
    checking = resolve;
  });
  try {
    const pending = outcome(
      reading.run(
        async () => toArrayBuffer(syntheticPdf()),
        { kind: 'info' },
        {
          verify: async () => {
            checking();
            await hangingLoad();
          },
        },
      ),
    );
    await entered;
    budget.fire();
    expect(await pending).toBe('unavailable');
    const controller = new AbortController();
    const cancelled = outcome(
      reading.run(hangingLoad, { kind: 'info' }, { signal: controller.signal }),
    );
    const queued = reading.run(async () => toArrayBuffer(syntheticPdf()), { kind: 'info' });
    controller.abort();
    expect(await cancelled).toBe('shuttingDown');
    expect(await queued).toMatchObject({ pageCount: 2 });
  } finally {
    budget.restore();
    reading.close();
  }
});
test('an encrypted PDF is rejected as unsupported material', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-pdf-encrypted-'));
  const { catalog, reference } = await importPdf(root, encryptedPdf());
  try {
    await expect(catalog.readPdfPage({ ...reference, pageIndex: 0 })).rejects.toMatchObject({
      code: 'invalidRequest',
      message: expect.stringContaining('暂不支持加密'),
    });
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});
test('a page without a text layer reports no extractable text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-pdf-textless-'));
  const { catalog, reference } = await importPdf(root, textlessPdf());
  try {
    expect(await catalog.pdfInfo(reference)).toMatchObject({ pageCount: 1 });
    expect(await catalog.readPdfPage({ ...reference, pageIndex: 0 })).toMatchObject({
      width: 300,
      height: 400,
      hasText: false,
      text: '',
    });
  } finally {
    await catalog.close();
    await rm(root, { recursive: true });
  }
});
