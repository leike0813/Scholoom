import { expect, test } from '@playwright/test';
import {
  type SystemReportBinding,
  SystemReportManager,
  type SystemReportManagerHost,
} from '../../packages/platform/dist/system-report-manager.js';
import { OperationError } from '../../packages/protocol/dist/core.js';
import type {
  ReportManagerGate,
  ReportManagerObservation,
  ReportManagerRelease,
  ReportManagerStart,
  ReportManagerStop,
} from '../../packages/protocol/dist/platform-isolation.js';

const configId = '11111111-2222-4333-8444-555555555555';
const storageId = '66666666-7777-4888-9999-aaaaaaaaaaaa';

test.skip(process.geteuid?.() === 0, 'Ordinary UID; no root authority is simulated.');

function startInput(): ReportManagerStart {
  return {
    configId,
    storageId,
    programId: 'fixed',
    programVersion: 'program-3',
    policyId: 'fixed',
    policyVersion: 'policy-2',
    assets: 2,
    inputs: {
      bootId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      manifest: '31:712:500:100:100',
      permit: { dev: '32', ino: '32001' },
      events: { dev: '32', ino: '32002' },
      stdout: { dev: '32', ino: '32003' },
      stderr: { dev: '32', ino: '32004' },
    },
  };
}

function observation(): ReportManagerObservation {
  return {
    scope: {
      bootId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
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
}

function gateInput(): ReportManagerGate {
  return {
    configId,
    storageId,
    scope: {
      bootId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      invocationId: '0123456789abcdef0123456789abcdef',
      dev: '31',
      ino: '31001',
    },
    permit: { dev: '32', ino: '32001' },
  };
}

function stopInput(): ReportManagerStop {
  const { permit: _permit, ...input } = gateInput();
  return input;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function barrier() {
  const entered = deferred();
  const released = deferred();
  return {
    entered: entered.promise,
    release: released.resolve,
    async wait() {
      entered.resolve();
      await released.promise;
    },
  };
}

function fixture() {
  const state = {
    starts: [] as { input: ReportManagerStart; signal: AbortSignal }[],
    verifies: [] as { input: ReportManagerStart; observation: ReportManagerObservation }[],
    commands: [] as ('P' | 'G')[],
    closes: 0,
    stops: [] as ReportManagerStop[],
    recoveries: [] as ReportManagerStart[],
    releases: [] as ReportManagerRelease[],
  };
  const closed = deferred();
  // All host methods are OS substitutes. Observations/identities are synthetic, not root evidence.
  const binding: SystemReportBinding = {
    observation: observation(),
    async send(command) {
      state.commands.push(command);
    },
    async close() {
      state.closes++;
      closed.resolve();
    },
  };
  const host: SystemReportManagerHost = {
    async start(input, signal) {
      state.starts.push({ input, signal });
      return binding;
    },
    async verify(input, observed) {
      state.verifies.push({ input, observation: observed });
    },
    async stop(input) {
      state.stops.push(input);
    },
    async recover(input) {
      state.recoveries.push(input);
    },
    async release(input) {
      state.releases.push(input);
    },
  };
  const manager = new SystemReportManager({ configId, host });
  return { manager, host, binding, state, closed: closed.promise };
}

test('validates same-source requests and current config before any OS host effect', async () => {
  const f = fixture();
  try {
    const { bootId: _bootId, ...withoutBoot } = startInput().inputs;
    for (const [method, input] of [
      ['reportManager.unknown', startInput()],
      ['toString', startInput()],
      ['reportManager.start', { ...startInput(), configId: storageId }],
      ['reportManager.start', { ...startInput(), inputs: withoutBoot }],
      ['reportManager.start', { ...startInput(), assets: 0 }],
      ['reportManager.start', { ...startInput(), argv: ['/bin/sh', '-c', 'true'] }],
      ['reportManager.start', { ...startInput(), path: '/arbitrary/program' }],
    ] as const)
      await expect(f.manager.request(method, input)).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    expect(f.state).toEqual({
      starts: [],
      verifies: [],
      commands: [],
      closes: 0,
      stops: [],
      recoveries: [],
      releases: [],
    });
    // Exercise the real unprivileged guard; the host substitute cannot make ping privileged.
    await expect(f.manager.request('reportManager.ping', { configId })).rejects.toMatchObject({
      code: 'unavailable',
    });
  } finally {
    await f.manager.disconnect();
  }
});

test('reserves storage before awaiting start and retains the reservation after a failed start', async () => {
  const f = fixture();
  const held = barrier();
  const failure = new OperationError('outcomeUnknown', 'Synthetic OS start uncertainty.');
  const original = f.host.start;
  f.host.start = async (...args) => {
    await original(...args);
    await held.wait();
    throw failure;
  };
  const input = startInput();
  const expected = structuredClone(input);
  const pending = expect(f.manager.request('reportManager.start', input)).rejects.toBe(failure);
  try {
    await held.entered;
    input.inputs.permit.ino = '99999';
    expect(f.state.starts[0]?.input).toEqual(expected);
    await expect(f.manager.request('reportManager.start', startInput())).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    expect(f.state.starts).toHaveLength(1);
    held.release();
    await pending;
    await expect(f.manager.request('reportManager.start', startInput())).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    expect(f.state.starts).toHaveLength(1);
    expect(f.state.commands).toEqual([]);
  } finally {
    held.release();
    await pending;
    await f.manager.disconnect();
  }
});

test('arm precedes permit and concurrent duplicate verification sends P and G at most once each', async () => {
  const f = fixture();
  try {
    expect(await f.manager.request('reportManager.start', startInput())).toEqual(observation());
    await expect(f.manager.request('reportManager.permit', gateInput())).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    for (const field of ['scope', 'permit'] as const) {
      const gate = gateInput();
      gate[field].ino = '99999';
      await expect(f.manager.request('reportManager.arm', gate)).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    }
    expect(f.state.verifies).toEqual([]);
    for (const [method, result] of [
      ['reportManager.arm', { armed: true }],
      ['reportManager.permit', { released: true }],
    ] as const) {
      const held = barrier();
      const bothEntered = deferred();
      let verifies = 0;
      f.host.verify = async (input, observed) => {
        expect(input).toEqual(startInput());
        expect(observed).toEqual(observation());
        if (++verifies === 2) bothEntered.resolve();
        await held.wait();
      };
      const before = [...f.state.commands];
      const pending = Promise.allSettled([
        f.manager.request(method, gateInput()),
        f.manager.request(method, gateInput()),
      ]);
      try {
        await bothEntered.promise;
        expect(f.state.commands).toEqual(before);
      } finally {
        held.release();
      }
      const settled = await pending;
      expect(settled.filter((r) => r.status === 'fulfilled')).toEqual([
        { status: 'fulfilled', value: result },
      ]);
      expect(settled.filter((r) => r.status === 'rejected')).toHaveLength(1);
      await expect(f.manager.request(method, gateInput())).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    }
    expect(f.state.commands).toEqual(['P', 'G']);
  } finally {
    await f.manager.disconnect();
  }
});

test('stop and recover abort and close a writer during verify, preventing late P or G', async () => {
  for (const cancel of ['reportManager.stop', 'reportManager.recover'] as const) {
    for (const method of ['reportManager.arm', 'reportManager.permit'] as const) {
      const f = fixture();
      const held = barrier();
      let pending: Promise<void> | undefined;
      try {
        await f.manager.request('reportManager.start', startInput());
        if (method === 'reportManager.permit')
          await f.manager.request('reportManager.arm', gateInput());
        f.host.verify = async () => held.wait();
        const before = [...f.state.commands];
        pending = expect(f.manager.request(method, gateInput())).rejects.toMatchObject({
          code: 'outcomeUnknown',
        });
        await held.entered;
        expect(
          await f.manager.request(
            cancel,
            cancel === 'reportManager.stop' ? stopInput() : startInput(),
          ),
        ).toEqual({ scopeEmpty: true });
        expect(f.state.starts[0]?.signal.aborted).toBe(true);
        expect(f.state.closes).toBeGreaterThan(0);
        expect(f.state.commands).toEqual(before);
        if (cancel === 'reportManager.stop') expect(f.state.stops).toEqual([stopInput()]);
        else expect(f.state.recoveries).toEqual([startInput()]);
        held.release();
        await pending;
        expect(f.state.commands).toEqual(before);
        await expect(f.manager.request(method, gateInput())).rejects.toMatchObject({
          code: 'invalidRequest',
        });
      } finally {
        held.release();
        await pending;
        await f.manager.disconnect();
      }
    }
  }
});

test('disconnect closes and aborts before waiting for verify, then stops only the original scope', async () => {
  for (const method of ['reportManager.arm', 'reportManager.permit'] as const) {
    const f = fixture();
    const held = barrier();
    let pending: Promise<void> | undefined;
    let disconnect: Promise<void> | undefined;
    try {
      await f.manager.request('reportManager.start', startInput());
      if (method === 'reportManager.permit')
        await f.manager.request('reportManager.arm', gateInput());
      const before = [...f.state.commands];
      f.host.verify = async () => held.wait();
      pending = expect(f.manager.request(method, gateInput())).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
      await held.entered;
      disconnect = f.manager.disconnect();
      expect(f.state.starts[0]?.signal.aborted).toBe(true);
      await f.closed;
      expect(f.state.stops).toEqual([]);
      expect(f.state.commands).toEqual(before);
      await expect(f.manager.request('reportManager.start', startInput())).rejects.toMatchObject({
        code: 'invalidRequest',
      });
      held.release();
      await pending;
      await disconnect;
      expect(f.state.commands).toEqual(before);
      expect(f.state.stops).toEqual([stopInput()]);
    } finally {
      held.release();
      await pending;
      if (disconnect) await disconnect;
      else await f.manager.disconnect();
    }
  }
});

test('disconnect aborts an in-flight start and closes its late binding before stopping its fixed scope', async () => {
  const f = fixture();
  const held = barrier();
  const start = f.host.start;
  f.host.start = async (...args) => {
    const binding = await start(...args);
    await held.wait();
    return binding;
  };
  const pending = expect(
    f.manager.request('reportManager.start', startInput()),
  ).rejects.toMatchObject({ code: 'outcomeUnknown' });
  let disconnect: Promise<void> | undefined;
  try {
    await held.entered;
    disconnect = f.manager.disconnect();
    expect(f.state.starts[0]?.signal.aborted).toBe(true);
    expect(f.state.stops).toEqual([]);
    held.release();
    await pending;
    await disconnect;
    expect(f.state.closes).toBeGreaterThan(0);
    expect(f.state.commands).toEqual([]);
    expect(f.state.stops).toEqual([stopInput()]);
  } finally {
    held.release();
    await pending;
    if (disconnect) await disconnect;
    else await f.manager.disconnect();
  }
});

test('an unknown permit acknowledgement closes the producer and never retries G', async () => {
  const f = fixture();
  const unknown = new OperationError(
    'outcomeUnknown',
    'Synthetic acknowledgement loss after write.',
  );
  try {
    await f.manager.request('reportManager.start', startInput());
    await f.manager.request('reportManager.arm', gateInput());
    const send = f.binding.send;
    f.binding.send = async (command) => {
      await send(command);
      throw unknown;
    };
    await expect(f.manager.request('reportManager.permit', gateInput())).rejects.toBe(unknown);
    expect(f.state.starts[0]?.signal.aborted).toBe(true);
    expect(f.state.closes).toBeGreaterThan(0);
    for (const method of ['reportManager.permit', 'reportManager.arm', 'reportManager.start'])
      await expect(
        f.manager.request(method, method === 'reportManager.start' ? startInput() : gateInput()),
      ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(f.state.commands).toEqual(['P', 'G']);
  } finally {
    await f.manager.disconnect();
  }
});

test('release requires a stopping original scope and returns no invented durable stopped receipt', async () => {
  const f = fixture();
  const release = { ...startInput(), scope: stopInput().scope };
  try {
    await f.manager.request('reportManager.start', startInput());
    await expect(f.manager.request('reportManager.release', release)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    expect(f.state.releases).toEqual([]);
    expect(await f.manager.request('reportManager.stop', stopInput())).toEqual({
      scopeEmpty: true,
    });
    await expect(
      f.manager.request('reportManager.release', {
        ...release,
        scope: { ...release.scope, ino: '99999' },
      }),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(f.state.releases).toEqual([]);
    expect(await f.manager.request('reportManager.release', release)).toEqual({});
    expect(f.state.releases).toEqual([release]);
    await expect(f.manager.request('reportManager.release', release)).rejects.toMatchObject({
      code: 'invalidRequest',
    });
    expect(f.state.releases).toEqual([release]);
  } finally {
    await test.info().attach('release-host-calls', {
      body: JSON.stringify(f.state.releases),
      contentType: 'application/json',
    });
    await f.manager.disconnect();
  }
});

test('reconnect recovery preserves the original scope and binds later cleanup to the same sealed inputs', async () => {
  const f = fixture(),
    input = { ...startInput(), scope: stopInput().scope };
  try {
    await f.manager.request('reportManager.recover', input);
    expect(f.state.recoveries).toEqual([input]);
    const changed = { ...input, inputs: { ...input.inputs, manifest: '31:713:500:100:100' } };
    for (const method of ['reportManager.recover', 'reportManager.release'])
      await expect(f.manager.request(method, changed)).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    expect(f.state.recoveries).toEqual([input]);
    expect(f.state.releases).toEqual([]);
    await f.manager.request('reportManager.release', input);
    expect(f.state.releases).toEqual([input]);
    expect(f.state.commands).toEqual([]);
  } finally {
    await f.manager.disconnect();
  }
});

test('concurrent cleanup cannot reopen recovery or issue duplicate OS removal', async () => {
  const f = fixture(),
    input = { ...startInput(), scope: stopInput().scope },
    hold = barrier();
  await f.manager.request('reportManager.start', startInput());
  await f.manager.request('reportManager.stop', stopInput());
  const release = f.host.release;
  f.host.release = async (input) => {
    await release(input);
    await hold.wait();
  };
  const pending = f.manager.request('reportManager.release', input);
  try {
    await hold.entered;
    for (const method of ['reportManager.release', 'reportManager.recover'])
      await expect(f.manager.request(method, input)).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    expect(f.state.releases).toEqual([input]);
  } finally {
    hold.release();
    await pending;
    await f.manager.disconnect();
  }
});

test('recovery waits for the aborted original start to settle before confirming any empty scope', async () => {
  const f = fixture(),
    hold = barrier(),
    start = f.host.start;
  f.host.start = async (input, signal) => {
    const result = await start(input, signal);
    await hold.wait();
    return result;
  };
  const starting = f.manager.request('reportManager.start', startInput()).catch((error) => error);
  let recovering: Promise<unknown> | undefined;
  try {
    await hold.entered;
    recovering = f.manager.request('reportManager.recover', startInput());
    expect(f.state.starts[0]?.signal.aborted).toBe(true);
    expect(f.state.recoveries).toEqual([]);
    for (const method of ['reportManager.recover', 'reportManager.release'])
      await expect(f.manager.request(method, startInput())).rejects.toMatchObject({
        code: 'invalidRequest',
      });
    expect(f.state.releases).toEqual([]);
    hold.release();
    expect(await starting).toMatchObject({ code: 'outcomeUnknown' });
    expect(await recovering).toEqual({ scopeEmpty: true });
    expect(f.state.closes).toBeGreaterThan(0);
    expect(f.state.recoveries).toEqual([startInput()]);
    expect(f.state.commands).toEqual([]);
  } finally {
    hold.release();
    await starting;
    await recovering;
    await f.manager.disconnect();
  }
});
