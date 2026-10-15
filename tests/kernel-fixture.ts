import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { BootstrapResult, KernelEndpoint } from '../packages/protocol/dist/index.js';
import { isBootstrapResult } from '../packages/protocol/dist/index.js';

const execute = promisify(execFile);
export const cliPath = fileURLToPath(new URL('../apps/kernel/dist/cli.js', import.meta.url));

export async function runKernel(
  directory: string,
  command: 'start' | 'status' | 'stop',
): Promise<BootstrapResult> {
  let stdout: string;
  try {
    ({ stdout } = await execute(
      process.execPath,
      [cliPath, command, '--data-dir', directory, '--connection-info'],
      { timeout: 20_000 },
    ));
  } catch (error) {
    stdout = (error as { stdout?: string }).stdout ?? '';
  }
  const result: unknown = JSON.parse(stdout);
  if (!isBootstrapResult(result)) throw new Error('Invalid kernel command output');
  return result;
}

export async function runningKernel(directory: string): Promise<KernelEndpoint> {
  const result = await runKernel(directory, 'start');
  if (result.state !== 'running') throw new Error(JSON.stringify(result));
  return result.endpoint;
}

export async function isolatedKernel<T>(use: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'scholoom-test-'));
  try {
    return await use(directory);
  } finally {
    await cleanupKernel(directory);
  }
}

export async function cleanupKernel(directory: string): Promise<void> {
  const result = await runKernel(directory, 'stop');
  if (result.state !== 'stopped') {
    throw new Error(`Test-owned kernel could not be confirmed stopped; preserved ${directory}`);
  }
  await rm(directory, { recursive: true });
}
