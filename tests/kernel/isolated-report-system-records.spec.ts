import childProcess from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mock } from 'node:test';
import { expect, test } from '@playwright/test';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import {
  type IsolationReceipt,
  IsolationRecords,
  type IsolationRoute,
  type IsolationScope,
} from '../../packages/platform/dist/isolated-report-records.js';
import { IsolatedReportProvider, ProcessAdmission } from '../../packages/platform/dist/node.js';

test.skip(
  process.platform !== 'linux' || process.arch !== 'x64',
  'Real native flock requires Linux x64.',
);
const route = 'linux-system-service-v1';
const legacy = 'linux-user-scope-v1';
const configId = '11111111-2222-4333-8444-555555555555';
const storageId = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const unit = `scholoom-report-${configId}-v1@${storageId}.service`;
const cgroup = `/system.slice/system-scholoomreport${configId.replaceAll('-', '')}${storageId.replaceAll('-', '')}.slice`;
const stage = {
  instanceId: 'fixed-system-record',
  programId: 'fixed',
  policyId: 'fixed',
  entryPath: 'report.txt',
  assets: [{ path: 'report.txt', byteLength: 4 }],
};
type SystemReceipt = Extract<IsolationReceipt, { version: 2 }>;
type ScopedReceipt = SystemReceipt & {
  scope: IsolationScope;
  system: NonNullable<SystemReceipt['system']>;
};

// Independent disk inputs. These scope IDs/stamps are synthetic, never queried as OS authority.
function sample(): ScopedReceipt {
  return {
    version: 2,
    route,
    configId,
    storageId,
    stage: structuredClone(stage),
    status: {
      instanceId: stage.instanceId,
      phase: 'unknown',
      gateReleased: false,
      stopConfirmed: false,
    },
    offsets: [4],
    stamps: ['31:700:4:100:100'],
    sealed: { program: '31:710:120:100:100', gate: '31:711:64:100:100' },
    unit,
    programVersion: 'program-1',
    policyVersion: 'policy-1',
    scopeIntent: true,
    launchIntent: false,
    systemInputs: {
      bootId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      manifest: '31:712:500:100:100',
      permit: { dev: '32', ino: '32001' },
      events: { dev: '32', ino: '32002' },
      stdout: { dev: '32', ino: '32003' },
      stderr: { dev: '32', ino: '32004' },
    },
    scope: {
      bootId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      invocationId: '0123456789abcdef0123456789abcdef',
      cgroup,
      dev: '31',
      ino: '31001',
      controllerPid: 4242,
      controllerBirth: '99001',
    },
    system: {
      runtimeUid: process.getuid?.() === 40001 ? 40002 : 40001,
      runtimeGid: process.getgid?.() === 40001 ? 40002 : 40001,
      permit: { dev: '32', ino: '32001' },
    },
  };
}

function oldSample(): IsolationReceipt {
  return {
    version: 1,
    configId,
    storageId,
    stage: structuredClone(stage),
    status: {
      instanceId: stage.instanceId,
      phase: 'unknown',
      gateReleased: false,
      stopConfirmed: false,
    },
    offsets: [2],
    stamps: [''],
    unit: `scholoom-report-${storageId}.scope`,
    programVersion: 'program-1',
    policyVersion: 'policy-1',
    scopeIntent: false,
    launchIntent: false,
  };
}

async function rootDirectory() {
  return mkdtemp(join(homedir(), '.cache', 'report-system-records-'));
}

async function snapshot(root: string): Promise<Record<string, Buffer | 'directory'>> {
  const result: Record<string, Buffer | 'directory'> = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result[entry.name] = 'directory';
      for (const [name, bytes] of Object.entries(await snapshot(path)))
        result[`${entry.name}/${name}`] = bytes;
    } else result[entry.name] = await readFile(path);
  }
  return result;
}

