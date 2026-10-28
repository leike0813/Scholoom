import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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
      await expect(restored.create(stage(candidate), '1', '1')).rejects.toMatchObject({
        code: 'resourceLimit',
      });
      expect(await readFile(join(f.root, 'index.json'), 'utf8')).toBe(bytes);
      expect((await restored.load()).length).toBe(index.length);
    } finally {
      await restored.close();
      await lock.close();
    }
  });
});
