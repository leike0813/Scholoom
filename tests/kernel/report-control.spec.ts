import assert from 'node:assert/strict';
import { type ChildProcess, fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rmdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ReportControlClient } from '../../apps/kernel/dist/report-control.js';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import {
  type IsolationReceipt,
  IsolationRecords,
} from '../../packages/platform/dist/isolated-report-records.js';
import { openReportChannel } from '../../packages/platform/dist/report-channel.js';
import { compileContract, OperationError } from '../../packages/protocol/dist/core.js';
import {
  type IsolationInputs,
  isolationOperations,
  type ReportManagerStop,
  type ReportManagerStart,
  reportManagerOperations,
} from '../../packages/protocol/dist/platform-isolation.js';
import {
  barrier,
  CountedAdmission,
  reportSourceFixture,
} from '../fixtures/isolated-report-preparation.js';
import type {
  HostCommand,
  HostFrame,
  HostReply,
  ServiceReply,
} from '../fixtures/report-control-host.mts';

const input = (instanceId: string = randomUUID()) => ({
  instanceId,
  programId: 'fixed',
  policyId: 'fixed',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function connection(client: ReportControlClient, privateRoot: string, configId: string) {
  const child = fork(
    new URL('../fixtures/report-control-host.mts', import.meta.url),
    [privateRoot, configId],
    { execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  let diagnostic = '';
  child.stderr?.on('data', (data: Buffer) => {
    diagnostic = (diagnostic + data.toString()).slice(-8192);
  });
  const ready = deferred<number>();
  const exited = deferred<void>();
  const pending = new Map<
    number,
    {
      resolve(value: HostReply['state']): void;
      reject(error: Error): void;
    }
  >();
  const inventoryPages: number[] = [];
  const recoveredIds: string[] = [];
  let sequence = 0;
  const send = (message: HostFrame | HostCommand) =>
    new Promise<void>((resolve, reject) => {
      child.send(message, (error) => (error ? reject(error) : resolve()));
    });
  const binding = client.connect({ send: (frame) => send({ type: 'rpc', frame }) });
  child.on('message', (message: HostFrame | HostReply | { type: 'ready'; pid: number }) => {
    if (message.type === 'rpc') {
      const frame = JSON.parse(message.frame);
      if (frame.method === 'reportHost.inventory')
        inventoryPages.push(frame.params.statuses.length);
      if (frame.method === 'reportHost.recover') recoveredIds.push(frame.params.instanceId);
      binding.receive(message.frame);
    } else if (message.type === 'ready') ready.resolve(message.pid);
    else pending.get(message.id)?.resolve(message.state);
  });
  child.once('disconnect', () => binding.disconnect());
  child.once('error', (error) => ready.reject(error));
  child.once('close', () => {
    const error = new Error(diagnostic || 'Report control fixture exited.');
    ready.reject(error);
    for (const waiter of pending.values()) waiter.reject(error);
    exited.resolve();
  });
  async function command(command: HostCommand['command']) {
    const id = ++sequence;
    const reply = deferred<HostReply['state']>();
    pending.set(id, reply);
    const timer = setTimeout(() => reply.reject(new Error('Fixture test gate timed out.')), 5000);
    try {
      await send({ type: 'test', id, command });
      return await reply.promise;
    } finally {
      clearTimeout(timer);
      pending.delete(id);
    }
  }
  return {
    child,
    ready: ready.promise,
    inventoryPages,
    recoveredIds,
    inspect: () => command('inspect'),
    async crash() {
      assert(child.kill('SIGKILL'));
      await exited.promise;
    },
    async disconnect() {
      try {
        if (child.connected) await command('disconnect');
      } catch (error) {
        child.kill('SIGKILL');
        throw error;
      } finally {
        await exited.promise;
      }
    },
  };
}

async function fixture(root: string, history = 0, wrongConfig = false) {
  const source = await reportSourceFixture(root);
  const privateRoot = join(root, 'control');
  const records = new IsolationRecords(privateRoot);
  await records.initialize();
  const lock = await isolationLock(records.lockPath);
  let configId: string;
  try {
    ({ configId } = await records.provisionEmpty());
    for (let index = 0; index < history; index++) {
      const receipt = await records.create(
        {
          ...input(`history-${index}`),
          entryPath: 'report.html',
          assets: [{ path: 'report.html', byteLength: 1 }],
        },
        '1',
        '1',
      );
      await records.save({
        ...receipt,
        status: { ...receipt.status, phase: 'stopped', stopConfirmed: true },
      });
    }
  } finally {
    await records.close();
    await lock.close();
  }
  // The parent provisions and relinquishes the real writer lock before C may open it.
  if (wrongConfig) configId = randomUUID();
  const admission = new CountedAdmission(1, 2);
  const client = new ReportControlClient({ configId, admission, authorize: source.authorize });
  const children: ReturnType<typeof connection>[] = [];
  async function connect() {
    const child = connection(client, privateRoot, configId);
    children.push(child);
    await child.ready;
    return child;
  }
  const readIndex = async () =>
    JSON.parse(await readFile(join(privateRoot, 'index.json'), 'utf8')) as {
      instanceId: string;
      storageId: string;
    }[];
  async function receipt(instanceId: string) {
    const entry = (await readIndex()).find((entry) => entry.instanceId === instanceId);
    assert(entry);
    const directory = join(privateRoot, entry.storageId);
    return {
      directory,
      value: JSON.parse(
        await readFile(join(directory, 'receipt.json'), 'utf8'),
      ) as IsolationReceipt,
    };
  }
  return {
    ...source,
    privateRoot,
    configId,
    admission,
    client,
    connect,
    readIndex,
    receipt,
    async close() {
      try {
        if (!wrongConfig && children.at(-1)?.child.connected) await client.close();
      } finally {
        for (const child of children) await child.disconnect();
      }
    },
  };
}

test.describe('report control over child IPC', () => {
  test.skip(
    process.platform !== 'linux' || process.arch !== 'x64',
    'Real Linux native flock and private assets.',
  );

  test('C persists multibyte assets after the single K lease; duplicate prepare keeps the same promise', async () => {
    const f = await fixture(test.info().outputPath('case'));
    const child = await f.connect();
    const live = f.admission.reserve();
    await live.ready;
    try {
      await f.client.initialize();
      expect(await child.inspect()).toMatchObject({ pid: child.child.pid, parentPid: process.pid });
      expect(child.child.pid).not.toBe(process.pid);
      expect(f.data.length).toBeGreaterThan(256 * 1024);
      const request = input();
      const target = { instanceId: request.instanceId };
      const prepared = f.client.prepare(request, f.load);
      expect(f.client.prepare(request, f.load)).toBe(prepared);
      await expect.poll(() => f.admission.status.waiting).toBe(1);
      expect(f.state.loads).toBe(0);
      expect(await f.readIndex()).toEqual([]);
      live.release();
      expect(await prepared).toMatchObject({ phase: 'preparing', gateReleased: false });
      expect(f.state.loads).toBe(1);
      expect(f.admission.reservations).toBe(2);
      expect(f.admission.status.active).toBe(1);
      const saved = await f.receipt(request.instanceId);
      expect(saved.value.stage.assets).toEqual([
        { path: 'reports/index.html', byteLength: Buffer.byteLength(f.html) },
        { path: 'reports/assets/data.json', byteLength: f.data.length },
      ]);
      expect(await readFile(join(saved.directory, 'asset-0.bin'))).toEqual(Buffer.from(f.html));
      expect(await readFile(join(saved.directory, 'asset-1.bin'))).toEqual(f.data);
      const port = f.client.port();
      expect(await port['platform.reportIsolation.start'](target)).toMatchObject({
        phase: 'running',
        gateReleased: true,
      });
      expect((await child.inspect()).starts).toBe(1);
      expect((await port['platform.reportIsolation.stop'](target)).stopConfirmed).toBe(true);
      await expect.poll(() => f.admission.status.active).toBe(0);
    } finally {
      live.release();
      await f.close();
    }
  });

  test('queued stop cancels the original K waiter without freezing or persisting an intent', async () => {
    const f = await fixture(test.info().outputPath('case'));
    await f.connect();
    const live = f.admission.reserve();
    await live.ready;
    try {
      await f.client.initialize();
      const request = input();
      const prepared = f.client.prepare(request, f.load);
      const rejected = expect(prepared).rejects.toMatchObject({ code: 'shuttingDown' });
      await expect.poll(() => f.admission.status.waiting).toBe(1);
      expect(
        await f.client.port()['platform.reportIsolation.stop']({ instanceId: request.instanceId }),
      ).toMatchObject({ phase: 'stopped', stopConfirmed: true });
      await rejected;
      expect(f.state.loads).toBe(0);
      expect(await f.readIndex()).toEqual([]);
      await expect.poll(() => f.admission.status).toMatchObject({ active: 1, waiting: 0 });
      expect(f.admission.reservations).toBe(2);
    } finally {
      live.release();
      await f.close();
    }
  });

  for (const mode of ['stop', 'timeout'] as const) {
    test(`in-flight freeze ${mode} holds K capacity until the local loader settles and saves no late bytes`, async () => {
      const f = await fixture(test.info().outputPath('case'));
      await f.connect();
      const reading = barrier();
      f.state.onRead = async () => reading.wait();
      let stopped: Promise<unknown> | undefined;
      let prepared: Promise<unknown> | undefined;
      try {
        await f.client.initialize();
        const request = input();
        const target = { instanceId: request.instanceId };
        prepared = f.client.prepare(request, f.load).catch((error: unknown) => error);
        await reading.started;
        expect(f.admission.status.active).toBe(1);
        const port = f.client.port();
        if (mode === 'stop') {
          stopped = port['platform.reportIsolation.stop'](target);
          await expect
            .poll(async () => (await port['platform.reportIsolation.get'](target)).phase)
            .toBe('stopping');
        } else {
          expect(await prepared).toBeInstanceOf(OperationError);
          expect(await prepared).toMatchObject({ code: 'unavailable' });
          expect(await port['platform.reportIsolation.get'](target)).toMatchObject({
            stopConfirmed: true,
          });
        }
        expect(f.admission.status.active).toBe(1);
        expect(await f.readIndex()).toEqual([]);
        reading.release();
        expect(await prepared).toMatchObject({
          code: mode === 'stop' ? 'shuttingDown' : 'unavailable',
        });
        if (stopped) expect(await stopped).toMatchObject({ stopConfirmed: true });
        await expect.poll(() => f.admission.status.active).toBe(0);
        expect(f.state.loads).toBe(1);
        expect(await f.readIndex()).toEqual([]);
        expect(f.admission.reservations).toBe(1);
      } finally {
        reading.release();
        await prepared;
        await stopped;
        await f.close();
      }
    });
  }

  test('a wrong config identity cannot provision or replace the existing inventory', async () => {
    const f = await fixture(test.info().outputPath('case'), 1, true);
    const names = (await readdir(f.privateRoot)).sort();
    const before = await Promise.all(
      ['config.json', 'index.json'].map((name) => readFile(join(f.privateRoot, name), 'utf8')),
    );
    await f.connect();
    try {
      await expect(f.client.initialize()).rejects.toMatchObject({ code: 'unavailable' });
      expect((await readdir(f.privateRoot)).sort()).toEqual(names);
      expect(
        await Promise.all(
          ['config.json', 'index.json'].map((name) => readFile(join(f.privateRoot, name), 'utf8')),
        ),
      ).toEqual(before);
      expect(f.admission.status.active).toBe(0);
      expect(f.admission.reservations).toBe(0);
    } finally {
      await f.close();
    }
  });

  for (const mode of ['disconnect', 'crash'] as const) {
    test(`${mode} retains K ownership until restarted C supplies its complete paged inventory without replay`, async () => {
      const f = await fixture(test.info().outputPath('case'), 64);
      const first = await f.connect();
      try {
        await f.client.initialize();
        const request = input();
        const target = { instanceId: request.instanceId };
        await f.client.prepare(request, f.load);
        await f.client.port()['platform.reportIsolation.start'](target);
        const before = await f.receipt(request.instanceId);
        expect(before.value).toMatchObject({
          scopeIntent: true,
          launchIntent: true,
          status: { phase: 'running', stopConfirmed: false },
        });
        expect(f.admission.status.active).toBe(1);
        await first[mode]();
        expect(f.admission.status.active).toBe(1);
        const interrupted = await f.receipt(request.instanceId);
        expect(interrupted.value.status.stopConfirmed).toBe(mode === 'disconnect');
        if (mode === 'crash') {
          expect(first.child.signalCode).toBe('SIGKILL');
          expect(interrupted.value).toEqual(before.value);
        }
        const second = await f.connect();
        expect(second.child.pid).not.toBe(first.child.pid);
        expect(f.admission.status.active).toBe(1);
        await f.client.initialize();
        await expect.poll(() => f.admission.status.active).toBe(0);
        expect(second.recoveredIds).toEqual(mode === 'crash' ? [request.instanceId] : []);
        expect(second.inventoryPages).toEqual([64, 1]);
        expect(await second.inspect()).toMatchObject({
          starts: 0,
          recoveries: mode === 'crash' ? 1 : 0,
        });
        expect(await f.client.port()['platform.reportIsolation.get'](target)).toMatchObject({
          phase: 'stopped',
          stopConfirmed: true,
        });
        const after = await f.receipt(request.instanceId);
        expect(after.directory).toBe(before.directory);
        expect(after.value).toEqual({
          ...before.value,
          status: { ...before.value.status, phase: 'stopped', stopConfirmed: true },
        });
        expect(f.state.loads).toBe(1);
        expect(f.admission.reservations).toBe(1);
        expect(await readFile(join(after.directory, 'asset-0.bin'))).toEqual(Buffer.from(f.html));
        expect(await readFile(join(after.directory, 'asset-1.bin'))).toEqual(f.data);
      } finally {
        await f.close();
      }
    });
  }

  for (const allowed of [true, false]) {
    test(`authenticated stdio C ${allowed ? 'accepts the configured account and persists assets' : 'rejects the wrong caller before opening records'}`, async () => {
      const f = await fixture(test.info().outputPath('case'));
      const uid = process.getuid?.();
      assert(uid !== undefined);
      const callerUid = allowed ? uid : uid === 0 ? 1 : 0;
      const cache = join(homedir(), '.cache');
      await mkdir(cache, { recursive: true, mode: 0o700 });
      const socketRoot = await mkdtemp(join(cache, 'scholoom-rc-'));
      const path = join(socketRoot, 'c.sock');
      expect(Buffer.byteLength(path)).toBeLessThan(108);
      const before = await Promise.all(
        ['config.json', 'index.json'].map((name) => readFile(join(f.privateRoot, name), 'utf8')),
      );
      let child: ChildProcess | undefined;
      let reply: ServiceReply | undefined;
      let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
      let diagnostic = '';
      const exited = deferred<void>();
      const server = createServer({ pauseOnConnect: true }, (socket) => {
        // The parent never reads this stream; fork duplicates the public Socket into C's fd0/1.
        child = fork(
          new URL('../fixtures/report-control-host.mts', import.meta.url),
          [f.privateRoot, f.configId, 'stdio', String(callerUid)],
          { execArgv: [], stdio: [socket, socket, 'pipe', 'ipc'] },
        );
        child.stderr?.on('data', (data: Buffer) => {
          diagnostic = (diagnostic + data.toString()).slice(-8192);
        });
        child.on('message', (message: ServiceReply) => {
          if (message.type === 'service') reply = message;
        });
        child.once('error', (error) => {
          diagnostic = error.message;
        });
        child.once('close', (code, signal) => {
          exit = { code, signal };
          exited.resolve();
        });
        socket.destroy();
      });
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(path, resolve);
        });
        const failure = await f.client.connectService({ path, ownerUid: uid, serverUid: uid }).then(
          () => undefined,
          (error: unknown) => error,
        );
        if (allowed) {
          expect(failure, diagnostic).toBeUndefined();
          assert(child?.pid);
          expect(child.pid).not.toBe(process.pid);
          const request = input();
          const target = { instanceId: request.instanceId };
          expect(f.data.length).toBeGreaterThan(256 * 1024);
          await f.client.prepare(request, f.load);
          const saved = await f.receipt(request.instanceId);
          expect(await readFile(join(saved.directory, 'asset-0.bin'))).toEqual(Buffer.from(f.html));
          expect(await readFile(join(saved.directory, 'asset-1.bin'))).toEqual(f.data);
          expect(f.admission.status.active).toBe(1);
          expect(f.admission.reservations).toBe(1);
          const port = f.client.port();
          expect(await port['platform.reportIsolation.start'](target)).toMatchObject({
            phase: 'running',
            gateReleased: true,
          });
          expect(await port['platform.reportIsolation.stop'](target)).toMatchObject({
            phase: 'stopped',
            stopConfirmed: true,
          });
          await expect.poll(() => f.admission.status.active).toBe(0);
          expect((await f.receipt(request.instanceId)).value.status.stopConfirmed).toBe(true);
          await f.client.close();
        } else {
          expect(failure).toBeInstanceOf(OperationError);
          expect(
            await Promise.all(
              ['config.json', 'index.json'].map((name) =>
                readFile(join(f.privateRoot, name), 'utf8'),
              ),
            ),
          ).toEqual(before);
          expect(f.admission.status.active).toBe(0);
          expect(f.admission.reservations).toBe(0);
          expect(f.state.loads).toBe(0);
        }
        await expect
          .poll(() => exit, { message: diagnostic })
          .toEqual({ code: allowed ? 0 : 1, signal: null });
        expect(reply).toMatchObject({
          state: {
            pid: child?.pid,
            parentPid: process.pid,
            supports: allowed ? 1 : 0,
            starts: allowed ? 1 : 0,
          },
        });
        if (allowed) expect(reply?.code).toBeUndefined();
        else expect(reply?.code).toBe('authenticationFailed');
      } finally {
        f.client.disconnect();
        if (child) {
          if (!exit) child.kill('SIGKILL');
          await exited.promise;
        }
        if (server.listening)
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          );
        await rmdir(socketRoot);
      }
    });
  }

  test('authenticated stdio M rejects nonroot OS actions and foreign role requests without touching C records', async () => {
    test.skip(
      process.geteuid?.() === 0,
      'This representative must not invoke a root management action.',
    );
    const uid = process.getuid?.();
    assert(uid !== undefined && process.geteuid?.() !== 0);
    const privateRoot = test.info().outputPath('untouched-control');
    const records = new IsolationRecords(privateRoot);
    await records.initialize();
    const lock = await isolationLock(records.lockPath);
    let configId: string;
    try {
      ({ configId } = await records.provisionEmpty());
    } finally {
      await records.close();
      await lock.close();
    }
    const names = (await readdir(privateRoot)).sort();
    const contents = () => Promise.all(names.map((name) => readFile(join(privateRoot, name))));
    const before = await contents();
    const cache = join(homedir(), '.cache');
    await mkdir(cache, { recursive: true, mode: 0o700 });
    const socketRoot = await mkdtemp(join(cache, 'scholoom-rm-'));
    const path = join(socketRoot, 'm.sock');
    expect(Buffer.byteLength(path)).toBeLessThan(108);
    let child: ChildProcess | undefined;
    let reply: ServiceReply | undefined;
    let exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
    let diagnostic = '';
    const exited = deferred<void>();
    const server = createServer({ pauseOnConnect: true }, (socket) => {
      child = fork(
        new URL('../fixtures/report-control-host.mts', import.meta.url),
        [privateRoot, configId, 'manager', String(uid)],
        { execArgv: [], stdio: [socket, socket, 'pipe', 'ipc'] },
      );
      child.stderr?.on('data', (data: Buffer) => {
        diagnostic = (diagnostic + data.toString()).slice(-8192);
      });
      child.on('message', (message: ServiceReply) => {
        if (message.type === 'service') reply = message;
      });
      child.once('error', (error) => {
        diagnostic = error.message;
      });
      child.once('close', (code, signal) => {
        exit = { code, signal };
        exited.resolve();
      });
      socket.destroy();
    });
    let peer: RpcPeer | undefined;
    let channel: Awaited<ReturnType<typeof openReportChannel>> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(path, resolve);
      });
      channel = await openReportChannel({
        path,
        ownerUid: uid,
        serverUid: uid,
        onFrame: (frame) => peer?.receive(frame),
        onClose: () => peer?.close(),
      });
      peer = new RpcPeer(channel);
      const stop: ReportManagerStop = {
        configId,
        storageId: randomUUID(),
        scope: { bootId: randomUUID(), invocationId: '1'.repeat(32), dev: '1', ino: '1' },
      };
      const start: ReportManagerStart = {
        configId,
        storageId: stop.storageId,
        programId: 'fixed',
        programVersion: '1',
        policyId: 'fixed',
        policyVersion: '1',
        assets: 1,
        inputs: {
          bootId: stop.scope.bootId,
          manifest: '1:2:3:4:5',
          permit: { dev: '1', ino: '3' },
          events: { dev: '1', ino: '4' },
          stdout: { dev: '1', ino: '5' },
          stderr: { dev: '1', ino: '6' },
        },
      };
      const gate = { configId, storageId: stop.storageId, scope: stop.scope, permit: start.inputs.permit };
      const managerInputs: Record<keyof typeof reportManagerOperations, unknown> = {
        'reportManager.ping': { configId },
        'reportManager.capture': { configId, storageId: stop.storageId },
        'reportManager.stop': stop,
        'reportManager.start': start,
        'reportManager.arm': gate,
        'reportManager.permit': gate,
        'reportManager.recover': start,
        'reportManager.release': { ...start, scope: stop.scope },
      };
      for (const [method, operation] of Object.entries(reportManagerOperations)) {
        const params = managerInputs[method as keyof typeof managerInputs] as object;
        expect(compileContract(operation).params(params)).toBe(true);
        const options = { waitMs: operation.semantics.waitMs, control: true };
        await expect(peer.request(method, params, options)).rejects.toMatchObject({
          code: 'unavailable',
        });
        for (const invalid of [
          { ...params, configId: randomUUID() },
          { ...params, path: '/arbitrary' },
        ]) {
          await expect(peer.request(method, invalid, options)).rejects.toMatchObject({
            code: 'invalidRequest',
          });
        }
      }
      const instanceId = randomUUID();
      const oldInputs: IsolationInputs = {
        'platform.reportIsolation.check': { programId: 'fixed', policyId: 'fixed' },
        'platform.reportIsolation.stage': {
          instanceId,
          programId: 'fixed',
          policyId: 'fixed',
          entryPath: 'report.html',
          assets: [{ path: 'report.html', byteLength: 1 }],
        },
        'platform.reportIsolation.put': {
          instanceId,
          path: 'report.html',
          offset: 0,
          base64: 'AA==',
        },
        'platform.reportIsolation.start': { instanceId },
        'platform.reportIsolation.get': { instanceId },
        'platform.reportIsolation.stop': { instanceId },
      };
      for (const method of Object.keys(isolationOperations) as (keyof IsolationInputs)[]) {
        const operation = isolationOperations[method];
        expect(compileContract(operation).params(oldInputs[method])).toBe(true);
        await expect(
          peer.request(method, oldInputs[method], {
            waitMs: operation.semantics.waitMs,
            control: true,
          }),
        ).rejects.toMatchObject({ code: 'invalidRequest' });
      }
      peer.close();
      await channel.close();
      await expect.poll(() => exit, { message: diagnostic }).toEqual({ code: 0, signal: null });
      expect(reply).toMatchObject({
        state: { pid: child?.pid, parentPid: process.pid, supports: 0, starts: 0, recoveries: 0 },
      });
      expect(reply?.code).toBeUndefined();
      expect((await readdir(privateRoot)).sort()).toEqual(names);
      expect(await contents()).toEqual(before);
    } finally {
      peer?.close();
      await channel?.close();
      if (child) {
        if (!exit) child.kill('SIGKILL');
        await exited.promise;
      }
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      await rmdir(socketRoot);
    }
  });
});
