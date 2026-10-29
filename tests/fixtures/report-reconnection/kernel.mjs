import { randomUUID } from 'node:crypto';
import { KernelApplication } from '../../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../../apps/kernel/dist/server.js';
import { protocolVersion } from '../../../packages/protocol/dist/index.js';
import { description, graphs } from './graphs.mjs';

const directory = process.argv[2];
const app = new KernelApplication(directory, {
  environment: {},
  executionGraphs: graphs,
  researchGraphs: [description],
  workerEntry: new URL('./worker.mjs', import.meta.url),
});
let server;
try {
  await app.initialize();
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: directory,
    startedAt: new Date().toISOString(),
    state: 'running',
  };
  // Real ordinary-mode server. No development owner and no new public operation.
  server = await startKernelServer(status, () => app.close(), app, false);
  process.send?.({
    state: 'running',
    endpoint: { ...status, url: server.url, token: server.token },
  });
  process.once('SIGTERM', () => {
    void server.stop();
  });
  await server.closed;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) await server.stop();
  else await app.close();
  process.disconnect?.();
}
