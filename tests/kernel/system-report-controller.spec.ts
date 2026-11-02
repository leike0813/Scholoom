import { randomUUID } from 'node:crypto';
import { appendFile, lstat, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { test as base, expect } from '@playwright/test';
import { IsolationAssets } from '../../packages/platform/dist/isolated-report-assets.js';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import {
  type IsolationReceipt,
  IsolationRecords,
} from '../../packages/platform/dist/isolated-report-records.js';
import type { IsolationNative } from '../../packages/platform/dist/isolated-reports.js';
import {
  type SystemReportRequest,
  systemReportAdapter,
} from '../../packages/platform/dist/system-report-controller.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import {
  type ReportManagerObservation,
  reportManagerScope,
} from '../../packages/protocol/dist/platform-isolation.js';

const route = 'linux-system-service-v1';
const cache = join(homedir(), '.cache', 'scholoom-report-system-inputs');
type Method = Parameters<SystemReportRequest>[0];
type Options = Parameters<IsolationNative['controller']>[0];

function barrier() {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((done) => {
    enter = done;
  });
  const released = new Promise<void>((done) => {
    release = done;
  });
  return {
    entered,
    release,
    async wait() {
      enter();
      await released;
    },
  };
}

async function fixture() {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(cache, 'controller-'));
  const records = new IsolationRecords(root, route);
  let lock: Awaited<ReturnType<typeof isolationLock>> | undefined;
  try {
    // Same real C-owned preparation path as system-report-inputs.spec.ts.
    await records.initializeExisting();
    lock = await isolationLock(records.lockPath);
    const { configId } = await records.provisionEmpty();
    const bytes = Buffer.from('sealed controller test input\n');
    const receipt = await records.create(
      {
        instanceId: randomUUID(),
        programId: 'fixed',
        policyId: 'fixed',
        entryPath: 'reports/entry.txt',
        assets: [{ path: 'reports/entry.txt', byteLength: bytes.length }],
      },
      'program-3',
      'policy-2',
    );
    const assets = new IsolationAssets(records);
    await assets.prepare(receipt);
    await assets.put(receipt, 0, 0, bytes, () => records.save(receipt));
    await assets.seal(receipt, Buffer.from('approved image; never executed'));
    await assets.systemInputs(receipt, []);
    receipt.status.phase = 'starting';
    await records.save(receipt);
    if (receipt.version !== 2 || !receipt.systemInputs) throw new Error('Missing real C inputs.');
    const directory = records.nativePath(receipt);
    const events = join(directory, 'events');
    const disk = async (): Promise<IsolationReceipt> =>
      JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8'));
    // M/OS observations and native event production are substitutes, never root evidence.
    const observation: ReportManagerObservation = {
      scope: {
        bootId: receipt.systemInputs.bootId,
        invocationId: '0123456789abcdef0123456789abcdef',
        dev: '31',
        ino: '31001',
        controllerPid: 4242,
        controllerBirth: '99001',
      },
      runtimeUid: 40001,
      runtimeGid: 40002,
      limits: {
        cpuQuota: '20000',
        cpuPeriod: '100000',
        memoryBytes: '67108864',
        swapBytes: '0',
        tasks: '16',
      },
    };
    const calls: { method: Method; input: unknown }[] = [];
    const hooks = new Map<Method, (input: unknown) => Promise<void>>();
    const request: SystemReportRequest = async (method, input) => {
      calls.push({ method, input: structuredClone(input) });
      await hooks.get(method)?.(input);
      switch (method) {
        case 'reportManager.start':
        case 'reportManager.capture':
          return structuredClone(observation);
        case 'reportManager.arm':
          return { armed: true };
        case 'reportManager.permit':
          return { released: true };
        case 'reportManager.stop':
        case 'reportManager.recover':
          return { scopeEmpty: true };
        default:
          return {};
      }
    };
    const native = systemReportAdapter(configId, request);
    const running: IsolationReceipt[] = [];
    const stopped: boolean[] = [];
    const errors: unknown[] = [];
    const holds: ReturnType<typeof barrier>[] = [];
    let authorizations = 0;
    const options: Options = {
      receipt,
      path: directory,
      policy: {
        id: 'fixed',
        version: 'policy-2',
        profile: 'linux-x64-system-v1',
        cpuPercent: 20,
        memoryBytes: 67108864,
        swapBytes: 0,
        tasks: 16,
        outputBytes: 1048576,
        runtimeMs: 30000,
        stopGraceMs: 200,
      },
      args: [],
      persist: () => records.save(receipt),
      async authorize() {
        authorizations++;
      },
      async running() {
        receipt.status.phase = 'running';
        await records.save(receipt);
        running.push(structuredClone(receipt));
      },
      // Mirrors the provider's durable confirmation; K admission is outside this fixture.
      async stopped(failed) {
        receipt.status.phase = 'stopped';
        receipt.status.stopConfirmed = true;
        await records.save(receipt);
        stopped.push(failed);
      },
      async uncertain(error) {
        receipt.status.phase = 'unknown';
        await records.save(receipt);
        errors.push(error);
      },
    };
    const controller = native.controller(options);
    return {
      root,
      records,
      receipt,
      events,
      disk,
      observation,
      native,
      request,
      options,
      controller,
      calls,
      hooks,
      running,
      stopped,
      errors,
      get authorizations() {
        return authorizations;
      },
      count: (method: Method) => calls.filter((call) => call.method === method).length,
      hold() {
        const held = barrier();
        holds.push(held);
        return held;
      },
      async emit(event: object) {
        await appendFile(events, `${JSON.stringify(event)}\n`);
      },
      async close() {
        for (const held of holds) held.release();
        hooks.clear();
        try {
          await controller.stop();
          await expect.poll(() => controller.hasExited).toBe(true);
        } finally {
          await records.close();
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

const test = base.extend<{ control: Awaited<ReturnType<typeof fixture>> }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring fixture dependencies.
  control: async ({}, use) => {
    const f = await fixture();
    try {
      await use(f);
    } finally {
      await f.close();
    }
  },
});
test.skip(
  process.platform !== 'linux' || process.arch !== 'x64' || process.geteuid?.() === 0,
  'Real C-owned FIFO, records and event files require an ordinary Linux x64 UID.',
);

test('durably records intents and original scope before P/G; only native running and M stop ACK confirm state', async ({
  control: f,
}) => {
  f.hooks.set('reportManager.start', async () => {
    expect(await f.disk()).toMatchObject({ scopeIntent: true, launchIntent: false });
    expect((await f.disk()).scope).toBeUndefined();
  });
  f.hooks.set('reportManager.arm', async (input) => {
    expect(await f.disk()).toMatchObject({ scope: f.observation.scope });
    expect(input).toMatchObject({
      scope: reportManagerScope(f.observation.scope),
      permit: f.receipt.systemInputs?.permit,
    });
  });
  const authorize = f.options.authorize;
  f.options.authorize = async () => {
    await authorize();
    expect(await readFile(f.events, 'utf8')).toContain('"event":"ready"');
    expect((await f.disk()).launchIntent).toBe(f.authorizations === 2);
  };
  const permit = f.hold();
  f.hooks.set('reportManager.permit', async () => {
    expect(f.authorizations).toBe(2);
    expect(await f.disk()).toMatchObject({ launchIntent: true, scope: f.observation.scope });
    await permit.wait();
  });
  await f.controller.start();
  await f.emit({ event: 'armed', pid: f.observation.scope.controllerPid });
  await expect.poll(() => f.count('reportManager.arm')).toBe(1);
  expect(f.authorizations).toBe(0);
  await f.emit({ event: 'ready' });
  await permit.entered;
  expect(f.running).toEqual([]);
  permit.release();
  // Give the polling monitor several turns after the permit ACK, without a native exec event.
  await pause(100);
  expect(f.running).toEqual([]);
  expect((await f.disk()).status).toMatchObject({ phase: 'starting', gateReleased: false });
  await f.emit({ event: 'running' });
  await expect.poll(() => f.running.length).toBe(1);
  expect((await f.disk()).status).toMatchObject({ phase: 'running', gateReleased: true });
  const stop = f.hold();
  f.hooks.set('reportManager.stop', async (input) => {
    expect(input).toMatchObject({ scope: reportManagerScope(f.observation.scope) });
    await stop.wait();
  });
  await f.emit({ event: 'stopped', gateReleased: true, failed: false });
  await stop.entered;
  expect(f.stopped).toEqual([]);
  expect((await f.disk()).status.stopConfirmed).toBe(false);
  await expect(f.native.releaseStopped?.(await f.disk())).rejects.toMatchObject({
    code: 'outcomeUnknown',
  });
  expect(f.count('reportManager.release')).toBe(0);
  stop.release();
  await expect.poll(() => f.stopped).toEqual([false]);
  expect((await f.disk()).status).toMatchObject({ phase: 'stopped', stopConfirmed: true });
  expect(f.errors).toEqual([]);
});

for (const check of [1, 2]) {
  for (const action of ['cancel', 'revoke'] as const) {
    test(`${action} across authorization await ${check} blocks late G`, async ({ control: f }) => {
      const held = f.hold();
      const revoked = new Error('Synthetic authorization revocation.');
      const authorize = f.options.authorize;
      f.options.authorize = async () => {
        await authorize();
        if (f.authorizations === check) {
          await held.wait();
          if (action === 'revoke') throw revoked;
        }
      };
      await f.controller.start();
      await f.emit({ event: 'armed', pid: f.observation.scope.controllerPid });
      await f.emit({ event: 'ready' });
      await held.entered;
      expect((await f.disk()).launchIntent).toBe(check === 2);
      if (action === 'cancel') expect(await f.controller.stop()).toBe(true);
      held.release();
      await expect.poll(() => f.controller.hasExited).toBe(true);
      expect(f.count('reportManager.permit')).toBe(0);
      expect(f.count('reportManager.start')).toBe(1);
      expect(f.running).toEqual([]);
      expect(f.stopped).toHaveLength(1);
      if (action === 'revoke') expect(f.errors).toContain(revoked);
    });
  }
}

for (const lost of ['start', 'permit'] as const) {
  test(`lost ${lost} ACK retains recovery identity and never replays start/G`, async ({
    control: f,
  }) => {
    const failure = new OperationError('outcomeUnknown', 'Synthetic lost M response.');
    f.hooks.set(`reportManager.${lost}`, async () => {
      throw failure;
    });
    const stop = f.hold();
    f.hooks.set(lost === 'start' ? 'reportManager.recover' : 'reportManager.stop', () =>
      stop.wait(),
    );
    if (lost === 'start') {
      await expect(f.controller.start()).rejects.toBe(failure);
    } else {
      await f.controller.start();
      await f.emit({ event: 'armed', pid: f.observation.scope.controllerPid });
      await f.emit({ event: 'ready' });
      await expect.poll(() => f.errors.length).toBe(1);
      expect(f.errors).toContain(failure);
    }
    const stopping = f.controller.stop();
    await stop.entered;
    const disk = await f.disk();
    expect(disk.scopeIntent).toBe(true);
    expect(disk.launchIntent).toBe(lost === 'permit');
    expect(disk.status.stopConfirmed).toBe(false);
    if (lost === 'start') expect(disk.scope).toBeUndefined();
    else expect(disk.scope).toMatchObject(f.observation.scope);
    expect(f.stopped).toEqual([]);
    expect(f.running).toEqual([]);
    stop.release();
    expect(await stopping).toBe(true);
    await f.controller.stop();
    expect(f.count('reportManager.start')).toBe(1);
    expect(f.count('reportManager.permit')).toBe(lost === 'permit' ? 1 : 0);
    expect(f.count('reportManager.recover')).toBe(lost === 'start' ? 1 : 0);
    expect(f.count('reportManager.stop')).toBe(lost === 'permit' ? 1 : 0);
    expect(f.count('reportManager.release')).toBe(0);
  });
}

for (const change of ['same-byte inode replacement', 'over 4096 bytes'] as const) {
  for (const when of ['before start', 'while monitoring'] as const) {
    test(`rejects events ${change} ${when} and retains stop authority`, async ({ control: f }) => {
      const stop = f.hold();
      f.hooks.set('reportManager.stop', () => stop.wait());
      f.hooks.set('reportManager.recover', () => stop.wait());
      if (when === 'while monitoring') {
        await f.controller.start();
        await f.emit({ event: 'armed', pid: f.observation.scope.controllerPid });
        await expect.poll(() => f.count('reportManager.arm')).toBe(1);
      }
      const original = await lstat(f.events, { bigint: true });
      if (change === 'same-byte inode replacement') {
        const bytes = await readFile(f.events);
        await rename(f.events, `${f.events}.original`);
        await writeFile(f.events, bytes, { mode: 0o600 });
        expect(await readFile(f.events)).toEqual(bytes);
        expect((await lstat(f.events, { bigint: true })).ino).not.toBe(original.ino);
      } else {
        await appendFile(f.events, Buffer.alloc(4097, 0x20));
        expect((await lstat(f.events)).size).toBeGreaterThan(4096);
      }
      if (when === 'before start') {
        await expect(f.controller.start()).rejects.toMatchObject({ code: 'outcomeUnknown' });
        expect(f.calls).toEqual([]);
        expect((await f.disk()).scopeIntent).toBe(false);
      } else {
        await expect.poll(() => f.errors.length).toBe(1);
        expect(f.errors[0]).toMatchObject({ code: 'outcomeUnknown' });
        await stop.entered;
        expect((await f.disk()).scope).toMatchObject(f.observation.scope);
      }
      expect(f.stopped).toEqual([]);
      expect((await f.disk()).status.stopConfirmed).toBe(false);
      await expect(f.native.releaseStopped?.(await f.disk())).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
      expect(f.count('reportManager.release')).toBe(0);
      stop.release();
    });
  }
}

test('native stopped plus lost M stop ACK cannot confirm or release the original scope', async ({
  control: f,
}) => {
  const failure = new OperationError('outcomeUnknown', 'Synthetic lost stop response.');
  f.hooks.set('reportManager.stop', async () => {
    throw failure;
  });
  await f.controller.start();
  await f.emit({ event: 'armed', pid: f.observation.scope.controllerPid });
  await expect.poll(() => f.count('reportManager.arm')).toBe(1);
  await f.emit({ event: 'stopped', gateReleased: false, failed: true });
  await expect.poll(() => f.controller.hasExited).toBe(true);
  expect(f.errors).toContain(failure);
  expect(f.stopped).toEqual([]);
  expect(await f.controller.stop()).toBe(false);
  expect(await f.disk()).toMatchObject({
    scope: f.observation.scope,
    status: { stopConfirmed: false },
  });
  await expect(f.native.releaseStopped?.(await f.disk())).rejects.toMatchObject({
    code: 'outcomeUnknown',
  });
  expect(f.count('reportManager.release')).toBe(0);
});

test('reconnect releases only C-persisted stop confirmation through recover, without fresh admission', async ({
  control: f,
}) => {
  await f.controller.start();
  expect(await f.controller.stop()).toBe(true);
  await expect.poll(() => f.controller.hasExited).toBe(true);
  const reader = new IsolationRecords(f.root, route);
  try {
    await reader.initializeExisting();
    const loaded = await reader.loadExisting(f.receipt.configId);
    expect(loaded.receipts).toHaveLength(1);
    const confirmed = loaded.receipts[0];
    if (!confirmed) throw new Error('Missing persisted receipt.');
    expect(confirmed.status).toMatchObject({ phase: 'stopped', stopConfirmed: true });
    const calls: { method: Method; input: unknown }[] = [];
    const recovered = f.hold();
    let failRecovery = true;
    const fresh = systemReportAdapter(f.receipt.configId, async (method, input) => {
      calls.push({ method, input: structuredClone(input) });
      if (method === 'reportManager.recover') {
        if (failRecovery)
          throw new OperationError('outcomeUnknown', 'Synthetic reconnect uncertainty.');
        await recovered.wait();
        return { scopeEmpty: true };
      }
      if (method !== 'reportManager.release') throw new Error('Unexpected new work on reconnect.');
      return {};
    });
    await expect(
      fresh.releaseStopped?.({
        ...confirmed,
        status: { ...confirmed.status, stopConfirmed: false },
      }),
    ).rejects.toMatchObject({ code: 'outcomeUnknown' });
    expect(calls).toEqual([]);
    await expect(fresh.releaseStopped?.(confirmed)).rejects.toMatchObject({
      code: 'outcomeUnknown',
    });
    expect(calls.map((call) => call.method)).toEqual(['reportManager.recover']);
    calls.length = 0;
    failRecovery = false;
    const releasing = fresh.releaseStopped?.(confirmed);
    await recovered.entered;
    expect(calls.map((call) => call.method)).toEqual(['reportManager.recover']);
    recovered.release();
    await releasing;
    expect(calls.map((call) => call.method)).toEqual([
      'reportManager.recover',
      'reportManager.release',
    ]);
    expect(calls[1]?.input).toMatchObject({
      configId: confirmed.configId,
      storageId: confirmed.storageId,
      scope: reportManagerScope(f.observation.scope),
      inputs: confirmed.version === 2 ? confirmed.systemInputs : undefined,
    });
    expect(calls[0]?.input).toMatchObject({ scope: reportManagerScope(f.observation.scope) });
    expect(f.count('reportManager.start')).toBe(1);
    expect(f.count('reportManager.arm')).toBe(0);
    expect(f.count('reportManager.permit')).toBe(0);
    expect(await f.disk()).toEqual(confirmed);
  } finally {
    await reader.close();
  }
});
