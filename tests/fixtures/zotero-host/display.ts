import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../../../packages/platform/dist/node.js';

/** Test-only display preparation; both probe and host retain native process ownership. */
export async function electronTestCommand(
  entry: URL,
  tail: readonly string[] = [],
  environment: NodeJS.ProcessEnv = process.env,
) {
  const electron: string = createRequire(import.meta.url)('electron');
  if (process.platform === 'win32')
    return { executable: electron, args: [fileURLToPath(entry), ...tail] };
  const env: Record<string, string> = { TMPDIR: environment.TMPDIR ?? tmpdir() };
  const display = environment.DISPLAY;
  if (display) {
    env.DISPLAY = display;
    if (environment.XAUTHORITY) env.XAUTHORITY = environment.XAUTHORITY;
  }
  const stage = display ? `DISPLAY=${display}` : 'new Xvfb';
  let diagnostics = '';
  try {
    const result = await runCommand(
      {
        executable: display ? '/usr/bin/xdpyinfo' : '/usr/bin/xvfb-run',
        args: display ? ['-display', display] : ['-a', '-e', '/dev/stderr', 'xdpyinfo'],
        cwd: process.cwd(),
        timeoutMs: 5000,
        program: true,
      },
      {
        env,
        observe: async (event) => {
          if (event.kind === 'output' && event.stream === 'stderr')
            diagnostics = (diagnostics + event.text).slice(-4096);
        },
      },
    );
    // Program-mode receipts omit text already delivered through observe.
    diagnostics = (result.stderr || diagnostics).slice(-4096);
    if (result.code !== 0) throw new Error(`display probe exited ${result.code}`);
  } catch (error) {
    throw new Error(
      `Electron test display preflight failed (${stage}): ${String(error)}\n${diagnostics}`,
      {
        cause: error,
      },
    );
  }
  return {
    executable: '/usr/bin/env',
    args: [
      '--',
      ...Object.entries(env).map(([name, value]) => `${name}=${value}`),
      ...(display ? [] : ['/usr/bin/xvfb-run', '-a', '-e', '/dev/stderr']),
      electron,
      '--no-sandbox',
      fileURLToPath(entry),
      ...tail,
    ],
  };
}
