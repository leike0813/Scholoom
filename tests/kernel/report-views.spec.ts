import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import {
  type ReportControlClient,
  ReportControlHost,
} from '../../apps/kernel/dist/report-control.js';
import type { IsolationReceipt } from '../../packages/platform/dist/isolated-report-records.js';
import type { ResourceEvidence } from '../../packages/protocol/dist/resources.js';
import { barrier, preparationFixture } from '../fixtures/isolated-report-preparation.js';
import { reportFixture } from '../fixtures/report.js';

class ObservedApplication extends ManualApplication {
  get admission() {
    return this.processes;
  }
}

/** Real broker, domains, freeze, K/C RPC, files and receipts; OS support/controller are substitutes. */
async function fixture(root: string, stopping?: ReturnType<typeof barrier>) {
  const f = await preparationFixture(root);
  await f.provider.close();
  const { configId } = JSON.parse(await readFile(join(f.privateRoot, 'config.json'), 'utf8'));
  let binding!: ReturnType<ReportControlClient['connect']>;
  const counts = new Map<string, number>();
  const record = (frame: string) => {
    const { method } = JSON.parse(frame);
    if (typeof method === 'string') counts.set(method, (counts.get(method) ?? 0) + 1);
  };
  const host = new ReportControlHost(
    {
      send: (frame) => {
        record(frame);
        binding.receive(frame);
      },
    },
    {
      ...f.options,
      configId,
      native: {
        ...f.os,
        controller: (options) => {
          const controller = f.os.controller(options);
          return {
            ...controller,
            async stop() {
              await stopping?.wait();
              return controller.stop();
            },
          };
        },
      },
    },
  );
  const app = new ObservedApplication(join(root, 'profile'), undefined, undefined, undefined, {
    configId,
    programId: 'fixed',
    policyId: 'fixed',
    async connect(client) {
      binding = client.connect({
        send: (frame) => {
          record(frame);
          host.receive(frame);
        },
      });
      await client.initialize();
    },
  });
  try {
    await app.initialize();
    const report = await reportFixture(app, root);
    const product = app.connectProduct();
    const other = app.connectProduct();
    return {
      app,
      product,
      other,
      ...report,
      state: f.state,
      count: (method: string) => counts.get(method) ?? 0,
      disconnectControl: () => binding.disconnect(),
      index: async () => JSON.parse(await readFile(join(f.privateRoot, 'index.json'), 'utf8')),
      receipt: async (id: string) => (await f.receipt(id)).value as IsolationReceipt,
      async close() {
        product.close();
        other.close();
        try {
          await app.close();
        } finally {
          await host.disconnect();
          binding.disconnect();
        }
      },
    };
  } catch (error) {
    await app.close();
    await host.disconnect();
    throw error;
  }
}

function openInput(entry: ResourceEvidence) {
  return {
    viewId: randomUUID(),
    generation: 1,
    entry: { ref: entry.ref, basis: entry.basis },
  };
}

