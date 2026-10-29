import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { KernelApplication } from '../../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../../packages/client/dist/index.js';
import type {
  BusinessInputs,
  BusinessOutputs,
  CallArguments,
} from '../../../packages/protocol/dist/index.js';
import { protocolVersion } from '../../../packages/protocol/dist/index.js';
import { transportProxy } from '../../kernel/transport-proxy.js';
import { reportFixture } from '../report.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** All authentication, broker calls, reports, project files and library results are real.
 * Only one reader report response can be held after its real domain call completes.
 */
export async function reportClientDomain(root: string) {
  await mkdir(root, { recursive: true });
  const profile = join(root, 'profile');
  const app = new KernelApplication(profile, { environment: {} });
  await app.initialize();
  const seeded = await reportFixture(app, root);
  const gates: Array<{ release(): void }> = [];
  let armed:
    | { entered: ReturnType<typeof deferred>; released: ReturnType<typeof deferred> }
    | undefined;
  let connections = 0;
  let active = 0;
  let peak = 0;
  const pending = new Set<Promise<unknown>>();
  const requests: Array<{ connection: number; method: string; basis?: string }> = [];
  const served = {
    call: app.call.bind(app),
    subscribe: app.subscribe.bind(app),
    available: app.available.bind(app),
    connectProduct: () => {
      const product = app.connectProduct();
      const connection = ++connections;
      return {
        close: product.close,
        call: async <A extends CallArguments<BusinessInputs>>(
          ...args: A
        ): Promise<BusinessOutputs[A[0]]> => {
          const [method, input] = args;
          if (requests.length < 300)
            requests.push({
              connection,
              method,
              ...(input && 'basis' in input && typeof input.basis === 'string'
                ? { basis: input.basis }
                : {}),
            });
          const verification =
            connection === 1 && (method === 'resources.describe' || method === 'resources.report');
          const gate = connection === 1 && method === 'resources.report' ? armed : undefined;
          if (gate) armed = undefined;
          const work = (async () => {
            if (verification) peak = Math.max(peak, ++active);
            try {
              const result = await product.call<A>(...args);
              if (gate) {
                gate.entered.resolve();
                await gate.released.promise;
              }
              return result;
            } finally {
              if (verification) active--;
            }
          })();
          pending.add(work);
          try {
            return await work;
          } finally {
            pending.delete(work);
          }
        },
      };
    },
  };
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: profile,
    startedAt: new Date().toISOString(),
    state: 'running' as const,
  };
  const server = await startKernelServer(status, () => app.close(), served);
  const endpoint = { ...status, url: server.url, token: server.token };
  const proxy = await transportProxy(endpoint);
  const reader = createKernelClient(proxy.endpoint);
  const writer = createKernelClient(endpoint);
  // Sequential authentication makes connection 1 the instrumented reader, not an authority mock.
  await reader.connect();
  await writer.connect();
  const watch = () =>
    reader.call('workbench.watch', { projectId: seeded.project.id, includeSessions: false });
  await watch();
  return {
    ...seeded,
    profile,
    reader,
    writer,
    watch,
    proxy,
    facts: () => ({ active, peak, requests: [...requests] }),
    holdReport() {
      if (armed) throw new Error('Reader response already armed');
      const gate = { entered: deferred(), released: deferred() };
      armed = gate;
      const held = { entered: gate.entered.promise, release: () => gate.released.resolve() };
      gates.push(held);
      return held;
    },
    async close() {
      for (const gate of gates) gate.release();
      await Promise.allSettled([...pending]);
      reader.dispose();
      writer.dispose();
      await proxy.close();
      await server.stop();
    },
  };
}
