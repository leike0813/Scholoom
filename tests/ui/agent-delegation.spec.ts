import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { DelegationRequest } from '../../packages/protocol/dist/index.js';
import { delegationModel } from '../fixtures/delegation-model.js';
import { runningKernel } from '../kernel-fixture.js';
import { startModelKernel } from '../model-kernel.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

for (const cancel of [false, true]) {
  test(`user observes actual delegation, ${cancel ? 'cancels its child' : 'opens its saved report'} and retains the conversation draft`, async ({
    uiPage,
  }) => {
    test.setTimeout(120000);
    const root = await mkdtemp(join(tmpdir(), 'scholoom-delegation-ui-'));
    const path = join(root, `delegation-${randomUUID().slice(0, 8)}`);
    const work: DelegationRequest = {
      delegationId: randomUUID(),
      roleId: 'worker',
      roleVersion: '1',
      tools: ['resource.read', 'resource.create', 'resource.creation', 'scratch'],
      workPackage: {
        objective: 'CHILD_DELEGATION Check the original material.',
        requirements: 'Save report.md.',
        materials: [],
        outputs: [{ kind: 'create', path: 'report.md' }],
      },
    };
    const model = await delegationModel(work, { childHold: cancel });
    const directory = process.env.SCHOOLOOM_UI_DATA_DIR!;
    const stop = await startModelKernel(directory, model.url);
    const client = createKernelClient(await runningKernel(directory));
    await client.connect();
    try {
      await client.call('provider.configure', { apiKey: 'synthetic-ui-delegation' });
      const project = await client.call('project.create', { path, trust: 'trusted' });
      await client.call('files.save', {
        projectId: project.id,
        path: 'input.md',
        content: 'Original observation: 42.',
      });
      const material = await client.call('resources.describe', {
        locator: { source: 'project', projectId: project.id, path: 'input.md' },
      });
      work.workPackage.materials = [{ ref: material.ref, basis: material.basis }];
      await uiPage.goto(rendererUrl);
      await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await addProject(uiPage, path);
      await createSession(uiPage, basename(path));
      const composer = uiPage.getByRole('textbox', { name: '研究指令', exact: true });
      await composer.fill('PARENT_DELEGATION');
      await uiPage.getByRole('button', { name: '发送指令', exact: true }).click();
      await expect(composer).toHaveValue('');
      await composer.fill('Retained user draft');
      await uiPage.getByRole('button', { name: '展开 Agent 会话', exact: true }).click();
      const tool = uiPage.locator('details.tool-call').filter({ hasText: 'Ran delegate_agent' });
      await expect(tool).toHaveCount(1);
      await tool.locator(':scope > summary').click();
      const details = tool.getByRole('region', { name: '委派详情' });
      if (cancel) {
        await expect.poll(() => model.hold).toBe(true);
        await details.getByRole('button', { name: '取消委派', exact: true }).click();
        model.release();
        await expect(details.getByRole('status')).toContainText('已取消');
      } else {
        await expect(details.getByRole('status')).toContainText('已完成');
        await expect.poll(() => readFile(join(path, 'report.md'), 'utf8')).toContain('Observed 42');
        await details.getByRole('button', { name: '打开委派成果 report.md', exact: true }).click();
        await expect(
          uiPage.getByRole('textbox', { name: '文件内容 report.md', exact: true }),
        ).toContainText('Observed 42');
      }
      await expect(composer).toHaveValue('Retained user draft');
      await uiPage.reload();
      await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await expect(composer).toHaveValue('Retained user draft');
    } finally {
      model.release();
      client.dispose();
      await stop();
      await model.close();
      await rm(root, { recursive: true });
    }
  });
}
