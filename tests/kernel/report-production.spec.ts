import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import type {
  CallContext,
  DelegationRequest,
  ResourceDescriptor,
} from '../../packages/protocol/dist/index.js';
import { delegationModel } from '../fixtures/delegation-model.js';
import { createModelServer } from '../model-server.js';

async function reportFixture(app: ManualApplication, root: string) {
  const project = await app.call('project.create', {
    path: join(root, 'project'),
    trust: 'trusted',
  });
  await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
  const path = join(root, 'paper.md');
  await writeFile(path, '# Source\nDose 10 and 20.\n');
  const batch = await app.call('library.importFiles', {
    batchId: randomUUID(),
    paths: [path],
    storage: 'linked',
    purpose: '正文',
    version: 'unspecified',
    origin: 'isolated-report-test',
  });
  await expect
    .poll(async () => (await app.call('library.batch', { batchId: batch.id })).batch.state)
    .toBe('completed');
  const receipt = (await app.call('library.batch', { batchId: batch.id })).entries[0];
  assert(receipt?.attachmentId);
  const attachment = await app.call('library.attachment', { attachmentId: receipt.attachmentId });
  const source = await app.call('resources.describe', {
    locator: {
      source: 'library',
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    },
  });
  await mkdir(join(project.path, 'assets'));
  await app.call('files.save', {
    projectId: project.id,
    path: 'assets/data.json',
    content: '[10,20]',
  });
  const data = await app.call('resources.describe', {
    locator: {
      source: 'project',
      projectId: project.id,
      path: 'assets/data.json',
    },
  });
  const manifest = {
    version: 1,
    resources: [
      {
        path: 'assets/data.json',
        ref: data.ref,
        basis: data.basis,
        mediaType: 'application/json',
      },
    ],
    sources: [{ ref: source.ref, basis: source.basis }],
    objects: [
      {
        objectId: 'dose',
        name: 'Doses',
        semantics: 'Compare dose 10 and 20',
        sourceIndexes: [0],
      },
    ],
  };
  // Independent wire sample; the production encoder is not the expected-value oracle.
  const html = `<!--scholoom-report-v1\n${JSON.stringify(manifest).replaceAll('-', '\\u002d')}\n-->\n<html><body>Fixed dose comparison</body></html>`;
  await app.call('files.save', { projectId: project.id, path: 'report.html', content: html });
  const entry = await app.call('resources.describe', {
    locator: {
      source: 'project',
      projectId: project.id,
      path: 'report.html',
    },
  });
  return { project, source, entry, manifest, html };
}

