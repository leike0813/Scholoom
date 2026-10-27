import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';
import { inspectKernel } from '../../apps/kernel/dist/lifecycle.js';
import { limits } from '../../packages/protocol/dist/index.js';
import { closeDesktop } from '../desktop-fixture.js';
import {
  isolatedKernel,
  kernelConnectionTimeout,
  kernelLifecycleDiagnostics,
  kernelResultSummary,
  runKernel,
} from '../kernel-fixture.js';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const desktopLaunch = process.env.SCHOOLOOM_PACKAGED_DESKTOP
  ? { executablePath: process.env.SCHOOLOOM_PACKAGED_DESKTOP, args: [] }
  : { args: [fileURLToPath(new URL('../../apps/desktop', import.meta.url))] };

test('kernel CLI runs under independent Node', () => {
  const output = execFileSync(process.execPath, ['apps/kernel/dist/cli.js', '--info'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  const info = JSON.parse(output) as {
    protocolVersion: number;
    nodeVersion: string;
    processId: number;
  };
  expect(info.protocolVersion).toBe(4);
  expect(info.nodeVersion).toBe(process.versions.node);
  expect(info.processId).toBeGreaterThan(0);
});

test('desktop loads React and its sandbox preload', async () => {
  await isolatedKernel(async (directory) => {
    const app = await electron.launch({
      ...desktopLaunch,
      env: {
        ...process.env,
        SCHOOLOOM_DATA_DIR: directory,
        SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
      },
    });
    const started = performance.now();
    const rendererEvents: unknown[] = [];
    try {
      const window = await app.firstWindow();
      window.on('pageerror', (error) => {
        rendererEvents.push({
          elapsedMs: Math.round(performance.now() - started),
          event: 'pageerror',
          name: error.name,
          frames: error.stack?.split('\n').slice(1, 5),
        });
      });
      window.on('crash', () => rendererEvents.push({ event: 'crash' }));
      window.on('domcontentloaded', () =>
        rendererEvents.push({
          elapsedMs: Math.round(performance.now() - started),
          event: 'domcontentloaded',
        }),
      );
      await expect(window.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(window.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
        timeout: kernelConnectionTimeout,
      });
      await expect(window.getByRole('button', { name: '发送指令' })).toBeDisabled();
      const platform = await window.evaluate(
        () => Reflect.get(window, 'scholoomDesktop')?.platform,
      );
      expect(platform).toBe(process.platform);
      expect(await window.evaluate(() => typeof Reflect.get(window, 'require'))).toBe('undefined');

      const scenario = new URL(window.url());
      scenario.searchParams.set('scenario', 'ui-foundation');
      await window.goto(scenario.href);
      await expect(window.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
        timeout: kernelConnectionTimeout,
      });
      await expect(window.getByRole('checkbox')).toHaveCount(0);
    } catch (error) {
      const windows = await app
        .evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().map((window) => {
            const url = new URL(window.webContents.getURL() || 'about:blank');
            return {
              id: window.id,
              url: `${url.protocol}//${url.host}${url.pathname}`,
              loading: window.webContents.isLoadingMainFrame(),
              destroyed: window.webContents.isDestroyed(),
              rendererProcessId: window.webContents.getOSProcessId(),
            };
          }),
        )
        .catch(() => null);
      await test
        .info()
        .attach('desktop-startup', {
          body: JSON.stringify({
            elapsedMs: Math.round(performance.now() - started),
            windows,
            rendererEvents,
          }),
          contentType: 'application/json',
        })
        .catch(() => {});
      throw error;
    } finally {
      await closeDesktop(app);
    }
    expect((await runKernel(directory, 'status')).state).toBe('running');
  });
});

