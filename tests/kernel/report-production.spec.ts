import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { ManualApplication } from '../../apps/kernel/dist/manual.js';
import { encodeReportHeader } from '../../packages/editor/dist/report-codec.js';
import type {
  CallContext,
  DelegationRequest,
  ReportManifest,
  ResourceDescriptor,
  ResourceEvidence,
} from '../../packages/protocol/dist/index.js';
import { delegationModel } from '../fixtures/delegation-model.js';
import { reportFixture } from '../fixtures/report.js';
import { createModelServer } from '../model-server.js';

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
    expect((await app.call('files.edit', { ...history, editId: change.editId })).after).toBe(html);
    expect(
      (await app.call('files.history', { projectId: project.id, path: 'report.html' }))[0]?.after,
    ).toBe(html);
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
    expect((await app.call('files.edit', { ...history, editId: change.editId })).after).toBe(html);
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    for (const read of [
      () => app.call('files.edit', { ...history, editId: change.editId }),
      () => app.call('files.history', { projectId: project.id, path: 'report.html' }),
    ])
      await expect(read()).rejects.toMatchObject({ code: 'permissionDenied' });
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
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

for (const operation of ['files.edit', 'files.history'] as const) {
  test(`${operation} rechecks all historical report sources before returning bodies`, async () => {
    const root = test.info().outputPath('historical-report-revocation');
    await mkdir(root, { recursive: true });
    const app = new ManualApplication(join(root, 'profile'));
    try {
      await app.initialize();
      const { project, entry, html } = await reportFixture(app, root);
      assert(entry.ref.source === 'project');
      const entryRef = entry.ref;
      await app.call('files.save', {
        projectId: project.id,
        path: 'next.json',
        content: '[30]',
      });
      const next = await app.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path: 'next.json' },
      });
      assert(next.ref.source === 'project');
      const nextRef = next.ref;
      const replacement = `${encodeReportHeader({
        version: 1,
        resources: [
          { path: 'next.json', ref: next.ref, basis: next.basis, mediaType: 'application/json' },
        ],
        sources: [],
        objects: [],
      })}\n<p>Replacement without library sources</p>`;
      const saved = await app.call('resources.save', {
        ref: entry.ref,
        basis: entry.basis,
        content: replacement,
      });
      const editId = app.projects.get(project.id).editForEvidence(entry.ref.fileId, saved.basis);
      assert(editId);
      const read = app.resources.read.bind(app.resources);
      let revoked = false;
      app.resources.read = async (input, context) => {
        const result = await read(input, context);
        if (!revoked && input.ref.source === 'project' && input.ref.fileId === nextRef.fileId) {
          revoked = true;
          await app.call('library.grant', {
            read: false,
            write: false,
            send: false,
            autoBackup: false,
          });
        }
        return result;
      };
      const action = () =>
        operation === 'files.edit'
          ? app.call('files.edit', { projectId: project.id, fileId: entryRef.fileId, editId })
          : app.call('files.history', { projectId: project.id, path: 'report.html' });
      await expect(action()).rejects.toMatchObject({ code: 'permissionDenied' });
      expect(revoked).toBe(true);
      expect(await readFile(join(project.path, 'report.html'), 'utf8')).toBe(replacement);
      await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
      const edit = await app.call('files.edit', {
        projectId: project.id,
        fileId: entry.ref.fileId,
        editId,
      });
      expect(edit.before).toBe(html);
      expect(edit.after).toBe(replacement);
    } finally {
      await app.close();
    }
  });
}

