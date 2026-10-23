import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, expect, type Page, test } from '@playwright/test';
import { createKernelClient } from '../../packages/client/dist/index.js';
import type { BootstrapResult } from '../../packages/protocol/dist/index.js';
import { runKernel } from '../kernel-fixture.js';
import { addProject, createSession } from '../ui/fixture.js';
import { uiPort } from '../ui/renderer-url.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const commandTimeoutMs = 60_000;

// 本文件全程不录 trace：live 场景的模型凭据留在内核环境，不进入任何 renderer。
test.use({ trace: 'off' });

type RunningKernel = Extract<BootstrapResult, { state: 'running' }>;

type DevelopmentCommand = {
  child: ChildProcess;
  log: () => string;
  stop: () => Promise<void>;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitWhile(predicate: () => boolean, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline && predicate()) await delay(500);
}

function runForeground(command: string, args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const killer = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    killer.once('exit', () => resolve());
    killer.once('error', () => resolve());
  });
}

/** Unix 进程组在组内仍有存活成员时保持有效，因此父进程先退出也能按组回收。 */
function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 真实开发命令以独占进程组启动；回收只针对本轮启动的进程树。 */
function startDevelopmentCommand(
  script: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
): DevelopmentCommand {
  const windows = process.platform === 'win32';
  const child = spawn('pnpm', ['--config.optimisticRepeatInstall=false', script, ...args], {
    cwd: projectRoot,
    // Linux 自动化环境沿用 Playwright Electron 的宿主 sandbox 设置。
    env: {
      ...environment,
      ...(process.platform === 'linux' ? { NO_SANDBOX: '1' } : {}),
    },
    // Windows 需要 shell 才能解析 pnpm.cmd；Unix 用独占进程组回收整棵树。
    detached: !windows,
    shell: windows,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let log = '';
  const record = (chunk: Buffer | string) => {
    log = `${log}${String(chunk)}`.slice(-8000);
  };
  child.stdout?.on('data', record);
  child.stderr?.on('data', record);
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
  });
  return {
    child,
    log: () => log,
    async stop() {
      const pid = child.pid;
      if (pid === undefined) return;
      if (windows) {
        // 已知子 PID 遍历子树；父进程已退出时不再有可遍历的子树。
        if (child.exitCode !== null || child.signalCode !== null) return;
        await runForeground('taskkill', ['/PID', `${pid}`, '/T', '/F']);
        await Promise.race([exited, delay(20_000)]);
        return;
      }
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        // 进程组已退出。
      }
      await waitWhile(() => groupAlive(pid), 20_000);
      if (!groupAlive(pid)) return;
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // 进程组已退出。
      }
      await waitWhile(() => groupAlive(pid), 5_000);
    },
  };
}

async function reachable(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(5_000) })).ok;
  } catch {
    return false;
  }
}

async function waitForServer(
  command: DevelopmentCommand,
  what: string,
  check: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + commandTimeoutMs;
  while (Date.now() < deadline) {
    if (command.child.exitCode !== null || command.child.signalCode !== null)
      throw new Error(`${what}：开发命令已退出\n${command.log()}`);
    if (await check()) return;
    await delay(1_000);
  }
  throw new Error(`${what}：等待超时\n${command.log()}`);
}

async function kernelState(directory: string): Promise<string> {
  try {
    return (await runKernel(directory, 'status')).state;
  } catch {
    return 'unavailable';
  }
}

async function runningKernel(directory: string): Promise<RunningKernel> {
  const current: { result: BootstrapResult | undefined } = { result: undefined };
  await expect
    .poll(
      async () => {
        try {
          current.result = await runKernel(directory, 'status');
        } catch {
          current.result = undefined;
        }
        return current.result?.state ?? 'unavailable';
      },
      { timeout: 120_000, intervals: [500, 1_000] },
    )
    .toBe('running');
  const result = current.result;
  if (result?.state !== 'running') throw new Error('开发内核未运行');
  return result;
}

function alive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

async function connectDesktop(
  command: DevelopmentCommand,
  debugPort: number,
): Promise<{ browser: Browser; page: Page }> {
  await waitForServer(command, 'Electron 调试端口未就绪', () =>
    reachable(`http://127.0.0.1:${debugPort}/json/version`),
  );
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  const found: { page: Page | undefined } = { page: undefined };
  await waitForServer(command, '未找到 Electron 工作台页面', async () => {
    found.page = browser
      .contexts()
      .flatMap((context) => context.pages())
      .find((candidate) => /^https?:/.test(candidate.url()));
    return found.page !== undefined;
  });
  if (!found.page) throw new Error('未找到 Electron 工作台页面');
  return { browser, page: found.page };
}

