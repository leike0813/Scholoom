import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import type { CommandRequest } from './command.js';

let running = false;
let programMode = false;
let replied = false;
let acknowledge: ((seq: number) => void) | undefined;
function reply(value: object) {
  if (replied) return;
  replied = true;
  if (Buffer.byteLength(JSON.stringify(value)) > 1900000)
    value = { error: '命令结果超过传输容量。' };
  // Program receipts may await persistence; the host explicitly closes their owned scope.
  if (process.connected)
    process.send?.(value, () => !programMode && process.connected && process.disconnect());
}
process.on('message', (value: unknown) => {
  const message = value as CommandRequest & { method?: string };
  if (message?.method === 'command.ack') {
    acknowledge?.((value as { seq: number }).seq);
    return;
  }
  if (message?.method === 'execution.stop') {
    if (process.connected) process.disconnect();
    return;
  }
  if (running || !message?.executable || !Array.isArray(message.args) || !message.cwd) return;
  running = true;
  programMode = message.program === true;
  const child = spawn(message.executable, message.args, {
    cwd: message.cwd,
    env: process.env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  });
  if (message.program) {
    let seq = 0;
    let closed = false;
    let code = 1;
    let signal: string | undefined;
    const pending = new Set<number>();
    const streams = [
      {
        name: 'stdout' as const,
        stream: child.stdout,
        decoder: new StringDecoder('utf8'),
        ended: false,
        tail: '',
      },
      {
        name: 'stderr' as const,
        stream: child.stderr,
        decoder: new StringDecoder('utf8'),
        ended: false,
        tail: '',
      },
    ];
    const output = (stream: 'stdout' | 'stderr', text: string) => {
      if (!text) return;
      const id = ++seq;
      pending.add(id);
      process.send?.({ output: { seq: id, stream, text } }, (error) => {
        if (error && process.connected) process.disconnect();
      });
    };
    const drain = () => {
      for (const item of streams) {
        while (pending.size < 4) {
          const bytes = item.stream.read(
            Math.min(16380, item.stream.readableLength),
          ) as Buffer | null;
          if (!bytes) break;
          output(item.name, item.decoder.write(bytes));
        }
        if (pending.size < 4 && item.tail) {
          output(item.name, item.tail);
          item.tail = '';
        }
      }
      if (closed && pending.size === 0 && streams.every((item) => item.ended && !item.tail))
        reply({ result: { code, stdout: '', stderr: '' }, ...(signal ? { signal } : {}) });
    };
    acknowledge = (id) => {
      if (pending.delete(id)) drain();
    };
    for (const item of streams) {
      item.stream.on('readable', drain);
      item.stream.once('end', () => {
        item.ended = true;
        item.tail = item.decoder.end();
        drain();
      });
    }
    child.once('error', (error) => reply({ error: error.message }));
    child.once('close', (exitCode, exitSignal) => {
      closed = true;
      code = exitCode ?? 1;
      signal = exitSignal ?? undefined;
      drain();
    });
    child.stdin.on('error', () => {});
    child.stdin.end(message.input ?? '');
    return;
  }
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
