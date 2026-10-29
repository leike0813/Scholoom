import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { encodeReportHeader } from '../../packages/editor/dist/report-codec.js';
import type { RunInstance } from '../../packages/harness/dist/node.js';
import type {
  CallContext,
  ReportManifest,
  ResourceEvidence,
} from '../../packages/protocol/dist/index.js';
import { reportFixture } from '../fixtures/report.js';
import { createModelServer, type ModelServer } from '../model-server.js';

class ObservedKernel extends KernelApplication {
  source: CallContext | undefined;
  readonly targets = new Map<string, CallContext>();

  override projectTargetRead(context: CallContext) {
    const port = super.projectTargetRead(context);
    if (context.role === 'execution' && context.instanceId) {
      if (context.targetRead) this.targets.set(context.targetRead.targetProjectId, context);
      else this.source ??= context;
    }
    return port;
  }

  // Host-only test binding: the ordinary worker resource/tool port stays unchanged.
  readVersion(context: CallContext, input: ResourceEvidence) {
    return this.broker
      .consumer(context, ['resources.reportVersion'])
      .call('resources.reportVersion', input);
  }
}

function identity(context: CallContext | undefined) {
  if (!context) return undefined;
  const { moduleId, principal, projectId, sessionId, runId, instanceId, workDomain, targetRead } =
    context;
  return { moduleId, principal, projectId, sessionId, runId, instanceId, workDomain, targetRead };
}

