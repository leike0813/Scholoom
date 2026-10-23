import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { GraphExecution } from '../../packages/protocol/dist/execution.js';
import { createModelServer } from '../model-server.js';

for (const boundary of [
  'normal',
  'ack',
  'upgrade',
  'lost-wait',
  'missing-checkpoint',
  'materials',
  'explicit-items',
  'message-overflow',
  'switch-agent',
  'model-revoked',
  'model',
  'budget',
  'cancel',
  'revoke',
] as const) {
  test(`registered graph retains checkpoint and evidence across ${boundary}`, async () => {
    // @ts-expect-error Source fixture is deliberately not production registration.
    const { graphs } = await import('../fixtures/domain-execution-worker/graphs.mjs');
    const root = await mkdtemp(join(tmpdir(), 'scholoom-registered-'));
    const profile = join(root, 'profile');
    const model = boundary === 'switch-agent' ? await createModelServer() : undefined;
    if (model) model.hold = true;
    const options = {
      environment: {} as NodeJS.ProcessEnv,
      ...(model ? { modelEndpoint: model.url } : {}),
      executionGraphs: graphs,
      workerEntry: new URL('../fixtures/domain-execution-worker/worker.mjs', import.meta.url),
    };
    if (boundary === 'model' || boundary === 'budget' || boundary === 'model-revoked') {
      // @ts-expect-error Source-only worker fixture.
      const { modelGraphs } = await import('../fixtures/domain-execution-worker/worker-model.mjs');
      options.executionGraphs = modelGraphs;
      options.workerEntry = new URL(
        '../fixtures/domain-execution-worker/worker-model.mjs',
        import.meta.url,
      );
      options.environment = { MINIMAX_CN_API_KEY: 'synthetic' };
    }
    let app = new KernelApplication(profile, options);
    let releaseRead = () => {};
    let blocked: Promise<unknown> | undefined;
    try {
      await app.initialize();
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const saved = await app.projects.get(project.id).save('input.md', 'real registered evidence');
      assert(saved.fileId);
      const material = await app.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, fileId: saved.fileId },
      });
      const session = await app.call('session.create', { projectId: project.id });
      let previousRunId: string | undefined;
      if (model) {
        options.environment.MINIMAX_CN_API_KEY = 'synthetic';
        previousRunId = (
          await app.harness.send({
            projectId: project.id,
            sessionId: session.id,
            instructionId: randomUUID(),
            text: 'Hold the ordinary Agent.',
            materials: [],
          })
        ).runId;
        await expect.poll(() => model.requests.length).toBe(1);
        await app.close();
        options.environment = {};
        app = new KernelApplication(profile, options);
        await app.initialize();
      }
      let grants = 0;
      let modelChecks = 0;
      if (boundary === 'model-revoked') {
        const execution = app.models.execution.bind(app.models);
        app.models.execution = async (authorize, signal, config, confirm) => {
          const access = await execution(
            async () => {
              await authorize?.();
              if (++modelChecks === 2)
                app.projects.get(project.id).grant({ trust: 'restricted', autoBackup: false });
            },
            signal,
            config,
            confirm,
          );
          return {
            ...access,
            acquire: async () => {
              const lease = await access.acquire();
              grants++;
              return lease;
            },
          };
        };
      }
      const selection: Extract<GraphExecution, { kind: 'registered' }> = {
        kind: 'registered',
        graphId: 'durable-resource',
        version: '1',
        config: {
          outputPath: 'result.md',
          operationId: 'durable-output',
          ...(boundary === 'model' || boundary === 'budget'
            ? { modelRequests: boundary === 'budget' ? 33 : 1 }
            : {}),
        },
        materials: [{ ref: material.ref, basis: material.basis }],
        workDomain: { kind: 'project', projectId: project.id, sessionId: session.id },
      };
      const first = {
        projectId: project.id,
        sessionId: session.id,
        instructionId: randomUUID(),
        text: 'Create and wait.',
        materials: [],
      };
      const scope = { projectId: project.id, sessionId: session.id };
      if (boundary === 'cancel' || boundary === 'revoke') {
        const hold = new Promise<void>((resolve) => {
          releaseRead = resolve;
        });
        let entered = () => {};
        const ready = new Promise<void>((resolve) => {
          entered = resolve;
        });
        blocked = app.projects
          .get(project.id)
          .files.coordinate([join(project.path, 'input.md')], async () => {
            entered();
            await hold;
          });
        await ready;
      }
      const accepted = await app.startGraph({
        ...scope,
        instructionId: first.instructionId,
        text: first.text,
        execution: selection,
      });
      if (previousRunId) expect(accepted.runId).not.toBe(previousRunId);
      if (boundary === 'cancel' || boundary === 'revoke') {
        await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('running');
        if (boundary === 'cancel') await app.call('session.cancel', scope);
        else app.projects.get(project.id).grant({ trust: 'restricted', autoBackup: false });
        releaseRead();
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe(boundary === 'cancel' ? 'cancelled' : 'failed');
        await expect(stat(join(project.path, 'result.md'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
        expect(await readFile(join(project.path, 'input.md'), 'utf8')).toBe(
          'real registered evidence',
        );
        return;
      }
      if (boundary === 'budget' || boundary === 'model-revoked') {
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe('failed');
        await expect(stat(join(project.path, 'result.md'))).rejects.toMatchObject({
          code: 'ENOENT',
        });
        expect(
          (await app.snapshot(scope)).messages.find((message) => message.id === first.instructionId)
            ?.state,
        ).toBe('accepted');
        if (boundary === 'model-revoked') {
          expect(modelChecks).toBe(2);
          expect(grants).toBe(0);
        }
        return;
      }
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('waiting');
      let waiting = (await app.snapshot(scope)).run;
      expect(waiting?.graph).toMatchObject({
        graphId: 'durable-resource',
        version: '1',
        stateFormatVersion: '1',
        wait: { nodeKey: 'approve' },
      });
      expect(waiting?.graphProgress?.kind).toBe('graph.waiting');
      if (boundary === 'explicit-items') {
        for (const attachment of [
          {
            contextItems: [
              {
                kind: 'resource' as const,
                itemId: randomUUID(),
                ref: material.ref,
                basis: material.basis,
              },
            ],
          },
          { materials: ['input.md'], materialFileIds: [saved.fileId] },
        ]) {
          const instructionId = randomUUID();
          await expect(
            app.harness.send({
              ...scope,
              instructionId,
              text: '{"approve":true}',
              materials: [],
              ...attachment,
            }),
          ).rejects.toMatchObject({ code: 'unavailable' });
          const snapshot = await app.snapshot(scope);
          expect(snapshot.run?.state).toBe('waiting');
          expect(snapshot.messages.some((message) => message.id === instructionId)).toBe(false);
        }
      }
      expect(
        (await app.snapshot(scope)).messages.find((message) => message.id === first.instructionId)
          ?.state,
      ).toBe('consumed');
      if (boundary === 'message-overflow') {
        for (let index = 0; index < 100; index++)
          await app.harness.send({
            ...scope,
            instructionId: randomUUID(),
            text: `unmatched-${index}`,
            materials: [],
          });
        await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('waiting');
        waiting = (await app.snapshot(scope)).run;
      }
      const identity = await stat(join(project.path, 'result.md'), { bigint: true });
      expect(await readFile(join(project.path, 'result.md'), 'utf8')).toBe(
        '# Durable result\n\nreal registered evidence',
      );
      await app.close();
      if (boundary === 'missing-checkpoint')
        await rename(
          join(project.path, '.scholoom', 'harness', 'checkpoints', `${accepted.runId}.sqlite`),
          join(root, 'retained-checkpoint.sqlite'),
        );
      app = new KernelApplication(profile, options);
      await app.initialize();
      expect((await app.snapshot(scope)).run).toEqual(waiting);
      expect(await app.harness.send(first)).toEqual(accepted);
      if (boundary === 'missing-checkpoint') {
        await app.harness.send({ ...first, instructionId: randomUUID(), text: '{"approve":true}' });
        await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
        expect((await stat(join(project.path, 'result.md'), { bigint: true })).ino).toBe(
          identity.ino,
        );
        expect(app.projects.get(project.id).history('result.md')).toHaveLength(1);
        return;
      }
      if (boundary === 'lost-wait') {
        assert(waiting?.graph);
        const { wait: _wait, ...binding } = waiting.graph;
        app.projects
          .get(project.id)
          .database.prepare('UPDATE runs SET value = ? WHERE id = ?')
          .run(
            JSON.stringify({
              ...waiting,
              state: 'interrupted',
              graph: binding,
              graphProgress: undefined,
            }),
            accepted.runId,
          );
        await app.harness.send({
          ...first,
          instructionId: randomUUID(),
          text: 'Recover the saved wait.',
        });
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe('waiting');
      }
      if (boundary === 'materials') {
        const next = await app.projects.get(project.id).save('next.md', 'different evidence');
        assert(next.fileId);
        const changed = await app.call('resources.describe', {
          locator: { source: 'project', projectId: project.id, fileId: next.fileId },
        });
        const selected = { ...selection, materials: [{ ref: changed.ref, basis: changed.basis }] };
        await expect(
          app.startGraph({
            ...scope,
            instructionId: first.instructionId,
            text: first.text,
            execution: selected,
          }),
        ).rejects.toMatchObject({ code: 'invalidRequest' });
        const nextRun = await app.startGraph({
          ...scope,
          instructionId: randomUUID(),
          text: 'Review the changed input.',
          execution: selected,
        });
        expect(nextRun.runId).not.toBe(accepted.runId);
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe('failed');
        expect((await stat(join(project.path, 'result.md'), { bigint: true })).ino).toBe(
          identity.ino,
        );
        const old = app.projects
          .get(project.id)
          .database.prepare('SELECT value FROM runs WHERE id = ?')
          .get(accepted.runId) as { value: string };
        expect(JSON.parse(old.value).graph.materials).toEqual(selection.materials);
        return;
      }
      const ambiguous = { ...first, instructionId: randomUUID(), text: 'Maybe later.' };
      await app.harness.send(ambiguous);
      await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('waiting');
      expect(
        (await app.snapshot(scope)).messages.find(
          (message) => message.id === ambiguous.instructionId,
        )?.state,
      ).toBe('accepted');
      if (boundary === 'upgrade') {
        await app.close();
        // @ts-expect-error Static source-only upgrade fixture.
        const { upgraded } = await import('../fixtures/domain-execution-worker/worker-v2.mjs');
        app = new KernelApplication(profile, {
          ...options,
          executionGraphs: upgraded,
          workerEntry: new URL(
            '../fixtures/domain-execution-worker/worker-v2.mjs',
            import.meta.url,
          ),
        });
        await app.initialize();
        await expect(
          app.harness.send({ ...first, instructionId: randomUUID(), text: '{"approve":true}' }),
        ).rejects.toMatchObject({ code: 'protocolIncompatible' });
        expect((await app.snapshot(scope)).run?.graph?.version).toBe('1');
        const next = await app.startGraph({
          ...scope,
          instructionId: randomUUID(),
          text: 'Start a new reviewed attempt.',
          execution: {
            ...selection,
            version: '2',
            config: { outputPath: 'v2.md', operationId: 'v2-output' },
          },
        });
        expect(next.runId).not.toBe(accepted.runId);
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe('waiting');
        expect((await app.snapshot(scope)).run?.graph).toMatchObject({
          version: '2',
          stateFormatVersion: '2',
        });
        expect(
          app.projects
            .get(project.id)
            .database.prepare('SELECT id FROM runs WHERE id = ?')
            .get(accepted.runId),
        ).toBeTruthy();
        expect((await stat(join(project.path, 'result.md'), { bigint: true })).ino).toBe(
          identity.ino,
        );
        await app.call('session.cancel', scope);
        expect((await app.snapshot(scope)).run?.state).toBe('cancelled');
        return;
      }
      const resume = { ...first, instructionId: randomUUID(), text: '{"approve":true}' };
      if (boundary === 'ack')
        app.projects
          .get(project.id)
          .database.exec(
            `CREATE TRIGGER lose_graph_ack BEFORE UPDATE ON instructions WHEN NEW.id = '${resume.instructionId}' BEGIN SELECT RAISE(ABORT, 'synthetic acknowledgement failure'); END`,
          );
      expect((await app.harness.send(resume)).runId).toBe(accepted.runId);
      if (boundary === 'ack') {
        await expect
          .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
          .toBe('interrupted');
        expect(
          (await app.snapshot(scope)).messages.find(
            (message) => message.id === resume.instructionId,
          )?.state,
        ).toBe('accepted');
        await app.close();
        app = new KernelApplication(profile, options);
        await app.initialize();
        app.projects.get(project.id).database.exec('DROP TRIGGER lose_graph_ack');
        await app.harness.send({
          ...first,
          instructionId: randomUUID(),
          text: 'Check the saved input and continue.',
        });
      }
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      expect(
        (await app.snapshot(scope)).messages.find((message) => message.id === resume.instructionId)
          ?.state,
      ).toBe('consumed');
      expect(await app.harness.send(resume)).toEqual({
        instructionId: resume.instructionId,
        runId: accepted.runId,
      });
      expect((await stat(join(project.path, 'result.md'), { bigint: true })).ino).toBe(
        identity.ino,
      );
      expect(app.projects.get(project.id).history('result.md')).toHaveLength(1);
    } finally {
      releaseRead();
      await blocked;
      await app.close();
      model?.release();
      await model?.close();
    }
  });
}
