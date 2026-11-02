import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ProcessAdmission } from '../../packages/platform/dist/admission.js';
import {
  IsolationAssets,
  isolationGate,
  isolationNative,
} from '../../packages/platform/dist/isolated-report-assets.js';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import {
  type IsolationReceipt,
  IsolationRecords,
} from '../../packages/platform/dist/isolated-report-records.js';
import { IsolatedReportProvider } from '../../packages/platform/dist/isolated-reports.js';
import { compileContract } from '../../packages/protocol/dist/core.js';
import {
  type SystemReportManifest,
  systemReportInputsSchema,
  systemReportManifestSchema,
} from '../../packages/protocol/dist/platform-isolation.js';

const route = 'linux-system-service-v1';
const cache = join(homedir(), '.cache', 'scholoom-report-system-inputs');
const payloads = [Buffer.from('封存入口\n'), Buffer.from('{"values":[2,7]}\n')];
const args = ['--entry', 'reports/入口.txt', 'space and "quotes"'];
const systemFiles = ['permit', 'events', 'stdout', 'stderr'] as const;
const validManifest = compileContract({
  params: systemReportManifestSchema,
  result: systemReportManifestSchema,
}).params;
const validInputs = compileContract({
  params: systemReportInputsSchema,
  result: systemReportInputsSchema,
}).params;

test.skip(
  process.platform !== 'linux' || process.arch !== 'x64' || process.geteuid?.() === 0,
  'Real Linux x64 native FIFO and flock under an ordinary UID.',
);

async function stamp(path: string) {
  const s = await lstat(path, { bigint: true });
  return [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
}

async function store() {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(cache, 'case-'));
  let records = new IsolationRecords(root, route);
  let lock: Awaited<ReturnType<typeof isolationLock>> | undefined;
  try {
    await records.initializeExisting();
    lock = await isolationLock(records.lockPath);
    expect(lock.alive()).toBe(true);
    const { configId, receipts } = await records.provisionEmpty();
    expect(receipts).toEqual([]);
    return {
      root,
      configId,
      get records() {
        return records;
      },
      async reopen(expected: IsolationReceipt) {
        expect(lock?.alive()).toBe(true);
        await records.close();
        records = new IsolationRecords(root, route);
        await records.initializeExisting();
        expect(await records.loadExisting(configId)).toEqual({ configId, receipts: [expected] });
        expect(lock?.alive()).toBe(true);
      },
      async close() {
        try {
          await records.close();
        } finally {
          await lock?.close();
        }
      },
    };
  } catch (error) {
    try {
      await records.close();
    } finally {
      await lock?.close();
    }
    throw error;
  }
}

async function fixture(sealed = true) {
  const s = await store();
  try {
    const receipt = await s.records.create(
      {
        instanceId: randomUUID(),
        programId: 'fixed',
        policyId: 'fixed',
        entryPath: 'reports/入口.txt',
        assets: payloads.map((bytes, i) => ({
          path: i === 0 ? 'reports/入口.txt' : 'reports/assets/data.json',
          byteLength: bytes.length,
        })),
      },
      'program-3',
      'policy-2',
    );
    const assets = new IsolationAssets(s.records);
    await assets.prepare(receipt);
    for (const [i, bytes] of payloads.entries())
      await assets.put(receipt, i, 0, bytes, () => s.records.save(receipt));
    if (sealed) await assets.seal(receipt, Buffer.from('approved image; never executed'));
    await s.records.save(receipt);
    return { ...s, receipt, assets, directory: s.records.nativePath(receipt) };
  } catch (error) {
    await s.close();
    throw error;
  }
}

async function stored(directory: string): Promise<IsolationReceipt> {
  return JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8'));
}