test('Manual report operations use real files, conditional HTML save and library read authority', async () => {
  const root = test.info().outputPath('manual-report');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { project, source, entry, manifest, html } = await reportFixture(app, root);
    expect(entry.capabilities.write).toBe(true);
    expect(source.capabilities.write).toBe(false);
    await expect(
      app.call('resources.save', {
        ref: entry.ref,
        basis: entry.basis,
        content: '中'.repeat(100000),
      }),
    ).rejects.toMatchObject({ code: 'tooLarge' });
    const snapshot = await app.call('resources.report', { ref: entry.ref, basis: entry.basis });
    expect(snapshot).toEqual({ resource: entry, manifest });
    assert(entry.ref.source === 'project');
    const history = { projectId: project.id, fileId: entry.ref.fileId };
    const change = (await app.call('files.changes', history)).changes[0];
    assert(change);
    await expect(
      app.call('files.edit', { ...history, editId: change.editId }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await expect(
      app.call('files.history', { projectId: project.id, path: 'report.html' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    const example = await app.call('files.save', {
      projectId: project.id,
      path: 'report-example.md',
      content: html,
    });
    assert(example.fileId);
    expect(
      (
        await app.call('files.edit', {
          projectId: project.id,
          fileId: example.fileId,
          editId: example.id,
        })
      ).after,
    ).toBe(html);
    const saved = await app.call('resources.save', {
      ref: entry.ref,
      basis: entry.basis,
      content: html.replace('Fixed dose', 'Revised dose'),
    });
    expect(saved.basis).not.toBe(entry.basis);
    expect(
      (await app.call('resources.report', { ref: saved.ref, basis: saved.basis })).manifest,
    ).toEqual(manifest);
    expect(await readFile(join(project.path, 'report.html'), 'utf8')).toContain('Revised dose');
    await expect(
      app.call('resources.save', {
        ref: entry.ref,
        basis: entry.basis,
        content: 'stale',
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await expect(
      app.call('resources.save', {
        ref: source.ref,
        basis: source.basis,
        content: 'library write',
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    const current = await readFile(join(project.path, 'report.html'));
    await rename(join(project.path, 'report.html'), join(project.path, 'replaced.html'));
    await writeFile(join(project.path, 'report.html'), current);
    await expect(
      app.call('resources.save', {
        ref: saved.ref,
        basis: saved.basis,
        content: 'same-content replacement',
      }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    const reopened = await app.call('resources.describe', {
      locator: {
        source: 'project',
        projectId: project.id,
        path: 'report.html',
      },
    });
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    for (const read of [
      () => app.call('resources.report', { ref: reopened.ref, basis: reopened.basis }),
      () => app.call('resources.describe', { locator: reopened.ref }),
      () =>
        app.call('resources.read', { ref: reopened.ref, basis: reopened.basis, encoding: 'utf8' }),
      () => app.call('files.read', { projectId: project.id, path: 'report.html' }),
    ])
      await expect(read()).rejects.toMatchObject({ code: 'permissionDenied' });
    await app.call('files.save', {
      projectId: project.id,
      path: 'ordinary.html',
      content: '<p>Ordinary snapshot</p>',
    });
    const ordinary = await app.call('resources.describe', {
      locator: {
        source: 'project',
        projectId: project.id,
        path: 'ordinary.html',
      },
    });
    expect(ordinary.capabilities.write).toBe(true);
    expect(
      (
        await app.call('resources.read', {
          ref: ordinary.ref,
          basis: ordinary.basis,
          encoding: 'utf8',
        })
      ).data,
    ).toContain('Ordinary snapshot');
  } finally {
    await app.close();
  }
});

for (const boundary of ['queue', 'final'] as const) {
  test(`report sources survive real ${boundary} model admission and restart`, async () => {
    const root = test.info().outputPath(`report-${boundary}`);
    await mkdir(root, { recursive: true });
    let entry: ResourceDescriptor;
    const tool = boundary === 'queue' ? 'read_file' : 'describe_program_material';
    const model = await createModelServer({
      respond: ({ calls }) =>
        calls.length === 0
          ? {
              tool: {
                name: tool,
                input:
                  tool === 'read_file' ? { file_path: '/report.html' } : { locator: entry.ref },
              },
            }
          : { text: 'Report was read' },
    });
    const profile = join(root, 'profile');
    const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
    let app = new KernelApplication(profile, options);
    let used = false;
    let queued = false;
    let held: Promise<string> | undefined;
    let lease: string | undefined;
    await app.initialize();
    const blocker = await app.models.execution();
    try {
      const fixture = await reportFixture(app, root);
      entry = fixture.entry;
      await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
      const scope = {
        projectId: fixture.project.id,
        sessionId: (await app.call('session.create', { projectId: fixture.project.id })).id,
      };
      const record = app.harness.recordReportUse.bind(app.harness);
      app.harness.recordReportUse = (context, evidence) => {
        record(context, evidence);
        if (!used) {
          used = true;
          if (boundary === 'queue')
            held = blocker.acquire().then((value) => {
              lease = value;
              return value;
            });
        }
      };
      const execution = app.models.execution.bind(app.models);
      app.models.execution = async (authorize = () => {}, signal, config, final) => {
        const value = await execution(authorize, signal, config, () => {
          if (used && boundary === 'final')
            app.library.grant({ read: true, write: true, send: false, autoBackup: false });
          final?.();
        });
        return {
          ...value,
          acquire: async () => {
            if (used && boundary === 'queue') {
              await held;
              queued = true;
            }
            return value.acquire();
          },
        };
      };
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'Read this report',
        materials: [],
      });
      if (boundary === 'queue') {
        await expect.poll(() => queued, { timeout: 20000 }).toBe(true);
        await app.call('library.grant', {
          read: true,
          write: true,
          send: false,
          autoBackup: false,
        });
        if (lease) blocker.release(lease);
        lease = undefined;
      }
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(used).toBe(true);
      expect(model.requests).toHaveLength(1);
      const output = (await app.snapshot(scope)).messages.find(
        (message) => message.tool?.name === tool,
      )?.tool?.output;
      expect(output).toBeTruthy();
      await app.close();
      app = new KernelApplication(profile, options);
      await app.initialize();
      await app.call('session.send', {
        ...scope,
        instructionId: randomUUID(),
        text: 'Continue after restart',
        materials: [],
      });
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('failed');
      expect(model.requests).toHaveLength(1);
    } finally {
      if (lease) blocker.release(lease);
      await app.close();
      await model.close();
    }
  });
}

test('accepted report excerpts retain source authority when a queued report loses its manifest', async () => {
  const root = test.info().outputPath('queued-excerpt');
  await mkdir(root, { recursive: true });
  const model = await createModelServer({ respond: () => ({ text: 'Held response' }) });
  model.hold = true;
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const { project, entry } = await reportFixture(app, root);
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'Hold this turn',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'Inspect my report excerpt',
      materials: [],
      contextItems: [
        {
          kind: 'text',
          itemId: randomUUID(),
          ref: entry.ref,
          basis: entry.basis,
          quote: 'Fixed dose comparison',
          contentState: 'saved',
        },
      ],
    });
    await app.call('resources.save', {
      ref: entry.ref,
      basis: entry.basis,
      content: '<p>Ordinary replacement</p>',
    });
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    model.release();
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('failed');
    expect(model.requests).toHaveLength(1);
  } finally {
    model.release();
    await app.close();
    await model.close();
  }
});

test('target HTML remains read-only and report targets fail closed without a transitive source authority', async () => {
  const root = test.info().outputPath('target-report');
  await mkdir(root, { recursive: true });
  class ObservedKernel extends KernelApplication {
    context: CallContext | undefined;
    override projectTargetRead(context: CallContext) {
      if (context.role === 'execution') this.context = context;
      return super.projectTargetRead(context);
    }
  }
  const model = await createModelServer();
  model.hold = true;
  const app = new ObservedKernel(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const { project: target, entry } = await reportFixture(app, root);
    const project = await app.call('project.create', {
      path: join(root, 'origin'),
      trust: 'trusted',
    });
    await app.call('files.save', {
      projectId: target.id,
      path: 'ordinary.html',
      content: '<p>Target snapshot</p>',
    });
    const ordinary = await app.call('resources.describe', {
      locator: {
        source: 'project',
        projectId: target.id,
        path: 'ordinary.html',
      },
    });
    const session = await app.call('session.create', { projectId: project.id });
    await app.call('session.send', {
      projectId: project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT hold target boundary',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    assert(app.context);
    const resources = app.executionResources(app.context);
    const description = await resources.describe(ordinary.ref);
    expect(description.capabilities.write).toBe(false);
    expect(
      (await resources.read({ ref: description.ref, basis: description.basis, encoding: 'utf8' }))
        .data,
    ).toContain('Target snapshot');
    await expect(resources.describe(entry.ref)).rejects.toMatchObject({ code: 'unavailable' });
    assert(entry.ref.source === 'project');
    const targets = app.projectTargetRead(app.context);
    await expect(
      targets['project.readTarget']({
        targetProjectId: target.id,
        request: { kind: 'readText', fileId: entry.ref.fileId, basis: entry.basis },
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  } finally {
    model.release();
    await app.close();
    await model.close();
  }
});

test('actual delegated report material stops before expanded sources or a child model are delivered', async () => {
  const root = test.info().outputPath('delegated-report');
  await mkdir(root, { recursive: true });
  const work: DelegationRequest = {
    delegationId: randomUUID(),
    roleId: 'worker',
    roleVersion: '1',
    tools: ['resource.describe', 'resource.read'],
    workPackage: {
      objective: 'CHILD_DELEGATION',
      requirements: 'Read the declared report.',
      materials: [],
      outputs: [],
    },
  };
  const model = await delegationModel(work);
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const { project, entry } = await reportFixture(app, root);
    work.workPackage.materials = [{ ref: entry.ref, basis: entry.basis }];
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'PARENT_DELEGATION',
      materials: [],
    });
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 25000 })
      .toBe('completed');
    const record = await app.call('delegation.get', { ...scope, delegationId: work.delegationId });
    expect(record.state).toBe('failed');
    expect(record.error?.code).toBe('modelFailed');
    expect(
      model.requests.every((request) => JSON.stringify(request).includes('PARENT_DELEGATION')),
    ).toBe(true);
  } finally {
    await app.close();
    await model.close();
  }
});
