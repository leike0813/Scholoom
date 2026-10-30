import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, type ElectronApplication, type Page } from '@playwright/test';
import { startKernelServer } from '../../apps/kernel/dist/server.js';
import { protocolVersion } from '../../packages/protocol/dist/index.js';
import type { TaskGraphInputs } from '../../packages/protocol/dist/projects.js';
import { closeDesktop } from '../desktop-fixture.js';
import { createModelServer } from '../model-server.js';
import { taskGraphIntegration } from '../task-graph-integration-fixture.js';
import { createSession, expect, test } from './fixture.js';
import { rendererOrigin } from './renderer-url.js';
import { armRpcGate, installRpcGate, releaseRpcGate } from './rpc-gate.js';

type RunInput = TaskGraphInputs['tasks.runGraph'];

async function dropOneReceipt(page: Page, url: string) {
  await page.routeWebSocket(url, (route) => {
    const server = route.connectToServer();
    const dropped = new Set<string>();
    route.onMessage((message) => {
      const frame = JSON.parse(message.toString());
      if (frame.method === 'tasks.runGraph') dropped.add(String(frame.id));
      server.send(message);
    });
    server.onMessage((message) => {
      const frame = JSON.parse(message.toString());
      if (dropped.delete(String(frame.id))) return;
      route.send(message);
    });
  });
}

