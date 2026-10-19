import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { RunInstance } from '../../packages/harness/dist/node.js';
import { ManagedNode, type ProcessAdmission } from '../../packages/platform/dist/node.js';
import { createModelServer } from '../model-server.js';

for (const [registered, rootStart] of [
  [true, false],
  [false, false],
  [false, true],
] as const)
  test(`an unconfirmed execution stop preserves ownership (registered=${registered}, root=${rootStart})`, async () => {
    test.skip(process.platform === 'win32', 'POSIX signal fault injection');
    const root = await mkdtemp(join(tmpdir(), 'scholoom-capability-stop-unknown-'));
    const model = await createModelServer();
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    const start = ManagedNode.start;
    let executions = 0;
    let owned: ManagedNode | undefined;
    let blocked!: () => void;
    const busy = new Promise<void>((resolve) => {
      blocked = resolve;
    });
    let started!: () => void;
    const starting = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release!: () => void;
    const registration = new Promise<void>((resolve) => {
      release = resolve;
    });
    ManagedNode.start = async (options) => {
      const capability =
        options.entry.href ===
        new URL('../../packages/harness/dist/execution.js', import.meta.url).href;
      const child = await start({
        ...options,
        ...(capability && ++executions === (rootStart ? 1 : 2)
          ? {
              entry: new URL(
                registered
                  ? '../fixtures/processes/blocked-agent.mjs'
                  : '../fixtures/processes/unready-blocked-agent.mjs',
                import.meta.url,
              ),
            }
          : {}),
      });
      if (capability && executions === (rootStart ? 1 : 2)) {
        owned = child;
        child.on('message', (message: unknown) => {
          if (
            message &&
            typeof message === 'object' &&
            (('busy' in message && message.busy === true) ||
              ('result' in message &&
                message.result &&
                typeof message.result === 'object' &&
                'event' in message.result))
          )
            blocked();
        });
        started();
        if (!registered) {
          await registration;
          await child.stop();
        }
      }
      return child;
    };
    try {
      await app.initialize();
      const project = await app.projects.create(join(root, 'project'));
      project.grant({ read: true, write: true, send: true, autoBackup: false });
      await project.save('input.md', 'controlled evidence 42');
      const session = app.harness.create(project.project.id);
      const scope = { projectId: project.project.id, sessionId: session.id };
      await app.harness.send({
        ...scope,
        instructionId: randomUUID(),
        text: 'MODEL_RESEARCH',
        materials: ['input.md'],
      });
      const instances = () =>
        (
          project.database.prepare('SELECT value FROM run_instances').all() as { value: string }[]
        ).map((row) => JSON.parse(row.value) as RunInstance);
      await starting;
      if (registered)
        await expect
          .poll(
            () => instances().find((row) => row.parentInstanceId && row.state === 'running')?.state,
          )
          .toBe('running');
      const childProcess = owned;
      await busy;
      assert(childProcess?.identity);
      const processId = childProcess.identity.pid;
      const controller = Reflect.get(childProcess, 'controller') as ChildProcess;
      controller.kill('SIGKILL');
      await childProcess.exited;
      app.harness.cancel(scope.projectId, scope.sessionId);
      release();
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('interrupted');
      if (!rootStart) {
        await expect
          .poll(async () => (await app.research.list(scope)).attempts[0]?.state, { timeout: 20000 })
          .toBe('interrupted');
        expect((await app.research.list(scope)).attempts[0]?.state).not.toBe('cancelled');
      }
      expect((await app.snapshot(scope)).run?.remoteOutcome).toBe('unknown');
      expect(() => process.kill(processId, 0)).not.toThrow();
      if (registered)
        expect(instances().find((row) => row.processId === processId)?.state).not.toBe('exited');
      else
        expect(
          instances().find((row) => (rootStart ? !row.parentInstanceId : !!row.parentInstanceId)),
        ).toMatchObject({
          state: 'stopping',
        });
      expect((Reflect.get(app, 'processes') as ProcessAdmission).status.active).toBe(1);
      await expect(app.harness.releaseProject(project.project.id)).rejects.toMatchObject({
        code: 'outcomeUnknown',
      });
    } finally {
      release();
      ManagedNode.start = start;
      if (owned?.identity) {
        try {
          process.kill(-owned.identity.pid, 'SIGKILL');
        } catch (error) {
          expect((error as NodeJS.ErrnoException).code).toBe('ESRCH');
        }
      }
      await app.close();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
