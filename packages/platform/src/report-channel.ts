import { spawn } from 'node:child_process';
import { Readable, type Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { limits, OperationError } from '@scholoom/protocol/core';

type Peer = { pid: number; uid: number; gid: number };
type Callbacks = { onFrame(frame: string): void; onClose(error?: Error): void };
type Transport = { send(frame: string): Promise<void>; close(): Promise<void> };
const binary = fileURLToPath(new URL('./report-channel', import.meta.url));
const unavailable = () => new OperationError('unavailable', '报告认证通道已关闭或不可用。');
const authentication = () =>
  new OperationError('authenticationFailed', '报告控制账户或受保护端点未获确认。');
const frameError = () =>
  new OperationError('protocolIncompatible', '报告控制帧超限、编码错误或不完整。');

function linux(): void {
  if (process.platform !== 'linux' || process.arch !== 'x64') throw unavailable();
}
function validUid(uid: number): void {
  if (!Number.isSafeInteger(uid) || uid < 0 || uid >= 0xffffffff) throw authentication();
}
function peer(stream: Readable, expectedUid: number): Promise<Peer> {
  return new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => finish(authentication()), limits.requestMs);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      stream.off('data', data);
      stream.off('end', end);
      stream.off('error', finish);
      if (error) reject(error);
    };
    const data = (chunk: Buffer) => {
      if (Buffer.byteLength(text) + chunk.length > 256) return finish(authentication());
      text += chunk.toString('utf8');
    };
    const end = () => {
      try {
        const result = JSON.parse(text) as Peer;
        if (
          !result ||
          Object.keys(result).length !== 3 ||
          result.uid !== expectedUid ||
          !Number.isSafeInteger(result.pid) ||
          result.pid <= 0 ||
          !Number.isSafeInteger(result.gid) ||
          result.gid < 0 ||
          result.gid >= 0xffffffff
        )
          throw authentication();
        finish();
        resolve(result);
      } catch {
        finish(authentication());
      }
    };
    stream.on('data', data);
    stream.once('end', end);
    stream.once('error', finish);
  });
}

/** Fixed frame storage rejects oversized/incomplete UTF-8 before concatenating a wire string. */
function lines(stream: Readable, callbacks: Callbacks): () => void {
  const buffer = Buffer.allocUnsafe(limits.frameBytes);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0,
    stopped = false;
  const stop = (error?: Error) => {
    if (stopped) return;
    stopped = true;
    stream.off('data', data);
    stream.off('end', end);
    stream.off('error', stop);
    callbacks.onClose(error);
  };
  const data = (chunk: Buffer) => {
    try {
      for (let offset = 0; offset < chunk.length && !stopped; ) {
        const newline = chunk.indexOf(10, offset);
        const end = newline < 0 ? chunk.length : newline;
        const length = end - offset;
        if (size + length > buffer.length) throw frameError();
        chunk.copy(buffer, size, offset, end);
        size += length;
        offset = end + 1;
        if (newline >= 0) {
          if (!size) throw frameError();
          const frame = decoder.decode(buffer.subarray(0, size));
          size = 0;
          callbacks.onFrame(frame);
        }
      }
    } catch {
      stop(frameError());
    }
  };
  const end = () => stop(size ? frameError() : unavailable());
  stream.on('data', data);
  stream.once('end', end);
  stream.once('error', stop);
  return () => {
    if (stopped) return;
    stopped = true;
    stream.off('data', data);
    stream.off('end', end);
    stream.off('error', stop);
  };
}

function send(stream: Writable, frame: string): Promise<void> {
  if (
    typeof frame !== 'string' ||
    frame.includes('\n') ||
    !frame.length ||
    Buffer.byteLength(frame) > limits.frameBytes
  )
    return Promise.reject(frameError());
  return new Promise((resolve, reject) => {
    stream.write(`${frame}\n`, (error) => (error ? reject(unavailable()) : resolve()));
  });
}

/** Account authentication for a PID1-accepted socket inherited as stdin; no request fields are trusted. */
export async function authenticateReportPeer(expectedUid: number): Promise<Peer> {
  linux();
  validUid(expectedUid);
  const child = spawn(binary, ['--peer', String(expectedUid)], {
    stdio: ['inherit', 'pipe', 'ignore'],
    env: { PATH: '/usr/bin:/bin', LANG: 'C' },
  });
  const closed = new Promise<number | null>((resolve) => child.once('close', resolve));
  child.once('error', () => {});
  try {
    const result = await peer(child.stdout, expectedUid);
    if ((await closed) !== 0) throw authentication();
    return result;
  } catch {
    child.kill();
    await closed;
    throw authentication();
  }
}

/** Trusted installation supplies the endpoint owner and listener UID (PID1 for socket activation). */
export async function openReportChannel(
  options: Callbacks & {
    path: string;
    ownerUid: number;
    serverUid: number;
  },
): Promise<Transport & { peer: Peer }> {
  linux();
  validUid(options.ownerUid);
  validUid(options.serverUid);
  if (typeof options.path !== 'string' || options.path.includes('\0')) throw authentication();
  const child = spawn(
    binary,
    ['--connect', options.path, String(options.ownerUid), String(options.serverUid)],
    {
      stdio: ['pipe', 'pipe', 'ignore', 'pipe'],
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    },
  );
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  child.once('error', () => {});
  let active = false,
    notified = false,
    detach = () => {};
  const notify = (error?: Error) => {
    if (!active || notified) return;
    notified = true;
    detach();
    child.kill();
    options.onClose(error);
  };
  void closed.then(() => notify(unavailable()));
  try {
    const ready = child.stdio[3];
    if (!(ready instanceof Readable)) throw authentication();
    const credentials = await peer(ready, options.serverUid);
    if (child.exitCode !== null || child.signalCode !== null) throw authentication();
    const input = child.stdin,
      output = child.stdout;
    if (!input || !output) throw authentication();
    input.on('error', () => notify(unavailable()));
    active = true;
    detach = lines(output, { onFrame: options.onFrame, onClose: notify });
    return {
      peer: credentials,
      send: (frame) => (active && !notified ? send(input, frame) : Promise.reject(unavailable())),
      close: async () => {
        if (active) {
          active = false;
          detach();
          child.kill();
        }
        await closed;
      },
    };
  } catch {
    child.kill();
    await closed;
    throw authentication();
  }
}

/** C's socket is authenticated before installing a reader or exposing the original provider. */
export async function reportStdioChannel(
  expectedUid: number,
  attach: (transport: Transport, peer: Peer) => Callbacks,
): Promise<void> {
  const credentials = await authenticateReportPeer(expectedUid);
  let active = true;
  let detach = () => {};
  const transport: Transport = {
    send: (frame) => (active ? send(process.stdout, frame) : Promise.reject(unavailable())),
    close: async () => {
      active = false;
      detach();
      process.stdin.destroy();
      process.stdout.end();
    },
  };
  const callbacks = attach(transport, credentials);
  const notify = (error?: Error) => {
    if (!active) return;
    active = false;
    callbacks.onClose(error);
  };
  detach = lines(process.stdin, { onFrame: callbacks.onFrame, onClose: notify });
  // This dedicated C process owns stdio until exit, including late EPIPE during shutdown.
  process.stdout.on('error', notify);
}
