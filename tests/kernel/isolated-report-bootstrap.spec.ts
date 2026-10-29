import { randomUUID } from 'node:crypto';
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import {
  type IsolationReceipt,
  IsolationRecords,
} from '../../packages/platform/dist/isolated-report-records.js';

const cache =
  process.env.SCHOOLOOM_ISOLATION_TEST_CACHE ??
  join(homedir(), '.cache', 'scholoom-isolation-tests');

async function rootDirectory() {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  return mkdtemp(join(cache, 'bootstrap-'));
}

async function withRecords(root: string, work: (records: IsolationRecords) => Promise<void>) {
  const records = new IsolationRecords(root);
  let lock: Awaited<ReturnType<typeof isolationLock>> | undefined;
  try {
    await records.initializeExisting();
    lock = await isolationLock(records.lockPath);
    expect(lock.alive()).toBe(true);
    await work(records);
  } finally {
    try {
      await records.close();
    } finally {
      await lock?.close();
      expect(lock?.alive() ?? false).toBe(false);
    }
  }
}

async function snapshot(root: string): Promise<Record<string, Buffer | 'directory'>> {
  const files: Record<string, Buffer | 'directory'> = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files[entry.name] = 'directory';
      for (const [name, bytes] of Object.entries(await snapshot(path)))
        files[`${entry.name}/${name}`] = bytes;
    } else files[entry.name] = await readFile(path);
  }
  return files;
}

// Independent v1 disk sample, including a receipt whose stop remains unconfirmed.
async function inventory(root: string) {
  const configId = randomUUID();
  const storageId = randomUUID();
  const info = await lstat(root, { bigint: true });
  const receipt: IsolationReceipt = {
    version: 1,
    configId,
    storageId,
    stage: {
      instanceId: 'pending-native-report',
      programId: 'fixed',
      policyId: 'native',
      entryPath: 'report.txt',
      assets: [{ path: 'report.txt', byteLength: 4 }],
    },
    status: {
      instanceId: 'pending-native-report',
      phase: 'unknown',
      gateReleased: false,
      stopConfirmed: false,
    },
    offsets: [2],
    stamps: [''],
    unit: `scholoom-report-${randomUUID()}.scope`,
    programVersion: '1',
    policyVersion: '1',
    launchIntent: false,
    scopeIntent: false,
  };
  await writeFile(
    join(root, 'config.json'),
    JSON.stringify({ version: 1, configId, identity: `${info.dev}:${info.ino}` }),
    { mode: 0o600 },
  );
  await writeFile(
    join(root, 'index.json'),
    JSON.stringify([{ instanceId: receipt.stage.instanceId, storageId }]),
    { mode: 0o600 },
  );
  await mkdir(join(root, storageId), { mode: 0o700 });
  await writeFile(join(root, storageId, 'receipt.json'), JSON.stringify(receipt), { mode: 0o600 });
  return { configId, receipt };
}

