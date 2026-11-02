import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportControlHost } from '../../apps/kernel/dist/report-control.js';
import { serveReportControl, serveReportManager } from '../../apps/kernel/dist/report-service.js';
import { isolationLock } from '../../packages/platform/dist/isolated-report-controller.js';
import { OperationError } from '../../packages/protocol/dist/core.js';

export type HostCommand = { type: 'test'; id: number; command: 'inspect' | 'disconnect' };
export type HostReply = {
  type: 'test';
  id: number;
  state: { pid: number; parentPid: number; starts: number; recoveries: number; supports: number };
};
export type HostFrame = { type: 'rpc'; frame: string };
export type ServiceReply = { type: 'service'; code?: string; state: HostReply['state'] };

const [privateRoot, configId] = process.argv.slice(2);
assert(privateRoot && configId && process.send);
const state = { pid: process.pid, parentPid: process.ppid, starts: 0, recoveries: 0, supports: 0 };
const send = (message: HostFrame | HostReply | ServiceReply | { type: 'ready'; pid: number }) =>
  new Promise<void>((resolve, reject) => {
    process.send?.(message, (error: Error | null) => (error ? reject(error) : resolve()));
  });

// Only support and the OS controller are adapters; records, assets and native flock are real.
const image = Buffer.alloc(120);
Buffer.from('7f454c46020101', 'hex').copy(image);
image.writeUInt16LE(2, 16);
image.writeUInt16LE(62, 18);
image.writeBigUInt64LE(64n, 32);
image.writeUInt16LE(56, 54);
image.writeUInt16LE(1, 56);
image.writeUInt32LE(1, 64);
image.writeUInt32LE(1, 68);

const options: ConstructorParameters<typeof ReportControlHost>[1] = {
  configId,
  privateRoot,
  programs: [{ id: 'fixed', version: '1', policyId: 'fixed', image, args: [] }],
  policies: [
    {
      id: 'fixed',
      version: '1',
      profile: 'linux-x64-static-v1',
      cpuPercent: 20,
      memoryBytes: 67108864,
      swapBytes: 0,
      tasks: 16,
      outputBytes: 1048576,
      runtimeMs: 30000,
      stopGraceMs: 200,
    },
  ],
  native: {
    support: async () => {
      state.supports++;
    },
    lock: isolationLock,
    controller: (options) => ({
      hasExited: false,
      async start() {
        const receipt = JSON.parse(await readFile(join(options.path, 'receipt.json'), 'utf8'));
        assert.equal(receipt.status.phase, 'starting');
        assert.equal(receipt.stage.instanceId, options.receipt.stage.instanceId);
        options.receipt.scopeIntent = true;
        await options.persist();
        state.starts++;
        await options.authorize();
        options.receipt.launchIntent = true;
        options.receipt.status.gateReleased = true;
        await options.persist();
        await options.running();
      },
      async stop() {
        await options.stopped(false);
        return true;
      },
    }),
    stopRecovered: async () => {
      state.recoveries++;
    },
  },
};

if (process.argv[4] === 'stdio' || process.argv[4] === 'manager') {
  try {
    const callerUid = Number(process.argv[5]);
    if (process.argv[4] === 'manager') await serveReportManager({ configId, callerUid });
    else await serveReportControl({ ...options, callerUid });
    await send({ type: 'service', state });
  } catch (error) {
    await send({
      type: 'service',
      code: error instanceof OperationError ? error.code : 'unexpected',
      state,
    });
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (process.connected) process.disconnect();
  }
} else {
  const host = new ReportControlHost({ send: (frame) => send({ type: 'rpc', frame }) }, options);
  process.on('message', (message: HostFrame | HostCommand) => {
    if (message.type === 'rpc') host.receive(message.frame);
    else if (message.type === 'test') {
      void (async () => {
        if (message.command === 'disconnect') await host.disconnect();
        await send({ type: 'test', id: message.id, state: { ...state } });
        if (message.command === 'disconnect') process.disconnect();
      })().catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
        if (process.connected) process.disconnect();
      });
    }
  });
  process.on('disconnect', () => {
    void host.disconnect();
  });
  await send({ type: 'ready', pid: process.pid });
}
