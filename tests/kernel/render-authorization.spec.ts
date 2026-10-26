import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import type { CallContext } from '../../packages/protocol/dist/core.js';
import { createModelServer } from '../model-server.js';

class ExecutionApplication extends KernelApplication {
  context: CallContext | undefined;

  override projectTargetRead(context: CallContext) {
    this.context = context;
    return super.projectTargetRead(context);
  }
}

test('real harness render resources enforce ownership, target scope and current project trust', async () => {
  test.setTimeout(240000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-render-authorization-'));
  const model = await createModelServer();
  model.hold = true;
  const app = new ExecutionApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    const foreign = await app.call('project.create', {
      path: join(root, 'foreign'),
      trust: 'trusted',
    });
    const render = async (projectId: string, text: string) => {
      await app.call('files.save', {
        projectId,
        path: 'main.tex',
        content: `\\documentclass{article}\n\\begin{document}\n${text}\n\\end{document}\n`,
      });
      let job = await app.call('editor.render', {
        projectId,
        path: 'main.tex',
        format: 'pdf',
        operationId: randomUUID(),
      });
      await expect
        .poll(
          async () => {
            job = await app.call('editor.job', { projectId, jobId: job.id });
            return ['queued', 'running', 'cancelling'].includes(job.state);
          },
          { timeout: 180000 },
        )
        .toBe(false);
      expect(job.state, job.log).toBe('completed');
      assert(job.output && job.fileId);
      const ref = { source: 'render' as const, projectId, outputId: job.output.id };
      const descriptor = await app.call('resources.describe', { locator: ref });
      expect(descriptor.render).toMatchObject({
        jobId: job.id,
        input: { ref: { source: 'project', projectId, fileId: job.fileId }, basis: job.basis },
      });
      return { descriptor, fileId: job.fileId };
    };
    const ownOutput = await render(project.id, 'Authorized render evidence 73.');
    const foreignOutput = await render(foreign.id, 'Foreign render evidence 91.');
    const session = await app.call('session.create', { projectId: project.id });
    await app.call('session.send', {
      projectId: project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: 'MODEL_CHAT Hold this synthetic authorization turn.',
      materials: [],
    });
    await expect.poll(() => model.requests.length).toBe(1);
    const context = app.context;
    assert(context);
    expect(context).toMatchObject({
      projectId: project.id,
      sessionId: session.id,
      role: 'execution',
      principal: { kind: 'agent', id: session.id },
    });
    const port = app.executionResources(context);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=',
      'base64',
    );
    await writeFile(join(root, 'project', 'chart.png'), png);
    const image = await port.describe({
      source: 'project',
      projectId: project.id,
      path: 'chart.png',
    });
    const imageBytes = await port.read({ ref: image.ref, basis: image.basis, encoding: 'base64' });
    expect(Buffer.from(imageBytes.data, 'base64')).toEqual(png);
    const { ref, basis } = ownOutput.descriptor;
    const resource = await port.describe(ref);
    expect(resource).toEqual(ownOutput.descriptor);
    expect(resource.capabilities.write).toBe(false);
    const bytes = await port.read({ ref, basis, encoding: 'base64', limit: 512 });
    expect(Buffer.from(bytes.data, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    const page = await port.document({ ref, basis }, 'readPdfPage', { pageIndex: 0 });
    expect(page.text).toContain('Authorized render evidence 73');
    await expect(
      port.read({ ref, basis: 'wrong-output-basis', encoding: 'base64' }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await expect(
      port.document({ ref, basis: 'wrong-output-basis' }, 'readPdfPage', { pageIndex: 0 }),
    ).rejects.toMatchObject({ code: 'contentChanged' });
    await expect(port.save({ ref, basis, content: 'replace the output' })).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(port.describe(foreignOutput.descriptor.ref)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(
      port.read({
        ref: foreignOutput.descriptor.ref,
        basis: foreignOutput.descriptor.basis,
        encoding: 'base64',
      }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(
      port.document(foreignOutput.descriptor, 'readPdfPage', { pageIndex: 0 }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });

    // Narrow the real execution's target range while retaining its host-bound principal.
    const targeted = app.executionResources({
      ...context,
      targetRead: { targetProjectId: foreign.id, access: 'read' },
    });
    const targetSource = await targeted.describe({
      source: 'project',
      projectId: foreign.id,
      fileId: foreignOutput.fileId,
    });
    expect(targetSource.capabilities).toMatchObject({ read: true, write: false });
    for (const descriptor of [ownOutput.descriptor, foreignOutput.descriptor]) {
      await expect(targeted.describe(descriptor.ref)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
      await expect(
        targeted.read({ ref: descriptor.ref, basis: descriptor.basis, encoding: 'base64' }),
      ).rejects.toMatchObject({ code: 'permissionDenied' });
    }
    expect((await port.document({ ref, basis }, 'readPdfPage', { pageIndex: 0 })).text).toContain(
      'Authorized render evidence 73',
    );
    await app.call('project.grant', {
      projectId: project.id,
      trust: 'restricted',
      autoBackup: false,
    });
    await expect(port.describe(ref)).rejects.toMatchObject({ code: 'permissionDenied' });
    await expect(port.read({ ref, basis, encoding: 'base64' })).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    await expect(
      port.document({ ref, basis }, 'readPdfPage', { pageIndex: 0 }),
    ).rejects.toMatchObject({ code: 'permissionDenied' });
    expect(model.requests).toHaveLength(1);
  } finally {
    model.release();
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
