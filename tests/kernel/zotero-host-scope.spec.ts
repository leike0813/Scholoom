import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { processMayBeAlive, runCommand } from '../../packages/platform/dist/node.js';
import { electronTestCommand } from '../fixtures/zotero-host/display.js';

test.skip(process.platform !== 'linux', 'This display command fixture validates Linux only.');

test('existing managed commands reclaim an actual Electron renderer with a busy Worker', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-owned-electron-'));
  const abort = new AbortController();
  const command = runCommand(
    {
      ...(await electronTestCommand(new URL('../fixtures/zotero-host/scope.cjs', import.meta.url), [
        directory,
      ])),
      cwd: directory,
      timeoutMs: 30_000,
    },
    { signal: abort.signal },
  );
  void command.catch(() => {});
  let metrics: { pid: number; type: string }[] = [];
  try {
    await expect
      .poll(
        async () => {
          metrics = await readFile(join(directory, 'ready.json'), 'utf8').then(
            (text) => JSON.parse(text),
            () => [],
          );
          return metrics.some((entry) => entry.type === 'Tab');
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    expect(metrics.some((entry) => entry.type === 'Browser')).toBe(true);
    abort.abort();
    await expect(command).rejects.toThrow();
    expect(metrics.every((entry) => !processMayBeAlive(entry.pid))).toBe(true);
    if (process.env.DISPLAY)
      execFileSync('xdpyinfo', ['-display', process.env.DISPLAY], { timeout: 5000 });
  } finally {
    abort.abort();
    await command.catch(() => {});
  }
});

test('display preparation rejects an unreachable existing display without starting a replacement', async () => {
  await expect(
    electronTestCommand(new URL('../fixtures/zotero-host/scope.cjs', import.meta.url), [], {
      ...process.env,
      DISPLAY: ':65534',
    }),
  ).rejects.toThrow(/display preflight failed \(DISPLAY=:65534\)/);
});

test('display preparation reports new Xvfb scratch failure before launching Electron', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-display-preflight-'));
  await expect(
    electronTestCommand(new URL('../fixtures/zotero-host/scope.cjs', import.meta.url), [], {
      DISPLAY: '',
      TMPDIR: join(directory, 'missing'),
    }),
  ).rejects.toThrow(/display preflight failed \(new Xvfb\)/);
});
