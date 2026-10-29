import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { KernelClient } from '../../packages/client/dist/index.js';
import type { ResearchGraphStart } from '../../packages/protocol/dist/research.js';
import { graphArtifactOperation } from '../../packages/research/dist/node.js';
import { startReportKernel } from '../fixtures/report-reconnection/connection.js';

async function setup(client: KernelClient, root: string) {
  const project = await client.call('project.create', {
    path: join(root, 'project'),
    trust: 'trusted',
  });
  await mkdir(join(project.path, 'assets'));
  await client.call('files.save', {
    projectId: project.id,
    path: 'assets/data.json',
    content: '[10,20]',
  });
  const data = await client.call('resources.describe', {
    locator: { source: 'project', projectId: project.id, path: 'assets/data.json' },
  });
  await client.call('library.grant', { read: true, write: true, send: true, autoBackup: false });
  const sourcePath = join(root, 'source.md');
  await writeFile(sourcePath, '# Synthetic source\nDose 10 and 20; sample size 1.\n');
  const batch = await client.call('library.importFiles', {
    batchId: randomUUID(),
    paths: [sourcePath],
    storage: 'managed',
    purpose: '正文',
    version: 'unspecified',
    origin: 'report-reconnection-test',
  });
  await expect
    .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
    .toBe('completed');
  const imported = (await client.call('library.batch', { batchId: batch.id })).entries[0];
  assert(imported?.attachmentId);
  const attachment = await client.call('library.attachment', {
    attachmentId: imported.attachmentId,
  });
  const source = await client.call('resources.describe', {
    locator: {
      source: 'library',
      attachmentId: attachment.id,
      materialVersionId: attachment.materialVersionId,
    },
  });
  const session = await client.call('session.create', { projectId: project.id });
  const scope = { projectId: project.id, sessionId: session.id };
  const input: ResearchGraphStart = {
    ...scope,
    graphId: 'scholoom.test.report-reconnection',
    version: '1',
    invocationId: randomUUID(),
    instructionId: randomUUID(),
    config: { mode: 'publish' },
    materials: [
      { ref: data.ref, basis: data.basis },
      { ref: source.ref, basis: source.basis },
    ],
    text: 'Publish a synthetic report and wait for explicit confirmation.',
  };
  return { project, data, source, scope, input };
}

async function call(client: KernelClient, input: ResearchGraphStart) {
  const result = await client.call('research.graphCalls', {
    projectId: input.projectId,
    sessionId: input.sessionId,
    invocationId: input.invocationId,
  });
  expect(result.calls).toHaveLength(1);
  const value = result.calls[0];
  assert(value);
  return value;
}

async function waitFor(
  client: KernelClient,
  input: ResearchGraphStart,
  state: 'waiting' | 'completed',
) {
  await expect
    .poll(
      async () => {
        const snapshot = await client.call('workbench.snapshot', {
          projectId: input.projectId,
          sessionId: input.sessionId,
        });
        if (snapshot.run?.state === 'failed') throw new Error(JSON.stringify(snapshot.run));
        return snapshot.run?.state;
      },
      { timeout: 20000 },
    )
    .toBe(state);
  return client.call('workbench.snapshot', {
    projectId: input.projectId,
    sessionId: input.sessionId,
  });
}

