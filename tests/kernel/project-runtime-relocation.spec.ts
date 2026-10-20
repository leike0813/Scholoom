import { randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { createModelServer } from '../model-server.js';

test('reopening a moved project rebinds sessions, research records and execution files', async () => {
  test.skip(process.platform === 'win32', 'Windows refuses moving an open SQLite directory');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-runtime-relocation-'));
  const original = join(root, 'original');
  const moved = join(root, 'moved');
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const project = await app.call('project.create', { path: original });
    await app.call('project.grant', {
      projectId: project.id,
      trust: 'trusted',
      autoBackup: false,
    });
    await writeFile(join(original, 'input.md'), '合成实验：结果42，样本数1。');
    const session = await app.call('session.create', { projectId: project.id });
    const scope = { projectId: project.id, sessionId: session.id };
    await app.call('session.send', {
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_RESEARCH 按材料分析方法处理 input.md 并保存报告',
      materials: ['input.md'],
    });
    await expect
      .poll(async () => (await app.call('workbench.snapshot', scope)).run?.state, {
        timeout: 30000,
      })
      .toBe('completed');
    const attempts = await app.call('research.attempts', scope);
    expect(attempts.attempts[0]?.delivery).toBe('usable');
    const report = await readFile(join(original, 'analysis.md'), 'utf8');
    await rename(original, moved);
    const reopened = await app.call('project.open', { path: moved });
    expect(reopened.id).toBe(project.id);
    expect(reopened.path).toBe(moved);
    expect(reopened.name).toBe('moved');
    expect((await app.call('workbench.snapshot', scope)).session?.id).toBe(session.id);
    expect(await app.call('research.attempts', scope)).toEqual(attempts);
    const next = await app.call('session.create', { projectId: project.id });
    const nextScope = { projectId: project.id, sessionId: next.id };
    const accepted = await app.call('session.send', {
      ...nextScope,
      instructionId: randomUUID(),
      text: 'MODEL_FIXTURE 读取 input.md 并保存 result.md',
      materials: ['input.md'],
    });
    await expect
      .poll(async () => (await app.call('workbench.snapshot', nextScope)).run?.state, {
        timeout: 30000,
      })
      .toBe('completed');
    expect((await app.call('workbench.snapshot', nextScope)).artifacts).toContainEqual(
      expect.objectContaining({ path: 'result.md', runId: accepted.runId, state: 'linked' }),
    );
    expect(await readFile(join(moved, 'result.md'), 'utf8')).toContain('合成样本');
    expect(await readFile(join(moved, 'analysis.md'), 'utf8')).toBe(report);
    await expect(access(original)).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
