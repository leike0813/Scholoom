import { type ChildProcess, execFileSync, fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, cp, mkdir, readdir, readFile, rename, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { Broker } from '../../packages/broker/dist/index.js';
import { stopRecoveredIsolation } from '../../packages/platform/dist/isolated-report-controller.js';
import {
  IsolatedReportProvider,
  type IsolationPolicy,
  ProcessAdmission,
} from '../../packages/platform/dist/node.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import {
  type IsolationInputs,
  type IsolationOutputs,
  type IsolationStatus,
  isolationOperations,
} from '../../packages/protocol/dist/platform-isolation.js';
import {
  barrier,
  CountedAdmission,
  reportSourceFixture,
} from '../fixtures/isolated-report-preparation.js';

const cache =
  process.env.SCHOOLOOM_ISOLATION_TEST_CACHE ??
  join(homedir(), '.cache', 'scholoom-isolation-tests');
const bytes = Buffer.from('approved report bytes\n');
const policy: IsolationPolicy = {
  id: 'native-test',
  version: '1',
  profile: 'linux-x64-static-v1',
  cpuPercent: 20,
  memoryBytes: 67108864,
  swapBytes: 0,
  tasks: 16,
  outputBytes: 1048576,
  runtimeMs: 30000,
  stopGraceMs: 200,
};
const linux = process.platform === 'linux' && process.arch === 'x64';
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function fixture(mode = 'normal', admission = new ProcessAdmission(1, 2)) {
  const root = join(cache, `provider-${randomUUID()}`);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const revoked = new Set<string>();
  const options = {
    admission,
    privateRoot: root,
    programs: [
      {
        id: 'probe',
        version: '1',
        policyId: policy.id,
        image: await readFile(join(cache, 'isolated-report-native', 'probe')),
        args: [mode],
      },
    ],
    policies: [policy],
    authorize: async (id: string) => {
      if (revoked.has(id)) {
        const e = new Error('revoked');
        Object.assign(e, { code: 'permissionDenied' });
        throw e;
      }
    },
  };
  const provider = new IsolatedReportProvider(options);
  expect(await provider.check({ programId: 'probe', policyId: policy.id })).toEqual({
    available: true,
  });
  await provider.initialize();
  const broker = new Broker<typeof isolationOperations, IsolationInputs, IsolationOutputs>(
    isolationOperations,
  );
  broker.register('isolated-provider', provider.port());
  const client = broker.consumer(
    { moduleId: 'trusted-adapter', principal: { kind: 'system', id: 'test-host' }, role: 'host' },
    Object.keys(isolationOperations) as (keyof typeof isolationOperations)[],
  );
  return { root, options, revoked, admission, provider, broker, client };
}
function stageInput(id: string) {
  return {
    instanceId: id,
    programId: 'probe',
    policyId: policy.id,
    entryPath: 'report.txt',
    assets: [{ path: 'report.txt', byteLength: bytes.length }],
  };
}
async function prepare(f: Fixture, id = randomUUID()): Promise<string> {
  await f.client.call('platform.reportIsolation.stage', stageInput(id));
  await expect
    .poll(
      async () => (await f.client.call('platform.reportIsolation.get', { instanceId: id })).phase,
    )
    .toBe('preparing');
  await f.client.call('platform.reportIsolation.put', {
    instanceId: id,
    path: 'report.txt',
    offset: 0,
    base64: bytes.toString('base64'),
  });
  return id;
}
async function receipt(root: string, id: string) {
  const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8')) as {
    instanceId: string;
    storageId: string;
  }[];
  const key = index.find((e) => e.instanceId === id)?.storageId;
  if (!key) throw new Error('missing independent receipt');
  const path = join(root, key, 'receipt.json');
  return { path, directory: join(root, key), value: JSON.parse(await readFile(path, 'utf8')) };
}
async function completed(f: Fixture, id: string): Promise<IsolationStatus> {
  await expect
    .poll(async () => (await f.provider.get({ instanceId: id })).phase, { timeout: 10000 })
    .toBe('stopped');
  return f.provider.get({ instanceId: id });
}

