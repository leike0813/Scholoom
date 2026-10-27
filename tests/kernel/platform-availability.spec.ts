import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { channel } from 'node:diagnostics_channel';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManagedCommands } from '../../apps/kernel/dist/commands.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { MaterialReading } from '../../packages/library/dist/node.js';
import {
  ManagedNode,
  ProcessAdmission,
  privateDirectory,
  runCommand,
} from '../../packages/platform/dist/node.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';

function privateDirectoryOrigin(stack: string): 'compiled' | 'source' | 'unresolved' {
  for (const frame of stack.replaceAll('\\', '/').split('\n')) {
    if (!/^\s*at (?:async )?privateDirectory \(/.test(frame)) continue;
    if (/\/platform\/dist\/private-files\.js:\d+:\d+\)$/.test(frame)) return 'compiled';
    if (/\/platform\/src\/private-files\.ts:\d+:\d+\)$/.test(frame)) return 'source';
  }
  return 'unresolved';
}

function observeChildProcesses() {
  const phases = new AsyncLocalStorage<string>();
  const events: {
    phase: string;
    spawnfile: string;
    pid: number | null;
    privateDirectory: boolean;
    origin: ReturnType<typeof privateDirectoryOrigin>;
    frameCount: number;
    stackLimit: number;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    exited: boolean;
  }[] = [];
  let spawned = 0;
  function spawnedChild(message: unknown) {
    spawned++;
    if (events.length >= 32) return;
    const child = (message as { process: ChildProcess }).process;
    const trace = new Error();
    Error.captureStackTrace(trace, spawnedChild);
    const stack = trace.stack ?? '';
    const origin = privateDirectoryOrigin(stack);
    const event = {
      phase: phases.getStore() ?? 'unattributed',
      spawnfile: '',
      pid: child.pid ?? null,
      privateDirectory: origin !== 'unresolved',
      origin,
      frameCount: stack.split('\n').filter((frame) => /^\s*at /.test(frame)).length,
      stackLimit: Error.stackTraceLimit,
      exitCode: child.exitCode,
      signal: child.signalCode,
      exited: child.exitCode !== null || child.signalCode !== null,
    };
    events.push(event);
    const identify = () => {
      event.spawnfile =
        typeof child.spawnfile === 'string' ? basename(child.spawnfile.replaceAll('\\', '/')) : '';
      event.pid = child.pid ?? null;
      event.exitCode = child.exitCode;
      event.signal = child.signalCode;
    };
    child.once('spawn', identify);
    child.once('error', identify);
    child.once('exit', (code, signal) => {
      identify();
      event.exitCode = code;
      event.signal = signal;
      event.exited = true;
    });
  }
  channel('child_process').subscribe(spawnedChild);
  return {
    phases,
    events,
    get spawned() {
      return spawned;
    },
    allows: (event: (typeof events)[number], platform: NodeJS.Platform = process.platform) =>
      platform === 'win32' &&
      ['initialization', 'manual-setup', 'manual-save'].includes(event.phase) &&
      event.spawnfile.toLowerCase() === 'powershell.exe' &&
      event.privateDirectory &&
      event.pid !== null &&
      event.exited &&
      event.exitCode === 0 &&
      event.signal === null,
    unsubscribe: () => {
      channel('child_process').unsubscribe(spawnedChild);
      phases.disable();
    },
  };
}

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