async function withKernel(
  root: string,
  run: (app: ObservedKernel, model: ModelServer, facts: Record<string, unknown>) => Promise<void>,
) {
  await mkdir(root, { recursive: true });
  const model = await createModelServer();
  model.hold = true;
  const app = new ObservedKernel(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  const facts: Record<string, unknown> = {};
  const closed = { app: false, model: false };
  try {
    await app.initialize();
    await run(app, model, facts);
  } finally {
    facts.source = identity(app.source);
    facts.targets = [...app.targets.values()].map(identity);
    facts.modelRequests = model.requests.length;
    await writeFile(join(root, 'evidence.json'), JSON.stringify(facts, null, 2));
    await writeFile(join(root, 'model-exchange.json'), JSON.stringify(model.requests, null, 2));
    model.release();
    try {
      await app.close();
      closed.app = true;
    } finally {
      await model.close();
      closed.model = true;
      await writeFile(join(root, 'closed.json'), JSON.stringify(closed));
    }
  }
}

async function execution(app: ObservedKernel, model: ModelServer, projectId: string) {
  const session = await app.call('session.create', { projectId });
  const scope = { projectId, sessionId: session.id };
  const instructionId = randomUUID();
  const sent = await app.call('session.send', {
    ...scope,
    instructionId,
    text: 'MODEL_CHAT hold exact-version authorization boundary',
    materials: [],
  });
  await expect.poll(() => model.requests.length).toBe(1);
  await expect.poll(() => app.source?.runId).toBe(sent.runId);
  assert(app.source);
  const context = app.source;
  expect(identity(context)).toMatchObject({
    moduleId: 'harness',
    principal: { kind: 'agent', id: session.id },
    ...scope,
    runId: sent.runId,
    instanceId: expect.any(String),
  });
  const instances = () =>
    (
      app.projects
        .get(projectId)
        .database.prepare('SELECT value FROM run_instances WHERE run_id = ?')
        .all(sent.runId) as { value: string }[]
    ).map(({ value }) => JSON.parse(value) as RunInstance);
  await expect
    .poll(() => instances().find((item) => item.instanceId === context.instanceId)?.state)
    .toBe('running');
  return {
    context,
    scope,
    instructionId,
    sent,
    stop: async () => {
      await app.call('session.cancel', scope);
      await expect.poll(() => instances().map((item) => item.state)).toEqual(['exited']);
      const history = await app.harness.executions({ ...scope, instructionId });
      expect(history.instruction?.id).toBe(instructionId);
      expect(history.runs.map((item) => item.id)).toEqual([sent.runId]);
      return { instances: instances(), history };
    },
  };
}

test('real Agent identity reads the original report only while its original read/send authority holds', async () => {
  const root = test.info().outputPath('agent-version');
  await withKernel(root, async (app, model, facts) => {
    const { project, entry, manifest } = await reportFixture(app, root);
    const active = await execution(app, model, project.id);
    const original = { ref: entry.ref, basis: entry.basis };
    facts.execution = {
      scope: active.scope,
      sent: active.sent,
      instructionId: active.instructionId,
    };
    await expect(app.readVersion(active.context, original)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const allowed = await app.readVersion(active.context, original);
    assert(allowed.state === 'available');
    expect(allowed.snapshot.manifest).toEqual(manifest);
    expect(allowed.snapshot.resource.basis).toBe(entry.basis);
    facts.allowed = allowed;
    await expect(
      app.readVersion({ ...active.context, instanceId: randomUUID() }, original),
    ).rejects.toMatchObject({ code: 'instanceMismatch' });
    await expect(
      app.readVersion(active.context, { ...original, basis: 'unrecorded-original-version' }),
    ).rejects.toMatchObject({ code: 'unavailable' });

    const dependency = manifest.resources[0];
    assert(dependency?.ref.source === 'project');
    const nextManifest: ReportManifest = {
      version: 1,
      resources: [{ ...dependency, ref: dependency.ref, mediaType: 'application/json' }],
      sources: [],
      objects: [],
    };
    const next = await app.call('resources.save', {
      ...original,
      content: `${encodeReportHeader(nextManifest)}\n<p>New report without the original source</p>`,
    });
    await app.call('library.grant', { read: true, write: true, send: false, autoBackup: false });
    app.library.check('read');
    const current = await app.readVersion(active.context, { ref: next.ref, basis: next.basis });
    assert(current.state === 'available');
    expect(current.snapshot.manifest.sources).toEqual([]);
    await expect(app.readVersion(active.context, original)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await app.call('library.grant', { read: false, write: false, send: true, autoBackup: false });
    app.library.check('send');
    await expect(app.readVersion(active.context, original)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    facts.current = current;
    facts.stopped = await active.stop();
  });
});

test('an actual single-target context reads registered local report files without expanding its sources', async () => {
  const root = test.info().outputPath('target-version');
  await withKernel(root, async (app, model, facts) => {
    const { project: target, entry, manifest } = await reportFixture(app, root);
    await app.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
    const dependency = manifest.resources[0];
    assert(dependency?.ref.source === 'project');
    const localManifest: ReportManifest = {
      version: 1,
      resources: [{ ...dependency, ref: dependency.ref, mediaType: 'application/json' }],
      sources: [{ ref: dependency.ref, basis: dependency.basis }],
      objects: [],
    };
    await app.call('files.save', {
      projectId: target.id,
      path: 'local.html',
      content: `${encodeReportHeader(localManifest)}\n<p>Registered target-local report</p>`,
    });
    const local = await app.call('resources.describe', {
      locator: { source: 'project', projectId: target.id, path: 'local.html' },
    });
    const third = await app.call('project.create', { path: join(root, 'third'), trust: 'trusted' });
    await app.call('files.save', {
      projectId: third.id,
      path: 'third.md',
      content: 'Third source.',
    });
    const thirdSource = await app.call('resources.describe', {
      locator: { source: 'project', projectId: third.id, path: 'third.md' },
    });
    await app.call('files.save', {
      projectId: target.id,
      path: 'third-report.html',
      content: `${encodeReportHeader({
        ...localManifest,
        sources: [{ ref: thirdSource.ref, basis: thirdSource.basis }],
      })}\n<p>Report requiring a third project</p>`,
    });
    const thirdReport = await app.call('resources.describe', {
      locator: { source: 'project', projectId: target.id, path: 'third-report.html' },
    });
    const origin = await app.call('project.create', {
      path: join(root, 'origin'),
      trust: 'trusted',
    });
    const active = await execution(app, model, origin.id);
    facts.execution = {
      scope: active.scope,
      sent: active.sent,
      instructionId: active.instructionId,
    };
    const references = () =>
      app.projects
        .get(target.id)
        .database.prepare('SELECT id, path, value FROM file_references ORDER BY id')
        .all();
    const before = references();
    // This production port constructs targetRead and checks the original registered target.
    await app.executionResources(active.context).describe(local.ref);
    const context = app.targets.get(target.id);
    assert(context);
    expect(context.targetRead).toEqual({ targetProjectId: target.id, access: 'read' });
    expect(context.principal).toEqual(active.context.principal);
    expect(context.instanceId).toBe(active.context.instanceId);
    const allowed = await app.readVersion(context, { ref: local.ref, basis: local.basis });
    assert(allowed.state === 'available');
    expect(allowed.snapshot.manifest).toEqual(localManifest);
    expect(allowed.snapshot.resource.capabilities.write).toBe(false);
    for (const report of [entry, thirdReport]) {
      await expect(
        app.readVersion(context, { ref: report.ref, basis: report.basis }),
      ).rejects.toMatchObject({ code: 'unavailable' });
    }
    await expect(
      app.readVersion(context, { ref: thirdSource.ref, basis: thirdSource.basis }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(references()).toEqual(before);
    app.projects.get(target.id).grant({ trust: 'restricted', autoBackup: false });
    await expect(
      app.readVersion(context, { ref: local.ref, basis: local.basis }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    facts.allowed = allowed;
    facts.stopped = await active.stop();
  });
});
