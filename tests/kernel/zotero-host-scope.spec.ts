import { mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { processMayBeAlive, runCommand } from '../../packages/platform/dist/node.js';

test('existing managed commands reclaim an actual Electron renderer with a busy Worker', async () => {
  test.skip(process.platform !== 'linux', 'This Xvfb command fixture validates Linux only.');
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-owned-electron-'));
  const executable = createRequire(import.meta.url)('electron') as string;
  const abort = new AbortController();
  const command = runCommand(
    {
      executable: '/usr/bin/xvfb-run',
      args: [
        '-a',
        executable,
        '--no-sandbox',
        fileURLToPath(new URL('../fixtures/zotero-host/scope.cjs', import.meta.url)),
        directory,
      ],
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
  } finally {
    abort.abort();
    await command.catch(() => {});
  }
});
