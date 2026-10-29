import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createKernelClient } from '../../../packages/client/dist/index.js';
import {
  isKernelEndpoint,
  type KernelEndpoint,
  limits,
} from '../../../packages/protocol/dist/index.js';

/** Only test registration/ownership lives here; business requests use the real client. */
export async function startReportKernel(directory: string, log: string) {
  const child = fork(new URL('./kernel.mjs', import.meta.url), [directory], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const output = createWriteStream(log);
  child.stdout?.pipe(output, { end: false });
  child.stderr?.pipe(output, { end: false });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('close', (code, signal) => {
      output.end();
      resolve({ code, signal });
    });
  });
  let endpoint: KernelEndpoint;
  try {
    endpoint = await new Promise<KernelEndpoint>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Fixture kernel startup unavailable')),
        limits.lifecycleMs,
      );
      const onExit = () => {
        clearTimeout(timer);
        reject(new Error('Fixture kernel exited before ready'));
      };
      child.once('exit', onExit);
      child.once('error', reject);
      child.once('message', (message: { state?: string; endpoint?: unknown }) => {
        clearTimeout(timer);
        child.off('exit', onExit);
        if (message.state === 'running' && isKernelEndpoint(message.endpoint))
          resolve(message.endpoint);
        else reject(new Error('Invalid private fixture startup receipt'));
      });
    });
  } catch (error) {
    child.kill('SIGTERM');
    await closed;
    throw error;
  }
  const identity = {
    instanceId: endpoint.instanceId,
    processId: endpoint.processId,
    port: Number(new URL(endpoint.url).port),
    directory,
    development: false,
  };
  return {
    identity,
    connect: async () => {
      const client = createKernelClient(endpoint);
      try {
        await client.connect();
        return client;
      } catch (error) {
        client.dispose();
        throw error;
      }
    },
    alive: () => child.exitCode === null && child.signalCode === null,
    stop: async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const client = createKernelClient(endpoint);
        try {
          await client.connect();
          assert.equal((await client.shutdown()).instanceId, identity.instanceId);
        } finally {
          client.dispose();
        }
      }
      const result = await closed;
      assert.deepEqual(result, { code: 0, signal: null });
      return { ...identity, ...result, closed: true };
    },
  };
}
