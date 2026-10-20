import { expect, test } from '@playwright/test';
import { createStatusBarService } from '../../apps/desktop/src/renderer/src/workbench/statusbar.js';

test('registers isolated entries in stable alignment and priority order', () => {
  const service = createStatusBarService();
  const left = { id: 'same', text: 'left', priority: 1 };
  service.registerItem('a', left);
  service.registerItem('b', { id: 'same', text: 'higher', priority: 3 });
  service.registerItem('a|b', { id: 'c', text: 'pair' });
  service.registerItem('a', { id: 'b|c', text: 'distinct tuple' });
  service.registerItem('a:b', { id: 'c', text: 'colon owner' });
  service.registerItem('a', { id: 'b:c', text: 'colon id' });
  service.registerItem('a', { id: 'right', text: 'right', alignment: 'right' });

  expect(service.getSnapshot().map(({ owner, id }) => [owner, id])).toEqual([
    ['b', 'same'],
    ['a', 'same'],
    ['a', 'b:c'],
    ['a', 'b|c'],
    ['a:b', 'c'],
    ['a|b', 'c'],
    ['a', 'right'],
  ]);
  expect(() => service.registerItem('a', { id: 'same', text: 'duplicate' })).toThrow();
  expect(left.text).toBe('left');
  expect(Object.isFrozen(service.getSnapshot())).toBe(true);
  expect(Object.isFrozen(service.getSnapshot()[0])).toBe(true);
  service.dispose();
});

test('publishes only visible data changes and keeps actions current', () => {
  const service = createStatusBarService();
  let notifications = 0;
  service.subscribe(() => {
    notifications += 1;
  });
  let invoked = '';
  const handle = service.registerItem('owner', { id: 'item', text: 'Ready' }, () => {
    invoked = 'old';
  });
  const initial = service.getSnapshot();
  expect(notifications).toBe(1);

  handle.update({ text: 'Ready' });
  handle.show();
  expect(service.getSnapshot()).toBe(initial);
  expect(notifications).toBe(1);

  handle.update({}, () => {
    invoked = 'new';
  });
  expect(service.getSnapshot()).toBe(initial);
  expect(notifications).toBe(1);
  service.activate('owner', 'item');
  expect(invoked).toBe('new');

  handle.update({ icon: 'info' });
  expect(notifications).toBe(2);
  handle.hide();
  const hidden = service.getSnapshot();
  handle.update({ icon: undefined, text: 'Changed while hidden' });
  expect(service.getSnapshot()).toBe(hidden);
  expect(notifications).toBe(3);
  handle.show();
  expect(service.getSnapshot()[0]).toMatchObject({
    text: 'Changed while hidden',
    actionable: true,
  });
  expect(notifications).toBe(4);

  handle.update({}, null);
  expect(service.getSnapshot()[0]?.actionable).toBe(false);
  expect(notifications).toBe(5);
  handle.dispose();
  service.dispose();
});

test('owner and service disposal invalidate stale handles and actions', () => {
  const service = createStatusBarService();
  let calls = 0;
  const stale = service.registerItem('owner', { id: 'item', text: 'old' }, () => {
    calls += 1;
  });
  let notifications = 0;
  service.subscribe(() => {
    notifications += 1;
  });
  service.disposeOwner('owner');
  expect(notifications).toBe(1);

  const current = service.registerItem('owner', { id: 'item', text: 'new' });
  const currentSnapshot = service.getSnapshot();
  stale.update({ text: 'stale' });
  stale.show();
  stale.hide();
  stale.dispose();
  service.activate('owner', 'item');
  expect(service.getSnapshot()).toBe(currentSnapshot);
  expect(service.getSnapshot()[0]?.text).toBe('new');
  expect(calls).toBe(0);

  service.dispose();
  expect(service.getSnapshot()).toEqual([]);
  expect(notifications).toBe(3);
  current.update({ text: 'after disposal' });
  current.show();
  service.activate('owner', 'item');
  expect(() => service.registerItem('owner', { id: 'later', text: 'later' })).toThrow();
  expect(notifications).toBe(3);
});

test('removes hidden owner entries without duplicate notifications', () => {
  const service = createStatusBarService();
  let notifications = 0;
  service.subscribe(() => {
    notifications += 1;
  });
  const hidden = service.registerItem('owner', { id: 'hidden', text: 'hidden' });
  hidden.hide();
  const beforeCleanup = notifications;
  service.disposeOwner('owner');
  service.disposeOwner('owner');
  expect(notifications).toBe(beforeCleanup);
  expect(service.getSnapshot()).toEqual([]);
  expect(() => service.registerItem('owner', { id: 'hidden', text: 'fresh' })).not.toThrow();
  service.dispose();
});

test('workbench instances keep identical contribution identities independent', () => {
  const first = createStatusBarService();
  const second = createStatusBarService();
  first.registerItem('component', { id: 'status', text: 'first' });
  second.registerItem('component', { id: 'status', text: 'second' });
  first.dispose();
  expect(second.getSnapshot().map((item) => item.text)).toEqual(['second']);
  second.dispose();
});
