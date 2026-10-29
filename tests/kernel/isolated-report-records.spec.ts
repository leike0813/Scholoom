import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import { IsolationRecords } from '../../packages/platform/dist/isolated-report-records.js';
import { IsolatedReportProvider, ProcessAdmission } from '../../packages/platform/dist/node.js';
import { validateIsolationStage } from '../../packages/protocol/dist/platform-isolation.js';

const cache =
  process.env.SCHOOLOOM_ISOLATION_TEST_CACHE ??
  join(homedir(), '.cache', 'scholoom-isolation-tests');
const stage = (instanceId: string) => ({
  instanceId,
  programId: 'fixed',
  policyId: 'native',
  entryPath: 'report.txt',
  assets: [{ path: 'report.txt', byteLength: 0 }],
});
async function store() {
  const root = join(cache, `records-${randomUUID()}`),
    records = new IsolationRecords(root);
  await records.initialize();
  const lock = await isolationLock(records.lockPath);
  await records.load();
  return { root, records, lock };
}
test.describe('private real record storage boundaries', () => {
  test.skip(process.platform !== 'linux' || process.arch !== 'x64', 'Linux native flock only.');

  test('missing config never replaces a nonempty real recovery index or rebinds its identity', async () => {
    const f = await store();
    const receipt = await f.records.create(stage('unconfirmed'), '1', '1');
    const before = await readFile(join(f.root, 'index.json'));
    await f.records.close();
    await f.lock.close();
    await rename(join(f.root, 'config.json'), join(f.root, 'config-preserved.json'));
    const provider = new IsolatedReportProvider({
      admission: new ProcessAdmission(1),
      privateRoot: f.root,
      programs: [],
      policies: [],
      authorize: async () => {},
    });
    await expect(provider.initialize()).rejects.toMatchObject({ code: 'unavailable' });
    expect(await readFile(join(f.root, 'index.json'))).toEqual(before);
    const actual = JSON.parse(
      await readFile(join(f.root, receipt.storageId, 'receipt.json'), 'utf8'),
    );
    expect(actual).toMatchObject({ configId: receipt.configId, status: { stopConfirmed: false } });
  });

  for (const fault of ['unindexed receipt', 'temporary file', 'indexed non-directory'] as const) {
    test(`provider refuses ${fault} before reconciling any indexed receipt`, async () => {
      const f = await store();
      const receipt = await f.records.create(stage('unconfirmed'), '1', '1');
      await f.records.close();
      await f.lock.close();
      let receiptPath = join(f.root, receipt.storageId, 'receipt.json');
      let extraPath: string;
      if (fault === 'unindexed receipt') {
        const orphan = {
          ...structuredClone(receipt),
          storageId: randomUUID(),
          stage: stage('unindexed'),
          status: { ...receipt.status, instanceId: 'unindexed' },
        };
        await mkdir(join(f.root, orphan.storageId), { mode: 0o700 });
        extraPath = join(f.root, orphan.storageId, 'receipt.json');
        await writeFile(extraPath, JSON.stringify(orphan), { mode: 0o600 });
      } else if (fault === 'temporary file') {
        extraPath = join(f.root, `.${randomUUID()}.tmp`);
        await writeFile(extraPath, 'interrupted atomic write', { mode: 0o600 });
      } else {
        const preserved = join(cache, `preserved-${randomUUID()}`);
        await rename(join(f.root, receipt.storageId), preserved);
        receiptPath = join(preserved, 'receipt.json');
        extraPath = join(f.root, receipt.storageId);
        await writeFile(extraPath, 'unexpected ordinary file', { mode: 0o600 });
      }
      const paths = [
        join(f.root, 'config.json'),
        join(f.root, 'index.json'),
        receiptPath,
        extraPath,
      ];
      const before = await Promise.all(paths.map((path) => readFile(path)));
      const members = (await readdir(f.root)).sort();
      const provider = new IsolatedReportProvider({
        admission: new ProcessAdmission(1),
        privateRoot: f.root,
        programs: [],
        policies: [],
        authorize: async () => {},
      });
      let initialized = false;
      try {
        await expect(
          provider.initialize().then(() => {
            initialized = true;
          }),
        ).rejects.toMatchObject({ code: 'unavailable' });
        expect(await Promise.all(paths.map((path) => readFile(path)))).toEqual(before);
        expect((await readdir(f.root)).sort()).toEqual(members);
      } finally {
        if (initialized) await provider.close();
      }
    });
  }

  test('incomplete root enumeration refuses recovery and preserves the pinned inventory', async () => {
    const f = await store();
    await f.records.create(stage('unconfirmed'), '1', '1');
    const before = await readFile(join(f.root, 'index.json'));
    try {
      // Search still permits config/index reads, but opening a new directory stream is denied.
      await chmod(f.root, 0o100);
      await expect(f.records.load()).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      await chmod(f.root, 0o700);
      await f.records.close();
      await f.lock.close();
    }
    expect(await readFile(join(f.root, 'index.json'))).toEqual(before);
  });

  test('complete inventory permits default provider recovery without rebinding the original identity', async () => {
    const f = await store();
    const receipt = await f.records.create(stage('never-launched'), '1', '1');
    const paths = [join(f.root, 'config.json'), join(f.root, 'index.json')];
    const before = await Promise.all(paths.map((path) => readFile(path)));
    await f.records.close();
    await f.lock.close();
    const admission = new ProcessAdmission(1);
    const provider = new IsolatedReportProvider({
      admission,
      privateRoot: f.root,
      programs: [],
      policies: [],
      authorize: async () => {},
    });
    await provider.initialize();
    try {
      expect(await provider.get({ instanceId: receipt.stage.instanceId })).toMatchObject({
        phase: 'stopped',
        gateReleased: false,
        stopConfirmed: true,
      });
      expect(admission.status.active).toBe(0);
      expect(await Promise.all(paths.map((path) => readFile(path)))).toEqual(before);
      const restored = JSON.parse(
        await readFile(join(f.root, receipt.storageId, 'receipt.json'), 'utf8'),
      );
      expect(restored).toMatchObject({
        configId: receipt.configId,
        storageId: receipt.storageId,
        unit: receipt.unit,
      });
    } finally {
      await provider.close();
    }
  });

  test('long valid IDs hit the shared byte budget before changing the last recoverable real index', async () => {
    const f = await store();
    const original = await f.records.create(stage('template'), '1', '1');
    await f.records.close();
    await f.lock.close();
    const index = [{ instanceId: original.stage.instanceId, storageId: original.storageId }];
    const fixtures: (typeof original)[] = [];
    let candidate = '';
    // Disk fixtures exercise restoration and append, not OS scope/stop authority.
    for (let n = 0; n < 400; n++) {
      const id = '研'.repeat(1020) + String(n).padStart(4, '0');
      expect(validateIsolationStage(stage(id))).toBe(true);
      const entry = { instanceId: id, storageId: randomUUID() };
      if (Buffer.byteLength(JSON.stringify([...index, entry]), 'utf8') > 1048576) {
        candidate = id;
        break;
      }
      index.push(entry);
      fixtures.push({
        ...structuredClone(original),
        storageId: entry.storageId,
        stage: stage(id),
        status: { instanceId: id, phase: 'queued', gateReleased: false, stopConfirmed: false },
      });
    }
    expect(candidate.length).toBe(1024);
    expect(index.length).toBeLessThan(400);
    for (const value of fixtures) {
      await mkdir(join(f.root, value.storageId), { mode: 0o700 });
      await writeFile(join(f.root, value.storageId, 'receipt.json'), JSON.stringify(value), {
        mode: 0o600,
      });
    }
    const bytes = JSON.stringify(index);
    await writeFile(join(f.root, 'index.json'), bytes, { mode: 0o600 });
    const restored = new IsolationRecords(f.root);
    await restored.initialize();
    const lock = await isolationLock(restored.lockPath);
    try {
      expect((await restored.load()).length).toBe(index.length);
      const members = (await readdir(f.root)).sort();
      await expect(restored.create(stage(candidate), '1', '1')).rejects.toMatchObject({
        code: 'resourceLimit',
      });
      expect(await readFile(join(f.root, 'index.json'), 'utf8')).toBe(bytes);
      expect((await readdir(f.root)).sort()).toEqual(members);
      expect((await restored.load()).length).toBe(index.length);
    } finally {
      await restored.close();
      await lock.close();
    }
  });
});
