import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { type CommandWorkspace, ManagedCommands } from '../../apps/kernel/dist/commands.js';
import { commandDeadline } from '../../packages/platform/dist/command-deadline.js';
import { ManagedNode, ProcessAdmission } from '../../packages/platform/dist/node.js';
import { type CallContext, OperationError } from '../../packages/protocol/dist/core.js';
import type { PlatformCommandInput } from '../../packages/protocol/dist/platform.js';
import { context, fixture, program, request } from '../managed-command-fixture.js';
import { createModelServer } from '../model-server.js';

test('host commands resolve identities and reject module, program and work-domain escalation before admission', async () => {
  const f = await fixture();
  try {
    const execution: CallContext = {
      ...context,
      role: 'execution',
      principal: { kind: 'agent', id: 'session' },
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
      [request, { ...execution, principal: { kind: 'agent', id: 'other' } }],
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

class CommandApplication extends KernelApplication {
  context: CallContext | undefined;
  workspace: CommandWorkspace | undefined;
  override projectTargetRead(context: CallContext) {
    this.context = context;
    return super.projectTargetRead(context);
  }
  protected override commandWorkspace(id: string): CommandWorkspace {
    if (id === 'workspace' && this.workspace) return this.workspace;
    return super.commandWorkspace(id);
  }
  command(input: PlatformCommandInput, context: CallContext, moduleId = 'editor') {
    return this.modulePort(context, moduleId).call('platform.command', input);
  }
  occupy() {
    return this.processes.reserve();
  }
}

for (const boundary of ['revoke', 'cancel', 'stale'] as const) {
  test(`broker command rechecks a real execution after queued ${boundary}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-command-broker-'));
    const model = await createModelServer();
    model.hold = true;
    const app = new CommandApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    const occupied: ReturnType<CommandApplication['occupy']>[] = [];
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const session = await app.call('session.create', { projectId: project.id });
      const scope = { projectId: project.id, sessionId: session.id };
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'Hold the active execution.',
        materials: [],
      });
      await expect.poll(() => model.requests.length, { timeout: 20_000 }).toBe(1);
      const context = app.context;
      assert(context);
      app.workspace = {
        ownerModuleId: 'editor',
        directory: project.path,
        projectId: project.id,
        executables: new Map([['node', process.execPath]]),
      };
      expect(await app.command(request, context)).toMatchObject({ code: 0, stdout: 'evidence 42' });
      for (const [input, caller, moduleId, code] of [
        [{ ...request, workspaceId: 'forged' }, context, 'editor', 'permissionDenied'],
        [{ ...request, executableId: process.execPath }, context, 'editor', 'permissionDenied'],
        [request, context, 'research', 'permissionDenied'],
        [request, { ...context, instanceId: randomUUID() }, 'editor', 'instanceMismatch'],
        [
          request,
          { ...context, principal: { kind: 'agent', id: 'other' } },
          'editor',
          'permissionDenied',
        ],
        [
          request,
          { ...context, targetRead: { targetProjectId: project.id, access: 'read' } },
          'editor',
          'permissionDenied',
        ],
        [
          request,
          {
            ...context,
            projectId: 'application',
            workDomain: {
              kind: 'application',
              projectId: 'application',
              sessionId: session.id,
            },
          },
          'editor',
          'permissionDenied',
        ],
      ] as const) {
        await expect(app.command(input, caller, moduleId)).rejects.toMatchObject({ code });
      }
      if (boundary === 'revoke') {
        const global = await app.call('session.create', { projectId: 'application' });
        await app.call('session.send', {
          projectId: 'application',
          sessionId: global.id,
          instructionId: randomUUID(),
          text: 'Hold the global execution.',
          materials: [],
        });
        await expect
          .poll(
            () => {
              if (app.context?.projectId !== 'application') return false;
              try {
                app.harness.checkExecutionContext(app.context);
                return true;
              } catch {
                return false;
              }
            },
            { timeout: 20_000 },
          )
          .toBe(true);
        assert(app.context?.projectId === 'application');
        await expect(app.command(request, app.context)).rejects.toMatchObject({
          code: 'permissionDenied',
        });
      }
      // Fill only this host's remaining slots; the held model keeps its real instance active.
      try {
        while (true) occupied.push(app.occupy());
      } catch (error) {
        expect(error).toMatchObject({ code: 'resourceLimit' });
      }
      const { signal: _signal, ...withoutSignal } = context;
      const pending = app.command(request, boundary === 'stale' ? withoutSignal : context);
      const rejected = expect(pending).rejects.toMatchObject({
        code:
          boundary === 'revoke'
            ? 'permissionDenied'
            : boundary === 'cancel'
              ? 'shuttingDown'
              : 'instanceMismatch',
      });
      if (boundary === 'revoke')
        app.projects.get(project.id).grant({ trust: 'restricted', autoBackup: false });
      else await app.call('session.cancel', scope);
      occupied.shift()?.release();
      await rejected;
      if (boundary !== 'revoke')
        await expect(app.command(request, withoutSignal)).rejects.toMatchObject({
          code: 'instanceMismatch',
        });
    } finally {
      for (const reservation of occupied) reservation.release();
      model.release();
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}

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

for (const boundary of ['cancel', 'revoke', 'rebind'] as const) {
  test(`${boundary} during process startup never dispatches the registered program`, async () => {
    const f = await fixture();
    const controller = new AbortController();
    const start = ManagedNode.start;
    const marker = join(f.root, 'unexpected.txt');
    ManagedNode.start = async (options) => {
      const owned = await start(options);
      if (boundary === 'cancel')
        controller.abort(new OperationError('shuttingDown', 'cancel during startup'));
      else if (boundary === 'revoke') f.revoke();
      else f.workspace.directory = join(f.root, 'rebound');
      return owned;
    };
    try {
      await expect(
        f.commands.execute(
          {
            ...request,
            args: ['-e', "require('node:fs').writeFileSync(process.argv[1], 'unexpected')", marker],
          },
          { ...context, signal: controller.signal },
        ),
      ).rejects.toMatchObject({
        code: boundary === 'cancel' ? 'shuttingDown' : 'permissionDenied',
      });
      expect(await readFile(marker, 'utf8').catch(() => undefined)).toBeUndefined();
      expect(f.processes.status.active).toBe(0);
    } finally {
      ManagedNode.start = start;
      await rm(f.root, { recursive: true });
    }
  });
}

for (const normalExit of [false, true]) {
  test(`detached command descendants stop before releasing capacity (normalExit=${normalExit})`, async () => {
    const f = await fixture();
    const abort = new AbortController();
    let pending: Promise<unknown> | undefined;
    try {
      const marker = join(f.root, 'detached.json');
      pending = f.commands.execute(
        {
          ...request,
          args: [program, normalExit ? 'detached-exit' : 'detached', marker],
        },
        { ...context, signal: abort.signal },
      );
      const outcome = normalExit
        ? expect(pending).resolves.toMatchObject({ code: 0 })
        : expect(pending).rejects.toBeDefined();
      await expect.poll(async () => readFile(marker, 'utf8').catch(() => '')).not.toBe('');
      if (!normalExit) {
        await expect
          .poll(async () => Number(await readFile(`${marker}.heartbeat`, 'utf8')))
          .toBeGreaterThan(1);
        abort.abort();
      }
      await outcome;
      expect(f.processes.status.active).toBe(0);
      const stopped = await readFile(`${marker}.heartbeat`, 'utf8');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(await readFile(`${marker}.heartbeat`, 'utf8')).toBe(stopped);
    } finally {
      abort.abort();
      await pending?.catch(() => {});
      await rm(f.root, { recursive: true });
    }
  });
}

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
    const child = await start({
      ...options,
      env: { ...options.env, SCHOLOOM_DIAGNOSTIC_SECRET: 'private-bootstrap-not-a-diagnostic' },
    });
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
    const error = await pending.catch((reason) => reason);
    assert(error instanceof Error);
    const detail = JSON.parse(error.message.split('\n').at(-1) ?? '');
    expect(detail).toMatchObject({
      instanceId: owned.identity?.instanceId,
      controller: { code: null, signal: 'SIGKILL' },
      stoppedReceived: false,
      native: { lastStatus: 'R', code: null, signal: null },
      reason: 'controllerExit',
    });
    expect(error.message).not.toContain('private-bootstrap-not-a-diagnostic');
    expect(f.processes.status.active).toBe(1);
  } finally {
    ManagedNode.start = start;
    await owned?.stop().catch((error) => expect(error).toMatchObject({ code: 'outcomeUnknown' }));
    await pending?.catch(() => {});
    await rm(f.root, { recursive: true });
  }
});