// No task/research/worker/storage replacement. Only explicit concurrency and receipt-loss gates.
for (const scenario of [
  'complete',
  'association-conflict',
  'lost-receipt',
  'session-view',
] as const) {
  test(`task graph user action uses the actual research broker, library and worker (${scenario})`, async ({
    page,
    uiHost,
  }, info) => {
    const model = await createModelServer({
      respond: () => ({ text: '外部模型边界未参与校准图。' }),
    });
    const f = await taskGraphIntegration(info.outputPath('i1'), model.url);
    const { app, root, project } = f;
    const status = {
      protocolVersion,
      nodeVersion: process.versions.node,
      processId: process.pid,
      instanceId: crypto.randomUUID(),
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
    let unlock: (() => void) | undefined;
    let locked: Promise<void> | undefined;
    try {
      await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/`;
      let ui = page;
      if (uiHost === 'electron') {
        desktop = await _electron.launch({
          args: [
            `--user-data-dir=${info.outputPath('electron-profile')}`,
            fileURLToPath(new URL('../../apps/desktop', import.meta.url)),
          ],
          env: {
            ...process.env,
            ELECTRON_RENDERER_URL: url,
            SCHOOLOOM_DATA_DIR: join(root, 'desktop'),
            SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
          },
        });
        ui = await desktop.firstWindow();
        await ui.waitForURL(url);
        const paths = await desktop.evaluate(({ app, session }) => ({
          electronVersion: process.versions.electron,
          userData: app.getPath('userData'),
          sessionData: app.getPath('sessionData'),
          storagePath: session.defaultSession.storagePath,
        }));
        for (const path of [paths.userData, paths.sessionData, paths.storagePath])
          expect(path).toBe(info.outputPath('electron-profile'));
        await writeFile(info.outputPath('electron-profile.json'), JSON.stringify(paths));
      } else await ui.goto(url);
      const requests: RunInput[] = [];
      ui.on('websocket', (socket) =>
        socket.on('framesent', ({ payload }) => {
          const frame = JSON.parse(payload.toString());
          if (frame.method === 'tasks.runGraph') requests.push(frame.params);
        }),
      );
      await installRpcGate(ui);
      if (scenario === 'lost-receipt') await dropOneReceipt(ui, kernel.url);
      await ui.reload();
      await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
      await createSession(ui, { projectId: project.id });
      const sessionId = await ui
        .getByRole('button', { name: /^打开会话 /, pressed: true })
        .evaluate((button) => button.closest('li')?.getAttribute('data-session-id'));
      assert(sessionId);
      const scope = { projectId: project.id, sessionId };
      await ui.getByRole('tab', { name: '任务', exact: true }).click();
      await ui.getByRole('option', { name: /^I1比较任务 / }).click();
      const detail = ui.getByRole('region', { name: '研究任务详情', exact: true });
      const taskTab = ui.getByRole('tab', { name: /^I1比较任务 关闭/ });
      await detail.getByRole('button', { name: '比较工作项', exact: true }).click();
      await detail.getByRole('button', { name: '运行科研图', exact: true }).click();
      const form = detail.getByRole('form', { name: '运行科研图', exact: true });
      await form
        .getByRole('combobox', { name: '科研图及版本' })
        .selectOption(JSON.stringify(['scholoom.calibration', '1']));
      await form.getByRole('checkbox', { name: /项目来源/ }).check();
      await form.getByRole('checkbox', { name: /库来源/ }).check();
      await form.getByRole('textbox', { name: 'JSON 配置' }).fill(JSON.stringify(f.input.config));
      if (scenario === 'association-conflict') await armRpcGate(ui, 'tasks.runGraph');
      await form.getByRole('button', { name: '提交科研图调用', exact: true }).click();
      let request: RunInput;
      if (scenario === 'association-conflict') {
        await ui.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
        request = await ui.evaluate(
          () => JSON.parse(Reflect.get(globalThis, '__scholoomRpcGate').held.payload).params,
        );
        let entered!: () => void;
        const ready = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const released = new Promise<void>((resolve) => {
          unlock = resolve;
        });
        locked = app.projects
          .get(project.id)
          .files.coordinate(
            [join(project.path, `tasks/${request.processOperationId}.graph-call.md`)],
            async () => {
              entered();
              await released;
            },
          );
        await ready;
        await releaseRpcGate(ui);
      } else {
        await expect.poll(() => requests.length).toBe(1);
        assert(requests[0]);
        request = requests[0];
      }
      const taskPath = join(project.path, f.read.path);
      if (scenario === 'association-conflict') {
        await expect
          .poll(
            async () =>
              (
                await app.call('research.graphCalls', {
                  ...scope,
                  invocationId: request.invocationId,
                })
              ).calls.length,
          )
          .toBe(1);
        await writeFile(taskPath, `${f.read.content}\n人工补充：保留新的条件。\n`);
        unlock?.();
        await locked;
      }
      await expect
        .poll(
          async () => {
            const run = (await app.snapshot(scope)).run;
            if (run?.state === 'failed') throw new Error(JSON.stringify(run));
            return run?.state;
          },
          { timeout: 20000 },
        )
        .toBe('waiting');
      const call = (
        await app.call('research.graphCalls', { ...scope, invocationId: request.invocationId })
      ).calls[0];
      assert(call);
      expect(call.executions).toHaveLength(1);
      const execution = call.executions[0];
      assert(execution);
      const originalRun = execution.run;
      expect(originalRun.graph?.originInstructionId).toBe(request.instructionId);
      expect(
        (await app.snapshot(scope)).messages.find((message) => message.id === request.instructionId)
          ?.source,
      ).toBeDefined();
      expect(originalRun.graphProgress?.evidence.reads).toEqual(
        expect.arrayContaining([
          { ref: f.source.ref, basis: f.source.basis },
          { ref: f.library.ref, basis: f.library.basis },
        ]),
      );
      expect(originalRun.graphProgress?.evidence.reads).toHaveLength(3);
      const reportPath = join(project.path, 'report.md');
      const report = await readFile(reportPath, 'utf8');
      for (const fragment of ['Mechanism calibration', '目标：核对两个样本', '结果42', '结果17'])
        expect(report).toContain(fragment);
      const reportIdentity = await stat(reportPath, { bigint: true });
      const processPath = `tasks/${request.processOperationId}.graph-call.md`;
      if (scenario === 'lost-receipt') {
        await expect(form.getByRole('status').filter({ hasText: '调用结果待核查' })).toBeVisible();
        await expect(form.getByRole('button', { name: '新建科研图调用', exact: true })).toHaveCount(
          0,
        );
        await ui.reload();
        await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
        await ui.getByRole('tab', { name: '任务', exact: true }).click();
        await ui.getByRole('option', { name: /^I1比较任务 / }).click();
        await expect(form.getByRole('status').filter({ hasText: '调用结果待核查' })).toBeVisible();
        await expect(
          form.getByRole('button', { name: '提交科研图调用', exact: true }),
        ).toBeDisabled();
        await expect(form.getByRole('group').filter({ hasText: '原始调用请求' })).toContainText(
          request.invocationId,
        );
      } else if (scenario !== 'session-view') {
        const result = form.getByRole('region', { name: '科研图调用结果' });
        await expect(result).toContainText(
          scenario === 'association-conflict' ? '关联失败' : '已关联',
        );
        await result.getByRole('button', { name: '打开调用输入', exact: true }).click();
        const inputEditor = detail.getByRole('region', { name: '本次调用输入', exact: true });
        await expect(inputEditor).toBeVisible();
        const snapshot = JSON.parse(await inputEditor.innerText());
        expect(snapshot).toMatchObject({
          task: f.input.task,
          entry: f.read.entry,
          content: f.read.content,
          workItemId: 'comparison',
          invocationId: request.invocationId,
          instructionId: request.instructionId,
        });
        await result.getByRole('button', { name: '打开调用记录', exact: true }).click();
        await expect(
          ui.getByRole('textbox', { name: /文件内容 tasks\/.*\.graph-call\.md/ }),
        ).toBeVisible();
        await taskTab.click();
      }
      const receipt = await app.call('resources.creation', {
        projectId: project.id,
        operationId: request.processOperationId,
      });
      assert(receipt.state === 'complete');
      const pointer = JSON.parse(await readFile(join(project.path, processPath), 'utf8'));
      expect(pointer).toMatchObject({
        ...scope,
        invocationId: request.invocationId,
        instructionId: request.instructionId,
        runId: originalRun.id,
      });
      expect(pointer.inputSnapshot).toEqual(originalRun.graph?.materials?.[0]);
      const before = await app.call('tasks.read', { task: f.input.task });
      expect(
        before.metadata.links?.some(
          (link) =>
            link.target.kind === 'project-file' &&
            link.target.fileId === receipt.resource.ref.fileId,
        ),
      ).toBe(scenario !== 'association-conflict');
      const composer = ui.getByRole('textbox', { name: '研究指令', exact: true });
      if (scenario === 'session-view') {
        const prompt = originalRun.graph?.wait?.prompt;
        assert(prompt);
        const dock = ui.getByRole('button', { name: '展开 Agent 会话', exact: true });
        await expect(dock).toContainText(prompt);
        await ui.screenshot({ path: info.outputPath('graph-dock.png') });
        await composer.fill('待补充的研究指令');
        await dock.click();
        const graph = ui.getByRole('region', { name: '科研图状态', exact: true });
        await expect(graph).toHaveCount(1);
        await expect(graph).toContainText(prompt);
        await expect(composer).toHaveValue('待补充的研究指令');
        await ui.getByRole('button', { name: '切换主题', exact: true }).click();
        await ui.screenshot({ path: info.outputPath('graph-wait-light.png') });
        await ui.getByRole('button', { name: '切换主题', exact: true }).click();
        await expect(graph).toContainText(prompt);
        await ui.screenshot({ path: info.outputPath('graph-wait-dark.png') });
        await graph.getByRole('button', { name: '打开当前成果 report.md', exact: true }).click();
        await expect(ui.getByRole('dialog', { name: 'Agent 会话', exact: true })).toHaveCount(0);
        await expect(
          ui.getByRole('textbox', { name: '文件内容 report.md', exact: true }),
        ).toContainText('Mechanism calibration');
        await expect(composer).toHaveValue('待补充的研究指令');
        await ui.reload();
        await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
        await expect(composer).toHaveValue('待补充的研究指令');
        await dock.click();
        await expect(graph).toHaveCount(1);
        await expect(
          graph.getByRole('button', { name: '打开当前成果 report.md', exact: true }),
        ).toHaveCount(1);
        await expect(graph).toContainText(prompt);
        await expect(ui.getByRole('article', { name: 'Agent 回复', exact: true })).toHaveCount(0);
        await ui.getByRole('button', { name: '收起会话', exact: true }).click();
        await armRpcGate(ui, 'workbench.watch', '', true);
        await app.call('session.rename', { ...scope, title: '科研图等待核对' });
        await ui.waitForFunction(() => !!Reflect.get(globalThis, '__scholoomRpcGate').held);
      }
      await composer.fill('{"confirm":true}');
      await ui.getByRole('button', { name: '发送指令', exact: true }).click();
      if (scenario === 'session-view') {
        const dock = ui.getByRole('button', { name: '展开 Agent 会话', exact: true });
        await expect(dock).not.toContainText('等待输入');
        await ui.evaluate((prompt) => {
          const target = document.getElementById('dock-transcript');
          Reflect.set(globalThis, '__staleGraphWait', false);
          const observer = new MutationObserver(() => {
            if (target?.textContent?.includes(prompt))
              Reflect.set(globalThis, '__staleGraphWait', true);
          });
          if (target)
            observer.observe(target, { childList: true, subtree: true, characterData: true });
          Reflect.set(globalThis, '__graphWaitObserver', observer);
        }, originalRun.graph?.wait?.prompt ?? '');
        await releaseRpcGate(ui);
      }
      await expect
        .poll(async () => (await app.snapshot(scope)).run?.state, { timeout: 20000 })
        .toBe('completed');
      if (scenario === 'session-view') {
        await expect(
          ui.getByRole('button', { name: '展开 Agent 会话', exact: true }),
        ).toContainText('执行结束');
        expect(
          await ui.evaluate(() => {
            Reflect.get(globalThis, '__graphWaitObserver').disconnect();
            return Reflect.get(globalThis, '__staleGraphWait');
          }),
        ).toBe(false);
      }
      const completed = (
        await app.call('research.graphCalls', { ...scope, invocationId: request.invocationId })
      ).calls[0];
      expect(completed?.executions).toHaveLength(1);
      expect(completed?.executions[0]).toMatchObject({
        run: { id: originalRun.id, state: 'completed' },
        check: { delivery: 'usable', researchAssessment: 'notAssessed' },
      });
      if (scenario === 'session-view') {
        expect(await readFile(reportPath, 'utf8')).toBe(report);
        expect(requests).toHaveLength(1);
        expect(model.requests).toHaveLength(0);
        await ui.screenshot({ path: info.outputPath('graph-completed.png') });
        return;
      }
      const associate = async (path: string, role: 'process' | 'result') => {
        await detail.getByRole('button', { name: '重读入口', exact: true }).click();
        await detail.getByRole('button', { name: '关联现有材料', exact: true }).click();
        const association = ui.getByRole('form', { name: '关联任务材料' });
        await association.getByRole('textbox', { name: '项目内材料路径' }).fill(path);
        await association.getByRole('combobox', { name: '材料用途' }).selectOption(role);
        await association.getByRole('button', { name: '保存关联', exact: true }).click();
        await expect(association).toHaveCount(0);
      };
      if (scenario === 'association-conflict') await associate(processPath, 'process');
      await associate('report.md', 'result');
      const after = await app.call('tasks.read', { task: f.input.task });
      expect(
        after.metadata.links?.some(
          (link) =>
            link.role === 'process' &&
            link.target.kind === 'project-file' &&
            link.target.fileId === receipt.resource.ref.fileId,
        ),
      ).toBe(true);
      if (scenario === 'association-conflict')
        expect(after.content).toContain('人工补充：保留新的条件');
      expect(after.metadata.links?.filter((link) => link.role === 'result')).toHaveLength(1);
      expect(await readFile(reportPath, 'utf8')).toBe(report);
      expect((await stat(reportPath, { bigint: true })).ino).toBe(reportIdentity.ino);
      expect(requests).toHaveLength(1);
      expect(model.requests).toHaveLength(0);
      if (scenario === 'complete') {
        const snapshot = await app.call('resources.describe', {
          locator: pointer.inputSnapshot.ref,
        });
        assert(snapshot.ref.source === 'project' && snapshot.path);
        await writeFile(join(project.path, snapshot.path), '人为改写的输入，不能冒充原快照。');
        await ui.reload();
        await expect(ui.getByRole('status', { name: '连接状态' })).toContainText('已连接');
        await ui.getByRole('tab', { name: '任务', exact: true }).click();
        await ui.getByRole('option', { name: /^I1比较任务 / }).click();
        const action = detail.getByRole('button', { name: '运行科研图', exact: true });
        if ((await action.getAttribute('aria-expanded')) !== 'true') await action.click();
        await form.getByRole('button', { name: '打开调用输入', exact: true }).click();
        await expect(form.getByRole('alert')).toContainText(/版本|变化/);
        await expect(detail.getByRole('region', { name: '本次调用输入', exact: true })).toHaveCount(
          0,
        );
      }
      await ui.screenshot({ path: info.outputPath('task-graph-i1.png') });
    } finally {
      unlock?.();
      await locked;
      if (desktop) await closeDesktop(desktop);
      await new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve())),
      );
      await kernel.stop();
      await model.close();
    }
  });
}
