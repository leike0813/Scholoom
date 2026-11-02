import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import { fileURLToPath } from 'node:url';

// Local Linux socket fixture only. No UID changes or OS isolation are simulated.
const [path, mode, helper, expectedUid, limitText] = process.argv.slice(2);
if (path === '--authenticate') {
  assert(mode);
  const { authenticateReportPeer } = await import('../../packages/platform/dist/report-channel.js');
  console.log(JSON.stringify(await authenticateReportPeer(Number(mode))));
} else {
  assert(path && mode && helper && expectedUid && limitText && process.send);
  const limit = Number(limitText);
  const sockets = new Set<Socket>();
  const emissions = new Set<() => void>();
  const children = new Set<ReturnType<typeof spawn>>();
  const send = (message: object) => {
    if (process.connected) process.send?.(message);
  };
  let accepted = 0;
  let stopping = false;
  const server = createServer((socket) => {
    const connection = ++accepted;
    sockets.add(socket);
    socket.on('error', () => {});
    socket.once('close', () => {
      sockets.delete(socket);
      send({ type: 'disconnected', connection });
    });
    send({ type: 'accepted', connection });
    if (mode === 'peer-helper' || mode === 'peer-platform') {
      // Public spawn stdio accepts the connected Stream; do not inspect _handle or its FD.
      const child =
        mode === 'peer-helper'
          ? spawn(helper, ['--peer', expectedUid], { stdio: [socket, 'pipe', 'pipe'] })
          : spawn(
              process.execPath,
              [fileURLToPath(import.meta.url), '--authenticate', expectedUid],
              {
                stdio: [socket, 'pipe', 'pipe'],
              },
            );
      children.add(child);
      let stdout = '',
        stderr = '';
      child.stdout?.on('data', (part: Buffer) => {
        stdout = (stdout + part.toString()).slice(0, 16384);
      });
      child.stderr?.on('data', (part: Buffer) => {
        stderr = (stderr + part.toString()).slice(0, 16384);
      });
      child.once('error', (error) => send({ type: 'failure', message: String(error) }));
      child.once('close', (code, signal) => {
        children.delete(child);
        send({ type: 'peer', connection, code, signal, stdout, stderr });
        socket.destroy();
      });
      return;
    }
    async function fragmented(bytes: Buffer) {
      // An odd chunk size deliberately crosses UTF8 code-point boundaries.
      for (let offset = 0; offset < bytes.length && !socket.destroyed; offset += 1021) {
        await new Promise<void>((resolve, reject) => {
          socket.write(bytes.subarray(offset, offset + 1021), (error) =>
            error ? reject(error) : resolve(),
          );
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
    if (mode !== 'echo') {
      const bytes =
        mode === 'bad-utf8'
          ? Buffer.from([0x7b, 0xc3, 0x28, 0x7d, 0x0a])
          : mode === 'oversize'
            ? Buffer.alloc(limit + 1, 0x61)
            : mode === 'partial-eof'
              ? Buffer.from('{"jsonrpc":"2.0"')
              : undefined;
      assert(bytes, 'Unknown channel fixture mode.');
      const emit = () => {
        emissions.delete(emit);
        void fragmented(bytes)
          .then(() => socket.end())
          .catch((error: unknown) => {
            if (!socket.destroyed) send({ type: 'failure', message: String(error) });
          });
      };
      emissions.add(emit);
      socket.once('close', () => emissions.delete(emit));
      return;
    }
    socket.setEncoding('utf8');
    let pending = '';
    let sequence = 0;
    let writes = Promise.resolve();
    socket.on('data', (part: string) => {
      pending += part;
      for (;;) {
        const newline = pending.indexOf('\n');
        if (newline === -1) break;
        const frame = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        send({
          type: 'received',
          connection,
          sequence: ++sequence,
          bytes: Buffer.byteLength(frame),
        });
        writes = writes
          .then(() => fragmented(Buffer.from(frame + '\n')))
          .catch((error: unknown) => {
            if (!socket.destroyed) send({ type: 'failure', message: String(error) });
          });
      }
    });
  });
  async function stop() {
    if (stopping) return;
    stopping = true;
    for (const socket of sockets) socket.destroy();
    const exits = [...children].map(
      (child) =>
        new Promise<void>((resolve) => {
          child.once('close', () => resolve());
          child.kill('SIGTERM');
        }),
    );
    await Promise.all(exits);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    send({ type: 'closed', accepted, listening: server.listening });
    if (process.connected) process.disconnect();
  }
  process.on('message', (message: { type?: string }) => {
    if (message.type === 'close') void stop();
    else if (message.type === 'emit') for (const emit of emissions) emit();
  });
  process.on('disconnect', () => {
    void stop();
  });
  server.on('error', (error) => {
    send({ type: 'failure', message: String(error) });
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
  await new Promise<void>((resolve) => server.listen(path, resolve));
  await chmod(path, 0o600);
  send({ type: 'ready', pid: process.pid, uid: process.getuid?.(), gid: process.getgid?.() });
}