test('child process observation recognizes real private directory provenance and rejects other sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-origin-'));
  const observation = observeChildProcesses();
  const diagnostic = { origin: 'unresolved', frameCount: 0, stackLimit: Error.stackTraceLimit };
  let child: ChildProcess | undefined;
  try {
    const target = join(root, 'target');
    const link = join(root, 'link');
    await mkdir(target);
    await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    const failure = await privateDirectory(link).catch((error: unknown) => error);
    assert(failure instanceof Error);
    expect(failure).toMatchObject({ code: 'permissionDenied' });
    const stack = failure.stack ?? '';
    diagnostic.origin = privateDirectoryOrigin(stack);
    diagnostic.frameCount = stack.split('\n').filter((frame) => /^\s*at /.test(frame)).length;
    expect(diagnostic.origin).not.toBe('unresolved');
    expect(observation.spawned).toBe(0);
    {
      function privateDirectory() {
        return new Error().stack ?? '';
      }
      expect(privateDirectoryOrigin(privateDirectory())).toBe('unresolved');
    }

    if (process.platform === 'win32') {
      await observation.phases.run('manual-setup', () => privateDirectory(join(root, 'private')));
      expect(observation.spawned).toBe(1);
      const acl = observation.events[0];
      assert(acl);
      expect(acl.origin).not.toBe('unresolved');
      expect(observation.allows(acl)).toBe(true);
      child = observation.phases.run('manual-setup', () =>
        spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], {
          stdio: 'ignore',
          windowsHide: true,
        }),
      );
      await once(child, 'close');
      expect(observation.spawned).toBe(2);
      const other = observation.events[1];
      assert(other);
      expect(other).toMatchObject({
        phase: 'manual-setup',
        spawnfile: 'powershell.exe',
        privateDirectory: false,
        origin: 'unresolved',
        exitCode: 0,
        signal: null,
        exited: true,
      });
      expect(observation.allows(other)).toBe(false);
    }
  } finally {
    observation.unsubscribe();
    try {
      if (child && child.exitCode === null && child.signalCode === null) {
        const closed = once(child, 'close');
        child.kill();
        await closed;
      }
      await rm(root, { recursive: true });
    } finally {
      await test.info().attach('private-directory-provenance', {
        body: JSON.stringify({
          diagnostic,
          spawned: observation.spawned,
          events: observation.events,
        }),
        contentType: 'application/json',
      });
    }
  }
});

