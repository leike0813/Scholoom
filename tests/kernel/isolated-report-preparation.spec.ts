import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { IsolationRecords } from '../../packages/platform/dist/isolated-report-records.js';
import { IsolatedReportProvider } from '../../packages/platform/dist/isolated-reports.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import {
  barrier,
  CountedAdmission,
  preparationFixture,
} from '../fixtures/isolated-report-preparation.js';

test.describe('single-lease isolated report preparation', () => {
  test.skip(
    process.platform !== 'linux' || process.arch !== 'x64',
    'Real Linux private records; OS controller is an explicit test adapter.',
  );

  test('full admission defers real freeze and merges one instance into one lease and durable byte set', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    const live = f.admission.reserve();
    await live.ready;
    const id = randomUUID();
    try {
      const prepared = f.provider.prepare(f.input(id), f.load);
      expect(f.provider.prepare(f.input(id), f.load)).toBe(prepared);
      await expect.poll(() => f.admission.status.waiting).toBe(1);
      expect(f.state.loads).toBe(0);
      expect(f.state.reads).toBe(0);
      expect(JSON.parse(await readFile(join(f.privateRoot, 'index.json'), 'utf8'))).toEqual([]);
      live.release();
      expect(await prepared).toMatchObject({
        phase: 'preparing',
        gateReleased: false,
        stopConfirmed: false,
      });
      expect(f.state.loads).toBe(1);
      expect(f.admission.reservations).toBe(2); // Unrelated live slot and exactly one prepare reservation.
      expect(f.admission.status.active).toBe(1);
      const record = await f.receipt(id);
      expect(record.value.stage.assets).toEqual([
        { path: 'reports/index.html', byteLength: Buffer.byteLength(f.html) },
        { path: 'reports/assets/data.json', byteLength: f.data.length },
      ]);
      expect(await readFile(join(record.directory, 'asset-0.bin'))).toEqual(Buffer.from(f.html));
      expect(await readFile(join(record.directory, 'asset-1.bin'))).toEqual(f.data);
      expect(f.state.scopeStarts).toBe(0);
      await f.provider.start({ instanceId: id });
      expect(f.state.intentsBeforeScope).toEqual([true]);
      expect((await f.provider.stop({ instanceId: id })).stopConfirmed).toBe(true);
      expect(f.admission.status.active).toBe(0);
    } finally {
      live.release();
      await f.provider.close();
    }
  });

  test('queued stop cancels the original waiter without loading or writing a false execution intent', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    const live = f.admission.reserve();
    await live.ready;
    const id = randomUUID();
    try {
      const pending = f.provider.prepare(f.input(id), f.load);
      const rejected = expect(pending).rejects.toMatchObject({ code: 'shuttingDown' });
      await expect.poll(() => f.admission.status.waiting).toBe(1);
      expect(await f.provider.stop({ instanceId: id })).toMatchObject({
        phase: 'stopped',
        stopConfirmed: true,
        gateReleased: false,
      });
      await rejected;
      expect(f.state.loads).toBe(0);
      expect(f.admission.status).toMatchObject({ active: 1, waiting: 0 });
      expect(JSON.parse(await readFile(join(f.privateRoot, 'index.json'), 'utf8'))).toEqual([]);
      live.release();
      expect(f.provider.prepare(f.input(id), f.load)).toBe(pending);
      await expect(pending).rejects.toMatchObject({ code: 'shuttingDown' });
      expect(f.state.loads).toBe(0);
    } finally {
      live.release();
      await f.provider.close();
    }
  });

  test('scope-free failed intentions keep duplicate promises within the original record inventory bound', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    f.state.granted = false;
    let last: Promise<unknown> | undefined;
    try {
      for (let i = 0; i < IsolationRecords.maxInstances; i++) {
        last = f.provider.prepare(f.input(`denied-${i}`), f.load);
        const result = await last.catch((error: unknown) => error);
        assert(result instanceof OperationError && result.code === 'permissionDenied');
      }
      expect(
        f.provider.prepare(f.input(`denied-${IsolationRecords.maxInstances - 1}`), f.load),
      ).toBe(last);
      await expect(f.provider.prepare(f.input('new-over-limit'), f.load)).rejects.toMatchObject({
        code: 'resourceLimit',
      });
      expect(f.admission.reservations).toBe(0);
      expect(f.state.loads).toBe(0);
      expect(JSON.parse(await readFile(join(f.privateRoot, 'index.json'), 'utf8'))).toEqual([]);
    } finally {
      await f.provider.close();
    }
  });

  test('a private prepare queued behind a durable public stage never takes or settles its lease', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    const creating = barrier();
    const create = IsolationRecords.prototype.create;
    IsolationRecords.prototype.create = async function (...args) {
      const receipt = await create.apply(this, args);
      await creating.wait();
      return receipt;
    };
    const id = randomUUID();
    const bytes = Buffer.from('original stage');
    let staged: Promise<unknown> | undefined;
    let prepared: Promise<unknown> | undefined;
    try {
      staged = f.provider.stage({
        ...f.input(id),
        entryPath: 'report.txt',
        assets: [{ path: 'report.txt', byteLength: bytes.length }],
      });
      await creating.started;
      prepared = f.provider.prepare(f.input(id), f.load);
      const result = prepared.catch((error: unknown) => error);
      IsolationRecords.prototype.create = create;
      creating.release();
      await staged;
      expect(await result).toMatchObject({ stopConfirmed: false, gateReleased: false });
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('preparing');
      expect(f.state.loads).toBe(0);
      expect(f.admission.reservations).toBe(1);
      expect(f.admission.status.active).toBe(1);
      await f.provider.put({
        instanceId: id,
        path: 'report.txt',
        offset: 0,
        base64: bytes.toString('base64'),
      });
      expect((await f.provider.stop({ instanceId: id })).stopConfirmed).toBe(true);
    } finally {
      IsolationRecords.prototype.create = create;
      creating.release();
      await Promise.allSettled([staged, prepared]);
      await f.provider.close();
    }
  });

  for (const authorization of [1, 2]) {
    test(`cancellation during authorization filesystem check ${authorization} cannot reserve or start a late freeze`, async () => {
      const f = await preparationFixture(test.info().outputPath('case'));
      const checking = barrier();
      const check = IsolationRecords.prototype.check;
      let checks = 0;
      IsolationRecords.prototype.check = async function () {
        await check.call(this);
        if (++checks === authorization) await checking.wait();
      };
      const controller = new AbortController();
      f.options.signal = () => controller.signal;
      const id = randomUUID();
      const prepared = f.provider.prepare(f.input(id), f.load);
      const result = prepared.catch((error: unknown) => error);
      try {
        await checking.started;
        controller.abort();
        IsolationRecords.prototype.check = check;
        checking.release();
        expect(await result).toMatchObject({ code: 'shuttingDown' });
        expect(f.state.loads).toBe(0);
        expect(f.admission.reservations).toBe(authorization - 1);
        expect(f.admission.status.active).toBe(0);
      } finally {
        IsolationRecords.prototype.check = check;
        checking.release();
        await result;
        await f.provider.close();
      }
    });
  }

  for (const action of ['stop', 'late-reject', 'close', 'abort'] as const) {
    test(`${action} seals a real in-flight freeze and retains preparation capacity until it settles`, async () => {
      const f = await preparationFixture(test.info().outputPath('case'));
      const reading = barrier();
      const controller = new AbortController();
      f.options.signal = () => controller.signal;
      f.state.onRead = async (id) => {
        if (id !== 'entry') return;
        await reading.wait();
        if (action === 'late-reject')
          throw new OperationError('unavailable', 'test late read failure');
      };
      const id = randomUUID();
      const prepared = f.provider.prepare(f.input(id), f.load);
      const outcome = prepared.then(
        () => undefined,
        (error: unknown) => error,
      );
      let settling: Promise<unknown> | undefined;
      let settled = false;
      try {
        await reading.started;
        await expect(
          f.provider.prepare({ ...f.input(id), policyId: 'different' }, f.load),
        ).rejects.toMatchObject({ code: 'invalidRequest' });
        if (action === 'close') {
          settling = f.provider.close();
          expect(f.provider.close()).toBe(settling);
        } else if (action === 'abort') {
          controller.abort();
          settling = f.provider.stop({ instanceId: id });
        } else settling = f.provider.stop({ instanceId: id });
        void settling.then(() => {
          settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);
        expect(f.admission.status.active).toBe(1);
        expect(JSON.parse(await readFile(join(f.privateRoot, 'index.json'), 'utf8'))).toEqual([]);
        if (action !== 'close')
          expect((await f.provider.get({ instanceId: id })).phase).toBe('stopping');
        reading.release();
        expect(await outcome).toMatchObject({
          code: action === 'late-reject' ? 'unavailable' : 'shuttingDown',
        });
        await settling;
        expect(f.admission.status.active).toBe(0);
        expect(f.state.scopeStarts).toBe(0);
        expect(JSON.parse(await readFile(join(f.privateRoot, 'index.json'), 'utf8'))).toEqual([]);
        await expect(f.provider.start({ instanceId: id })).rejects.toBeDefined();
        if (action !== 'close')
          expect(await f.provider.get({ instanceId: id })).toMatchObject({
            phase: 'stopped',
            stopConfirmed: true,
          });
      } finally {
        reading.release();
        await outcome;
        await settling;
        await f.provider.close();
      }
    });
  }

  for (const fault of ['queued-revoke', 'read-revoke', 'version', 'missing-file'] as const) {
    test(`${fault} rejects actual frozen bytes and releases only the scope-free preparation`, async () => {
      const f = await preparationFixture(test.info().outputPath('case'));
      const live = fault === 'queued-revoke' ? f.admission.reserve() : undefined;
      await live?.ready;
      const id = randomUUID();
      let changed = false;
      f.state.onRead = async (key) => {
        if (key !== 'data' || changed) return;
        changed = true;
        if (fault === 'read-revoke') f.state.granted = false;
        if (fault === 'version' && f.descriptors.data) f.descriptors.data.basis = 'd2';
        if (fault === 'missing-file')
          await rename(
            join(f.source, 'reports/assets/data.json'),
            join(f.source, 'reports/assets/data-preserved.json'),
          );
      };
      try {
        const prepared = f.provider.prepare(f.input(id), f.load);
        const rejected = prepared.catch((error: unknown) => error);
        if (live) {
          await expect.poll(() => f.admission.status.waiting).toBe(1);
          f.state.granted = false;
          live.release();
        }
        const error = await rejected;
        expect(error).toBeDefined();
        if (fault === 'missing-file') expect(error).toMatchObject({ code: 'ENOENT' });
        expect(await f.provider.get({ instanceId: id })).toMatchObject({
          phase: 'stopped',
          stopConfirmed: true,
          gateReleased: false,
          failure: {
            code:
              fault === 'version'
                ? 'contentChanged'
                : fault === 'missing-file'
                  ? 'notFound'
                  : 'permissionDenied',
          },
        });
        expect(f.admission.status.active).toBe(0);
        expect(f.state.scopeStarts).toBe(0);
        expect(f.state.loads).toBe(fault === 'queued-revoke' ? 0 : 1);
        expect(JSON.parse(await readFile(join(f.privateRoot, 'index.json'), 'utf8'))).toEqual([]);
      } finally {
        live?.release();
        await f.provider.close();
      }
    });
  }

  test('stopped receipt persistence failure holds unknown even when preparation created no OS scope', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    const id = randomUUID();
    await f.provider.prepare(f.input(id), f.load);
    const moved = `${f.privateRoot}-preserved`;
    let replaced = false;
    try {
      await rename(f.privateRoot, moved);
      await mkdir(f.privateRoot, { mode: 0o700 });
      replaced = true;
      expect(await f.provider.stop({ instanceId: id })).toMatchObject({
        phase: 'unknown',
        stopConfirmed: false,
      });
      expect(f.admission.status.active).toBe(1);
      expect(f.state.scopeStarts).toBe(0);
      await expect(f.provider.start({ instanceId: id })).rejects.toBeDefined();
    } finally {
      if (replaced) {
        await rename(f.privateRoot, `${f.privateRoot}-replacement`);
        await rename(moved, f.privateRoot);
      }
      await f.provider.reconcile();
      expect((await f.provider.get({ instanceId: id })).stopConfirmed).toBe(true);
      expect(f.admission.status.active).toBe(0);
      await f.provider.close();
    }
  });

  test('old six operations still stage/upload/query/stop and unknown OS outcomes retain the single hold', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    const port = f.provider.port();
    expect(Object.keys(port)).toHaveLength(6);
    const id = randomUUID();
    const bytes = Buffer.from('旧接口');
    const input = {
      ...f.input(id),
      entryPath: 'report.txt',
      assets: [{ path: 'report.txt', byteLength: bytes.length }],
    };
    try {
      expect(
        await port['platform.reportIsolation.check']({ programId: 'fixed', policyId: 'fixed' }),
      ).toEqual({ available: true });
      await port['platform.reportIsolation.stage'](input);
      await expect
        .poll(async () => (await port['platform.reportIsolation.get']({ instanceId: id })).phase)
        .toBe('preparing');
      await port['platform.reportIsolation.put']({
        instanceId: id,
        path: 'report.txt',
        offset: 0,
        base64: bytes.toString('base64'),
      });
      expect((await port['platform.reportIsolation.stage'](input)).next).toBeUndefined();
      await expect(
        port['platform.reportIsolation.stage']({ ...input, entryPath: 'other' }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
      await port['platform.reportIsolation.start']({ instanceId: id });
      f.state.confirmStop = false;
      expect(await port['platform.reportIsolation.stop']({ instanceId: id })).toMatchObject({
        phase: 'unknown',
        stopConfirmed: false,
      });
      expect(f.admission.status.active).toBe(1);
      f.state.confirmStop = true;
      await f.provider.reconcile();
      expect((await port['platform.reportIsolation.get']({ instanceId: id })).stopConfirmed).toBe(
        true,
      );
      expect(f.admission.reservations).toBe(1);
      expect(f.admission.status.active).toBe(0);
    } finally {
      f.state.confirmStop = true;
      await f.provider.close();
    }
  });

  test('restored original uncertain intent holds admission before reconciliation and never reloads current bytes', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    const id = randomUUID();
    await f.provider.prepare(f.input(id), f.load);
    f.state.failStart = true;
    await expect(f.provider.start({ instanceId: id })).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    const saved = (await f.receipt(id)).value;
    expect(saved).toMatchObject({
      scopeIntent: true,
      status: { phase: 'unknown', stopConfirmed: false },
    });
    expect(f.admission.status.active).toBe(1);
    await f.provider.close();
    // Fault input: preserve the actual pre-confirmation receipt to model a restart at that boundary.
    const records = new IsolationRecords(f.privateRoot);
    await records.initialize();
    await records.load();
    await records.save(saved);
    await records.close();
    const admission = new CountedAdmission(1);
    const observed: number[] = [];
    f.state.confirmStop = false;
    const restored = new IsolatedReportProvider(
      { ...f.options, admission },
      {
        ...f.os,
        stopRecovered: async () => {
          observed.push(admission.status.active);
          if (!f.state.confirmStop)
            throw new OperationError('outcomeUnknown', 'test recovery unknown');
        },
      },
    );
    try {
      await restored.initialize();
      expect(observed).toEqual([1]);
      expect(admission.status.active).toBe(1);
      expect(await restored.prepare(f.input(id), f.load)).toMatchObject({
        phase: 'unknown',
        stopConfirmed: false,
      });
      expect(f.state.loads).toBe(1);
      expect(f.state.scopeStarts).toBe(1);
      expect(admission.reservations).toBe(0);
      f.state.confirmStop = true;
      await restored.reconcile();
      expect((await restored.get({ instanceId: id })).stopConfirmed).toBe(true);
      expect(admission.status.active).toBe(0);
    } finally {
      f.state.confirmStop = true;
      await restored.close();
    }
  });
});
