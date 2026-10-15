import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';

test('live MiniMax saves a checked synthetic research note through the product interface', async () => {
  test.skip(
    process.env.SCHOOLOOM_LIVE_MODEL_TEST !== '1' || !process.env.MINIMAX_CN_API_KEY,
    'Explicit live-model opt-in and injected credentials required',
  );
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-live-'));
  const app = new KernelApplication(join(root, 'profile'));
  await app.initialize();
  const status = {
    protocolVersion,
    nodeVersion: process.versions.node,
    processId: process.pid,
    instanceId: randomUUID(),
    dataDirectory: join(root, 'profile'),
    startedAt: new Date().toISOString(),
    state: 'running' as const,
  };
  const server = await startKernelServer(status, () => app.close(), app);
  const client = createKernelClient({ ...status, url: server.url, token: server.token });
  try {
    await mkdir(join(root, 'project'));
    await writeFile(
      join(root, 'project', 'input.md'),
      '# 合成样本\n\n观测值：2、4、6。仅用于软件验证。\n',
    );
    await client.connect();
    const project = await client.call('project.open', { path: join(root, 'project') });
    await client.call('project.grant', {
      projectId: project.id,
      read: true,
      write: true,
      send: true,
      autoBackup: false,
    });
    const session = await client.call('session.create', { projectId: project.id });
    await client.call('session.send', {
      projectId: project.id,
      sessionId: session.id,
      instructionId: randomUUID(),
      text: '这是一次小型软件验证。只读取 input.md，用 write_file 新建 result.md，内容不超过100字：列出观测数量、合计、算术均值，并说明它是合成样本，不能据此作科研推断。无需额外检索、额外文件或复杂分析。保存后简短答复。',
      materials: ['input.md'],
    });
    await expect
      .poll(
        async () => {
          const snapshot = await client.call('workbench.snapshot', {
            projectId: project.id,
            sessionId: session.id,
          });
          if (snapshot.run?.state === 'failed') throw new Error(snapshot.run.error);
          return snapshot.run?.state;
        },
        { timeout: 70000, intervals: [500, 1000] },
      )
      .toBe('completed');
    const result = await readFile(join(root, 'project', 'result.md'), 'utf8');
    expect(result).toContain('12');
    expect(result).toMatch(/4|四/);
    expect(result).toMatch(/合成|模拟/);
    const snapshot = await client.call('workbench.snapshot', {
      projectId: project.id,
      sessionId: session.id,
    });
    expect(
      snapshot.artifacts.some(
        (artifact) => artifact.path === 'result.md' && artifact.state === 'linked',
      ),
    ).toBe(true);
  } finally {
    client.dispose();
    await server.stop();
    await rm(root, { recursive: true });
  }
});
