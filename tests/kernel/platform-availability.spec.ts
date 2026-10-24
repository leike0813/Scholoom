import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { channel } from 'node:diagnostics_channel';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManagedCommands } from '../../apps/kernel/dist/commands.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { MaterialReading } from '../../packages/library/dist/node.js';
import { ManagedNode, ProcessAdmission, runCommand } from '../../packages/platform/dist/node.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';

test('kernel declares its real managed execution availability over RPC', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-availability-'));
  const app = new KernelApplication(root);
  await app.initialize();
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: root,
    startedAt: new Date().toISOString(),
    state: 'running' as const,
  };
  const server = await startKernelServer(status, () => app.close(), app);
  const client = createKernelClient({ ...status, url: server.url, token: server.token });
  try {
    const actual = (await client.connect()).managedExecution;
    expect(actual).toEqual(ManagedNode.availability);
    expect(actual?.available).toBe(process.platform === 'linux' || process.platform === 'win32');
    if (actual?.available === false) expect(actual.reason.length).toBeGreaterThan(0);
  } finally {
    client.dispose();
    await server.stop();
    await rm(root, { recursive: true });
  }
});

test('unavailable execution refuses work before spawning and keeps manual files, catalog and sessions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-unavailable-'));
  const app = new KernelApplication(join(root, 'profile'));
  const processes = new ProcessAdmission(1, 1);
  const reading = new MaterialReading(undefined, processes);
  // Real macOS uses its actual declaration; other platforms replace only the availability boundary.
  const descriptor = Object.getOwnPropertyDescriptor(ManagedNode, 'availability');
  assert(descriptor);
  if (ManagedNode.availability.available)
    Object.defineProperty(ManagedNode, 'availability', {
      configurable: true,
      get: () => ({ available: false, reason: 'Synthetic unsupported execution platform' }),
    });
  let spawned = 0;
  const spawnedChild = () => spawned++;
  channel('child_process').subscribe(spawnedChild);
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await expect(
      app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'Must not be accepted',
        materials: [],
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect((await app.snapshot(scope)).messages).toEqual([]);
    expect((await app.snapshot(scope)).run).toBeUndefined();
    await expect(
      ManagedNode.start({
        entry: new URL('../fixtures/processes/worker.mjs', import.meta.url),
        instanceId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await expect(
      runCommand({
        executable: process.execPath,
        args: ['-e', 'process.exit(0)'],
        cwd: root,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    let loaded = false;
    await expect(
      reading.run(
        async () => {
          loaded = true;
          return new ArrayBuffer(0);
        },
        { kind: 'info' },
        { waitForCapacity: false },
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(loaded).toBe(false);
    expect(processes.status).toMatchObject({ active: 0, waiting: 0 });
    const occupied = processes.reserve();
    const commands = new ManagedCommands(
      processes,
      () => ({
        ownerModuleId: 'editor',
        directory: root,
        executables: new Map([['node', process.execPath]]),
      }),
      () => {},
    );
    try {
      await expect(
        commands.execute(
          { workspaceId: 'workspace', executableId: 'node', args: [], timeoutMs: 1000 },
          {
            moduleId: 'editor',
            role: 'product',
            principal: { kind: 'human', id: 'local' },
          },
        ),
      ).rejects.toMatchObject({ code: 'unavailable' });
      expect(processes.status).toMatchObject({ active: 1, waiting: 0 });
    } finally {
      occupied.release();
    }
    await app.call('files.save', {
      projectId: project.id,
      path: 'notes.md',
      content: '# Manual fallback',
    });
    expect(await readFile(join(project.path, 'notes.md'), 'utf8')).toBe('# Manual fallback');
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    const batch = await app.call('library.ingest', {
      batchId: randomUUID(),
      json: JSON.stringify([{ title: 'Manual catalog' }]),
      version: 'published',
      origin: 'manual',
    });
    await expect
      .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
      .toBe('completed');
    expect((await app.call('library.list', { query: 'Manual catalog' })).sources).toHaveLength(1);
    expect((await app.snapshot(scope)).session?.id).toBe(session.id);
    expect(spawned).toBe(0);
  } finally {
    channel('child_process').unsubscribe(spawnedChild);
    Object.defineProperty(ManagedNode, 'availability', descriptor);
    await reading.close();
    await app.close();
    await rm(root, { recursive: true });
  }
});