async function waitConnected(page: Page): Promise<void> {
  await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
    timeout: 60_000,
  });
}

async function grantLibrary(page: Page): Promise<void> {
  await page.getByRole('button', { name: '文献库', exact: true }).click();
  const panel = page.getByRole('region', { name: '文献库', exact: true });
  await panel.getByText('文献库授权与备份', { exact: true }).click();
  await panel.getByLabel('读取库', { exact: true }).check();
  await panel.getByLabel('写入库', { exact: true }).check();
  await panel.getByRole('button', { name: '保存库授权', exact: true }).click();
}

async function createLibraryItem(page: Page, title: string): Promise<void> {
  const panel = page.getByRole('region', { name: '文献库', exact: true });
  await panel.getByText('手动建项', { exact: true }).click();
  await panel.getByLabel('题名', { exact: true }).fill(title);
  await panel.getByRole('button', { name: '创建题录', exact: true }).click();
  await expect(panel.getByRole('button', { name: `查看题录 ${title}`, exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

async function expectLibraryItem(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: '文献库', exact: true }).click();
  const panel = page.getByRole('region', { name: '文献库', exact: true });
  await panel.getByLabel('查找题录', { exact: true }).fill(title);
  await expect(panel.getByRole('button', { name: `查看题录 ${title}`, exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

async function openProject(page: Page, directory: string): Promise<void> {
  await addProject(page, directory);
  await expect(page.getByLabel('执行上下文')).toContainText(basename(directory));
}

/** 经 CDP 连接的 Electron 页无法替换主进程目录选择器，改从“管理项目”菜单切换到已登记的最近项目。 */
async function switchToRecentProject(page: Page, directory: string): Promise<void> {
  await page.getByRole('button', { name: `管理项目 ${basename(directory)}`, exact: true }).click();
  await page.getByRole('button', { name: '进入项目', exact: true }).click();
  await expect(page.getByLabel('执行上下文')).toContainText(basename(directory));
}

async function grantProject(page: Page): Promise<void> {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByText('项目权限与备份', { exact: true }).click();
  await page.getByRole('checkbox', { name: /^信任项目/ }).check();
  await page.getByRole('button', { name: '保存项目授权' }).click();
}

/** 命令结束后确认内核停止；未停止时尝试一次明确停止，并只在确认后删除临时目录。 */
async function leaveKernelStopped(directory: string): Promise<boolean> {
  try {
    await expect
      .poll(() => kernelState(directory), { timeout: 60_000, intervals: [500, 1_000] })
      .toBe('stopped');
    return true;
  } catch {
    await runKernel(directory, 'stop').catch(() => {});
    return (await kernelState(directory)) === 'stopped';
  }
}

test('two renderer instances isolate business data and closing one leaves the other usable', async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  if (uiPort === 65535) throw new Error('Two-instance validation needs two consecutive UI ports');
  const root = await mkdtemp(join(tmpdir(), 'scholoom-two-instances-'));
  const instances = [0, 1].map((index) => ({
    directory: join(root, `profile-${index}`),
    project: join(root, `project-${index}`),
    libraryName: `library-${index}-${randomUUID()}.md`,
    port: uiPort + index,
  }));
  const commands: DevelopmentCommand[] = [];
  const clients: ReturnType<typeof createKernelClient>[] = [];
  const contexts = await Promise.all(instances.map(() => browser.newContext()));
  try {
    for (const instance of instances) {
      const command = startDevelopmentCommand(
        '--filter',
        ['@scholoom/desktop', 'dev:browser', '--port', String(instance.port), '--strictPort'],
        {
          ...process.env,
          SCHOOLOOM_DATA_DIR: instance.directory,
          SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
        },
      );
      commands.push(command);
      await waitForServer(command, 'Isolated renderer unavailable', () =>
        reachable(`http://127.0.0.1:${instance.port}/`),
      );
    }
    const endpoints = await Promise.all(instances.map(({ directory }) => runningKernel(directory)));
    expect(endpoints[0]?.endpoint.instanceId).not.toBe(endpoints[1]?.endpoint.instanceId);
    expect(endpoints[0]?.endpoint.url).not.toBe(endpoints[1]?.endpoint.url);
    const pages: Page[] = [];
    for (const [index, instance] of instances.entries()) {
      const endpoint = endpoints[index];
      const context = contexts[index];
      if (!endpoint || !context) throw new Error('Missing isolated instance');
      const client = createKernelClient(endpoint.endpoint);
      clients.push(client);
      await client.connect();
      // Seed owned library data through its real API; this test exercises isolation, not ingestion UI.
      await client.call('library.grant', {
        read: true,
        write: true,
        send: false,
        autoBackup: false,
      });
      const input = join(root, instance.libraryName);
      await writeFile(input, `# Library evidence ${index}\n`);
      const batch = await client.call('library.importFiles', {
        batchId: randomUUID(),
        paths: [input],
        storage: 'managed',
        purpose: '正文',
        version: 'unspecified',
        origin: 'two-instance-validation',
      });
      await expect
        .poll(async () => (await client.call('library.batch', { batchId: batch.id })).batch.state)
        .toBe('completed');
      const page = await context.newPage();
      pages.push(page);
      await page.goto(`http://127.0.0.1:${instance.port}/`);
      await waitConnected(page);
      await page.getByRole('status', { name: '连接状态' }).hover();
      await expect(
        page.getByText(`实例 ${endpoint.endpoint.instanceId}`, { exact: true }),
      ).toBeVisible();
      await addProject(page, instance.project, { mode: 'create' });
      await page.getByRole('button', { name: '新建文件', exact: true }).click();
      await page.getByLabel('新文件名', { exact: true }).fill('result.md');
      await page.getByLabel('新文件名', { exact: true }).press('Enter');
      const editor = page.getByRole('textbox', { name: '文件内容 result.md', exact: true });
      await editor.fill(`# Output ${index}\n`);
      await page.getByRole('button', { name: '保存文件', exact: true }).first().click();
      await expect
        .poll(() => readFile(join(instance.project, 'result.md'), 'utf8'))
        .toBe(`# Output ${index}\n`);
      await page.getByRole('button', { name: '文献库', exact: true }).click();
      await page.getByLabel('查找题录', { exact: true }).fill(instance.libraryName);
      await expect(page.getByRole('option').filter({ hasText: instance.libraryName })).toHaveCount(
        1,
      );
    }
    for (const [index, client] of clients.entries()) {
      const own = instances[index];
      const other = instances[1 - index];
      if (!own || !other) throw new Error('Missing instance identity');
      expect(
        (await client.call('workbench.watch', {})).projects.map((project) => project.path),
      ).toContain(own.project);
      expect(
        (await client.call('workbench.watch', {})).projects.map((project) => project.path),
      ).not.toContain(other.project);
      expect(
        (await client.call('library.list', { query: other.libraryName })).sources,
      ).toHaveLength(0);
    }
    await contexts[0]?.close();
    clients[0]?.dispose();
    await commands[0]?.stop();
    const first = instances[0],
      second = instances[1],
      survivor = pages[1];
    if (!first || !second || !survivor) throw new Error('Missing survivor');
    await expect.poll(() => kernelState(first.directory), { timeout: 30000 }).toBe('stopped');
    expect((await runningKernel(second.directory)).endpoint.instanceId).toBe(
      endpoints[1]?.endpoint.instanceId,
    );
    await survivor.reload();
    await waitConnected(survivor);
    await survivor.getByRole('treeitem', { name: '打开文件 result.md', exact: true }).dblclick();
    await survivor
      .getByRole('textbox', { name: '文件内容 result.md', exact: true })
      .fill('# Still independent\n');
    await survivor.getByRole('button', { name: '保存文件', exact: true }).first().click();
    await expect
      .poll(() => readFile(join(second.project, 'result.md'), 'utf8'))
      .toBe('# Still independent\n');
    expect(await readFile(join(first.project, 'result.md'), 'utf8')).toBe('# Output 0\n');
    expect(
      (await clients[1]?.call('library.list', { query: second.libraryName }))?.sources,
    ).toHaveLength(1);
    await info.attach('isolated-instances', {
      body: JSON.stringify(
        instances.map((instance, index) => ({
          ...instance,
          instanceId: endpoints[index]?.endpoint.instanceId,
        })),
        null,
        2,
      ),
      contentType: 'application/json',
    });
  } finally {
    for (const context of contexts) await context.close();
    for (const client of clients) client.dispose();
    for (const command of commands) await command.stop();
    const stopped = await Promise.all(
      instances.map(({ directory }) => leaveKernelStopped(directory)),
    );
    if (stopped.every(Boolean)) await rm(root, { recursive: true });
    expect(stopped.every(Boolean), `Unconfirmed test-owned instance; retained ${root}`).toBe(true);
  }
});

test('real dev commands share one development kernel and the last owner recycles it', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const browserPort = 5315;
  const debugPort = 9315;
  const root = await mkdtemp(join(tmpdir(), 'scholoom-dev-command-'));
  const directory = join(root, 'profile');
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    SCHOOLOOM_DATA_DIR: directory,
    SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
  };
  delete environment.MINIMAX_CN_API_KEY;
  const commands: DevelopmentCommand[] = [];
  let desktop: Browser | undefined;
  const title = `真实调试-${randomUUID().slice(0, 8)}`;
  try {
    await mkdir(directory, { recursive: true });
    const browserCommand = startDevelopmentCommand(
      'dev:browser',
      ['--port', `${browserPort}`, '--strictPort'],
      environment,
    );
    commands.push(browserCommand);
    await waitForServer(browserCommand, '浏览器开发命令未就绪', () =>
      reachable(`http://127.0.0.1:${browserPort}/`),
    );
    const desktopCommand = startDevelopmentCommand(
      'dev:desktop',
      ['--remoteDebuggingPort', `${debugPort}`],
      environment,
    );
    commands.push(desktopCommand);
    const electron = await connectDesktop(desktopCommand, debugPort);
    desktop = electron.browser;

    await page.goto(`http://127.0.0.1:${browserPort}/`);
    await waitConnected(page);
    await waitConnected(electron.page);

    const endpoint = await runningKernel(directory);
    for (const host of [page, electron.page]) {
      await host.getByRole('status', { name: '连接状态' }).hover();
      await expect(
        host.getByText(`实例 ${endpoint.endpoint.instanceId}`, { exact: true }),
      ).toBeVisible({ timeout: 30_000 });
    }

    await grantLibrary(page);
    await createLibraryItem(page, title);
    await expectLibraryItem(electron.page, title);

    await page.reload();
    await waitConnected(page);
    await page.getByRole('status', { name: '连接状态' }).hover();
    await expect(
      page.getByText(`实例 ${endpoint.endpoint.instanceId}`, { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expectLibraryItem(page, title);

    await desktopCommand.stop();
    const afterDesktop = await runningKernel(directory);
    expect(afterDesktop.endpoint.instanceId).toBe(endpoint.endpoint.instanceId);
    await waitConnected(page);

    await browserCommand.stop();
    await expect
      .poll(async () => `${await kernelState(directory)}/${alive(endpoint.endpoint.processId)}`, {
        timeout: 60_000,
        intervals: [500, 1_000],
      })
      .toBe('stopped/false');

    await expect
      .poll(() => reachable(`http://127.0.0.1:${browserPort}/`), { timeout: 30_000 })
      .toBe(false);
    const restarted = startDevelopmentCommand(
      'dev:browser',
      ['--port', `${browserPort}`, '--strictPort'],
      environment,
    );
    commands.push(restarted);
    await waitForServer(restarted, '浏览器开发命令重启未就绪', () =>
      reachable(`http://127.0.0.1:${browserPort}/`),
    );
    const next = await runningKernel(directory);
    expect(next.endpoint.instanceId).not.toBe(endpoint.endpoint.instanceId);
    await page.goto(`http://127.0.0.1:${browserPort}/`);
    await waitConnected(page);
    await expectLibraryItem(page, title);
  } finally {
    await desktop?.close().catch(() => {});
    await Promise.all(commands.map((command) => command.stop()));
    for (const [index, command] of commands.entries())
      await info
        .attach(`development-command-${index}.log`, {
          body: command.log(),
          contentType: 'text/plain',
        })
        .catch(() => {});
    const stopped = await leaveKernelStopped(directory);
    if (stopped) await rm(root, { recursive: true, force: true });
    else
      info.annotations.push({
        type: 'leftover-kernel',
        description: `内核未确认停止，保留 ${root} 供排查`,
      });
  }
});

test.describe('live development harness', () => {
  test('live MiniMax saves a checked result through the development workbench and the other host opens it', async ({
    page,
  }, info) => {
    test.skip(
      process.env.SCHOOLOOM_LIVE_MODEL_TEST !== '1' || !process.env.MINIMAX_CN_API_KEY,
      '需要 SCHOOLOOM_LIVE_MODEL_TEST=1 且存在 MINIMAX_CN_API_KEY',
    );
    test.setTimeout(240_000);
    const browserPort = 5316;
    const debugPort = 9316;
    const root = await mkdtemp(join(tmpdir(), 'scholoom-dev-live-'));
    const directory = join(root, 'profile');
    const project = join(root, 'project');
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      SCHOOLOOM_DATA_DIR: directory,
      SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
    };
    const commands: DevelopmentCommand[] = [];
    let desktop: Browser | undefined;
    try {
      await mkdir(directory, { recursive: true });
      await mkdir(project, { recursive: true });
      await writeFile(
        join(project, 'input.md'),
        '# 合成样本\n\n观测值：2、4、6。仅用于软件验证。\n',
      );

      const browserCommand = startDevelopmentCommand(
        'dev:browser',
        ['--port', `${browserPort}`, '--strictPort'],
        environment,
      );
      commands.push(browserCommand);
      await waitForServer(browserCommand, '浏览器开发命令未就绪', () =>
        reachable(`http://127.0.0.1:${browserPort}/`),
      );
      const desktopCommand = startDevelopmentCommand(
        'dev:desktop',
        ['--remoteDebuggingPort', `${debugPort}`],
        environment,
      );
      commands.push(desktopCommand);
      const electron = await connectDesktop(desktopCommand, debugPort);
      desktop = electron.browser;

      await page.goto(`http://127.0.0.1:${browserPort}/`);
      await waitConnected(page);
      await openProject(page, project);
      await grantProject(page);
      await createSession(page, basename(project));
      await page.getByLabel('附加 input.md', { exact: true }).check();
      await page
        .getByRole('textbox', { name: '研究指令' })
        .fill(
          '这是一次小型软件验证：只读取 input.md，用 write_file 新建 result.md，不超过120字，列出观测数量、合计、算术均值，并说明它是合成样本、不能据此作科研推断。不要额外检索或新建其他文件，保存后简短答复。',
        );
      await page.getByRole('button', { name: '发送指令' }).click();
      await expect(page.getByRole('status', { name: '执行状态' })).toContainText('执行完成', {
        timeout: 300_000,
      });
      await expect
        .poll(() => readFile(join(project, 'result.md'), 'utf8').catch(() => ''), {
          timeout: 60_000,
        })
        .toContain('12');
      const saved = await readFile(join(project, 'result.md'), 'utf8');
      expect(saved).toMatch(/3|三/);
      expect(saved).toContain('12');
      expect(saved).toMatch(/4|四/);
      expect(saved).toMatch(/合成|模拟/);
      const evidence = info.outputPath('synthetic-result.md');
      await writeFile(evidence, saved);
      await info.attach('synthetic-result.md', { path: evidence, contentType: 'text/markdown' });
      await page.getByRole('button', { name: '展开 Agent 会话' }).click();
      for (const name of ['read_file', 'write_file'])
        await expect(
          page.locator('details.tool-call').filter({ hasText: name }).first(),
        ).toBeVisible();

      await waitConnected(electron.page);
      await switchToRecentProject(electron.page, project);
      await electron.page.getByRole('button', { name: '刷新文件', exact: true }).click();
      await electron.page.getByRole('button', { name: '打开文件 result.md', exact: true }).click();
      const view = electron.page.getByRole('textbox', { name: '文件内容 result.md', exact: true });
      await expect(view).toContainText('12', { timeout: 30_000 });
      await expect(view).toContainText(/4|四/);
      await expect(view).toContainText(/合成|模拟/);
    } finally {
      await desktop?.close().catch(() => {});
      await Promise.all(commands.map((command) => command.stop()));
      const secret = process.env.MINIMAX_CN_API_KEY ?? '';
      for (const [index, command] of commands.entries())
        await info
          .attach(`development-command-${index}.log`, {
            body: secret ? command.log().split(secret).join('***') : command.log(),
            contentType: 'text/plain',
          })
          .catch(() => {});
      const stopped = await leaveKernelStopped(directory);
      if (stopped) await rm(root, { recursive: true, force: true });
      else
        info.annotations.push({
          type: 'leftover-kernel',
          description: `内核未确认停止，保留 ${root} 供排查`,
        });
    }
  });
});