test('desktop closes without stopping kernel and a new window reconnects', async () => {
  // Two window/bootstrap cycles, each followed by CLI inspection and owned window close.
  test.setTimeout(2 * (kernelConnectionTimeout + limits.lifecycleMs));
  await isolatedKernel(async (directory) => {
    let instanceId: string | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const started = performance.now();
      const events: object[] = [];
      const note = (phase: string, detail: object = {}) => {
        if (events.length < 100)
          events.push({ phase, elapsedMs: Math.round(performance.now() - started), ...detail });
      };
      let app: ElectronApplication | undefined;
      let phase = 'launch';
      try {
        app = await electron.launch({
          ...desktopLaunch,
          env: {
            ...process.env,
            SCHOOLOOM_DATA_DIR: directory,
            SCHOOLOOM_NODE_EXECUTABLE: process.execPath,
          },
        });
        note('desktop-launched');
        phase = 'connection';
        const page = await app.firstWindow();
        note('first-window-observed');
        // Listening starts after firstWindow; missing earlier events do not prove they never occurred.
        page.on('websocket', (socket) => {
          note('ws-created');
          const requests = new Map<string | number, string>();
          socket.on('framesent', ({ payload }) => {
            if (Buffer.byteLength(payload) > 16384) return;
            try {
              const message = JSON.parse(payload.toString());
              if (
                requests.size < 8 &&
                ['kernel.authenticate', 'kernel.status'].includes(message.method) &&
                ['string', 'number'].includes(typeof message.id)
              ) {
                requests.set(message.id, message.method);
                note(`${message.method}-sent`);
              }
            } catch {}
          });
          socket.on('framereceived', ({ payload }) => {
            if (Buffer.byteLength(payload) > 16384) return;
            try {
              const message = JSON.parse(payload.toString());
              const method = requests.get(message.id);
              if (method) {
                requests.delete(message.id);
                note(`${method}-received`, {
                  ok: !message.error,
                  code:
                    typeof message.error?.data?.code === 'string'
                      ? message.error.data.code.slice(0, 64)
                      : undefined,
                });
              }
            } catch {}
          });
          socket.on('socketerror', () => note('ws-error'));
          socket.on('close', () => note('ws-closed'));
        });
        await expect(page.getByRole('status', { name: '连接状态' })).toContainText('已连接', {
          timeout: kernelConnectionTimeout,
        });
        const current = await runKernel(directory, 'status');
        note('connected-status', kernelResultSummary(current));
        expect(current.state).toBe('running');
        if (current.state === 'running') {
          if (instanceId) expect(current.endpoint.instanceId).toBe(instanceId);
          instanceId = current.endpoint.instanceId;
          await page.getByRole('status', { name: '连接状态' }).hover();
          await expect(page.getByText(`实例 ${instanceId}`, { exact: true })).toBeVisible();
        }
      } catch (error) {
        await test.info().attach(`desktop-connection-${attempt}`, {
          body: JSON.stringify({ attempt, phase, events }),
          contentType: 'application/json',
        });
        const observed = await inspectKernel(directory);
        await test.info().attach(`desktop-failure-inspection-${attempt}`, {
          body: JSON.stringify({
            attempt,
            phase: 'after-failed-assertion-before-close',
            kernel: kernelResultSummary(observed),
            lifecycle: await kernelLifecycleDiagnostics(directory),
          }),
          contentType: 'application/json',
        });
        throw error;
      } finally {
        if (app) {
          const child = app.process();
          note('desktop-close-requested');
          try {
            await closeDesktop(app);
          } finally {
            note(
              child.exitCode !== null || child.signalCode !== null
                ? 'desktop-exited'
                : 'desktop-close-unconfirmed',
              {
                exitCode: child.exitCode,
                signal: child.signalCode,
              },
            );
            await test.info().attach(`desktop-close-${attempt}`, {
              body: JSON.stringify({ attempt, events }),
              contentType: 'application/json',
            });
          }
        }
      }
      try {
        const after = await runKernel(directory, 'status');
        await test.info().attach(`desktop-closed-status-${attempt}`, {
          body: JSON.stringify({ attempt, kernel: kernelResultSummary(after) }),
          contentType: 'application/json',
        });
        expect(after.state).toBe('running');
      } catch (error) {
        await test.info().attach(`desktop-closed-status-failure-${attempt}`, {
          body: JSON.stringify({ attempt, phase: 'closed-status', events }),
          contentType: 'application/json',
        });
        throw error;
      }
    }
  });
});

test('compatibility host loads its own hidden Chromium page', async () => {
  const app = await electron.launch({
    args: [fileURLToPath(new URL('../../apps/zotero-host', import.meta.url))],
  });
  try {
    const window = await app.firstWindow();
    await expect(window.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible()),
    ).toBe(false);
  } finally {
    await app.close();
  }
});
