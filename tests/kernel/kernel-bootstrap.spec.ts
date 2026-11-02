import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { kernelBootstrap } from '../../apps/desktop/kernel-bootstrap.js';
import { isBootstrapResult } from '../../packages/protocol/dist/index.js';
import { isolatedKernel, runKernel, runningKernel } from '../kernel-fixture.js';

for (const scenario of [
  { name: 'ordinary mode connects without owning the kernel', options: { development: false } },
  { name: 'default development mode rejects an ordinary kernel', options: undefined },
]) {
  test(scenario.name, async () => {
    await isolatedKernel(async (directory) => {
      const independent = await runningKernel(directory);
      const previous = process.env.SCHOOLOOM_DATA_DIR;
      process.env.SCHOOLOOM_DATA_DIR = directory;
      let server: ViteDevServer | undefined;
      try {
        server = await createServer({
          configFile: false,
          envFile: false,
          root: directory,
          appType: 'custom',
          optimizeDeps: { noDiscovery: true, include: [] },
          plugins: [kernelBootstrap(scenario.options)],
          server: { host: '127.0.0.1', port: 0 },
        });
        await server.listen();
        if (!server.httpServer) throw new Error('Missing bootstrap HTTP server');
        const port = (server.httpServer.address() as AddressInfo).port;
        const origin = `http://127.0.0.1:${port}`;
        for (const mode of ['inspect', 'ensure']) {
          const response = await fetch(`${origin}/__scholoom/kernel/bootstrap`, {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              'X-Scholoom-Bootstrap': '1',
            },
            body: JSON.stringify({ mode }),
          });
          expect(response.status).toBe(200);
          const result: unknown = await response.json();
          if (!isBootstrapResult(result)) throw new Error('Invalid bootstrap result');
          if (scenario.options?.development === false) {
            expect(result.state).toBe('running');
            if (!('endpoint' in result)) throw new Error('Missing ordinary kernel');
            expect(result.endpoint.instanceId).toBe(independent.instanceId);
          } else {
            expect(result.state).toBe('unknown');
            expect('error' in result && result.error?.code).toBe('permissionDenied');
          }
        }
      } finally {
        await server?.close();
        if (previous === undefined) delete process.env.SCHOOLOOM_DATA_DIR;
        else process.env.SCHOOLOOM_DATA_DIR = previous;
      }
      const retained = await runKernel(directory, 'status');
      expect(retained.state).toBe('running');
      if (!('endpoint' in retained)) throw new Error('Ordinary kernel stopped with its host');
      expect(retained.endpoint.instanceId).toBe(independent.instanceId);
      expect(retained.endpoint.processId).toBe(independent.processId);
    });
  });
}
