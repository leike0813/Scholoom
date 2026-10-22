import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { type CommandWorkspace, ManagedCommands } from '../../apps/kernel/dist/commands.js';
import { ManagedNode, ProcessAdmission } from '../../packages/platform/dist/node.js';
import { type CallContext, OperationError } from '../../packages/protocol/dist/core.js';

const program = fileURLToPath(
  new URL('../fixtures/domain-execution-worker/command.mjs', import.meta.url),
);
const context: CallContext = {
  moduleId: 'editor',
  role: 'product',
  principal: { kind: 'human', id: 'local' },
};
const request = {
  workspaceId: 'workspace',
  executableId: 'node',
  args: [program, 'echo'],
  input: 'evidence 42',
  timeoutMs: 5000,
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-managed-command-'));
  const processes = new ProcessAdmission(1, 2);
  let allowed = true;
  const workspace: CommandWorkspace = {
    ownerModuleId: 'editor',
    directory: root,
    projectId: 'project',
    executables: new Map([['node', process.execPath]]),
  };
  const commands = new ManagedCommands(
    processes,
    (id) => {
      if (id !== 'workspace') throw new OperationError('permissionDenied', 'unknown workspace');
      return workspace;
    },
    () => {
      if (!allowed) throw new OperationError('permissionDenied', 'revoked');
    },
  );
  return {
    root,
    workspace,
    commands,
    processes,
    revoke: () => {
      allowed = false;
    },
  };
}

test('host commands resolve identities and reject module, program and work-domain escalation before admission', async () => {
  const f = await fixture();
  try {
    const execution: CallContext = {
      ...context,
      role: 'execution',
      principal: { kind: 'agent', id: 'agent' },
      projectId: 'project',
      sessionId: 'session',
      runId: 'run',
      instanceId: 'instance',
      workDomain: { kind: 'project', projectId: 'project', sessionId: 'session' },
    };
    for (const [input, caller] of [
      [{ ...request, workspaceId: 'forged' }, context],
      [{ ...request, executableId: process.execPath }, context],
      [request, { ...context, moduleId: 'research' }],
      [request, { ...execution, projectId: 'other' }],
      [
        request,
        {
          ...execution,
          workDomain: { kind: 'application', projectId: 'application', sessionId: 'session' },
        },
      ],
      [request, { ...execution, targetRead: { targetProjectId: 'project', access: 'read' } }],
    ] as const) {
      await expect(f.commands.execute(input, caller)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
      expect(f.processes.status.active).toBe(0);
    }
    await expect(
      f.commands.execute({ ...request, cwd: f.root } as typeof request, context),
    ).rejects.toMatchObject({ code: 'invalidRequest' });
    expect(await f.commands.execute(request, execution)).toMatchObject({
      code: 0,
      stdout: 'evidence 42',
    });
    expect(f.processes.status.active).toBe(0);
  } finally {
    await rm(f.root, { recursive: true });
  }
});

test('queued command rechecks authorization and can be cancelled without launching a process', async () => {
  const f = await fixture();
  const held = f.processes.reserve();
  try {
    const pending = f.commands.execute(request, context);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(f.processes.status.waiting).toBe(1);
    f.revoke();
    held.release();
    await rejected;
    expect(f.processes.status).toMatchObject({ active: 0, waiting: 0 });
  } finally {
    held.release();
    await rm(f.root, { recursive: true });
  }
  const other = await fixture();
  const occupied = other.processes.reserve();
  try {
    const controller = new AbortController();
    const pending = other.commands.execute(request, { ...context, signal: controller.signal });
    const cancelled = expect(pending).rejects.toBeDefined();
    controller.abort();
    await cancelled;
    expect(other.processes.status).toMatchObject({ active: 1, waiting: 0 });
  } finally {
    occupied.release();
    await rm(other.root, { recursive: true });
  }
});

test('fixed program keeps output bounded and cancellation stops its actual process tree', async () => {
  const f = await fixture();
  const controller = new AbortController();
  let pending: Promise<unknown> | undefined;
  try {
    await expect(
      f.commands.execute({ ...request, args: [program, 'overflow'] }, context),
    ).rejects.toMatchObject({ code: 'unavailable' });
    const marker = join(f.root, 'processes.json');
    pending = f.commands.execute(
      { ...request, args: [program, 'tree', marker] },
      { ...context, signal: controller.signal },
    );
    const cancelled = expect(pending).rejects.toBeDefined();
    await expect.poll(async () => readFile(marker, 'utf8').catch(() => '')).not.toBe('');
    const pids = JSON.parse(await readFile(marker, 'utf8')) as { parent: number; child: number };
    controller.abort();
    await cancelled;
    for (const pid of Object.values(pids)) {
      await expect
        .poll(async () => {
          if (process.platform === 'linux') {
            const state = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
            return state === '' || state.slice(state.lastIndexOf(')') + 2).startsWith('Z');
          }
          try {
            process.kill(pid, 0);
            return false;
          } catch {
            return true;
          }
        })
        .toBe(true);
    }
    expect(f.processes.status.active).toBe(0);
  } finally {
    controller.abort();
    await pending?.catch(() => {});
    await rm(f.root, { recursive: true });
  }
});

test('queued command refuses a workspace rebound while waiting for capacity', async () => {
  const f = await fixture();
  const held = f.processes.reserve();
  try {
    const pending = f.commands.execute(request, context);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(f.processes.status.waiting).toBe(1);
    f.workspace.directory = join(f.root, 'rebound');
    held.release();
    await rejected;
    expect(f.processes.status).toMatchObject({ active: 0, waiting: 0 });
  } finally {
    held.release();
    await rm(f.root, { recursive: true });
  }
});

test('lost process controller leaves command stop unknown and retains its occupied slot', async () => {
  test.skip(process.platform === 'win32', 'POSIX controller failure injection');
  const f = await fixture();
  const start = ManagedNode.start;
  let owned: ManagedNode | undefined;
  ManagedNode.start = async (options) => {
    const child = await start(options);
    owned = child;
    return child;
  };
  let pending: Promise<unknown> | undefined;
  try {
    const marker = join(f.root, 'processes.json');
    pending = f.commands.execute({ ...request, args: [program, 'tree', marker] }, context);
    const unknown = expect(pending).rejects.toMatchObject({ code: 'outcomeUnknown' });
    await expect.poll(async () => readFile(marker, 'utf8').catch(() => '')).not.toBe('');
    assert(owned);
    const controller = Reflect.get(owned, 'controller') as ChildProcess;
    controller.kill('SIGKILL');
    await unknown;
    expect(f.processes.status.active).toBe(1);
  } finally {
    ManagedNode.start = start;
    if (owned?.identity) {
      try {
        process.kill(-owned.identity.pid, 'SIGKILL');
      } catch (error) {
        expect((error as NodeJS.ErrnoException).code).toBe('ESRCH');
      }
    }
    await pending?.catch(() => {});
    await rm(f.root, { recursive: true });
  }
});
