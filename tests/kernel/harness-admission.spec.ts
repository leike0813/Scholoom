import { randomUUID } from 'node:crypto';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { OperationError } from '../../packages/protocol/dist/core.js';

test('host final admission rejects before acceptance and does not reopen an accepted replay', async () => {
  // @ts-expect-error Existing source-only public fixture.
  const { graphs } = await import('../fixtures/domain-execution-worker/graphs.mjs');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-admission-'));
  const app = new KernelApplication(join(root, 'profile'), {
    environment: {},
    executionGraphs: graphs,
    workerEntry: new URL('../fixtures/domain-execution-worker/worker.mjs', import.meta.url),
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', {
      path: join(root, 'project'),
      trust: 'trusted',
    });
    await app.call('files.save', {
      projectId: project.id,
      path: 'input.md',
      content: 'Synthetic admission evidence.',
    });
    const material = await app.call('resources.describe', {
      locator: { source: 'project', projectId: project.id, path: 'input.md' },
    });
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    const input = {
      ...scope,
      instructionId: randomUUID(),
      text: 'Run a public calibration.',
      materials: [],
    };
    const selection = {
      kind: 'registered' as const,
      graphId: 'durable-resource',
      version: '1',
      config: { outputPath: 'result.md', operationId: 'admission-result' },
      materials: [{ ref: material.ref, basis: material.basis }],
      workDomain: { kind: 'project' as const, ...scope },
    };
    const denied = () => {
      throw new OperationError('permissionDenied', 'Synthetic admission denial');
    };
    await expect(app.harness.send(input, undefined, selection, denied)).rejects.toMatchObject({
      code: 'permissionDenied',
    });
    const before = await app.snapshot(scope);
    expect(before.run).toBeUndefined();
    expect(before.messages).toEqual([]);
    await expect(stat(join(project.path, 'result.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    const receipt = await app.harness.send(input, undefined, selection, () => {});
    await expect
      .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
      .toBe('waiting');
    expect(await app.harness.send(input, undefined, selection, denied)).toEqual(receipt);
    expect((await app.snapshot(scope)).run?.id).toBe(receipt.runId);
  } finally {
    await app.close();
  }
});