async function frozenReport(f: Fixture) {
  return reportSourceFixture(join(f.root, 'test-source'), Buffer.from('{"approved":true}\n'));
}
async function preparedReport(
  f: Fixture,
  id: string,
  source: Awaited<ReturnType<typeof frozenReport>>,
) {
  const record = await receipt(f.root, id);
  expect(record.value).toMatchObject({
    launchIntent: false,
    scopeIntent: false,
    stage: {
      entryPath: 'reports/index.html',
      assets: [
        { path: 'reports/index.html', byteLength: Buffer.byteLength(source.html) },
        { path: 'reports/assets/data.json', byteLength: source.data.length },
      ],
    },
    status: { phase: 'preparing', gateReleased: false, stopConfirmed: false },
  });
  expect(await readFile(join(record.directory, 'asset-0.bin'))).toEqual(Buffer.from(source.html));
  expect(await readFile(join(record.directory, 'asset-1.bin'))).toEqual(source.data);
}
async function runPreparedReport(f: Fixture, id: string) {
  await f.provider.start({ instanceId: id });
  const status = await completed(f, id);
  expect(status).toMatchObject({ gateReleased: true, stopConfirmed: true });
  expect(status.failure).toBeUndefined(); // The native literal oracle accepted both actual files.
  const record = await receipt(f.root, id);
  expect(record.value).toMatchObject({
    launchIntent: true,
    scopeIntent: true,
    status: { phase: 'stopped', gateReleased: true, stopConfirmed: true },
    scope: { cgroup: expect.any(String), invocationId: expect.any(String) },
  });
  const groupEmpty = await readFile(
    join('/sys/fs/cgroup', record.value.scope.cgroup, 'cgroup.events'),
    'utf8',
  ).then(
    (events) => /^populated 0$/m.test(events),
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return true;
      throw error;
    },
  );
  expect(groupEmpty).toBe(true);
  expect(f.admission.status).toMatchObject({ active: 0, waiting: 0 });
}
async function closePreparation(f: Fixture, id: string) {
  const before = await f.provider.get({ instanceId: id }).catch(() => undefined);
  try {
    await f.provider.close();
  } finally {
    await test.info().attach('default-linux-preparation', {
      body: Buffer.from(
        JSON.stringify({
          beforeClose: before,
          admission: f.admission.status,
          receipt: (await receipt(f.root, id).catch(() => undefined))?.value,
          index: JSON.parse(await readFile(join(f.root, 'index.json'), 'utf8')),
        }),
      ),
      contentType: 'application/json',
    });
  }
}

test('unregistered isolation programs remain unavailable without allocating process capacity', async () => {
  const admission = new ProcessAdmission(1);
  const provider = new IsolatedReportProvider({
    admission,
    privateRoot: test.info().outputPath('unregistered-isolation'),
    programs: [],
    policies: [],
    authorize: async () => {},
  });
  expect(await provider.check({ programId: 'probe', policyId: 'native-test' })).toMatchObject({
    available: false,
    reason: { code: 'unavailable' },
  });
  expect(admission.status.active).toBe(0);
});

