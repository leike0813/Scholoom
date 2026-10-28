import { mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { runCommand } from '../../packages/platform/dist/node.js';

test.skip(process.platform !== 'win32', 'Windows Electron private stdin calibration');
for (const detachConsole of [false, true]) {
  test(`owned Electron receives a synthetic envelope with no-attach-console=${detachConsole}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scholoom-electron-stdin-'));
    const executable: string = createRequire(import.meta.url)('electron');
    const input = 'synthetic-private-envelope';
    const result = await runCommand(
      {
        executable,
        args: [
          fileURLToPath(new URL('../fixtures/zotero-host/stdin.cjs', import.meta.url)),
          directory,
        ],
        cwd: directory,
        timeoutMs: 10000,
        program: true,
      },
      {
        env: detachConsole ? { ELECTRON_NO_ATTACH_CONSOLE: '1' } : {},
        launchInput: async () => input,
      },
    );
    const observation = JSON.parse(
      await readFile(join(directory, 'stdin-observation.json'), 'utf8'),
    );
    await test.info().attach('stdin-observation', {
      body: JSON.stringify({ detachConsole, code: result.code, ...observation }),
      contentType: 'application/json',
    });
    expect(result.code).toBe(0);
    expect(observation.receivedBytes).toBe(Buffer.byteLength(input));
  });
}