async function withRecords(
  root: string,
  selected: IsolationRoute,
  work: (records: IsolationRecords) => Promise<void>,
) {
  // Exercise the actual default constructor for v1, and the explicit system route for v2.
  const records =
    selected === legacy ? new IsolationRecords(root) : new IsolationRecords(root, selected);
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

async function inventory(root: string, selected: IsolationRoute, receipt: unknown) {
  const info = await lstat(root, { bigint: true });
  await writeFile(
    join(root, 'config.json'),
    JSON.stringify({
      version: selected === route ? 2 : 1,
      ...(selected === route ? { route } : {}),
      configId,
      identity: `${info.dev}:${info.ino}`,
    }),
    { mode: 0o600 },
  );
  await writeFile(
    join(root, 'index.json'),
    JSON.stringify([{ instanceId: stage.instanceId, storageId }]),
    { mode: 0o600 },
  );
  await mkdir(join(root, storageId), { mode: 0o700 });
  await writeFile(join(root, storageId, 'receipt.json'), JSON.stringify(receipt), { mode: 0o600 });
}

test.describe('explicit system record roots and route separation', () => {
  test('provisions v2 explicitly, creates a bound unit, and reopens the exact original root', async () => {
    const root = await rootDirectory();
    const info = await lstat(root, { bigint: true });
    let expected: SystemReceipt | undefined;
    let before: Awaited<ReturnType<typeof snapshot>> = {};
    await withRecords(root, route, async (records) => {
      const empty = await snapshot(root);
      await expect(records.loadExisting(configId)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await snapshot(root)).toEqual(empty);
      const provisioned = await records.provisionEmpty();
      expect(provisioned.configId).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
      );
      expect(provisioned.receipts).toEqual([]);
      expect(JSON.parse(await readFile(join(root, 'config.json'), 'utf8'))).toEqual({
        version: 2,
        route,
        configId: provisioned.configId,
        identity: `${info.dev}:${info.ino}`,
      });
      const created = await records.create(stage, 'program-1', 'policy-1');
      expect(created.storageId).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
      );
      expected = {
        version: 2,
        route,
        configId: provisioned.configId,
        storageId: created.storageId,
        stage: structuredClone(stage),
        status: {
          instanceId: stage.instanceId,
          phase: 'queued',
          gateReleased: false,
          stopConfirmed: false,
        },
        offsets: [0],
        stamps: [''],
        unit: `scholoom-report-${provisioned.configId}-v1@${created.storageId}.service`,
        programVersion: 'program-1',
        policyVersion: 'policy-1',
        scopeIntent: false,
        launchIntent: false,
      };
      expect(created).toEqual(expected);
      expect(
        JSON.parse(await readFile(join(root, created.storageId, 'receipt.json'), 'utf8')),
      ).toEqual(expected);
      before = await snapshot(root);
      await expect(records.provisionEmpty()).rejects.toMatchObject({ code: 'unavailable' });
      expect(await snapshot(root)).toEqual(before);
    });
    const original = expected;
    if (!original) throw new Error('Missing original system configuration.');
    await withRecords(root, route, async (records) => {
      expect(await records.loadExisting(original.configId)).toEqual({
        configId: original.configId,
        receipts: [original],
      });
      expect(await snapshot(root)).toEqual(before);
    });
  });

  for (const selected of [legacy, route] as const) {
    test(`${selected} restores a handwritten inventory and the other route refuses it without rewriting`, async () => {
      const root = await rootDirectory();
      const receipt = selected === route ? sample() : oldSample();
      await inventory(root, selected, receipt);
      await withRecords(root, selected, async (records) => {
        const before = await snapshot(root);
        expect(await records.loadExisting(configId)).toEqual({ configId, receipts: [receipt] });
        expect(await snapshot(root)).toEqual(before);
      });
      await withRecords(root, selected === route ? legacy : route, async (records) => {
        const before = await snapshot(root);
        await expect(records.loadExisting(configId)).rejects.toMatchObject({ code: 'unavailable' });
        await expect(records.provisionEmpty()).rejects.toMatchObject({ code: 'unavailable' });
        expect(await snapshot(root)).toEqual(before);
      });
    });

    test(`${selected} rejects an opposite-route save and preserves the original scoped receipt`, async () => {
      const root = await rootDirectory();
      const systemReceipt = sample();
      const userReceipt: IsolationReceipt = {
        ...oldSample(),
        scopeIntent: true,
        offsets: [...systemReceipt.offsets],
        stamps: [...systemReceipt.stamps],
        sealed: { program: '31:710:120:100:100', gate: '31:711:64:100:100' },
        scope: {
          ...systemReceipt.scope,
          cgroup: `/user.slice/scholoom-report-${storageId}.scope`,
        },
      };
      const original = selected === route ? systemReceipt : userReceipt;
      const opposite = selected === route ? userReceipt : systemReceipt;
      await inventory(root, selected, original);
      let before: Awaited<ReturnType<typeof snapshot>> = {};
      await withRecords(root, selected, async (records) => {
        expect(await records.loadExisting(configId)).toEqual({ configId, receipts: [original] });
        before = await snapshot(root);
        // Only the route/scope family changes; the config, storage and instance identities match.
        await expect(records.save(opposite)).rejects.toMatchObject({ code: 'unavailable' });
        expect(await snapshot(root)).toEqual(before);
        expect(await records.loadExisting(configId)).toEqual({ configId, receipts: [original] });
        expect(await snapshot(root)).toEqual(before);
      });
      await withRecords(root, selected, async (records) => {
        expect(await records.loadExisting(configId)).toEqual({ configId, receipts: [original] });
        expect(await snapshot(root)).toEqual(before);
      });
    });

    test(`${selected} refuses an opposite-version receipt inside its own original config`, async () => {
      const root = await rootDirectory();
      await inventory(root, selected, selected === route ? oldSample() : sample());
      await withRecords(root, selected, async (records) => {
        const before = await snapshot(root);
        await expect(records.loadExisting(configId)).rejects.toMatchObject({ code: 'unavailable' });
        expect(await snapshot(root)).toEqual(before);
      });
    });
  }
});

