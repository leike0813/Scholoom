import type { KernelApplication } from '../../apps/kernel/dist/application.js';
import { Broker, eventChannel } from '../../packages/broker/dist/index.js';
import type { RpcPeer } from '../../packages/broker/dist/rpc.js';
import type { KernelClient } from '../../packages/client/dist/index.js';
import { callExecutionControl } from '../../packages/harness/dist/node.js';
import type {
  CallArguments,
  CallContext,
  ContractParams,
  ContractResult,
} from '../../packages/protocol/dist/core.js';
import type { ExecutionControlProviders } from '../../packages/protocol/dist/execution.js';
import type { ModelDescriptor } from '../../packages/protocol/dist/models.js';
import type { ProjectFilePort } from '../../packages/protocol/dist/projects.js';

const contracts = {
  read: {
    params: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    result: { type: 'integer' },
    semantics: { effect: 'read', returns: 'result', waitMs: 1000 },
  },
  write: {
    params: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content'],
      additionalProperties: false,
    },
    result: { type: 'boolean' },
    semantics: { effect: 'write', returns: 'result', waitMs: 1000 },
  },
} as const;
type Inputs = {
  read: ContractParams<typeof contracts.read>;
  write: ContractParams<typeof contracts.write>;
};
type Outputs = {
  read: ContractResult<typeof contracts.read>;
  write: ContractResult<typeof contracts.write>;
};
const context: CallContext = {
  moduleId: 'test',
  principal: { kind: 'system', id: 'host' },
  role: 'host',
};

// This file is checked by tsc via tsconfig.tools.json; it is never run as a test.
function contractTypeChecks() {
  const broker = new Broker<typeof contracts, Inputs, Outputs>(contracts);
  broker.register('provider', { read: ({ id }) => id.length, write: ({ content }) => !!content });
  const reader = broker.consumer(context, ['read']);
  const value: Promise<number> = reader.call('read', { id: 'sample' });
  // @ts-expect-error Parameters come from the read schema.
  reader.call('read', { id: 42 });
  // @ts-expect-error The narrow consumer cannot call write.
  reader.call('write', { content: 'sample' });
  // @ts-expect-error The registered provider must return the declared result.
  broker.register('invalid', { read: () => 'wrong result' });
  // @ts-expect-error Assignment must not widen the schema-bound provider result.
  const widened: Broker<typeof contracts, Inputs, { read: number | boolean; write: boolean }> =
    broker;
  void widened;
  const registration: Pick<
    Broker<typeof contracts, Inputs, { read: number | boolean; write: boolean }>,
    'register'
  > = broker;
  // @ts-expect-error Projecting registration cannot accept schema-incompatible providers.
  registration.register('invalid', { read: () => true });
  // @ts-expect-error Assignment cannot narrow the inputs accepted by a provider.
  const narrowed: Broker<
    typeof contracts,
    { read: { id: 'only-one' }; write: Inputs['write'] },
    Outputs
  > = broker;
  void narrowed;
  const both = broker.consumer(context, ['read', 'write']);
  const readValue: Promise<number> = both.call('read', { id: 'sample' });
  const writeValue: Promise<boolean> = both.call('write', { content: 'sample' });
  // @ts-expect-error A union type argument cannot detach the operation from its parameters.
  both.call<CallArguments<Inputs>>('read', { content: 'wrong DTO' });
  const method = Math.random() < 0.5 ? 'read' : 'write';
  // @ts-expect-error An unresolved operation needs a correspondingly correlated argument tuple.
  both.call(method, { content: 'wrong DTO' });
  const correlated: CallArguments<Inputs> =
    Math.random() < 0.5 ? ['read', { id: 'sample' }] : ['write', { content: 'sample' }];
  // @ts-expect-error Mutating only the operation must not break a correlated tuple.
  correlated[0] = 'read';
  // @ts-expect-error Mutating only the payload must not break a correlated tuple.
  correlated[1] = { content: 'wrong DTO' };
  const either: Promise<number | boolean> = both.call(...correlated);
  void either;
  void [readValue, writeValue];
  // @ts-expect-error Keys alone cannot bind an incompatible parameter mapping.
  new Broker<typeof contracts, { read: number; write: Inputs['write'] }, Outputs>(contracts);
  // @ts-expect-error An incompatible result mapping is rejected at construction.
  new Broker<typeof contracts, Inputs, { read: string; write: boolean }>(contracts);
  // @ts-expect-error Mapping narrower than the schema also loses allowed payloads.
  new Broker<typeof contracts, { read: { id: 'only-one' }; write: Inputs['write'] }, Outputs>(
    contracts,
  );
  // @ts-expect-error Stale extra operation keys do not match the declaration.
  new Broker<typeof contracts, Inputs & { stale: string }, Outputs>(contracts);
  const changed = {
    ...contracts,
    read: {
      ...contracts.read,
      params: {
        ...contracts.read.params,
        properties: { id: { type: 'integer' } },
      },
    },
  } as const;
  // @ts-expect-error A schema change invalidates an old materialized type mapping.
  new Broker<typeof changed, Inputs, Outputs>(changed);
  return value;
}
void contractTypeChecks;

