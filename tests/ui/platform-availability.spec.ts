import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKernelClient } from '../../packages/client/dist/index.js';
import { runningKernel } from '../kernel-fixture.js';
import { addProject, createSession, expect, test } from './fixture.js';
import { rendererUrl } from './renderer-url.js';

test('unavailable execution keeps draft and manual file editing in the workbench', async ({
  uiPage,
}) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'scholoom-manual-ui-'));
  const client = createKernelClient(
    await runningKernel(process.env.SCHOOLOOM_UI_DATA_DIR as string),
  );
  try {
    const status = await client.connect();
    await client.call('provider.configure', { apiKey: 'synthetic-unavailable-key' });
    if (process.platform === 'darwin') expect(status.managedExecution?.available).toBe(false);
    else {
      // Replace only kernel status; projects, sessions, files and persistence remain real.
      await uiPage.routeWebSocket('**/*', (route) => {
        const server = route.connectToServer();
        server.onMessage((message) => {
          if (typeof message === 'string') {
            const payload = JSON.parse(message);
            if (payload.result?.protocolVersion && payload.result?.nodeVersion) {
              payload.result.managedExecution = {
                available: false,
                reason: '当前平台暂不支持受管执行；仍可人工管理文件与题录。',
              };
              route.send(JSON.stringify(payload));
              return;
            }
          }
          route.send(message);
        });
      });
    }
    await uiPage.goto(rendererUrl);
    await expect(uiPage.getByRole('status', { name: '连接状态' })).toContainText('已连接');
    const projectName = `manual-${randomUUID().slice(0, 8)}`;
    const projectPath = join(root, projectName);
    await addProject(uiPage, projectPath, { mode: 'create' });
    await createSession(uiPage, projectName);
    const composer = uiPage.getByRole('textbox', { name: '研究指令' });
    await composer.fill('保留的研究草稿');
    await expect(uiPage.getByRole('button', { name: '发送指令', exact: true })).toBeDisabled();
    await uiPage.getByLabel('工作台通知', { exact: true }).click();
    await expect(uiPage.getByRole('region', { name: '工作台通知详情' })).toContainText('受管执行');
    await uiPage.getByLabel('工作台通知', { exact: true }).click();
    await uiPage.getByRole('button', { name: '新建文件', exact: true }).click();
    await uiPage.getByLabel('新文件名', { exact: true }).fill('notes.md');
    await uiPage.getByLabel('新文件名', { exact: true }).press('Enter');
    const editor = uiPage.getByRole('textbox', { name: '文件内容 notes.md', exact: true });
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await editor.press('ControlOrMeta+a');
    await uiPage.keyboard.insertText('# 人工成果');
    await uiPage.getByRole('button', { name: '保存文件', exact: true }).first().click();
    await expect.poll(() => readFile(join(projectPath, 'notes.md'), 'utf8')).toBe('# 人工成果');
    await uiPage.reload();
    await expect(composer).toHaveValue('保留的研究草稿');
    await expect(uiPage.getByRole('button', { name: '发送指令', exact: true })).toBeDisabled();
  } finally {
    client.dispose();
    await rm(root, { recursive: true });
  }
});