test('old report excerpts retain their own sources through the final admission check', async () => {
  const root = test.info().outputPath('old-report-excerpt');
  await mkdir(root, { recursive: true });
  const model = await createModelServer();
  class RevokingKernel extends KernelApplication {
    revokeAfterHistory = false;
    override instructionResources(context: CallContext) {
      const resources = super.instructionResources(context);
      return {
        ...resources,
        describeEvidence: async (evidence: ResourceEvidence) => {
          const result = await resources.describeEvidence(evidence);
          if (this.revokeAfterHistory && context.role === 'host') {
            this.revokeAfterHistory = false;
            await this.call('library.grant', {
              read: true,
              write: true,
              send: false,
              autoBackup: false,
            });
          }
          return result;
        },
      };
    }
  }
  const app = new RevokingKernel(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const { project, entry } = await reportFixture(app, root);
    await app.call('resources.save', {
      ref: entry.ref,
      basis: entry.basis,
      content: '<p>Ordinary replacement</p>',
    });
    const session = await app.call('session.create', { projectId: project.id });
    await writeFile(
      join(project.path, 'report.html'),
      `${encodeReportHeader({
        version: 1,
        resources: [
          {
            path: 'missing.json',
            ref: { source: 'project', projectId: project.id, fileId: 'missing' },
            basis: 'missing',
            mediaType: 'application/json',
          },
        ],
        sources: [],
        objects: [],
      })}\n<p>Unrelated current report</p>`,
    );
    const input = {
      projectId: project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'Inspect the old excerpt',
      materials: [],
      contextItems: [
        {
          kind: 'text' as const,
          itemId: randomUUID(),
          ref: entry.ref,
          basis: entry.basis,
          quote: 'Fixed dose comparison',
          contentState: 'saved' as const,
        },
      ],
    };
    await expect(app.call('session.send', input)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    expect(model.requests).toHaveLength(0);
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    app.revokeAfterHistory = true;
    await expect(app.call('session.send', input)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    expect(app.revokeAfterHistory).toBe(false);
    expect(model.requests).toHaveLength(0);
    expect(
      (await app.snapshot({ projectId: project.id, sessionId: session.id })).messages,
    ).toHaveLength(0);
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    model.hold = true;
    await app.call('session.send', input);
    await expect.poll(() => model.requests.length, { timeout: 25000 }).toBe(1);
    expect(JSON.stringify(model.requests[0])).toContain('Fixed dose comparison');
  } finally {
    model.release();
    await app.close();
    await model.close();
  }
});

test('report undo does not disclose historical bodies or apply an unreportable change', async () => {
  const root = test.info().outputPath('report-undo');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { project, entry } = await reportFixture(app, root);
    const saved = await app.call('resources.save', {
      ref: entry.ref,
      basis: entry.basis,
      content: '<p>Replacement</p>',
    });
    assert(saved.ref.source === 'project');
    const editId = app.projects.get(project.id).editForEvidence(saved.ref.fileId, saved.basis);
    assert(editId);
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    await expect(app.call('files.undo', { projectId: project.id, editId })).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(await readFile(join(project.path, 'report.html'), 'utf8')).toBe('<p>Replacement</p>');
  } finally {
    await app.close();
  }
});

test('a public file save cannot return the old report body after source revocation', async () => {
  const root = test.info().outputPath('report-save-receipt');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { project, html } = await reportFixture(app, root);
    const read = await app.call('files.read', { projectId: project.id, path: 'report.html' });
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    await expect(
      app.call('files.save', {
        projectId: project.id,
        path: 'report.html',
        basis: read.basis,
        content: '<p>Replacement</p>',
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(await readFile(join(project.path, 'report.html'), 'utf8')).toBe(html);
  } finally {
    await app.close();
  }
});

test('undo checks the actual current report path after a Markdown creation is renamed', async () => {
  const root = test.info().outputPath('report-renamed-undo');
  await mkdir(root, { recursive: true });
  const app = new ManualApplication(join(root, 'profile'));
  try {
    await app.initialize();
    const { project, html } = await reportFixture(app, root);
    const edit = await app.call('files.save', {
      projectId: project.id,
      path: 'example.md',
      content: html,
    });
    await app.call('files.rename', {
      projectId: project.id,
      path: 'example.md',
      name: 'renamed.html',
      operationId: randomUUID(),
    });
    await app.call('library.grant', { read: false, write: false, send: false, autoBackup: false });
    await expect(
      app.call('files.undo', { projectId: project.id, editId: edit.id }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(await readFile(join(project.path, 'renamed.html'), 'utf8')).toBe(html);
  } finally {
    await app.close();
  }
});

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
    const { project: target, entry, manifest } = await reportFixture(app, root);
    const localSource = manifest.resources[0];
    assert(localSource);
    assert(localSource.ref.source === 'project');
    const localManifest: ReportManifest = {
      version: 1,
      resources: [{ ...localSource, ref: localSource.ref, mediaType: 'application/json' }],
      objects: manifest.objects,
      sources: [{ ref: localSource.ref, basis: localSource.basis }],
    };
    const localHtml = `${encodeReportHeader(localManifest)}\n<p>Target-local comparison</p>`;
    await app.call('files.save', {
      projectId: target.id,
      path: 'local-report.html',
      content: localHtml,
    });
    const localReport = await app.call('resources.describe', {
      locator: { source: 'project', projectId: target.id, path: 'local-report.html' },
    });
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
    const localDescription = await resources.describe(localReport.ref);
    expect(localDescription.capabilities.write).toBe(false);
    expect(
      (
        await resources.read({
          ref: localReport.ref,
          basis: localReport.basis,
          encoding: 'utf8',
        })
      ).data,
    ).toBe(localHtml);
    assert(localReport.ref.source === 'project');
    expect(
      await targets['project.readTarget']({
        targetProjectId: target.id,
        request: {
          kind: 'readText',
          fileId: localReport.ref.fileId,
          basis: localReport.basis,
        },
      }),
    ).toMatchObject({ kind: 'readText', content: localHtml });
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

for (const version of ['current', 'historical'] as const) {
  test(`a ${version} target-local report excerpt is admitted through the real source session`, async () => {
    const root = test.info().outputPath('target-report-admission');
    await mkdir(root, { recursive: true });
    const model = await createModelServer();
    model.hold = true;
    const app = new KernelApplication(join(root, 'profile'), {
      modelEndpoint: model.url,
      environment: { MINIMAX_CN_API_KEY: 'synthetic' },
    });
    try {
      await app.initialize();
      const { project: target, manifest } = await reportFixture(app, root);
      const dependency = manifest.resources[0];
      assert(dependency?.ref.source === 'project');
      const html = `${encodeReportHeader({
        version: 1,
        resources: [{ ...dependency, ref: dependency.ref, mediaType: 'application/json' }],
        sources: [{ ref: dependency.ref, basis: dependency.basis }],
        objects: [],
      })}\n<p>Target-local comparison</p>`;
      await app.call('files.save', { projectId: target.id, path: 'local.html', content: html });
      const report = await app.call('resources.describe', {
        locator: { source: 'project', projectId: target.id, path: 'local.html' },
      });
      if (version === 'historical') {
        await app.call('resources.save', {
          ref: report.ref,
          basis: report.basis,
          content: '<p>Intermediate</p>',
        });
        await writeFile(
          join(target.path, 'local.html'),
          `${encodeReportHeader({
            version: 1,
            resources: [
              {
                path: 'missing.json',
                ref: { source: 'project', projectId: target.id, fileId: 'missing' },
                basis: 'missing',
                mediaType: 'application/json',
              },
            ],
            sources: [],
            objects: [],
          })}\n<p>Broken current report</p>`,
        );
      }
      const origin = await app.call('project.create', {
        path: join(root, 'origin'),
        trust: 'trusted',
      });
      const session = await app.call('session.create', { projectId: origin.id });
      await app.call('session.send', {
        projectId: origin.id,
        sessionId: session.id,
        instructionId: randomUUID(),
        text: 'Inspect this target excerpt',
        materials: [],
        contextItems: [
          {
            kind: 'text',
            itemId: randomUUID(),
            ref: report.ref,
            basis: report.basis,
            quote: 'Target-local comparison',
            contentState: 'saved',
          },
        ],
      });
      await expect.poll(() => model.requests.length, { timeout: 20000 }).toBe(1);
      expect(JSON.stringify(model.requests[0])).toContain('Target-local comparison');
      expect(JSON.stringify(model.requests[0])).not.toContain('Broken current report');
      expect(
        (await app.snapshot({ projectId: origin.id, sessionId: session.id })).messages.some(
          (message) =>
            message.role === 'user' && message.text.includes('Inspect this target excerpt'),
        ),
      ).toBe(true);
    } finally {
      model.release();
      await app.close();
      await model.close();
    }
  });
}

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
