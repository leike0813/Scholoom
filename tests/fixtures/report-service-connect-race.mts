import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { RpcPeer } from '../../packages/broker/dist/rpc.js';
import { ProcessAdmission } from '../../packages/platform/dist/admission.js';

type Options = { onFrame(frame: string): void; onClose(): void };
type Channel = { send(frame: string): Promise<void>; close(): Promise<void>; closed: boolean };
const pending: { options: Options; resolve(channel: Channel): void }[] = [];
Reflect.set(
  globalThis,
  'reportChannelTestOpen',
  (options: Options) => new Promise<Channel>((resolve) => pending.push({ options, resolve })),
);
const platform = new URL('../../packages/platform/dist/node.js', import.meta.url).href;
const adapter = `export * from ${JSON.stringify(platform)}; export const openReportChannel = Reflect.get(globalThis, 'reportChannelTestOpen');`;
// An isolated process replaces only the platform port; the real client and RpcPeer are exercised.
registerHooks({
  resolve(specifier, context, next) {
    if (
      specifier === '@scholoom/platform/node' &&
      context.parentURL?.endsWith('/report-control.js')
    )
      return { url: `data:text/javascript,${encodeURIComponent(adapter)}`, shortCircuit: true };
    return next(specifier, context);
  },
});
const { ReportControlClient } = await import('../../apps/kernel/dist/report-control.js');
function channel(options: Options) {
  const server = new RpcPeer(
    { send: (frame) => options.onFrame(frame) },
    {
      request: (method, params) =>
        method === 'reportControl.open' ? { ...(params as object), total: 0 } : { available: true },
    },
  );
  const result: Channel = {
    closed: false,
    send: async (frame) => {
      server.receive(frame);
    },
    close: async () => {
      result.closed = true;
      server.close();
    },
  };
  return result;
}
const endpoint = { path: '/protected/report.sock', ownerUid: 0, serverUid: 0 };
for (const action of ['service', 'direct', 'disconnect'] as const) {
  pending.length = 0;
  const client = new ReportControlClient({
    configId: 'config',
    admission: new ProcessAdmission(),
    authorize: async () => {},
  });
  const first = client.connectService(endpoint).catch((error: unknown) => error);
  const old = pending[0];
  assert(old);
  let current: Channel | undefined;
  if (action === 'service') {
    const next = client.connectService(endpoint);
    const attempt = pending[1];
    assert(attempt);
    current = channel(attempt.options);
    attempt.resolve(current);
    await next;
  } else if (action === 'direct') {
    let binding: ReturnType<InstanceType<typeof ReportControlClient>['connect']>;
    current = channel({
      onFrame: (frame) => binding.receive(frame),
      onClose: () => binding.disconnect(),
    });
    binding = client.connect(current);
    await client.initialize();
  } else client.disconnect();
  const stale = channel(old.options);
  old.resolve(stale);
  const failure = await first;
  assert(failure instanceof Error && 'code' in failure);
  assert.equal(failure.code, 'unavailable');
  assert.equal(stale.closed, true);
  if (current) {
    assert.equal(current.closed, false);
    assert.deepEqual(
      await client.port()['platform.reportIsolation.check']({ programId: 'p', policyId: 'p' }),
      { available: true },
    );
  } else
    await assert.rejects(
      client.port()['platform.reportIsolation.check']({ programId: 'p', policyId: 'p' }),
      { code: 'unavailable' },
    );
  client.disconnect();
}
console.log(
  'report service attempts: superseded and disconnected attempts cannot replace current binding',
);