async function verifyInputs(receipt: IsolationReceipt, directory: string) {
  if (receipt.version !== 2 || !receipt.systemInputs) throw new Error('Missing system inputs.');
  const manifestPath = join(directory, 'manifest.json');
  const manifest: SystemReportManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  expect(validManifest(manifest)).toBe(true);
  expect(validInputs(receipt.systemInputs)).toBe(true);
  expect(receipt.systemInputs.bootId).toBe(
    (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim(),
  );
  expect(manifest).toMatchObject({
    version: 1,
    configId: receipt.configId,
    storageId: receipt.storageId,
    ownerUid: process.getuid?.(),
    programVersion: receipt.programVersion,
    policyVersion: receipt.policyVersion,
  });
  expect(manifest.stage).toEqual(receipt.stage);
  expect(manifest.args).toEqual(args);
  expect(manifest.stamps).toEqual(receipt.stamps);
  expect(manifest.sealed).toEqual(receipt.sealed);
  const info = await lstat(manifestPath);
  expect(info.isFile()).toBe(true);
  expect(info.uid).toBe(process.getuid?.());
  expect(info.nlink).toBe(1);
  expect(info.mode & 0o777).toBe(0o400);
  expect(receipt.systemInputs.manifest).toBe(await stamp(manifestPath));
  for (const name of systemFiles) {
    const path = join(directory, name);
    const s = await lstat(path, { bigint: true });
    expect(name === 'permit' ? s.isFIFO() : s.isFile()).toBe(true);
    expect(s.uid).toBe(BigInt(process.getuid?.() ?? -1));
    expect(s.nlink).toBe(1n);
    expect(s.mode & 0o777n).toBe(0o600n);
    const identity = { dev: String(s.dev), ino: String(s.ino) };
    expect(manifest.files[name]).toEqual(identity);
    expect(receipt.systemInputs[name]).toEqual(identity);
    if (name !== 'permit') expect(await readFile(path)).toEqual(Buffer.alloc(0));
  }
  for (const [i, expected] of receipt.stamps.entries()) {
    expect(expected).toBe(await stamp(join(directory, `asset-${i}.bin`)));
    expect(await readFile(join(directory, `asset-${i}.bin`))).toEqual(payloads[i]);
  }
  expect(manifest.sealed).toEqual({
    program: await stamp(join(directory, 'program.bin')),
    gate: await stamp(join(directory, 'gate.bin')),
  });
  for (const name of [
    'program.bin',
    'gate.bin',
    ...receipt.stamps.map((_, i) => `asset-${i}.bin`),
  ]) {
    const s = await lstat(join(directory, name));
    expect(s.isFile()).toBe(true);
    expect(s.uid).toBe(process.getuid?.());
    expect(s.nlink).toBe(1);
    expect(s.mode & 0o777).toBe(0o400);
  }
}

test('creates real private FIFO, logs and sealed manifest, then reopens the persisted v2 inputs', async () => {
  const f = await fixture();
  try {
    const before = structuredClone(f.receipt);
    await f.assets.systemInputs(f.receipt, args);
    await verifyInputs(f.receipt, f.directory);
    expect(await stored(f.directory)).toEqual(before);
    if (f.receipt.version !== 2) throw new Error('Expected system receipt.');
    expect(f.receipt).toEqual({ ...before, systemInputs: f.receipt.systemInputs });
    await f.records.save(f.receipt);
    await f.reopen(f.receipt);
  } finally {
    await f.close();
  }
});

for (const name of ['program.bin', 'gate.bin', 'asset-0.bin'] as const) {
  for (const change of ['same-content replacement', 'unsealed mode'] as const) {
    test(`refuses ${name} with ${change} before creating any system inputs`, async () => {
      const f = await fixture();
      try {
        const path = join(f.directory, name);
        if (change === 'same-content replacement') {
          const original = await lstat(path, { bigint: true });
          const bytes = await readFile(path);
          await rename(path, join(f.directory, `preserved-${name}`));
          await writeFile(path, bytes, { mode: 0o400 });
          expect((await lstat(path, { bigint: true })).ino).not.toBe(original.ino);
          expect(await readFile(path)).toEqual(bytes);
        } else await chmod(path, 0o600);
        const before = structuredClone(f.receipt);
        const entries = await readdir(f.directory);
        await expect(f.assets.systemInputs(f.receipt, args)).rejects.toMatchObject({
          code: 'contentChanged',
        });
        expect(await readdir(f.directory)).toEqual(entries);
        expect(f.receipt).toEqual(before);
        expect(await stored(f.directory)).toEqual(before);
        await f.reopen(before);
      } finally {
        await f.close();
      }
    });
  }
}

for (const condition of ['not sealed', 'scope intent', 'legacy route'] as const) {
  test(`refuses ${condition} before creating any system inputs`, async () => {
    const f = await fixture(condition !== 'not sealed');
    try {
      const disk = structuredClone(f.receipt);
      const entries = await readdir(f.directory);
      if (f.receipt.version !== 2) throw new Error('Expected system receipt.');
      const {
        route: _route,
        systemInputs: _inputs,
        system: _system,
        version: _version,
        ...body
      } = f.receipt;
      const input: IsolationReceipt =
        condition === 'legacy route'
          ? { ...body, version: 1 }
          : { ...f.receipt, scopeIntent: condition === 'scope intent' };
      const before = structuredClone(input);
      await expect(f.assets.systemInputs(input, args)).rejects.toMatchObject({
        code: 'unavailable',
      });
      expect(input).toEqual(before);
      expect(await readdir(f.directory)).toEqual(entries);
      expect(await stored(f.directory)).toEqual(disk);
      await f.reopen(disk);
    } finally {
      await f.close();
    }
  });
}

for (const name of [...systemFiles, 'manifest.json'] as const) {
  test(`preserves an existing ${name}, reports the failure and retains the original receipt`, async () => {
    const f = await fixture();
    try {
      const path = join(f.directory, name);
      const bytes = Buffer.from(`existing ${name} must survive`);
      if (name === 'permit') {
        const directory = await open(f.directory, constants.O_RDONLY | constants.O_DIRECTORY);
        try {
          const result = spawnSync(isolationNative, ['--fifo'], {
            stdio: ['ignore', 'pipe', 'pipe', directory.fd],
            timeout: 5000,
          });
          expect(result.error).toBeUndefined();
          expect(result.status).toBe(0);
          expect(result.signal).toBeNull();
        } finally {
          await directory.close();
        }
        expect((await lstat(path)).isFIFO()).toBe(true);
      } else await writeFile(path, bytes, { mode: name === 'manifest.json' ? 0o400 : 0o600 });
      const original = await stamp(path);
      const before = structuredClone(f.receipt);
      await expect(f.assets.systemInputs(f.receipt, args)).rejects.toMatchObject({
        code: name === 'permit' ? 'outcomeUnknown' : 'EEXIST',
      });
      expect(await stamp(path)).toBe(original);
      if (name !== 'permit') expect(await readFile(path)).toEqual(bytes);
      expect(f.receipt).toEqual(before);
      expect(await stored(f.directory)).toEqual(before);
      if (name !== 'manifest.json')
        await expect(lstat(join(f.directory, 'manifest.json'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      await f.reopen(before);
    } finally {
      await f.close();
    }
  });
}

test('propagates a real native creation failure without claiming complete inputs', async () => {
  const f = await fixture();
  try {
    const before = structuredClone(f.receipt);
    const entries = await readdir(f.directory);
    await chmod(f.directory, 0o500);
    await expect(f.assets.systemInputs(f.receipt, args)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    expect(f.receipt).toEqual(before);
    expect(await readdir(f.directory)).toEqual(entries);
    expect(await stored(f.directory)).toEqual(before);
    await chmod(f.directory, 0o700);
    await f.reopen(before);
  } finally {
    await chmod(f.directory, 0o700);
    await f.close();
  }
});

for (const conflict of [false, true]) {
  test(`provider consumes real sealed inputs before its OS controller (${conflict ? 'log conflict' : 'success'})`, async () => {
    const s = await store();
    await s.close();
    let controllers = 0;
    const provider = new IsolatedReportProvider(
      {
        privateRoot: s.root,
        configId: s.configId,
        route,
        admission: new ProcessAdmission(1),
        programs: [
          {
            id: 'fixed',
            version: '3',
            policyId: 'fixed',
            image: await readFile(isolationGate),
            args,
          },
        ],
        policies: [
          {
            id: 'fixed',
            version: '2',
            profile: 'linux-x64-system-v1',
            cpuPercent: 20,
            memoryBytes: 67108864,
            swapBytes: 0,
            tasks: 16,
            outputBytes: 1048576,
            runtimeMs: 30000,
            stopGraceMs: 200,
          },
        ],
        authorize: async () => {},
      },
      {
        route,
        support: async () => {},
        lock: isolationLock,
        // OS support/controller are substitutes; this is not a system-manager acceptance test.
        controller: (o) => {
          controllers++;
          return {
            hasExited: false,
            async start() {
              const disk = await stored(o.path);
              expect(disk.status.phase).toBe('starting');
              expect(disk).toEqual(o.receipt);
              expect(o.args).toEqual(args);
              await verifyInputs(disk, o.path);
              await o.running();
            },
            async stop() {
              await o.stopped(false);
              return true;
            },
          };
        },
        stopRecovered: async () => {
          throw new Error('Unexpected OS recovery.');
        },
      },
    );
    try {
      await provider.initialize();
      const stage = {
        instanceId: randomUUID(),
        programId: 'fixed',
        policyId: 'fixed',
        entryPath: 'reports/入口.txt',
        assets: payloads.map((bytes, i) => ({
          path: i === 0 ? 'reports/入口.txt' : 'reports/assets/data.json',
          byteLength: bytes.length,
        })),
      };
      await provider.stage(stage);
      await expect.poll(async () => (await provider.get(stage)).phase).toBe('preparing');
      for (const [i, bytes] of payloads.entries())
        await provider.put({
          instanceId: stage.instanceId,
          path: stage.assets[i]?.path ?? '',
          offset: 0,
          base64: bytes.toString('base64'),
        });
      const index: { storageId: string }[] = JSON.parse(
        await readFile(join(s.root, 'index.json'), 'utf8'),
      );
      expect(index).toHaveLength(1);
      const directory = join(s.root, index[0]?.storageId ?? 'missing');
      if (conflict) {
        const path = join(directory, 'stderr');
        await writeFile(path, 'existing output', { mode: 0o600 });
        const original = await stamp(path);
        await expect(provider.start(stage)).rejects.toMatchObject({ code: 'EEXIST' });
        expect(controllers).toBe(0);
        expect(await readFile(path, 'utf8')).toBe('existing output');
        expect(await stamp(path)).toBe(original);
        const disk = await stored(directory);
        expect(disk).toMatchObject({
          scopeIntent: false,
          launchIntent: false,
          status: { phase: 'stopped', stopConfirmed: true },
        });
        expect(disk.version === 2 && disk.systemInputs).toBeUndefined();
        await expect(lstat(join(directory, 'manifest.json'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
      } else {
        expect(await provider.start(stage)).toMatchObject({ phase: 'running' });
        expect(controllers).toBe(1);
      }
      await provider.close();
      const disk = await stored(directory);
      const reopened = new IsolationRecords(s.root, route);
      let lock: Awaited<ReturnType<typeof isolationLock>> | undefined;
      try {
        await reopened.initializeExisting();
        lock = await isolationLock(reopened.lockPath);
        expect(await reopened.loadExisting(s.configId)).toEqual({
          configId: s.configId,
          receipts: [disk],
        });
      } finally {
        try {
          await reopened.close();
        } finally {
          await lock?.close();
        }
      }
    } finally {
      await provider.close();
    }
  });
}
