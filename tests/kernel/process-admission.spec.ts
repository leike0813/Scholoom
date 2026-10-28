import { expect, test } from '@playwright/test';
import { ProcessAdmission } from '../../packages/platform/dist/node.js';

test('parent and child count separately, child exhaustion refuses immediately and ordinary waiting is bounded', async () => {
  const admission = new ProcessAdmission(2, 1);
  const parent = admission.reserve();
  const child = admission.reserve();
  await Promise.all([parent.ready, child.ready]);
  expect(() => admission.reserve()).toThrow(expect.objectContaining({ code: 'resourceLimit' }));
  const queued = admission.reserve(true);
  expect(() => admission.reserve(true)).toThrow(expect.objectContaining({ code: 'resourceLimit' }));
  expect(admission.status).toMatchObject({ active: 2, waiting: 1 });
  child.release();
  await queued.ready;
  expect(admission.status).toMatchObject({ active: 2, waiting: 0 });
  child.release();
  parent.release();
  queued.release();
  expect(admission.status).toMatchObject({ active: 0, waiting: 0 });
});

test('cancelling a reservation removes it without taking the next available slot', async () => {
  const admission = new ProcessAdmission(1, 2);
  const active = admission.reserve();
  const cancelled = admission.reserve(true);
  const next = admission.reserve(true);
  cancelled.release();
  await expect(cancelled.ready).rejects.toMatchObject({ code: 'shuttingDown' });
  active.release();
  await next.ready;
  next.release();
  expect(admission.status).toMatchObject({ active: 0, waiting: 0 });
});

test('capacity waiting has a deadline and does not consume a later freed process slot', async () => {
  const admission = new ProcessAdmission(1, 1, 10);
  const active = admission.reserve();
  const waiting = admission.reserve(true);
  await expect(waiting.ready).rejects.toMatchObject({ code: 'resourceLimit' });
  expect(admission.status).toMatchObject({ active: 1, waiting: 0 });
  active.release();
  const next = admission.reserve();
  await next.ready;
  next.release();
});

for (const confirmed of [true, false]) {
  test(`release waits for owned process stop confirmation (confirmed=${confirmed})`, async () => {
    const admission = new ProcessAdmission(1, 1);
    const active = admission.reserve();
    let stopped = () => {};
    let uncertain = (_error: Error) => {};
    active.retainUntil(
      new Promise<void>((resolve, reject) => {
        stopped = resolve;
        uncertain = reject;
      }),
    );
    active.release();
    expect(admission.status.active).toBe(1);
    if (confirmed) stopped();
    else uncertain(new Error('lost controller'));
    await expect.poll(() => admission.status.active).toBe(confirmed ? 0 : 1);
    if (!confirmed)
      expect(() => admission.reserve()).toThrow(expect.objectContaining({ code: 'resourceLimit' }));
  });
}

test('recovered slots survive full capacity and rejected confirmation, then wake waiting reservations in FIFO order', async () => {
  const admission = new ProcessAdmission(1, 2);
  const live = admission.reserve();
  await live.ready;
  admission.retainUnknown('first');
  admission.retainUnknown('first');
  admission.retainUnknown('second');
  expect(admission.status.active).toBe(3);
  expect(() => admission.reserve()).toThrow(expect.objectContaining({ code: 'resourceLimit' }));

  const uncertain = Promise.reject<void>(new Error('stop remains unknown'));
  admission.settleRecovered('first', uncertain);
  await uncertain.catch(() => {});
  expect(admission.status.active).toBe(3);
  live.release();
  const first = admission.reserve(true);
  const second = admission.reserve(true);

  admission.settleRecovered('first', Promise.resolve());
  await Promise.resolve();
  expect(admission.status).toMatchObject({ active: 1, waiting: 2 });
  expect(() => admission.reserve()).toThrow(expect.objectContaining({ code: 'resourceLimit' }));

  const stopped = Promise.resolve();
  admission.settleRecovered('second', stopped);
  admission.settleRecovered('second', stopped);
  admission.retainUnknown('second');
  await first.ready;
  expect(admission.status).toMatchObject({ active: 1, waiting: 1 });
  first.release();
  await second.ready;
  second.release();
  expect(admission.status).toMatchObject({ active: 0, waiting: 0 });
});

test('settlement rejects empty, unknown and live owner identities without releasing their reservation', async () => {
  const admission = new ProcessAdmission(1, 1);
  const live = admission.reserve(false, 'live');
  await live.ready;
  admission.retainUnknown('live');
  admission.retainUnknown('live');
  for (const instanceId of ['', 'unknown', 'live'])
    expect(() => admission.settleRecovered(instanceId, Promise.resolve())).toThrow(
      expect.objectContaining({ code: 'invalidRequest' }),
    );
  expect(() => admission.reserve(false, 'live')).toThrow(
    expect.objectContaining({ code: 'invalidRequest' }),
  );
  expect(admission.status.active).toBe(1);
  live.release();
  expect(admission.status.active).toBe(0);
});

for (const replacement of ['recovered', 'live']) {
  test(`late duplicate confirmation cannot release a new ${replacement} slot with the same identity`, async () => {
    const admission = new ProcessAdmission(1, 1);
    admission.retainUnknown('instance');
    let confirmLate = () => {};
    const late = new Promise<void>((resolve) => {
      confirmLate = resolve;
    });
    admission.settleRecovered('instance', late);
    const stopped = Promise.resolve();
    admission.settleRecovered('instance', stopped);
    await stopped;
    expect(admission.status.active).toBe(0);

    if (replacement === 'recovered') admission.retainUnknown('instance');
    const live = replacement === 'live' ? admission.reserve(false, 'instance') : undefined;
    admission.retainUnknown('instance');
    confirmLate();
    await late;
    expect(admission.status.active).toBe(1);
    expect(() => admission.reserve(false, 'instance')).toThrow(
      expect.objectContaining({ code: 'invalidRequest' }),
    );
    expect(() => admission.reserve()).toThrow(expect.objectContaining({ code: 'resourceLimit' }));

    if (live) live.release();
    else {
      admission.settleRecovered('instance', Promise.resolve());
      await Promise.resolve();
    }
    expect(admission.status.active).toBe(0);
  });
}
