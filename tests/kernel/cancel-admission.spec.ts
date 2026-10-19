import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { createModelServer } from '../model-server.js';

test('cancelling during an asynchronous project check prevents a new structure effect', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-cancel-admission-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  let entered!: () => void;
  const checking = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ read: true, write: true, send: true, autoBackup: false });
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    const createPort = app.harnessProject.bind(app);
    let held = false;
    app.harnessProject = (context) => {
      const port = createPort(context);
      return {
        ...port,
        'project.check': async (input) => {
          const result = await port['project.check'](input);
          if (
            !held &&
            context.signal &&
            project.database
              .prepare(
                "SELECT id FROM messages WHERE json_extract(value, '$.tool.name') = 'mkdir_project_path'",
              )
              .get()
          ) {
            held = true;
            entered();
            await gate;
          }
          return result;
        },
      };
    };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_STRUCTURE',
      materials: [],
    });
    await checking;
    app.harness.cancel(scope.projectId, scope.sessionId);
    expect((await app.snapshot(scope)).run?.state).toBe('cancelling');
    release();
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('cancelled');
    await expect(stat(join(root, 'project', 'managed'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      project.database.prepare("SELECT id FROM file_operations WHERE id='fixture-mkdir'").all(),
    ).toEqual([]);
  } finally {
    release();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
