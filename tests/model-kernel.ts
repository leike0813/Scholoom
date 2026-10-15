import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { runKernel } from './kernel-fixture.js';

export async function startModelKernel(
  directory: string,
  endpoint: string,
): Promise<() => Promise<void>> {
  const stopped = await runKernel(directory, 'stop');
  if (stopped.state !== 'stopped') throw new Error('Previous isolated kernel did not stop');
  const module = fileURLToPath(new URL('../apps/kernel/dist/lifecycle.js', import.meta.url));
  const source = `import { serveKernel } from ${JSON.stringify(module)}; try { await serveKernel(process.argv[1], {modelEndpoint:process.argv[2],environment:{}}); } catch { process.send?.({state:'failed'}); process.exitCode=1; } finally { process.disconnect?.(); }`;
  const child = spawn(
    process.execPath,
    ['--input-type=module', '-e', source, directory, endpoint],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
  );
  const [ready] = await once(child, 'message');
  if (ready.state !== 'ready') throw new Error('Test-owned kernel did not start');
  return async () => {
    const exited = child.exitCode !== null ? Promise.resolve() : once(child, 'exit');
    const result = await runKernel(directory, 'stop');
    if (result.state !== 'stopped')
      throw new Error('Test-owned kernel exit could not be confirmed');
    await exited;
  };
}