test.describe('explicit private record bootstrap', () => {
  test.skip(process.platform !== 'linux' || process.arch !== 'x64', 'Linux native flock only.');

  test('provisions an empty private root and reopens its exact on-disk configuration', async () => {
    const root = await rootDirectory();
    const info = await lstat(root, { bigint: true });
    let configId = '';
    await withRecords(root, async (records) => {
      const result = await records.provisionEmpty();
      const config = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
      expect(config).toEqual({
        version: 1,
        configId: expect.stringMatching(
          /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
        ),
        identity: `${info.dev}:${info.ino}`,
      });
      expect(JSON.parse(await readFile(join(root, 'index.json'), 'utf8'))).toEqual([]);
      for (const name of ['config.json', 'index.json']) {
        const file = await lstat(join(root, name));
        expect(file.uid).toBe(process.getuid?.());
        expect(file.mode & 0o777).toBe(0o600);
        expect(file.nlink).toBe(1);
      }
      configId = config.configId;
      expect(result).toEqual({ configId, receipts: [] });
    });
    const before = await snapshot(root);
    await withRecords(root, async (records) => {
      expect(await records.loadExisting(configId)).toEqual({ configId, receipts: [] });
    });
    expect(await snapshot(root)).toEqual(before);
  });

  test('loads the original complete v1 inventory without reconciling or rewriting it', async () => {
    const root = await rootDirectory();
    const sample = await inventory(root);
    await withRecords(root, async (records) => {
      const before = await snapshot(root);
      expect(await records.loadExisting(sample.configId)).toEqual({
        configId: sample.configId,
        receipts: [sample.receipt],
      });
      expect(await snapshot(root)).toEqual(before);
    });
  });

  test('opening a missing root does not create its missing parent', async () => {
    const parent = join(await rootDirectory(), 'missing-parent');
    const records = new IsolationRecords(join(parent, 'records'));
    try {
      await expect(records.initializeExisting()).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(lstat(parent)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await records.close();
    }
  });

  for (const fault of [
    'wrong expected identity',
    'provision existing config',
    'missing config',
    'copied root',
    'unindexed file',
  ] as const) {
    test(`refuses ${fault} and preserves every original disk byte`, async () => {
      let root = await rootDirectory();
      const sample = await inventory(root);
      const originalRoot = root;
      const original = await snapshot(root);
      if (fault === 'missing config')
        await rename(join(root, 'config.json'), join(root, 'config-preserved.json'));
      if (fault === 'copied root') {
        root = `${root}-copy`;
        await cp(originalRoot, root, { recursive: true });
      }
      if (fault === 'unindexed file')
        await writeFile(join(root, 'unresolved.tmp'), 'preserve interrupted work', { mode: 0o600 });
      await withRecords(root, async (records) => {
        const before = await snapshot(root);
        if (fault === 'provision existing config')
          await expect(records.provisionEmpty()).rejects.toMatchObject({ code: 'unavailable' });
        else
          await expect(
            records.loadExisting(
              fault === 'wrong expected identity' ? randomUUID() : sample.configId,
            ),
          ).rejects.toMatchObject({ code: fault === 'missing config' ? 'ENOENT' : 'unavailable' });
        expect(await snapshot(root)).toEqual(before);
      });
      if (fault === 'copied root') expect(await snapshot(originalRoot)).toEqual(original);
    });
  }

  test('a known-config open on an empty root never provisions implicitly', async () => {
    const root = await rootDirectory();
    await withRecords(root, async (records) => {
      const before = await snapshot(root);
      await expect(records.loadExisting(randomUUID())).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await snapshot(root)).toEqual(before);
    });
  });

  test('refuses a nonempty unconfigured root before provisioning', async () => {
    const root = await rootDirectory();
    await writeFile(join(root, 'recovery.bin'), 'unresolved result', { mode: 0o600 });
    await withRecords(root, async (records) => {
      const before = await snapshot(root);
      await expect(records.provisionEmpty()).rejects.toMatchObject({ code: 'unavailable' });
      expect(await snapshot(root)).toEqual(before);
    });
  });

  for (const fault of ['root replaced', 'private mode lost'] as const) {
    test(`rechecks the pinned root before loading when ${fault}`, async () => {
      const root = await rootDirectory();
      const sample = await inventory(root);
      await withRecords(root, async (records) => {
        let preserved = root;
        if (fault === 'root replaced') {
          preserved = `${root}-preserved`;
          await rename(root, preserved);
          await mkdir(root, { mode: 0o700 });
        } else await chmod(root, 0o750);
        const before = await snapshot(preserved);
        await expect(records.loadExisting(sample.configId)).rejects.toMatchObject({
          code: 'unavailable',
        });
        expect(await snapshot(preserved)).toEqual(before);
        if (fault === 'root replaced') expect(await readdir(root)).toEqual([]);
      });
    });
  }
});
