import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createServer } from 'vite';
import { kernelBootstrap } from '../../apps/desktop/kernel-bootstrap.js';
import { pdfAssets } from '../../apps/desktop/pdf-assets.js';
import { bootstrapKernel, createDevelopmentKernel } from '../../apps/kernel/dist/bootstrap.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { isBootstrapResult, limits } from '../../packages/protocol/dist/index.js';
import { isolatedKernel, runKernel, runningKernel } from '../kernel-fixture.js';
import { transportProxy } from './transport-proxy.js';

test('development hosts share ownership, reclaim the last owner and retain business data', async () => {
  await isolatedKernel(async (directory) => {
    const first = createDevelopmentKernel({ dataDirectory: directory });
    const second = createDevelopmentKernel({ dataDirectory: directory });
    let observer: ReturnType<typeof createKernelClient> | undefined;
    try {
      const [a, b] = await Promise.all([first.bootstrap('ensure'), second.bootstrap('ensure')]);
      expect(a.state).toBe('running');
      expect(b.state).toBe('running');
      if (!('endpoint' in a) || !('endpoint' in b)) throw new Error('Missing kernel');
      expect(a.endpoint.instanceId).toBe(b.endpoint.instanceId);
      observer = createKernelClient(a.endpoint);
      await observer.connect();
      const session = await observer.call('session.create', { projectId: 'application' });
      await first.dispose();
      expect((await runKernel(directory, 'status')).state).toBe('running');
      await second.dispose();
      await expect.poll(async () => (await runKernel(directory, 'status')).state).toBe('stopped');
      observer.dispose();
      const next = createDevelopmentKernel({ dataDirectory: directory });
      try {
        const restarted = await next.bootstrap('ensure');
        if (!('endpoint' in restarted)) throw new Error('Missing restarted kernel');
        expect(restarted.endpoint.instanceId).not.toBe(a.endpoint.instanceId);
        observer = createKernelClient(restarted.endpoint);
        await observer.connect();
        const result = await observer.call('workbench.snapshot', {
          projectId: 'application',
          sessionId: session.id,
        });
        expect(result.session?.id).toBe(session.id);
      } finally {
        observer.dispose();
        await next.dispose();
      }
    } finally {
      observer?.dispose();
      await Promise.all([first.dispose(), second.dispose()]);
    }
  });
});

test('development ownership cannot reclaim an independent kernel', async () => {
  await isolatedKernel(async (directory) => {
    const independent = await runningKernel(directory);
    const host = createDevelopmentKernel({ dataDirectory: directory });
    try {
      const result = await host.bootstrap('ensure');
      expect(result.state).toBe('unknown');
      expect('error' in result && result.error?.code).toBe('permissionDenied');
    } finally {
      await host.dispose();
    }
    expect((await runningKernel(directory)).instanceId).toBe(independent.instanceId);
  });
});

test('explicit development startup is not swallowed by an in-flight discovery request', async () => {
  await isolatedKernel(async (directory) => {
    const host = createDevelopmentKernel({ dataDirectory: directory });
    try {
      const discovering = host.bootstrap('inspect');
      const starting = host.bootstrap('ensure');
      expect((await discovering).state).toBe('stopped');
      expect((await starting).state).toBe('running');
    } finally {
      await host.dispose();
    }
  });
});

test('a reconnecting development owner reattaches while another host keeps the kernel alive', async () => {
  await isolatedKernel(async (directory) => {
    const host = createDevelopmentKernel({ dataDirectory: directory });
    const result = await host.bootstrap('ensure');
    if (!('endpoint' in result)) throw new Error('Missing kernel');
    const proxy = await transportProxy(result.endpoint);
    const reconnecting = createKernelClient(proxy.endpoint);
    const phases: string[] = [];
    const unsubscribe = reconnecting.subscribe(() => phases.push(reconnecting.getSnapshot().phase));
    try {
      await reconnecting.connect();
      await reconnecting.attachDevelopment();
      proxy.dropConnections();
      await expect.poll(() => phases.includes('reconnecting')).toBe(true);
      await expect.poll(() => reconnecting.getSnapshot().phase).toBe('connected');
      await host.dispose();
      expect((await reconnecting.status()).state).toBe('running');
      reconnecting.dispose();
      await expect.poll(async () => (await runKernel(directory, 'status')).state).toBe('stopped');
    } finally {
      unsubscribe();
      reconnecting.dispose();
      await host.dispose();
      await proxy.close();
    }
  });
});

