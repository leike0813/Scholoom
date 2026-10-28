import { mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { runCommand } from '../../packages/platform/dist/node.js';

test.skip(process.platform !== 'win32', 'Windows Electron private stdin calibration');
for (const reader of ['simulated', 'fd0'] as const) {
  test(`owned Electron private input through ${reader}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scholoom-electron-stdin-'));
    const executable: string = createRequire(import.meta.url)('electron');
    const input = 'synthetic-private-envelope';
    const result = await runCommand(
      {
        executable,
        args: [
          fileURLToPath(new URL('../fixtures/zotero-host/stdin.cjs', import.meta.url)),
          reader,
          directory,
        ],
        cwd: directory,
        timeoutMs: 10000,
        program: true,
      },
      {
        launchInput: async () => input,
      },
    );
    const observation = JSON.parse(
      await readFile(join(directory, 'stdin-observation.json'), 'utf8'),
    );
    await test.info().attach('stdin-observation', {
      body: JSON.stringify({ reader, code: result.code, ...observation }),
      contentType: 'application/json',
    });
    expect(result.code).toBe(0);
    expect(observation.receivedBytes).toBe(reader === 'simulated' ? 0 : Buffer.byteLength(input));
  });
}