test('child process observation captures a real child and rejects execution phases', async () => {
  const observation = observeChildProcesses();
  let child: ChildProcess | undefined;
  try {
    let start!: () => void;
    const ready = new Promise<void>((resolve) => {
      start = resolve;
    });
    const completed = observation.phases.run('calibration', async () => {
      await ready;
      child = spawn(process.execPath, ['-e', 'process.exit(0)'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      await once(child, 'close');
      return child;
    });
    const actual = await observation.phases.run('manual-setup', () => {
      start();
      return completed;
    });
    assert(actual.pid);
    expect(observation.spawned).toBe(1);
    expect(observation.events).toHaveLength(1);
    const [event] = observation.events;
    assert(event);
    expect(event).toMatchObject({
      phase: 'calibration',
      spawnfile: basename(process.execPath),
      pid: actual.pid,
      privateDirectory: false,
      exitCode: 0,
      signal: null,
      exited: true,
    });
    expect(observation.allows(event)).toBe(false);
    // Synthetic classifier calibration does not establish real Windows ACL provenance.
    const acl = {
      ...event,
      spawnfile: 'powershell.exe',
      privateDirectory: true,
      origin: 'source' as const,
    };
    for (const phase of ['initialization', 'manual-setup', 'manual-save']) {
      expect(observation.allows({ ...acl, phase }, 'win32')).toBe(true);
    }
    for (const phase of [
      'session.send',
      'ManagedNode.start',
      'runCommand',
      'MaterialReading.run',
      'ManagedCommands.execute',
      'catalog',
      'unattributed',
    ]) {
      expect(observation.allows({ ...event, phase }, 'win32')).toBe(false);
      expect(observation.allows({ ...acl, phase }, 'win32')).toBe(false);
    }
    const allowed = { ...acl, phase: 'initialization' };
    for (const invalid of [
      { ...allowed, spawnfile: event.spawnfile },
      { ...allowed, privateDirectory: false },
      { ...allowed, pid: null },
      { ...allowed, exited: false },
      { ...allowed, exitCode: 1 },
      { ...allowed, signal: 'SIGTERM' as const },
    ]) {
      expect(observation.allows(invalid, 'win32')).toBe(false);
    }
    for (const platform of ['linux', 'darwin'] as const) {
      expect(observation.allows(allowed, platform)).toBe(false);
    }
    await observation.phases.run('calibration', async () => {
      const failedChild = spawn(join(tmpdir(), randomUUID(), 'missing-node'), [], {
        stdio: 'ignore',
      });
      child = failedChild;
      await new Promise<void>((resolve) => failedChild.once('close', () => resolve()));
    });
    expect(observation.spawned).toBe(2);
    const failed = observation.events[1];
    assert(failed);
    expect(failed).toMatchObject({ phase: 'calibration', pid: null, exited: false });
    expect(failed.exitCode).toBeLessThan(0);
    expect(observation.allows(failed, 'win32')).toBe(false);
  } finally {
    observation.unsubscribe();
    try {
      if (child && child.exitCode === null && child.signalCode === null) {
        const closed = once(child, 'close');
        child.kill();
        await closed;
      }
    } finally {
      await test.info().attach('child-process-observer-calibration', {
        body: JSON.stringify({ spawned: observation.spawned, events: observation.events }),
        contentType: 'application/json',
      });
    }
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
  const observation = observeChildProcesses();
  try {
    await observation.phases.run('initialization', () => app.initialize());
    const { project, session } = await observation.phases.run('manual-setup', async () => {
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const session = await app.call('session.create', { projectId: project.id });
      return { project, session };
    });
    const scope = { projectId: project.id, sessionId: session.id };
    await observation.phases.run('session.send', async () => {
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
    });
    await observation.phases.run('ManagedNode.start', () =>
      expect(
        ManagedNode.start({
          entry: new URL('../fixtures/processes/worker.mjs', import.meta.url),
          instanceId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: 'unavailable' }),
    );
    await observation.phases.run('runCommand', () =>
      expect(
        runCommand({
          executable: process.execPath,
          args: ['-e', 'process.exit(0)'],
          cwd: root,
          timeoutMs: 1000,
        }),
      ).rejects.toMatchObject({ code: 'unavailable' }),
    );
    let loaded = false;
    await observation.phases.run('MaterialReading.run', () =>
      expect(
        reading.run(
          async () => {
            loaded = true;
            return new ArrayBuffer(0);
          },
          { kind: 'info' },
          { waitForCapacity: false },
        ),
      ).rejects.toMatchObject({ code: 'unavailable' }),
    );
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
      await observation.phases.run('ManagedCommands.execute', () =>
        expect(
          commands.execute(
            { workspaceId: 'workspace', executableId: 'node', args: [], timeoutMs: 1000 },
            {
              moduleId: 'editor',
              role: 'product',
              principal: { kind: 'human', id: 'local' },
            },
          ),
        ).rejects.toMatchObject({ code: 'unavailable' }),
      );
      expect(processes.status).toMatchObject({ active: 1, waiting: 0 });
    } finally {
      occupied.release();
    }
    await observation.phases.run('manual-save', async () => {
      await app.call('files.save', {
        projectId: project.id,
        path: 'notes.md',
        content: '# Manual fallback',
      });
      expect(await readFile(join(project.path, 'notes.md'), 'utf8')).toBe('# Manual fallback');
    });
    await observation.phases.run('catalog', async () => {
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
    });
    expect(observation.spawned).toBeLessThanOrEqual(32);
    expect(observation.events).toHaveLength(observation.spawned);
    expect(observation.events.filter((event) => !observation.allows(event))).toEqual([]);
  } finally {
    observation.unsubscribe();
    Object.defineProperty(ManagedNode, 'availability', descriptor);
    try {
      try {
        await reading.close();
      } finally {
        await app.close();
      }
      await rm(root, { recursive: true });
    } finally {
      await test.info().attach('unavailable-execution-processes', {
        body: JSON.stringify({ spawned: observation.spawned, events: observation.events }),
        contentType: 'application/json',
      });
    }
  }
});
