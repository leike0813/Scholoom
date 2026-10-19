import { expect, test } from '@playwright/test';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';

test('duplex RPC permits reverse calls while the initiating request waits', async () => {
  let a: RpcPeer;
  let b: RpcPeer;
  a = new RpcPeer(
    {
      send: (frame) => {
        queueMicrotask(() => b.receive(frame));
      },
    },
    { request: () => 21 },
  );
  b = new RpcPeer(
    {
      send: (frame) => {
        queueMicrotask(() => a.receive(frame));
      },
    },
    {
      request: async () => Number(await b.request('reverse', {}, { waitMs: 1000 })) * 2,
    },
  );
  try {
    expect(await a.request('forward', {}, { waitMs: 1000 })).toBe(42);
  } finally {
    a.close();
    b.close();
  }
});

test('capacity reserves control and connection loss retains unknown write outcomes', async () => {
  const peer = new RpcPeer({ send: () => {} }, { limits: { inFlight: 1, control: 1 } });
  const first = peer
    .request('write', {}, { waitMs: 1000, lossCode: 'outcomeUnknown' })
    .catch((error: unknown) => error);
  await expect(peer.request('overflow', {}, { waitMs: 1000 })).rejects.toMatchObject({
    code: 'resourceLimit',
  });
  const control = peer
    .request('health', {}, { waitMs: 1000, control: true })
    .catch((error: unknown) => error);
  peer.close();
  expect(await first).toMatchObject({ code: 'outcomeUnknown' });
  expect(await control).toMatchObject({ code: 'unavailable' });
});

test('invalid frame closes waits and timeout does not replay operations', async () => {
  let frames = 0;
  const peer = new RpcPeer({
    send: () => {
      frames++;
    },
  });
  await expect(
    peer.request('write', {}, { waitMs: 10, lossCode: 'outcomeUnknown' }),
  ).rejects.toMatchObject({ code: 'outcomeUnknown' });
  expect(frames).toBe(1);
  const pending = peer.request('read', {}, { waitMs: 1000 });
  peer.receive('{');
  await expect(pending).rejects.toMatchObject({ code: 'protocolIncompatible' });
});

test('slow transport bounds normal backlog and delivers reserved control before queued data', async () => {
  const sent: string[] = [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const peer = new RpcPeer(
    {
      send: async (frame) => {
        sent.push(JSON.parse(frame).method);
        if (sent.length === 1) await blocked;
      },
    },
    { limits: { queued: 1, control: 1 } },
  );
  try {
    const first = peer.notify('first', {});
    const queued = peer.notify('queued', {});
    await expect(peer.notify('overflow', {})).rejects.toMatchObject({ code: 'resourceLimit' });
    const control = peer.notify('stop', {}, true);
    release();
    await Promise.all([first, queued, control]);
    expect(sent).toEqual(['first', 'stop', 'queued']);
    await expect(peer.notify('large', { body: 'x'.repeat(2 * 1024 * 1024) })).rejects.toMatchObject(
      { code: 'tooLarge' },
    );
  } finally {
    release();
    peer.close();
  }
});

test('incoming overflow on a blocked response queue closes locally without an unhandled rejection', async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const peer = new RpcPeer(
    { send: () => blocked },
    { limits: { incoming: 0, queued: 0, control: 1 } },
  );
  try {
    for (let id = 0; id < 5; id++)
      peer.receive(JSON.stringify({ jsonrpc: '2.0', id, method: 'overload', params: {} }));
    await expect
      .poll(async () => peer.request('probe', {}, { waitMs: 10 }).catch((error) => error.code))
      .toBe('unavailable');
  } finally {
    release();
    peer.close();
  }
});
