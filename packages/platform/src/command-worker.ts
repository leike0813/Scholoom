import { spawn } from 'node:child_process';
import type { CommandRequest } from './command.js';

let running = false;
function reply(value: object) {
  if (Buffer.byteLength(JSON.stringify(value)) > 1900000)
    value = { error: '命令结果超过传输容量。' };
  if (process.connected) process.send?.(value, () => process.connected && process.disconnect());
}
process.on('message', (value: unknown) => {
  const message = value as CommandRequest & { method?: string };
  if (message?.method === 'execution.stop') {
    if (process.connected) process.disconnect();
    return;
  }
  if (running || !message?.executable || !Array.isArray(message.args) || !message.cwd) return;
  running = true;
  const child = spawn(message.executable, message.args, {
    cwd: message.cwd,
    env: process.env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let bytes = 0;
  let errorBytes = 0;
  let failed = false;
  child.stdout.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 1048576) {
      if (!failed) reply({ error: '命令输出超过转换容量。' });
      failed = true;
      child.kill();
    } else stdout.push(chunk);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    const remaining = Math.max(0, 65536 - errorBytes);
    if (remaining) stderr.push(chunk.subarray(0, remaining));
    errorBytes += chunk.length;
  });
  child.once('error', (error) => {
    failed = true;
    reply({ error: error.message });
  });
  child.stdin.on('error', () => {});
  child.stdin.end(message.input ?? '');
  child.once('close', (code) => {
    if (!failed)
      reply({
        result: {
          code: code ?? 1,
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
        },
      });
  });
});
