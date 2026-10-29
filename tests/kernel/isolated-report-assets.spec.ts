import { randomUUID } from 'node:crypto';
import {
  chmod,
  link,
  lstat,
  readdir,
  readFile,
  readlink,
  rename,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { IsolationAssets } from '../../packages/platform/dist/isolated-report-assets.js';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import { IsolationRecords } from '../../packages/platform/dist/isolated-report-records.js';
import { IsolatedReportProvider } from '../../packages/platform/dist/isolated-reports.js';
import { barrier, preparationFixture } from '../fixtures/isolated-report-preparation.js';

const payloads = [Buffer.from('独立固定入口 bytes.'), Buffer.from('{"doses":[10,20]}')] as const;
async function stamp(path: string) {
  const s = await lstat(path, { bigint: true });
  return [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
}
async function descriptors(path: string) {
  const targets = await Promise.all(
    (await readdir('/proc/self/fd')).map(async (fd) => {
      try {
        return { fd, path: await readlink(`/proc/self/fd/${fd}`) };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return undefined;
      }
    }),
  );
  return targets.filter((entry) => entry?.path === path);
}
async function fixture() {
  const root = test.info().outputPath('case');
  const records = new IsolationRecords(join(root, 'records'));
  await records.initialize();
  let lock: Awaited<ReturnType<typeof isolationLock>> | undefined;
  try {
    lock = await isolationLock(records.lockPath);
    await records.load();
    const receipt = await records.create(
      {
        instanceId: randomUUID(),
        programId: 'fixed',
        policyId: 'fixed',
        entryPath: 'entry.txt',
        assets: payloads.map((bytes, index) => ({
          path: index === 0 ? 'entry.txt' : 'data.json',
          byteLength: bytes.length,
        })),
      },
      '1',
      '1',
    );
    const directory = join(records.path, receipt.storageId);
    const assets = new IsolationAssets(records);
    return {
      root,
      records,
      receipt,
      assets,
      directory,
      asset: (index: number) => join(directory, `asset-${index}.bin`),
      stored: async () => JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8')),
      close: async () => {
        try {
          await records.close();
        } finally {
          await lock?.close();
        }
      },
    };
  } catch (error) {
    await records.close();
    await lock?.close();
    throw error;
  }
}

test.describe('fixed report assets with real records and native flock', () => {
  test.skip(process.platform !== 'linux' || process.arch !== 'x64', 'Original Linux native flock.');

  test('real chunks hold the file through durable commit and seal the approved program and gate bytes', async () => {
    const f = await fixture();
    const held = barrier();
    let pending: Promise<void> | undefined;
    try {
      await f.assets.prepare(f.receipt);
      for (const i of [0, 1] as const) {
        expect(await readFile(f.asset(i))).toEqual(Buffer.alloc(0));
        expect((await lstat(f.asset(i))).mode & 0o777).toBe(0o600);
        expect(f.receipt.stamps[i]).toBe(await stamp(f.asset(i)));
      }
      pending = f.assets.put(f.receipt, 0, 0, payloads[0].subarray(0, 4), async () => {
        await held.wait();
        await f.records.save(f.receipt);
      });
      await Promise.race([held.started, pending]);
      expect(await descriptors(f.asset(0))).toHaveLength(1);
      expect(await readFile(f.asset(0))).toEqual(payloads[0].subarray(0, 4));
      expect(f.receipt.offsets[0]).toBe(4);
      expect((await f.stored()).offsets).toEqual([0, 0]);
      held.release();
      await pending;
      expect(await descriptors(f.asset(0))).toHaveLength(0);
      expect((await f.stored()).offsets).toEqual([4, 0]);
      for (const i of [0, 1] as const) {
        const offset = i === 0 ? 4 : 0;
        await f.assets.put(f.receipt, i, offset, payloads[i].subarray(offset), () =>
          f.records.save(f.receipt),
        );
        expect(await readFile(f.asset(i))).toEqual(payloads[i]);
      }
      const program = Buffer.from('fixed trusted program image, not executed by this module test');
      const gate = await readFile(
        new URL('../../packages/platform/dist/isolated-report-gate', import.meta.url),
      );
      await f.assets.seal(f.receipt, program);
      for (const i of [0, 1] as const) {
        expect((await lstat(f.asset(i))).mode & 0o777).toBe(0o400);
        expect(f.receipt.stamps[i]).toBe(await stamp(f.asset(i)));
      }
      for (const [name, bytes] of [
        ['program.bin', program],
        ['gate.bin', gate],
      ] as const) {
        const path = join(f.directory, name);
        expect(await readFile(path)).toEqual(bytes);
        const info = await lstat(path);
        expect(info.mode & 0o777).toBe(0o400);
        expect(info.nlink).toBe(1);
        expect(info.uid).toBe(process.getuid?.());
        expect(await descriptors(path)).toHaveLength(0);
      }
      expect(f.receipt.sealed).toEqual({
        program: await stamp(join(f.directory, 'program.bin')),
        gate: await stamp(join(f.directory, 'gate.bin')),
      });
    } finally {
      held.release();
      try {
        await pending;
      } finally {
        await f.close();
      }
    }
  });

  for (const change of ['replacement', 'in-place', 'hard-link', 'offset'] as const) {
    test(`put rejects real ${change} mismatch without committing or advancing receipt facts`, async () => {
      const f = await fixture();
      try {
        await f.assets.prepare(f.receipt);
        const before = structuredClone(f.receipt);
        if (change === 'replacement') {
          await rename(f.asset(0), join(f.root, 'preserved.bin'));
          await writeFile(f.asset(0), '', { mode: 0o600 });
        } else if (change === 'in-place') await writeFile(f.asset(0), 'X');
        else if (change === 'hard-link') await link(f.asset(0), join(f.root, 'preserved.link'));
        const bytes = await readFile(f.asset(0));
        let committed = false;
        await expect(
          f.assets.put(f.receipt, 0, change === 'offset' ? 1 : 0, payloads[0], async () => {
            committed = true;
            await f.records.save(f.receipt);
          }),
        ).rejects.toMatchObject({
          code: change === 'hard-link' ? 'outcomeUnknown' : 'contentChanged',
        });
        expect(committed).toBe(false);
        expect(f.receipt).toEqual(before);
        expect(await readFile(f.asset(0))).toEqual(bytes);
        expect(await descriptors(f.asset(0))).toHaveLength(0);
      } finally {
        await f.close();
      }
    });
  }

  test('a real durable commit failure retains written bytes and memory facts without a successful receipt', async () => {
    const f = await fixture();
    try {
      await f.assets.prepare(f.receipt);
      const before = await f.stored();
      await expect(
        f.assets.put(f.receipt, 0, 0, payloads[0], async () => {
          expect(await descriptors(f.asset(0))).toHaveLength(1);
          await chmod(f.directory, 0o500);
          await f.records.save(f.receipt);
        }),
      ).rejects.toMatchObject({ code: 'EACCES' });
      expect(await readFile(f.asset(0))).toEqual(payloads[0]);
      expect(f.receipt.offsets[0]).toBe(payloads[0].length);
      expect(f.receipt.stamps[0]).toBe(await stamp(f.asset(0)));
      expect(await f.stored()).toEqual(before);
      expect(await descriptors(f.asset(0))).toHaveLength(0);
    } finally {
      await chmod(f.directory, 0o700);
      await f.close();
    }
  });

  test('partial prepare preserves completed physical facts and closes each created file', async () => {
    const f = await fixture();
    try {
      await writeFile(f.asset(1), 'preexisting object', { mode: 0o600 });
      await expect(f.assets.prepare(f.receipt)).rejects.toMatchObject({ code: 'EEXIST' });
      expect(await readFile(f.asset(0))).toEqual(Buffer.alloc(0));
      expect(f.receipt.stamps[0]).toBe(await stamp(f.asset(0)));
      expect(f.receipt.stamps[1]).toBe('');
      expect(await descriptors(f.asset(0))).toHaveLength(0);
      expect(await readFile(f.asset(1), 'utf8')).toBe('preexisting object');
    } finally {
      await f.close();
    }
  });

  test('partial seal retains the first sealed asset fact when a later original object changed', async () => {
    const f = await fixture();
    try {
      await f.assets.prepare(f.receipt);
      for (const i of [0, 1] as const)
        await f.assets.put(f.receipt, i, 0, payloads[i], () => f.records.save(f.receipt));
      const second = f.receipt.stamps[1];
      await writeFile(f.asset(1), Buffer.alloc(payloads[1].length, 'X'));
      await expect(f.assets.seal(f.receipt, Buffer.from('fixed image'))).rejects.toMatchObject({
        code: 'contentChanged',
      });
      expect((await lstat(f.asset(0))).mode & 0o777).toBe(0o400);
      expect(f.receipt.stamps[0]).toBe(await stamp(f.asset(0)));
      expect(f.receipt.stamps[1]).toBe(second);
      expect(f.receipt.sealed).toBeUndefined();
      expect(await descriptors(f.asset(0))).toHaveLength(0);
      expect(await descriptors(f.asset(1))).toHaveLength(0);
    } finally {
      await f.close();
    }
  });

  test('a preexisting gate preserves the completed program fingerprint and closes both files', async () => {
    const f = await fixture();
    const program = Buffer.from('approved partial program image');
    const gate = Buffer.from('preexisting gate must remain untouched');
    const programPath = join(f.directory, 'program.bin');
    const gatePath = join(f.directory, 'gate.bin');
    try {
      await f.assets.prepare(f.receipt);
      for (const i of [0, 1] as const)
        await f.assets.put(f.receipt, i, 0, payloads[i], () => f.records.save(f.receipt));
      await writeFile(gatePath, gate, { mode: 0o600 });
      await expect(f.assets.seal(f.receipt, program)).rejects.toMatchObject({ code: 'EEXIST' });
      expect(await readFile(programPath)).toEqual(program);
      expect((await lstat(programPath)).mode & 0o777).toBe(0o400);
      expect(await readFile(gatePath)).toEqual(gate);
      expect(await descriptors(programPath)).toHaveLength(0);
      expect(await descriptors(gatePath)).toHaveLength(0);
      expect(f.receipt.sealed).toEqual({ program: await stamp(programPath), gate: '' });
    } finally {
      await f.close();
    }
  });

  test('provider persists the completed program seal after gate failure without creating a controller', async () => {
    const f = await preparationFixture(test.info().outputPath('case'));
    const id = randomUUID();
    const controller = f.os.controller;
    let controllers = 0;
    f.os.controller = (options) => {
      controllers++;
      return controller(options);
    };
    try {
      const program = f.options.programs[0];
      if (!program) throw new Error('Expected the registered fixed program.');
      await f.provider.prepare(f.input(id), f.load);
      const record = await f.receipt(id);
      const programPath = join(record.directory, 'program.bin');
      const gatePath = join(record.directory, 'gate.bin');
      const gate = Buffer.from('preexisting gate prevents complete sealing');
      await writeFile(gatePath, gate, { mode: 0o600 });
      await expect(f.provider.start({ instanceId: id })).rejects.toMatchObject({ code: 'EEXIST' });
      expect(await readFile(programPath)).toEqual(Buffer.from(program.image));
      expect((await lstat(programPath)).mode & 0o777).toBe(0o400);
      expect(await readFile(gatePath)).toEqual(gate);
      expect(await descriptors(programPath)).toHaveLength(0);
      expect(await descriptors(gatePath)).toHaveLength(0);
      const stored = (await f.receipt(id)).value;
      expect(stored.sealed).toEqual({ program: await stamp(programPath), gate: '' });
      expect(stored).toMatchObject({
        scopeIntent: false,
        launchIntent: false,
        status: { phase: 'stopped', gateReleased: false, stopConfirmed: true },
      });
      expect(controllers).toBe(0);
      expect(f.state.scopeStarts).toBe(0);
      expect(f.admission.status.active).toBe(0);
      await expect(f.provider.start({ instanceId: id })).rejects.toMatchObject({
        code: 'invalidRequest',
      });
      expect(controllers).toBe(0);
    } finally {
      f.os.controller = controller;
      await f.provider.close();
    }
  });

  for (const fault of ['persistence', 'lock-loss'] as const) {
    test(`provider refuses an ACK after real bytes when ${fault} prevents its original commit`, async () => {
      const f = await preparationFixture(test.info().outputPath('case'));
      await f.provider.close();
      let lock: Awaited<ReturnType<typeof isolationLock>> | undefined;
      f.provider = new IsolatedReportProvider(f.options, {
        ...f.os,
        lock: async (path) => {
          lock = await isolationLock(path);
          return lock;
        },
      });
      await f.provider.initialize();
      const id = randomUUID();
      const bytes = Buffer.from('actual provider bytes before commit');
      const originalPut = IsolationAssets.prototype.put;
      let directory: string | undefined;
      let lost = false;
      try {
        await f.provider.stage({
          ...f.input(id),
          entryPath: 'report.txt',
          assets: [{ path: 'report.txt', byteLength: bytes.length }],
        });
        await expect.poll(async () => (await f.receipt(id)).value.status.phase).toBe('preparing');
        const record = await f.receipt(id);
        directory = record.directory;
        const before = await readFile(join(directory, 'receipt.json'));
        // Inject only the real fault after original IO, then invoke the unchanged provider commit.
        IsolationAssets.prototype.put = function (receipt, index, offset, chunk, commit) {
          return originalPut.call(this, receipt, index, offset, chunk, async () => {
            if (receipt.stage.instanceId === id) {
              if (fault === 'persistence') await chmod(record.directory, 0o500);
              else {
                lost = true;
                await lock?.close();
              }
            }
            await commit();
          });
        };
        await expect(
          f.provider.put({
            instanceId: id,
            path: 'report.txt',
            offset: 0,
            base64: bytes.toString('base64'),
          }),
        ).rejects.toMatchObject({ code: fault === 'lock-loss' ? 'outcomeUnknown' : 'EACCES' });
        expect(await readFile(join(directory, 'asset-0.bin'))).toEqual(bytes);
        expect(await descriptors(join(directory, 'asset-0.bin'))).toHaveLength(0);
        expect(await readFile(join(directory, 'receipt.json'))).toEqual(before);
        expect(f.admission.status.active).toBe(1);
        expect(f.state.scopeStarts).toBe(0);
        await expect(f.provider.start({ instanceId: id })).rejects.toBeDefined();
        if (lost) {
          await expect(f.provider.get({ instanceId: id })).rejects.toMatchObject({
            code: 'unavailable',
          });
          await expect(f.provider.close()).rejects.toMatchObject({ code: 'outcomeUnknown' });
          expect(f.admission.status.active).toBe(1);
        } else {
          expect(await f.provider.get({ instanceId: id })).toMatchObject({
            phase: 'unknown',
            stopConfirmed: false,
          });
          await chmod(directory, 0o700);
          await f.provider.reconcile();
          expect((await f.provider.get({ instanceId: id })).stopConfirmed).toBe(true);
          expect(f.admission.status.active).toBe(0);
        }
      } finally {
        IsolationAssets.prototype.put = originalPut;
        if (directory) await chmod(directory, 0o700);
        if (lost) {
          // No scope was created; retire only this test owner's pinned FDs, retaining unknown evidence.
          await (Reflect.get(f.provider, 'records') as IsolationRecords).close();
        } else await f.provider.close();
        if (lock?.alive()) await lock.close();
      }
    });
  }
});
