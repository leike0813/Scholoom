import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, type ElectronApplication } from '@playwright/test';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import type { TaskResearchPort } from '../../packages/protocol/dist/projects.js';
import { closeDesktop } from '../desktop-fixture.js';
import { createSession, expect, test } from './fixture.js';
import { rendererOrigin } from './renderer-url.js';

// The research port is synthetic; task, broker, storage, UI and native bootstrap stay real.
for (const conflict of [false, true]) {
  test(`task graph user action derives selected sources and retains ${conflict ? 'an association conflict' : 'the saved call'} through an injected research port`, async ({
    page,
    uiHost,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'scholoom-graph-action-'));
    const starts: Parameters<TaskResearchPort['start']>[0][] = [];
    let taskPath = '',
      taskContent = '';
    const app = new KernelApplication(join(root, 'profile'), {
      environment: {},
      taskResearch: {
        graphs: async () => ({
          graphs: [
            {
              name: '注入验收图',
              definition: {
                graphId: 'fixture.task',
                version: '1',
                stateFormatVersion: '1',
                configSchema: { type: 'object' },
              },
            },
          ],
        }),
        start: async (input, context) => {
          expect(context).toMatchObject({
            role: 'product',
            principal: { kind: 'human', id: 'local' },
          });
          expect(app.harness.getSession(input.projectId, input.sessionId).state).toBe('completed');
          starts.push(input);
          if (conflict) await writeFile(taskPath, `${taskContent}\n人工补充，不可覆盖。\n`);
          return {
            invocationId: input.invocationId,
            instructionId: input.instructionId,
            runId: 'synthetic-research-run',
          };
        },
      },
    });
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
    const kernel = await startKernelServer(status, () => app.close(), app);
    const endpoint = { ...status, url: kernel.url, token: kernel.token };
    const proxy = createServer(async (request, response) => {
      try {
        if (request.url === '/__scholoom/kernel/bootstrap') {
          response
            .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
            .end(JSON.stringify({ state: 'running', endpoint }));
          return;
        }
        const result = await fetch(new URL(request.url ?? '/', rendererOrigin));
        response
          .writeHead(result.status, {
            'Content-Type': result.headers.get('content-type') ?? 'application/octet-stream',
            'Cache-Control': 'no-store',
          })
          .end(Buffer.from(await result.arrayBuffer()));
      } catch {
        response.writeHead(502).end();
      }
    });
    let desktop: ElectronApplication | undefined;
    try {
      await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/`;
      const project = await app.call('project.create', {
        path: join(root, 'project'),
        trust: 'trusted',
      });
      const source = await app.call('resources.create', {
        projectId: project.id,
        operationId: randomUUID(),
        path: 'source.md',
        content: '实际来源正文。',
      });
      assert(source.state === 'complete');
      taskContent = `---\n${JSON.stringify({ kind: 'research-task', formatVersion: 1, id: 'compare', title: '比较任务', status: 'active', workItems: [{ id: 'comparison', title: '比较工作项' }], links: [{ id: 'source', role: 'source', workItemId: 'comparison', note: '核对来源', target: { kind: 'project-file', fileId: source.resource.ref.fileId }, basis: source.resource.basis }] })}\n---\n\n目标与下一步。\n`;
      taskPath = join(project.path, 'tasks/compare.task.md');
      const created = await app.call('tasks.create', {
        projectId: project.id,
        operationId: randomUUID(),
        path: 'tasks/compare.task.md',
        content: taskContent,
      });
      assert(created.state === 'complete');
      const task = {
        projectId: project.id,
        taskId: 'compare',
        fileId: created.resource.ref.fileId,
      };
      let ui = page;
      if (uiHost === 'electron') {
        desktop = await _electron.launch({
          args: [fileURLToPath(new URL('../../apps/desktop', import.meta.url))],
          env: {
            ...process.env,
            ELECTRON_RENDERER_URL: url,
            SCHOOLOOM_DATA_DIR: join(root, 'desktop'),
            SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
          },
        });
        ui = await desktop.firstWindow();
      } else await ui.goto(url);
      await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await createSession(ui, { projectId: project.id });
      await ui.getByRole('tab', { name: '任务', exact: true }).click();
      await ui.getByRole('option', { name: /^比较任务 / }).click();
      const detail = ui.getByRole('region', { name: '研究任务详情', exact: true });
      await detail.getByRole('button', { name: '比较工作项', exact: true }).click();
      await detail.getByRole('button', { name: '运行科研图', exact: true }).click();
      const form = detail.getByRole('form', { name: '运行科研图', exact: true });
      await form
        .getByRole('combobox', { name: '科研图及版本' })
        .selectOption(JSON.stringify(['fixture.task', '1']));
      await form.getByRole('checkbox', { name: /核对来源/ }).check();
      await form
        .getByRole('textbox', { name: 'JSON 配置' })
        .fill(JSON.stringify({ goal: '核对实际来源' }));
      await form.getByRole('button', { name: '提交科研图调用', exact: true }).click();
      const result = form.getByRole('region', { name: '科研图调用结果' });
      await expect(result).toBeVisible();
      await expect(result).toContainText(conflict ? '关联失败' : '已关联');
      await expect(result).toContainText('已保存');
      expect(starts).toHaveLength(1);
      expect(starts[0]?.materials).toEqual(
        expect.arrayContaining([
          { ref: source.resource.ref, basis: source.resource.basis, role: 'source' },
        ]),
      );
      expect(starts[0]?.text).toBe(taskContent);
      const current = await app.call('tasks.read', { task });
      const link = current.metadata.links?.find((item) => item.role === 'process');
      expect(!!link).toBe(!conflict);
      if (conflict) expect(current.content).toContain('人工补充');
      await result.getByRole('button', { name: '打开调用记录', exact: true }).click();
      const processEditor = ui.getByRole('textbox', { name: /文件内容 tasks\/.*\.graph-call\.md/ });
      await expect(processEditor).toBeVisible();
      const pointer = JSON.parse(await processEditor.innerText());
      expect(pointer).toMatchObject({
        projectId: project.id,
        sessionId: starts[0]?.sessionId,
        invocationId: starts[0]?.invocationId,
        runId: 'synthetic-research-run',
      });
      expect(await readFile(taskPath, 'utf8')).toBe(current.content);
    } finally {
      if (desktop) await closeDesktop(desktop);
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve())),
      );
      await kernel.stop();
    }
  });
}
