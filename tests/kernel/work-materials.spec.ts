import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { createModelServer } from '../model-server.js';

test('a fresh session carries work from persisted material without old messages or checkpoint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-work-materials-'));
  const model = await createModelServer();
  const options = { modelEndpoint: model.url, environment: { MINIMAX_CN_API_KEY: 'synthetic' } };
  let app = new KernelApplication(join(root, 'profile'), options);
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ trust: 'trusted', autoBackup: false });
    await project.save('input.md', '合成观测42。');
    const old = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: old.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_WORK_PLAN previous_private_conversation_73',
      materials: ['input.md'],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('completed');
    expect(
      (await app.snapshot(scope)).artifacts.some((artifact) => artifact.path === 'workspace.md'),
    ).toBe(true);
    await app.close();
    app = new KernelApplication(join(root, 'profile'), options);
    await app.initialize();
    const fresh = app.harness.create(project.project.id);
    const next = { projectId: project.project.id, sessionId: fresh.id };
    await app.harness.send({
      ...next,
      instructionId: randomUUID(),
      text: 'MODEL_WORK_MATERIALS 请从项目已有工作记录接续，读取核查后保存下一步。',
      materials: ['workspace.md'],
    });
    await expect.poll(async () => (await app.snapshot(next)).run?.state).toBe('completed');
    const request = JSON.stringify(model.requests.at(-1)?.messages);
    expect(request).toContain('目标：核查观测42');
    expect(request).toContain('决定：保留样本限制');
    expect(request).not.toContain('previous_private_conversation_73');
    expect(await readFile(join(root, 'project', 'continued.md'), 'utf8')).toContain('workspace.md');
    expect(await readFile(join(root, 'project', 'workspace.md'), 'utf8')).toContain('样本观测为42');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});

test('failure to save the required tool receipt prevents its file effect while manual work remains usable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scholoom-work-save-failure-'));
  const model = await createModelServer();
  const app = new KernelApplication(join(root, 'profile'), {
    modelEndpoint: model.url,
    environment: { MINIMAX_CN_API_KEY: 'synthetic' },
  });
  try {
    await app.initialize();
    const project = await app.projects.create(join(root, 'project'));
    project.grant({ trust: 'trusted', autoBackup: false });
    await project.save('input.md', '合成观测42。');
    project.database.exec(
      "CREATE TRIGGER fail_required_receipt BEFORE INSERT ON harness_meta WHEN (CASE WHEN NEW.key LIKE 'tool:%' THEN json_extract(NEW.value, '$.name') END) = 'write_file' BEGIN SELECT RAISE(ABORT, 'synthetic required record failure'); END",
    );
    const session = app.harness.create(project.project.id);
    const scope = { projectId: project.project.id, sessionId: session.id };
    await app.harness.send({
      ...scope,
      instructionId: randomUUID(),
      text: 'MODEL_WORK_PLAN 保存工作记录后再推进',
      materials: ['input.md'],
    });
    await expect.poll(async () => (await app.snapshot(scope)).run?.state).toBe('failed');
    expect(model.requests).toHaveLength(2);
    await expect(readFile(join(root, 'project', 'workspace.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await app.call('files.save', {
      projectId: project.project.id,
      path: 'manual.md',
      content: '独立人工工作保留。',
    });
    expect(
      (await app.call('files.read', { projectId: project.project.id, path: 'manual.md' })).content,
    ).toBe('独立人工工作保留。');
  } finally {
    await app.close();
    await model.close();
    await rm(root, { recursive: true });
  }
});