const faults: [string, (receipt: ScopedReceipt) => unknown][] = [
  [
    'unit bound to another storage',
    (r) => ({ ...r, unit: `scholoom-report-${configId}-v1@${configId}.service` }),
  ],
  [
    'service cgroup without retained parent',
    (r) => ({ ...r, scope: { ...r.scope, cgroup: `/system.slice/${unit}` } }),
  ],
  [
    'parent bound to another storage',
    (r) => ({
      ...r,
      scope: {
        ...r.scope,
        cgroup: cgroup.replace(storageId.replaceAll('-', ''), configId.replaceAll('-', '')),
      },
    }),
  ],
  [
    'unexpected nested cgroup',
    (r) => ({ ...r, scope: { ...r.scope, cgroup: `/system.slice/extra/${unit}` } }),
  ],
  ['missing system for a scope', ({ system: _system, ...r }) => r],
  ['system without scope', ({ scope: _scope, ...r }) => r],
  ['scope without scopeIntent', (r) => ({ ...r, scopeIntent: false })],
  [
    'launchIntent without scope',
    ({ scope: _scope, system: _system, ...r }) => ({ ...r, launchIntent: true }),
  ],
  [
    'gateReleased without launchIntent',
    (r) => ({ ...r, status: { ...r.status, gateReleased: true } }),
  ],
  [
    'missing permit',
    (r) => ({ ...r, system: { runtimeUid: r.system.runtimeUid, runtimeGid: r.system.runtimeGid } }),
  ],
  [
    'invalid permit dev',
    (r) => ({ ...r, system: { ...r.system, permit: { ...r.system.permit, dev: '-1' } } }),
  ],
  [
    'invalid permit ino',
    (r) => ({ ...r, system: { ...r.system, permit: { ...r.system.permit, ino: 'not-an-inode' } } }),
  ],
  ['missing sealed precondition', ({ sealed: _sealed, ...r }) => r],
  ['missing stamp precondition', (r) => ({ ...r, stamps: [''] })],
  [
    'invalid common controller identity',
    (r) => ({ ...r, scope: { ...r.scope, controllerPid: 1 } }),
  ],
];
for (const field of ['runtimeUid', 'runtimeGid'] as const) {
  const current = field === 'runtimeUid' ? process.getuid?.() : process.getgid?.();
  for (const [label, value] of [
    ['root', 0],
    ['current C account', current],
    ['fraction', 1.5],
    ['uint32 sentinel', 0xffffffff],
  ] as const)
    faults.push([
      `${field} is ${label}`,
      (r) => ({ ...r, system: { ...r.system, [field]: value } }),
    ]);
}