function internalControlTypeChecks(peer: RpcPeer) {
  const lease: Promise<{ leaseId: string }> = callExecutionControl(peer, 'model.acquire', {});
  // @ts-expect-error The release payload is derived from the owned-channel declaration.
  callExecutionControl(peer, 'model.release', { leaseId: 42 });
  // @ts-expect-error Product operations are outside the internal control port.
  callExecutionControl(peer, 'session.send', {});
  // @ts-expect-error Checkpoint confirmation requires its saved checkpoint identity.
  callExecutionControl(peer, 'execution.consume', { instructionIds: ['instruction'] });
  // @ts-expect-error File parameters are tied to their individual operation schema.
  callExecutionControl(peer, 'execution.files.edit', { path: '/file', content: 'replacement' });
  // @ts-expect-error Binary transfers use the declared wire encoding, never SDK byte objects.
  callExecutionControl(peer, 'execution.files.upload', {
    files: [{ path: '/history.md', content: new Uint8Array() }],
  });
  // @ts-expect-error Initialization is declared together with its graph and model payloads.
  callExecutionControl(peer, 'execution.initialize', { model: { apiKey: 42 } });
  const events: Pick<ExecutionControlProviders, 'execution.next'> = {
    // @ts-expect-error Graph event payloads remain bound to the executable declaration.
    'execution.next': () => ({
      done: false,
      event: {
        event: 'on_chat_model_end',
        run_id: 'run',
        data: { output: { type: 'ai', data: { content: 42 } } },
      },
    }),
  };
  void events;
  const descriptor: ModelDescriptor = {
    model: 'model',
    // @ts-expect-error Model descriptors use the provider's effort declaration.
    effort: 'unbounded',
    apiKey: 'synthetic',
    endpoint: 'loopback',
  };
  void descriptor;
  const providers: Pick<ExecutionControlProviders, 'model.acquire'> = {
    // @ts-expect-error Internal providers also derive their result from the declaration.
    'model.acquire': () => ({ leaseId: 42 }),
  };
  void providers;
  return lease;
}
void internalControlTypeChecks;

function productPortTypeChecks(client: KernelClient, application: KernelApplication) {
  // @ts-expect-error The client uses the same operation parameter declaration.
  client.call('project.open', { path: 42 });
  const method = Math.random() < 0.5 ? 'project.open' : 'provider.setDefaults';
  // @ts-expect-error A union operation cannot accept only one branch's payload.
  client.call(method, { model: 'sample', effort: 'medium' });
  // @ts-expect-error The host forwarding entry preserves the same correlation.
  application.call(method, { model: 'sample', effort: 'medium' });
}
void productPortTypeChecks;

function eventPortTypeChecks() {
  const events = eventChannel(contracts.read.params);
  events.subscribe((value) => value.id.toUpperCase());
  // @ts-expect-error Subscriber input follows the event schema.
  events.subscribe((value: { id: number }) => value.id.toFixed());
}
void eventPortTypeChecks;

function projectFilePortTypeChecks(port: ProjectFilePort) {
  // @ts-expect-error This module port cannot consume library capabilities.
  port['library.list']({});
  port['project.saveFile']({
    projectId: 'project',
    path: 'file.md',
    content: 'text',
    // @ts-expect-error The conditional save identity is derived from the owner schema.
    expectedFileId: 42,
  });
}
void projectFilePortTypeChecks;
