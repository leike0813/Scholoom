import { expect, test } from '@playwright/test';
import { Broker, eventChannel } from '../../packages/broker/dist/index.js';
import { isBusinessCall } from '../../packages/protocol/dist/business.js';
import type {
  CallContext,
  ContractParams,
  ContractResult,
} from '../../packages/protocol/dist/core.js';

const contract = {
  read: {
    params: { type: 'object', additionalProperties: false },
    result: { type: 'number' },
    semantics: { effect: 'read', returns: 'result', waitMs: 1000 },
  },
  write: {
    params: { type: 'object' },
    result: { type: 'number' },
    semantics: { effect: 'write', returns: 'result', waitMs: 1000 },
  },
} as const;
const context: CallContext = {
  moduleId: 'reader',
  role: 'product',
  principal: { kind: 'human', id: 'user' },
};
type Inputs = {
  read: ContractParams<typeof contract.read>;
  write: ContractParams<typeof contract.write>;
};
type Outputs = {
  read: ContractResult<typeof contract.read>;
  write: ContractResult<typeof contract.write>;
};
declare const typedBroker: Broker<typeof contract, Inputs, Outputs>;
type ReadPort = ReturnType<typeof typedBroker.consumer<'read'>>;
test('broker validates providers, permissions and outcomes without losing write uncertainty', async () => {
  expect(isBusinessCall(['project.open', { path: '/sample' }])).toBe(true);
  expect(isBusinessCall(['project.open', { model: 'sample', effort: 'medium' }])).toBe(false);
  expect(isBusinessCall(['undeclared.operation', {}])).toBe(false);
  const broker = new Broker<typeof contract, Inputs, Outputs>(contract);
  const reader = broker.consumer(context, ['read']);
  await expect(reader.call('read', {})).rejects.toMatchObject({ code: 'unavailable' });
  // @ts-expect-error Consumer types exclude operations outside the assigned scope.
  await expect(reader.call('write', {})).rejects.toMatchObject({ code: 'permissionDenied' });
  broker.register('provider', {
    read: (_input, actual) => {
      expect(actual.moduleId).toBe('reader');
      return 42;
    },
  });
  expect(() => broker.register('duplicate', { read: () => 1 })).toThrow();
  expect(await reader.call('read', {})).toBe(42);
  await expect(reader.call('read', { unknown: true })).rejects.toMatchObject({
    code: 'invalidRequest',
  });
  let effects = 0;
  broker.register('writer', {
    write: () => {
      effects++;
      return 'invalid' as never;
    },
  });
  await expect(broker.consumer(context, ['write']).call('write', {})).rejects.toMatchObject({
    code: 'outcomeUnknown',
  });
  expect(effects).toBe(1);
});

test('a module accepts the same narrow port from production or an isolated test', async () => {
  const module = (port: ReadPort) => ({ value: () => port.call('read', {}) });
  expect(await module({ call: async () => 7 }).value()).toBe(7);
  const broker = new Broker<typeof contract, Inputs, Outputs>(contract);
  let granted = false;
  broker.register('domain', {
    read: () => {
      if (!granted) throw Object.assign(new Error('denied'), { code: 'permissionDenied' });
      return 42;
    },
  });
  const production = module(broker.consumer(context, ['read']));
  await expect(production.value()).rejects.toMatchObject({ code: 'permissionDenied' });
  granted = true;
  expect(await production.value()).toBe(42);
});

test('event rejection and subscriber failure stay local', () => {
  const channel = eventChannel({ type: 'number' });
  let value: unknown;
  channel.subscribe(() => {
    throw new Error('subscriber');
  });
  channel.subscribe((next) => {
    value = next;
  });
  expect(channel.publish('invalid')).toBe(false);
  expect(channel.publish(42)).toBe(true);
  expect(value).toBe(42);
});

test('request payload and later host configuration mutation cannot replace bound context', async () => {
  const broker = new Broker<typeof contract, Inputs, Outputs>(contract);
  const configured: CallContext = {
    moduleId: 'module',
    role: 'execution',
    principal: { kind: 'agent', id: 'original' },
  };
  const port = broker.consumer(configured, ['write']);
  broker.register('domain', {
    write: (_input, trusted) => {
      expect(trusted.role).toBe('execution');
      expect(trusted.principal.id).toBe('original');
      return 42;
    },
  });
  Object.assign(configured.principal, { id: 'changed' });
  expect(await port.call('write', { role: 'host', principal: { id: 'forged' } })).toBe(42);
});