test.describe('system receipt bindings preserve the original disk inventory on refusal', () => {
  for (const [name, corrupt] of faults) {
    test(name, async () => {
      const root = await rootDirectory();
      await inventory(root, route, corrupt(sample()));
      await withRecords(root, route, async (records) => {
        const before = await snapshot(root);
        await expect(records.loadExisting(configId)).rejects.toMatchObject({ code: 'unavailable' });
        expect(await snapshot(root)).toEqual(before);
      });
    });
  }
});

test('system profile and route refuse the default user OS before creating a private root', async () => {
  const parent = await rootDirectory();
  const privateRoot = join(parent, 'uncreated-provider');
  const image = await readFile(
    new URL('../../packages/platform/dist/isolated-report-gate', import.meta.url),
  );
  const provider = new IsolatedReportProvider({
    admission: new ProcessAdmission(1),
    privateRoot,
    configId,
    route,
    programs: [{ id: 'fixed', version: '1', policyId: 'fixed', image, args: [] }],
    policies: [
      {
        id: 'fixed',
        version: '1',
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
  });
  try {
    expect(await provider.check({ programId: 'fixed', policyId: 'fixed' })).toMatchObject({
      available: false,
      reason: { code: 'unavailable' },
    });
    await expect(lstat(privateRoot)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(provider.initialize()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(lstat(privateRoot)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(parent)).toEqual([]);
  } finally {
    await provider.close();
  }
});

test('confirmed-stop housekeeping does not block readiness and close retains the writer until it settles', async () => {
  const root = await rootDirectory();
  const receipt = sample();
  receipt.status = { ...receipt.status, phase: 'stopped', stopConfirmed: true };
  await inventory(root, route, receipt);
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const admission = new ProcessAdmission(1);
  const provider = new IsolatedReportProvider(
    {
      admission,
      privateRoot: root,
      configId,
      route,
      programs: [],
      policies: [],
      authorize: async () => {
        throw new Error('No execution allowed');
      },
    },
    {
      route,
      support: async () => {},
      lock: isolationLock,
      controller: () => {
        throw new Error('No execution allowed');
      },
      stopRecovered: async () => {
        throw new Error('Already durably stopped');
      },
      releaseStopped: async () => {
        enter();
        await released;
      },
    },
  );
  let ready = false;
  const opening = provider.initialize().then(() => {
    ready = true;
  });
  let closing: Promise<void> | undefined;
  try {
    await entered;
    await expect.poll(() => ready).toBe(true);
    expect(provider.inventory()).toEqual([receipt.status]);
    expect(admission.status.active).toBe(0);
    closing = provider.close();
    await expect(isolationLock(join(root, 'writer.lock'))).rejects.toBeDefined();
  } finally {
    release();
    await opening;
    await (closing ?? provider.close());
  }
  const reopened = await isolationLock(join(root, 'writer.lock'));
  await reopened.close();
});

test('the legacy scope inspector refuses v2 before consulting the user manager', async () => {
  const guard = mock.method(childProcess, 'execFile', () => {
    throw new Error('Unexpected user manager command.');
  });
  syncBuiltinESMExports();
  try {
    // A fresh module captures the guarded execFile in its promisified command adapter.
    const { inspectIsolationScope } = (await import(
      new URL(
        '../../packages/platform/dist/isolated-report-controller.js?system-records-inspection',
        import.meta.url,
      ).href
    )) as typeof import('../../packages/platform/dist/isolated-report-controller.js');
    const { scope: _scope, system: _system, ...withoutScope } = sample();
    for (const receipt of [sample(), withoutScope])
      await expect(inspectIsolationScope(receipt)).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
    expect(guard.mock.callCount()).toBe(0);
  } finally {
    guard.mock.restore();
    syncBuiltinESMExports();
  }
});
