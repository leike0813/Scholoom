import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { Harness } from '../../packages/harness/dist/node.js';
import { MaterialReading } from '../../packages/library/dist/node.js';
import { ModelConfigStore } from '../../packages/models/dist/node.js';
import {
  ManagedNode,
  ProcessAdmission,
  processMayBeAlive,
} from '../../packages/platform/dist/node.js';
import { createModelServer } from '../model-server.js';
import { syntheticPdf } from '../pdf-fixture.js';

test('real queued executions can be cancelled and overflow is rejected before a new instruction is accepted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-process-capacity-'));
  const profile = join(root, 'profile');
  const model = await createModelServer();
  const app = new KernelApplication(profile, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const admission = new ProcessAdmission(1, 1);
  const harness = new Harness(
    app.harnessStorage(),
    app.models,
    new ModelConfigStore(join(profile, 'credentials')),
    (context) => app.researchTools(context),
    (context) => app.libraryTools(context),
    () => {},
    (context) => app.harnessProject(context),
    (context) => app.projectFiles(context),
    (context) => app.researchProgress(context),
    admission,
  );
  try {
    await app.initialize();
    await harness.initialize();
    const [first, second, third] = [
      harness.create('application'),
      harness.create('application'),
      harness.create('application'),
    ] as const;
    const send = (sessionId: string) =>
      harness.send({
        projectId: 'application',
        sessionId,
        instructionId: randomUUID(),
        text: 'MODEL_CHAT held',
        materials: [],
      });
    model.hold = true;
    await send(first.id);
    await expect.poll(() => model.requests.length).toBe(1);
    await send(second.id);
    expect(admission.status).toMatchObject({ active: 1, waiting: 1 });
    await expect(send(third.id)).rejects.toMatchObject({ code: 'resourceLimit' });
    expect(
      (await app.snapshot({ projectId: 'application', sessionId: third.id })).messages,
    ).toEqual([]);
    harness.cancel('application', second.id);
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: 'application', sessionId: second.id })).run?.state,
      )
      .toBe('cancelled');
    expect(admission.status).toMatchObject({ active: 1, waiting: 0 });
    expect(model.requests).toHaveLength(1);
    harness.cancel('application', first.id);
    await expect.poll(() => admission.status.active).toBe(0);
  } finally {
    await harness.close();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('a capability cannot wait for its parent process slot and is refused before a research attempt is accepted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-child-capacity-'));
  const profile = join(root, 'profile');
  const model = await createModelServer();
  const app = new KernelApplication(profile, {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const admission = new ProcessAdmission(1, 0);
  const harness = new Harness(
    app.harnessStorage(),
    app.models,
    new ModelConfigStore(join(profile, 'credentials')),
    (context) => app.researchTools(context),
    (context) => app.libraryTools(context),
    () => {},
    (context) => app.harnessProject(context),
    (context) => app.projectFiles(context),
    (context) => app.researchProgress(context),
    admission,
  );
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    await writeFile(join(root, 'project', 'input.md'), 'capacity sample');
    project.grant({ trust: 'trusted', autoBackup: false });
    await harness.initialize();
    const session = harness.create(project.project.id);
    await harness.send({
      projectId: project.project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_RESEARCH',
      materials: ['input.md'],
    });
    await expect
      .poll(
        async () =>
          (await app.snapshot({ projectId: project.project.id, sessionId: session.id })).run?.state,
        { timeout: 20000 },
      )
      .toBe('completed');
    expect(
      (await app.research.list({ projectId: project.project.id, sessionId: session.id, offset: 0 }))
        .attempts,
    ).toEqual([]);
    const snapshot = await app.snapshot({ projectId: project.project.id, sessionId: session.id });
    const tool = snapshot.messages.find(
      (message) => message.tool?.name === 'invoke_research_capability',
    );
    expect(tool?.state).toBe('error');
    expect(JSON.parse(tool?.tool?.output ?? '{}').error?.code).toBe('resourceLimit');
    expect(admission.status).toMatchObject({ active: 0, waiting: 0 });
  } finally {
    await harness.close();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('PDF material loading waits for the same host process capacity and releases it after the real child exits', async () => {
  const admission = new ProcessAdmission(1, 1);
  const occupied = admission.reserve();
  const reading = new MaterialReading(undefined, admission);
  let loaded = false;
  try {
    const result = reading.run(
      async () => {
        loaded = true;
        const bytes = syntheticPdf();
        return Uint8Array.from(bytes).buffer;
      },
      { kind: 'info' },
    );
    await Promise.resolve();
    expect(loaded).toBe(false);
    occupied.release();
    await expect(result).resolves.toMatchObject({ pageCount: 2 });
    expect(admission.status).toMatchObject({ active: 0, waiting: 0 });
  } finally {
    occupied.release();
    await reading.close();
  }
});

test('closing PDF while it waits for host capacity withdraws its reservation without loading material', async () => {
  const admission = new ProcessAdmission(1, 1);
  const occupied = admission.reserve();
  const reading = new MaterialReading(undefined, admission);
  let loaded = false;
  const pending = reading.run(
    async () => {
      loaded = true;
      return new ArrayBuffer(0);
    },
    { kind: 'info' },
  );
  const rejected = expect(pending).rejects.toMatchObject({ code: 'shuttingDown' });
  try {
    expect(admission.status.waiting).toBe(1);
    await reading.close();
    await rejected;
    expect(loaded).toBe(false);
    expect(admission.status).toMatchObject({ active: 1, waiting: 0 });
  } finally {
    occupied.release();
    await reading.close();
  }
});

test('an Agent PDF request cannot queue behind a manual PDF that is waiting for its parent slot', async () => {
  const admission = new ProcessAdmission(1, 1);
  const parent = admission.reserve();
  const reading = new MaterialReading(undefined, admission);
  let loaded = false;
  const load = async () => {
    loaded = true;
    return new ArrayBuffer(0);
  };
  const manual = reading.run(load, { kind: 'info' }).catch((error: { code: string }) => error.code);
  try {
    await expect(
      reading.run(load, { kind: 'info' }, { waitForCapacity: false }),
    ).rejects.toMatchObject({ code: 'resourceLimit' });
    expect(admission.status).toMatchObject({ active: 1, waiting: 1 });
    expect(loaded).toBe(false);
    await reading.close();
    expect(await manual).toBe('shuttingDown');
  } finally {
    parent.release();
    await reading.close();
  }
});

test('controller loss cannot report a busy calculation stopped or release its process capacity', async () => {
  test.skip(process.platform === 'win32', 'POSIX signal fault injection');
  const admission = new ProcessAdmission(1, 0);
  const reading = new MaterialReading(
    new URL('../fixtures/pdf-process/controller-loss.mjs', import.meta.url),
    admission,
  );
  const controller = new AbortController();
  const start = ManagedNode.start;
  let child: ManagedNode | undefined;
  ManagedNode.start = async (options) => {
    child = await start(options);
    return child;
  };
  let report!: (value: { processId: number }) => void;
  const reported = new Promise<{ processId: number }>((resolve) => {
    report = resolve;
  });
  const pending = reading
    .run(
      async () => new ArrayBuffer(0),
      { kind: 'info' },
      {
        signal: controller.signal,
        verify: async (value: { processId: number }) => {
          report(value);
          await new Promise<void>(() => {});
        },
      },
    )
    .catch((error: { code: string }) => error.code);
  try {
    const owned = await reported;
    assert(child);
    const controlProcess = Reflect.get(child, 'controller') as ChildProcess;
    controlProcess.kill('SIGKILL');
    controller.abort();
    expect(await pending).toBe('outcomeUnknown');
    await expect.poll(() => processMayBeAlive(owned.processId)).toBe(false);
    expect(admission.status.active).toBe(1);
    await expect(
      reading.run(async () => new ArrayBuffer(0), { kind: 'info' }, { waitForCapacity: false }),
    ).rejects.toMatchObject({ code: 'resourceLimit' });
  } finally {
    ManagedNode.start = start;
    controller.abort();
    await child?.stop().catch((error) => expect(error).toMatchObject({ code: 'outcomeUnknown' }));
    await reading.close();
  }
});