test('unclaimed development startup expires', async () => {
  await isolatedKernel(async (directory) => {
    const result = await bootstrapKernel('ensure', { dataDirectory: directory, development: true });
    expect(result.state).toBe('running');
    await expect
      .poll(async () => (await runKernel(directory, 'status')).state, {
        timeout: limits.lifecycleMs + 5000,
      })
      .toBe('stopped');
  });
});

test('closing a host during startup cannot leave a claimed kernel behind', async () => {
  await isolatedKernel(async (directory) => {
    const host = createDevelopmentKernel({ dataDirectory: directory });
    const starting = host.bootstrap('ensure');
    await host.dispose();
    expect((await starting).state).toBe('unknown');
    await expect
      .poll(async () => (await runKernel(directory, 'status')).state, {
        timeout: limits.lifecycleMs + 5000,
      })
      .toBe('stopped');
  });
});

test('Vite internal restart transfers development ownership before closing the old server', async () => {
  await isolatedKernel(async (directory) => {
    const previous = process.env.SCHOOLOOM_DATA_DIR;
    process.env.SCHOOLOOM_DATA_DIR = directory;
    const server = await createServer({
      configFile: false,
      root: fileURLToPath(new URL('../../apps/desktop/src/renderer', import.meta.url)),
      plugins: [kernelBootstrap(), pdfAssets()],
      server: { host: '127.0.0.1', port: 0 },
    });
    try {
      await server.listen();
      const first = await runKernel(directory, 'status');
      if (!('endpoint' in first)) throw new Error('Missing development kernel');
      await server.restart();
      if (!server.httpServer) throw new Error('Missing Vite HTTP server');
      const port = (server.httpServer.address() as AddressInfo).port;
      const origin = `http://127.0.0.1:${port}`;
      const response = await fetch(`${origin}/__scholoom/kernel/bootstrap`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'X-Scholoom-Bootstrap': '1',
        },
        body: JSON.stringify({ mode: 'inspect' }),
      });
      const result = await response.json();
      if (!isBootstrapResult(result) || !('endpoint' in result))
        throw new Error('Missing restarted development kernel');
      expect(result.state).toBe('running');
      expect(result.endpoint.instanceId).toBe(first.endpoint.instanceId);
      const discovery = join(directory, 'runtime', 'endpoint.json');
      const original = await readFile(discovery, 'utf8');
      try {
        await writeFile(
          discovery,
          JSON.stringify({ ...JSON.parse(original), token: '0'.repeat(64) }),
        );
        await server.restart();
      } finally {
        await writeFile(discovery, original);
      }
      const retained = await runKernel(directory, 'status');
      if (!('endpoint' in retained))
        throw new Error('Previous kernel was lost during failed handover');
      expect(retained.endpoint.instanceId).toBe(first.endpoint.instanceId);
      expect(server.httpServer.address()).toBeTruthy();
      await server.close();
      await expect.poll(async () => (await runKernel(directory, 'status')).state).toBe('stopped');
    } finally {
      await server.close();
      if (previous === undefined) delete process.env.SCHOOLOOM_DATA_DIR;
      else process.env.SCHOOLOOM_DATA_DIR = previous;
    }
  });
});

test('killing the development owner closes its ownership connection', async () => {
  await isolatedKernel(async (directory) => {
    const module = new URL('../../apps/kernel/dist/bootstrap.js', import.meta.url).href;
    const source = `import {createDevelopmentKernel} from ${JSON.stringify(module)}; const host=createDevelopmentKernel({dataDirectory:process.argv[1]}); const result=await host.bootstrap('ensure'); process.send?.({state:result.state});`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', source, directory], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    const exited = once(child, 'exit');
    try {
      const [ready] = await once(child, 'message');
      expect(ready.state).toBe('running');
      child.kill('SIGKILL');
      await exited;
      await expect.poll(async () => (await runKernel(directory, 'status')).state).toBe('stopped');
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
  });
});