test.describe('independent Linux isolated native provider', () => {
  test.skip(!linux, 'The sole registered profile is Linux x86_64; no portable/browser claim.');
  test.skip(
    !process.env.SCHOOLOOM_ISOLATION_TEST_CACHE,
    'Requires explicitly prepared native fixtures and OS delegation.',
  );

  test('real freeze preparation runs both approved report files through the default Linux scope to full stop', async () => {
    const admission = new CountedAdmission(1, 2);
    const f = await fixture('report', admission);
    const id = randomUUID();
    try {
      const source = await frozenReport(f);
      expect(
        await f.provider.prepare(
          { instanceId: id, programId: 'probe', policyId: policy.id },
          source.load,
        ),
      ).toMatchObject({ phase: 'preparing', gateReleased: false, stopConfirmed: false });
      expect(source.state.loads).toBe(1);
      expect(source.state.reads).toBe(2);
      expect(admission.reservations).toBe(1);
      await preparedReport(f, id, source);
      await runPreparedReport(f, id);
    } finally {
      await closePreparation(f, id);
    }
  });

  test('real freeze preparation waits behind full capacity without reading and uses one reservation after release', async () => {
    const admission = new CountedAdmission(1, 2);
    const f = await fixture('report', admission);
    const id = randomUUID();
    try {
      const source = await frozenReport(f);
      const holder = await prepare(f);
      const input = { instanceId: id, programId: 'probe', policyId: policy.id };
      const pending = f.provider.prepare(input, source.load);
      void pending.catch(() => {});
      expect(f.provider.prepare(input, source.load)).toBe(pending);
      await expect.poll(() => admission.status.waiting).toBe(1);
      expect(source.state.loads).toBe(0);
      expect(source.state.reads).toBe(0);
      const index = JSON.parse(await readFile(join(f.root, 'index.json'), 'utf8')) as {
        instanceId: string;
      }[];
      expect(index.map((item) => item.instanceId)).toEqual([holder]);
      expect(await f.provider.stop({ instanceId: holder })).toMatchObject({ stopConfirmed: true });
      expect(await pending).toMatchObject({ phase: 'preparing' });
      expect(source.state.loads).toBe(1);
      expect(source.state.reads).toBe(2);
      expect(admission.reservations).toBe(2); // One unrelated holder and one preparation.
      await preparedReport(f, id, source);
      await runPreparedReport(f, id);
    } finally {
      await closePreparation(f, id);
    }
  });

  test('real freeze preparation cancelled during a dependency read retains capacity until settlement and never starts', async () => {
    const admission = new CountedAdmission(1, 2);
    const f = await fixture('report', admission);
    const id = randomUUID();
    const reading = barrier();
    let pending: Promise<unknown> | undefined;
    try {
      const source = await frozenReport(f);
      source.state.onRead = async (fileId) => {
        if (fileId === 'data') await reading.wait();
      };
      pending = f.provider
        .prepare({ instanceId: id, programId: 'probe', policyId: policy.id }, source.load)
        .catch((error: unknown) => error);
      await reading.started;
      expect(source.state.reads).toBe(2); // The actual entry was read before the dependency barrier.
      const stopping = f.provider.stop({ instanceId: id });
      const deniedStart = expect(f.provider.start({ instanceId: id })).rejects.toMatchObject({
        code: 'shuttingDown',
      });
      expect(await f.provider.get({ instanceId: id })).toMatchObject({
        phase: 'stopping',
        gateReleased: false,
        stopConfirmed: false,
      });
      expect(admission.status.active).toBe(1);
      expect(() => admission.reserve()).toThrow(expect.objectContaining({ code: 'resourceLimit' }));
      expect(JSON.parse(await readFile(join(f.root, 'index.json'), 'utf8'))).toEqual([]);
      reading.release();
      expect(await pending).toMatchObject({ code: 'shuttingDown' });
      expect(await stopping).toMatchObject({
        phase: 'stopped',
        gateReleased: false,
        stopConfirmed: true,
      });
      await deniedStart;
      expect(admission.status).toMatchObject({ active: 0, waiting: 0 });
      expect(source.state.loads).toBe(1);
      expect(JSON.parse(await readFile(join(f.root, 'index.json'), 'utf8'))).toEqual([]);
    } finally {
      reading.release();
      await pending;
      await closePreparation(f, id);
    }
  });

  test('real broker reads sealed bytes and denies syscall/FD/mount authority before confirmed full stop', async () => {
    const f = await fixture();
    try {
      const id = await prepare(f);
      await f.client.call('platform.reportIsolation.start', { instanceId: id });
      const status = await completed(f, id);
      expect(status).toMatchObject({ gateReleased: true, stopConfirmed: true });
      expect(status.failure).toBeUndefined();
      expect(f.admission.status.active).toBe(0);
      const record = await receipt(f.root, id);
      expect(record.value).toMatchObject({
        launchIntent: true,
        scopeIntent: true,
        status: { stopConfirmed: true },
      });
      expect(record.value.scope).toMatchObject({
        controllerPid: expect.any(Number),
        invocationId: expect.any(String),
      });
      const unauthorized = f.broker.consumer(
        { moduleId: 'page', principal: { kind: 'human', id: 'page' }, role: 'product' },
        [] as (keyof typeof isolationOperations)[],
      );
      await expect(
        unauthorized.call('platform.reportIsolation.start', { instanceId: id }),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
    } finally {
      await f.provider.close();
    }
  });

  test('bounded sequential upload rejects gaps/duplicates/invalid input and sealed writes', async () => {
    const f = await fixture();
    try {
      const id = randomUUID();
      await expect(
        f.provider.stage({ ...stageInput(id), entryPath: '../escape' }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
      await f.provider.stage(stageInput(id));
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('preparing');
      for (const input of [
        { offset: 1, base64: 'YQ==' },
        { offset: 0, base64: 'YQ=' },
        { offset: 0, base64: Buffer.alloc(bytes.length + 1).toString('base64') },
      ])
        await expect(
          f.provider.put({ instanceId: id, path: 'report.txt', ...input }),
        ).rejects.toMatchObject({ code: 'invalidRequest' });
      await f.provider.put({
        instanceId: id,
        path: 'report.txt',
        offset: 0,
        base64: bytes.toString('base64'),
      });
      await expect(
        f.provider.put({ instanceId: id, path: 'report.txt', offset: 0, base64: 'YQ==' }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
      await f.provider.start({ instanceId: id });
      await expect(
        f.provider.put({
          instanceId: id,
          path: 'report.txt',
          offset: bytes.length,
          base64: 'YQ==',
        }),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
      await completed(f, id);
    } finally {
      await f.provider.close();
    }
  });

  test('queue contains no payload and rechecks authorization after the same admission grants its slot', async () => {
    const f = await fixture();
    try {
      const first = await prepare(f),
        second = randomUUID();
      expect((await f.provider.stage(stageInput(second))).phase).toBe('queued');
      expect(await readdir((await receipt(f.root, second)).directory)).toEqual(['receipt.json']);
      f.revoked.add(second);
      await f.provider.stop({ instanceId: first });
      const status = await completed(f, second);
      expect(status).toMatchObject({ gateReleased: false, stopConfirmed: true });
      expect(status.failure).toBeDefined();
      expect(f.admission.status.active).toBe(0);
    } finally {
      await f.provider.close();
    }
  });

  for (const change of ['replacement', 'in-place', 'directory', 'symlink', 'fifo'])
    test(`sealed upload rejects actual ${change} source changes before native admission`, async () => {
      const f = await fixture();
      try {
        const id = await prepare(f),
          record = await receipt(f.root, id),
          path = join(record.directory, 'asset-0.bin');
        if (change === 'in-place') await writeFile(path, Buffer.alloc(bytes.length, 97));
        else {
          await rename(path, `${path}-approved`);
          if (change === 'replacement') await writeFile(path, bytes, { mode: 0o600 });
          if (change === 'directory') await mkdir(path);
          if (change === 'symlink') await symlink(`${path}-approved`, path);
          if (change === 'fifo') execFileSync('/usr/bin/mkfifo', [path]);
        }
        await expect(f.provider.start({ instanceId: id })).rejects.toBeDefined();
        const status = await completed(f, id);
        expect(status).toMatchObject({ gateReleased: false, stopConfirmed: true });
        expect((await receipt(f.root, id)).value.scopeIntent).toBe(false);
        expect(f.admission.status.active).toBe(0);
      } finally {
        await f.provider.close();
      }
    });

  for (const mode of ['detached', 'detached-exit', 'fail'])
    test(`real ${mode} program stops its entire original scope and retains nonzero failure`, async () => {
      const f = await fixture(mode);
      try {
        const id = await prepare(f);
        await f.provider.start({ instanceId: id });
        if (mode === 'detached') {
          await expect
            .poll(async () => (await f.provider.get({ instanceId: id })).phase)
            .toBe('running');
          const record = await receipt(f.root, id);
          await expect
            .poll(
              async () =>
                (
                  await readFile(
                    join('/sys/fs/cgroup', record.value.scope.cgroup, 'cgroup.procs'),
                    'utf8',
                  )
                )
                  .trim()
                  .split('\n').length,
            )
            .toBeGreaterThan(3);
          await f.provider.stop({ instanceId: id });
        }
        const status = await completed(f, id);
        expect(status).toMatchObject({ gateReleased: true, stopConfirmed: true });
        if (mode === 'fail') expect(status.failure).toBeDefined();
        expect(f.admission.status.active).toBe(0);
      } finally {
        await f.provider.close();
      }
    });

  test('controller loss holds capacity until persisted full-range reconciliation; copied config cannot control source', async () => {
    const f = await fixture('detached');
    try {
      const id = await prepare(f);
      await f.provider.start({ instanceId: id });
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('running');
      const original = await receipt(f.root, id);
      const copy = join(cache, `foreign-${randomUUID()}`);
      await cp(f.root, copy, { recursive: true });
      const foreign = new IsolatedReportProvider({
        ...f.options,
        admission: new ProcessAdmission(1),
        privateRoot: copy,
      });
      await expect(foreign.initialize()).rejects.toMatchObject({ code: 'unavailable' });
      // Read the real birth-bound controller identity; never synthesize payload ancestry.
      process.kill(original.value.scope.controllerPid, 'SIGKILL');
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('unknown');
      expect(f.admission.status.active).toBe(1);
      const groupPath = join('/sys/fs/cgroup', original.value.scope.cgroup, 'cgroup.events');
      try {
        await expect
          .poll(async () =>
            readFile(groupPath, 'utf8').then(
              (s) => /^populated 0$/m.test(s),
              (e) => e.code === 'ENOENT',
            ),
          )
          .toBe(true);
      } catch (error) {
        const members = await readFile(
          join('/sys/fs/cgroup', original.value.scope.cgroup, 'cgroup.procs'),
          'utf8',
        ).catch(String);
        const observations = await Promise.all(
          members
            .trim()
            .split('\n')
            .filter((s) => /^\d+$/.test(s))
            .map(async (pid) => ({
              pid,
              status: await readFile(`/proc/${pid}/status`, 'utf8').catch(String),
              command: await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(String),
            })),
        );
        await writeFile(
          join(f.root, 'controller-loss-first.json'),
          JSON.stringify({ members, observations }, null, 2),
        );
        await f.provider.reconcile();
        throw error;
      }
      // A live object retains the live lease; only durable confirmation resolves it.
      await f.provider.reconcile();
      await completed(f, id);
      expect(f.admission.status.active).toBe(0);
    } finally {
      await f.provider.close();
    }
  });

  test('pre-start directory replacement refuses effects and holds unknown until record identity is restored', async () => {
    const f = await fixture();
    const moved = `${f.root}-retained`;
    try {
      const id = await prepare(f);
      await rename(f.root, moved);
      await mkdir(f.root, { mode: 0o700 });
      await expect(f.provider.start({ instanceId: id })).rejects.toMatchObject({
        code: 'unavailable',
      });
      expect(f.admission.status.active).toBe(1);
      // Keep the replacement as evidence; restore the original inode without overwriting it.
      await rename(f.root, `${f.root}-replacement`);
      await rename(moved, f.root);
      await f.provider.stop({ instanceId: id });
      expect((await completed(f, id)).gateReleased).toBe(false);
    } finally {
      await f.provider.close();
    }
  });

  test('private receipt persistence failure retains capacity and original evidence until a later durable confirmation', async () => {
    const f = await fixture('detached');
    try {
      const id = await prepare(f);
      await f.provider.start({ instanceId: id });
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('running');
      const original = await receipt(f.root, id);
      // An actual filesystem failure, not a successful fake records Adapter.
      await chmod(original.directory, 0o500);
      process.kill(original.value.scope.controllerPid, 'SIGKILL');
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('unknown');
      await expect
        .poll(async () =>
          readFile(
            join('/sys/fs/cgroup', original.value.scope.cgroup, 'cgroup.events'),
            'utf8',
          ).then(
            (s) => /^populated 0$/m.test(s),
            (e) => e.code === 'ENOENT',
          ),
        )
        .toBe(true);
      const stopped = await f.provider.stop({ instanceId: id });
      expect(stopped).toMatchObject({ phase: 'unknown', stopConfirmed: false });
      expect(f.admission.status.active).toBe(1);
      expect(JSON.parse(await readFile(original.path, 'utf8')).status.stopConfirmed).toBe(false);
      await chmod(original.directory, 0o700);
      await f.provider.reconcile();
      await completed(f, id);
      expect(f.admission.status.active).toBe(0);
    } finally {
      await f.provider.close();
    }
  });

  test('real host SIGKILL restores holds before reconciliation and never replays', async () => {
    const root = join(cache, `host-loss-${randomUUID()}`),
      config = join(cache, `host-${randomUUID()}.json`);
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(
      config,
      JSON.stringify({ root, probe: join(cache, 'isolated-report-native', 'probe'), policy }),
      { mode: 0o600 },
    );
    let child: ChildProcess | undefined;
    let recovered: IsolatedReportProvider | undefined;
    const admission = new ProcessAdmission(1, 1),
      id = randomUUID();
    let sequence = 0;
    const requests = new Map<
      number,
      { resolve(value: unknown): void; reject(error: unknown): void }
    >();
    try {
      const host = fork(
        new URL('../fixtures/isolated-report-native/host.mjs', import.meta.url),
        [config],
        { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
      );
      child = host;
      host.stderr?.on('data', async (data: Buffer) => {
        await writeFile(`${config}.stderr`, data, { flag: 'a' });
      });
      await new Promise<void>((resolve, reject) => {
        host.once('error', reject);
        host.once('exit', () => reject(new Error('host exited before ready')));
        host.on(
          'message',
          (message: { ready?: boolean; sequence?: number; result?: unknown; error?: unknown }) => {
            if (message.ready) resolve();
            if (message.sequence !== undefined) {
              const request = requests.get(message.sequence);
              requests.delete(message.sequence);
              if (message.error) request?.reject(message.error);
              else request?.resolve(message.result);
            }
          },
        );
      });
      const call = (method: keyof IsolationInputs, input: IsolationInputs[keyof IsolationInputs]) =>
        new Promise<IsolationStatus>((resolve, reject) => {
          const key = ++sequence;
          requests.set(key, { resolve: (value) => resolve(value as IsolationStatus), reject });
          host.send({ sequence: key, method, input });
        });
      await call('platform.reportIsolation.stage', stageInput(id));
      await expect
        .poll(async () => (await call('platform.reportIsolation.get', { instanceId: id })).phase)
        .toBe('preparing');
      await call('platform.reportIsolation.put', {
        instanceId: id,
        path: 'report.txt',
        offset: 0,
        base64: bytes.toString('base64'),
      });
      await call('platform.reportIsolation.start', { instanceId: id });
      await expect
        .poll(async () => (await call('platform.reportIsolation.get', { instanceId: id })).phase)
        .toBe('running');
      const original = await receipt(root, id),
        group = join('/sys/fs/cgroup', original.value.scope.cgroup);
      const members = (await readFile(join(group, 'cgroup.procs'), 'utf8')).trim().split('\n');
      const births = await Promise.all(
        members.map(async (pid) => ({ pid, stat: await readFile(`/proc/${pid}/stat`, 'utf8') })),
      );
      await writeFile(`${config}.members-before-loss.json`, JSON.stringify(births));
      const exited = new Promise<void>((resolve) => host.once('exit', () => resolve()));
      host.kill('SIGKILL');
      await exited;
      await expect
        .poll(async () =>
          readFile(join(group, 'cgroup.events'), 'utf8').then(
            (s) => /^populated 0$/m.test(s),
            (e) => e.code === 'ENOENT',
          ),
        )
        .toBe(true);
      for (const member of births) {
        const current = await readFile(`/proc/${member.pid}/stat`, 'utf8').catch(() => '');
        expect(
          current === '' ||
            current.slice(current.lastIndexOf(')') + 2).split(' ')[19] !==
              member.stat.slice(member.stat.lastIndexOf(')') + 2).split(' ')[19],
        ).toBe(true);
      }
      const options = {
        admission,
        privateRoot: root,
        programs: [
          {
            id: 'probe',
            version: '1',
            policyId: policy.id,
            image: await readFile(join(cache, 'isolated-report-native', 'probe')),
            args: ['detached'],
          },
        ],
        policies: [policy],
        authorize: async () => {},
      };
      await writeFile(`${config}.receipt-before-restart.json`, JSON.stringify(original.value));
      recovered = new IsolatedReportProvider(options);
      await chmod(original.directory, 0o500);
      await recovered.initialize();
      expect(await recovered.get({ instanceId: id })).toMatchObject({
        phase: 'unknown',
        stopConfirmed: false,
      });
      expect(admission.status.active).toBe(1);
      expect(() => admission.reserve()).toThrow(expect.objectContaining({ code: 'resourceLimit' }));
      await chmod(original.directory, 0o700);
      await recovered.reconcile();
      expect(await recovered.get({ instanceId: id })).toMatchObject({
        phase: 'stopped',
        stopConfirmed: true,
        gateReleased: true,
      });
      expect(admission.status.active).toBe(0);
      expect((await receipt(root, id)).value.unit).toBe(original.value.unit);
      const duplicate = new IsolatedReportProvider({
        ...options,
        admission: new ProcessAdmission(1),
      });
      await expect(duplicate.initialize()).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await recovered?.close();
      // Config and all range evidence stay in this test's cache root.
    }
  });

  test('native recovery Adapter refuses wrong identity before signaling the actual unrelated live scope', async () => {
    const f = await fixture('detached');
    try {
      const id = await prepare(f);
      await f.provider.start({ instanceId: id });
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('running');
      const original = (await receipt(f.root, id)).value;
      for (const key of ['invocationId', 'ino'] as const) {
        const wrong = structuredClone(original);
        wrong.scope[key] =
          key === 'invocationId' ? '0'.repeat(32) : String(BigInt(wrong.scope.ino) + 1n);
        await expect(stopRecoveredIsolation(wrong)).rejects.toMatchObject({
          code: 'outcomeUnknown',
        });
        expect((await f.provider.get({ instanceId: id })).phase).toBe('running');
        expect(
          await readFile(join('/sys/fs/cgroup', original.scope.cgroup, 'cgroup.events'), 'utf8'),
        ).toMatch(/^populated 1$/m);
      }
      await stopRecoveredIsolation(original);
      await expect
        .poll(async () => (await f.provider.get({ instanceId: id })).phase)
        .toBe('unknown');
      expect(f.admission.status.active).toBe(1);
      await f.provider.reconcile();
      await completed(f, id);
      expect(f.admission.status.active).toBe(0);
    } finally {
      await f.provider.close();
    }
  });

  test('cancelling at the actual waiting gate never reports an exec event or releases before durable stop', async () => {
    const f = await fixture();
    await f.provider.close();
    let release = () => {},
      atGate = false;
    const authorization = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider = new IsolatedReportProvider({
      ...f.options,
      authorize: async (id) => {
        const current = await receipt(f.root, id).catch(() => undefined);
        if (current?.value.scope && !current.value.launchIntent) {
          atGate = true;
          await authorization;
          throw new OperationError('permissionDenied', 'test domain revoked at gate');
        }
      },
    });
    await provider.initialize();
    try {
      const broker = new Broker<typeof isolationOperations, IsolationInputs, IsolationOutputs>(
        isolationOperations,
      );
      broker.register('isolated-provider', provider.port());
      const client = broker.consumer(
        {
          moduleId: 'trusted-adapter',
          principal: { kind: 'system', id: 'test-host' },
          role: 'host',
        },
        Object.keys(isolationOperations) as (keyof typeof isolationOperations)[],
      );
      const id = await prepare({ ...f, provider, broker, client });
      await provider.start({ instanceId: id });
      await expect.poll(() => atGate).toBe(true);
      const original = await receipt(f.root, id);
      expect(original.value.launchIntent).toBe(false);
      const pendingStop = provider.stop({ instanceId: id });
      const group = join('/sys/fs/cgroup', original.value.scope.cgroup, 'cgroup.events');
      await expect
        .poll(async () =>
          readFile(group, 'utf8').then(
            (s) => /^populated 0$/m.test(s),
            (e) => e.code === 'ENOENT',
          ),
        )
        .toBe(true);
      expect(f.admission.status.active).toBe(1);
      release();
      const status = await pendingStop;
      expect(status).toMatchObject({ phase: 'stopped', gateReleased: false, stopConfirmed: true });
      expect((await receipt(f.root, id)).value.launchIntent).toBe(false);
      expect(f.admission.status.active).toBe(0);
    } finally {
      release();
      await provider.close();
    }
  });
});