test('a valid report and its registered wait survive client disconnect, reconnect and ordinary-kernel restart', async () => {
  const info = test.info();
  const root = info.outputPath('workspace');
  await mkdir(root, { recursive: true });
  const profile = join(root, 'profile');
  let kernel = await startReportKernel(profile, join(root, 'kernel-first.log'));
  let client = await kernel.connect();
  const ownership: unknown[] = [kernel.identity];
  try {
    const f = await setup(client, root);
    const receipt = await client.call('research.requestGraph', f.input);
    const waiting = await waitFor(client, f.input, 'waiting');
    const firstCall = await call(client, f.input);
    expect(firstCall.call).toMatchObject({
      invocationId: f.input.invocationId,
      instructionId: f.input.instructionId,
    });
    expect(firstCall.executions).toHaveLength(1);
    expect(waiting.run).toMatchObject({
      id: receipt.runId,
      state: 'waiting',
      graph: { wait: { nodeKey: 'confirm' } },
      graphProgress: { kind: 'graph.waiting' },
    });
    const wait = waiting.run?.graph?.wait;
    assert(wait);
    const creation = waiting.run?.graphProgress?.evidence.creations?.[0];
    assert(creation?.state === 'complete');
    expect(creation.association?.state).toBe('confirmed');
    expect(creation.operationId).toBe(graphArtifactOperation(f.input.instructionId, 'report'));
    expect(waiting.run?.graphProgress?.evidence.reads).toEqual(f.input.materials);
    const report = creation.resource;
    assert(report.ref.source === 'project');
    const publication = (
      await client.call('files.changes', { projectId: f.project.id, fileId: report.ref.fileId })
    ).changes[0];
    assert(publication?.origin?.kind === 'execution');
    expect(publication.editId).toBe(creation.editId);
    expect(publication.origin).toMatchObject({
      projectId: f.project.id,
      sessionId: f.scope.sessionId,
      runId: receipt.runId,
      principal: { kind: 'agent', id: f.scope.sessionId },
    });
    const reportSnapshot = await client.call('resources.report', {
      ref: report.ref,
      basis: report.basis,
    });
    expect(reportSnapshot.manifest).toEqual({
      version: 1,
      resources: [
        {
          path: 'assets/data.json',
          ref: f.data.ref,
          basis: f.data.basis,
          mediaType: 'application/json',
        },
      ],
      sources: [{ ref: f.source.ref, basis: f.source.basis }],
      objects: [
        {
          objectId: 'dose',
          name: 'Doses',
          semantics: 'Compare doses 10 and 20',
          sourceIndexes: [0],
        },
      ],
    });
    const reportPath = join(f.project.path, 'report.html');
    const html = await readFile(reportPath, 'utf8');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<td>10</td>');
    expect(html).toContain('<td>20</td>');
    expect(html).toContain('Next step: verify dose 20');
    const identity = await stat(reportPath, { bigint: true });
    const checkpointPath = join(
      f.project.path,
      '.scholoom',
      'harness',
      'checkpoints',
      `${receipt.runId}.sqlite`,
    );
    expect((await stat(checkpointPath)).size).toBeGreaterThan(0);

    // This closes the actual WS client only. The ordinary server/child remain alive.
    const firstKernel = kernel.identity;
    client.dispose();
    expect(client.getSnapshot().phase).toBe('disconnected');
    expect(kernel.alive()).toBe(true);
    client = await kernel.connect();
    expect(client.getSnapshot().status).toMatchObject({
      instanceId: firstKernel.instanceId,
      processId: firstKernel.processId,
    });
    const reconnected = await client.call('workbench.watch', f.scope);
    expect(reconnected.run).toEqual(waiting.run);
    expect(await call(client, f.input)).toEqual(firstCall);
    expect(await client.call('resources.report', { ref: report.ref, basis: report.basis })).toEqual(
      reportSnapshot,
    );
    expect(
      (
        await client.call('resources.read', {
          ref: report.ref,
          basis: report.basis,
          encoding: 'utf8',
        })
      ).data,
    ).toBe(html);
    expect((await client.call('workbench.snapshot', f.scope)).run).toEqual(waiting.run);

    // Explicit owned shutdown/restart is a separate step from the client disconnect above.
    client.dispose();
    ownership.push(await kernel.stop());
    kernel = await startReportKernel(profile, join(root, 'kernel-restarted.log'));
    ownership.push(kernel.identity);
    client = await kernel.connect();
    expect(kernel.identity.instanceId).not.toBe(firstKernel.instanceId);
    expect(kernel.identity.processId).not.toBe(firstKernel.processId);
    const restored = await client.call('workbench.watch', f.scope);
    expect(restored.run).toEqual(waiting.run);
    expect(restored.run?.graph?.wait).toEqual(wait);
    expect(await call(client, f.input)).toEqual(firstCall);
    expect(await client.call('resources.report', { ref: report.ref, basis: report.basis })).toEqual(
      reportSnapshot,
    );
    expect(
      (
        await client.call('resources.read', {
          ref: report.ref,
          basis: report.basis,
          encoding: 'utf8',
        })
      ).data,
    ).toBe(html);
    expect((await client.call('workbench.snapshot', f.scope)).run).toEqual(waiting.run);
    await expect(stat(join(f.project.path, 'continuation.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const resumeId = randomUUID();
    const resumed = await client.call('session.send', {
      ...f.scope,
      instructionId: resumeId,
      text: '{"confirm":true}',
      materials: [],
    });
    expect(resumed.runId).toBe(receipt.runId);
    const completed = await waitFor(client, f.input, 'completed');
    expect(completed.messages.find((message) => message.id === resumeId)?.state).toBe('consumed');
    expect(completed.messages.find((message) => message.id === f.input.instructionId)?.state).toBe(
      'consumed',
    );
    const continuation = JSON.parse(
      await readFile(join(f.project.path, 'continuation.json'), 'utf8'),
    );
    expect(continuation.waitId).toBe(wait.waitId);
    expect(
      continuation.instructions.map(
        (instruction: { instructionId: string }) => instruction.instructionId,
      ),
    ).toContain(resumeId);
    expect(continuation.reads[0]).toMatchObject({
      ref: report.ref,
      basis: report.basis,
      data: html,
    });
    expect(continuation.reads[2]).toMatchObject({
      ref: f.source.ref,
      basis: f.source.basis,
      data: '# Synthetic source\nDose 10 and 20; sample size 1.\n',
    });
    const continuedCreation = completed.run?.graphProgress?.evidence.creations?.[1];
    assert(
      continuedCreation?.state === 'complete' &&
        continuedCreation.resource.ref.source === 'project',
    );
    const continuedEdit = (
      await client.call('files.changes', {
        projectId: f.project.id,
        fileId: continuedCreation.resource.ref.fileId,
      })
    ).changes[0];
    assert(continuedEdit?.origin?.kind === 'execution');
    expect(continuedEdit.origin).toMatchObject({
      sessionId: f.scope.sessionId,
      runId: receipt.runId,
    });
    expect(continuedEdit.origin.instanceId).not.toBe(publication.origin.instanceId);
    expect((await call(client, f.input)).call).toEqual(firstCall.call);
    expect(await readFile(reportPath, 'utf8')).toBe(html);
    expect((await stat(reportPath, { bigint: true })).ino).toBe(identity.ino);
    expect(
      await client.call('resources.creation', {
        projectId: f.project.id,
        operationId: creation.operationId,
      }),
    ).toEqual(creation);

    const freshSession = await client.call('session.create', { projectId: f.project.id });
    const freshInput: ResearchGraphStart = {
      ...f.input,
      sessionId: freshSession.id,
      invocationId: randomUUID(),
      instructionId: randomUUID(),
      config: { mode: 'read-saved' },
      materials: [
        { ref: report.ref, basis: report.basis },
        { ref: f.source.ref, basis: f.source.basis },
      ],
      text: 'Continue only from the saved report and its explicit source.',
    };
    await client.call('research.requestGraph', freshInput);
    const fresh = await waitFor(client, freshInput, 'completed');
    expect(
      fresh.messages.some(
        (message) => message.id === resumeId || message.id === f.input.instructionId,
      ),
    ).toBe(false);
    const freshReads = JSON.parse(await readFile(join(f.project.path, 'fresh-read.json'), 'utf8'));
    expect(freshReads).toHaveLength(2);
    expect(freshReads[0]).toMatchObject({ ref: report.ref, basis: report.basis, data: html });
    expect(freshReads[1]).toMatchObject({
      ref: f.source.ref,
      basis: f.source.basis,
      data: '# Synthetic source\nDose 10 and 20; sample size 1.\n',
    });
    expect(fresh.run?.graphProgress?.evidence.reads).toEqual(freshInput.materials);
    const freshCreation = fresh.run?.graphProgress?.evidence.creations?.[0];
    assert(freshCreation?.state === 'complete');
    expect(freshCreation.association?.state).toBe('confirmed');
    await writeFile(
      info.outputPath('evidence.json'),
      JSON.stringify(
        {
          ownership,
          invocation: firstCall.call,
          receipt,
          publication,
          continuedEdit,
          wait,
          report,
          reportSnapshot,
          waiting: waiting.run,
          reconnected: reconnected.run,
          restored: restored.run,
          completed: completed.run,
          resumeId,
          continuation,
          fresh: fresh.run,
        },
        null,
        2,
      ),
    );
  } finally {
    client.dispose();
    ownership.push(await kernel.stop());
    await writeFile(info.outputPath('ownership.json'), JSON.stringify(ownership, null, 2));
  }
});

test('source revocation rejects report reads and blocks accepted continuation without losing the report', async () => {
  const info = test.info();
  const root = info.outputPath('workspace');
  await mkdir(root, { recursive: true });
  const kernel = await startReportKernel(join(root, 'profile'), join(root, 'kernel.log'));
  const client = await kernel.connect();
  try {
    const f = await setup(client, root);
    const receipt = await client.call('research.requestGraph', f.input);
    const waiting = await waitFor(client, f.input, 'waiting');
    const creation = waiting.run?.graphProgress?.evidence.creations?.[0];
    assert(creation?.state === 'complete');
    const bytes = await readFile(join(f.project.path, 'report.html'));
    await client.call('library.grant', {
      read: false,
      write: false,
      send: false,
      autoBackup: false,
    });
    await expect(
      client.call('resources.report', {
        ref: creation.resource.ref,
        basis: creation.resource.basis,
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    const instructionId = randomUUID();
    const accepted = await client.call('session.send', {
      ...f.scope,
      instructionId,
      text: '{"confirm":true}',
      materials: [],
    });
    expect(accepted.runId).toBe(receipt.runId);
    await expect
      .poll(async () => (await client.call('workbench.snapshot', f.scope)).run?.state, {
        timeout: 20000,
      })
      .toBe('failed');
    const after = await client.call('workbench.snapshot', f.scope);
    expect(after.run?.id).toBe(receipt.runId);
    expect(after.run?.graph?.originInstructionId).toBe(f.input.instructionId);
    // Consumed confirms checkpoint delivery of the control message, not permission to read sources.
    expect(after.messages.find((message) => message.id === instructionId)?.state).toBe('consumed');
    expect(after.run?.graph?.wait).toEqual(waiting.run?.graph?.wait);
    expect(await readFile(join(f.project.path, 'report.html'))).toEqual(bytes);
    await expect(stat(join(f.project.path, 'continuation.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await writeFile(
      info.outputPath('revocation.json'),
      JSON.stringify(
        {
          kernel: kernel.identity,
          receipt,
          accepted,
          wait: after.run?.graph?.wait,
          report: creation.resource,
          consumedInstructionId: instructionId,
          run: after.run,
        },
        null,
        2,
      ),
    );
  } finally {
    client.dispose();
    await writeFile(
      info.outputPath('ownership.json'),
      JSON.stringify(await kernel.stop(), null, 2),
    );
  }
});