test.describe('product report views through real K/C control', () => {
  test.skip(
    process.platform !== 'linux' || process.arch !== 'x64',
    'Uses the preparation fixture real Linux flock; OS execution is substituted.',
  );

  test('parallel opens share one execution and lease; another connection cannot control the binding', async () => {
    const f = await fixture(test.info().outputPath('case'));
    const request = openInput(f.entry);
    const { viewId, generation } = request;
    const binding = { viewId, generation };
    try {
      await expect(f.app.call('resources.reportOpen', request)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
      expect(f.state.scopeStarts).toBe(0);
      const [first, second] = await Promise.all([
        f.product.call('resources.reportOpen', request),
        f.product.call('resources.reportOpen', request),
      ]);
      expect(second).toEqual(first);
      expect(first.status).toMatchObject({ phase: 'running', gateReleased: true });
      expect(f.state.scopeStarts).toBe(1);
      expect(f.count('reportHost.reserve')).toBe(1);
      expect(f.app.admission.status.active).toBe(1);
      expect(await f.index()).toHaveLength(1);
      expect(await f.receipt(first.status.instanceId)).toMatchObject({
        stage: { instanceId: first.status.instanceId, programId: 'fixed', policyId: 'fixed' },
        status: { phase: 'running', stopConfirmed: false },
      });
      for (const method of [
        'resources.reportGet',
        'resources.reportStop',
        'resources.reportExchange',
      ] as const) {
        await expect(f.other.call(method, binding)).rejects.toMatchObject({
          code: 'permissionDenied',
        });
        await expect(f.app.call(method, binding)).rejects.toMatchObject({
          code: 'permissionDenied',
        });
      }
      const read = { ...binding, path: 'assets/data.json', offset: 0, limit: 262144 };
      await expect(f.other.call('resources.reportRead', read)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
      await expect(f.app.call('resources.reportRead', read)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
      await expect(
        f.product.call('resources.reportOpen', {
          ...request,
          entry: { ...request.entry, basis: 'another-version' },
        }),
      ).rejects.toMatchObject({ code: 'instanceMismatch' });
      expect(await f.product.call('resources.reportGet', binding)).toMatchObject({
        instanceId: first.status.instanceId,
        phase: 'running',
      });
      expect(await f.product.call('resources.reportStop', binding)).toMatchObject({
        phase: 'stopped',
        stopConfirmed: true,
      });
      await expect.poll(() => f.app.admission.status.active).toBe(0);
    } finally {
      await f.close();
    }
  });

  test('read-only library permission opens frozen bytes; disconnect waits for report stop and preserves another lease', async () => {
    const stopping = barrier();
    const f = await fixture(test.info().outputPath('case'), stopping);
    const unrelated = f.app.admission.reserve();
    await unrelated.ready;
    const request = openInput(f.entry);
    const binding = { viewId: request.viewId, generation: request.generation };
    try {
      expect(() => f.app.library.check('send')).toThrow();
      const opened = await f.product.call('resources.reportOpen', request);
      expect(opened.snapshot.manifest).toEqual(f.manifest);
      expect(opened.files).toHaveLength(2);
      expect(opened.files).toEqual(
        expect.arrayContaining([
          { path: 'report.html', byteLength: Buffer.byteLength(f.html) },
          { path: 'assets/data.json', byteLength: Buffer.byteLength('[10,20]') },
        ]),
      );
      const dependency = f.manifest.resources[0];
      assert(dependency);
      await f.app.call('resources.save', {
        ref: dependency.ref,
        basis: dependency.basis,
        content: '[30,40]',
      });
      const first = await f.product.call('resources.reportRead', {
        ...binding,
        path: 'assets/data.json',
        offset: 0,
        limit: 3,
      });
      expect(first).toMatchObject({ offset: 0, size: 7, nextOffset: 3 });
      assert(first.nextOffset !== undefined);
      const last = await f.product.call('resources.reportRead', {
        ...binding,
        path: 'assets/data.json',
        offset: first.nextOffset,
        limit: 262144,
      });
      expect(
        Buffer.concat([
          Buffer.from(first.base64, 'base64'),
          Buffer.from(last.base64, 'base64'),
        ]).toString(),
      ).toBe('[10,20]');
      expect(last.nextOffset).toBeUndefined();
      f.product.close();
      await stopping.started;
      expect((await f.receipt(opened.status.instanceId)).status).toMatchObject({
        phase: 'stopping',
        stopConfirmed: false,
      });
      expect(f.app.admission.status.active).toBe(2);
      stopping.release();
      await expect
        .poll(async () => (await f.receipt(opened.status.instanceId)).status.stopConfirmed)
        .toBe(true);
      await expect.poll(() => f.app.admission.status.active).toBe(1);
    } finally {
      stopping.release();
      unrelated.release();
      await f.close();
    }
  });

  test('historical entry opens its original bytes after replacement and refuses a changed dependency', async () => {
    const f = await fixture(test.info().outputPath('case'));
    try {
      const current = await f.app.call('resources.save', {
        ref: f.entry.ref,
        basis: f.entry.basis,
        content: '<html><body>New ordinary document</body></html>',
      });
      expect(current.basis).not.toBe(f.entry.basis);
      const request = openInput(f.entry);
      const binding = { viewId: request.viewId, generation: request.generation };
      const opened = await f.product.call('resources.reportOpen', request);
      expect(opened.snapshot.resource).toMatchObject({
        ref: f.entry.ref,
        basis: f.entry.basis,
        capabilities: { write: false },
      });
      expect(opened.snapshot.manifest).toEqual(f.manifest);
      const bytes = await f.product.call('resources.reportRead', {
        ...binding,
        path: 'report.html',
        offset: 0,
        limit: 262144,
      });
      expect(Buffer.from(bytes.base64, 'base64').toString()).toBe(f.html);
      await f.product.call('resources.reportStop', binding);
      await expect.poll(() => f.app.admission.status.active).toBe(0);
      const dependency = f.manifest.resources[0];
      assert(dependency);
      await f.app.call('resources.save', {
        ref: dependency.ref,
        basis: dependency.basis,
        content: '[30,40]',
      });
      await expect(
        f.product.call('resources.reportOpen', openInput(f.entry)),
      ).rejects.toMatchObject({ code: 'contentChanged' });
      await expect.poll(() => f.app.admission.status.active).toBe(0);
      expect(f.state.scopeStarts).toBe(1);
      expect(await f.index()).toHaveLength(1);
    } finally {
      await f.close();
    }
  });

  for (const operation of ['resources.reportOpen', 'resources.reportRead'] as const)
    test(`revoking library reads blocks ${operation} while stop still settles the original receipt`, async () => {
      const stopping = barrier();
      const f = await fixture(test.info().outputPath('case'), stopping);
      const request = openInput(f.entry);
      const binding = { viewId: request.viewId, generation: request.generation };
      try {
        const opened = await f.product.call('resources.reportOpen', request);
        await f.app.call('library.grant', {
          read: false,
          write: false,
          send: true,
          autoBackup: false,
        });
        f.app.library.check('send');
        await expect(
          operation === 'resources.reportOpen'
            ? f.product.call(operation, request)
            : f.product.call(operation, {
                ...binding,
                path: 'report.html',
                offset: 0,
                limit: 262144,
              }),
        ).rejects.toMatchObject({ code: 'permissionDenied' });
        await stopping.started;
        expect(f.app.admission.status.active).toBe(1);
        expect(f.state.scopeStarts).toBe(1);
        expect(f.count('reportHost.reserve')).toBe(1);
        stopping.release();
        expect(await f.product.call('resources.reportStop', binding)).toMatchObject({
          instanceId: opened.status.instanceId,
          phase: 'stopped',
          stopConfirmed: true,
        });
        expect((await f.receipt(opened.status.instanceId)).status.stopConfirmed).toBe(true);
        await expect.poll(() => f.app.admission.status.active).toBe(0);
      } finally {
        stopping.release();
        await f.close();
      }
    });

  test('lost report control preserves its unknown lease while the other modules still close', async () => {
    const f = await fixture(test.info().outputPath('case'));
    const closed = new Set<string>();
    for (const [name, module] of [
      ['projects', f.app.projects],
      ['library', f.app.library],
      ['watches', f.app.fileWatches],
    ] as const) {
      const close = module.close.bind(module);
      module.close = async () => {
        closed.add(name);
        await close();
      };
    }
    try {
      await f.product.call('resources.reportOpen', openInput(f.entry));
      f.state.confirmStop = false;
      f.disconnectControl();
      await expect(f.app.close()).rejects.toBeInstanceOf(AggregateError);
      expect(closed).toEqual(new Set(['projects', 'library', 'watches']));
      expect(f.app.admission.status.active).toBe(1);
    } finally {
      f.state.confirmStop = true;
      await f.close().catch((error: unknown) => {
        expect(error).toBeInstanceOf(AggregateError);
      });
    }
  });

  test('losing C during an accepted freeze waits for the actual read before closing its data authority', async () => {
    const f = await fixture(test.info().outputPath('case'));
    const reading = barrier();
    let storageClosed = false;
    const close = f.app.projects.close.bind(f.app.projects);
    f.app.projects.close = async () => {
      storageClosed = true;
      await close();
    };
    const dependency = f.manifest.resources[0];
    assert(dependency?.ref.source === 'project');
    const fileId = dependency.ref.fileId;
    const read = f.app.resources.read.bind(f.app.resources);
    f.app.resources.read = async (input, context) => {
      const result = await read(input, context);
      if (input.ref.source === 'project' && input.ref.fileId === fileId) await reading.wait();
      return result;
    };
    const outcome = f.product
      .call('resources.reportOpen', openInput(f.entry))
      .catch((error: unknown) => error);
    let closing: Promise<unknown> | undefined;
    let settled = false;
    try {
      await reading.started;
      f.disconnectControl();
      closing = f.app
        .close()
        .catch((error: unknown) => error)
        .finally(() => {
          settled = true;
        });
      expect(await outcome).toMatchObject({ code: 'outcomeUnknown' });
      expect(settled).toBe(false);
      expect(storageClosed).toBe(false);
      expect(f.app.admission.status.active).toBe(1);
      reading.release();
      expect(await closing).toBeInstanceOf(AggregateError);
      expect(storageClosed).toBe(true);
      expect(f.state.scopeStarts).toBe(0);
      expect(f.app.admission.status.active).toBe(1);
    } finally {
      reading.release();
      await outcome;
      await closing;
      await f.close().catch((error: unknown) => {
        expect(error).toBeInstanceOf(AggregateError);
      });
    }
  });

  test('disconnect while queued cancels the original waiter without freezing or starting', async () => {
    const f = await fixture(test.info().outputPath('case'));
    const occupied = Array.from({ length: f.app.admission.status.limit }, () =>
      f.app.admission.reserve(),
    );
    await Promise.all(occupied.map((reservation) => reservation.ready));
    const outcome = f.product
      .call('resources.reportOpen', openInput(f.entry))
      .catch((error: unknown) => error);
    try {
      await expect.poll(() => f.app.admission.status.waiting).toBe(1);
      f.product.close();
      expect(await outcome).toMatchObject({ code: 'shuttingDown' });
      await expect.poll(() => f.app.admission.status.waiting).toBe(0);
      expect(f.app.admission.status.active).toBe(occupied.length);
      expect(f.count('reportHost.freeze')).toBe(0);
      expect(f.state.scopeStarts).toBe(0);
      expect(await f.index()).toEqual([]);
    } finally {
      for (const reservation of occupied) reservation.release();
      await outcome;
      await f.close();
    }
  });

  test('disconnect during real freeze retains the lease until the accepted read settles and never starts', async () => {
    const f = await fixture(test.info().outputPath('case'));
    const reading = barrier();
    const dependency = f.manifest.resources[0];
    assert(dependency?.ref.source === 'project');
    const fileId = dependency.ref.fileId;
    const read = f.app.resources.read.bind(f.app.resources);
    f.app.resources.read = async (input, context) => {
      const result = await read(input, context);
      if (input.ref.source === 'project' && input.ref.fileId === fileId) await reading.wait();
      return result;
    };
    let settled = false;
    const outcome = f.product
      .call('resources.reportOpen', openInput(f.entry))
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
      });
    try {
      await reading.started;
      f.product.close();
      await expect.poll(() => f.count('platform.reportIsolation.stop')).toBe(1);
      expect(settled).toBe(false);
      expect(f.app.admission.status.active).toBe(1);
      expect(await f.index()).toEqual([]);
      reading.release();
      expect(await outcome).toMatchObject({ code: 'unavailable' });
      await expect.poll(() => f.app.admission.status.active).toBe(0);
      expect(f.state.scopeStarts).toBe(0);
      expect(await f.index()).toEqual([]);
    } finally {
      reading.release();
      await outcome;
      await f.close();
    }
  });
});
